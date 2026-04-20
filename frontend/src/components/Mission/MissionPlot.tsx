import L from 'leaflet';
import { Marker, Polyline, Popup } from 'react-leaflet';
import { Mission, MissionWaypoint } from '../../services/missions.service';

interface Props {
  mission: Mission;
  position: [number, number];
  waypoints: MissionWaypoint[];
  onClick: () => void;
}

function createWaypointIcon(index: number) {
  return L.divIcon({
    className: 'mission-waypoint-marker',
    html: `<div style="
      width: 28px;
      height: 28px;
      background-color: #FF6B00;
      border: 3px solid #fff;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
      font-weight: bold;
      color: white;
      box-shadow: 0 2px 6px rgba(0,0,0,0.35);
    ">${index + 1}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

function createLaunchSiteIcon(name: string) {
  return L.divIcon({
    className: 'launch-site-pin',
    html: `<div style="
      display: flex;
      flex-direction: column;
      align-items: center;
    ">
      <div style="
        background: #16A34A;
        color: white;
        font-size: 10px;
        font-weight: 600;
        padding: 2px 6px;
        border-radius: 4px;
        white-space: nowrap;
        box-shadow: 0 1px 4px rgba(0,0,0,0.3);
        margin-bottom: 2px;
      ">${name}</div>
      <div style="
        width: 12px;
        height: 12px;
        background: #16A34A;
        border: 2px solid white;
        border-radius: 50%;
        box-shadow: 0 1px 4px rgba(0,0,0,0.3);
      "></div>
    </div>`,
    iconSize: [80, 32],
    iconAnchor: [40, 32],
  });
}

export default function MissionPlot({ mission, position, waypoints, onClick }: Props) {
  const sorted = [...waypoints].sort((a, b) => a.sort_order - b.sort_order);
  const polylinePositions: [number, number][] = sorted.map((w) => [Number(w.latitude), Number(w.longitude)]);

  return (
    <>
      {mission.launch_site && (
        <Marker
          position={[mission.launch_site.takeoff_lat, mission.launch_site.takeoff_lon]}
          icon={createLaunchSiteIcon(mission.launch_site.name)}
          eventHandlers={{ click: onClick }}
        />
      )}
      {polylinePositions.length > 1 && (
        <Polyline positions={polylinePositions} color="#FF6B00" weight={2} opacity={0.7} />
      )}
      {sorted.map((wp, i) => (
        <Marker
          key={wp.id}
          position={[Number(wp.latitude), Number(wp.longitude)]}
          icon={createWaypointIcon(i)}
          eventHandlers={{ click: onClick }}
        >
          <Popup closeButton={false}>
            <span className="text-xs font-semibold">{mission.name} — WP {i + 1}</span>
          </Popup>
        </Marker>
      ))}
      {sorted.length === 0 && (
        <Marker position={position} eventHandlers={{ click: onClick }}>
          <Popup closeButton={false}>
            <span className="text-xs font-semibold">{mission.name}</span>
          </Popup>
        </Marker>
      )}
    </>
  );
}
