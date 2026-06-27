import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  equipmentService,
  CreateEngineData,
  UpdateEngineData,
  CreateWingData,
  UpdateWingData,
  CreateParamotorData,
  UpdateParamotorData,
} from '../services/equipment.service';

const ENGINES_KEY = ['equipment', 'engines'] as const;
const WINGS_KEY = ['equipment', 'wings'] as const;
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
    onSuccess: () => qc.invalidateQueries({ queryKey: WINGS_KEY }),
  });
}

export function useDeleteWing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => equipmentService.deleteWing(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: WINGS_KEY }),
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
    onSuccess: () => qc.invalidateQueries({ queryKey: PARAMOTORS_KEY }),
  });
}

export function useDeleteParamotor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => equipmentService.deleteParamotor(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: PARAMOTORS_KEY }),
  });
}
