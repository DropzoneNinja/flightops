import { useState, useEffect, useRef, useMemo, lazy, Suspense } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQueries } from '@tanstack/react-query';
import { useFlightById, useFlightAnalysis, useFlightReanalyze, useFlightsByDate } from '../hooks/useFlights';
import FlightScoreCard from '../components/Flights/FlightScoreCard';
import FlightMap2D from '../components/Flights/FlightMap2D';
import FlightCharts from '../components/Flights/FlightCharts';
import FlightEventsList from '../components/Flights/FlightEventsList';
import PhaseTimeline from '../components/Flights/PhaseTimeline';
import { PHASE_COLORS, PHASE_LABELS, PILOT_COLORS } from '../components/Flights/FlightViewer3D';
import { flightsService } from '../services/flights.service';
import type { FlightEvent, Trackpoint } from '../services/flights.service';
import type { FlightData, PilotDistanceLine } from '../components/Flights/flight-viewer.types';

// Lazy-load the 3D viewer so deck.gl / MapLibre are not in the initial bundle
const FlightViewer3D = lazy(() => import('../components/Flights/FlightViewer3D'));

// ─── Helpers ───────────────────────────────────────────────────────────────

function formatDuration(seconds: number | null): string {
  if (seconds === null) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatDistance(metres: number | null): string {
  if (metres === null) return '—';
  if (metres >= 1000) return `${(metres / 1000).toFixed(1)} km`;
  return `${Math.round(metres)} m`;
}

function formatAltitude(metres: number | null): string {
  if (metres === null) return '—';
  return `${Math.round(metres * 3.28084)} ft`;
}

function formatSpeed(mps: number | null): string {
  if (mps === null) return '—';
  return `${(mps * 3.6).toFixed(1)} km/h`;
}

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6_371_000;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Phase color legend ────────────────────────────────────────────────────

const PHASE_ORDER = [
  'pre_takeoff', 'takeoff', 'climb', 'cruise', 'turn',
  'descent', 'approach', 'landing', 'post_landing', 'unknown',
];

function PhaseLegend({ trackpoints }: { trackpoints: Trackpoint[] }) {
  const presentPhases = PHASE_ORDER.filter((phase) =>
    trackpoints.some((tp) => tp.phase === phase),
  );
  if (presentPhases.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1.5">
      {presentPhases.map((phase) => (
        <div key={phase} className="flex items-center gap-1.5">
          <span
            className="inline-block w-3 h-3 rounded-sm flex-shrink-0"
            style={{ backgroundColor: PHASE_COLORS[phase] }}
          />
          <span className="text-xs text-sky-dusk">{PHASE_LABELS[phase] ?? phase}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Inspector section divider ─────────────────────────────────────────────

function InspectorSection({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-slate-200 px-4 py-3 last:border-b-0">
      {title && (
        <p className="text-xs font-semibold text-sky-night mb-2 uppercase tracking-wide">{title}</p>
      )}
      {children}
    </div>
  );
}

// ─── Component ─────────────────────────────────────────────────────────────

export default function FlightAnalysis() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: flight, isLoading: flightLoading, error: flightError } = useFlightById(id);
  const { data: analysis, isLoading: analysisLoading } = useFlightAnalysis(id);
  const reanalyzeMutation = useFlightReanalyze();

  // Hover highlight (ephemeral, follows mouse/scrubber)
  const [activePointIndex, setActivePointIndex] = useState<number | null>(null);
  // Click-pinned highlight (persistent)
  const [pinnedPointIndex, setPinnedPointIndex] = useState<number | null>(null);
  // Active event for inspector scroll
  const [activeEventId, setActiveEventId] = useState<string | null>(null);
  // Inspector panel open/collapsed
  const [inspectorOpen, setInspectorOpen] = useState(true);
  // Wall/curtain transparency (0–1)
  const [wallOpacity, setWallOpacity] = useState(0.35);
  // Trail length (0–100 %)
  const [trailPercent, setTrailPercent] = useState(100);
  // Map view mode
  const [viewMode, setViewMode] = useState<'2d' | '3d'>('3d');
  // Pilot overlay selector
  const [selectedFlightIds, setSelectedFlightIds] = useState<Set<string>>(new Set());
  const [pilotSelectorOpen, setPilotSelectorOpen] = useState(false);
  const pilotSelectorRef = useRef<HTMLDivElement>(null);
  // Show distance lines between all loaded pilots
  const [showPilotDistances, setShowPilotDistances] = useState(false);

  // Lock body scroll while this page is mounted
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Close pilot selector when clicking outside
  useEffect(() => {
    if (!pilotSelectorOpen) return;
    const handler = (e: MouseEvent) => {
      if (pilotSelectorRef.current && !pilotSelectorRef.current.contains(e.target as Node)) {
        setPilotSelectorOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [pilotSelectorOpen]);

  // Flights from the same day (for overlay selector)
  const { data: dayFlights = [] } = useFlightsByDate(flight?.flight_date);
  const otherFlights = dayFlights.filter(
    (f) => f.id !== flight?.id && f.parse_status === 'analyzed',
  );

  // Fetch full trackpoint data for each selected overlay flight
  const overlayQueries = useQueries({
    queries: [...selectedFlightIds].map((oid) => ({
      queryKey: ['flights', oid],
      queryFn: () => flightsService.getFlightById(oid),
      staleTime: 60 * 1000,
    })),
  });

  const overlayFlights: FlightData[] = overlayQueries.flatMap((q, i) => {
    const f = q.data;
    if (!f?.trackpoints_json?.length) return [];
    return [{
      id: f.id,
      trackpoints: f.trackpoints_json,
      label: f.pilot?.display_name ?? f.title ?? f.original_filename,
      color: PILOT_COLORS[i % PILOT_COLORS.length],
    }];
  });

  // Compute distance lines between all pilots at the current pinned/last position
  const pilotDistanceLines = useMemo<PilotDistanceLine[]>(() => {
    if (!showPilotDistances || overlayFlights.length === 0) return [];
    const primaryTps = flight?.trackpoints_json ?? [];
    const primaryIdx = pinnedPointIndex ?? primaryTps.length - 1;
    const primaryPt = primaryTps[primaryIdx];
    if (!primaryPt) return [];

    const primaryLabel =
      flight?.pilot?.display_name ?? flight?.title ?? flight?.original_filename ?? 'Primary';

    // For each overlay, find the trackpoint closest in time (or proportional position)
    const others = overlayFlights.map((of) => {
      let idx: number;
      if (primaryPt.timestamp) {
        const targetMs = new Date(primaryPt.timestamp).getTime();
        let best = 0;
        let bestDist = Infinity;
        for (let i = 0; i < of.trackpoints.length; i++) {
          const ts = of.trackpoints[i].timestamp;
          if (!ts) continue;
          const d = Math.abs(new Date(ts).getTime() - targetMs);
          if (d < bestDist) { bestDist = d; best = i; }
        }
        idx = best;
      } else {
        const frac = primaryTps.length > 1 ? primaryIdx / (primaryTps.length - 1) : 0.5;
        idx = Math.round(frac * (of.trackpoints.length - 1));
      }
      return { tp: of.trackpoints[idx] ?? null, label: of.label ?? of.id, color: of.color };
    });

    const lines: PilotDistanceLine[] = [];

    // Primary → each overlay
    for (const op of others) {
      if (!op.tp) continue;
      lines.push({
        fromLat: primaryPt.lat, fromLon: primaryPt.lon, fromElev: primaryPt.elevation_m,
        toLat: op.tp.lat, toLon: op.tp.lon, toElev: op.tp.elevation_m,
        distance_m: haversineMeters(primaryPt.lat, primaryPt.lon, op.tp.lat, op.tp.lon),
        fromLabel: primaryLabel, toLabel: op.label,
        toColor: op.color,
      });
    }

    // Overlay → overlay pairs
    for (let i = 0; i < others.length; i++) {
      for (let j = i + 1; j < others.length; j++) {
        const a = others[i]; const b = others[j];
        if (!a.tp || !b.tp) continue;
        lines.push({
          fromLat: a.tp.lat, fromLon: a.tp.lon, fromElev: a.tp.elevation_m,
          toLat: b.tp.lat, toLon: b.tp.lon, toElev: b.tp.elevation_m,
          distance_m: haversineMeters(a.tp.lat, a.tp.lon, b.tp.lat, b.tp.lon),
          fromLabel: a.label, toLabel: b.label,
          fromColor: a.color, toColor: b.color,
        });
      }
    }

    return lines;
  }, [showPilotDistances, overlayFlights, pinnedPointIndex, flight]);

  const toggleFlightOverlay = (oid: string) => {
    setSelectedFlightIds((prev) => {
      const next = new Set(prev);
      next.has(oid) ? next.delete(oid) : next.add(oid);
      return next;
    });
  };

  // ── Loading / error states ─────────────────────────────────────────────
  if (flightLoading) {
    return (
      <div style={{ position: 'fixed', inset: 0 }} className="bg-slate-900 flex items-center justify-center">
        <div className="animate-pulse text-slate-400 text-sm">Loading flight…</div>
      </div>
    );
  }

  if (flightError || !flight) {
    return (
      <div style={{ position: 'fixed', inset: 0 }} className="bg-slate-900 flex flex-col items-center justify-center gap-4">
        <p className="text-red-400">Flight not found.</p>
        <button onClick={() => navigate(-1)} className="text-sky-400 underline text-sm">
          Go back
        </button>
      </div>
    );
  }

  const analysisComplete = flight.analysis_status === 'complete';
  const analysisFailed = flight.analysis_status === 'failed';
  const trackpoints = flight.trackpoints_json ?? [];
  const hasTrackpoints = trackpoints.length > 0;

  const handleEventClick = (evt: FlightEvent) => {
    setActiveEventId(evt.id);
    if (evt.seq_start != null) {
      const idx = trackpoints.findIndex((tp) => tp.seq === evt.seq_start);
      if (idx >= 0) setPinnedPointIndex(idx);
    }
  };

  const handleMapClick = (idx: number) => {
    setPinnedPointIndex(idx);
  };

  const handleChartClick = (originalIndex: number | null) => {
    setPinnedPointIndex(originalIndex);
    setActivePointIndex(originalIndex);
  };

  const INSPECTOR_WIDTH = 380;

  return (
    <div
      style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', background: '#0f172a' }}
    >
      {/* ── Compact header bar ─────────────────────────────────────────── */}
      <div
        style={{ height: 48, flexShrink: 0 }}
        className="bg-slate-900 border-b border-slate-700 flex items-center gap-3 px-3 z-20"
      >
        <button
          onClick={() => navigate(-1)}
          className="p-1.5 rounded-lg hover:bg-slate-700 transition-colors text-slate-400 hover:text-white text-sm"
          aria-label="Back"
        >
          ←
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="font-semibold text-white text-sm truncate leading-tight">
            {flight.title || flight.original_filename}
          </h1>
          {flight.pilot && (
            <p className="text-xs text-slate-400 leading-tight truncate">{flight.pilot.display_name}</p>
          )}
        </div>
        {/* 2D / 3D toggle */}
        <div className="flex rounded-lg border border-slate-600 overflow-hidden">
          {(['2d', '3d'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`px-2.5 py-1 text-xs transition-colors ${
                viewMode === mode
                  ? 'bg-sky-600 text-white'
                  : 'text-slate-300 hover:bg-slate-700 hover:text-white'
              }`}
            >
              {mode.toUpperCase()}
            </button>
          ))}
        </div>
        {/* Pilot overlay selector */}
        {otherFlights.length > 0 && (
          <div className="relative" ref={pilotSelectorRef}>
            <button
              onClick={() => setPilotSelectorOpen((o) => !o)}
              className={`px-2.5 py-1 text-xs border rounded-lg transition-colors ${
                selectedFlightIds.size > 0
                  ? 'border-sky-500 text-sky-400 bg-sky-950 hover:bg-sky-900'
                  : 'border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white'
              }`}
              title="Show other pilots from this day"
            >
              Pilots{selectedFlightIds.size > 0 ? ` +${selectedFlightIds.size}` : ''}
            </button>

            {pilotSelectorOpen && (
              <div className="absolute right-0 top-full mt-1 w-56 bg-slate-800 border border-slate-600 rounded-lg shadow-xl z-50 overflow-hidden">
                <div className="px-3 py-2 border-b border-slate-700">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                    Other Flights — {flight.flight_date}
                  </p>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {otherFlights.map((f, i) => {
                    const color = PILOT_COLORS[i % PILOT_COLORS.length];
                    const checked = selectedFlightIds.has(f.id);
                    const label = f.pilot?.display_name ?? f.title ?? f.original_filename;
                    return (
                      <button
                        key={f.id}
                        onClick={() => toggleFlightOverlay(f.id)}
                        className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-slate-700 transition-colors text-left"
                      >
                        <span
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: `rgb(${color.join(',')})` }}
                        />
                        <span className="flex-1 text-xs text-slate-200 truncate">{label}</span>
                        <span className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                          checked ? 'bg-sky-500 border-sky-500' : 'border-slate-500'
                        }`}>
                          {checked && <span className="text-white text-[10px] leading-none">✓</span>}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        <button
          onClick={() => reanalyzeMutation.mutate(flight.id)}
          disabled={reanalyzeMutation.isPending || flight.analysis_status === 'running'}
          className="px-2.5 py-1 text-xs border border-slate-600 text-slate-300 rounded-lg hover:bg-slate-700 hover:text-white transition-colors disabled:opacity-40"
          title="Re-run analysis"
        >
          {reanalyzeMutation.isPending ? '…' : 'Re-analyze'}
        </button>
        {/* Inspector toggle */}
        <button
          onClick={() => setInspectorOpen((o) => !o)}
          className="px-2.5 py-1 text-xs border border-slate-600 text-slate-300 rounded-lg hover:bg-slate-700 hover:text-white transition-colors"
          title={inspectorOpen ? 'Hide inspector' : 'Show inspector'}
        >
          {inspectorOpen ? 'Hide ›' : '‹ Inspect'}
        </button>
      </div>

      {/* ── Content row: map + inspector ──────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>

        {/* Map area — fills all remaining space */}
        <div style={{ flex: 1, position: 'relative', minWidth: 0 }}>
          {hasTrackpoints ? (
            viewMode === '3d' ? (
              <Suspense
                fallback={
                  <div className="w-full h-full flex items-center justify-center bg-slate-900 text-sm text-slate-400">
                    Loading 3D viewer…
                  </div>
                }
              >
                <FlightViewer3D
                  trackpoints={trackpoints}
                  bbox={flight.bbox_json}
                  events={analysis?.events}
                  flights={overlayFlights}
                  trailPercent={trailPercent}
                  activePointIndex={activePointIndex}
                  onPointHover={setActivePointIndex}
                  pinnedPointIndex={pinnedPointIndex}
                  onPointClick={handleMapClick}
                  wallOpacity={wallOpacity}
                  timezone={flight.timezone}
                  distanceLines={pilotDistanceLines}
                  className="w-full h-full"
                />
              </Suspense>
            ) : (
              <FlightMap2D
                trackpoints={trackpoints}
                bbox={flight.bbox_json}
                events={analysis?.events}
                flights={overlayFlights}
                trailPercent={trailPercent}
                activePointIndex={activePointIndex}
                onPointHover={setActivePointIndex}
                pinnedPointIndex={pinnedPointIndex}
                distanceLines={pilotDistanceLines}
                className="w-full h-full"
              />
            )
          ) : (
            <div className="w-full h-full flex items-center justify-center text-slate-400 text-sm">
              No track data available
            </div>
          )}
        </div>

        {/* Inspector panel */}
        {inspectorOpen && (
          <div
            style={{
              width: INSPECTOR_WIDTH,
              flexShrink: 0,
              overflowY: 'auto',
              background: '#fff',
              borderLeft: '1px solid #e2e8f0',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Flight summary stats */}
            <InspectorSection title="Flight Summary">
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Duration',     value: formatDuration(flight.duration_seconds) },
                  { label: 'Distance',     value: formatDistance(flight.total_distance_m) },
                  { label: 'Max Altitude', value: formatAltitude(flight.max_altitude_m) },
                  { label: 'Alt Gain',     value: formatAltitude(flight.altitude_gain_m) },
                  { label: 'Max Speed',    value: formatSpeed(flight.max_speed_mps) },
                  { label: 'Avg Speed',    value: formatSpeed(flight.avg_speed_mps) },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-slate-50 rounded-lg p-2 text-center">
                    <p className="text-[10px] text-sky-dusk">{label}</p>
                    <p className="text-xs font-semibold text-sky-night mt-0.5">{value}</p>
                  </div>
                ))}
              </div>
              {(flight.glider || flight.launch_site_name) && (
                <div className="mt-2 space-y-0.5">
                  {flight.glider && (
                    <p className="text-xs text-sky-dusk">
                      Glider: <span className="font-medium text-sky-night">{flight.glider}</span>
                    </p>
                  )}
                  {flight.launch_site_name && (
                    <p className="text-xs text-sky-dusk">
                      Launch: <span className="font-medium text-sky-night">{flight.launch_site_name}</span>
                    </p>
                  )}
                </div>
              )}
            </InspectorSection>

            {/* Wall transparency slider */}
            {hasTrackpoints && (
              <InspectorSection title="Wall Transparency">
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={Math.round(wallOpacity * 100)}
                    onChange={(e) => setWallOpacity(Number(e.target.value) / 100)}
                    className="flex-1 cursor-pointer accent-sky-500"
                  />
                  <span className="text-xs text-sky-dusk w-8 text-right tabular-nums">
                    {Math.round(wallOpacity * 100)}%
                  </span>
                </div>
              </InspectorSection>
            )}

            {/* Trail length slider */}
            {hasTrackpoints && (
              <InspectorSection title="Trail Length">
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={trailPercent}
                    onChange={(e) => setTrailPercent(Number(e.target.value))}
                    className="flex-1 cursor-pointer accent-sky-500"
                  />
                  <span className="text-xs text-sky-dusk w-8 text-right tabular-nums">
                    {trailPercent}%
                  </span>
                </div>
              </InspectorSection>
            )}

            {/* Phase color legend */}
            {hasTrackpoints && trackpoints.some((tp) => tp.phase && tp.phase !== 'unknown') && (
              <InspectorSection title="Phase Legend">
                <PhaseLegend trackpoints={trackpoints} />
              </InspectorSection>
            )}

            {/* Pilot distance lines toggle — only visible when overlays are loaded */}
            {overlayFlights.length > 0 && (
              <InspectorSection title="Pilot Distances">
                <button
                  onClick={() => setShowPilotDistances((v) => !v)}
                  className={`w-full py-1.5 px-3 text-xs font-medium rounded-lg border transition-colors ${
                    showPilotDistances
                      ? 'bg-sky-600 border-sky-500 text-white'
                      : 'border-slate-300 text-sky-night hover:bg-slate-50'
                  }`}
                >
                  {showPilotDistances ? 'Hide Distance Lines' : 'Show Distance Lines'}
                </button>
                {showPilotDistances && pilotDistanceLines.length > 0 && (
                  <div className="mt-2 space-y-1.5">
                    {pilotDistanceLines.map((line, i) => (
                      <div key={i} className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          {line.fromColor && (
                            <span
                              className="w-2 h-2 rounded-full flex-shrink-0"
                              style={{ background: `rgb(${line.fromColor.join(',')})` }}
                            />
                          )}
                          <span className="text-[11px] text-sky-dusk truncate">
                            {line.fromLabel}
                          </span>
                          <span className="text-[11px] text-slate-400 flex-shrink-0">↔</span>
                          {line.toColor && (
                            <span
                              className="w-2 h-2 rounded-full flex-shrink-0"
                              style={{ background: `rgb(${line.toColor.join(',')})` }}
                            />
                          )}
                          <span className="text-[11px] text-sky-dusk truncate">
                            {line.toLabel}
                          </span>
                        </div>
                        <span className="text-xs font-semibold text-sky-night flex-shrink-0 tabular-nums">
                          {formatDistance(line.distance_m)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </InspectorSection>
            )}

            {/* Score card */}
            {analysisComplete && analysis?.score ? (
              <InspectorSection title="Flight Score">
                <FlightScoreCard
                  score={analysis.score}
                  confidenceScore={flight.confidence_score}
                />
              </InspectorSection>
            ) : analysisFailed ? (
              <InspectorSection>
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-700">
                  Analysis failed. Use Re-analyze to retry.
                </div>
              </InspectorSection>
            ) : (analysisLoading || flight.analysis_status === 'running' || flight.analysis_status === 'pending') ? (
              <InspectorSection>
                <div className="flex items-center gap-2 text-xs text-sky-dusk">
                  <svg className="animate-spin h-4 w-4 text-sky-morning shrink-0" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Analyzing flight…
                </div>
              </InspectorSection>
            ) : null}

            {/* Charts */}
            {hasTrackpoints && (
              <InspectorSection title="Flight Metrics">
                <FlightCharts
                  trackpoints={trackpoints}
                  events={analysis?.events}
                  score={analysis?.score}
                  activePointIndex={activePointIndex}
                  onPointHover={setActivePointIndex}
                  pinnedPointIndex={pinnedPointIndex}
                  onPointClick={handleChartClick}
                />
              </InspectorSection>
            )}

            {/* Phase timeline */}
            {analysisComplete && hasTrackpoints && (
              <InspectorSection title="Phase Breakdown">
                <PhaseTimeline trackpoints={trackpoints} />
              </InspectorSection>
            )}

            {/* Detected events */}
            {analysisComplete && analysis?.events && analysis.events.length > 0 && (
              <InspectorSection title="Detected Events">
                <FlightEventsList
                  events={analysis.events}
                  activeEventId={activeEventId}
                  onEventClick={handleEventClick}
                  timezone={flight.timezone}
                />
              </InspectorSection>
            )}

            {/* Notes */}
            {flight.notes && (
              <InspectorSection title="Notes">
                <p className="text-xs text-sky-dusk whitespace-pre-wrap">{flight.notes}</p>
              </InspectorSection>
            )}

          </div>
        )}
      </div>
    </div>
  );
}
