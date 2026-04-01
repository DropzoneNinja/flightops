import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  flightsService,
  pilotsService,
  CreateFlightData,
  UpdateFlightData,
} from '../services/flights.service';

export {
  type FlightScore,
  type FlightEvent,
  type FlightAnalysis,
  type PilotPerformanceData,
  type ScoreTrendPoint,
  type PersonalBest,
  type ComparisonResult,
  type ComparisonEntry,
} from '../services/flights.service';

const FLIGHTS_KEY = ['flights'];
const PILOTS_KEY = ['pilots'];

/** Get all flights for a date (YYYY-MM-DD). Polls while any flight is still parsing. */
export function useFlightsByDate(date: string | undefined) {
  const query = useQuery({
    queryKey: [...FLIGHTS_KEY, 'date', date],
    queryFn: () => flightsService.getFlightsByDate(date!),
    enabled: !!date,
    staleTime: 30 * 1000, // 30 seconds
    retry: 2,
    retryDelay: (i) => Math.min(1000 * 2 ** i, 30000),
    refetchInterval: (query) => {
      // Auto-poll every 3 seconds while any flight is still uploading/parsing
      const data = query.state.data;
      if (!data) return false;
      const hasPending = data.some(
        (f) => f.parse_status === 'uploaded' || f.parse_status === 'parsing',
      );
      return hasPending ? 3000 : false;
    },
  });
  return query;
}

/** Get a single flight by ID */
export function useFlightById(id: string | undefined) {
  return useQuery({
    queryKey: [...FLIGHTS_KEY, id],
    queryFn: () => flightsService.getFlightById(id!),
    enabled: !!id,
    staleTime: 60 * 1000,
    retry: 2,
    retryDelay: (i) => Math.min(1000 * 2 ** i, 30000),
  });
}

/** Upload a GPX file */
export function useFlightUpload(date: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      file,
      data,
      onProgress,
    }: {
      file: File;
      data: CreateFlightData;
      onProgress?: (pct: number) => void;
    }) => flightsService.uploadFlight(file, data, onProgress),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...FLIGHTS_KEY, 'date', date] });
    },
  });
}

/** Update flight metadata */
export function useFlightUpdate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateFlightData }) =>
      flightsService.updateFlight(id, data),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: [...FLIGHTS_KEY, 'date'] });
      queryClient.setQueryData([...FLIGHTS_KEY, updated.id], updated);
    },
  });
}

/** Delete a flight */
export function useFlightDelete(date: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => flightsService.deleteFlight(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...FLIGHTS_KEY, 'date', date] });
    },
  });
}

/** Get flight analysis (score + events). Only fetches when analysis_status is 'complete'. */
export function useFlightAnalysis(id: string | undefined) {
  return useQuery({
    queryKey: [...FLIGHTS_KEY, id, 'analysis'],
    queryFn: () => flightsService.getFlightAnalysis(id!),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
    retry: 2,
    retryDelay: (i) => Math.min(1000 * 2 ** i, 30000),
  });
}

/** Trigger re-analysis of a flight */
export function useFlightReanalyze() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => flightsService.reanalyzeFlight(id),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: [...FLIGHTS_KEY, id, 'analysis'] });
      queryClient.invalidateQueries({ queryKey: [...FLIGHTS_KEY, id] });
    },
  });
}

/** Compare multiple flights by ID */
export function useFlightCompare(flightIds: string[]) {
  return useQuery({
    queryKey: [...FLIGHTS_KEY, 'compare', flightIds.slice().sort().join(',')],
    queryFn: () => flightsService.compareFlights(flightIds),
    enabled: flightIds.length >= 2,
    staleTime: 5 * 60 * 1000,
    retry: 2,
    retryDelay: (i) => Math.min(1000 * 2 ** i, 30000),
  });
}

/** Get all pilots */
export function usePilots() {
  return useQuery({
    queryKey: PILOTS_KEY,
    queryFn: () => pilotsService.getPilots(),
    staleTime: 5 * 60 * 1000,
    retry: 2,
    retryDelay: (i) => Math.min(1000 * 2 ** i, 30000),
  });
}

/** Get a single pilot by ID */
export function usePilotById(id: string | undefined) {
  return useQuery({
    queryKey: [...PILOTS_KEY, id],
    queryFn: () => pilotsService.getPilotById(id!),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
    retry: 2,
    retryDelay: (i) => Math.min(1000 * 2 ** i, 30000),
  });
}

/** Get pilot performance data */
export function usePilotPerformance(id: string | undefined) {
  return useQuery({
    queryKey: [...PILOTS_KEY, id, 'performance'],
    queryFn: () => pilotsService.getPilotPerformance(id!),
    enabled: !!id,
    staleTime: 2 * 60 * 1000,
    retry: 2,
    retryDelay: (i) => Math.min(1000 * 2 ** i, 30000),
  });
}

/** Create a pilot */
export function usePilotCreate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (display_name: string) => pilotsService.createPilot(display_name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PILOTS_KEY });
    },
  });
}
