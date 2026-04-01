import { useMemo, useState } from 'react';
import DeckGL from '@deck.gl/react';
import { Map } from 'react-map-gl/maplibre';
import { PathLayer, ScatterplotLayer, SolidPolygonLayer, TextLayer } from '@deck.gl/layers';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { MapViewState } from '@deck.gl/core';
import type { Trackpoint } from '../../services/flights.service';

// Re-export so GaggleView can use them without depending on FlightViewer3D directly
export { PILOT_COLORS } from './FlightViewer3D';

export interface GagglePilot {
  id: string;
  pilotName: string;
  color: [number, number, number]; // RGB 0–255
  trackpoints: Trackpoint[];
  firstTimestampMs: number | null;
  lastTimestampMs: number | null;
}

export interface GaggleViewerProps {
  /** Pilots to display (already filtered to selected only) */
  pilots: GagglePilot[];
  /** Current playback position as unix ms. null = static full-track preview */
  playbackTime: number | null;
  /** Wall opacity 0–1 */
  wallOpacity: number;
  /** Trail length 0–100% */
  trailPercent: number;
  /** Combined bounding box of all pilots, for initial camera fit */
  bbox: { minLon: number; minLat: number; maxLon: number; maxLat: number } | null;
  /** When true, draw dashed lines between all pilot pairs at the current position with distance labels */
  showDistances?: boolean;
  className?: string;
}

// ─── Geometry helpers ────────────────────────────────────────────────────────

interface WallQuad {
  polygon: [number, number, number][];
  color: [number, number, number, number];
}

function getTakeoffElevation(trackpoints: Trackpoint[]): number {
  const tp = trackpoints.find(
    (t) => t.phase === 'pre_takeoff' || t.phase === 'takeoff',
  ) ?? trackpoints[0];
  return tp?.elevation_m ?? 0;
}

function buildWallQuads(
  trackpoints: Trackpoint[],
  groundElevation: number,
  color: [number, number, number, number],
): WallQuad[] {
  const quads: WallQuad[] = [];
  for (let i = 0; i < trackpoints.length - 1; i++) {
    const a = trackpoints[i];
    const b = trackpoints[i + 1];
    const elevA = a.elevation_m ?? groundElevation;
    const elevB = b.elevation_m ?? groundElevation;
    if (elevA <= groundElevation && elevB <= groundElevation) continue;
    quads.push({
      color,
      polygon: [
        [a.lon, a.lat, elevA],
        [b.lon, b.lat, elevB],
        [b.lon, b.lat, groundElevation],
        [a.lon, a.lat, groundElevation],
      ],
    });
  }
  return quads;
}

// ─── Timestamp resolution ────────────────────────────────────────────────────

/** Find the index of the last trackpoint whose timestamp ≤ targetMs.
 *  Falls back to linear scan if timestamps are null (uses progress interpolation). */
function findTrackpointIndex(
  trackpoints: Trackpoint[],
  targetMs: number,
  firstMs: number,
  lastMs: number,
): number {
  if (trackpoints.length === 0) return -1;

  // If trackpoints have real timestamps, binary search
  if (trackpoints[0].timestamp !== null) {
    let lo = 0;
    let hi = trackpoints.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      const ts = new Date(trackpoints[mid].timestamp!).getTime();
      if (ts <= targetMs) lo = mid;
      else hi = mid - 1;
    }
    const ts0 = new Date(trackpoints[lo].timestamp!).getTime();
    return ts0 <= targetMs ? lo : -1;
  }

  // Fallback: interpolate by progress through [firstMs, lastMs]
  const duration = lastMs - firstMs;
  if (duration <= 0) return 0;
  const progress = Math.min(1, (targetMs - firstMs) / duration);
  return Math.min(
    trackpoints.length - 1,
    Math.floor(progress * trackpoints.length),
  );
}

