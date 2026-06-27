import { MissionWaypoint } from '../../services/missions.service';
import WaypointAirspaceBar from './WaypointAirspaceBar';
import {
  calculateDistance,
  formatDistance,
  calculateTime,
  formatTime,
  calculateBearing,
  windAdjustedSpeed,
} from '../../utils/distanceUtils';

interface WaypointSidebarProps {
  waypoints: MissionWaypoint[];
  selectedWaypointId: string | null;
  distanceUnit: 'km' | 'mi';
  averageSpeed: number;
  showSegTime: boolean;
  showSegDist: boolean;
  showFuel: boolean;
  onToggleTime: () => void;
  onToggleDist: () => void;
  onToggleFuel: () => void;
  avgFuelConsumption: number;
  fuelTankSize: number | null;
  fuelReservePercent?: number;
  windDirection: number | null;
  windSpeed: number;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
  canEdit?: boolean;
  missionName?: string;
}

export function exportGpx(waypoints: MissionWaypoint[], missionName: string) {
  const escaped = missionName.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const trkpts = waypoints.map((wp, i) =>
    `      <trkpt lat="${Number(wp.latitude).toFixed(7)}" lon="${Number(wp.longitude).toFixed(7)}"><name>WP ${i + 1}</name></trkpt>`
  ).join('\n');
  const gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="FlightOps" xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <name>${escaped}</name>
    <trkseg>
${trkpts}
    </trkseg>
  </trk>
</gpx>`;
  const blob = new Blob([gpx], { type: 'application/gpx+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${missionName.replace(/[^a-z0-9_\-. ]/gi, '_')}.gpx`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function WaypointSidebar({
  waypoints,
  selectedWaypointId,
  distanceUnit,
  averageSpeed,
  showSegTime,
  showSegDist,
  showFuel,
  onToggleTime,
  onToggleDist,
  onToggleFuel,
  avgFuelConsumption,
  fuelTankSize,
  fuelReservePercent = 0,
  windDirection,
  windSpeed,
  onSelect,
  onDelete,
  onMoveUp,
  onMoveDown,
  canEdit = true,
  missionName = 'mission',
}: WaypointSidebarProps) {
  if (waypoints.length === 0) {
    return (
      <div className="p-4 text-center text-[#6b7fa3] text-sm">
        <p>No waypoints yet.</p>
        {canEdit && <p className="mt-1">Click on the map to add one.</p>}
      </div>
    );
  }

  const fuelConfigured = avgFuelConsumption > 0;
  const usableFuel = fuelTankSize !== null
    ? fuelTankSize * (1 - fuelReservePercent / 100)
    : null;

  let cumulativeDistKm = 0;
  let cumulativeTimeH = 0;
  let cumulativeFuelL = 0;

  const rows = waypoints.map((wp, i) => {
    let segDistKm = 0;
    let segTimeH = 0;
    let segFuelL = 0;

    if (i > 0) {
      const prev = waypoints[i - 1];
      segDistKm = calculateDistance(
        Number(prev.latitude),
        Number(prev.longitude),
        Number(wp.latitude),
        Number(wp.longitude),
      );

      const bearing = calculateBearing(
        Number(prev.latitude),
        Number(prev.longitude),
        Number(wp.latitude),
        Number(wp.longitude),
      );

      const gndSpeed =
        windSpeed > 0 && windDirection !== null
          ? windAdjustedSpeed(averageSpeed, windSpeed, windDirection, bearing)
          : averageSpeed;

      segTimeH = calculateTime(segDistKm, gndSpeed);
      segFuelL = fuelConfigured ? segTimeH * avgFuelConsumption : 0;

      cumulativeDistKm += segDistKm;
      cumulativeTimeH += segTimeH;
      cumulativeFuelL += segFuelL;
    }

    const segExceeds = usableFuel !== null && cumulativeFuelL > usableFuel;
    return { wp, segDistKm, segTimeH, segFuelL, cumulativeDistKm, cumulativeTimeH, cumulativeFuelL, segExceeds };
  });

  const totalDistKm = cumulativeDistKm;
  const totalTimeH = cumulativeTimeH;
  const totalFuelL = cumulativeFuelL;
  const fuelOverLimit = usableFuel !== null && totalFuelL > usableFuel;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Map label toggles */}
      <div className="px-3 py-2 border-b border-[#1e2a3a] shrink-0">
        <p className="text-xs text-[#6b7fa3] mb-1.5">Show on map</p>
        <div className="flex gap-1.5">
          <button
            onClick={onToggleDist}
            className={`flex-1 py-1 text-xs font-medium rounded border transition-colors ${
              showSegDist
                ? 'bg-orange-500 border-orange-500 text-white'
                : 'bg-[#1e2a3a] border-[#2a3a54] text-[#a0b3cc] hover:bg-[#243048]'
            }`}
          >
            Distance
          </button>
          <button
            onClick={onToggleTime}
            className={`flex-1 py-1 text-xs font-medium rounded border transition-colors ${
              showSegTime
                ? 'bg-orange-500 border-orange-500 text-white'
                : 'bg-[#1e2a3a] border-[#2a3a54] text-[#a0b3cc] hover:bg-[#243048]'
            }`}
          >
            Time
          </button>
          <button
            onClick={onToggleFuel}
            className={`flex-1 py-1 text-xs font-medium rounded border transition-colors ${
              showFuel
                ? 'bg-orange-500 border-orange-500 text-white'
                : 'bg-[#1e2a3a] border-[#2a3a54] text-[#a0b3cc] hover:bg-[#243048]'
            }`}
          >
            Fuel
          </button>
        </div>
      </div>

      {/* Totals */}
      <div className="px-3 py-3 border-b border-[#1e2a3a] shrink-0" style={{ background: '#1e2a3a' }}>
        <p className="text-xs font-semibold text-[#6b7fa3] uppercase tracking-wide mb-2">
          Total · {waypoints.length} waypoints
        </p>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#6b7fa3] flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              Distance
            </span>
            <span className="text-xs font-semibold text-white">
              {formatDistance(totalDistKm, distanceUnit)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#6b7fa3] flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Time
            </span>
            <span className="text-xs font-semibold text-white">
              {formatTime(totalTimeH)}
            </span>
          </div>
          {fuelConfigured && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#6b7fa3] flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M3 6h18M3 12h18M3 18h12" />
                </svg>
                Fuel
              </span>
              <span className={`text-xs font-semibold ${fuelOverLimit ? 'text-red-400' : 'text-white'}`}>
                {totalFuelL.toFixed(1)} L
                {usableFuel !== null && (
                  <span className="font-normal text-[#6b7fa3]"> / {usableFuel.toFixed(1)} L usable</span>
                )}
                {fuelOverLimit && (
                  <span className="ml-1.5 text-xs font-bold text-red-400">⚠ EXCEEDS TANK</span>
                )}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Waypoint rows */}
      <div className="overflow-y-auto flex-1">
        {rows.map(({ wp, segDistKm, segTimeH, segFuelL, cumulativeDistKm, cumulativeTimeH, cumulativeFuelL, segExceeds }, i) => (
          <div
            key={wp.id}
            onClick={() => onSelect(wp.id)}
            className={`px-3 py-2.5 border-b border-[#1e2a3a] cursor-pointer transition-colors group ${
              selectedWaypointId === wp.id
                ? 'bg-blue-900/30 border-l-2 border-l-blue-500'
                : 'hover:bg-[#1a2234]'
            }`}
          >
            <div className="flex items-start gap-1">
              <div className="flex items-start gap-2 min-w-0 flex-1">
                <span className="shrink-0 w-6 h-6 rounded-full bg-orange-500 text-white text-xs font-bold flex items-center justify-center mt-0.5">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-mono text-[#a0b3cc] truncate">
                    {Number(wp.latitude).toFixed(5)}, {Number(wp.longitude).toFixed(5)}
                  </p>
                  {i > 0 && (
                    <div className="mt-1.5 grid grid-cols-3 gap-y-1 items-center">
                      {/* Dist row */}
                      <span className="text-xs text-[#6b7fa3]">Dist</span>
                      <span className="text-xs font-medium text-[#a0b3cc] text-center">
                        +{formatDistance(segDistKm, distanceUnit)}
                      </span>
                      <span className="text-xs text-[#a0b3cc] text-center">
                        {formatDistance(cumulativeDistKm, distanceUnit)}
                      </span>

                      {/* Time row */}
                      <span className="text-xs text-[#6b7fa3]">Time</span>
                      <span className="text-xs font-medium text-[#a0b3cc] text-center">
                        +{formatTime(segTimeH)}
                      </span>
                      <span className="text-xs text-[#a0b3cc] text-center">
                        {formatTime(cumulativeTimeH)}
                      </span>

                      {/* Fuel row */}
                      {fuelConfigured && (
                        <>
                          <span className={`text-xs flex items-center gap-1 ${segExceeds ? 'text-red-400' : 'text-[#6b7fa3]'}`}>
                            {segExceeds && (
                              <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                  d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                              </svg>
                            )}
                            Fuel
                          </span>
                          <span className={`text-xs font-medium text-center ${segExceeds ? 'text-red-400' : 'text-orange-400'}`}>
                            +{segFuelL.toFixed(1)} L
                          </span>
                          <span className={`text-xs text-center ${segExceeds ? 'text-red-400' : 'text-orange-400'}`}>
                            {cumulativeFuelL.toFixed(1)} L
                          </span>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Right column: actions (hover) + airspace bar */}
              <div className="flex items-start gap-0.5 shrink-0">
                {canEdit && (
                  <div className="hidden group-hover:flex items-center gap-0.5 mt-0.5">
                    <button
                      onClick={(e) => { e.stopPropagation(); onMoveUp(wp.id); }}
                      disabled={i === 0}
                      className="p-1 rounded text-[#6b7fa3] hover:text-white hover:bg-[#243048] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      title="Move up"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                      </svg>
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); onMoveDown(wp.id); }}
                      disabled={i === waypoints.length - 1}
                      className="p-1 rounded text-[#6b7fa3] hover:text-white hover:bg-[#243048] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      title="Move down"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); onDelete(wp.id); }}
                      className="p-1 rounded text-[#6b7fa3] hover:text-red-400 hover:bg-red-900/20 transition-colors"
                      title="Delete waypoint"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                )}
                <WaypointAirspaceBar lat={wp.latitude} lon={wp.longitude} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Export footer */}
      <div className="px-3 py-2.5 border-t border-[#1e2a3a] shrink-0">
        <button
          onClick={() => exportGpx(waypoints, missionName)}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium text-[#a0b3cc] border border-[#2a3a54] bg-[#1e2a3a] rounded-lg hover:bg-[#243048] hover:text-white transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Export GPX
        </button>
      </div>
    </div>
  );
}
