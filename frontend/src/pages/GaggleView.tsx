import { useState, useEffect, useRef, useCallback, useMemo, lazy, Suspense } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQueries } from '@tanstack/react-query';
import { useFlightsByDate } from '../hooks/useFlights';
import { flightsService } from '../services/flights.service';
import { PILOT_COLORS } from '../components/Flights/GaggleViewer';
import { formatFlightTime } from '../utils/flight-time';
import type { Trackpoint, Flight } from '../services/flights.service';
import type { GagglePilot } from '../components/Flights/GaggleViewer';

const GaggleViewer = lazy(() => import('../components/Flights/GaggleViewer'));

// ─── Leaderboard stat helpers ─────────────────────────────────────────────────

/** Count distinct phase segments of a given phase label */
function countPhaseSegments(trackpoints: Trackpoint[], phase: string): number {
  let count = 0;
  let inPhase = false;
  for (const tp of trackpoints) {
    if (tp.phase === phase) {
      if (!inPhase) { count++; inPhase = true; }
    } else {
      inPhase = false;
    }
  }
  return count;
}

/** Longest consecutive cruise segment where altitude stays within ±50 m of the
 *  segment's starting elevation. Returns duration in seconds. */
function longestStableCruiseSecs(trackpoints: Trackpoint[]): number {
  let best = 0;
  let segStartIdx = -1;
  let segStartElev = 0;
  let segStartMs = 0;

  for (let i = 0; i < trackpoints.length; i++) {
    const tp = trackpoints[i];
    if (tp.phase !== 'cruise') { segStartIdx = -1; continue; }

    const elev = tp.elevation_m ?? 0;
    const ms = tp.timestamp ? new Date(tp.timestamp).getTime() : i * 1000;

    if (segStartIdx < 0) {
      segStartIdx = i;
      segStartElev = elev;
      segStartMs = ms;
    } else if (Math.abs(elev - segStartElev) > 50) {
      // Altitude drifted — restart segment here
      segStartIdx = i;
      segStartElev = elev;
      segStartMs = ms;
    } else {
      const secs = (ms - segStartMs) / 1000;
      if (secs > best) best = secs;
    }
  }
  return best;
}

/** Maximum heading-change rate (deg/s) while in turn phase.
 *  Higher = tighter turn. Returns turn radius in metres when speed is available. */
function tightestTurnRadius(trackpoints: Trackpoint[]): number | null {
  let maxRate = 0; // deg/s
  let speedAtMax = 0; // m/s

  for (let i = 1; i < trackpoints.length; i++) {
    const prev = trackpoints[i - 1];
    const curr = trackpoints[i];
    if (curr.phase !== 'turn') continue;
    if (curr.heading_deg === null || prev.heading_deg === null) continue;
    if (!curr.timestamp || !prev.timestamp) continue;

    const dt = (new Date(curr.timestamp).getTime() - new Date(prev.timestamp).getTime()) / 1000;
    if (dt <= 0 || dt > 5) continue; // skip gaps

    let dh = Math.abs(curr.heading_deg - prev.heading_deg);
    if (dh > 180) dh = 360 - dh;
    const rate = dh / dt;

    if (rate > maxRate) {
      maxRate = rate;
      speedAtMax = curr.speed_mps ?? prev.speed_mps ?? 0;
    }
  }

  if (maxRate === 0) return null;
  // R = v / ω  where ω = rate in rad/s
  const omega = maxRate * (Math.PI / 180);
  return speedAtMax > 0 ? speedAtMax / omega : null;
}

/** Maximum G-force recorded across trackpoints (Gaggle telemetry). */
function maxGForce(trackpoints: Trackpoint[]): number | null {
  let max: number | null = null;
  for (const tp of trackpoints) {
    const g = tp.gaggle_g_force;
    if (g != null && (max === null || g > max)) max = g;
  }
  return max;
}

