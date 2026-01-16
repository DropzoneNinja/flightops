import { api } from './api';

export type AirspaceClass = 'A' | 'C' | 'CTR' | 'D' | 'E' | 'G' | 'Q' | 'R' | 'RMZ';

export interface AirspaceProperties {
  class: AirspaceClass;
  name: string;
  lower: string;
  upper: string;
}

export interface AirspaceFeature {
  type: 'Feature';
  properties: AirspaceProperties;
  geometry: {
    type: 'Polygon' | 'MultiPolygon';
    coordinates: number[][][] | number[][][][];
  };
}

export interface AirspaceGeoJSON {
  type: 'FeatureCollection';
  features: AirspaceFeature[];
}

export const airspaceService = {
  /**
   * Get all airspace features as GeoJSON
   */
  async getAirspace(): Promise<AirspaceGeoJSON> {
    const response = await api.get<AirspaceGeoJSON>('/airspace');
    return response.data;
  },

  /**
   * Get available airspace classes
   */
  async getClasses(): Promise<AirspaceClass[]> {
    const response = await api.get<AirspaceClass[]>('/airspace/classes');
    return response.data;
  },

  /**
   * Get description for a specific airspace class
   */
  async getClassDescription(airspaceClass: AirspaceClass): Promise<{ class: string; description: string }> {
    const response = await api.get<{ class: string; description: string }>(
      `/airspace/class-description/${airspaceClass}`
    );
    return response.data;
  },
};
