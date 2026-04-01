import { useEffect, useRef, Fragment } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import type { FlightViewerProps, PilotDistanceLine } from './flight-viewer.types';
import type { Trackpoint } from '../../services/flights.service';

// ─── Phase colours ──────────────────────────────────────────────────────────
const PHASE_COLORS: Record<string, string> = {
  pre_takeoff:  '#94a3b8',
  takeoff:      '#84cc16',
  climb:        '#22c55e',
  cruise:       '#3b82f6',
  turn:         '#a855f7',
  descent:      '#f97316',
  approach:     '#f59e0b',
  landing:      '#ef4444',
  post_landing: '#94a3b8',
  unknown:      '#64748b',
};

// ─── Event icons ────────────────────────────────────────────────────────────
const EVENT_ICONS: Record<string, string> = {
  takeoff:         '🛫',
  landing:         '🛬',
  max_altitude:    '⬆',
  max_climb_rate:  '↑',
  max_descent_rate:'↓',
  max_groundspeed: '⚡',
  longest_level:   '➡',
  largest_turn:    '↩',
  abrupt_change:   '⚠',
};

function makeEventIcon(eventType: string): L.DivIcon {
  const emoji = EVENT_ICONS[eventType] ?? '●';
  return L.divIcon({
    className: '',
    html: `<div style="
      background:white;border:1.5px solid #475569;border-radius:50%;
      width:22px;height:22px;display:flex;align-items:center;justify-content:center;
      font-size:11px;box-shadow:0 1px 3px rgba(0,0,0,0.3);
    ">${emoji}</div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}

function makeEndpointIcon(color: string): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<div style="
      background:${color};border:2px solid white;border-radius:50%;
      width:14px;height:14px;box-shadow:0 1px 4px rgba(0,0,0,0.4);
    "></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

function makeHoverIcon(): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<div style="
      background:white;border:2.5px solid #0ea5e9;border-radius:50%;
      width:12px;height:12px;box-shadow:0 0 0 3px rgba(14,165,233,0.25);
    "></div>`,
    iconSize: [12, 12],
    iconAnchor: [6, 6],
  });
}

