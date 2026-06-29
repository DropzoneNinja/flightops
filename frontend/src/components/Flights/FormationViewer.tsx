import { useMemo, useState, useEffect } from 'react';
import DeckGL from '@deck.gl/react';
import { Map } from 'react-map-gl/maplibre';
import { PathLayer, ScatterplotLayer, SolidPolygonLayer, TextLayer } from '@deck.gl/layers';
import { CollisionFilterExtension } from '@deck.gl/extensions';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { MapViewState } from '@deck.gl/core';
import type { Trackpoint } from '../../services/flights.service';

// Re-export so FormationView can use them without depending on FlightViewer3D directly
export { PILOT_COLORS } from './FlightViewer3D';

export interface FormationPilot {
  id: string;
  pilotName: string;
  color: [number, number, number]; // RGB 0–255
  trackpoints: Trackpoint[];
  firstTimestampMs: number | null;
  lastTimestampMs: number | null;
}

export interface FormationViewerProps {
  /** Pilots to display (already filtered to selected only) */
  pilots: FormationPilot[];
  /** Current playback position as unix ms. null = static full-track preview */
  playbackTime: number | null;
  /** Wall opacity 0–1 */
  wallOpacity: number;
  /** Trail length 0–100% */
  trailPercent: number;
  /** Combined bounding box of all pilots, for initial camera fit */
  bbox: { minLon: number; minLat: number; maxLon: number; maxLat: number } | null;
  /** When true, draw lines between all pilot pairs at the current position */
  showDistances?: boolean;
  /** When true, show speed (km/h) next to each pilot label and speed diff on comparison lines */
  showSpeed?: boolean;
  /** When true, show height (ft) next to each pilot label and height diff on comparison lines */
  showHeight?: boolean;
  /** When true, show distance between pilots on comparison lines */
  showLineDistance?: boolean;
  /** Whether playback is currently running (used to lock camera in follow mode) */
  isPlaying?: boolean;
  className?: string;
}

type CameraMode = 'free' | 'orbit' | 'follow';
type MapStyle = 'dark' | 'satellite';

