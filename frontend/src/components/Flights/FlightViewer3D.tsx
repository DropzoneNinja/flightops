import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import DeckGL from '@deck.gl/react';
import { Map } from 'react-map-gl/maplibre';
import { PathLayer, ScatterplotLayer, SolidPolygonLayer, TextLayer } from '@deck.gl/layers';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { MapViewState } from '@deck.gl/core';
import type { FlightViewerProps, FlightData, PilotDistanceLine } from './flight-viewer.types';
import type { Trackpoint, FlightEvent } from '../../services/flights.service';
import { formatFlightTime } from '../../utils/flight-time';

// ─── Phase colours (matches FlightMap2D for consistency) ───────────────────
export const PHASE_COLORS: Record<string, string> = {
  pre_takeoff:  '#94a3b8',
  takeoff:      '#84cc16',
  climb:        '#22c55e',
  cruise:       '#3b82f6',
  turn:         '#a855f7',
  descent:      '#f97316',
  approach:     '#f59e0b',
  landing:      '#ef4444',
  post_landing: '#94a3b8',
  unknown:      '#64748b',
};

export const PHASE_LABELS: Record<string, string> = {
  pre_takeoff:  'Pre-takeoff',
  takeoff:      'Takeoff',
  climb:        'Climb',
  cruise:       'Cruise',
  turn:         'Turn',
  descent:      'Descent',
  approach:     'Approach',
  landing:      'Landing',
  post_landing: 'Post-landing',
  unknown:      'Unknown',
};

// Colours for additional comparison flights
export const PILOT_COLORS: [number, number, number][] = [
  [59,  130, 246],  // blue
  [239, 68,  68],   // red
  [34,  197, 94],   // green
  [168, 85,  247],  // purple
  [249, 115, 22],   // orange
  [20,  184, 166],  // teal
];

type CameraMode = 'free' | 'orbit' | 'follow';

// ─── Helpers ────────────────────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return m
    ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)]
    : [100, 116, 139];
}

interface PathSegment3D {
  phase: string;
  path: [number, number, number][];
}

/** Build phase-coloured path segments (lon, lat, elevation+2m) for PathLayer.
 *  The +2m Z offset prevents z-fighting with the wall top edge. */
function buildSegments3D(trackpoints: Trackpoint[]): PathSegment3D[] {
  if (trackpoints.length === 0) return [];
  const segments: PathSegment3D[] = [];
  let currentPhase = trackpoints[0].phase;
  let currentPath: [number, number, number][] = [
    [trackpoints[0].lon, trackpoints[0].lat, (trackpoints[0].elevation_m ?? 0) + 2],
  ];
  for (let i = 1; i < trackpoints.length; i++) {
    const tp = trackpoints[i];
    const pos: [number, number, number] = [tp.lon, tp.lat, (tp.elevation_m ?? 0) + 2];
    if (tp.phase !== currentPhase) {
      segments.push({ phase: currentPhase, path: currentPath });
      currentPhase = tp.phase;
      currentPath = [currentPath[currentPath.length - 1], pos];
    } else {
      currentPath.push(pos);
    }
  }
  segments.push({ phase: currentPhase, path: currentPath });
  return segments;
}

interface WallQuad {
  polygon: [number, number, number][];
  phase: string;
}

/** Build semi-translucent wall quads from track down to elevation 0. */
/** Elevation of the takeoff point (first pre_takeoff or takeoff trackpoint),
 *  used as AGL ground-zero for the wall bottom. */
function getTakeoffElevation(trackpoints: Trackpoint[]): number {
  const tp = trackpoints.find(
    (t) => t.phase === 'pre_takeoff' || t.phase === 'takeoff',
  ) ?? trackpoints[0];
  return tp?.elevation_m ?? 0;
}

