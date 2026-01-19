import { api } from './api';

export interface PlotData {
  points: Array<{ lat: number; lon: number }>;
}

export interface FlightSite {
  id: string;
  user_id: string;
  name: string;
  takeoff_lat: number;
  takeoff_lon: number;
  parking_lat: number;
  parking_lon: number;
  takeoff_notes?: string;
  parking_notes?: string;
  weather_notes?: string;
  parking_address?: string;
  plot_data?: PlotData | null;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateSiteData {
  name: string;
  takeoff_lat: number;
  takeoff_lon: number;
  parking_lat: number;
  parking_lon: number;
  takeoff_notes?: string;
  parking_notes?: string;
  weather_notes?: string;
  plot_data?: PlotData | null;
}

export interface UpdateSiteData {
  name?: string;
  takeoff_lat?: number;
  takeoff_lon?: number;
  parking_lat?: number;
  parking_lon?: number;
  takeoff_notes?: string;
  parking_notes?: string;
  weather_notes?: string;
  plot_data?: PlotData | null;
}

export interface GeocodingResult {
  formattedAddress: string;
  displayName: string;
}

export const sitesService = {
  /**
   * Get all flight sites for the current user
   */
  async getAll(): Promise<FlightSite[]> {
    const response = await api.get<FlightSite[]>('/sites');
    return response.data;
  },

  /**
   * Get a single flight site by ID
   */
  async getById(id: string): Promise<FlightSite> {
    const response = await api.get<FlightSite>(`/sites/${id}`);
    return response.data;
  },

  /**
   * Create a new flight site
   */
  async create(data: CreateSiteData): Promise<FlightSite> {
    const response = await api.post<FlightSite>('/sites', data);
    return response.data;
  },

  /**
   * Update a flight site
   */
  async update(id: string, data: UpdateSiteData): Promise<FlightSite> {
    const response = await api.put<FlightSite>(`/sites/${id}`, data);
    return response.data;
  },

  /**
   * Delete a flight site
   */
  async delete(id: string): Promise<void> {
    await api.delete(`/sites/${id}`);
  },

  /**
   * Toggle site enabled status
   */
  async toggleEnabled(id: string): Promise<FlightSite> {
    const response = await api.patch<FlightSite>(`/sites/${id}/toggle`);
    return response.data;
  },

  /**
   * Reverse geocode coordinates to get nearest address
   */
  async reverseGeocode(lat: number, lon: number): Promise<GeocodingResult> {
    const response = await api.get<GeocodingResult>('/sites/geocode/reverse', {
      params: { lat, lon },
    });
    return response.data;
  },
};
