import { GeoJSON } from 'react-leaflet';
import { PathOptions } from 'leaflet';
import { useMemo } from 'react';
import { AirspaceGeoJSON, AirspaceClass, AirspaceFeature } from '../../services/airspace.service';

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

// FL150 cap (15,000 feet)
const FL150_FEET = 15000;

/**
 * Z-order priority for airspace classes (lower number = higher priority = renders on top)
 */
const AIRSPACE_PRIORITY: Record<AirspaceClass, number> = {
  R: 1,      // Restricted - highest priority
  CTR: 2,
  Q: 3,
  A: 4,
  C: 4,      // Class C - same priority as A
  D: 5,
  E: 6,
  G: 7,
  RMZ: 8,
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
  // Filter, truncate at FL150, and sort features by priority
  const processedData = useMemo(() => {
    // Filter by enabled classes first
    const filteredFeatures = airspace.features.filter(feature =>
      enabledClasses.has(feature.properties.class)
    );

    // Truncate upper altitude at FL150 and filter out features entirely above FL150
    const truncatedFeatures = filteredFeatures.map(feature => {
      const upperFeet = parseAltitude(feature.properties.upper);
      const lowerFeet = parseAltitude(feature.properties.lower);

      // Exclude layers entirely above FL150
      if (lowerFeet >= FL150_FEET) {
        return null;
      }

      // Truncate upper altitude at FL150 if it exceeds
      if (upperFeet > FL150_FEET) {
        return {
          ...feature,
          properties: {
            ...feature.properties,
            upper: 'FL150',
          },
        };
      }

      return feature;
    }).filter((f): f is AirspaceFeature => f !== null); // Remove null entries

    // Sort by priority (descending) - higher priority (lower number) renders last = on top
    const sortedFeatures = [...truncatedFeatures].sort((a, b) => {
      const priorityA = AIRSPACE_PRIORITY[a.properties.class as AirspaceClass] || 999;
      const priorityB = AIRSPACE_PRIORITY[b.properties.class as AirspaceClass] || 999;
      return priorityB - priorityA; // Descending: G first, R last (R on top)
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
