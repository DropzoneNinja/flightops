import { Polyline, Marker } from 'react-leaflet';
import L from 'leaflet';
import { calculateDistance, formatDistance, calculateTime, formatTime } from '../../utils/distanceUtils';

interface PlotOverlayProps {
  points: Array<{ lat: number; lon: number }>;
  isClosed: boolean;
  isEditing: boolean;
  distanceUnit: 'km' | 'mi';
  averageSpeed: number;
  showLabels?: boolean;
  onNodeClick?: (nodeIndex: number, lat: number, lon: number) => void;
}

/**
 * PlotOverlay - Renders plot polylines and distance labels on the map
 *
 * Displays:
 * - Orange polylines connecting consecutive points
 * - Numbered circular markers at each point
 * - Distance labels at the midpoint of each segment
 * - Cumulative time with segment time in parentheses
 * - Direction arrows on segments (when saved)
 * - Closing segment when plot is closed
 */
export default function PlotOverlay({
  points,
  isClosed,
  isEditing,
  distanceUnit,
  averageSpeed,
  showLabels = true,
  onNodeClick,
}: PlotOverlayProps) {
  if (points.length === 0) return null;

  // Always create markers for each point (editing or saved)
  const pointMarkers = points.map((point, index) => (
    <Marker
      key={`plot-point-${index}`}
      position={[point.lat, point.lon]}
      icon={createPlotPointIcon(index + 1)}
      zIndexOffset={3000}
      eventHandlers={{
        click: () => {
          if (onNodeClick && !isEditing) {
            onNodeClick(index, point.lat, point.lon);
          }
        },
      }}
    />
  ));

  // Calculate cumulative times for each segment
  const segmentData: Array<{ distance: number; segmentTime: number; cumulativeTime: number }> = [];
  let cumulativeTime = 0;

  // Calculate for regular segments
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    const distance = calculateDistance(p1.lat, p1.lon, p2.lat, p2.lon);
    const segmentTime = calculateTime(distance, averageSpeed);
    cumulativeTime += segmentTime;
    segmentData.push({ distance, segmentTime, cumulativeTime });
  }

  // Add closing segment if closed
  if (isClosed && points.length > 2) {
    const p1 = points[points.length - 1];
    const p2 = points[0];
    const distance = calculateDistance(p1.lat, p1.lon, p2.lat, p2.lon);
    const segmentTime = calculateTime(distance, averageSpeed);
    cumulativeTime += segmentTime;
    segmentData.push({ distance, segmentTime, cumulativeTime });
  }

  // Create line segments with distance and time labels
  const segments = [];

  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    const { distance, segmentTime, cumulativeTime } = segmentData[i];

    const midLat = (p1.lat + p2.lat) / 2;
    const midLon = (p1.lon + p2.lon) / 2;

    // Arrow position at 1/3 of the segment
    const arrowLat = p1.lat + (p2.lat - p1.lat) * 0.33;
    const arrowLon = p1.lon + (p2.lon - p1.lon) * 0.33;

    // Calculate arrow angle
    const angle = Math.atan2(p2.lat - p1.lat, p2.lon - p1.lon) * (180 / Math.PI);

    segments.push(
      <Polyline
        key={`segment-${i}`}
        positions={[
          [p1.lat, p1.lon],
          [p2.lat, p2.lon],
        ]}
        pathOptions={{
          color: '#FF6B00',
          weight: 3,
          opacity: 0.8,
        }}
      />
    );

    // Show label only if labels are enabled
    if (showLabels) {
      segments.push(
        <Marker
          key={`label-${i}`}
          position={[midLat, midLon]}
          icon={createDistanceAndTimeLabelIcon(
            formatDistance(distance, distanceUnit),
            formatTime(cumulativeTime),
            formatTime(segmentTime)
          )}
          zIndexOffset={3100}
        />
      );
    }

    // Add direction arrow only for saved plots (not editing)
    if (!isEditing) {
      segments.push(
        <Marker
          key={`arrow-${i}`}
          position={[arrowLat, arrowLon]}
          icon={createDirectionArrowIcon(angle)}
          zIndexOffset={3050}
        />
      );
    }
  }

  // Add closing segment if plot is closed
  if (isClosed && points.length > 2) {
    const p1 = points[points.length - 1];
    const p2 = points[0];
    const segmentIndex = points.length - 1;
    const { distance, segmentTime, cumulativeTime } = segmentData[segmentIndex];

    const midLat = (p1.lat + p2.lat) / 2;
    const midLon = (p1.lon + p2.lon) / 2;

    // Arrow position at 1/3 of the segment
    const arrowLat = p1.lat + (p2.lat - p1.lat) * 0.33;
    const arrowLon = p1.lon + (p2.lon - p1.lon) * 0.33;

    // Calculate arrow angle
    const angle = Math.atan2(p2.lat - p1.lat, p2.lon - p1.lon) * (180 / Math.PI);

    segments.push(
      <Polyline
        key="segment-closing"
        positions={[
          [p1.lat, p1.lon],
          [p2.lat, p2.lon],
        ]}
        pathOptions={{
          color: '#FF6B00',
          weight: 3,
          opacity: 0.8,
        }}
      />
    );

    // Show label only if labels are enabled
    if (showLabels) {
      segments.push(
        <Marker
          key="label-closing"
          position={[midLat, midLon]}
          icon={createDistanceAndTimeLabelIcon(
            formatDistance(distance, distanceUnit),
            formatTime(cumulativeTime),
            formatTime(segmentTime)
          )}
          zIndexOffset={3100}
        />
      );
    }

    // Add direction arrow only for saved plots (not editing)
    if (!isEditing) {
      segments.push(
        <Marker
          key="arrow-closing"
          position={[arrowLat, arrowLon]}
          icon={createDirectionArrowIcon(angle)}
          zIndexOffset={3050}
        />
      );
    }
  }

  return (
    <>
      {segments}
      {pointMarkers}
    </>
  );
}