interface LeaderboardEntry {
  category: string;
  icon: string;
  pilotId: string;
  pilotName: string;
  color: [number, number, number];
  value: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Derive a consensus timezone for a set of loaded flights.
 *  If any flight is 'local' (no-Z timestamps) the whole session uses UTC getters
 *  to avoid double-conversion; otherwise use browser local time. */
function deriveSessionTimezone(flights: Flight[]): string {
  return flights.some((f) => f.timezone === 'local') ? 'local' : 'UTC';
}

function formatDate(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00`);
  return d.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

/** Get the first real unix timestamp from a flight's trackpoints.
 *  Falls back to flight.start_at, then null. */
function firstTsMs(flight: Flight): number | null {
  const tps = flight.trackpoints_json;
  if (tps && tps.length > 0 && tps[0].timestamp) {
    return new Date(tps[0].timestamp).getTime();
  }
  if (flight.start_at) return new Date(flight.start_at).getTime();
  return null;
}

function lastTsMs(flight: Flight): number | null {
  const tps = flight.trackpoints_json;
  if (tps && tps.length > 0 && tps[tps.length - 1].timestamp) {
    return new Date(tps[tps.length - 1].timestamp!).getTime();
  }
  if (flight.end_at) return new Date(flight.end_at).getTime();
  if (flight.start_at && flight.duration_seconds) {
    return new Date(flight.start_at).getTime() + flight.duration_seconds * 1000;
  }
  return null;
}

/** Compute synthetic per-trackpoint timestamps when they are missing,
 *  using the flight's start_at and duration_seconds as bounds. */
function resolveTimestamps(trackpoints: Trackpoint[], flight: Flight): Trackpoint[] {
  if (trackpoints.length === 0) return trackpoints;
  if (trackpoints[0].timestamp !== null) return trackpoints; // already have timestamps

  const startMs = flight.start_at ? new Date(flight.start_at).getTime() : null;
  const durationMs = flight.duration_seconds ? flight.duration_seconds * 1000 : null;
  if (startMs === null || durationMs === null) return trackpoints;

  return trackpoints.map((tp, i) => ({
    ...tp,
    timestamp: new Date(startMs + (i / Math.max(1, trackpoints.length - 1)) * durationMs).toISOString(),
  }));
}

// Live metrics at a given unix ms for a pilot
function metricsAt(
  pilot: GagglePilot,
  playbackTime: number,
): { altitude_ft: number | null; speed_kmh: number | null; vspeed_mps: number | null } | null {
  const { trackpoints, firstTimestampMs } = pilot;
  if (trackpoints.length === 0) return null;
  if (firstTimestampMs !== null && playbackTime < firstTimestampMs) return null;

  // Find last trackpoint ≤ playbackTime
  let idx = trackpoints.length - 1;
  for (let i = 0; i < trackpoints.length; i++) {
    if (trackpoints[i].timestamp === null) continue;
    const ts = new Date(trackpoints[i].timestamp!).getTime();
    if (ts > playbackTime) { idx = Math.max(0, i - 1); break; }
  }

  const tp = trackpoints[idx];
  return {
    altitude_ft: tp.elevation_m !== null ? Math.round(tp.elevation_m * 3.28084) : null,
    speed_kmh: tp.speed_mps !== null ? parseFloat((tp.speed_mps * 3.6).toFixed(1)) : null,
    vspeed_mps: tp.vertical_speed_mps !== null ? parseFloat(tp.vertical_speed_mps.toFixed(1)) : null,
  };
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function GaggleView() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const date = searchParams.get('date') ?? undefined;

  // Load flight list for the date (no trackpoints yet)
  const { data: flightList, isLoading: listLoading } = useFlightsByDate(date);

  // Filter to flights that are at least parsed (have trackpoints)
  const loadableIds = useMemo(
    () =>
      (flightList ?? [])
        .filter((f) => f.parse_status === 'analyzed' || f.parse_status === 'parsing')
        .map((f) => f.id),
    [flightList],
  );

  // Batch-load full flight data (with trackpoints) for each flight
  const flightQueries = useQueries({
    queries: loadableIds.map((id) => ({
      queryKey: ['flights', id],
      queryFn: () => flightsService.getFlightById(id),
      staleTime: 60 * 1000,
    })),
  });

  const loadedFlights = useMemo(
    () =>
      flightQueries
        .map((q) => q.data)
        .filter((f): f is Flight => f != null && f.trackpoints_json != null && f.trackpoints_json.length > 0),
    [flightQueries],
  );

  const isLoading = listLoading || flightQueries.some((q) => q.isLoading);

  // Timezone consensus: 'local' if any flight used no-Z timestamps, else 'UTC'
  const sessionTimezone = useMemo(() => deriveSessionTimezone(loadedFlights), [loadedFlights]);

  // ── Build GagglePilot list ────────────────────────────────────────────────
  const gagglePilots = useMemo<GagglePilot[]>(() => {
    return loadedFlights.map((flight, i) => {
      const trackpoints = resolveTimestamps(flight.trackpoints_json!, flight);
      const color = PILOT_COLORS[i % PILOT_COLORS.length];
      return {
        id: flight.id,
        pilotName:
          flight.pilot?.display_name ??
          flight.title ??
          `Pilot ${i + 1}`,
        color,
        trackpoints,
        firstTimestampMs: firstTsMs(flight),
        lastTimestampMs: lastTsMs(flight),
      };
    }).sort((a, b) => (a.firstTimestampMs ?? 0) - (b.firstTimestampMs ?? 0));
  }, [loadedFlights]);

  // ── Combined bounding box ─────────────────────────────────────────────────
  const combinedBbox = useMemo(() => {
    if (loadedFlights.length === 0) return null;
    let minLon = Infinity, minLat = Infinity, maxLon = -Infinity, maxLat = -Infinity;
    for (const f of loadedFlights) {
      if (!f.bbox_json) continue;
      const b = f.bbox_json;
      minLon = Math.min(minLon, b.minLon);
      minLat = Math.min(minLat, b.minLat);
      maxLon = Math.max(maxLon, b.maxLon);
      maxLat = Math.max(maxLat, b.maxLat);
    }
    return isFinite(minLon) ? { minLon, minLat, maxLon, maxLat } : null;
  }, [loadedFlights]);

  // ── Playback globals ──────────────────────────────────────────────────────
  const globalStart = useMemo(
    () =>
      gagglePilots.reduce<number | null>((acc, p) => {
        if (p.firstTimestampMs === null) return acc;
        return acc === null ? p.firstTimestampMs : Math.min(acc, p.firstTimestampMs);
      }, null),
    [gagglePilots],
  );
  const globalEnd = useMemo(
    () =>
      gagglePilots.reduce<number | null>((acc, p) => {
        if (p.lastTimestampMs === null) return acc;
        return acc === null ? p.lastTimestampMs : Math.max(acc, p.lastTimestampMs);
      }, null),
    [gagglePilots],
  );
  const sessionDurationMs = globalStart !== null && globalEnd !== null ? globalEnd - globalStart : 0;

  // ── UI State ──────────────────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [wallOpacity, setWallOpacity] = useState(0.35);
  const [trailPercent, setTrailPercent] = useState(100);
  const [showDistances, setShowDistances] = useState(false);
  const [showSpeed, setShowSpeed] = useState(false);
  const [showHeight, setShowHeight] = useState(false);
  const [showLineDistance, setShowLineDistance] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  // playbackOffset = ms offset from globalStart (0 = start, sessionDurationMs = end)
  const [playbackOffset, setPlaybackOffset] = useState(0);
  const [stepIncrement, setStepIncrement] = useState<15 | 30 | 60>(30);

  // Initialize selectedIds when pilots load
  useEffect(() => {
    if (gagglePilots.length > 0) {
      setSelectedIds(new Set(gagglePilots.map((p) => p.id)));
    }
  }, [gagglePilots.map((p) => p.id).join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  const playbackTime = globalStart !== null ? globalStart + playbackOffset : null;

  // ── rAF playback loop ─────────────────────────────────────────────────────
  // Speed: full session plays in ~90 real seconds
  const speedFactor = sessionDurationMs > 0 ? sessionDurationMs / 90_000 : 1;
  const animFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);
  const playbackOffsetRef = useRef(playbackOffset);
  playbackOffsetRef.current = playbackOffset;
  const speedFactorRef = useRef(speedFactor);
  speedFactorRef.current = speedFactor;

  const tick = useCallback(
    (ts: number) => {
      if (lastTimeRef.current === null) lastTimeRef.current = ts;
      const dt = ts - lastTimeRef.current;
      lastTimeRef.current = ts;
      const next = playbackOffsetRef.current + dt * speedFactorRef.current;
      if (next >= sessionDurationMs) {
        setPlaybackOffset(sessionDurationMs);
        setIsPlaying(false);
        return;
      }
      setPlaybackOffset(next);
      animFrameRef.current = requestAnimationFrame(tick);
    },
    [sessionDurationMs],
  );

  useEffect(() => {
    if (isPlaying) {
      lastTimeRef.current = null;
      animFrameRef.current = requestAnimationFrame(tick);
    } else if (animFrameRef.current !== null) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    return () => {
      if (animFrameRef.current !== null) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isPlaying, tick]);

  // ── Pilot toggle ──────────────────────────────────────────────────────────
  function togglePilot(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const visiblePilots = useMemo(
    () => gagglePilots.filter((p) => selectedIds.has(p.id)),
    [gagglePilots, selectedIds],
  );

  // ── Handle play/reset ─────────────────────────────────────────────────────
  function handlePlayPause() {
    if (!isPlaying && playbackOffset >= sessionDurationMs) {
      setPlaybackOffset(0);
    }
    setIsPlaying((p) => !p);
  }

  function handleReset() {
    setIsPlaying(false);
    setPlaybackOffset(0);
  }

  function handleStepBack() {
    setIsPlaying(false);
    setPlaybackOffset((prev) => Math.max(0, prev - stepIncrement * 1000));
  }

  function handleStepForward() {
    setIsPlaying(false);
    setPlaybackOffset((prev) => Math.min(sessionDurationMs, prev + stepIncrement * 1000));
  }

  // ── Leaderboard ───────────────────────────────────────────────────────────
  const leaderboard = useMemo<LeaderboardEntry[]>(() => {
    if (loadedFlights.length === 0) return [];

    const pilotMap = new Map(gagglePilots.map((p) => [p.id, p]));

    function best(
      category: string,
      icon: string,
      score: (f: Flight) => number | null,
      format: (v: number) => string,
    ): LeaderboardEntry | null {
      let winner: Flight | null = null;
      let winScore = -Infinity;
      for (const f of loadedFlights) {
        const s = score(f);
        if (s !== null && s > winScore) { winScore = s; winner = f; }
      }
      if (!winner) return null;
      const pilot = pilotMap.get(winner.id);
      if (!pilot) return null;
      return { category, icon, pilotId: pilot.id, pilotName: pilot.pilotName, color: pilot.color, value: format(winScore) };
    }

    const entries: LeaderboardEntry[] = [];
    const add = (e: LeaderboardEntry | null) => { if (e) entries.push(e); };

    add(best('Highest', '⬆', (f) => f.max_altitude_m,
      (v) => `${Math.round(v * 3.28084).toLocaleString()} ft`));

    add(best('Longest', '📏', (f) => f.total_distance_m,
      (v) => `${(v / 1000).toFixed(1)} km`));

    add(best('Fastest', '⚡', (f) => f.max_speed_mps,
      (v) => `${(v * 3.6).toFixed(1)} km/h`));

    add(best('Most Turns', '🔄', (f) => {
      const tps = f.trackpoints_json;
      return tps ? countPhaseSegments(tps, 'turn') : null;
    }, (v) => `${Math.round(v)} turns`));

    add(best('Longest Cruise', '➡', (f) => {
      const tps = f.trackpoints_json;
      return tps ? longestStableCruiseSecs(tps) : null;
    }, (v) => {
      const m = Math.floor(v / 60);
      const s = Math.round(v % 60);
      return m > 0 ? `${m}m ${s}s` : `${s}s`;
    }));

    add(best('Tightest Turn', '🌀', (f) => {
      const tps = f.trackpoints_json;
      if (!tps) return null;
      const r = tightestTurnRadius(tps);
      // Invert so smaller radius = higher score
      return r !== null && r > 0 ? 1 / r : null;
    }, (_invR) => {
      // Re-compute radius for the winner to display it
      const winner = loadedFlights.find((f) => {
        const tps = f.trackpoints_json;
        if (!tps) return false;
        const r = tightestTurnRadius(tps);
        return r !== null && r > 0 && 1 / r === _invR;
      });
      if (!winner?.trackpoints_json) return '—';
      const r = tightestTurnRadius(winner.trackpoints_json);
      return r !== null ? `${Math.round(r)} m` : '—';
    }));

    add(best('Most Gs', '💪', (f) => {
      const tps = f.trackpoints_json;
      return tps ? maxGForce(tps) : null;
    }, (v) => `${v.toFixed(2)} G`));

    return entries;
  }, [loadedFlights, gagglePilots]);

  // ── VS formatting ─────────────────────────────────────────────────────────
  function formatVS(mps: number | null): string {
    if (mps === null) return '—';
    const sign = mps >= 0 ? '+' : '';
    return `${sign}${mps.toFixed(1)} m/s`;
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 flex flex-col" style={{ background: '#0f172a' }}>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="h-12 shrink-0 flex items-center gap-3 px-3 bg-slate-900 border-b border-slate-700 z-20">
        <button
          onClick={() => navigate(-1)}
          className="p-1.5 rounded-lg hover:bg-slate-700 transition-colors text-slate-400 hover:text-white text-sm"
          aria-label="Back"
        >
          ←
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="font-semibold text-white text-sm truncate leading-tight">
            Gaggle
            {date && (
              <span className="ml-2 text-slate-400 font-normal">{formatDate(date)}</span>
            )}
          </h1>
        </div>
        <div className="text-xs text-slate-400">
          {gagglePilots.length} {gagglePilots.length === 1 ? 'pilot' : 'pilots'}
        </div>
      </header>

      {/* ── Main content ───────────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0">
        {/* Map */}
        <div className="flex-1 min-w-0 relative">
          {isLoading ? (
            <div className="flex items-center justify-center h-full text-sky-dusk text-sm">
              Loading flights…
            </div>
          ) : (
            <Suspense
              fallback={
                <div className="flex items-center justify-center h-full text-sky-dusk text-sm">
                  Loading map…
                </div>
              }
            >
              <GaggleViewer
                pilots={visiblePilots}
                playbackTime={playbackOffset === 0 && !isPlaying ? null : playbackTime}
                wallOpacity={wallOpacity}
                trailPercent={trailPercent}
                bbox={combinedBbox}
                showDistances={showDistances}
                showSpeed={showSpeed}
                showHeight={showHeight}
                showLineDistance={showLineDistance}
                isPlaying={isPlaying}
                className="w-full h-full"
              />
            </Suspense>
          )}

          {/* ── Playback bar (overlaid on map) ─────────────────────────────── */}
          <div className="absolute bottom-2 left-2 right-2 z-10">
            <div className="bg-white/90 backdrop-blur-sm rounded-lg shadow px-3 pt-2 pb-1">
              {/* Controls row */}
              <div className="flex items-center gap-2 mb-1">
                {/* Reset */}
                <button
                  onClick={handleReset}
                  className="w-7 h-7 rounded-full bg-sky-dusk/20 hover:bg-sky-dusk/40 text-sky-night text-xs flex items-center justify-center shrink-0 transition-colors"
                  aria-label="Reset to start"
                  title="Reset to start"
                >
                  ◀◀
                </button>
                {/* Play / Pause */}
                <button
                  onClick={handlePlayPause}
                  disabled={sessionDurationMs === 0}
                  className="w-7 h-7 rounded-full bg-sky-morning text-white text-xs flex items-center justify-center shrink-0 disabled:opacity-40 hover:bg-sky-dusk transition-colors"
                  aria-label={isPlaying ? 'Pause' : 'Play'}
                >
                  {isPlaying ? '⏸' : '▶'}
                </button>
                {/* Step back */}
                {sessionDurationMs > 0 && (
                  <button
                    onClick={handleStepBack}
                    className="w-7 h-7 rounded-full bg-sky-dusk/20 hover:bg-sky-dusk/40 text-sky-night text-xs flex items-center justify-center shrink-0 transition-colors"
                    aria-label={`Step back ${stepIncrement}s`}
                    title={`Step back ${stepIncrement}s`}
                  >
                    ◀
                  </button>
                )}
                {/* Increment selector */}
                {sessionDurationMs > 0 && (
                  <div className="flex items-center shrink-0 rounded overflow-hidden border border-sky-dusk/30 text-[10px] font-medium">
                    {([15, 30, 60] as const).map((s) => (
                      <button
                        key={s}
                        onClick={() => setStepIncrement(s)}
                        className={`px-1.5 py-0.5 leading-none transition-colors ${
                          stepIncrement === s
                            ? 'bg-sky-morning text-white'
                            : 'bg-transparent text-sky-dusk hover:bg-sky-dusk/10'
                        }`}
                        aria-pressed={stepIncrement === s}
                      >
                        {s}s
                      </button>
                    ))}
                  </div>
                )}
                {/* Scrubber */}
                <input
                  type="range"
                  min={0}
                  max={Math.max(1, sessionDurationMs)}
                  value={playbackOffset}
                  onChange={(e) => {
                    setIsPlaying(false);
                    setPlaybackOffset(Number(e.target.value));
                  }}
                  className="flex-1 cursor-pointer accent-sky-500"
                  style={{ height: '4px' }}
                />
                {/* Step forward */}
                {sessionDurationMs > 0 && (
                  <button
                    onClick={handleStepForward}
                    className="w-7 h-7 rounded-full bg-sky-dusk/20 hover:bg-sky-dusk/40 text-sky-night text-xs flex items-center justify-center shrink-0 transition-colors"
                    aria-label={`Step forward ${stepIncrement}s`}
                    title={`Step forward ${stepIncrement}s`}
                  >
                    ▶
                  </button>
                )}
                {/* Current wall-clock time */}
                <span className="text-xs text-sky-dusk tabular-nums shrink-0 w-20 text-right">
                  {playbackTime !== null && playbackOffset > 0 ? formatFlightTime(playbackTime, sessionTimezone) : '—'}
                </span>
              </div>

              {/* Quarter-time tick labels */}
              {globalStart !== null && sessionDurationMs > 0 && (
                <div className="relative flex justify-between text-[10px] text-sky-dusk/70 tabular-nums" style={{ paddingLeft: '168px', paddingRight: '116px' }}>
                  {[0, 0.25, 0.5, 0.75, 1].map((frac) => (
                    <span
                      key={frac}
                      className={frac === 0 ? 'text-left' : frac === 1 ? 'text-right' : 'text-center'}
                      style={frac > 0 && frac < 1 ? { position: 'absolute', left: `${frac * 100}%`, transform: 'translateX(-50%)' } : undefined}
                    >
                      {formatFlightTime(globalStart + frac * sessionDurationMs, sessionTimezone)}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Inspector panel */}
        <aside
          style={{ width: 320, flexShrink: 0, overflowY: 'auto', background: '#fff', borderLeft: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column' }}
        >

          {/* ── Comparison Lines toggle ──────────────────────────────────────── */}
          {visiblePilots.length >= 2 && (
            <div className="border-b border-slate-200 px-4 py-3">
              <p className="text-xs font-semibold text-sky-night mb-2 uppercase tracking-wide">Comparison Lines</p>
              <button
                onClick={() => setShowDistances((v) => !v)}
                className={`w-full py-1.5 px-3 text-xs font-medium rounded-lg border transition-colors ${
                  showDistances
                    ? 'bg-sky-600 border-sky-500 text-white'
                    : 'border-slate-300 text-sky-night hover:bg-slate-50'
                }`}
              >
                {showDistances ? 'Hide Comparison Lines' : 'Show Comparison Lines'}
              </button>
              <div className="mt-2 space-y-1.5">
                {([
                  { label: 'Speed',    checked: showSpeed,        set: setShowSpeed },
                  { label: 'Height',   checked: showHeight,       set: setShowHeight },
                  { label: 'Distance', checked: showLineDistance, set: setShowLineDistance },
                ] as { label: string; checked: boolean; set: (v: boolean) => void }[]).map(({ label, checked, set }) => (
                  <label key={label} className="flex items-center gap-2 text-xs text-sky-night cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => set(e.target.checked)}
                      className="accent-sky-500"
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* ── Sliders ─────────────────────────────────────────────────────── */}
          <div className="border-b border-slate-200 px-4 py-3 space-y-3">
            <div>
              <div className="flex justify-between text-xs text-sky-dusk mb-1.5">
                <span>Wall Transparency</span>
                <span className="tabular-nums">{Math.round(wallOpacity * 100)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(wallOpacity * 100)}
                onChange={(e) => setWallOpacity(Number(e.target.value) / 100)}
                className="w-full cursor-pointer accent-sky-500"
              />
            </div>
            <div>
              <div className="flex justify-between text-xs text-sky-dusk mb-1.5">
                <span>Trail Length</span>
                <span className="tabular-nums">{trailPercent}%</span>
              </div>
              <input
                type="range"
                min={1}
                max={100}
                value={trailPercent}
                onChange={(e) => setTrailPercent(Number(e.target.value))}
                className="w-full cursor-pointer accent-sky-500"
              />
            </div>
          </div>

          {/* ── Pilots list ─────────────────────────────────────────────────── */}
          <div className="flex-1 border-b border-slate-200 px-4 py-3">
            <p className="text-xs font-semibold text-sky-night mb-2 uppercase tracking-wide">Pilots</p>

            {gagglePilots.length === 0 && !isLoading && (
              <p className="text-xs text-sky-dusk">No analyzed flights for this date.</p>
            )}

            <div className="space-y-2">
            {gagglePilots.map((pilot) => {
              const isSelected = selectedIds.has(pilot.id);
              const [r, g, b] = pilot.color;
              const metrics =
                playbackTime !== null && playbackOffset > 0
                  ? metricsAt(pilot, playbackTime)
                  : null;

              return (
                <div
                  key={pilot.id}
                  className={`rounded-lg border p-2.5 transition-colors cursor-pointer ${
                    isSelected
                      ? 'border-slate-200 bg-slate-50'
                      : 'border-slate-100 bg-white opacity-50'
                  }`}
                  onClick={() => togglePilot(pilot.id)}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-sm shrink-0"
                      style={{ background: `rgb(${r},${g},${b})` }}
                    />
                    <span className="flex-1 text-sm font-medium text-sky-night truncate">{pilot.pilotName}</span>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => togglePilot(pilot.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="w-3.5 h-3.5 accent-sky-500 shrink-0"
                    />
                  </div>

                  {/* Live metrics — only during playback */}
                  {isSelected && (
                    <div className="mt-1.5 grid grid-cols-3 gap-x-1 text-xs">
                      <div>
                        <span className="text-sky-dusk">Alt</span>
                        <div className="font-mono tabular-nums text-sky-night">
                          {metrics?.altitude_ft != null ? `${metrics.altitude_ft.toLocaleString()} ft` : '—'}
                        </div>
                      </div>
                      <div>
                        <span className="text-sky-dusk">Speed</span>
                        <div className="font-mono tabular-nums text-sky-night">
                          {metrics?.speed_kmh != null ? `${metrics.speed_kmh} km/h` : '—'}
                        </div>
                      </div>
                      <div>
                        <span className="text-sky-dusk">VS</span>
                        <div
                          className={`font-mono tabular-nums ${
                            metrics?.vspeed_mps != null
                              ? metrics.vspeed_mps >= 0
                                ? 'text-green-600'
                                : 'text-red-500'
                              : 'text-sky-night'
                          }`}
                        >
                          {metrics?.vspeed_mps != null ? formatVS(metrics.vspeed_mps) : '—'}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            </div>
          </div>

          {/* ── Leaderboard ─────────────────────────────────────────────────── */}
          {leaderboard.length > 0 && (
            <div className="px-4 py-3">
              <p className="text-xs font-semibold text-sky-night mb-2 uppercase tracking-wide">Leaderboard</p>
              <div className="space-y-0.5">
                {leaderboard.map((entry) => {
                  const [r, g, b] = entry.color;
                  return (
                    <div key={entry.category} className="flex items-center gap-2 py-1.5 border-b border-slate-100 last:border-0">
                      <span className="text-sm w-5 shrink-0 text-center leading-none">{entry.icon}</span>
                      <span className="text-xs text-sky-dusk w-24 shrink-0">{entry.category}</span>
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ background: `rgb(${r},${g},${b})` }}
                      />
                      <span className="flex-1 text-xs font-medium text-sky-night truncate">{entry.pilotName}</span>
                      <span className="text-xs font-mono tabular-nums font-semibold text-sky-night shrink-0">{entry.value}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
