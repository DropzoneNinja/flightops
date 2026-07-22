import { useQuery } from '@tanstack/react-query';
import { missionsService } from '../services/missions.service';

const MISSIONS_QUERY_KEY = ['missions'];

export function useMissions() {
  const { data: missions = [], isLoading, error } = useQuery({
    queryKey: MISSIONS_QUERY_KEY,
    queryFn: () => missionsService.getAll(),
  });

  return { missions, isLoading, error };
}