const MAP_STYLES: Record<MapStyle, string | object> = {
  dark: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
  satellite: {
    version: 8,
    sources: {
      esri: {
        type: 'raster',
        tiles: [
          'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        ],
        tileSize: 256,
        attribution: '© Esri, Maxar, Earthstar Geographics',
      },
    },
    layers: [{ id: 'esri-satellite', type: 'raster', source: 'esri' }],
  },
};

// ─── Geometry helpers ────────────────────────────────────────────────────────

interface WallQuad {
  polygon: [number, number, number][];
  color: [number, number, number, number];
}

function getTakeoffElevation(trackpoints: Trackpoint[]): number {
  const tp = trackpoints.find(
    (t) => t.phase === 'pre_takeoff' || t.phase === 'takeoff',
  ) ?? trackpoints[0];
  const elev = Number(tp?.elevation_m);
  return Number.isFinite(elev) ? elev : 0;
}

function buildWallQuads(
  trackpoints: Trackpoint[],
  groundElevation: number,
  color: [number, number, number, number],
): WallQuad[] {
  const safeGround = Number.isFinite(groundElevation) ? groundElevation : 0;
  const quads: WallQuad[] = [];
  for (let i = 0; i < trackpoints.length - 1; i++) {
    const a = trackpoints[i];
    const b = trackpoints[i + 1];
    const aLon = Number(a.lon), aLat = Number(a.lat);
    const bLon = Number(b.lon), bLat = Number(b.lat);
    if (!Number.isFinite(aLon) || !Number.isFinite(aLat) || !Number.isFinite(bLon) || !Number.isFinite(bLat)) continue;
    const elevA = Math.max(Number.isFinite(a.elevation_m) ? a.elevation_m! : safeGround, safeGround);
    const elevB = Math.max(Number.isFinite(b.elevation_m) ? b.elevation_m! : safeGround, safeGround);
    if (elevA <= safeGround + 1 && elevB <= safeGround + 1) continue;
    quads.push({
      color,
      polygon: [
        [aLon, aLat, elevA],
        [bLon, bLat, elevB],
        [bLon, bLat, safeGround],
        [aLon, aLat, safeGround],
        [aLon, aLat, elevA],  // close the ring
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

export default function FormationViewer({
  pilots,
  playbackTime,
  wallOpacity,
  trailPercent,
  bbox,
  showDistances = false,
  showSpeed = false,
  showHeight = false,
  showLineDistance = false,
  isPlaying = false,
  className = '',
}: FormationViewerProps) {
  const initialViewState = useMemo<MapViewState>(() => {
    const lon = bbox ? (bbox.minLon + bbox.maxLon) / 2 : 0;
    const lat = bbox ? (bbox.minLat + bbox.maxLat) / 2 : 0;
    return { longitude: lon, latitude: lat, zoom: 12, pitch: 50, bearing: 0, maxPitch: 85, minPitch: 0 };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [viewState, setViewState] = useState<MapViewState>(initialViewState);
  const [cameraMode, setCameraMode] = useState<CameraMode>('free');
  const [mapStyle, setMapStyle] = useState<MapStyle>('dark');

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

      // Build path array (coerce — lat/lon may be strings from the DB)
      const path: [number, number, number][] = visibleTps.map(
        (tp) => [Number(tp.lon), Number(tp.lat), (Number(tp.elevation_m) || 0) + 2],
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
      pilot: FormationPilot;
      path: [number, number, number][];
      wallQuads: WallQuad[];
      currentTp: Trackpoint;
      color: [number, number, number];
    }[];
  }, [pilots, playbackTime, wallOpacity, trailPercent]);

  // ── Camera: orbit mode ───────────────────────────────────────────────────
  useEffect(() => {
    if (cameraMode === 'orbit') {
      setViewState((prev) => ({ ...prev, pitch: 65 }));
    } else if (cameraMode === 'free') {
      setViewState((prev) => ({ ...prev, pitch: 50 }));
    }
  }, [cameraMode]);

  // ── Camera: follow mode (center on centroid of active pilots) ─────────────
  useEffect(() => {
    if (cameraMode !== 'follow') return;
    const active = pilotSlices.filter((s) => s.currentTp);
    if (active.length === 0) return;
    const lon = active.reduce((sum, s) => sum + Number(s.currentTp.lon), 0) / active.length;
    const lat = active.reduce((sum, s) => sum + Number(s.currentTp.lat), 0) / active.length;
    setViewState((prev) => ({ ...prev, longitude: lon, latitude: lat }));
  }, [cameraMode, pilotSlices]);

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
            [Number(tp.lon), Number(tp.lat), (Number(tp.elevation_m) || 0) + 15] as [number, number, number],
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
      const labelParts = [pilot.pilotName];
      if (showSpeed && currentTp.speed_mps != null) {
        labelParts.push(`${(Number(currentTp.speed_mps) * 3.6).toFixed(0)} km/h`);
      }
      if (showHeight && currentTp.elevation_m != null) {
        labelParts.push(`${Math.round(Number(currentTp.elevation_m) * 3.28084)} ft`);
      }
      result.push(
        new TextLayer({
          id: `label-${id}`,
          data: [{ position: [Number(currentTp.lon), Number(currentTp.lat), (Number(currentTp.elevation_m) || 0) + 40] as [number, number, number], text: labelParts.join('\n') }],
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
          extensions: [new CollisionFilterExtension()],
          collideEnabled: true,
          collisionGroup: 'formation-labels',
          getCollisionPriority: 1,
        } as any), // eslint-disable-line @typescript-eslint/no-explicit-any
      );
    }

    // Distance lines between all visible pilot pairs
    if (showDistances && pilotSlices.length >= 2) {
      for (let i = 0; i < pilotSlices.length; i++) {
        for (let j = i + 1; j < pilotSlices.length; j++) {
          const a = pilotSlices[i];
          const b = pilotSlices[j];
          const aLat = Number(a.currentTp.lat), aLon = Number(a.currentTp.lon);
          const bLat = Number(b.currentTp.lat), bLon = Number(b.currentTp.lon);
          const elevA = (Number(a.currentTp.elevation_m) || 0) + 10;
          const elevB = (Number(b.currentTp.elevation_m) || 0) + 10;
          const midElev = Math.max(elevA, elevB) + 20;

          result.push(
            new PathLayer({
              id: `dist-line-${i}-${j}`,
              data: [{ path: [[aLon, aLat, elevA], [bLon, bLat, elevB]] }],
              getPath: (d: { path: [number, number, number][] }) => d.path,
              getColor: [251, 191, 36, 220] as [number, number, number, number],
              getWidth: 2,
              widthUnits: 'pixels',
              pickable: false,
            }),
          );

          const lineLabelParts: string[] = [];
          if (showLineDistance) {
            const dist = haversineMeters(aLat, aLon, bLat, bLon);
            lineLabelParts.push(dist >= 1000 ? `${(dist / 1000).toFixed(2)} km` : `${Math.round(dist)} m`);
          }
          if (showSpeed) {
            const sA = a.currentTp.speed_mps != null ? Number(a.currentTp.speed_mps) : null;
            const sB = b.currentTp.speed_mps != null ? Number(b.currentTp.speed_mps) : null;
            if (sA != null && sB != null) {
              const diff = (sA - sB) * 3.6;
              lineLabelParts.push(`${diff >= 0 ? '+' : ''}${diff.toFixed(1)} km/h`);
            }
          }
          if (showHeight) {
            const eA = a.currentTp.elevation_m != null ? Number(a.currentTp.elevation_m) : null;
            const eB = b.currentTp.elevation_m != null ? Number(b.currentTp.elevation_m) : null;
            if (eA != null && eB != null) {
              const diff = Math.round((eA - eB) * 3.28084);
              lineLabelParts.push(`${diff >= 0 ? '+' : ''}${diff} ft`);
            }
          }
          const lineLabel = lineLabelParts.join('\n');

          if (lineLabel) {
            result.push(
              new TextLayer({
                id: `dist-label-${i}-${j}`,
                data: [{
                  position: [
                    (aLon + bLon) / 2,
                    (aLat + bLat) / 2,
                    midElev,
                  ] as [number, number, number],
                  text: lineLabel,
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
                extensions: [new CollisionFilterExtension()],
                collideEnabled: true,
                collisionGroup: 'formation-labels',
                getCollisionPriority: 0,
              } as any), // eslint-disable-line @typescript-eslint/no-explicit-any
            );
          }
        }
      }
    }

    return result;
  }, [pilotSlices, wallOpacity, showDistances, showSpeed, showHeight, showLineDistance]);

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
        onViewStateChange={({ viewState: vs }) => {
          if (cameraMode === 'follow' && isPlaying) return;
          setViewState(vs as MapViewState);
        }}
        controller={!(cameraMode === 'follow' && isPlaying)}
        layers={layers}
        style={{ width: '100%', height: '100%' }}
      >
        <Map
          mapStyle={MAP_STYLES[mapStyle] as string}
          reuseMaps
          attributionControl={false}
        />
      </DeckGL>

      {/* ── Camera mode selector ─────────────────────────────────────────── */}
      <div className="absolute top-2 right-2 z-10 flex flex-col gap-1 items-end">
        <div className="bg-white/90 backdrop-blur-sm rounded-lg shadow p-1 flex gap-1">
          {(['free', 'orbit', 'follow'] as CameraMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setCameraMode(mode)}
              title={
                mode === 'free'
                  ? 'Free: pan, zoom, tilt freely'
                  : mode === 'orbit'
                    ? 'Orbit: elevated viewing angle'
                    : 'Follow: camera tracks playback position'
              }
              className={`px-2 py-0.5 text-xs rounded capitalize transition-colors ${
                cameraMode === mode
                  ? 'bg-sky-morning text-white'
                  : 'text-sky-dusk hover:bg-sky-cloud'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
        <div className="bg-white/90 backdrop-blur-sm rounded-lg shadow p-1 flex gap-1">
          {(['dark', 'satellite'] as MapStyle[]).map((style) => (
            <button
              key={style}
              onClick={() => setMapStyle(style)}
              title={style === 'dark' ? 'Dark map' : 'Satellite imagery'}
              className={`px-2 py-0.5 text-xs rounded capitalize transition-colors ${
                mapStyle === style
                  ? 'bg-sky-morning text-white'
                  : 'text-sky-dusk hover:bg-sky-cloud'
              }`}
            >
              {style === 'satellite' ? '🛰 sat' : '🌑 dark'}
            </button>
          ))}
        </div>
      </div>

      {/* Attribution */}
      <div className="absolute bottom-2 right-2 text-[9px] text-gray-300 bg-black/30 px-1 rounded z-10">
        {mapStyle === 'satellite' ? '© Esri, Maxar' : '© CartoDB'}
      </div>
    </div>
  );
}
