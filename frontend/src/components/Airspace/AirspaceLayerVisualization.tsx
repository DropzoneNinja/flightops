import { useMemo, useState } from 'react';
import { FlightSite } from '../../services/sites.service';
import { AirspaceGeoJSON, AirspaceClass } from '../../services/airspace.service';
import AirspaceClassModal from './AirspaceClassModal';

interface AirspaceLayerVisualizationProps {
  site: FlightSite;
  airspace: AirspaceGeoJSON;
  onClose: () => void;
}

interface AirspaceLayer {
  class: AirspaceClass;
  name: string;
  lower: string;
  upper: string;
  lowerFeet: number;
  upperFeet: number;
  color: string;
}

// Class colors (matching AirspaceClassFilter)
const CLASS_COLORS: Record<AirspaceClass, string> = {
  A: '#0080FF',
  C: '#C9A961',
  CTR: '#FF0000',
  D: '#0080FF',
  E: '#00FF00',
  Q: '#CC00CC',
  R: '#7B7FE6',
  G: '#4B8B3B',
  RMZ: '#1E90FF',
};

// FL150 cap (15,000 feet)
const FL150_FEET = 15000;

// Airspace class priority (lower number = higher priority)
const CLASS_PRIORITY: Record<AirspaceClass, number> = {
  A: 1,    // Class A - Highest priority
  C: 2,    // Class C - Major/busy airports
  CTR: 3,  // Control zones
  D: 4,    // Class D - Controlled airports with towers
  R: 5,    // Restricted airspace
  RMZ: 6,  // Radio Mandatory Zone
  E: 7,    // Class E - Controlled airspace
  Q: 8,    // Danger areas
  G: 9,    // Class G - Uncontrolled (lowest priority)
};

/**
 * Parse altitude string to feet
 */
function parseAltitude(alt: string): number {
  if (alt === 'SFC' || alt === 'GND') return 0;
  if (alt.startsWith('FL')) {
    const flightLevel = parseInt(alt.substring(2));
    return flightLevel * 100;
  }
  if (alt.includes('FT')) {
    return parseInt(alt.replace('FT', ''));
  }
  return 0;
}

/**
 * Check if a point is inside a polygon using ray-casting algorithm
 */
function pointInPolygon(point: [number, number], polygon: number[][][]): boolean {
  const [lng, lat] = point;
  const ring = polygon[0]; // Use outer ring

  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1];
    const xj = ring[j][0], yj = ring[j][1];

    const intersect = ((yi > lat) !== (yj > lat))
      && (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi);

    if (intersect) inside = !inside;
  }

  return inside;
}

/**
 * Check if point is in MultiPolygon
 */
function pointInMultiPolygon(point: [number, number], multiPolygon: number[][][][]): boolean {
  return multiPolygon.some(polygon => pointInPolygon(point, polygon));
}

