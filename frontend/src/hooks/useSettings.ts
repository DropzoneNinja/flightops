import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { settingsService, UpdateSettingData } from '../services/settings.service';

const SETTINGS_QUERY_KEY = ['settings'];
const SETTINGS_MAP_QUERY_KEY = ['settings', 'map'];
const DEFAULTS_QUERY_KEY = ['settings', 'defaults'];

export function useSettings() {
  const queryClient = useQueryClient();

  // Query: Get all settings
  const {
    data: settings = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: SETTINGS_QUERY_KEY,
    queryFn: () => settingsService.getAll(),
  });

  // Query: Get settings as map
  const {
    data: settingsMap = {},
    isLoading: isLoadingMap,
  } = useQuery({
    queryKey: SETTINGS_MAP_QUERY_KEY,
    queryFn: () => settingsService.getMap(),
  });

  // Query: Get default settings
  const {
    data: defaults = [],
    isLoading: isLoadingDefaults,
  } = useQuery({
    queryKey: DEFAULTS_QUERY_KEY,
    queryFn: () => settingsService.getDefaults(),
  });

  // Mutation: Update single setting
  const updateSettingMutation = useMutation({
    mutationFn: ({ key, data }: { key: string; data: UpdateSettingData }) =>
      settingsService.update(key, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SETTINGS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: SETTINGS_MAP_QUERY_KEY });
    },
  });

  // Mutation: Update multiple settings
  const updateManyMutation = useMutation({
    mutationFn: (settings: UpdateSettingData[]) =>
      settingsService.updateMany(settings),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SETTINGS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: SETTINGS_MAP_QUERY_KEY });
    },
  });

  // Mutation: Reset to defaults
  const resetToDefaultsMutation = useMutation({
    mutationFn: () => settingsService.resetToDefaults(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SETTINGS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: SETTINGS_MAP_QUERY_KEY });
    },
  });

  return {
    settings,
    settingsMap,
    defaults,
    isLoading,
    isLoadingMap,
    isLoadingDefaults,
    error,
    updateSettingMutation,
    updateManyMutation,
    resetToDefaultsMutation,
  };
}