function buildWallQuads(trackpoints: Trackpoint[], groundElevation: number): WallQuad[] {
  const quads: WallQuad[] = [];
  for (let i = 0; i < trackpoints.length - 1; i++) {
    const a = trackpoints[i];
    const b = trackpoints[i + 1];
    const elevA = a.elevation_m ?? groundElevation;
    const elevB = b.elevation_m ?? groundElevation;
    // Skip segments at or below ground level
    if (elevA <= groundElevation && elevB <= groundElevation) continue;
    quads.push({
      phase: a.phase,
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

// ─── Component ──────────────────────────────────────────────────────────────

export default function FlightViewer3D({
  trackpoints,
  bbox,
  events = [],
  flights = [],
  activePointIndex,
  onPointHover,
  pinnedPointIndex,
  onPointClick,
  wallOpacity = 0.35,
  trailPercent = 100,
  distanceLines = [],
  className = '',
  timezone = 'UTC',
}: FlightViewerProps) {
  const [cameraMode, setCameraMode] = useState<CameraMode>('free');
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackIdx, setPlaybackIdx] = useState(
    trackpoints.length > 0 ? trackpoints.length - 1 : 0,
  );

  // Refs to avoid stale closures in rAF loop
  const animFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);
  const playbackIdxRef = useRef(playbackIdx);
  playbackIdxRef.current = playbackIdx;
  const trailPercentRef = useRef(trailPercent);
  trailPercentRef.current = trailPercent;
  const onPointHoverRef = useRef(onPointHover);
  onPointHoverRef.current = onPointHover;

  // ── Initial view state ──────────────────────────────────────────────────
  const initialViewState = useMemo<MapViewState>(() => {
    const lon = bbox
      ? (bbox.minLon + bbox.maxLon) / 2
      : (trackpoints[0]?.lon ?? 0);
    const lat = bbox
      ? (bbox.minLat + bbox.maxLat) / 2
      : (trackpoints[0]?.lat ?? 0);
    return { longitude: lon, latitude: lat, zoom: 12, pitch: 50, bearing: 0, maxPitch: 85, minPitch: 0 };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [viewState, setViewState] = useState<MapViewState>(initialViewState);

  // ── Playback animation ──────────────────────────────────────────────────
  const tick = useCallback(
    (ts: number) => {
      if (lastTimeRef.current === null) lastTimeRef.current = ts;
      const dt = ts - lastTimeRef.current;
      lastTimeRef.current = ts;
      const advance = Math.max(1, Math.floor(trackpoints.length * 0.02 * (dt / 1000)));
      const next = playbackIdxRef.current + advance;
      // Extend playback past the last trackpoint by one full trail window so the
      // tail animates out to nothing after landing
      const trailWindow = Math.round(trackpoints.length * trailPercentRef.current / 100);
      const maxIdx = trackpoints.length - 1 + trailWindow;
      if (next >= maxIdx) {
        setPlaybackIdx(maxIdx);
        setIsPlaying(false);
        return;
      }
      setPlaybackIdx(next);
      onPointHoverRef.current?.(Math.min(next, trackpoints.length - 1));
      animFrameRef.current = requestAnimationFrame(tick);
    },
    [trackpoints.length],
  );

  useEffect(() => {
    if (isPlaying) {
      lastTimeRef.current = null;
      animFrameRef.current = requestAnimationFrame(tick);
    } else if (animFrameRef.current != null) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    return () => {
      if (animFrameRef.current != null) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isPlaying, tick]);

  // ── Camera: follow mode ──────────────────────────────────────────────────
  useEffect(() => {
    if (cameraMode !== 'follow') return;
    const pt = trackpoints[Math.min(playbackIdx, trackpoints.length - 1)];
    if (!pt) return;
    setViewState((prev) => ({ ...prev, longitude: pt.lon, latitude: pt.lat }));
  }, [cameraMode, playbackIdx, trackpoints]);

  // ── Camera: orbit mode ───────────────────────────────────────────────────
  useEffect(() => {
    if (cameraMode === 'orbit') {
      setViewState((prev) => ({ ...prev, pitch: 65 }));
    } else if (cameraMode === 'free') {
      setViewState((prev) => ({ ...prev, pitch: 50 }));
    }
  }, [cameraMode]);

  // ── Sync activePointIndex from parent ────────────────────────────────────
  useEffect(() => {
    if (activePointIndex != null && !isPlaying) {
      setPlaybackIdx(activePointIndex);
    }
  }, [activePointIndex, isPlaying]);

  // ── Visible path (progressive during playback, trimmed by trail length) ──
  const landingIdx = useMemo(() => {
    const idx = trackpoints.findIndex(
      (tp) => tp.phase === 'approach' || tp.phase === 'landing' || tp.phase === 'post_landing',
    );
    // Fallback: if no landing-related phase detected, treat last 10% of track as post-landing
    return idx >= 0 ? idx : Math.floor(trackpoints.length * 0.9);
  }, [trackpoints]);
  const visibleTrackpoints = useMemo(() => {
    // Once playback has reached the landing phase, always show through to the end
    const hasLanded = landingIdx >= 0 && playbackIdx >= landingIdx;
    const end = hasLanded ? trackpoints.length : Math.min(playbackIdx + 1, trackpoints.length);
    const trailWindow = Math.round(trackpoints.length * trailPercent / 100);
    // During tail-out (playbackIdx past last trackpoint) start advances to shrink the trail
    const start = trailPercent >= 100 ? 0 : Math.max(0, playbackIdx - trailWindow);
    return trackpoints.slice(start, end);
  }, [trackpoints, playbackIdx, trailPercent, landingIdx]);
  const groundElevation = useMemo(() => getTakeoffElevation(trackpoints), [trackpoints]);
  const segments = useMemo(() => buildSegments3D(visibleTrackpoints), [visibleTrackpoints]);
  const wallQuads = useMemo(() => buildWallQuads(visibleTrackpoints, groundElevation), [visibleTrackpoints, groundElevation]);
  const currentPt = trackpoints[Math.min(playbackIdx, trackpoints.length - 1)] ?? null;

  // Pre-compute wall colors per phase (only 12 entries, not n trackpoints)
  const wallColorMap = useMemo(() => {
    const alpha = Math.round(wallOpacity * 200); // cap at 200/255 so always semi-transparent
    const map: Record<string, [number, number, number, number]> = {};
    for (const [phase, hex] of Object.entries(PHASE_COLORS)) {
      const [r, g, b] = hexToRgb(hex);
      map[phase] = [r, g, b, alpha];
    }
    return map;
  }, [wallOpacity]);

  // ── Layers ───────────────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const layers = useMemo<any[]>(() => {
    const result = [];

    // 1. Wall/curtain layer (bottom — rendered first)
    result.push(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      new SolidPolygonLayer({
        id: 'wall-curtain',
        data: wallQuads as WallQuad[],
        getPolygon: (d: WallQuad) => d.polygon,
        getFillColor: (d: WallQuad) => wallColorMap[d.phase] ?? wallColorMap.unknown ?? [100, 116, 139, 70],
        extruded: false,
        filled: true,
        _full3d: true,  // tessellate in 3D space so vertical wall quads aren't collapsed to zero area
        pickable: false,
        updateTriggers: {
          getFillColor: [wallOpacity],
        },
      } as any),
    );

    // 2. Phase-coloured primary path (+2m Z to avoid z-fighting with wall)
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      result.push(
        new PathLayer<PathSegment3D>({
          id: `primary-seg-${i}`,
          data: [seg],
          getPath: (d) => d.path,
          getColor: (d) =>
            [...hexToRgb(PHASE_COLORS[d.phase] ?? PHASE_COLORS.unknown), 220] as [
              number, number, number, number,
            ],
          getWidth: 5,
          widthUnits: 'pixels',
          pickable: false,
        }),
      );
    }

    // 3. Additional comparison flights
    (flights as FlightData[]).forEach((flight, fi) => {
      const color = flight.color ?? PILOT_COLORS[fi % PILOT_COLORS.length];
      const path: [number, number, number][] = flight.trackpoints.map(
        (tp) => [tp.lon, tp.lat, (tp.elevation_m ?? 0) + 2],
      );
      result.push(
        new PathLayer<{ path: [number, number, number][] }>({
          id: `extra-flight-${flight.id}`,
          data: [{ path }],
          getPath: (d) => d.path,
          getColor: [...color, 200] as [number, number, number, number],
          getWidth: 4,
          widthUnits: 'pixels',
          pickable: false,
        }),
      );
    });

    // 4. Event markers (white dots)
    const mappableEvents = (events as FlightEvent[]).filter(
      (e) => e.lat != null && e.lon != null,
    );
    if (mappableEvents.length > 0) {
      result.push(
        new ScatterplotLayer<FlightEvent>({
          id: 'events',
          data: mappableEvents,
          getPosition: (e) => [e.lon!, e.lat!, (e.elevation_m ?? 0) + 20] as [number, number, number],
          getRadius: 6,
          radiusUnits: 'pixels',
          getFillColor: [255, 255, 255, 220],
          getLineColor: [71, 85, 105, 255],
          stroked: true,
          getLineWidth: 2,
          pickable: false,
        }),
      );
    }

    // 5. Current playback position (cyan dot)
    if (currentPt) {
      result.push(
        new ScatterplotLayer<Trackpoint>({
          id: 'current-pos',
          data: [currentPt],
          getPosition: (tp) =>
            [tp.lon, tp.lat, (tp.elevation_m ?? 0) + 15] as [number, number, number],
          getRadius: 8,
          radiusUnits: 'pixels',
          getFillColor: [14, 165, 233, 255],
          getLineColor: [255, 255, 255, 255],
          stroked: true,
          getLineWidth: 2,
          pickable: false,
        }),
      );
    }

    // 6. Pinned point (amber dot — click-selected)
    const pinnedPt = pinnedPointIndex != null ? trackpoints[pinnedPointIndex] : null;
    if (pinnedPt) {
      result.push(
        new ScatterplotLayer<Trackpoint>({
          id: 'pinned-pos',
          data: [pinnedPt],
          getPosition: (tp) =>
            [tp.lon, tp.lat, (tp.elevation_m ?? 0) + 20] as [number, number, number],
          getRadius: 12,
          radiusUnits: 'pixels',
          getFillColor: [251, 191, 36, 255],
          getLineColor: [255, 255, 255, 255],
          stroked: true,
          getLineWidth: 2,
          pickable: false,
        }),
      );
    }

    // 7. Pilot distance lines (PathLayer + TextLayer)
    if ((distanceLines as PilotDistanceLine[]).length > 0) {
      result.push(
        new PathLayer<PilotDistanceLine>({
          id: 'pilot-distance-lines',
          data: distanceLines as PilotDistanceLine[],
          getPath: (d) => [
            [d.fromLon, d.fromLat, (d.fromElev ?? 0) + 10],
            [d.toLon, d.toLat, (d.toElev ?? 0) + 10],
          ],
          getColor: [251, 191, 36, 220],
          getWidth: 2,
          widthUnits: 'pixels',
          pickable: false,
        }),
      );
      result.push(
        new TextLayer<PilotDistanceLine>({
          id: 'pilot-distance-labels',
          data: distanceLines as PilotDistanceLine[],
          getPosition: (d: PilotDistanceLine) => [
            (d.fromLon + d.toLon) / 2,
            (d.fromLat + d.toLat) / 2,
            Math.max(d.fromElev ?? 0, d.toElev ?? 0) + 30,
          ] as [number, number, number],
          getText: (d: PilotDistanceLine) =>
            d.distance_m >= 1000
              ? `${(d.distance_m / 1000).toFixed(2)} km`
              : `${Math.round(d.distance_m)} m`,
          getSize: 14,
          getColor: [255, 255, 255, 240],
          getBackgroundColor: [15, 23, 42, 210],
          background: true,
          getBorderPadding: 4,
          pickable: false,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any),
      );
    }

    // 8. Invisible pick layer — topmost, captures clicks with full trackpoint precision
    result.push(
      new ScatterplotLayer<Trackpoint>({
        id: 'track-pick',
        data: trackpoints,
        getPosition: (tp) =>
          [tp.lon, tp.lat, (tp.elevation_m ?? 0) + 2] as [number, number, number],
        getRadius: 30,
        radiusUnits: 'meters',
        getFillColor: [0, 0, 0, 0],
        pickable: true,
        onClick: (info) => {
          if (info.index >= 0) onPointClick?.(info.index);
          return true; // consume event
        },
      }),
    );

    return result;
  }, [segments, wallQuads, wallColorMap, wallOpacity, flights, events, currentPt, pinnedPointIndex, trackpoints, onPointClick, distanceLines]);

  // ── Timestamp display ────────────────────────────────────────────────────
  const currentTimestamp = currentPt?.timestamp
    ? formatFlightTime(new Date(currentPt.timestamp).getTime(), timezone)
    : `${Math.round((playbackIdx / Math.max(1, trackpoints.length - 1)) * 100)}%`;

  if (trackpoints.length === 0) {
    return (
      <div
        className={`flex items-center justify-center bg-sky-cloud rounded-lg h-64 text-sm text-sky-dusk ${className}`}
      >
        No track data available
      </div>
    );
  }

  return (
    <div
      className={`relative ${className}`}
      style={{ overflow: 'hidden' }}
    >
      <DeckGL
        viewState={viewState}
        onViewStateChange={({ viewState: vs }) => {
          if (cameraMode === 'follow' && isPlaying) return;
          setViewState(vs as MapViewState);
        }}
        controller={!(cameraMode === 'follow' && isPlaying)}
        layers={layers}
        style={{ width: '100%', height: '100%' }}
        pickingRadius={8}
      >
        {/* MapLibre GL base map — no API key required with CartoDB tiles */}
        <Map
          mapStyle="https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
          reuseMaps
          attributionControl={false}
        />
      </DeckGL>

      {/* ── Camera mode selector ────────────────────────────────────────── */}
      <div className="absolute top-2 right-2 z-10 bg-white/90 backdrop-blur-sm rounded-lg shadow p-1 flex gap-1">
        {(['free', 'orbit', 'follow'] as CameraMode[]).map((mode) => (
          <button
            key={mode}
            onClick={() => setCameraMode(mode)}
            title={
              mode === 'free'
                ? 'Free: pan, zoom, tilt freely'
                : mode === 'orbit'
                ? 'Orbit: elevated angle view'
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

      {/* ── Playback controls ───────────────────────────────────────────── */}
      <div className="absolute bottom-2 left-2 right-2 z-10">
        <div className="bg-white/90 backdrop-blur-sm rounded-lg shadow px-3 py-2 flex items-center gap-2">
          {/* Play / Pause */}
          <button
            onClick={() => {
              const trailWindow = Math.round(trackpoints.length * trailPercent / 100);
              if (!isPlaying && playbackIdx >= trackpoints.length - 1 + trailWindow) {
                setPlaybackIdx(0);
              }
              setIsPlaying((p) => !p);
            }}
            aria-label={isPlaying ? 'Pause' : 'Play'}
            className="w-7 h-7 rounded-full bg-sky-morning text-white text-xs flex items-center justify-center shrink-0"
          >
            {isPlaying ? '⏸' : '▶'}
          </button>

          {/* Scrubber — extended past last trackpoint by one trail window so the tail can animate out */}
          <input
            type="range"
            min={0}
            max={trackpoints.length - 1 + Math.round(trackpoints.length * trailPercent / 100)}
            value={playbackIdx}
            onChange={(e) => {
              setIsPlaying(false);
              const idx = Number(e.target.value);
              setPlaybackIdx(idx);
              onPointHover?.(Math.min(idx, trackpoints.length - 1));
            }}
            className="flex-1 cursor-pointer accent-sky-500"
            style={{ height: '4px' }}
          />

          {/* Timestamp / progress */}
          <span className="text-xs text-sky-dusk tabular-nums shrink-0 w-20 text-right">
            {currentTimestamp}
          </span>
        </div>
      </div>

      {/* Attribution */}
      <div className="absolute bottom-11 right-2 text-[9px] text-gray-300 bg-black/30 px-1 rounded z-10">
        © CartoDB
      </div>
    </div>
  );
}