// ─── Auto-fit bounds child component ────────────────────────────────────────
interface BoundsProps {
  bbox: { minLon: number; minLat: number; maxLon: number; maxLat: number };
}
function FitBounds({ bbox }: BoundsProps) {
  const map = useMap();
  const fitted = useRef(false);
  useEffect(() => {
    if (fitted.current) return;
    fitted.current = true;
    map.fitBounds(
      [[bbox.minLat, bbox.minLon], [bbox.maxLat, bbox.maxLon]],
      { padding: [24, 24], maxZoom: 15 },
    );
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

// ─── Phase legend ────────────────────────────────────────────────────────────
const PHASE_LABELS: Record<string, string> = {
  pre_takeoff: 'Pre-takeoff', takeoff: 'Takeoff', climb: 'Climb',
  cruise: 'Cruise', turn: 'Turn', descent: 'Descent',
  approach: 'Approach', landing: 'Landing', post_landing: 'Post-landing',
};

// ─── Segment builder ─────────────────────────────────────────────────────────
interface Segment {
  phase: string;
  positions: [number, number][];
  startIndex: number;
}

function buildSegments(trackpoints: Trackpoint[]): Segment[] {
  if (trackpoints.length === 0) return [];
  const segments: Segment[] = [];
  let currentPhase = trackpoints[0].phase;
  let currentPositions: [number, number][] = [[trackpoints[0].lat, trackpoints[0].lon]];
  let startIndex = 0;

  for (let i = 1; i < trackpoints.length; i++) {
    const tp = trackpoints[i];
    if (tp.phase !== currentPhase) {
      segments.push({ phase: currentPhase, positions: currentPositions, startIndex });
      currentPhase = tp.phase;
      // Overlap the last position so polylines connect seamlessly
      currentPositions = [currentPositions[currentPositions.length - 1], [tp.lat, tp.lon]];
      startIndex = i;
    } else {
      currentPositions.push([tp.lat, tp.lon]);
    }
  }
  segments.push({ phase: currentPhase, positions: currentPositions, startIndex });
  return segments;
}

// ─── Main component ──────────────────────────────────────────────────────────
/** FlightMap2DProps is the shared FlightViewerProps (kept as alias for clarity) */
export type FlightMap2DProps = FlightViewerProps;

// Phases present in this flight (for legend)
function getPhasesPresent(trackpoints: Trackpoint[]): string[] {
  const seen = new Set<string>();
  for (const tp of trackpoints) seen.add(tp.phase);
  // Return in canonical order
  const order = ['pre_takeoff', 'takeoff', 'climb', 'cruise', 'turn', 'descent', 'approach', 'landing', 'post_landing', 'unknown'];
  return order.filter((p) => seen.has(p));
}

function rgbToHex([r, g, b]: [number, number, number]): string {
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
}

export default function FlightMap2D({
  trackpoints,
  bbox,
  events = [],
  flights = [],
  activePointIndex,
  pinnedPointIndex,
  trailPercent = 100,
  distanceLines = [],
  className = '',
}: FlightMap2DProps) {
  if (trackpoints.length === 0) {
    return (
      <div className={`flex items-center justify-center bg-sky-cloud rounded-lg h-64 text-sm text-sky-dusk ${className}`}>
        No track data available
      </div>
    );
  }

  // Trim trail: extend back from pinned position (or end of flight if nothing pinned)
  const currentIdx = pinnedPointIndex ?? trackpoints.length - 1;
  const rawLandingIdx = trackpoints.findIndex(
    (tp) => tp.phase === 'approach' || tp.phase === 'landing' || tp.phase === 'post_landing',
  );
  const landingIdx = rawLandingIdx >= 0 ? rawLandingIdx : Math.floor(trackpoints.length * 0.9);
  const hasLanded = currentIdx >= landingIdx;
  const trailEnd = hasLanded ? trackpoints.length : currentIdx + 1;
  const trailStart = trailPercent >= 100
    ? 0
    : Math.max(0, currentIdx - Math.round(trackpoints.length * trailPercent / 100));
  const visibleTrackpoints = trailPercent >= 100 && pinnedPointIndex == null
    ? trackpoints
    : trackpoints.slice(trailStart, trailEnd);

  const segments = buildSegments(visibleTrackpoints);
  const firstPoint = trackpoints[0];
  const lastPoint = trackpoints[trackpoints.length - 1];
  const phasesPresent = getPhasesPresent(trackpoints);

  // Events with valid coordinates
  const mappableEvents = events.filter((e) => e.lat !== null && e.lon !== null);

  // Active hover point
  const hoverPoint = activePointIndex != null ? trackpoints[activePointIndex] : null;

  const defaultCenter: [number, number] = bbox
    ? [(bbox.minLat + bbox.maxLat) / 2, (bbox.minLon + bbox.maxLon) / 2]
    : [firstPoint.lat, firstPoint.lon];

  return (
    <div className={`relative ${className}`}>
      <MapContainer
        center={defaultCenter}
        zoom={12}
        style={{ height: '100%', width: '100%', borderRadius: '0.5rem' }}
        zoomControl={true}
        attributionControl={false}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />

        {/* Auto-fit to bbox */}
        {bbox && <FitBounds bbox={bbox} />}

        {/* Overlay flights (other pilots) */}
        {flights.map((of) => (
          <Polyline
            key={of.id}
            positions={of.trackpoints.map((tp) => [tp.lat, tp.lon] as [number, number])}
            pathOptions={{
              color: of.color ? rgbToHex(of.color) : '#94a3b8',
              weight: 2,
              opacity: 0.8,
            }}
          />
        ))}

        {/* Flight path coloured by phase */}
        {segments.map((seg, i) => (
          <Polyline
            key={i}
            positions={seg.positions}
            pathOptions={{
              color: PHASE_COLORS[seg.phase] ?? PHASE_COLORS.unknown,
              weight: 3,
              opacity: 0.85,
            }}
          />
        ))}

        {/* Start marker (green) */}
        <Marker
          position={[firstPoint.lat, firstPoint.lon]}
          icon={makeEndpointIcon('#22c55e')}
          zIndexOffset={1000}
        />

        {/* End marker (red) */}
        <Marker
          position={[lastPoint.lat, lastPoint.lon]}
          icon={makeEndpointIcon('#ef4444')}
          zIndexOffset={1000}
        />

        {/* Event markers */}
        {mappableEvents.map((evt) => (
          <Marker
            key={evt.id}
            position={[evt.lat!, evt.lon!]}
            icon={makeEventIcon(evt.event_type)}
            zIndexOffset={900}
          />
        ))}

        {/* Hover highlight */}
        {hoverPoint && (
          <Marker
            position={[hoverPoint.lat, hoverPoint.lon]}
            icon={makeHoverIcon()}
            zIndexOffset={2000}
          />
        )}

        {/* Pilot distance lines */}
        {distanceLines.map((line: PilotDistanceLine, i: number) => {
          const midLat = (line.fromLat + line.toLat) / 2;
          const midLon = (line.fromLon + line.toLon) / 2;
          const label = line.distance_m >= 1000
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
                  html: `<div style="background:white;border:1px solid #94a3b8;border-radius:4px;padding:2px 6px;font-size:11px;font-weight:600;color:#0f172a;white-space:nowrap;box-shadow:0 1px 3px rgba(0,0,0,0.25);transform:translate(-50%,-50%)">${label}</div>`,
                  iconSize: [0, 0],
                  iconAnchor: [0, 0],
                })}
              />
            </Fragment>
          );
        })}
      </MapContainer>

      {/* Phase legend */}
      {phasesPresent.length > 1 && (
        <div className="absolute bottom-2 left-2 bg-white/90 backdrop-blur-sm rounded-lg px-2 py-1.5 shadow text-xs space-y-0.5 z-[1000]">
          {phasesPresent.map((phase) => (
            <div key={phase} className="flex items-center gap-1.5">
              <span
                className="inline-block w-3 h-1.5 rounded-full"
                style={{ background: PHASE_COLORS[phase] ?? PHASE_COLORS.unknown }}
              />
              <span className="text-sky-night">{PHASE_LABELS[phase] ?? phase}</span>
            </div>
          ))}
        </div>
      )}

      {/* Attribution */}
      <div className="absolute bottom-0 right-0 text-[9px] text-gray-400 bg-white/70 px-1 rounded z-[1000]">
        © OpenStreetMap
      </div>
    </div>
  );
}
