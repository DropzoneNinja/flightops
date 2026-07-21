import { api } from './api';

export interface EquipmentEngine {
  id: string;
  user_id: string;
  name: string;
  base_hours: number;
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
  color: string | null;
  base_hours: number;
  total_hours: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface EquipmentReserve {
  id: string;
  user_id: string;
  name: string;
  manufacturer: string | null;
  model: string | null;
  size: string | null;
  base_hours: number;
  total_hours: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ParamotorWingLink {
  id: string;
  paramotor_id: string;
  wing_id: string;
  fuel_burn_lph: number | null;
  wing: EquipmentWing;
}

export interface EquipmentParamotor {
  id: string;
  user_id: string;
  name: string;
  engine_id: string | null;
  engine: EquipmentEngine | null;
  reserve_id: string | null;
  reserve: EquipmentReserve | null;
  tank_size_litres: number | null;
  wing_links: ParamotorWingLink[];
  base_hours: number;
  total_hours: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface EngineServiceRecord {
  id: string;
  engine_id: string;
  service_date: string;
  service_type: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface WingInspectionRecord {
  id: string;
  wing_id: string;
  inspection_date: string;
  inspection_type: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReservePackRecord {
  id: string;
  reserve_id: string;
  pack_date: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReserveInspectionRecord {
  id: string;
  reserve_id: string;
  inspection_date: string;
  inspection_type: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type CreateEngineData = Pick<EquipmentEngine, 'name'> &
  Partial<Pick<EquipmentEngine, 'base_hours' | 'total_hours' | 'notes'>>;

// updated_at: pass back exactly what you last fetched to enable the server's
// optimistic-concurrency check — a stale value gets rejected with 409 instead
// of silently overwriting a change made elsewhere (e.g. another device).
export type UpdateEngineData = Partial<CreateEngineData> & { updated_at?: string };

export type CreateWingData = Pick<EquipmentWing, 'name'> &
  Partial<Pick<EquipmentWing, 'manufacturer' | 'model' | 'size' | 'trim_speed_kmh' | 'color' | 'base_hours' | 'total_hours' | 'notes'>>;

export type UpdateWingData = Partial<CreateWingData> & { updated_at?: string };

export type CreateReserveData = Pick<EquipmentReserve, 'name'> &
  Partial<Pick<EquipmentReserve, 'manufacturer' | 'model' | 'size' | 'base_hours' | 'total_hours' | 'notes'>>;

export type UpdateReserveData = Partial<CreateReserveData> & { updated_at?: string };

export interface ParamotorWingLinkData {
  wing_id: string;
  fuel_burn_lph?: number | null;
}

export type CreateParamotorData = Pick<EquipmentParamotor, 'name'> &
  Partial<Pick<EquipmentParamotor, 'engine_id' | 'reserve_id' | 'tank_size_litres' | 'base_hours' | 'total_hours' | 'notes'>> & {
    // Omitted = leave links untouched (update); [] = clear; array = full replace
    wings?: ParamotorWingLinkData[];
  };

export type UpdateParamotorData = Partial<CreateParamotorData> & { updated_at?: string };

export type CreateEngineServiceRecordData = Pick<EngineServiceRecord, 'service_date' | 'service_type'> &
  Partial<Pick<EngineServiceRecord, 'notes'>>;

export type CreateWingInspectionRecordData = Pick<WingInspectionRecord, 'inspection_date' | 'inspection_type'> &
  Partial<Pick<WingInspectionRecord, 'notes'>>;

export type CreateReservePackRecordData = Pick<ReservePackRecord, 'pack_date'> &
  Partial<Pick<ReservePackRecord, 'notes'>>;

export type CreateReserveInspectionRecordData = Pick<ReserveInspectionRecord, 'inspection_date' | 'inspection_type'> &
  Partial<Pick<ReserveInspectionRecord, 'notes'>>;

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

  // Reserves
  async getReserves(): Promise<EquipmentReserve[]> {
    const res = await api.get<EquipmentReserve[]>('/equipment/reserves');
    return res.data;
  },
  async createReserve(data: CreateReserveData): Promise<EquipmentReserve> {
    const res = await api.post<EquipmentReserve>('/equipment/reserves', data);
    return res.data;
  },
  async updateReserve(id: string, data: UpdateReserveData): Promise<EquipmentReserve> {
    const res = await api.put<EquipmentReserve>(`/equipment/reserves/${id}`, data);
    return res.data;
  },
  async deleteReserve(id: string): Promise<void> {
    await api.delete(`/equipment/reserves/${id}`);
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

  // Engine service records
  async getEngineServices(engineId: string): Promise<EngineServiceRecord[]> {
    const res = await api.get<EngineServiceRecord[]>(`/equipment/engines/${engineId}/services`);
    return res.data;
  },
  async createEngineService(engineId: string, data: CreateEngineServiceRecordData): Promise<EngineServiceRecord> {
    const res = await api.post<EngineServiceRecord>(`/equipment/engines/${engineId}/services`, data);
    return res.data;
  },
  async updateEngineService(engineId: string, recordId: string, data: Partial<CreateEngineServiceRecordData>): Promise<EngineServiceRecord> {
    const res = await api.put<EngineServiceRecord>(`/equipment/engines/${engineId}/services/${recordId}`, data);
    return res.data;
  },
  async deleteEngineService(engineId: string, recordId: string): Promise<void> {
    await api.delete(`/equipment/engines/${engineId}/services/${recordId}`);
  },

  // Wing inspection records
  async getWingInspections(wingId: string): Promise<WingInspectionRecord[]> {
    const res = await api.get<WingInspectionRecord[]>(`/equipment/wings/${wingId}/inspections`);
    return res.data;
  },
  async createWingInspection(wingId: string, data: CreateWingInspectionRecordData): Promise<WingInspectionRecord> {
    const res = await api.post<WingInspectionRecord>(`/equipment/wings/${wingId}/inspections`, data);
    return res.data;
  },
  async updateWingInspection(wingId: string, recordId: string, data: Partial<CreateWingInspectionRecordData>): Promise<WingInspectionRecord> {
    const res = await api.put<WingInspectionRecord>(`/equipment/wings/${wingId}/inspections/${recordId}`, data);
    return res.data;
  },
  async deleteWingInspection(wingId: string, recordId: string): Promise<void> {
    await api.delete(`/equipment/wings/${wingId}/inspections/${recordId}`);
  },

  // Reserve pack records
  async getReservePacks(reserveId: string): Promise<ReservePackRecord[]> {
    const res = await api.get<ReservePackRecord[]>(`/equipment/reserves/${reserveId}/packs`);
    return res.data;
  },
  async createReservePack(reserveId: string, data: CreateReservePackRecordData): Promise<ReservePackRecord> {
    const res = await api.post<ReservePackRecord>(`/equipment/reserves/${reserveId}/packs`, data);
    return res.data;
  },
  async updateReservePack(reserveId: string, recordId: string, data: Partial<CreateReservePackRecordData>): Promise<ReservePackRecord> {
    const res = await api.put<ReservePackRecord>(`/equipment/reserves/${reserveId}/packs/${recordId}`, data);
    return res.data;
  },
  async deleteReservePack(reserveId: string, recordId: string): Promise<void> {
    await api.delete(`/equipment/reserves/${reserveId}/packs/${recordId}`);
  },

  // Reserve inspection records
  async getReserveInspections(reserveId: string): Promise<ReserveInspectionRecord[]> {
    const res = await api.get<ReserveInspectionRecord[]>(`/equipment/reserves/${reserveId}/inspections`);
    return res.data;
  },
  async createReserveInspection(reserveId: string, data: CreateReserveInspectionRecordData): Promise<ReserveInspectionRecord> {
    const res = await api.post<ReserveInspectionRecord>(`/equipment/reserves/${reserveId}/inspections`, data);
    return res.data;
  },
  async updateReserveInspection(reserveId: string, recordId: string, data: Partial<CreateReserveInspectionRecordData>): Promise<ReserveInspectionRecord> {
    const res = await api.put<ReserveInspectionRecord>(`/equipment/reserves/${reserveId}/inspections/${recordId}`, data);
    return res.data;
  },
  async deleteReserveInspection(reserveId: string, recordId: string): Promise<void> {
    await api.delete(`/equipment/reserves/${reserveId}/inspections/${recordId}`);
  },
};
