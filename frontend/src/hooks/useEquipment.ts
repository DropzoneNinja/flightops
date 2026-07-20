import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  equipmentService,
  CreateEngineData,
  UpdateEngineData,
  CreateWingData,
  UpdateWingData,
  CreateReserveData,
  UpdateReserveData,
  CreateParamotorData,
  UpdateParamotorData,
} from '../services/equipment.service';

const ENGINES_KEY = ['equipment', 'engines'] as const;
const WINGS_KEY = ['equipment', 'wings'] as const;
const RESERVES_KEY = ['equipment', 'reserves'] as const;
const PARAMOTORS_KEY = ['equipment', 'paramotors'] as const;

// ── Engines ──────────────────────────────────────────────────────────────────

export function useEngines() {
  return useQuery({ queryKey: ENGINES_KEY, queryFn: equipmentService.getEngines });
}

export function useCreateEngine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateEngineData) => equipmentService.createEngine(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ENGINES_KEY });
      qc.invalidateQueries({ queryKey: PARAMOTORS_KEY });
    },
  });
}

export function useUpdateEngine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateEngineData }) =>
      equipmentService.updateEngine(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ENGINES_KEY });
      qc.invalidateQueries({ queryKey: PARAMOTORS_KEY });
    },
  });
}

export function useDeleteEngine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => equipmentService.deleteEngine(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ENGINES_KEY });
      qc.invalidateQueries({ queryKey: PARAMOTORS_KEY });
    },
  });
}

// ── Wings ─────────────────────────────────────────────────────────────────────
// Wing mutations also invalidate paramotors: paramotor payloads embed the wing
// object inside each wing_link.

export function useWings() {
  return useQuery({ queryKey: WINGS_KEY, queryFn: equipmentService.getWings });
}

export function useCreateWing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateWingData) => equipmentService.createWing(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: WINGS_KEY }),
  });
}

export function useUpdateWing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateWingData }) =>
      equipmentService.updateWing(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: WINGS_KEY });
      qc.invalidateQueries({ queryKey: PARAMOTORS_KEY });
    },
  });
}

export function useDeleteWing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => equipmentService.deleteWing(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: WINGS_KEY });
      qc.invalidateQueries({ queryKey: PARAMOTORS_KEY });
    },
  });
}

// ── Reserves ──────────────────────────────────────────────────────────────────

export function useReserves() {
  return useQuery({ queryKey: RESERVES_KEY, queryFn: equipmentService.getReserves });
}

export function useCreateReserve() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateReserveData) => equipmentService.createReserve(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: RESERVES_KEY }),
  });
}

export function useUpdateReserve() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateReserveData }) =>
      equipmentService.updateReserve(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: RESERVES_KEY });
      qc.invalidateQueries({ queryKey: PARAMOTORS_KEY });
    },
  });
}

export function useDeleteReserve() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => equipmentService.deleteReserve(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: RESERVES_KEY });
      qc.invalidateQueries({ queryKey: PARAMOTORS_KEY });
    },
  });
}

// ── Paramotors ────────────────────────────────────────────────────────────────

export function useParamotors() {
  return useQuery({ queryKey: PARAMOTORS_KEY, queryFn: equipmentService.getParamotors });
}

export function useCreateParamotor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateParamotorData) => equipmentService.createParamotor(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: PARAMOTORS_KEY }),
  });
}

export function useUpdateParamotor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateParamotorData }) =>
      equipmentService.updateParamotor(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PARAMOTORS_KEY });
      // Re-pointing engine/reserve recomputes their hours server-side
      qc.invalidateQueries({ queryKey: ENGINES_KEY });
      qc.invalidateQueries({ queryKey: RESERVES_KEY });
    },
  });
}

export function useDeleteParamotor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => equipmentService.deleteParamotor(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PARAMOTORS_KEY });
      qc.invalidateQueries({ queryKey: ENGINES_KEY });
      qc.invalidateQueries({ queryKey: RESERVES_KEY });
    },
  });
}

// ── Maintenance records ───────────────────────────────────────────────────────
// One generic hook set covering all four record kinds; the varying date/type
// field names are handled by the MaintenanceRecordsSection config.