// ─── Distance helpers ────────────────────────────────────────────────────────

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6_371_000;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function GaggleViewer({
  pilots,
  playbackTime,
  wallOpacity,
  trailPercent,
  bbox,
  showDistances = false,
  className = '',
}: GaggleViewerProps) {
  const initialViewState = useMemo<MapViewState>(() => {
    const lon = bbox ? (bbox.minLon + bbox.maxLon) / 2 : 0;
    const lat = bbox ? (bbox.minLat + bbox.maxLat) / 2 : 0;
    return { longitude: lon, latitude: lat, zoom: 12, pitch: 50, bearing: 0, maxPitch: 85, minPitch: 0 };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [viewState, setViewState] = useState<MapViewState>(initialViewState);

  // ── Per-pilot visible trail slices ────────────────────────────────────────
  const pilotSlices = useMemo(() => {
    const wallAlpha = Math.round(wallOpacity * 200);
    return pilots.map((pilot) => {
      const { trackpoints, color, firstTimestampMs, lastTimestampMs } = pilot;
      if (trackpoints.length === 0) return null;

      let visibleTps: Trackpoint[];
      let currentTp: Trackpoint | null = null;

      if (playbackTime === null) {
        // Static preview — show full track
        visibleTps = trackpoints;
        currentTp = trackpoints[trackpoints.length - 1];
      } else {
        // Pilot not yet airborne
        if (firstTimestampMs !== null && playbackTime < firstTimestampMs) return null;

        // Once the pilot's flight has fully ended, always show their complete track
        const hasFinished = lastTimestampMs !== null && playbackTime >= lastTimestampMs;

        const idx = hasFinished
          ? trackpoints.length - 1
          : findTrackpointIndex(
              trackpoints,
              playbackTime,
              firstTimestampMs ?? playbackTime,
              lastTimestampMs ?? playbackTime,
            );
        if (idx < 0) return null;

        currentTp = trackpoints[idx];
        if (hasFinished) {
          // Show full track once flight is complete (mirrors FlightViewer3D landing behaviour)
          visibleTps = trackpoints;
        } else {
          const trailWindow = Math.round(trackpoints.length * trailPercent / 100);
          const start = trailPercent >= 100 ? 0 : Math.max(0, idx - trailWindow);
          visibleTps = trackpoints.slice(start, idx + 1);
        }
      }

      // Build path array
      const path: [number, number, number][] = visibleTps.map(
        (tp) => [tp.lon, tp.lat, (tp.elevation_m ?? 0) + 2],
      );

      // Wall quads — only while the pilot's flight is currently in progress
      const isActive =
        playbackTime === null ||
        (firstTimestampMs === null || playbackTime >= firstTimestampMs) &&
        (lastTimestampMs === null || playbackTime < lastTimestampMs);
      const groundElevation = getTakeoffElevation(trackpoints);
      const wallColor: [number, number, number, number] = [...color, wallAlpha] as [number, number, number, number];
      const wallQuads = isActive ? buildWallQuads(visibleTps, groundElevation, wallColor) : [];

      return { pilot, path, wallQuads, currentTp, color };
    }).filter(Boolean) as {
      pilot: GagglePilot;
      path: [number, number, number][];
      wallQuads: WallQuad[];
      currentTp: Trackpoint;
      color: [number, number, number];
    }[];
  }, [pilots, playbackTime, wallOpacity, trailPercent]);

  // ── Build Deck.GL layers ──────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const layers = useMemo<any[]>(() => {
    const result: any[] = []; // eslint-disable-line @typescript-eslint/no-explicit-any

    for (const slice of pilotSlices) {
      const { pilot, path, wallQuads, currentTp, color } = slice;
      const id = pilot.id;

      // 1. Wall curtain
      if (wallQuads.length > 0) {
        result.push(
          new SolidPolygonLayer({
            id: `wall-${id}`,
            data: wallQuads,
            getPolygon: (d: WallQuad) => d.polygon,
            getFillColor: (d: WallQuad) => d.color,
            extruded: false,
            filled: true,
            _full3d: true,
            pickable: false,
            updateTriggers: { getFillColor: [wallOpacity] },
          } as any), // eslint-disable-line @typescript-eslint/no-explicit-any
        );
      }

      // 2. Trail path
      if (path.length >= 2) {
        result.push(
          new PathLayer({
            id: `path-${id}`,
            data: [{ path }],
            getPath: (d: { path: [number, number, number][] }) => d.path,
            getColor: [...color, 220] as [number, number, number, number],
            getWidth: 5,
            widthUnits: 'pixels',
            pickable: false,
          }),
        );
      }

      // 3. Current position dot
      result.push(
        new ScatterplotLayer({
          id: `dot-${id}`,
          data: [currentTp],
          getPosition: (tp: Trackpoint) =>
            [tp.lon, tp.lat, (tp.elevation_m ?? 0) + 15] as [number, number, number],
          getRadius: 8,
          radiusUnits: 'pixels',
          getFillColor: color,
          getLineColor: [255, 255, 255, 255] as [number, number, number, number],
          stroked: true,
          getLineWidth: 2,
          pickable: false,
        }),
      );

      // 4. Pilot name label above dot
      result.push(
        new TextLayer({
          id: `label-${id}`,
          data: [{ position: [currentTp.lon, currentTp.lat, (currentTp.elevation_m ?? 0) + 40] as [number, number, number], text: pilot.pilotName }],
          getPosition: (d: { position: [number, number, number] }) => d.position,
          getText: (d: { text: string }) => d.text,
          getSize: 13,
          getColor: [255, 255, 255, 240] as [number, number, number, number],
          getBackgroundColor: [0, 0, 0, 160] as [number, number, number, number],
          background: true,
          backgroundPadding: [4, 2, 4, 2],
          getTextAnchor: 'middle',
          getAlignmentBaseline: 'bottom',
          fontFamily: 'system-ui, sans-serif',
          fontWeight: 600,
          pickable: false,
          billboard: true,
        } as any), // eslint-disable-line @typescript-eslint/no-explicit-any
      );
    }

    // Distance lines between all visible pilot pairs
    if (showDistances && pilotSlices.length >= 2) {
      for (let i = 0; i < pilotSlices.length; i++) {
        for (let j = i + 1; j < pilotSlices.length; j++) {
          const a = pilotSlices[i];
          const b = pilotSlices[j];
          const dist = haversineMeters(a.currentTp.lat, a.currentTp.lon, b.currentTp.lat, b.currentTp.lon);
          const distLabel = dist >= 1000
            ? `${(dist / 1000).toFixed(2)} km`
            : `${Math.round(dist)} m`;
          const elevA = (a.currentTp.elevation_m ?? 0) + 10;
          const elevB = (b.currentTp.elevation_m ?? 0) + 10;
          const midElev = Math.max(elevA, elevB) + 20;

          result.push(
            new PathLayer({
              id: `dist-line-${i}-${j}`,
              data: [{ path: [[a.currentTp.lon, a.currentTp.lat, elevA], [b.currentTp.lon, b.currentTp.lat, elevB]] }],
              getPath: (d: { path: [number, number, number][] }) => d.path,
              getColor: [251, 191, 36, 220] as [number, number, number, number],
              getWidth: 2,
              widthUnits: 'pixels',
              pickable: false,
            }),
          );

          result.push(
            new TextLayer({
              id: `dist-label-${i}-${j}`,
              data: [{
                position: [
                  (a.currentTp.lon + b.currentTp.lon) / 2,
                  (a.currentTp.lat + b.currentTp.lat) / 2,
                  midElev,
                ] as [number, number, number],
                text: distLabel,
              }],
              getPosition: (d: { position: [number, number, number] }) => d.position,
              getText: (d: { text: string }) => d.text,
              getSize: 13,
              getColor: [255, 255, 255, 240] as [number, number, number, number],
              getBackgroundColor: [15, 23, 42, 210] as [number, number, number, number],
              background: true,
              backgroundPadding: [5, 3, 5, 3],
              getTextAnchor: 'middle',
              fontFamily: 'system-ui, sans-serif',
              fontWeight: 600,
              pickable: false,
              billboard: true,
            } as any), // eslint-disable-line @typescript-eslint/no-explicit-any
          );
        }
      }
    }

    return result;
  }, [pilotSlices, wallOpacity, showDistances]);

  if (pilots.length === 0) {
    return (
      <div className={`flex items-center justify-center bg-sky-cloud rounded-lg text-sm text-sky-dusk ${className}`}>
        No flights to display
      </div>
    );
  }

  return (
    <div className={`relative ${className}`} style={{ overflow: 'hidden' }}>
      <DeckGL
        viewState={viewState}
        onViewStateChange={({ viewState: vs }) => setViewState(vs as MapViewState)}
        controller
        layers={layers}
        style={{ width: '100%', height: '100%' }}
      >
        <Map
          mapStyle="https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
          reuseMaps
          attributionControl={false}
        />
      </DeckGL>

      {/* Attribution */}
      <div className="absolute bottom-2 right-2 text-[9px] text-gray-300 bg-black/30 px-1 rounded z-10">
        © CartoDB
      </div>
    </div>
  );
}
