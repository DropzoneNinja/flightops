import { GeoJSON } from 'react-leaflet';
import { PathOptions } from 'leaflet';
import { useMemo } from 'react';
import { AirspaceGeoJSON, AirspaceClass } from '../../services/airspace.service';

interface AirspaceOverlayProps {
  airspace: AirspaceGeoJSON;
  enabledClasses: Set<AirspaceClass>;
}

// Aviation standard colors with transparency
const AIRSPACE_STYLES: Record<AirspaceClass, PathOptions> = {
  A: {
    color: '#0080FF',
    fillColor: '#0080FF',
    fillOpacity: 0.15,
    weight: 2,
    opacity: 0.6,
  },
  C: {
    color: '#C9A961',
    fillColor: '#C9A961',
    fillOpacity: 0.15,
    weight: 2,
    opacity: 0.6,
  },
  CTR: {
    color: '#FF0000',
    fillColor: '#FF0000',
    fillOpacity: 0.15,
    weight: 2,
    opacity: 0.6,
  },
  D: {
    color: '#0080FF',
    fillColor: '#0080FF',
    fillOpacity: 0.15,
    weight: 2,
    opacity: 0.6,
  },
  E: {
    color: '#00FF00',
    fillColor: '#00FF00',
    fillOpacity: 0.15,
    weight: 2,
    opacity: 0.6,
  },
  Q: {
    color: '#CC00CC',
    fillColor: '#CC00CC',
    fillOpacity: 0.15,
    weight: 2,
    opacity: 0.6,
  },
  R: {
    color: '#7B7FE6',
    fillColor: '#7B7FE6',
    fillOpacity: 0.2,
    weight: 2,
    opacity: 0.7,
    dashArray: '5, 5',
  },
  G: {
    color: '#4B8B3B',
    fillColor: '#4B8B3B',
    fillOpacity: 0.08,
    weight: 1.5,
    opacity: 0.4,
    dashArray: '3, 6',
  },
  RMZ: {
    color: '#1E90FF',
    fillColor: '#1E90FF',
    fillOpacity: 0.12,
    weight: 2,
    opacity: 0.5,
    dashArray: '8, 4',
  },
};

/**
 * Parse altitude string to feet
 * Examples: "FL180" -> 18000, "SFC" -> 0, "5000FT" -> 5000
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

export default function AirspaceOverlay({ airspace, enabledClasses }: AirspaceOverlayProps) {
  // Filter and sort features for topmost logic
  const processedData = useMemo(() => {
    // Filter by enabled classes first
    const filteredFeatures = airspace.features.filter(feature =>
      enabledClasses.has(feature.properties.class)
    );

    // Sort by upper altitude (ascending) - lower altitude rendered first (bottom), higher altitude last (top)
    const sortedFeatures = [...filteredFeatures].sort((a, b) => {
      const altA = parseAltitude(a.properties.upper);
      const altB = parseAltitude(b.properties.upper);
      return altA - altB;
    });

    return {
      type: 'FeatureCollection' as const,
      features: sortedFeatures,
    };
  }, [airspace, enabledClasses]);

  // Create a unique key based on enabled classes to force re-render
  const layerKey = useMemo(() => {
    return Array.from(enabledClasses).sort().join('-');
  }, [enabledClasses]);

  // Style function for each feature
  const getStyle = (feature: any): PathOptions => {
    const airspaceClass = feature.properties.class as AirspaceClass;
    return AIRSPACE_STYLES[airspaceClass];
  };

  return (
    <GeoJSON
      key={layerKey}
      data={processedData}
      style={getStyle}
    />
  );
}