/**
 * Create numbered circular marker icon for plot points
 */
function createPlotPointIcon(number: number) {
  return L.divIcon({
    className: 'plot-point-marker',
    html: `<div style="
      width: 24px;
      height: 24px;
      background-color: #FF6B00;
      border: 3px solid white;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: bold;
      color: white;
      box-shadow: 0 2px 5px rgba(0,0,0,0.3);
      cursor: pointer;
      transition: transform 0.2s ease-in-out;
    "
    onmouseover="this.style.transform='scale(1.2)'"
    onmouseout="this.style.transform='scale(1)'"
    >${number}</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

/**
 * Create distance and time label icon for segment midpoints
 * Shows distance, cumulative time, and segment time in parentheses
 */
function createDistanceAndTimeLabelIcon(distance: string, cumulativeTime: string, segmentTime: string) {
  return L.divIcon({
    className: 'distance-time-label',
    html: `<div style="
      background-color: white;
      border: 3px solid #FF6B00;
      border-radius: 6px;
      padding: 6px 10px;
      font-size: 14px;
      font-weight: bold;
      color: #FF6B00;
      box-shadow: 0 2px 6px rgba(0,0,0,0.4);
      white-space: nowrap;
      text-align: center;
      line-height: 1.4;
    ">
      <div style="margin-bottom: 2px;">${distance}</div>
      <div style="font-size: 12px; color: #666; font-weight: 600;">${cumulativeTime} (${segmentTime})</div>
    </div>`,
    iconSize: [100, 50],
    iconAnchor: [50, 25],
  });
}

/**
 * Create direction arrow icon for segments
 * Arrow points from current node toward next node
 */
function createDirectionArrowIcon(angle: number) {
  return L.divIcon({
    className: 'direction-arrow',
    html: `<div style="
      width: 0;
      height: 0;
      border-left: 8px solid transparent;
      border-right: 8px solid transparent;
      border-bottom: 16px solid #FF6B00;
      filter: drop-shadow(0 1px 2px rgba(0,0,0,0.3));
      transform: rotate(${90 - angle}deg);
    "></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}
