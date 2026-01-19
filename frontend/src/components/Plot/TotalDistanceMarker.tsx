import { Marker } from 'react-leaflet';
import L from 'leaflet';
import { calculatePlotDistance, formatDistance, calculatePlotTime, formatTime } from '../../utils/distanceUtils';

interface TotalDistanceMarkerProps {
  points: Array<{ lat: number; lon: number }>;
  distanceUnit: 'km' | 'mi';
  averageSpeed: number;
}

/**
 * TotalDistanceMarker - Displays total perimeter distance and time at the start point
 *
 * Positioned above the first point of a closed plot to show the total distance and time
 */
export default function TotalDistanceMarker({
  points,
  distanceUnit,
  averageSpeed,
}: TotalDistanceMarkerProps) {
  if (points.length < 3) return null;

  const totalKm = calculatePlotDistance(points);
  const totalTime = calculatePlotTime(points, averageSpeed);
  const startPoint = points[0];

  const icon = L.divIcon({
    className: 'total-distance-marker',
    html: `<div style="
      background-color: #FF6B00;
      color: white;
      border: 3px solid white;
      border-radius: 8px;
      padding: 6px 12px;
      font-size: 13px;
      font-weight: bold;
      box-shadow: 0 2px 6px rgba(0,0,0,0.4);
      white-space: nowrap;
      text-align: center;
      line-height: 1.4;
    ">
      <div>Total: ${formatDistance(totalKm, distanceUnit)}</div>
      <div style="font-size: 11px; opacity: 0.9;">${formatTime(totalTime)}</div>
    </div>`,
    iconSize: [120, 40],
    iconAnchor: [60, -20], // Position above the first point
  });

  return (
    <Marker
      position={[startPoint.lat, startPoint.lon]}
      icon={icon}
      zIndexOffset={3200}
    />
  );
}
