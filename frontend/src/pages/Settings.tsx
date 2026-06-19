import { useState, useMemo, useEffect, useRef } from 'react';
import { version } from '../../package.json';
import { useSettings } from '../hooks/useSettings';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { SettingType, UpdateSettingData } from '../services/settings.service';
import { preAuthorizedEmailsService, PreAuthorizedEmail } from '../services/pre-authorized-emails.service';
import { usersService, UserData, AlbumStatRow } from '../services/users.service';
import { weatherService, WeatherApiStats } from '../services/weather.service';
import { openSkyService, OpenSkyStats } from '../services/opensky.service';
import { useSites } from '../hooks/useSites';
import { backupService, BackupStatus, BackupFileInfo } from '../services/backup.service';
import { RestoreModal } from '../components/RestoreModal';
import { mediaService } from '../services/media.service';
import { api } from '../services/api';

export default function Settings() {
  const { settings, defaults, isLoading, updateManyMutation, resetToDefaultsMutation } =
    useSettings();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [editedValues, setEditedValues] = useState<Record<string, string>>({});
  const [hasChanges, setHasChanges] = useState(false);

  // Pre-authorized emails state (admin only)
  const [preAuthEmails, setPreAuthEmails] = useState<PreAuthorizedEmail[]>([]);
  const [loadingEmails, setLoadingEmails] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [emailError, setEmailError] = useState('');

  // Current users state (admin only)
  const [users, setUsers] = useState<UserData[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Album stats state (admin only)
  const [albumStats, setAlbumStats] = useState<AlbumStatRow[]>([]);
  const [loadingAlbumStats, setLoadingAlbumStats] = useState(false);

  // Weather API stats state (admin only)
  const [weatherStats, setWeatherStats] = useState<WeatherApiStats | null>(null);
  const [loadingWeatherStats, setLoadingWeatherStats] = useState(false);

  // OpenSky API stats state (admin only)
  const [openSkyStats, setOpenSkyStats] = useState<OpenSkyStats | null>(null);
  const [loadingOpenSkyStats, setLoadingOpenSkyStats] = useState(false);

  // Backup state (admin only)
  const [backupStatus, setBackupStatus] = useState<BackupStatus | null>(null);
  const [loadingBackupStatus, setLoadingBackupStatus] = useState(false);
  const [triggeringBackup, setTriggeringBackup] = useState(false);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [backupFiles, setBackupFiles] = useState<BackupFileInfo[]>([]);
  const [loadingBackupFiles, setLoadingBackupFiles] = useState(false);

  // Fetch weather state (admin only)
  const [isFetchingWeather, setIsFetchingWeather] = useState(false);

  // Thumbnail regeneration state (admin only)
  const [regeneratingThumbnails, setRegeneratingThumbnails] = useState(false);
  const [thumbnailResult, setThumbnailResult] = useState<{
    processed: number;
    succeeded: number;
    failed: number;
  } | null>(null);

  // Sites management (admin only)
  const { sites, isLoading: isLoadingSites, deleteSiteMutation, updateSiteMutation, toggleSiteEnabledMutation } = useSites();

  // Site name inline editing state (admin only)
  const [editingSiteId, setEditingSiteId] = useState<string | null>(null);
  const [editingSiteName, setEditingSiteName] = useState('');
  const [editSiteError, setEditSiteError] = useState<string | null>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

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

  // Load pre-authorized emails (admin only)
  useEffect(() => {
    if (user?.is_admin) {
      loadPreAuthEmails();
    }
  }, [user?.is_admin]);

  const loadPreAuthEmails = async () => {
    try {
      setLoadingEmails(true);
      const emails = await preAuthorizedEmailsService.getAll();
      setPreAuthEmails(emails);
    } catch (error) {
      console.error('Failed to load pre-authorized emails:', error);
    } finally {
      setLoadingEmails(false);
    }
  };

  const handleAddEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError('');

    if (!newEmail) {
      setEmailError('Email is required');
      return;
    }

    try {
      await preAuthorizedEmailsService.create({
        email: newEmail,
        notes: newNotes || undefined,
      });
      setNewEmail('');
      setNewNotes('');
      await loadPreAuthEmails();
    } catch (error: any) {
      setEmailError(error.response?.data?.message || 'Failed to add email');
    }
  };

  const handleDeleteEmail = async (id: string, email: string) => {
    if (window.confirm(`Are you sure you want to remove ${email} from pre-authorized emails?`)) {
      try {
        await preAuthorizedEmailsService.delete(id);
        await loadPreAuthEmails();
      } catch (error) {
        console.error('Failed to delete email:', error);
        alert('Failed to delete email. Please try again.');
      }
    }
  };

  // Load users (admin only)
  useEffect(() => {
    if (user?.is_admin) {
      loadUsers();
    }
  }, [user?.is_admin]);

  const loadUsers = async () => {
    try {
      setLoadingUsers(true);
      const allUsers = await usersService.getAll();
      setUsers(allUsers);
    } catch (error) {
      console.error('Failed to load users:', error);
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleDeleteUser = async (userId: string, username: string) => {
    if (window.confirm(`Are you sure you want to delete user ${username}? This cannot be undone.`)) {
      try {
        await usersService.delete(userId);
        await loadUsers();
      } catch (error: any) {
        console.error('Failed to delete user:', error);
        alert(error.response?.data?.message || 'Failed to delete user. Please try again.');
      }
    }
  };

  const handleResetPassword = async (userId: string, username: string) => {
    if (window.confirm(`${username} will be required to reset their password on next login. Continue?`)) {
      try {
        await usersService.flagPasswordReset(userId);
        await loadUsers();
        alert('Password reset flag set successfully.');
      } catch (error) {
        console.error('Failed to set password reset flag:', error);
        alert('Failed to set password reset. Please try again.');
      }
    }
  };

  const handleUnlockAccount = async (userId: string, username: string) => {
    if (window.confirm(`Unlock account for ${username}? This will reset failed login attempts and allow them to login again.`)) {
      try {
        await usersService.unlockAccount(userId);
        await loadUsers();
        alert('Account unlocked successfully.');
      } catch (error) {
        console.error('Failed to unlock account:', error);
        alert('Failed to unlock account. Please try again.');
      }
    }
  };

  // Load album stats (all users)
  useEffect(() => {
    if (user) {
      loadAlbumStats();
    }
  }, [user?.id]);

  const loadAlbumStats = async () => {
    try {
      setLoadingAlbumStats(true);
      setAlbumStats(await usersService.getAlbumStats());
    } catch (error) {
      console.error('Failed to load album stats:', error);
    } finally {
      setLoadingAlbumStats(false);
    }
  };

  const formatStorageSize = (bytes: number): string => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  // Load weather stats (admin only)
  useEffect(() => {
    if (user?.is_admin) {
      loadWeatherStats();
    }
  }, [user?.is_admin]);

  const loadWeatherStats = async () => {
    try {
      setLoadingWeatherStats(true);
      const stats = await weatherService.getStats();
      setWeatherStats(stats);
    } catch (error) {
      console.error('Failed to load weather stats:', error);
    } finally {
      setLoadingWeatherStats(false);
    }
  };

  const handleFetchWeather = async () => {
    setIsFetchingWeather(true);
    try {
      await api.post('/weather/fetch');
      alert('Weather data fetched successfully! Refresh the page to see updated forecasts.');
      window.location.reload();
    } catch (error: any) {
      console.error('Weather fetch error:', error);
      const errorMessage = error.response?.data?.message || 'Failed to fetch weather data. Please try again.';
      alert(errorMessage);
    } finally {
      setIsFetchingWeather(false);
    }
  };

  const handleResetWeatherStats = async () => {
    if (window.confirm('Are you sure you want to reset all weather API statistics? This cannot be undone.')) {
      try {
        await weatherService.resetStats();
        await loadWeatherStats();
        alert('Weather API statistics reset successfully!');
      } catch (error) {
        console.error('Failed to reset weather stats:', error);
        alert('Failed to reset statistics. Please try again.');
      }
    }
  };

  // Load OpenSky stats (admin only)
  useEffect(() => {
    if (user?.is_admin) {
      loadOpenSkyStats();
    }
  }, [user?.is_admin]);

  const loadOpenSkyStats = async () => {
    try {
      setLoadingOpenSkyStats(true);
      const stats = await openSkyService.getStats();
      setOpenSkyStats(stats);
    } catch (error) {
      console.error('Failed to load OpenSky stats:', error);
    } finally {
      setLoadingOpenSkyStats(false);
    }
  };

  const handleResetOpenSkyStats = async () => {
    if (window.confirm('Are you sure you want to reset all OpenSky API statistics? This cannot be undone.')) {
      try {
        await openSkyService.resetStats();
        await loadOpenSkyStats();
        alert('OpenSky API statistics reset successfully!');
      } catch (error) {
        console.error('Failed to reset OpenSky stats:', error);
        alert('Failed to reset statistics. Please try again.');
      }
    }
  };

  // Load backup status (admin only)
  useEffect(() => {
    if (user?.is_admin) {
      loadBackupStatus();
    }
  }, [user?.is_admin]);

  const loadBackupStatus = async () => {
    try {
      setLoadingBackupStatus(true);
      const status = await backupService.getStatus();
      setBackupStatus(status);
    } catch (error) {
      console.error('Failed to load backup status:', error);
    } finally {
      setLoadingBackupStatus(false);
    }
  };

  const handleManualBackup = async () => {
    if (!window.confirm('Start a manual database backup now?')) {
      return;
    }

    try {
      setTriggeringBackup(true);
      await backupService.triggerManualBackup();
      await loadBackupStatus();
      alert('Database backup completed successfully!');
    } catch (error: any) {
      console.error('Failed to trigger backup:', error);
      alert(error.response?.data?.message || 'Failed to trigger backup. Please try again.');
    } finally {
      setTriggeringBackup(false);
    }
  };

  const loadBackupFiles = async () => {
    try {
      setLoadingBackupFiles(true);
      const { files } = await backupService.listFiles();
      setBackupFiles(files);
    } catch (error) {
      console.error('Failed to load backup files:', error);
    } finally {
      setLoadingBackupFiles(false);
    }
  };

  const handleRegenerateThumbnails = async () => {
    if (!window.confirm('Regenerate thumbnails for all images? This may take a while on large libraries.')) {
      return;
    }
    try {
      setRegeneratingThumbnails(true);
      setThumbnailResult(null);
      const result = await mediaService.regenerateThumbnails();
      setThumbnailResult(result);
    } catch (error: any) {
      console.error('Failed to regenerate thumbnails:', error);
      alert(error.response?.data?.message || 'Failed to regenerate thumbnails. Please try again.');
    } finally {
      setRegeneratingThumbnails(false);
    }
  };

  const handleDeleteSite = async (siteId: string, siteName: string) => {
    if (window.confirm(`Are you sure you want to delete "${siteName}"? This will remove both takeoff and parking locations. This cannot be undone.`)) {
      try {
        await deleteSiteMutation.mutateAsync(siteId);
        alert('Site deleted successfully!');
      } catch (error: any) {
        console.error('Failed to delete site:', error);
        alert(error.response?.data?.message || 'Failed to delete site. Please try again.');
      }
    }
  };

  // Inline editing handlers for site names
  const handleStartEditing = (siteId: string, currentName: string) => {
    setEditingSiteId(siteId);
    setEditingSiteName(currentName);
    setEditSiteError(null);
  };

  const handleCancelEdit = () => {
    setEditingSiteId(null);
    setEditingSiteName('');
    setEditSiteError(null);
  };

  const handleSaveSiteName = async (siteId: string) => {
    const trimmedName = editingSiteName.trim();

    // Validate name
    if (trimmedName.length === 0) {
      setEditSiteError('Site name cannot be empty');
      return;
    }

    if (trimmedName.length > 255) {
      setEditSiteError('Site name cannot exceed 255 characters');
      return;
    }

    try {
      await updateSiteMutation.mutateAsync({
        id: siteId,
        data: { name: trimmedName },
      });
      // Success - clear edit state
      handleCancelEdit();
    } catch (error: any) {
      console.error('Failed to update site name:', error);
      setEditSiteError(
        error.response?.data?.message || 'Failed to update site name. Please try again.'
      );
    }
  };

  const handleSiteNameKeyDown = (event: React.KeyboardEvent<HTMLInputElement>, siteId: string) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleSaveSiteName(siteId);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      handleCancelEdit();
    }
  };

  // Toggle site status handler
  const handleToggleSiteStatus = async (siteId: string) => {
    try {
      await toggleSiteEnabledMutation.mutateAsync(siteId);
    } catch (error: any) {
      console.error('Failed to toggle site status:', error);
      alert(error.response?.data?.message || 'Failed to toggle site status. Please try again.');
    }
  };

  // Auto-focus and select text when entering edit mode
  useEffect(() => {
    if (editingSiteId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingSiteId]);

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
              <span className="text-sm text-gray-600">{user?.username || user?.email}</span>
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
        {Object.entries(settingsByCategory).filter(([category]) => category !== 'Database Backup' && category !== 'OpenSky Integration').map(([category, categorySettings]) => (
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
                                  : setting.setting_key.includes('reserve')
                                  ? '%'
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

        {/* Pre-Authorized Emails Management (Admin Only) */}
        {user?.is_admin && (
          <div className="mb-8 bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                Pre-Authorized Emails (Admin)
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Manage which email addresses can register for an account
              </p>
            </div>

            {/* Add Email Form */}
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <form onSubmit={handleAddEmail} className="space-y-3">
                {emailError && (
                  <div className="rounded-md bg-red-50 p-3">
                    <div className="text-sm text-red-800">{emailError}</div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label htmlFor="newEmail" className="block text-sm font-medium text-gray-700 mb-1">
                      Email Address *
                    </label>
                    <input
                      id="newEmail"
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="user@example.com"
                      required
                    />
                  </div>

                  <div>
                    <label htmlFor="newNotes" className="block text-sm font-medium text-gray-700 mb-1">
                      Notes (Optional)
                    </label>
                    <input
                      id="newNotes"
                      type="text"
                      value={newNotes}
                      onChange={(e) => setNewNotes(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g., John Doe - Club member"
                    />
                  </div>

                  <div className="flex items-end">
                    <button
                      type="submit"
                      className="w-full px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
                    >
                      Add Email
                    </button>
                  </div>
                </div>
              </form>
            </div>

            {/* Email List */}
            <div className="px-6 py-4">
              {loadingEmails ? (
                <div className="text-center py-8">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <p className="mt-2 text-gray-600">Loading emails...</p>
                </div>
              ) : preAuthEmails.length === 0 ? (
                <p className="text-gray-500 text-center py-8">
                  No pre-authorized emails yet. Add one above to allow registrations.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Email
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Notes
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Added
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {preAuthEmails.map((email) => (
                        <tr key={email.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                            {email.email}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {email.notes || '-'}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {email.used ? (
                              <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded">
                                Used
                              </span>
                            ) : (
                              <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded">
                                Available
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                            {new Date(email.created_at).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-right text-sm">
                            <button
                              onClick={() => handleDeleteEmail(email.id, email.email)}
                              className="px-3 py-1 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 transition-colors"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Current Users Management (Admin Only) */}
        {user?.is_admin && (
          <div className="mb-8 bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                Current Users
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Manage user accounts and permissions
              </p>
            </div>

            {/* Users List */}
            <div className="px-6 py-4">
              {loadingUsers ? (
                <div className="text-center py-8">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <p className="mt-2 text-gray-600">Loading users...</p>
                </div>
              ) : users.length === 0 ? (
                <p className="text-gray-500 text-center py-8">
                  No users found.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Username
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Email
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Admin
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Last Login
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {users.map((userData) => (
                        <tr key={userData.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                            {userData.username || '-'}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                            {userData.email}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {userData.is_admin ? (
                              <span className="px-2 py-1 text-xs bg-purple-100 text-purple-800 rounded font-semibold">
                                Admin
                              </span>
                            ) : (
                              <span className="px-2 py-1 text-xs bg-gray-100 text-gray-800 rounded">
                                User
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {userData.is_locked ? (
                              <span className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded font-semibold" title={`Locked after ${userData.failed_login_attempts} failed attempts`}>
                                Locked
                              </span>
                            ) : (
                              <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded">
                                Active
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                            {userData.last_login
                              ? new Date(userData.last_login).toLocaleString()
                              : 'Never'}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-right text-sm">
                            <div className="flex justify-end gap-2">
                              {userData.is_locked ? (
                                <button
                                  onClick={() => handleUnlockAccount(userData.id, userData.username)}
                                  className="px-3 py-1 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700 transition-colors"
                                  title="Unlock account and reset failed login attempts"
                                >
                                  Unlock Account
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleResetPassword(userData.id, userData.username)}
                                  className="px-3 py-1 bg-orange-600 text-white rounded-md text-sm font-medium hover:bg-orange-700 transition-colors"
                                  title="Require password reset on next login"
                                >
                                  Reset Password
                                </button>
                              )}
                              <button
                                onClick={() => handleDeleteUser(userData.id, userData.username)}
                                disabled={userData.id === user.id}
                                className="px-3 py-1 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                title={userData.id === user.id ? "Cannot delete your own account" : "Delete user"}
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Album Stats */}
        <div className="mb-8 bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Album Stats</h2>
            <p className="text-sm text-gray-600 mt-1">Storage and media upload statistics per user</p>
          </div>
          <div className="px-6 py-4">
            {loadingAlbumStats ? (
              <div className="text-center py-8">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <p className="mt-2 text-gray-600">Loading stats...</p>
              </div>
            ) : albumStats.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No users found.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Username</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Images Uploaded</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Videos Uploaded</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Images Viewed</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Videos Viewed</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total Space</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {albumStats.map((row) => (
                      <tr key={row.username || row.email} className="hover:bg-gray-50">
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                          {row.username || <span className="text-gray-400 italic">no username</span>}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 text-right">{row.images_uploaded}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 text-right">{row.videos_uploaded}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 text-right">{row.images_viewed}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 text-right">{row.videos_viewed}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 text-right">{formatStorageSize(row.storage_used)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Weather API Statistics (Admin Only) */}
        {user?.is_admin && (
          <div className="mb-8 bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    Weather API Statistics
                  </h2>
                  <p className="text-sm text-gray-600 mt-1">
                    Track usage of weather forecast endpoints
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleFetchWeather}
                    disabled={isFetchingWeather}
                    className="px-4 py-2 bg-purple-600 text-white rounded-md text-sm font-medium hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isFetchingWeather ? 'Fetching...' : 'Fetch Weather'}
                  </button>
                  <button
                    onClick={handleResetWeatherStats}
                    className="px-4 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 transition-colors"
                  >
                    Reset Stats
                  </button>
                </div>
              </div>
            </div>

            <div className="px-6 py-4">
              {loadingWeatherStats ? (
                <div className="text-center py-8">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <p className="mt-2 text-gray-600">Loading statistics...</p>
                </div>
              ) : !weatherStats ? (
                <p className="text-gray-500 text-center py-8">
                  No statistics available.
                </p>
              ) : (
                <div className="space-y-6">
                  {/* Summary Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <div className="text-sm font-medium text-blue-900">Max Calls Per Day</div>
                      <div className="mt-2 text-2xl font-bold text-blue-700">
                        {weatherStats.maxPerDay.count}
                      </div>
                      <div className="mt-1 text-xs text-blue-600">
                        on {new Date(weatherStats.maxPerDay.date).toLocaleDateString()}
                      </div>
                    </div>

                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <div className="text-sm font-medium text-green-900">Max Calls Per Hour</div>
                      <div className="mt-2 text-2xl font-bold text-green-700">
                        {weatherStats.maxPerHour.count}
                      </div>
                      <div className="mt-1 text-xs text-green-600">
                        at {weatherStats.maxPerHour.hour ? new Date(weatherStats.maxPerHour.hour).toLocaleString() : 'N/A'}
                      </div>
                    </div>
                  </div>

                  {/* Endpoint Counts Table */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-3">Calls by Endpoint</h3>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Endpoint
                            </th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Total Calls
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {weatherStats.endpointCounts.map((stat) => (
                            <tr key={stat.endpoint} className="hover:bg-gray-50">
                              <td className="px-4 py-3 text-sm font-mono text-gray-900">
                                {stat.endpoint}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-900 text-right font-semibold">
                                {stat.count.toLocaleString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* OpenSky Integration (Admin Only) */}
        {user?.is_admin && (
          <div className="mb-8 bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">OpenSky Integration</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    Real-time aircraft positions near flying pilots
                  </p>
                </div>
                <button
                  onClick={handleResetOpenSkyStats}
                  className="px-4 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 transition-colors"
                >
                  Reset Stats
                </button>
              </div>
            </div>

            {/* Configuration */}
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Configuration</h3>
              <div className="space-y-4">
                {(settingsByCategory['OpenSky Integration'] || []).map((setting) => {
                  const defaultSetting = defaults.find((d) => d.key === setting.setting_key);
                  const currentValue = editedValues[setting.setting_key] ?? setting.setting_value;
                  return (
                    <div key={setting.id} className="flex items-center justify-between py-2">
                      <div className="flex-1">
                        <label htmlFor={setting.setting_key} className="block text-sm font-medium text-gray-700">
                          {defaultSetting?.description || setting.setting_key}
                        </label>
                        <p className="text-xs text-gray-500 mt-1">{setting.setting_key}</p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          id={setting.setting_key}
                          type="number"
                          value={currentValue}
                          onChange={(e) => handleValueChange(setting.setting_key, e.target.value)}
                          className="w-24 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          step="any"
                          min="1"
                        />
                        <span className="text-sm text-gray-500">km</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* API Statistics */}
            <div className="px-6 py-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">API Statistics</h3>
              {loadingOpenSkyStats ? (
                <div className="text-center py-6">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <p className="mt-2 text-gray-600">Loading statistics...</p>
                </div>
              ) : !openSkyStats ? (
                <p className="text-gray-500 text-center py-6">No statistics available.</p>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <div className="text-sm font-medium text-blue-900">Total Calls</div>
                      <div className="mt-2 text-2xl font-bold text-blue-700">
                        {openSkyStats.totalCalls.toLocaleString()}
                      </div>
                    </div>

                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <div className="text-sm font-medium text-red-900">Rate Limited (429)</div>
                      <div className="mt-2 text-2xl font-bold text-red-700">
                        {openSkyStats.totalRejected.toLocaleString()}
                      </div>
                    </div>

                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <div className="text-sm font-medium text-green-900">Max Calls / Day</div>
                      <div className="mt-2 text-2xl font-bold text-green-700">
                        {openSkyStats.maxPerDay.count}
                      </div>
                      <div className="mt-1 text-xs text-green-600">
                        {openSkyStats.maxPerDay.date
                          ? new Date(openSkyStats.maxPerDay.date).toLocaleDateString()
                          : 'N/A'}
                        {openSkyStats.maxPerDay.rejected > 0 && (
                          <span className="ml-1 text-red-500">
                            ({openSkyStats.maxPerDay.rejected} rejected)
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                      <div className="text-sm font-medium text-purple-900">Max Calls / Hour</div>
                      <div className="mt-2 text-2xl font-bold text-purple-700">
                        {openSkyStats.maxPerHour.count}
                      </div>
                      <div className="mt-1 text-xs text-purple-600">
                        {openSkyStats.maxPerHour.hour
                          ? new Date(openSkyStats.maxPerHour.hour).toLocaleString()
                          : 'N/A'}
                        {openSkyStats.maxPerHour.rejected > 0 && (
                          <span className="ml-1 text-red-500">
                            ({openSkyStats.maxPerHour.rejected} rejected)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {openSkyStats.totalCalls === 0 && (
                    <p className="text-sm text-gray-500 text-center py-2">
                      No API calls recorded yet — OpenSky is queried only when pilots are actively flying.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Thumbnail Maintenance (Admin Only) */}
        {user?.is_admin && (
          <div className="mb-8 bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                Thumbnail Maintenance
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Regenerate thumbnails for all existing images
              </p>
            </div>

            <div className="px-6 py-4 space-y-4">
              <p className="text-sm text-gray-600">
                Use this if thumbnails appear rotated or are missing. Only image thumbnails are regenerated; video thumbnails are unaffected.
              </p>

              <div className="flex items-center gap-4">
                <button
                  onClick={handleRegenerateThumbnails}
                  disabled={regeneratingThumbnails}
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {regeneratingThumbnails ? (
                    <span className="flex items-center gap-2">
                      <span className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                      Regenerating...
                    </span>
                  ) : (
                    'Regenerate Thumbnails'
                  )}
                </button>

                {thumbnailResult && (
                  <p className="text-sm text-gray-700">
                    Done —{' '}
                    <span className="font-semibold text-green-600">{thumbnailResult.succeeded}</span>
                    {' '}of{' '}
                    <span className="font-semibold">{thumbnailResult.processed}</span>
                    {' '}thumbnails regenerated
                    {thumbnailResult.failed > 0 && (
                      <span className="text-red-600"> ({thumbnailResult.failed} failed)</span>
                    )}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Database Backup (Admin Only) */}
        {user?.is_admin && (
          <div className="mb-8 bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                Database Backup
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Configure automated database backups
              </p>
            </div>

            <div className="px-6 py-4 space-y-6">
              {/* Last Backup Status */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">
                  Last Backup Status
                </h3>
                {loadingBackupStatus ? (
                  <div className="text-center py-4">
                    <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                  </div>
                ) : backupStatus?.lastBackup ? (
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Status:</span>
                      <span className={`font-semibold ${
                        backupStatus.lastBackup.status === 'success'
                          ? 'text-green-600'
                          : backupStatus.lastBackup.status === 'failed'
                          ? 'text-red-600'
                          : 'text-yellow-600'
                      }`}>
                        {backupStatus.lastBackup.status.toUpperCase()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Type:</span>
                      <span className="text-gray-900 font-medium">
                        {backupStatus.lastBackup.type === 'manual' ? 'Manual' : 'Scheduled'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Timestamp:</span>
                      <span className="text-gray-900 font-mono">
                        {new Date(backupStatus.lastBackup.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Filename:</span>
                      <span className="text-gray-900 font-mono text-xs">
                        {backupStatus.lastBackup.filename}
                      </span>
                    </div>
                    {backupStatus.lastBackup.fileSize && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Size:</span>
                        <span className="text-gray-900">
                          {(backupStatus.lastBackup.fileSize / 1024 / 1024).toFixed(2)} MB
                        </span>
                      </div>
                    )}
                    {backupStatus.lastBackup.duration && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Duration:</span>
                        <span className="text-gray-900">
                          {(backupStatus.lastBackup.duration / 1000).toFixed(2)}s
                        </span>
                      </div>
                    )}
                    {backupStatus.lastBackup.error && (
                      <div className="mt-2 p-2 bg-red-50 rounded border border-red-200">
                        <span className="text-xs text-red-700 font-mono">
                          {backupStatus.lastBackup.error}
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No backups have been performed yet.</p>
                )}

                {/* Manual Backup Button */}
                <button
                  onClick={handleManualBackup}
                  disabled={triggeringBackup}
                  className="mt-4 w-full px-4 py-2 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {triggeringBackup ? 'Backing up...' : 'Run Manual Backup Now'}
                </button>

                {/* Restore Database Button */}
                <button
                  onClick={() => {
                    loadBackupFiles();
                    setShowRestoreModal(true);
                  }}
                  disabled={loadingBackupFiles}
                  className="mt-2 w-full px-4 py-2 bg-red-600 text-white rounded-md font-medium hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loadingBackupFiles ? 'Loading...' : 'Restore Database'}
                </button>
              </div>

              {/* Backup Settings */}
              {settingsByCategory['Database Backup']?.map((setting) => {
                const defaultSetting = defaults.find(
                  (d) => d.key === setting.setting_key,
                );
                const currentValue =
                  editedValues[setting.setting_key] !== undefined
                    ? editedValues[setting.setting_key]
                    : setting.setting_value;

                // Get frequency value (for conditional rendering)
                const frequencyValue = editedValues['backup.frequency'] !== undefined
                  ? editedValues['backup.frequency']
                  : settingsByCategory['Database Backup']?.find(s => s.setting_key === 'backup.frequency')?.setting_value;

                return (
                  <div key={setting.id} className="space-y-2">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-700">
                          {defaultSetting?.description || setting.setting_key}
                        </label>
                      </div>
                    </div>

                    {setting.setting_type === SettingType.BOOLEAN ? (
                      <div className="flex items-center">
                        <button
                          onClick={() =>
                            handleValueChange(
                              setting.setting_key,
                              currentValue === 'true' ? 'false' : 'true',
                            )
                          }
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            currentValue === 'true'
                              ? 'bg-blue-600'
                              : 'bg-gray-200'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              currentValue === 'true'
                                ? 'translate-x-6'
                                : 'translate-x-1'
                            }`}
                          />
                        </button>
                        <span className="ml-3 text-sm text-gray-600">
                          {currentValue === 'true' ? 'Enabled' : 'Disabled'}
                        </span>
                      </div>
                    ) : setting.setting_key === 'backup.frequency' ? (
                      <select
                        value={currentValue}
                        onChange={(e) =>
                          handleValueChange(setting.setting_key, e.target.value)
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                      </select>
                    ) : setting.setting_key === 'backup.day_of_week' ? (
                      <select
                        value={currentValue}
                        onChange={(e) =>
                          handleValueChange(setting.setting_key, e.target.value)
                        }
                        disabled={frequencyValue !== 'weekly'}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                      >
                        <option value="0">Sunday</option>
                        <option value="1">Monday</option>
                        <option value="2">Tuesday</option>
                        <option value="3">Wednesday</option>
                        <option value="4">Thursday</option>
                        <option value="5">Friday</option>
                        <option value="6">Saturday</option>
                      </select>
                    ) : setting.setting_key === 'backup.day_of_month' ? (
                      <select
                        value={currentValue}
                        onChange={(e) =>
                          handleValueChange(setting.setting_key, e.target.value)
                        }
                        disabled={frequencyValue !== 'monthly'}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                      >
                        {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
                          <option key={day} value={day}>
                            {day}
                          </option>
                        ))}
                      </select>
                    ) : setting.setting_key === 'backup.time' ? (
                      <input
                        type="time"
                        value={currentValue}
                        onChange={(e) =>
                          handleValueChange(setting.setting_key, e.target.value)
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono"
                      />
                    ) : (
                      <input
                        type="text"
                        value={currentValue}
                        onChange={(e) =>
                          handleValueChange(setting.setting_key, e.target.value)
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    )}
                  </div>
                );
              })}

              <div className="pt-4 border-t border-gray-200">
                <p className="text-xs text-gray-500 italic">
                  Note: Backup files are stored in the configured BACKUP_DIR and must be managed manually.
                  No automatic file pruning is performed.
                </p>
              </div>
            </div>

            {/* Restore Modal */}
            {showRestoreModal && (
              <RestoreModal
                isOpen={showRestoreModal}
                onClose={() => setShowRestoreModal(false)}
                onSuccess={() => {
                  // Reload the entire page to refresh all data after restore
                  window.location.reload();
                }}
                existingBackups={backupFiles}
              />
            )}
          </div>
        )}

        {/* Site Management (Admin Only) */}
        {user?.is_admin && (
          <div className="mb-8 bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                Site Management
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Manage flight sites (takeoff and parking locations)
              </p>
            </div>

            {/* Sites List */}
            <div className="px-6 py-4">
              {isLoadingSites ? (
                <div className="text-center py-8">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <p className="mt-2 text-gray-600">Loading sites...</p>
                </div>
              ) : sites.length === 0 ? (
                <p className="text-gray-500 text-center py-8">
                  No sites found. Users can add sites from the map view.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Site Name
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Takeoff Location
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Parking Location
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Created
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {sites.map((site) => (
                        <tr key={site.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                            {editingSiteId === site.id ? (
                              <div>
                                <input
                                  ref={editInputRef}
                                  type="text"
                                  value={editingSiteName}
                                  onChange={(e) => setEditingSiteName(e.target.value)}
                                  onKeyDown={(e) => handleSiteNameKeyDown(e, site.id)}
                                  onBlur={() => handleSaveSiteName(site.id)}
                                  disabled={updateSiteMutation.isPending}
                                  className="w-full px-2 py-1 border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium text-gray-900 disabled:bg-gray-100 disabled:cursor-not-allowed"
                                />
                                {editSiteError && (
                                  <div className="text-xs text-red-600 mt-1">
                                    {editSiteError}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span
                                onClick={() => handleStartEditing(site.id, site.name)}
                                className="cursor-pointer hover:text-blue-600 hover:underline"
                                title="Click to edit site name"
                              >
                                {site.name}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 font-mono">
                            {Number(site.takeoff_lat).toFixed(6)}, {Number(site.takeoff_lon).toFixed(6)}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 font-mono">
                            {Number(site.parking_lat).toFixed(6)}, {Number(site.parking_lon).toFixed(6)}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {site.enabled ? (
                              <button
                                onClick={() => handleToggleSiteStatus(site.id)}
                                disabled={toggleSiteEnabledMutation.isPending}
                                className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded cursor-pointer hover:bg-green-200 hover:shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Click to disable this site"
                              >
                                {toggleSiteEnabledMutation.isPending ? 'Toggling...' : 'Enabled'}
                              </button>
                            ) : (
                              <button
                                onClick={() => handleToggleSiteStatus(site.id)}
                                disabled={toggleSiteEnabledMutation.isPending}
                                className="px-2 py-1 text-xs bg-gray-100 text-gray-800 rounded cursor-pointer hover:bg-gray-200 hover:shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Click to enable this site"
                              >
                                {toggleSiteEnabledMutation.isPending ? 'Toggling...' : 'Disabled'}
                              </button>
                            )}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                            {new Date(site.created_at).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-right text-sm">
                            <button
                              onClick={() => handleDeleteSite(site.id, site.name)}
                              className="px-3 py-1 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 transition-colors"
                              title="Delete site (removes both takeoff and parking)"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
        {/* Version */}
        <div className="pb-6 text-center">
          <p className="text-xs text-gray-400">v{version}</p>
        </div>
      </div>
    </div>
  );
}
