import { api } from './api';

export type ParseStatus = 'uploaded' | 'parsing' | 'analyzed' | 'failed';
export type AnalysisStatus = 'pending' | 'running' | 'complete' | 'failed';

/** Normalized trackpoint as stored in flights.trackpoints_json after parse/analysis */
export interface Trackpoint {
  seq: number;
  lat: number;
  lon: number;
  elevation_m: number | null;
  timestamp: string | null; // ISO string (serialized from Date)
  speed_mps: number | null;
  vertical_speed_mps: number | null;
  heading_deg: number | null;
  phase: string; // e.g. 'pre_takeoff' | 'takeoff' | 'climb' | 'cruise' | 'turn' | 'descent' | 'approach' | 'landing' | 'post_landing' | 'unknown'
  estimated: boolean;
  noise_flag: boolean;
  // Gaggle app telemetry (optional)
  gaggle_speed_mps?: number;
  gaggle_climb_rate_mps?: number;
  gaggle_agl_m?: number;
  gaggle_g_force?: number;
}

export interface FlightEvent {
  id: string;
  flight_id: string;
  event_type: string;
  timestamp: string | null;
  seq_start: number | null;
  seq_end: number | null;
  lon: number | null;
  lat: number | null;
  elevation_m: number | null;
  confidence: number;
  payload_json: Record<string, unknown> | null;
}

export interface FlightScore {
  id: string;
  flight_id: string;
  scoring_version: string;
  overall_score: number;
  takeoff_score: number | null;
  climb_score: number | null;
  level_score: number | null;
  turn_score: number | null;
  descent_score: number | null;
  landing_score: number | null;
  smoothness_score: number | null;
  safety_score: number | null;
  explanation_json: string[];
  created_at: string;
}

export interface FlightAnalysis {
  score: FlightScore | null;
  events: FlightEvent[];
}

