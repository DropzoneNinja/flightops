import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { sitesService, CreateSiteData, UpdateSiteData } from '../services/sites.service';

const SITES_QUERY_KEY = ['sites'];

export function useSites() {
  const queryClient = useQueryClient();

  // Query: Get all sites
  const {
    data: sites = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: SITES_QUERY_KEY,
    queryFn: () => sitesService.getAll(),
  });

  // Mutation: Create site
  const createSiteMutation = useMutation({
    mutationFn: (data: CreateSiteData) => sitesService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SITES_QUERY_KEY });
    },
  });

  // Mutation: Update site
  const updateSiteMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateSiteData }) =>
      sitesService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SITES_QUERY_KEY });
    },
  });

  // Mutation: Delete site
  const deleteSiteMutation = useMutation({
    mutationFn: (id: string) => sitesService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SITES_QUERY_KEY });
    },
  });

  // Mutation: Toggle site enabled
  const toggleSiteEnabledMutation = useMutation({
    mutationFn: (id: string) => sitesService.toggleEnabled(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SITES_QUERY_KEY });
    },
  });

  return {
    sites,
    isLoading,
    error,
    createSiteMutation,
    updateSiteMutation,
    deleteSiteMutation,
    toggleSiteEnabledMutation,
  };
}
