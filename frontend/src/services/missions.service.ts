import { api } from './api';

export interface Mission {
  id: string;
  name: string;
  notes: string | null;
  launch_site_id: string | null;
  launch_site?: { id: string; name: string; takeoff_lat: number; takeoff_lon: number } | null;
  waypoints?: MissionWaypoint[];
  avg_speed: number | null;
  avg_fuel_consumption: number | null;
  fuel_tank_size: number | null;
  wind_direction: number | null;
  wind_speed: number | null;
  created_by: string | null;
  creator?: { id: string; username: string | null } | null;
  created_at: string;
  updated_at: string;
}

export interface MissionWaypoint {
  id: string;
  mission_id: string;
  sort_order: number;
  latitude: number;
  longitude: number;
  altitude: number | null;
  planned_speed: number | null;
  leg_minutes: number | null;
  created_at: string;
  updated_at: string;
}

export interface CreateMissionData {
  name: string;
  notes?: string;
  launch_site_id?: string | null;
  avg_fuel_consumption?: number | null;
  fuel_tank_size?: number | null;
  wind_direction?: number | null;
  wind_speed?: number | null;
}

export interface UpdateMissionData {
  name?: string;
  notes?: string;
  launch_site_id?: string | null;
  avg_speed?: number | null;
  avg_fuel_consumption?: number | null;
  fuel_tank_size?: number | null;
  wind_direction?: number | null;
  wind_speed?: number | null;
}

export interface CreateWaypointData {
  latitude: number;
  longitude: number;
  altitude?: number | null;
  planned_speed?: number | null;
  leg_minutes?: number | null;
}

export interface UpdateWaypointData {
  latitude?: number;
  longitude?: number;
  altitude?: number | null;
  planned_speed?: number | null;
  leg_minutes?: number | null;
}

export interface MissionListParams {
  search?: string;
  launchSiteId?: string;
  sort?: 'updated_at' | 'name' | 'created_at';
  order?: 'ASC' | 'DESC';
}

export const missionsService = {
  async getAll(params: MissionListParams = {}): Promise<Mission[]> {
    const response = await api.get<Mission[]>('/missions', { params });
    return response.data;
  },

  async getById(id: string): Promise<Mission> {
    const response = await api.get<Mission>(`/missions/${id}`);
    return response.data;
  },

  async create(data: CreateMissionData): Promise<Mission> {
    const response = await api.post<Mission>('/missions', data);
    return response.data;
  },

  async update(id: string, data: UpdateMissionData): Promise<Mission> {
    const response = await api.put<Mission>(`/missions/${id}`, data);
    return response.data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/missions/${id}`);
  },

  async duplicate(id: string): Promise<Mission> {
    const response = await api.post<Mission>(`/missions/${id}/duplicate`);
    return response.data;
  },

  async getWaypoints(missionId: string): Promise<MissionWaypoint[]> {
    const response = await api.get<MissionWaypoint[]>(`/missions/${missionId}/waypoints`);
    return response.data;
  },

  async addWaypoint(missionId: string, data: CreateWaypointData): Promise<MissionWaypoint> {
    const response = await api.post<MissionWaypoint>(`/missions/${missionId}/waypoints`, data);
    return response.data;
  },

  async updateWaypoint(
    missionId: string,
    waypointId: string,
    data: UpdateWaypointData,
  ): Promise<MissionWaypoint> {
    const response = await api.put<MissionWaypoint>(
      `/missions/${missionId}/waypoints/${waypointId}`,
      data,
    );
    return response.data;
  },

  async deleteWaypoint(missionId: string, waypointId: string): Promise<void> {
    await api.delete(`/missions/${missionId}/waypoints/${waypointId}`);
  },

  async reorderWaypoints(missionId: string, waypointIds: string[]): Promise<MissionWaypoint[]> {
    const response = await api.post<MissionWaypoint[]>(
      `/missions/${missionId}/waypoints/reorder`,
      { waypoint_ids: waypointIds },
    );
    return response.data;
  },
};
