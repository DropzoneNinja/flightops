import { create } from 'zustand';
import { Mission, MissionWaypoint, missionsService, MissionListParams } from '../services/missions.service';

interface MissionsStore {
  missions: Mission[];
  selectedMission: Mission | null;
  loading: boolean;
  error: string | null;

  fetchMissions: (params?: MissionListParams) => Promise<void>;
  fetchMission: (id: string) => Promise<Mission>;
  createMission: (data: { name: string; notes?: string; launch_site_id?: string | null; avg_speed?: number | null; avg_fuel_consumption?: number | null; fuel_tank_size?: number | null; wind_direction?: number | null; wind_speed?: number | null }) => Promise<Mission>;
  updateMission: (id: string, data: { name?: string; notes?: string; launch_site_id?: string | null; avg_speed?: number | null; avg_fuel_consumption?: number | null; fuel_tank_size?: number | null; wind_direction?: number | null; wind_speed?: number | null }) => Promise<Mission>;
  deleteMission: (id: string) => Promise<void>;
  duplicateMission: (id: string) => Promise<Mission>;
  setSelectedMission: (mission: Mission | null) => void;

  addWaypoint: (missionId: string, lat: number, lon: number) => Promise<MissionWaypoint>;
  updateWaypoint: (missionId: string, waypointId: string, lat: number, lon: number) => Promise<MissionWaypoint>;
  deleteWaypoint: (missionId: string, waypointId: string) => Promise<void>;
  reorderWaypoints: (missionId: string, waypointIds: string[]) => Promise<void>;
}

export const useMissionsStore = create<MissionsStore>((set) => ({
  missions: [],
  selectedMission: null,
  loading: false,
  error: null,

  fetchMissions: async (params) => {
    set({ loading: true, error: null });
    try {
      const missions = await missionsService.getAll(params);
      set({ missions, loading: false });
    } catch (e) {
      set({ error: 'Failed to load missions', loading: false });
    }
  },

  fetchMission: async (id) => {
    const mission = await missionsService.getById(id);
    set({ selectedMission: mission });
    return mission;
  },

  createMission: async (data) => {
    const mission = await missionsService.create(data);
    set((s) => ({ missions: [mission, ...s.missions] }));
    return mission;
  },

  updateMission: async (id, data) => {
    const updated = await missionsService.update(id, data);
    set((s) => ({
      missions: s.missions.map((m) => (m.id === id ? updated : m)),
      selectedMission: s.selectedMission?.id === id ? updated : s.selectedMission,
    }));
    return updated;
  },

  deleteMission: async (id) => {
    await missionsService.delete(id);
    set((s) => ({
      missions: s.missions.filter((m) => m.id !== id),
      selectedMission: s.selectedMission?.id === id ? null : s.selectedMission,
    }));
  },

  duplicateMission: async (id) => {
    const copy = await missionsService.duplicate(id);
    set((s) => ({ missions: [copy, ...s.missions] }));
    return copy;
  },

  setSelectedMission: (mission) => set({ selectedMission: mission }),

  addWaypoint: async (missionId, lat, lon) => {
    const wp = await missionsService.addWaypoint(missionId, { latitude: Number(lat), longitude: Number(lon) });
    set((s) => {
      if (!s.selectedMission || s.selectedMission.id !== missionId) return s;
      return {
        selectedMission: {
          ...s.selectedMission,
          waypoints: [...(s.selectedMission.waypoints ?? []), wp],
        },
      };
    });
    return wp;
  },

  updateWaypoint: async (missionId, waypointId, lat, lon) => {
    const wp = await missionsService.updateWaypoint(missionId, waypointId, {
      latitude: lat,
      longitude: lon,
    });
    set((s) => {
      if (!s.selectedMission || s.selectedMission.id !== missionId) return s;
      return {
        selectedMission: {
          ...s.selectedMission,
          waypoints: (s.selectedMission.waypoints ?? []).map((w) => (w.id === waypointId ? wp : w)),
        },
      };
    });
    return wp;
  },

  deleteWaypoint: async (missionId, waypointId) => {
    await missionsService.deleteWaypoint(missionId, waypointId);
    set((s) => {
      if (!s.selectedMission || s.selectedMission.id !== missionId) return s;
      const remaining = (s.selectedMission.waypoints ?? [])
        .filter((w) => w.id !== waypointId)
        .map((w, i) => ({ ...w, sort_order: i }));
      return { selectedMission: { ...s.selectedMission, waypoints: remaining } };
    });
  },

  reorderWaypoints: async (missionId, waypointIds) => {
    const reordered = await missionsService.reorderWaypoints(missionId, waypointIds);
    set((s) => {
      if (!s.selectedMission || s.selectedMission.id !== missionId) return s;
      return { selectedMission: { ...s.selectedMission, waypoints: reordered } };
    });
  },
}));
