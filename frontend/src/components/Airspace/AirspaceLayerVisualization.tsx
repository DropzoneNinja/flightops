import { useMemo } from 'react';
import { FlightSite } from '../../services/sites.service';
import { AirspaceGeoJSON, AirspaceClass } from '../../services/airspace.service';

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
 * Format altitude for display
 */
function formatAltitude(alt: string): string {
  if (alt === 'SFC' || alt === 'GND') return 'GND';
  if (alt.startsWith('FL')) return alt;
  if (alt.includes('FT')) {
    const feet = parseInt(alt.replace('FT', ''));
    return `${(feet / 1000).toFixed(1)}k`;
  }
  return alt;
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

    // Convert to layer objects with parsed altitudes
    const layerObjects: AirspaceLayer[] = containingFeatures.map(feature => ({
      class: feature.properties.class,
      name: feature.properties.name,
      lower: feature.properties.lower,
      upper: feature.properties.upper,
      lowerFeet: parseAltitude(feature.properties.lower),
      upperFeet: parseAltitude(feature.properties.upper),
      color: CLASS_COLORS[feature.properties.class],
    }));

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

    // Merge adjacent layers of the same class
    const mergedLayers: AirspaceLayer[] = [];
    for (const layer of uniqueLayers) {
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

    console.log(`   After merging, ${mergedLayers.length} layers:`);
    mergedLayers.forEach(layer => {
      console.log(`     - ${layer.class}: ${layer.lower} to ${layer.upper}`);
    });

    return mergedLayers;
  }, [site, airspace]);

  // Calculate visual heights for each layer (proportional to altitude range)
  const layersWithHeights = useMemo(() => {
    if (layers.length === 0) return [];

    const maxAltitude = Math.max(...layers.map(l => l.upperFeet));
    const minHeight = 40; // Minimum pixels per layer
    const maxHeight = 120; // Maximum pixels per layer
    const containerHeight = 400; // Total available height

    return layers.map(layer => {
      const range = layer.upperFeet - layer.lowerFeet;
      const proportion = range / maxAltitude;
      let height = Math.max(minHeight, proportion * containerHeight);
      height = Math.min(maxHeight, height);

      return {
        ...layer,
        displayHeight: height,
      };
    });
  }, [layers]);

  if (layers.length === 0) {
    return (
      <div className="absolute bottom-4 right-4 mb-[280px] bg-white rounded-lg shadow-lg border-2 border-gray-300 p-4 z-[500] min-w-[250px]">
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
    <div className="absolute bottom-4 right-4 mb-[280px] bg-white rounded-lg shadow-lg border-2 border-gray-300 p-4 z-[500] min-w-[250px] max-w-[300px]">
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

      {/* Layers visualization */}
      <div className="space-y-2 max-h-[500px] overflow-y-auto flex flex-col-reverse">
        {layersWithHeights.map((layer, index) => (
          <div
            key={`${layer.class}-${layer.lowerFeet}-${index}`}
            className="relative border-2 border-gray-300 rounded flex flex-col justify-between overflow-hidden"
            style={{
              backgroundColor: layer.color,
              opacity: 0.85,
              minHeight: `${layer.displayHeight}px`,
            }}
          >
            {/* Upper altitude */}
            <div className="px-2 py-1 text-xs font-semibold text-white bg-black bg-opacity-30">
              {formatAltitude(layer.upper)}
            </div>

            {/* Center - Class letter */}
            <div className="flex-1 flex items-center justify-center">
              <div className="text-3xl font-bold text-white drop-shadow-lg">
                {layer.class}
              </div>
            </div>

            {/* Lower altitude */}
            <div className="px-2 py-1 text-xs font-semibold text-white bg-black bg-opacity-30">
              {formatAltitude(layer.lower)}
            </div>
          </div>
        ))}
      </div>

      {/* Ground reference */}
      <div className="mt-2 pt-2 border-t-2 border-gray-400 text-center">
        <span className="text-xs font-semibold text-gray-700">GROUND</span>
      </div>
    </div>
  );
}
