import { useState, useMemo, Fragment } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { MapContainer, TileLayer, Polyline, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { useFlightCompare } from '../hooks/useFlights';
import type { NormalizedComparisonPoint, ComparisonEntry } from '../services/flights.service';
import 'leaflet/dist/leaflet.css';

// Palette for up to 6 flights
const COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];

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

function formatAlt(metres: number | null): string {
  if (metres === null) return '—';
  return `${Math.round(metres * 3.28084)} ft`;
}

function formatSpeed(mps: number | null): string {
  if (mps === null) return '—';
  return `${(mps * 3.6).toFixed(1)} km/h`;
}

function formatClimb(mps: number | null): string {
  if (mps === null) return '—';
  return `${mps.toFixed(1)} m/s`;
}

function label(entry: ComparisonEntry): string {
  return entry.pilot?.display_name ?? entry.title ?? entry.flight_id.slice(0, 8);
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

/** Returns the trackpoint in `entry` nearest to time `t` (seconds since takeoff). */
function getPositionAtT(entry: ComparisonEntry, t: number): NormalizedComparisonPoint | null {
  const pts = entry.trackpoints.filter((tp) => tp.t !== null && tp.lat && tp.lon);
  if (pts.length === 0) return null;
  let best = pts[0];
  let bestDist = Math.abs((best.t ?? 0) - t);
  for (let i = 1; i < pts.length; i++) {
    const d = Math.abs((pts[i].t ?? 0) - t);
    if (d < bestDist) { bestDist = d; best = pts[i]; }
  }
  return best;
}

/** Fit map to bounds of all trackpoints */
function FitAllBounds({ entries }: { entries: ComparisonEntry[] }) {
  const map = useMap();
  useMemo(() => {
    const allPoints = entries.flatMap((e) =>
      e.trackpoints.filter((tp) => tp.lat && tp.lon).map((tp) => [tp.lat, tp.lon] as [number, number]),
    );
    if (allPoints.length > 0) {
      try {
        map.fitBounds(allPoints, { padding: [20, 20] });
      } catch {}
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries.map((e) => e.flight_id).join(',')]);
  return null;
}

/** Build chart-ready time-series data aligned to seconds-since-takeoff */
function buildChartData(
  entries: ComparisonEntry[],
): { t: number; [key: string]: number | null | undefined }[] {
  // Collect all unique t values across all flights
  const tSet = new Set<number>();
  for (const entry of entries) {
    for (const tp of entry.trackpoints) {
      if (tp.t !== null) tSet.add(tp.t);
    }
  }
  if (tSet.size === 0) return [];

  const tArr = [...tSet].sort((a, b) => a - b);

  return tArr.map((t) => {
    const row: { t: number; [key: string]: number | null | undefined } = { t };
    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      // Nearest point at or before t
      const pts = e.trackpoints.filter((tp) => tp.t !== null && tp.t <= t);
      const pt: NormalizedComparisonPoint | undefined = pts[pts.length - 1];
      row[`alt_${i}`] = pt?.elevation_m != null ? pt.elevation_m * 3.28084 : null; // to ft
      row[`spd_${i}`] = pt?.speed_mps != null ? pt.speed_mps * 3.6 : null; // to km/h
      row[`vspd_${i}`] = pt?.vertical_speed_mps ?? null;
    }
    return row;
  });
}

export default function FlightComparison() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const flightIds = useMemo(
    () =>
      (searchParams.get('ids') ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    [searchParams],
  );

  const { data, isLoading, error } = useFlightCompare(flightIds);
  const entries = data?.flights ?? [];

  const [activeTab, setActiveTab] = useState<'map' | 'altitude' | 'speed' | 'vspeed'>('map');
  const [showDistances, setShowDistances] = useState(false);

  // Max shared t value across all flights (for the scrubber)
  const maxT = useMemo(() => {
    let m = 0;
    for (const e of entries) {
      for (const tp of e.trackpoints) {
        if (tp.t != null && tp.t > m) m = tp.t;
      }
    }
    return m;
  }, [entries]);

  const [distanceT, setDistanceT] = useState(0);

  // Pilot positions at current distanceT
  const pilotPositionsAtT = useMemo(() => {
    if (!showDistances) return [];
    return entries.map((entry, i) => ({
      pt: getPositionAtT(entry, distanceT),
      label: label(entry),
      color: COLORS[i],
    }));
  }, [showDistances, entries, distanceT]);

  // All pairwise distance lines
  const distanceLines = useMemo(() => {
    const lines: { fromLat: number; fromLon: number; toLat: number; toLon: number; distance_m: number; fromLabel: string; toLabel: string; fromColor: string; toColor: string }[] = [];
    for (let i = 0; i < pilotPositionsAtT.length; i++) {
      for (let j = i + 1; j < pilotPositionsAtT.length; j++) {
        const a = pilotPositionsAtT[i];
        const b = pilotPositionsAtT[j];
        if (!a.pt || !b.pt) continue;
        lines.push({
          fromLat: a.pt.lat, fromLon: a.pt.lon,
          toLat: b.pt.lat, toLon: b.pt.lon,
          distance_m: haversineMeters(a.pt.lat, a.pt.lon, b.pt.lat, b.pt.lon),
          fromLabel: a.label, toLabel: b.label,
          fromColor: a.color, toColor: b.color,
        });
      }
    }
    return lines;
  }, [pilotPositionsAtT]);

  const chartData = useMemo(() => buildChartData(entries), [entries]);

  const formatTime = (t: number) => {
    const m = Math.floor(t / 60);
    const s = t % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  if (flightIds.length < 2) {
    return (
      <div className="min-h-screen bg-sky-cloud flex items-center justify-center">
        <div className="bg-white rounded-xl p-8 text-center shadow-elevation border border-sky-midday/30">
          <p className="text-sky-night font-semibold">Need at least 2 flights to compare.</p>
          <p className="text-sky-dusk text-sm mt-2">Use the URL: <code>/flights/compare?ids=id1,id2</code></p>
          <button
            onClick={() => navigate(-1)}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-sky-cloud">
      {/* Header */}
      <header className="bg-white border-b border-sky-midday/20 shadow-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-1 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="Back"
          >
            <svg className="w-5 h-5 text-sky-night" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-lg font-bold text-sky-night">Flight Comparison</h1>
          {!isLoading && (
            <span className="text-xs text-sky-dusk ml-1">{entries.length} flights</span>
          )}
        </div>
      </header>

      {isLoading && (
        <div className="flex items-center justify-center py-24 text-sky-dusk animate-pulse">
          Loading comparison…
        </div>
      )}

      {error && (
        <div className="flex items-center justify-center py-24 text-red-500">
          Failed to load comparison data.
        </div>
      )}

      {!isLoading && !error && entries.length > 0 && (
        <div className="max-w-4xl mx-auto px-4 py-4 space-y-4">
          {/* Summary cards */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {entries.map((entry, i) => (
              <div
                key={entry.flight_id}
                className="bg-white rounded-xl shadow-elevation border-l-4 p-4"
                style={{ borderLeftColor: COLORS[i] }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-sky-night text-sm truncate">{label(entry)}</p>
                    <p className="text-xs text-sky-dusk mt-0.5">{entry.flight_date}</p>
                    {entry.glider && (
                      <p className="text-xs text-gray-400 mt-0.5">{entry.glider}</p>
                    )}
                  </div>
                  <button
                    onClick={() => navigate(`/flights/${entry.flight_id}`)}
                    className="shrink-0 text-xs text-blue-600 hover:underline"
                  >
                    View
                  </button>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-sky-dusk">
                  <span>Duration</span><span className="text-right font-medium text-sky-night">{formatDuration(entry.duration_seconds)}</span>
                  <span>Distance</span><span className="text-right font-medium text-sky-night">{formatDistance(entry.total_distance_m)}</span>
                  <span>Max Alt</span><span className="text-right font-medium text-sky-night">{formatAlt(entry.max_altitude_m)}</span>
                  <span>Max Speed</span><span className="text-right font-medium text-sky-night">{formatSpeed(entry.max_speed_mps)}</span>
                  <span>Max Climb</span><span className="text-right font-medium text-sky-night">{formatClimb(entry.max_climb_mps)}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Tab nav */}
          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            {([
              { id: 'map', label: 'Map' },
              { id: 'altitude', label: 'Altitude' },
              { id: 'speed', label: 'Speed' },
              { id: 'vspeed', label: 'Climb Rate' },
            ] as const).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-sky-night text-white'
                    : 'bg-white text-sky-dusk border border-sky-midday/30 hover:bg-sky-50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Map overlay */}
          {activeTab === 'map' && (
            <div className="bg-white rounded-xl shadow-elevation border border-sky-midday/30 overflow-hidden">
              {/* Distance line controls */}
              <div className="px-3 py-2.5 border-b border-sky-midday/20 flex items-center gap-3 flex-wrap">
                <button
                  onClick={() => setShowDistances((v) => !v)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors flex-shrink-0 ${
                    showDistances
                      ? 'bg-sky-night border-sky-night text-white'
                      : 'border-slate-300 text-sky-night hover:bg-slate-50'
                  }`}
                >
                  {showDistances ? 'Hide Distances' : 'Show Distance Lines'}
                </button>
                {showDistances && maxT > 0 && (
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="text-xs text-sky-dusk tabular-nums flex-shrink-0">
                      T+{formatTime(distanceT)}
                    </span>
                    <input
                      type="range"
                      min={0}
                      max={maxT}
                      step={1}
                      value={distanceT}
                      onChange={(e) => setDistanceT(Number(e.target.value))}
                      className="flex-1 cursor-pointer accent-sky-night"
                    />
                    <span className="text-xs text-sky-dusk tabular-nums flex-shrink-0">
                      T+{formatTime(maxT)}
                    </span>
                  </div>
                )}
              </div>

              <div style={{ height: 380 }}>
                <MapContainer
                  center={[0, 0]}
                  zoom={13}
                  style={{ height: '100%', width: '100%' }}
                  zoomControl
                >
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  />
                  <FitAllBounds entries={entries} />
                  {entries.map((entry, i) => {
                    const positions = entry.trackpoints
                      .filter((tp) => tp.lat && tp.lon)
                      .map((tp) => [tp.lat, tp.lon] as [number, number]);
                    return positions.length > 1 ? (
                      <Polyline
                        key={entry.flight_id}
                        positions={positions}
                        color={COLORS[i]}
                        weight={3}
                        opacity={0.8}
                      />
                    ) : null;
                  })}

                  {/* Distance lines between pilots */}
                  {showDistances && distanceLines.map((line, i) => {
                    const midLat = (line.fromLat + line.toLat) / 2;
                    const midLon = (line.fromLon + line.toLon) / 2;
                    const distLabel = line.distance_m >= 1000
                      ? `${(line.distance_m / 1000).toFixed(2)} km`
                      : `${Math.round(line.distance_m)} m`;
                    return (
                      <Fragment key={`dist-${i}`}>
                        <Polyline
                          positions={[[line.fromLat, line.fromLon], [line.toLat, line.toLon]]}
                          pathOptions={{ color: '#f59e0b', weight: 2, opacity: 0.9, dashArray: '6 5' }}
                        />
                        <Marker
                          position={[midLat, midLon]}
                          zIndexOffset={1500}
                          icon={L.divIcon({
                            className: '',
                            html: `<div style="background:white;border:1px solid #94a3b8;border-radius:4px;padding:2px 6px;font-size:11px;font-weight:600;color:#0f172a;white-space:nowrap;box-shadow:0 1px 3px rgba(0,0,0,0.25);transform:translate(-50%,-50%)">${distLabel}</div>`,
                            iconSize: [0, 0],
                            iconAnchor: [0, 0],
                          })}
                        />
                      </Fragment>
                    );
                  })}

                  {/* Current position dots for each pilot */}
                  {showDistances && pilotPositionsAtT.map((p, i) => {
                    if (!p.pt) return null;
                    return (
                      <Marker
                        key={`pos-${i}`}
                        position={[p.pt.lat, p.pt.lon]}
                        zIndexOffset={2000}
                        icon={L.divIcon({
                          className: '',
                          html: `<div style="background:${p.color};border:2px solid white;border-radius:50%;width:12px;height:12px;box-shadow:0 1px 4px rgba(0,0,0,0.4)"></div>`,
                          iconSize: [12, 12],
                          iconAnchor: [6, 6],
                        })}
                      />
                    );
                  })}
                </MapContainer>
              </div>

              {/* Distance table */}
              {showDistances && distanceLines.length > 0 && (
                <div className="px-3 py-2.5 border-t border-sky-midday/20 space-y-1.5">
                  <p className="text-[10px] font-semibold text-sky-dusk uppercase tracking-wide mb-1">
                    Distances at T+{formatTime(distanceT)}
                  </p>
                  {distanceLines.map((line, i) => (
                    <div key={i} className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: line.fromColor }} />
                        <span className="text-[11px] text-sky-dusk truncate">{line.fromLabel}</span>
                        <span className="text-[11px] text-slate-400 flex-shrink-0">↔</span>
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: line.toColor }} />
                        <span className="text-[11px] text-sky-dusk truncate">{line.toLabel}</span>
                      </div>
                      <span className="text-xs font-semibold text-sky-night flex-shrink-0 tabular-nums">
                        {line.distance_m >= 1000
                          ? `${(line.distance_m / 1000).toFixed(2)} km`
                          : `${Math.round(line.distance_m)} m`}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Altitude chart */}
          {activeTab === 'altitude' && (
            <div className="bg-white rounded-xl shadow-elevation border border-sky-midday/30 p-4">
              <h2 className="text-sm font-semibold text-sky-night mb-3">Altitude (ft) — time since takeoff</h2>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={chartData} margin={{ top: 4, right: 8, bottom: 4, left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="t" tickFormatter={formatTime} tick={{ fontSize: 10 }} label={{ value: 'min:sec', position: 'insideBottomRight', offset: -4, fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} unit=" ft" />
                  <Tooltip labelFormatter={(t) => `T+${formatTime(t as number)}`} formatter={(v, name) => [typeof v === 'number' ? `${Math.round(v)} ft` : '—', name as string]} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {entries.map((entry, i) => (
                    <Area
                      key={entry.flight_id}
                      type="monotone"
                      dataKey={`alt_${i}`}
                      name={label(entry)}
                      stroke={COLORS[i]}
                      fill={COLORS[i]}
                      fillOpacity={0.08}
                      strokeWidth={2}
                      dot={false}
                      connectNulls
                    />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Speed chart */}
          {activeTab === 'speed' && (
            <div className="bg-white rounded-xl shadow-elevation border border-sky-midday/30 p-4">
              <h2 className="text-sm font-semibold text-sky-night mb-3">Ground Speed (km/h) — time since takeoff</h2>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 4, left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="t" tickFormatter={formatTime} tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} unit=" km/h" />
                  <Tooltip labelFormatter={(t) => `T+${formatTime(t as number)}`} formatter={(v, name) => [typeof v === 'number' ? `${v.toFixed(1)} km/h` : '—', name as string]} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {entries.map((entry, i) => (
                    <Line
                      key={entry.flight_id}
                      type="monotone"
                      dataKey={`spd_${i}`}
                      name={label(entry)}
                      stroke={COLORS[i]}
                      strokeWidth={2}
                      dot={false}
                      connectNulls
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Vertical speed chart */}
          {activeTab === 'vspeed' && (
            <div className="bg-white rounded-xl shadow-elevation border border-sky-midday/30 p-4">
              <h2 className="text-sm font-semibold text-sky-night mb-3">Vertical Speed (m/s) — time since takeoff</h2>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={chartData} margin={{ top: 4, right: 8, bottom: 4, left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="t" tickFormatter={formatTime} tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} unit=" m/s" />
                  <Tooltip labelFormatter={(t) => `T+${formatTime(t as number)}`} formatter={(v, name) => [typeof v === 'number' ? `${v.toFixed(2)} m/s` : '—', name as string]} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {entries.map((entry, i) => (
                    <Area
                      key={entry.flight_id}
                      type="monotone"
                      dataKey={`vspd_${i}`}
                      name={label(entry)}
                      stroke={COLORS[i]}
                      fill={COLORS[i]}
                      fillOpacity={0.1}
                      strokeWidth={2}
                      dot={false}
                      connectNulls
                    />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
