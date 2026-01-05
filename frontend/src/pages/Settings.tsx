import { useState, useMemo } from 'react';
import { useSettings } from '../hooks/useSettings';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { SettingType, UpdateSettingData } from '../services/settings.service';

export default function Settings() {
  const { settings, defaults, isLoading, updateManyMutation, resetToDefaultsMutation } =
    useSettings();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [editedValues, setEditedValues] = useState<Record<string, string>>({});
  const [hasChanges, setHasChanges] = useState(false);

  // Group settings by category
  const settingsByCategory = useMemo(() => {
    const grouped: Record<string, typeof settings> = {};

    settings.forEach((setting) => {
      const defaultSetting = defaults.find((d) => d.key === setting.setting_key);
      const category = defaultSetting?.category || 'Other';

      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(setting);
    });

    return grouped;
  }, [settings, defaults]);

  const handleValueChange = (key: string, value: string) => {
    setEditedValues((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    const updates: UpdateSettingData[] = Object.entries(editedValues).map(
      ([key, value]) => {
        const setting = settings.find((s) => s.setting_key === key);
        let parsedValue: string | number | boolean = value;

        if (setting?.setting_type === SettingType.NUMBER) {
          parsedValue = parseFloat(value);
        } else if (setting?.setting_type === SettingType.BOOLEAN) {
          parsedValue = value === 'true';
        }

        return {
          setting_key: key,
          setting_value: parsedValue,
          setting_type: setting?.setting_type || SettingType.STRING,
        };
      },
    );

    try {
      await updateManyMutation.mutateAsync(updates);
      setEditedValues({});
      setHasChanges(false);
      alert('Settings saved successfully!');
    } catch (error) {
      console.error('Failed to save settings:', error);
      alert('Failed to save settings. Please try again.');
    }
  };

  const handleReset = async () => {
    if (
      window.confirm(
        'Are you sure you want to reset all settings to defaults? This cannot be undone.',
      )
    ) {
      try {
        await resetToDefaultsMutation.mutateAsync();
        setEditedValues({});
        setHasChanges(false);
        alert('Settings reset to defaults successfully!');
      } catch (error) {
        console.error('Failed to reset settings:', error);
        alert('Failed to reset settings. Please try again.');
      }
    }
  };

  const handleCancel = () => {
    setEditedValues({});
    setHasChanges(false);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b-2 border-gray-200 z-10">
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="border-r-2 border-gray-300 pr-6 flex items-center gap-4">
              <img
                src="/logo.png"
                alt="Throttle Junkies"
                className="h-16 w-auto"
              />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
                <p className="text-sm text-gray-600">Configure PPG thresholds and preferences</p>
              </div>
            </div>
            <div className="flex items-center justify-end space-x-4 ml-auto">
              <span className="text-sm text-gray-600">{user?.email}</span>
              <button
                onClick={() => navigate('/')}
                className="px-4 py-2 bg-gray-600 text-white rounded-md text-sm font-medium hover:bg-gray-700 transition-colors"
              >
                Back to Map
              </button>
              <button
                onClick={logout}
                className="px-4 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Settings Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Action Buttons */}
        {hasChanges && (
          <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
            <div className="flex items-center justify-between">
              <p className="text-sm text-yellow-800">You have unsaved changes</p>
              <div className="flex gap-2">
                <button
                  onClick={handleCancel}
                  className="px-3 py-1 bg-white text-gray-700 rounded-md text-sm font-medium hover:bg-gray-100 border border-gray-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={updateManyMutation.isPending}
                  className="px-3 py-1 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {updateManyMutation.isPending ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="mb-6 flex justify-end">
          <button
            onClick={handleReset}
            disabled={resetToDefaultsMutation.isPending}
            className="px-4 py-2 bg-orange-600 text-white rounded-md text-sm font-medium hover:bg-orange-700 transition-colors disabled:opacity-50"
          >
            {resetToDefaultsMutation.isPending ? 'Resetting...' : 'Reset to Defaults'}
          </button>
        </div>

        {/* Settings by Category */}
        {Object.entries(settingsByCategory).map(([category, categorySettings]) => (
          <div key={category} className="mb-8 bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">{category}</h2>
            </div>
            <div className="px-6 py-4">
              <div className="space-y-4">
                {categorySettings.map((setting) => {
                  const defaultSetting = defaults.find((d) => d.key === setting.setting_key);
                  const currentValue = editedValues[setting.setting_key] ?? setting.setting_value;

                  return (
                    <div key={setting.id} className="flex items-center justify-between py-2">
                      <div className="flex-1">
                        <label
                          htmlFor={setting.setting_key}
                          className="block text-sm font-medium text-gray-700"
                        >
                          {defaultSetting?.description || setting.setting_key}
                        </label>
                        <p className="text-xs text-gray-500 mt-1">{setting.setting_key}</p>
                      </div>
                      <div className="flex items-center space-x-2">
                        {setting.setting_type === SettingType.BOOLEAN ? (
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              id={setting.setting_key}
                              type="checkbox"
                              checked={currentValue === 'true'}
                              onChange={(e) =>
                                handleValueChange(setting.setting_key, String(e.target.checked))
                              }
                              className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                          </label>
                        ) : (
                          <>
                            <input
                              id={setting.setting_key}
                              type={setting.setting_type === SettingType.NUMBER ? 'number' : 'text'}
                              value={currentValue}
                              onChange={(e) =>
                                handleValueChange(setting.setting_key, e.target.value)
                              }
                              className="w-32 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                              step={setting.setting_type === SettingType.NUMBER ? 'any' : undefined}
                            />
                            {setting.setting_type === SettingType.NUMBER && (
                              <span className="text-sm text-gray-500">
                                {setting.setting_key.includes('wind') || setting.setting_key.includes('gust')
                                  ? 'km/h'
                                  : setting.setting_key.includes('rain')
                                  ? 'mm/hr'
                                  : setting.setting_key.includes('frequency')
                                  ? 'hours'
                                  : ''}
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
