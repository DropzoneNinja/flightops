import { AirspaceClass, AirspaceGeoJSON } from '../services/airspace.service';

export interface AirspaceLayer {
  class: AirspaceClass;
  name: string;
  lower: string;
  upper: string;
  lowerFeet: number;
  upperFeet: number;
  color: string;
}

export const CLASS_COLORS: Record<AirspaceClass, string> = {
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

export const CLASS_PRIORITY: Record<AirspaceClass, number> = {
  R: 1,
  CTR: 2,
  Q: 3,
  A: 4,
  C: 5,
  D: 6,
  E: 7,
  G: 8,
  RMZ: 9,
};

export function parseAltitude(alt: string): number {
  if (alt === 'SFC' || alt === 'GND') return 0;
  if (alt.startsWith('FL')) {
    return parseInt(alt.substring(2)) * 100;
  }
  if (alt.includes('FT')) {
    return parseInt(alt.replace('FT', ''));
  }
  return 0;
}

export function pointInPolygon(point: [number, number], polygon: number[][][]): boolean {
  const [lng, lat] = point;
  const ring = polygon[0];
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

export function pointInMultiPolygon(point: [number, number], multiPolygon: number[][][][]): boolean {
  return multiPolygon.some(polygon => pointInPolygon(point, polygon));
}

export function computeAirspaceLayers(
  lat: number,
  lon: number,
  airspace: AirspaceGeoJSON,
  maxFeet: number,
): AirspaceLayer[] {
  const point: [number, number] = [lon, lat];

  const containingFeatures = airspace.features.filter(feature => {
    if (feature.geometry.type === 'Polygon') {
      return pointInPolygon(point, feature.geometry.coordinates as number[][][]);
    } else if (feature.geometry.type === 'MultiPolygon') {
      return pointInMultiPolygon(point, feature.geometry.coordinates as number[][][][]);
    }
    return false;
  });

  const layerObjects: AirspaceLayer[] = containingFeatures.map(feature => {
    const lowerFeet = parseAltitude(feature.properties.lower);
    const upperFeet = Math.min(parseAltitude(feature.properties.upper), maxFeet);
    const truncatedUpper = upperFeet === maxFeet && parseAltitude(feature.properties.upper) > maxFeet
      ? `${maxFeet}FT`
      : feature.properties.upper;

    return {
      class: feature.properties.class,
      name: feature.properties.name,
      lower: feature.properties.lower,
      upper: truncatedUpper,
      lowerFeet,
      upperFeet,
      color: CLASS_COLORS[feature.properties.class],
    };
  }).filter(layer => layer.lowerFeet < maxFeet);

  const uniqueLayers = layerObjects.filter((layer, index, self) =>
    index === self.findIndex(l =>
      l.class === layer.class &&
      l.lowerFeet === layer.lowerFeet &&
      l.upperFeet === layer.upperFeet
    )
  );

  uniqueLayers.sort((a, b) => a.lowerFeet - b.lowerFeet);

  const altitudeBoundaries = new Set<number>([0, maxFeet]);
  uniqueLayers.forEach(layer => {
    altitudeBoundaries.add(layer.lowerFeet);
    altitudeBoundaries.add(layer.upperFeet);
  });
  const sortedBoundaries = Array.from(altitudeBoundaries).sort((a, b) => a - b);

  const resolvedLayers: AirspaceLayer[] = [];
  for (let i = 0; i < sortedBoundaries.length - 1; i++) {
    const segmentLower = sortedBoundaries[i];
    const segmentUpper = sortedBoundaries[i + 1];

    const coveringLayers = uniqueLayers.filter(layer =>
      layer.lowerFeet <= segmentLower && layer.upperFeet >= segmentUpper
    );
    if (coveringLayers.length === 0) {
      resolvedLayers.push({
        class: 'G',
        name: 'Class G',
        lower: segmentLower === 0 ? 'SFC' : `${segmentLower}FT`,
        upper: `${segmentUpper}FT`,
        lowerFeet: segmentLower,
        upperFeet: segmentUpper,
        color: CLASS_COLORS['G'],
      });
      continue;
    }

    coveringLayers.sort((a, b) => CLASS_PRIORITY[a.class] - CLASS_PRIORITY[b.class]);
    const highest = coveringLayers[0];

    resolvedLayers.push({
      class: highest.class,
      name: highest.name,
      lower: segmentLower === 0 ? 'SFC' : `${segmentLower}FT`,
      upper: `${segmentUpper}FT`,
      lowerFeet: segmentLower,
      upperFeet: segmentUpper,
      color: highest.color,
    });
  }

  const mergedLayers: AirspaceLayer[] = [];
  for (const layer of resolvedLayers) {
    const last = mergedLayers[mergedLayers.length - 1];
    if (last && last.class === layer.class && last.upperFeet === layer.lowerFeet) {
      last.upper = layer.upper;
      last.upperFeet = layer.upperFeet;
    } else {
      mergedLayers.push({ ...layer });
    }
  }

  return mergedLayers;
}
