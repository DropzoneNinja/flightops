import { api } from './api';

export interface WeatherSnapshot {
  lat: number;
  lon: number;
  site_id: string | null;
  matched_site_name: string | null;
  observed_at: string | null;
  takeoff_at: string | null;
  temperature_c: number | null;
  wind_speed_kmh: number | null;
  wind_direction_deg: number | null;
  gust_speed_kmh: number | null;
  precipitation_mm: number | null;
  cloud_cover_pct: number | null;
  cloud_base_m: number | null;
  source: string;
}

export interface MediaRef {
  id: string;
  media_type: 'image' | 'video';
  original_filename: string;
  uploaded_by: string;
  thumbnail_url: string;
  file_url: string;
}

export interface GpxRef {
  flight_id: string;
  gpx_url: string;
  parse_status: string;
  analysis_status: string;
  bbox_json: unknown;
}

export interface LogbookEntry {
  id: string;
  pilot_id: string;
  client_id: string;
  source: 'flightnow' | 'manual' | 'web';
  flight_date: string;
  start_at: string | null;
  end_at: string | null;
  duration_seconds: number | null;
  distance_m: number | null;
  avg_speed_mps: number | null;
  max_speed_mps: number | null;
  max_altitude_m: number | null;
  avg_altitude_m: number | null;
  max_climb_mps: number | null;
  max_sink_mps: number | null;
  takeoff_lat: number | null;
  takeoff_lon: number | null;
  landing_lat: number | null;
  landing_lon: number | null;
  launch_site_name: string | null;
  landing_site_name: string | null;
  title: string | null;
  notes: string | null;
  wing: string | null;
  engine: string | null;
  paramotor: string | null;
  fuel_start_litres: number | null;
  fuel_used_litres: number | null;
  battery_start_percent: number | null;
  battery_used_percent: number | null;
  category: string | null;
  flight_purpose: string | null;
  route_name: string | null;
  rating: number | null;
  weather_snapshot: WeatherSnapshot | null;
  weather_source: string | null;
  flight_number: number | null;
  flight_number_override: number | null;
  revision: number;
  client_updated_at: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  gpx: GpxRef | null;
  media: MediaRef[];
  analyzed_duration_seconds: number | null;
  analyzed_distance_m: number | null;
  analyzed_max_altitude_m: number | null;
  analyzed_max_speed_mps: number | null;
}

export interface CreateLogbookEntryData {
  flight_date: string;
  start_at?: string;
  end_at?: string;
  client_id?: string;
  title?: string;
  notes?: string;
  launch_site_name?: string;
  landing_site_name?: string;
  category?: string;
  flight_purpose?: string;
  route_name?: string;
  rating?: number;
  wing?: string;
  engine?: string;
  paramotor?: string;
  fuel_start_litres?: number;
  fuel_used_litres?: number;
  battery_start_percent?: number;
  battery_used_percent?: number;
  /** Manual flight duration in seconds. Overridden by GPX analysis for display. */
  duration_seconds?: number;
  /** Manual max altitude in metres. Overridden by GPX analysis for display. */
  max_altitude_m?: number;
  /** Manual max speed in m/s. Overridden by GPX analysis for display. */
  max_speed_mps?: number;
  /** Manual total distance in metres. Overridden by GPX analysis for display. */
  distance_m?: number;
}

export type UpdateLogbookEntryData = Partial<CreateLogbookEntryData> & {
  flight_id?: string;
  flight_number_override?: number | null;
};

export interface LogbookBaseline {
  prior_flights: number;
  prior_duration_seconds: number | null;
  prior_distance_m: number | null;
  notes: string | null;
  updated_at: string;
}

export interface UpsertLogbookBaselineData {
  prior_flights?: number;
  prior_duration_seconds?: number | null;
  prior_distance_m?: number | null;
  notes?: string | null;
}

export interface OrphanedFlight {
  id: string;
  flight_date: string;
  title: string | null;
  start_at: string | null;
  duration_seconds: number | null;
  total_distance_m: number | null;
  max_altitude_m: number | null;
  parse_status: string;
}

const BASE = '/logbook';

export const logbookService = {
  async getLogbook(params?: { from?: string; to?: string }): Promise<LogbookEntry[]> {
    const res = await api.get<LogbookEntry[]>(BASE, { params });
    return res.data;
  },

  async getEntry(id: string): Promise<LogbookEntry> {
    const res = await api.get<LogbookEntry>(`${BASE}/${id}`);
    return res.data;
  },

  async createEntry(data: CreateLogbookEntryData): Promise<LogbookEntry> {
    const res = await api.post<LogbookEntry>(BASE, data);
    return res.data;
  },

  async updateEntry(id: string, data: UpdateLogbookEntryData): Promise<LogbookEntry> {
    const res = await api.patch<LogbookEntry>(`${BASE}/${id}`, data);
    return res.data;
  },

  async deleteEntry(id: string): Promise<{ id: string; deleted_at: string }> {
    const res = await api.delete<{ id: string; deleted_at: string }>(`${BASE}/${id}`);
    return res.data;
  },

  async downloadPdf(params?: { from?: string; to?: string }): Promise<Blob> {
    const res = await api.get(`${BASE}/pdf`, {
      params,
      responseType: 'blob',
    });
    return res.data;
  },

  async getOrphanedFlights(): Promise<OrphanedFlight[]> {
    const res = await api.get<OrphanedFlight[]>(`${BASE}/orphaned-flights`);
    return res.data;
  },

  async importFlightToLogbook(flightId: string): Promise<LogbookEntry> {
    const res = await api.post<LogbookEntry>(`${BASE}/orphaned-flights/${flightId}/import`);
    return res.data;
  },

  async getBaseline(): Promise<LogbookBaseline | null> {
    const res = await api.get<LogbookBaseline | null>(`${BASE}/baseline`);
    return res.data;
  },

  async upsertBaseline(data: UpsertLogbookBaselineData): Promise<LogbookBaseline> {
    const res = await api.put<LogbookBaseline>(`${BASE}/baseline`, data);
    return res.data;
  },
};