export type MaintenanceRecordKind =
  | 'engine-services'
  | 'wing-inspections'
  | 'reserve-packs'
  | 'reserve-inspections';

export interface MaintenanceRecord {
  id: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  [field: string]: unknown;
}

type RecordPayload = Record<string, string | undefined>;

interface RecordApi {
  list: (parentId: string) => Promise<MaintenanceRecord[]>;
  create: (parentId: string, data: RecordPayload) => Promise<MaintenanceRecord>;
  update: (parentId: string, recordId: string, data: RecordPayload) => Promise<MaintenanceRecord>;
  remove: (parentId: string, recordId: string) => Promise<void>;
}

// The concrete record types differ only in their date/type field names, so a
// single double-cast of the whole map beats casting every call site.
const RECORD_APIS = {
  'engine-services': {
    list: (id: string) => equipmentService.getEngineServices(id),
    create: (id: string, data: RecordPayload) =>
      equipmentService.createEngineService(id, {
        service_date: data.service_date as string,
        service_type: data.service_type as string,
        notes: data.notes,
      }),
    update: (id: string, recordId: string, data: RecordPayload) =>
      equipmentService.updateEngineService(id, recordId, data),
    remove: (id: string, recordId: string) => equipmentService.deleteEngineService(id, recordId),
  },
  'wing-inspections': {
    list: (id: string) => equipmentService.getWingInspections(id),
    create: (id: string, data: RecordPayload) =>
      equipmentService.createWingInspection(id, {
        inspection_date: data.inspection_date as string,
        inspection_type: data.inspection_type as string,
        notes: data.notes,
      }),
    update: (id: string, recordId: string, data: RecordPayload) =>
      equipmentService.updateWingInspection(id, recordId, data),
    remove: (id: string, recordId: string) => equipmentService.deleteWingInspection(id, recordId),
  },
  'reserve-packs': {
    list: (id: string) => equipmentService.getReservePacks(id),
    create: (id: string, data: RecordPayload) =>
      equipmentService.createReservePack(id, {
        pack_date: data.pack_date as string,
        notes: data.notes,
      }),
    update: (id: string, recordId: string, data: RecordPayload) =>
      equipmentService.updateReservePack(id, recordId, data),
    remove: (id: string, recordId: string) => equipmentService.deleteReservePack(id, recordId),
  },
  'reserve-inspections': {
    list: (id: string) => equipmentService.getReserveInspections(id),
    create: (id: string, data: RecordPayload) =>
      equipmentService.createReserveInspection(id, {
        inspection_date: data.inspection_date as string,
        inspection_type: data.inspection_type as string,
        notes: data.notes,
      }),
    update: (id: string, recordId: string, data: RecordPayload) =>
      equipmentService.updateReserveInspection(id, recordId, data),
    remove: (id: string, recordId: string) => equipmentService.deleteReserveInspection(id, recordId),
  },
} as unknown as Record<MaintenanceRecordKind, RecordApi>;

function recordsKey(kind: MaintenanceRecordKind, parentId: string) {
  return ['equipment', 'records', kind, parentId] as const;
}

export function useMaintenanceRecords(kind: MaintenanceRecordKind, parentId: string | null) {
  return useQuery({
    queryKey: recordsKey(kind, parentId ?? ''),
    queryFn: () => RECORD_APIS[kind].list(parentId as string),
    enabled: !!parentId,
  });
}

export function useCreateMaintenanceRecord(kind: MaintenanceRecordKind, parentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: RecordPayload) => RECORD_APIS[kind].create(parentId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: recordsKey(kind, parentId) }),
  });
}

export function useUpdateMaintenanceRecord(kind: MaintenanceRecordKind, parentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ recordId, data }: { recordId: string; data: RecordPayload }) =>
      RECORD_APIS[kind].update(parentId, recordId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: recordsKey(kind, parentId) }),
  });
}

export function useDeleteMaintenanceRecord(kind: MaintenanceRecordKind, parentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (recordId: string) => RECORD_APIS[kind].remove(parentId, recordId),
    onSuccess: () => qc.invalidateQueries({ queryKey: recordsKey(kind, parentId) }),
  });
}