export interface Pilot {
  id: string;
  display_name: string;
  slug: string;
  avatar_url: string | null;
  user_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface FlightSiteRef {
  id: string;
  name: string;
  takeoff_lat: number;
  takeoff_lon: number;
}

export interface Flight {
  id: string;
  flight_date: string;
  site_id: string | null;
  pilot_id: string | null;
  title: string | null;
  notes: string | null;
  launch_site_name: string | null;
  landing_site_name: string | null;
  glider: string | null;
  harness: string | null;
  timezone: string;
  original_filename: string;
  storage_key: string;
  file_size: number;
  parse_status: ParseStatus;
  analysis_status: AnalysisStatus;
  analysis_version: string | null;
  start_at: string | null;
  end_at: string | null;
  duration_seconds: number | null;
  total_distance_m: number | null;
  max_altitude_m: number | null;
  min_altitude_m: number | null;
  altitude_gain_m: number | null;
  altitude_loss_m: number | null;
  avg_speed_mps: number | null;
  max_speed_mps: number | null;
  max_climb_mps: number | null;
  max_descent_mps: number | null;
  trackpoint_count: number | null;
  segment_count: number | null;
  bbox_json: { minLon: number; minLat: number; maxLon: number; maxLat: number } | null;
  confidence_score: number | null;
  summary_json: Record<string, unknown> | null;
  trackpoints_json: Trackpoint[] | null;
  pilot: Pilot | null;
  site: FlightSiteRef | null;
  uploaded_by: string;
  created_at: string;
  updated_at: string;
}

export interface NormalizedComparisonPoint {
  t: number | null;
  lat: number;
  lon: number;
  elevation_m: number | null;
  speed_mps: number | null;
  vertical_speed_mps: number | null;
  phase: string;
}

export interface ComparisonEntry {
  flight_id: string;
  flight_date: string;
  title: string | null;
  pilot: Pilot | null;
  glider: string | null;
  duration_seconds: number | null;
  total_distance_m: number | null;
  max_altitude_m: number | null;
  max_speed_mps: number | null;
  max_climb_mps: number | null;
  confidence_score: number | null;
  trackpoints: NormalizedComparisonPoint[];
}

export interface ComparisonResult {
  flights: ComparisonEntry[];
}

export interface ScoreTrendPoint {
  flight_id: string;
  flight_date: string;
  overall_score: number;
  takeoff_score: number | null;
  climb_score: number | null;
  level_score: number | null;
  turn_score: number | null;
  descent_score: number | null;
  landing_score: number | null;
  smoothness_score: number | null;
  safety_score: number | null;
}

export interface PersonalBest {
  category: string;
  value: number;
  flight_id: string;
  flight_date: string;
}

export interface PilotPerformanceData {
  pilot: Pilot;
  total_flights: number;
  recent_flights: Flight[];
  score_trend: ScoreTrendPoint[];
  personal_bests: PersonalBest[];
  rolling_30d_avg: number | null;
}

export interface CreateFlightData {
  flight_date: string;
  site_id?: string;
  pilot_id?: string;
  title?: string;
  notes?: string;
  launch_site_name?: string;
  glider?: string;
  harness?: string;
}

export interface UpdateFlightData {
  pilot_id?: string;
  site_id?: string;
  title?: string;
  notes?: string;
  launch_site_name?: string;
  landing_site_name?: string;
  glider?: string;
  harness?: string;
}

export const flightsService = {
  /** Upload a GPX file to a flight day */
  async uploadFlight(
    file: File,
    data: CreateFlightData,
    onProgress?: (pct: number) => void,
  ): Promise<Flight> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('flight_date', data.flight_date);
    if (data.site_id) formData.append('site_id', data.site_id);
    if (data.pilot_id) formData.append('pilot_id', data.pilot_id);
    if (data.title) formData.append('title', data.title);
    if (data.notes) formData.append('notes', data.notes);
    if (data.launch_site_name) formData.append('launch_site_name', data.launch_site_name);
    if (data.glider) formData.append('glider', data.glider);
    if (data.harness) formData.append('harness', data.harness);

    const response = await api.post<Flight>('/flights', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (event) => {
        if (onProgress && event.total) {
          onProgress(Math.round((event.loaded / event.total) * 100));
        }
      },
    });
    return response.data;
  },

  /** Get all flights for a given date (YYYY-MM-DD) */
  async getFlightsByDate(date: string): Promise<Flight[]> {
    const response = await api.get<Flight[]>('/flights', { params: { date } });
    return response.data;
  },

  /** Get a single flight by ID */
  async getFlightById(id: string): Promise<Flight> {
    const response = await api.get<Flight>(`/flights/${id}`);
    return response.data;
  },

  /** Update flight metadata */
  async updateFlight(id: string, data: UpdateFlightData): Promise<Flight> {
    const response = await api.patch<Flight>(`/flights/${id}`, data);
    return response.data;
  },

  /** Delete a flight */
  async deleteFlight(id: string): Promise<void> {
    await api.delete(`/flights/${id}`);
  },

  /** Get analysis result (score + events) for a flight */
  async getFlightAnalysis(id: string): Promise<FlightAnalysis> {
    const response = await api.get<FlightAnalysis>(`/flights/${id}/analysis`);
    return response.data;
  },

  /** Trigger re-analysis of an already-parsed flight */
  async reanalyzeFlight(id: string): Promise<void> {
    await api.post(`/flights/${id}/reanalyze`);
  },

  /** Compare multiple flights — returns normalized trackpoints + stats per flight */
  async compareFlights(flightIds: string[]): Promise<ComparisonResult> {
    const response = await api.post<ComparisonResult>('/flights/compare', { flight_ids: flightIds });
    return response.data;
  },
};

export const sitesService = {
  /** Find sites whose takeoff point is within radius metres of the given coordinates */
  async getSitesNear(lat: number, lon: number, radius = 1000): Promise<FlightSiteRef[]> {
    const response = await api.get<FlightSiteRef[]>('/sites/near', { params: { lat, lon, radius } });
    return response.data;
  },
};

export const pilotsService = {
  /** Get all pilots */
  async getPilots(): Promise<Pilot[]> {
    const response = await api.get<Pilot[]>('/pilots');
    return response.data;
  },

  /** Get a single pilot by ID */
  async getPilotById(id: string): Promise<Pilot> {
    const response = await api.get<Pilot>(`/pilots/${id}`);
    return response.data;
  },

  /** Create a new pilot */
  async createPilot(display_name: string): Promise<Pilot> {
    const response = await api.post<Pilot>('/pilots', { display_name });
    return response.data;
  },

  /** Get pilot performance data (score trends, personal bests, recent flights) */
  async getPilotPerformance(id: string): Promise<PilotPerformanceData> {
    const response = await api.get<PilotPerformanceData>(`/pilots/${id}/performance`);
    return response.data;
  },
};
