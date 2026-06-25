import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  logbookService,
  CreateLogbookEntryData,
  UpdateLogbookEntryData,
} from '../services/logbook.service';

export type { LogbookEntry, WeatherSnapshot, MediaRef, GpxRef, OrphanedFlight } from '../services/logbook.service';

export const LOGBOOK_IMPORT_PROMPT_KEY = 'logbook_import_prompt_shown';

const LOGBOOK_KEY = ['logbook'];

export function useLogbook(params?: { from?: string; to?: string }) {
  return useQuery({
    queryKey: [...LOGBOOK_KEY, 'list', params?.from, params?.to],
    queryFn: () => logbookService.getLogbook(params),
    staleTime: 60 * 1000,
    retry: 2,
    retryDelay: (i) => Math.min(1000 * 2 ** i, 30000),
  });
}

export function useLogbookEntry(id: string | undefined) {
  return useQuery({
    queryKey: [...LOGBOOK_KEY, id],
    queryFn: () => logbookService.getEntry(id!),
    enabled: !!id,
    staleTime: 60 * 1000,
    retry: 2,
    retryDelay: (i) => Math.min(1000 * 2 ** i, 30000),
  });
}

export function useCreateLogbookEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateLogbookEntryData) => logbookService.createEntry(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...LOGBOOK_KEY, 'list'] });
    },
  });
}

export function useUpdateLogbookEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateLogbookEntryData }) =>
      logbookService.updateEntry(id, data),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: [...LOGBOOK_KEY, 'list'] });
      queryClient.setQueryData([...LOGBOOK_KEY, updated.id], updated);
    },
  });
}

export function useDeleteLogbookEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => logbookService.deleteEntry(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...LOGBOOK_KEY, 'list'] });
    },
  });
}

export function useOrphanedFlights() {
  const alreadyShown = localStorage.getItem(LOGBOOK_IMPORT_PROMPT_KEY) === 'true';
  return useQuery({
    queryKey: [...LOGBOOK_KEY, 'orphaned-flights'],
    queryFn: () => logbookService.getOrphanedFlights(),
    enabled: !alreadyShown,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

export function useImportFlightToLogbook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (flightId: string) => logbookService.importFlightToLogbook(flightId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...LOGBOOK_KEY, 'list'] });
    },
  });
}
