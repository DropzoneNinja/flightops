import L from 'leaflet';
import { Marker, Popup } from 'react-leaflet';
import { Mission } from '../../services/missions.service';

interface Props {
  mission: Mission;
  position: [number, number];
  onClick: () => void;
}

function createMissionPinIcon() {
  return L.divIcon({
    className: 'mission-pin-marker',
    html: `<div style="
      width: 14px;
      height: 14px;
      background: #4F46E5;
      border: 2px solid white;
      border-radius: 50%;
      box-shadow: 0 1px 4px rgba(0,0,0,0.35);
    "></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

export default function MissionMarker({ mission, position, onClick }: Props) {
  return (
    <Marker position={position} icon={createMissionPinIcon()} eventHandlers={{ click: onClick }}>
      <Popup closeButton={false} offset={[0, -10]}>
        <span className="text-xs font-semibold">{mission.name}</span>
      </Popup>
    </Marker>
  );
}
