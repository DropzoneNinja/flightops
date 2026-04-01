import type { Trackpoint, FlightEvent } from '../../services/flights.service';

/** A connecting line between two pilots at the same moment in time */
export interface PilotDistanceLine {
  fromLat: number;
  fromLon: number;
  fromElev?: number | null;
  toLat: number;
  toLon: number;
  toElev?: number | null;
  /** Straight-line horizontal distance in metres */
  distance_m: number;
  fromLabel: string;
  toLabel: string;
  fromColor?: [number, number, number];
  toColor?: [number, number, number];
}

/** Per-flight data for multi-flight comparison overlays */
export interface FlightData {
  id: string;
  trackpoints: Trackpoint[];
  events?: FlightEvent[];
  /** Display label (pilot name or flight title) */
  label?: string;
  /** Override color as [R, G, B] 0–255 for 3D rendering */
  color?: [number, number, number];
}

/**
 * Shared prop contract between FlightMap2D and FlightViewer3D.
 * Both viewers accept the same props so FlightAnalysis can swap them
 * without changing data flow. Designed for future CesiumJS swap-in.
 */
export interface FlightViewerProps {
  /** Primary flight trackpoints */
  trackpoints: Trackpoint[];
  /** Bounding box for auto-zoom/fit */
  bbox: { minLon: number; minLat: number; maxLon: number; maxLat: number } | null;
  /** Events for the primary flight */
  events?: FlightEvent[];
  /** Additional flights for multi-flight comparison overlay */
  flights?: FlightData[];
  /** Hover-highlighted trackpoint index (ephemeral, follows mouse) */
  activePointIndex?: number | null;
  onPointHover?: (index: number | null) => void;
  /** Click-pinned trackpoint index (persistent until changed) */
  pinnedPointIndex?: number | null;
  /** Callback when user clicks a point on the map */
  onPointClick?: (index: number) => void;
  /** Opacity for the vertical curtain wall (0–1, default 0.35) */
  wallOpacity?: number;
  /** Fraction of total flight length to show as trail behind the current position (0–100, default 100) */
  trailPercent?: number;
  /** Extra CSS classes for the outer wrapper */
  className?: string;
  /** Lines connecting pilots at the current time with distance labels */
  distanceLines?: PilotDistanceLine[];
  /**
   * Timezone flag from flight.timezone (set by the backend parser).
   * 'UTC'   → timestamps are true UTC; display by converting to browser local time.
   * 'local' → Gaggle wrote bare local times; stored as-is as UTC values; display
   *           using UTC clock getters without browser conversion.
   * Defaults to 'UTC' when omitted.
   */
  timezone?: string;
}
