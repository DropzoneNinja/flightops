import { api } from './api';

export interface EquipmentEngine {
  id: string;
  user_id: string;
  name: string;
  tank_size_litres: number | null;
  fuel_consumption_lph: number | null;
  total_hours: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface EquipmentWing {
  id: string;
  user_id: string;
  name: string;
  manufacturer: string | null;
  model: string | null;
  size: string | null;
  trim_speed_kmh: number | null;
  total_hours: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface EquipmentParamotor {
  id: string;
  user_id: string;
  name: string;
  engine_id: string | null;
  engine: EquipmentEngine | null;
  total_hours: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type CreateEngineData = Pick<EquipmentEngine, 'name'> &
  Partial<Pick<EquipmentEngine, 'tank_size_litres' | 'fuel_consumption_lph' | 'total_hours' | 'notes'>>;

export type UpdateEngineData = Partial<CreateEngineData>;

export type CreateWingData = Pick<EquipmentWing, 'name'> &
  Partial<Pick<EquipmentWing, 'manufacturer' | 'model' | 'size' | 'trim_speed_kmh' | 'total_hours' | 'notes'>>;

export type UpdateWingData = Partial<CreateWingData>;

export type CreateParamotorData = Pick<EquipmentParamotor, 'name'> &
  Partial<Pick<EquipmentParamotor, 'engine_id' | 'total_hours' | 'notes'>>;

export type UpdateParamotorData = Partial<CreateParamotorData>;

export const equipmentService = {
  // Engines
  async getEngines(): Promise<EquipmentEngine[]> {
    const res = await api.get<EquipmentEngine[]>('/equipment/engines');
    return res.data;
  },
  async createEngine(data: CreateEngineData): Promise<EquipmentEngine> {
    const res = await api.post<EquipmentEngine>('/equipment/engines', data);
    return res.data;
  },
  async updateEngine(id: string, data: UpdateEngineData): Promise<EquipmentEngine> {
    const res = await api.put<EquipmentEngine>(`/equipment/engines/${id}`, data);
    return res.data;
  },
  async deleteEngine(id: string): Promise<void> {
    await api.delete(`/equipment/engines/${id}`);
  },

  // Wings
  async getWings(): Promise<EquipmentWing[]> {
    const res = await api.get<EquipmentWing[]>('/equipment/wings');
    return res.data;
  },
  async createWing(data: CreateWingData): Promise<EquipmentWing> {
    const res = await api.post<EquipmentWing>('/equipment/wings', data);
    return res.data;
  },
  async updateWing(id: string, data: UpdateWingData): Promise<EquipmentWing> {
    const res = await api.put<EquipmentWing>(`/equipment/wings/${id}`, data);
    return res.data;
  },
  async deleteWing(id: string): Promise<void> {
    await api.delete(`/equipment/wings/${id}`);
  },

  // Paramotors
  async getParamotors(): Promise<EquipmentParamotor[]> {
    const res = await api.get<EquipmentParamotor[]>('/equipment/paramotors');
    return res.data;
  },
  async createParamotor(data: CreateParamotorData): Promise<EquipmentParamotor> {
    const res = await api.post<EquipmentParamotor>('/equipment/paramotors', data);
    return res.data;
  },
  async updateParamotor(id: string, data: UpdateParamotorData): Promise<EquipmentParamotor> {
    const res = await api.put<EquipmentParamotor>(`/equipment/paramotors/${id}`, data);
    return res.data;
  },
  async deleteParamotor(id: string): Promise<void> {
    await api.delete(`/equipment/paramotors/${id}`);
  },
};
