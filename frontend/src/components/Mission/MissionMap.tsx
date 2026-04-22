import { useRef, useEffect } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import { MissionWaypoint } from '../../services/missions.service';
import {
  calculateDistance, calculateTime, formatDistance, formatTime,
  calculateBearing, windAdjustedSpeed,
} from '../../utils/distanceUtils';
import 'leaflet/dist/leaflet.css';

interface MissionMapProps {
  waypoints: MissionWaypoint[];
  selectedWaypointId: string | null;
  launchSite?: { takeoff_lat: number; takeoff_lon: number; name: string } | null;
  onMapClick: (lat: number, lon: number) => void;
  onWaypointDrag: (id: string, lat: number, lon: number) => void;
  onWaypointClick: (id: string) => void;
  center?: [number, number];
  flyToCenter?: [number, number] | null;
  showSegTime?: boolean;
  showSegDist?: boolean;
  showFuel?: boolean;
  averageSpeed?: number;
  distanceUnit?: 'km' | 'mi';
  avgFuelConsumption?: number;
  fuelTankSize?: number | null;
  windDirection?: number | null;
  windSpeed?: number;
}

function MapClickHandler({ onMapClick }: { onMapClick: (lat: number, lon: number) => void }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function MapFitter({ waypoints, launchSite }: {
  waypoints: MissionWaypoint[];
  launchSite?: { takeoff_lat: number; takeoff_lon: number } | null;
}) {
  const map = useMap();
  const fitted = useRef(false);

  useEffect(() => {
    if (fitted.current) return;

    const pts: [number, number][] = waypoints.map((w) => [Number(w.latitude), Number(w.longitude)]);
    if (launchSite) {
      pts.push([launchSite.takeoff_lat, launchSite.takeoff_lon]);
    }

    if (pts.length > 0) {
      map.fitBounds(pts, { padding: [40, 40], maxZoom: 15 });
      fitted.current = true;
    }
  }, [waypoints, launchSite, map]);

  return null;
}

function FlyToCenter({ coords }: { coords: [number, number] | null | undefined }) {
  const map = useMap();
  useEffect(() => {
    if (coords) {
      map.flyTo(coords, Math.max(map.getZoom(), 12), { duration: 1.2 });
    }
  }, [coords, map]);
  return null;
}

function createWaypointIcon(index: number, selected: boolean, fuelPercent: number | null = null) {
  const bg = selected ? '#3B82F6' : '#FF6B00';
  const border = selected ? '#1D4ED8' : '#fff';

  const gaugeColor = fuelPercent === null ? '#22c55e'
    : fuelPercent > 50 ? '#22c55e'
    : fuelPercent > 25 ? '#f59e0b'
    : '#ef4444';
  const fillHeight = fuelPercent !== null ? Math.max(0, Math.min(100, fuelPercent)) : 0;

  const gauge = fuelPercent !== null ? `
    <div style="
      width: 6px;
      height: 24px;
      border: 1.5px solid rgba(0,0,0,0.35);
      border-radius: 3px;
      background: rgba(255,255,255,0.85);
      display: flex;
      flex-direction: column;
      justify-content: flex-end;
      overflow: hidden;
      box-shadow: 0 1px 3px rgba(0,0,0,0.2);
      flex-shrink: 0;
    ">
      <div style="
        width: 100%;
        height: ${fillHeight}%;
        background: ${gaugeColor};
      "></div>
    </div>` : '';

  const totalWidth = fuelPercent !== null ? 37 : 28;

  return L.divIcon({
    className: 'mission-waypoint-marker',
    html: `<div style="display:flex;align-items:center;gap:3px;">
      <div style="
        width: 28px;
        height: 28px;
        background-color: ${bg};
        border: 3px solid ${border};
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 11px;
        font-weight: bold;
        color: white;
        box-shadow: 0 2px 6px rgba(0,0,0,0.35);
        cursor: grab;
        transition: transform 0.15s ease;
        flex-shrink: 0;
      "
      onmouseover="this.style.transform='scale(1.2)'"
      onmouseout="this.style.transform='scale(1)'"
      >${index + 1}</div>
      ${gauge}
    </div>`,
    iconSize: [totalWidth, 28],
    iconAnchor: [14, 14],
  });
}

function createWindSockIcon(direction: number, speed: number): L.DivIcon {
  // Sock tail points downwind; default orientation is pointing right (+x).
  const sockAngle = (direction + 90) % 360;

  // 2× scale: sockLen=48, mH=16, tH=8
  // Taper: h(x) = 16 - (16-8)*(x/48) = 16 - x/6
  // Stripe boundaries at x = 0, 12, 24, 36, 48 → h = 16, 14, 12, 10, 8
  const stripes = [
    { x1: 0,  x2: 12, y1: 16, y2: 14, fill: '#f97316' },
    { x1: 12, x2: 24, y1: 14, y2: 12, fill: 'white'   },
    { x1: 24, x2: 36, y1: 12, y2: 10, fill: '#f97316' },
    { x1: 36, x2: 48, y1: 10, y2: 8,  fill: 'white'   },
  ].map(({ x1, x2, y1, y2, fill }) =>
    `<polygon points="${x1},${-y1} ${x2},${-y2} ${x2},${y2} ${x1},${y1}" fill="${fill}"/>`
  ).join('');

  // SVG: 120×130. Pole: (60,60)→(60,110). iconAnchor=[60,128] places the
  // pole base 18px above the waypoint centre (just above the 28px marker circle).
  const html = `<svg width="120" height="130" viewBox="0 0 120 130" xmlns="http://www.w3.org/2000/svg" style="overflow:visible">
    <ellipse cx="60" cy="112" rx="10" ry="3.5" fill="#9ca3af" opacity="0.45"/>
    <line x1="60" y1="110" x2="60" y2="60" stroke="#374151" stroke-width="4" stroke-linecap="round"/>
    <g transform="translate(60,60) rotate(${sockAngle})">
      ${stripes}
      <polygon points="0,-16 48,-8 48,8 0,16" fill="none" stroke="#c2410c" stroke-width="2.5" stroke-linejoin="round"/>
      <ellipse cx="0"  cy="0" rx="2.5" ry="16" fill="none" stroke="#9a3412" stroke-width="2.5"/>
      <ellipse cx="48" cy="0" rx="1.5" ry="8"  fill="none" stroke="#9a3412" stroke-width="1.5"/>
    </g>
    <circle cx="60" cy="60" r="5.5" fill="#6b7280"/>
    <circle cx="60" cy="60" r="3.5" fill="#e5e7eb"/>
    <text x="72" y="114" font-size="16" font-weight="700" fill="#111827" font-family="sans-serif"
          stroke="white" stroke-width="5" paint-order="stroke">${speed} km/h</text>
  </svg>`;

  return L.divIcon({
    className: 'wind-sock-marker',
    html,
    iconSize: [120, 130],
    iconAnchor: [60, 128],
  });
}

function createLaunchSiteIcon(name: string) {
  return L.divIcon({
    className: 'launch-site-pin',
    html: `<div style="display:flex;align-items:center;gap:5px;white-space:nowrap;">
      <div style="
        width:12px;height:12px;flex-shrink:0;
        background:#16A34A;
        border:2px solid white;
        border-radius:50%;
        box-shadow:0 1px 4px rgba(0,0,0,0.3);
      "></div>
      <div style="
        background:#16A34A;
        color:white;
        font-size:10px;
        font-weight:600;
        padding:2px 6px;
        border-radius:4px;
        box-shadow:0 1px 4px rgba(0,0,0,0.3);
      ">${name}</div>
    </div>`,
    iconSize: [12, 12],
    iconAnchor: [6, 6],
  });
}

function createArrowIcon(bearingDeg: number) {
  return L.divIcon({
    className: 'mission-segment-arrow',
    html: `<div style="transform: rotate(${bearingDeg}deg); transform-origin: center; line-height: 0;">
      <svg xmlns="http://www.w3.org/2000/svg" width="10" height="13" viewBox="0 0 10 13">
        <polygon points="5,0 10,13 5,8.5 0,13" fill="#FF6B00" opacity="0.9"/>
      </svg>
    </div>`,
    iconSize: [10, 13],
    iconAnchor: [5, 6],
  });
}

function createSegmentLabelIcon(lines: string[]) {
  const html = lines.join('<br/>');
  return L.divIcon({
    className: 'segment-label',
    html: `<div style="
      display: inline-block;
      transform: translate(-50%, -50%);
      background: rgba(255,255,255,0.92);
      border: 1px solid #e5e7eb;
      border-radius: 4px;
      padding: 3px 8px;
      font-size: 20px;
      font-weight: 600;
      color: #374151;
      white-space: nowrap;
      box-shadow: 0 1px 3px rgba(0,0,0,0.15);
      text-align: center;
      line-height: 1.4;
    ">${html}</div>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}

export default function MissionMap({
  waypoints,
  selectedWaypointId,
  launchSite,
  onMapClick,
  onWaypointDrag,
  onWaypointClick,
  center = [47.5, 8.5],
  flyToCenter,
  showSegTime = false,
  showSegDist = false,
  showFuel = false,
  averageSpeed = 30,
  distanceUnit = 'km',
  avgFuelConsumption = 0,
  fuelTankSize = null,
  windDirection = null,
  windSpeed = 0,
}: MissionMapProps) {
  const polylinePositions: [number, number][] = waypoints.map((w) => [
    Number(w.latitude),
    Number(w.longitude),
  ]);

  return (
    <MapContainer
      center={center}
      zoom={12}
      style={{ height: '100%', width: '100%', cursor: 'crosshair' }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <MapClickHandler onMapClick={onMapClick} />
      <MapFitter waypoints={waypoints} launchSite={launchSite} />
      <FlyToCenter coords={flyToCenter} />

      {/* Mission route polyline */}
      {polylinePositions.length >= 2 && (
        <Polyline
          positions={polylinePositions}
          pathOptions={{ color: '#FF6B00', weight: 3, opacity: 0.85 }}
        />
      )}

      {/* Directional arrows at 1/3 of each segment */}
      {waypoints.length >= 2 && waypoints.map((wp, i) => {
        if (i === 0) return null;
        const prev = waypoints[i - 1];
        const arrowLat = Number(prev.latitude) + (Number(wp.latitude) - Number(prev.latitude)) / 3;
        const arrowLon = Number(prev.longitude) + (Number(wp.longitude) - Number(prev.longitude)) / 3;
        const bearing = calculateBearing(
          Number(prev.latitude), Number(prev.longitude),
          Number(wp.latitude), Number(wp.longitude),
        );
        return (
          <Marker
            key={`arrow-${wp.id}`}
            position={[arrowLat, arrowLon]}
            icon={createArrowIcon(bearing)}
            interactive={false}
          />
        );
      })}

      {/* Segment labels */}
      {(showSegTime || showSegDist || showFuel) && waypoints.length >= 2 && (() => {
        let cumulativeFuelL = 0;
        return waypoints.map((wp, i) => {
        if (i === 0) return null;
        const prev = waypoints[i - 1];
        const midLat = (Number(prev.latitude) + Number(wp.latitude)) / 2;
        const midLon = (Number(prev.longitude) + Number(wp.longitude)) / 2;
        const distKm = calculateDistance(
          Number(prev.latitude), Number(prev.longitude),
          Number(wp.latitude), Number(wp.longitude),
        );
        const bearing = calculateBearing(
          Number(prev.latitude), Number(prev.longitude),
          Number(wp.latitude), Number(wp.longitude),
        );
        const gndSpeed =
          windSpeed > 0 && windDirection !== null
            ? windAdjustedSpeed(averageSpeed, windSpeed, windDirection, bearing)
            : averageSpeed;
        const legTimeH = calculateTime(distKm, gndSpeed);
        if (showFuel && avgFuelConsumption > 0) cumulativeFuelL += legTimeH * avgFuelConsumption;
        const fuelExceeds = showFuel && avgFuelConsumption > 0 && fuelTankSize !== null && cumulativeFuelL > fuelTankSize;
        const lines: string[] = [];
        if (showSegDist) lines.push(formatDistance(distKm, distanceUnit));
        if (showSegTime) lines.push(formatTime(legTimeH));
        if (showFuel && avgFuelConsumption > 0) {
          const fuelStr = `${cumulativeFuelL.toFixed(1)} L`;
          if (fuelExceeds) {
            const noFuelIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline;vertical-align:middle;margin-right:2px"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>`;
            lines.push(`<span style="color:#dc2626;font-weight:700;">${noFuelIcon}${fuelStr}</span>`);
          } else {
            lines.push(fuelStr);
          }
        }
        return (
          <Marker
            key={`seg-label-${wp.id}`}
            position={[midLat, midLon]}
            icon={createSegmentLabelIcon(lines)}
            interactive={false}
          />
        );
        });
      })()}

      {/* Fuel remaining at each waypoint for gauge display */}
      {(() => {
        const fuelRemainingAtWaypoint: (number | null)[] = waypoints.map(() => null);
        if (showFuel && avgFuelConsumption > 0 && fuelTankSize !== null && fuelTankSize > 0) {
          let remaining = fuelTankSize;
          fuelRemainingAtWaypoint[0] = fuelTankSize;
          for (let i = 1; i < waypoints.length; i++) {
            const prev = waypoints[i - 1];
            const cur = waypoints[i];
            const distKm = calculateDistance(
              Number(prev.latitude), Number(prev.longitude),
              Number(cur.latitude), Number(cur.longitude),
            );
            const bearing = calculateBearing(
              Number(prev.latitude), Number(prev.longitude),
              Number(cur.latitude), Number(cur.longitude),
            );
            const gndSpeed = windSpeed > 0 && windDirection !== null
              ? windAdjustedSpeed(averageSpeed, windSpeed, windDirection, bearing)
              : averageSpeed;
            const legTimeH = calculateTime(distKm, gndSpeed);
            remaining = Math.max(0, remaining - legTimeH * avgFuelConsumption);
            fuelRemainingAtWaypoint[i] = remaining;
          }
        }

        return (
          <>
            {/* Waypoint markers (draggable) */}
            {waypoints.map((wp, i) => (
              <Marker
                key={wp.id}
                position={[Number(wp.latitude), Number(wp.longitude)]}
                icon={createWaypointIcon(
                  i,
                  selectedWaypointId === wp.id,
                  fuelRemainingAtWaypoint[i] !== null
                    ? (fuelRemainingAtWaypoint[i]! / fuelTankSize!) * 100
                    : null,
                )}
                draggable
                zIndexOffset={selectedWaypointId === wp.id ? 2000 : 1000}
                eventHandlers={{
                  click() {
                    onWaypointClick(wp.id);
                  },
                  dragend(e) {
                    const { lat, lng } = (e.target as L.Marker).getLatLng();
                    onWaypointDrag(wp.id, lat, lng);
                  },
                }}
              />
            ))}
          </>
        );
      })()}

      {/* Windsock at waypoint 1 */}
      {windDirection !== null && windSpeed != null && windSpeed > 0 && waypoints.length > 0 && (
        <Marker
          position={[Number(waypoints[0].latitude), Number(waypoints[0].longitude)]}
          icon={createWindSockIcon(windDirection, windSpeed)}
          interactive={false}
          zIndexOffset={750}
        />
      )}

      {/* Launch site marker */}
      {launchSite && (
        <Marker
          position={[launchSite.takeoff_lat, launchSite.takeoff_lon]}
          icon={createLaunchSiteIcon(launchSite.name)}
          zIndexOffset={500}
        />
      )}
    </MapContainer>
  );
}