export default function AirspaceLayerVisualization({
  site,
  airspace,
  onClose,
}: AirspaceLayerVisualizationProps) {
  // State for modal
  const [selectedClass, setSelectedClass] = useState<{
    class: AirspaceClass;
    name: string;
    color: string;
    lower: string;
    upper: string;
  } | null>(null);

  // Calculate layers for this site
  const layers = useMemo(() => {
    const point: [number, number] = [
      parseFloat(site.takeoff_lon.toString()),
      parseFloat(site.takeoff_lat.toString()),
    ];

    console.log(`🎯 [AirspaceLayerVisualization] Checking airspace for ${site.name}`);
    console.log(`   Point: [${point[0]}, ${point[1]}] (lon, lat)`);

    // Find all airspace features containing this point
    const containingFeatures = airspace.features.filter(feature => {
      if (feature.geometry.type === 'Polygon') {
        return pointInPolygon(point, feature.geometry.coordinates as number[][][]);
      } else if (feature.geometry.type === 'MultiPolygon') {
        return pointInMultiPolygon(point, feature.geometry.coordinates as number[][][][]);
      }
      return false;
    });

    console.log(`   Found ${containingFeatures.length} airspace features containing this point:`);

    // Debug: Print detailed airspace info for each zone
    containingFeatures.forEach((feature, index) => {
      console.log(`   [Zone ${index + 1}]`);
      console.log(`     AC (Class): ${feature.properties.class}`);
      console.log(`     AN (Name):  ${feature.properties.name}`);
      console.log(`     AL (Lower): ${feature.properties.lower}`);
      console.log(`     AH (Upper): ${feature.properties.upper}`);
    });

    // Convert to layer objects with parsed altitudes and truncate at FL150
    const layerObjects: AirspaceLayer[] = containingFeatures.map(feature => {
      const lowerFeet = parseAltitude(feature.properties.lower);
      const upperFeet = parseAltitude(feature.properties.upper);

      // Truncate upper altitude at FL150
      const truncatedUpperFeet = Math.min(upperFeet, FL150_FEET);
      const truncatedUpper = truncatedUpperFeet === FL150_FEET && upperFeet > FL150_FEET
        ? 'FL150'
        : feature.properties.upper;

      return {
        class: feature.properties.class,
        name: feature.properties.name,
        lower: feature.properties.lower,
        upper: truncatedUpper,
        lowerFeet: lowerFeet,
        upperFeet: truncatedUpperFeet,
        color: CLASS_COLORS[feature.properties.class],
      };
    }).filter(layer => layer.lowerFeet < FL150_FEET); // Exclude layers entirely above FL150

    layerObjects.forEach(layer => {
      console.log(`     - ${layer.class}: ${layer.lower} to ${layer.upper} (${layer.name})`);
    });

    // Remove duplicates (same class and altitude range)
    const uniqueLayers = layerObjects.filter((layer, index, self) =>
      index === self.findIndex(l =>
        l.class === layer.class &&
        l.lowerFeet === layer.lowerFeet &&
        l.upperFeet === layer.upperFeet
      )
    );

    // Sort by lower altitude (ground up)
    uniqueLayers.sort((a, b) => a.lowerFeet - b.lowerFeet);

    // Resolve overlapping airspace by priority
    // Collect all unique altitude boundaries
    const altitudeBoundaries = new Set<number>();
    uniqueLayers.forEach(layer => {
      altitudeBoundaries.add(layer.lowerFeet);
      altitudeBoundaries.add(layer.upperFeet);
    });
    const sortedBoundaries = Array.from(altitudeBoundaries).sort((a, b) => a - b);

    // For each altitude segment, find the highest priority class
    const resolvedLayers: AirspaceLayer[] = [];
    for (let i = 0; i < sortedBoundaries.length - 1; i++) {
      const segmentLower = sortedBoundaries[i];
      const segmentUpper = sortedBoundaries[i + 1];

      // Find all classes that cover this segment
      const coveringLayers = uniqueLayers.filter(layer =>
        layer.lowerFeet <= segmentLower && layer.upperFeet >= segmentUpper
      );

      if (coveringLayers.length === 0) continue;

      // Sort by priority and take the highest priority (lowest number)
      coveringLayers.sort((a, b) => CLASS_PRIORITY[a.class] - CLASS_PRIORITY[b.class]);
      const highestPriorityLayer = coveringLayers[0];

      // Create a segment for this altitude range
      resolvedLayers.push({
        class: highestPriorityLayer.class,
        name: highestPriorityLayer.name,
        lower: segmentLower === 0 ? 'SFC' : `FL${Math.round(segmentLower / 100)}`,
        upper: `FL${Math.round(segmentUpper / 100)}`,
        lowerFeet: segmentLower,
        upperFeet: segmentUpper,
        color: highestPriorityLayer.color,
      });
    }

    // Merge adjacent layers of the same class
    const mergedLayers: AirspaceLayer[] = [];
    for (const layer of resolvedLayers) {
      const lastLayer = mergedLayers[mergedLayers.length - 1];

      // If the last layer has the same class and is adjacent (upper altitude matches current lower altitude)
      if (lastLayer && lastLayer.class === layer.class && lastLayer.upperFeet === layer.lowerFeet) {
        // Extend the last layer's upper altitude
        lastLayer.upper = layer.upper;
        lastLayer.upperFeet = layer.upperFeet;
      } else {
        // Add as a new layer
        mergedLayers.push({ ...layer });
      }
    }

    console.log(`   After priority resolution and merging, ${mergedLayers.length} layers:`);
    mergedLayers.forEach(layer => {
      console.log(`     - ${layer.class}: ${layer.lower} to ${layer.upper}`);
    });

    return mergedLayers;
  }, [site, airspace]);

  // SVG dimensions configuration
  const SVG_HEIGHT = 400;
  const SVG_WIDTH = 100;
  const SVG_PADDING_TOP = 20;
  const SVG_PADDING_BOTTOM = 30;
  const GRAPH_HEIGHT = SVG_HEIGHT - SVG_PADDING_TOP - SVG_PADDING_BOTTOM; // 350px
  const AXIS_WIDTH = 70; // Width for boundary labels on the left

  // Calculate SVG data for rendering
  const svgData = useMemo(() => {
    if (layers.length === 0) return null;

    const maxAltitude = Math.min(
      Math.max(...layers.map(l => l.upperFeet)),
      FL150_FEET
    );

    // Convert feet to pixels (inverted for SVG coordinate system)
    const feetToPixels = (feet: number) => {
      const proportion = feet / maxAltitude;
      return SVG_PADDING_TOP + GRAPH_HEIGHT - (proportion * GRAPH_HEIGHT);
    };

    // Convert feet to Flight Level (divide by 100)
    const feetToFL = (feet: number) => Math.round(feet / 100);

    // Calculate layer rectangles
    const layerRects = layers.map(layer => {
      const y1 = feetToPixels(layer.upperFeet); // Top of layer
      const y2 = feetToPixels(layer.lowerFeet); // Bottom of layer
      const height = y2 - y1;

      return {
        ...layer,
        y: y1,
        height: height,
        centerY: y1 + height / 2, // For centering class letter
      };
    });

    // Calculate boundary labels (unique altitudes where layers start/end)
    const boundaryAltitudes = new Set<number>();
    layers.forEach(layer => {
      boundaryAltitudes.add(layer.lowerFeet);
      boundaryAltitudes.add(layer.upperFeet);
    });

    const boundaryLabels = Array.from(boundaryAltitudes)
      .sort((a, b) => a - b)
      .map(feet => ({
        feet,
        label: feet === 0 ? 'SFC' : `FL${feetToFL(feet)}`,
        y: feetToPixels(feet),
      }));

    return {
      maxAltitude,
      layerRects,
      boundaryLabels,
    };
  }, [layers, SVG_HEIGHT, SVG_PADDING_TOP, SVG_PADDING_BOTTOM, GRAPH_HEIGHT]);

  if (layers.length === 0) {
    return (
      <div className="absolute bottom-4 right-4 mb-[340px] bg-white rounded-lg shadow-lg border-2 border-gray-300 p-4 z-[500] min-w-[250px]">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-sm font-semibold text-gray-900">
            Airspace Layers
          </h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <p className="text-xs text-gray-600 mb-2">{site.name}</p>
        <p className="text-sm text-gray-500 text-center py-4">
          No airspace at this location
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Airspace Class Modal */}
      <AirspaceClassModal
        airspaceClass={selectedClass?.class || null}
        className={selectedClass ? `Class ${selectedClass.class}` : ''}
        color={selectedClass?.color || '#000000'}
        airspaceName={selectedClass?.name || ''}
        lowerAltitude={selectedClass?.lower || ''}
        upperAltitude={selectedClass?.upper || ''}
        onClose={() => setSelectedClass(null)}
      />

      {/* Main Visualization Container */}
      <div className="absolute bottom-4 right-4 mb-[340px] bg-white rounded-lg shadow-lg border-2 border-gray-300 p-4 z-[500]">
        {/* Header */}
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-sm font-semibold text-gray-900">
            Airspace Layers
          </h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Site name */}
        <p className="text-xs text-gray-600 mb-4">{site.name}</p>

        {/* SVG Bar Graph */}
        {svgData && (
          <svg
            width={AXIS_WIDTH + SVG_WIDTH}
            height={SVG_HEIGHT}
            className="mx-auto"
          >
            {/* Boundary labels on the left side */}
            {svgData.boundaryLabels.map((boundary, index) => (
              <g key={`boundary-${boundary.feet}-${index}`}>
                {/* Boundary label */}
                <text
                  x={AXIS_WIDTH - 15}
                  y={boundary.y}
                  textAnchor="end"
                  dominantBaseline="middle"
                  fontSize="11"
                  fill="#374151"
                  fontWeight="600"
                >
                  {boundary.label}
                </text>
                {/* Horizontal line from label to bar */}
                <line
                  x1={AXIS_WIDTH - 10}
                  y1={boundary.y}
                  x2={AXIS_WIDTH}
                  y2={boundary.y}
                  stroke="#374151"
                  strokeWidth="1.5"
                />
              </g>
            ))}

            {/* Stacked bar layers */}
            {svgData.layerRects.map((layer, index) => (
              <g key={`${layer.class}-${layer.lowerFeet}-${index}`}>
                {/* Layer rectangle */}
                <rect
                  x={AXIS_WIDTH}
                  y={layer.y}
                  width={SVG_WIDTH}
                  height={layer.height}
                  fill={layer.color}
                  opacity="0.85"
                  stroke="#374151"
                  strokeWidth="2"
                  className="cursor-pointer transition-opacity hover:opacity-100"
                  onClick={() => setSelectedClass({
                    class: layer.class,
                    name: layer.name,
                    color: layer.color,
                    lower: layer.lower,
                    upper: layer.upper,
                  })}
                />

                {/* Class letter in center of layer */}
                {layer.height > 30 && ( // Only show if layer is tall enough
                  <text
                    x={AXIS_WIDTH + SVG_WIDTH / 2}
                    y={layer.centerY}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize="24"
                    fontWeight="bold"
                    fill="white"
                    className="pointer-events-none drop-shadow-lg"
                    style={{ filter: 'drop-shadow(2px 2px 2px rgba(0,0,0,0.5))' }}
                  >
                    {layer.class}
                  </text>
                )}
              </g>
            ))}

            {/* Ground label */}
            <text
              x={AXIS_WIDTH + SVG_WIDTH / 2}
              y={SVG_HEIGHT - 10}
              textAnchor="middle"
              fontSize="12"
              fontWeight="600"
              fill="#374151"
            >
              GROUND
            </text>
          </svg>
        )}
      </div>
    </>
  );
}
