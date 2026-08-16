import { useState, useMemo, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { version } from '../../package.json';
import { useSettings } from '../hooks/useSettings';
import { useAuth } from '../hooks/useAuth';
import { useIsMobile } from '../hooks/useIsMobile';
import LeftSidebar from '../components/Layout/LeftSidebar';
import { SettingType, UpdateSettingData } from '../services/settings.service';
import { preAuthorizedEmailsService, PreAuthorizedEmail } from '../services/pre-authorized-emails.service';
import { usersService, UserData, AlbumStatRow } from '../services/users.service';
import { apkReleaseService } from '../services/apkRelease.service';
import { weatherService, WeatherApiStats } from '../services/weather.service';
import { openSkyService, OpenSkyStats } from '../services/opensky.service';
import { useSites } from '../hooks/useSites';
import { backupService, BackupStatus, BackupFileInfo } from '../services/backup.service';
import { RestoreModal } from '../components/RestoreModal';
import { TempPasswordModal } from '../components/TempPasswordModal';
import { mediaService } from '../services/media.service';
import { api } from '../services/api';

const inputCls = 'px-3 py-2 bg-[#0d1421] border border-[#2a3a54] rounded-lg text-sm text-white placeholder-[#4a5568] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500';

export default function Settings() {
  const { settings, defaults, isLoading, updateManyMutation, resetToDefaultsMutation } =
    useSettings();
  const { user, logout } = useAuth();
  const isMobile = useIsMobile();
  const [editedValues, setEditedValues] = useState<Record<string, string>>({});
  const [hasChanges, setHasChanges] = useState(false);

  // API version state (admin only)
  const [apiVersion, setApiVersion] = useState<string | null>(null);

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
  const [tempPasswordInfo, setTempPasswordInfo] = useState<{ username: string; tempPassword: string } | null>(null);
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

  // Load API version (admin only)
  useEffect(() => {
    if (user?.is_admin) {
      api.get('/health')
        .then(response => setApiVersion(response.data.apiVersion))
        .catch(error => console.error('Failed to load API version:', error));
    }
  }, [user?.is_admin]);

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
        const { tempPassword } = await usersService.flagPasswordReset(userId);
        await loadUsers();
        setTempPasswordInfo({ username, tempPassword });
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

  const [togglingApkAccessId, setTogglingApkAccessId] = useState<string | null>(null);

  const handleToggleApkAccess = async (userId: string, currentlyGranted: boolean) => {
    setTogglingApkAccessId(userId);
    try {
      if (currentlyGranted) {
        await apkReleaseService.revokeAccess(userId);
      } else {
        await apkReleaseService.grantAccess(userId);
      }
      await loadUsers();
    } catch (error) {
      console.error('Failed to update Flightoid access:', error);
      alert('Failed to update Flightoid access. Please try again.');
    } finally {
      setTogglingApkAccessId(null);
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

  const handleToggleSiteStatus = async (siteId: string) => {
    try {
      await toggleSiteEnabledMutation.mutateAsync(siteId);
    } catch (error: any) {
      console.error('Failed to toggle site status:', error);
      alert(error.response?.data?.message || 'Failed to toggle site status. Please try again.');
    }
  };

  useEffect(() => {
    if (editingSiteId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingSiteId]);

  if (isLoading) {
    return (
      <div className="h-screen flex flex-row overflow-hidden" style={{ background: '#0d1421' }}>
        {!isMobile && (
          <LeftSidebar
            user={user}
            showAirspace={false}
            onToggleAirspace={() => {}}
            onLogout={logout}
          />
        )}
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            <p className="mt-4 text-[#6b7fa3]">Loading settings...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-row overflow-hidden" style={{ background: '#0d1421' }}>
      {!isMobile && (
        <LeftSidebar
          user={user}
          showAirspace={false}
          onToggleAirspace={() => {}}
          onLogout={logout}
        />
      )}

      <div className="flex-1 overflow-y-auto">
        {/* Header */}
        <div
          className="border-b border-[#1e2a3a] px-6 py-4 sticky top-0 z-10"
          style={{ background: '#0d1421' }}
        >
          <h1 className="text-xl font-bold text-white">Settings</h1>
          <p className="text-xs text-[#6b7fa3]">Configure thresholds and preferences</p>
        </div>

        <div className="max-w-4xl mx-auto px-6 py-8">
          {/* Unsaved changes banner */}
          {hasChanges && (
            <div className="mb-6 p-4 rounded-xl border border-amber-700/40 bg-amber-900/20">
              <div className="flex items-center justify-between">
                <p className="text-sm text-amber-300">You have unsaved changes</p>
                <div className="flex gap-2">
                  <button
                    onClick={handleCancel}
                    className="px-3 py-1.5 border border-[#2a3a54] text-[#a0b3cc] rounded-lg text-sm font-medium hover:bg-[#1e2a3a] transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={updateManyMutation.isPending}
                    className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
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
              className="px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 transition-colors disabled:opacity-50"
            >
              {resetToDefaultsMutation.isPending ? 'Resetting...' : 'Reset to Defaults'}
            </button>
          </div>

          {/* Flightoid App (visible to admins and explicitly-authorized users) */}
          {(user?.is_admin || user?.has_apk_access) && (
            <Link
              to="/settings/flightoid-app"
              className="mb-6 flex items-center justify-between bg-[#141d2e] rounded-xl border border-[#1e2a3a] px-6 py-4 hover:border-blue-600/60 transition-colors"
            >
              <div>
                <h2 className="text-base font-semibold text-white">Flightoid App</h2>
                <p className="text-sm text-[#6b7fa3] mt-0.5">Download and install the Flightoid companion app on your Android phone</p>
              </div>
              <span className="text-[#6b7fa3]">&rarr;</span>
            </Link>
          )}

          {/* Settings by Category */}
          {Object.entries(settingsByCategory)
            .filter(([category]) => category !== 'Database Backup' && category !== 'OpenSky Integration')
            .map(([category, categorySettings]) => (
              <div key={category} className="mb-6 bg-[#141d2e] rounded-xl border border-[#1e2a3a]">
                <div className="px-6 py-4 border-b border-[#1e2a3a]">
                  <h2 className="text-base font-semibold text-white">{category}</h2>
                </div>
                <div className="px-6 py-4">
                  <div className="space-y-4">
                    {categorySettings.map((setting) => {
                      const defaultSetting = defaults.find((d) => d.key === setting.setting_key);
                      const currentValue = editedValues[setting.setting_key] ?? setting.setting_value;

                      return (
                        <div key={setting.id} className="flex items-center justify-between py-2 border-b border-[#1e2a3a] last:border-0">
                          <div className="flex-1">
                            <label
                              htmlFor={setting.setting_key}
                              className="block text-sm font-medium text-[#a0b3cc]"
                            >
                              {defaultSetting?.description || setting.setting_key}
                            </label>
                            <p className="text-xs text-[#6b7fa3] mt-0.5">{setting.setting_key}</p>
                          </div>
                          <div className="flex items-center space-x-2 ml-4">
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
                                <div className="w-11 h-6 bg-[#2a3a54] peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-900 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-[#2a3a54] after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
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
                                  className={`w-32 ${inputCls}`}
                                  step={setting.setting_type === SettingType.NUMBER ? 'any' : undefined}
                                />
                                {setting.setting_type === SettingType.NUMBER && (
                                  <span className="text-sm text-[#6b7fa3]">
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
            <div className="mb-6 bg-[#141d2e] rounded-xl border border-[#1e2a3a]">
              <div className="px-6 py-4 border-b border-[#1e2a3a]">
                <h2 className="text-base font-semibold text-white">Pre-Authorized Emails</h2>
                <p className="text-sm text-[#6b7fa3] mt-0.5">
                  Manage which email addresses can register for an account
                </p>
              </div>

              {/* Add Email Form */}
              <div className="px-6 py-4 border-b border-[#1e2a3a]" style={{ background: '#1a2234' }}>
                <form onSubmit={handleAddEmail} className="space-y-3">
                  {emailError && (
                    <div className="rounded-lg bg-red-900/20 border border-red-700/40 p-3">
                      <div className="text-sm text-red-400">{emailError}</div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label htmlFor="newEmail" className="block text-xs font-medium text-[#a0b3cc] mb-1">
                        Email Address *
                      </label>
                      <input
                        id="newEmail"
                        type="email"
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        className={`w-full ${inputCls}`}
                        placeholder="user@example.com"
                        required
                      />
                    </div>

                    <div>
                      <label htmlFor="newNotes" className="block text-xs font-medium text-[#a0b3cc] mb-1">
                        Notes (Optional)
                      </label>
                      <input
                        id="newNotes"
                        type="text"
                        value={newNotes}
                        onChange={(e) => setNewNotes(e.target.value)}
                        className={`w-full ${inputCls}`}
                        placeholder="e.g., John Doe - Club member"
                      />
                    </div>

                    <div className="flex items-end">
                      <button
                        type="submit"
                        className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
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
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                    <p className="mt-2 text-[#6b7fa3] text-sm">Loading emails...</p>
                  </div>
                ) : preAuthEmails.length === 0 ? (
                  <p className="text-[#6b7fa3] text-sm text-center py-8">
                    No pre-authorized emails yet. Add one above to allow registrations.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full">
                      <thead>
                        <tr style={{ background: '#1e2a3a' }}>
                          <th className="px-4 py-3 text-left text-xs font-medium text-[#6b7fa3] uppercase tracking-wider rounded-tl-lg">Email</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-[#6b7fa3] uppercase tracking-wider">Notes</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-[#6b7fa3] uppercase tracking-wider">Status</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-[#6b7fa3] uppercase tracking-wider">Added</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-[#6b7fa3] uppercase tracking-wider rounded-tr-lg">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#1e2a3a]">
                        {preAuthEmails.map((email) => (
                          <tr key={email.id} className="hover:bg-[#1a2234] transition-colors">
                            <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-white">
                              {email.email}
                            </td>
                            <td className="px-4 py-3 text-sm text-[#6b7fa3]">
                              {email.notes || '-'}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              {email.used ? (
                                <span className="px-2 py-1 text-xs bg-green-900/30 text-green-400 rounded-md">Used</span>
                              ) : (
                                <span className="px-2 py-1 text-xs bg-amber-900/30 text-amber-400 rounded-md">Available</span>
                              )}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-[#6b7fa3]">
                              {new Date(email.created_at).toLocaleDateString()}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-right text-sm">
                              <button
                                onClick={() => handleDeleteEmail(email.id, email.email)}
                                className="px-3 py-1 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
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
            <div className="mb-6 bg-[#141d2e] rounded-xl border border-[#1e2a3a]">
              <div className="px-6 py-4 border-b border-[#1e2a3a]">
                <h2 className="text-base font-semibold text-white">Current Users</h2>
                <p className="text-sm text-[#6b7fa3] mt-0.5">Manage user accounts and permissions</p>
              </div>

              <div className="px-6 py-4">
                {loadingUsers ? (
                  <div className="text-center py-8">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                    <p className="mt-2 text-[#6b7fa3] text-sm">Loading users...</p>
                  </div>
                ) : users.length === 0 ? (
                  <p className="text-[#6b7fa3] text-sm text-center py-8">No users found.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full">
                      <thead>
                        <tr style={{ background: '#1e2a3a' }}>
                          <th className="px-4 py-3 text-left text-xs font-medium text-[#6b7fa3] uppercase tracking-wider rounded-tl-lg">Username</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-[#6b7fa3] uppercase tracking-wider">Email</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-[#6b7fa3] uppercase tracking-wider">Role</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-[#6b7fa3] uppercase tracking-wider">Status</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-[#6b7fa3] uppercase tracking-wider">Last Login</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-[#6b7fa3] uppercase tracking-wider">Flightoid App</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-[#6b7fa3] uppercase tracking-wider rounded-tr-lg">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#1e2a3a]">
                        {users.map((userData) => (
                          <tr key={userData.id} className="hover:bg-[#1a2234] transition-colors">
                            <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-white">
                              {userData.username || '-'}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-[#6b7fa3]">
                              {userData.email}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              {userData.is_admin ? (
                                <span className="px-2 py-1 text-xs bg-purple-900/30 text-purple-400 rounded-md font-semibold">Admin</span>
                              ) : (
                                <span className="px-2 py-1 text-xs bg-[#1e2a3a] text-[#a0b3cc] rounded-md">User</span>
                              )}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              {userData.is_locked ? (
                                <span className="px-2 py-1 text-xs bg-red-900/30 text-red-400 rounded-md font-semibold" title={`Locked after ${userData.failed_login_attempts} failed attempts`}>
                                  Locked
                                </span>
                              ) : (
                                <span className="px-2 py-1 text-xs bg-green-900/30 text-green-400 rounded-md">Active</span>
                              )}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-[#6b7fa3]">
                              {userData.last_login
                                ? new Date(userData.last_login).toLocaleString()
                                : 'Never'}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-center">
                              <button
                                onClick={() => handleToggleApkAccess(userData.id, userData.has_apk_access)}
                                disabled={togglingApkAccessId === userData.id}
                                title={userData.has_apk_access ? 'Revoke Flightoid app access' : 'Grant Flightoid app access'}
                                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:opacity-50 ${
                                  userData.has_apk_access ? 'bg-blue-600' : 'bg-[#2a3a54]'
                                }`}
                              >
                                <span
                                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                                    userData.has_apk_access ? 'translate-x-[18px]' : 'translate-x-1'
                                  }`}
                                />
                              </button>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-right text-sm">
                              <div className="flex justify-end gap-2">
                                {userData.is_locked ? (
                                  <button
                                    onClick={() => handleUnlockAccount(userData.id, userData.username)}
                                    className="px-3 py-1 bg-green-700 text-white rounded-lg text-sm font-medium hover:bg-green-600 transition-colors"
                                    title="Unlock account and reset failed login attempts"
                                  >
                                    Unlock
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handleResetPassword(userData.id, userData.username)}
                                    className="px-3 py-1 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 transition-colors"
                                    title="Require password reset on next login"
                                  >
                                    Reset PW
                                  </button>
                                )}
                                <button
                                  onClick={() => handleDeleteUser(userData.id, userData.username)}
                                  disabled={userData.id === user.id}
                                  className="px-3 py-1 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                  title={userData.id === user.id ? 'Cannot delete your own account' : 'Delete user'}
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

          {tempPasswordInfo && (
            <TempPasswordModal
              username={tempPasswordInfo.username}
              tempPassword={tempPasswordInfo.tempPassword}
              onClose={() => setTempPasswordInfo(null)}
            />
          )}

          {/* Album Stats */}
          <div className="mb-6 bg-[#141d2e] rounded-xl border border-[#1e2a3a]">
            <div className="px-6 py-4 border-b border-[#1e2a3a]">
              <h2 className="text-base font-semibold text-white">Album Stats</h2>
              <p className="text-sm text-[#6b7fa3] mt-0.5">Storage and media upload statistics per user</p>
            </div>
            <div className="px-6 py-4">
              {loadingAlbumStats ? (
                <div className="text-center py-8">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                  <p className="mt-2 text-[#6b7fa3] text-sm">Loading stats...</p>
                </div>
              ) : albumStats.length === 0 ? (
                <p className="text-[#6b7fa3] text-sm text-center py-8">No users found.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead>
                      <tr style={{ background: '#1e2a3a' }}>
                        <th className="px-4 py-3 text-left text-xs font-medium text-[#6b7fa3] uppercase tracking-wider rounded-tl-lg">Username</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-[#6b7fa3] uppercase tracking-wider">Images Uploaded</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-[#6b7fa3] uppercase tracking-wider">Videos Uploaded</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-[#6b7fa3] uppercase tracking-wider">Images Viewed</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-[#6b7fa3] uppercase tracking-wider">Videos Viewed</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-[#6b7fa3] uppercase tracking-wider rounded-tr-lg">Total Space</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1e2a3a]">
                      {albumStats.map((row) => (
                        <tr key={row.username || row.email} className="hover:bg-[#1a2234] transition-colors">
                          <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-white">
                            {row.username || <span className="text-[#4a5568] italic">no username</span>}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-[#a0b3cc] text-right">{row.images_uploaded}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-[#a0b3cc] text-right">{row.videos_uploaded}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-[#a0b3cc] text-right">{row.images_viewed}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-[#a0b3cc] text-right">{row.videos_viewed}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-[#a0b3cc] text-right">{formatStorageSize(row.storage_used)}</td>
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
            <div className="mb-6 bg-[#141d2e] rounded-xl border border-[#1e2a3a]">
              <div className="px-6 py-4 border-b border-[#1e2a3a]">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-semibold text-white">Weather API Statistics</h2>
                    <p className="text-sm text-[#6b7fa3] mt-0.5">Track usage of weather forecast endpoints</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleFetchWeather}
                      disabled={isFetchingWeather}
                      className="px-4 py-2 bg-purple-700 text-white rounded-lg text-sm font-medium hover:bg-purple-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isFetchingWeather ? 'Fetching...' : 'Fetch Weather'}
                    </button>
                    <button
                      onClick={handleResetWeatherStats}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
                    >
                      Reset Stats
                    </button>
                  </div>
                </div>
              </div>

              <div className="px-6 py-4">
                {loadingWeatherStats ? (
                  <div className="text-center py-8">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                    <p className="mt-2 text-[#6b7fa3] text-sm">Loading statistics...</p>
                  </div>
                ) : !weatherStats ? (
                  <p className="text-[#6b7fa3] text-sm text-center py-8">No statistics available.</p>
                ) : (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-blue-900/20 border border-blue-700/30 rounded-xl p-4">
                        <div className="text-sm font-medium text-blue-300">Max Calls Per Day</div>
                        <div className="mt-2 text-2xl font-bold text-blue-400">
                          {weatherStats.maxPerDay.count}
                        </div>
                        <div className="mt-1 text-xs text-blue-400/70">
                          on {new Date(weatherStats.maxPerDay.date).toLocaleDateString()}
                        </div>
                      </div>

                      <div className="bg-green-900/20 border border-green-700/30 rounded-xl p-4">
                        <div className="text-sm font-medium text-green-300">Max Calls Per Hour</div>
                        <div className="mt-2 text-2xl font-bold text-green-400">
                          {weatherStats.maxPerHour.count}
                        </div>
                        <div className="mt-1 text-xs text-green-400/70">
                          at {weatherStats.maxPerHour.hour ? new Date(weatherStats.maxPerHour.hour).toLocaleString() : 'N/A'}
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-sm font-semibold text-[#a0b3cc] mb-3">Calls by Endpoint</h3>
                      <div className="overflow-x-auto">
                        <table className="min-w-full">
                          <thead>
                            <tr style={{ background: '#1e2a3a' }}>
                              <th className="px-4 py-3 text-left text-xs font-medium text-[#6b7fa3] uppercase tracking-wider rounded-tl-lg">Endpoint</th>
                              <th className="px-4 py-3 text-right text-xs font-medium text-[#6b7fa3] uppercase tracking-wider rounded-tr-lg">Total Calls</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#1e2a3a]">
                            {weatherStats.endpointCounts.map((stat) => (
                              <tr key={stat.endpoint} className="hover:bg-[#1a2234] transition-colors">
                                <td className="px-4 py-3 text-sm font-mono text-[#a0b3cc]">
                                  {stat.endpoint}
                                </td>
                                <td className="px-4 py-3 text-sm text-white text-right font-semibold">
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
            <div className="mb-6 bg-[#141d2e] rounded-xl border border-[#1e2a3a]">
              <div className="px-6 py-4 border-b border-[#1e2a3a]">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-semibold text-white">OpenSky Integration</h2>
                    <p className="text-sm text-[#6b7fa3] mt-0.5">Real-time aircraft positions near flying pilots</p>
                  </div>
                  <button
                    onClick={handleResetOpenSkyStats}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
                  >
                    Reset Stats
                  </button>
                </div>
              </div>

              {/* Configuration */}
              <div className="px-6 py-4 border-b border-[#1e2a3a]">
                <h3 className="text-sm font-semibold text-[#a0b3cc] mb-3">Configuration</h3>
                <div className="space-y-4">
                  {(settingsByCategory['OpenSky Integration'] || []).map((setting) => {
                    const defaultSetting = defaults.find((d) => d.key === setting.setting_key);
                    const currentValue = editedValues[setting.setting_key] ?? setting.setting_value;
                    return (
                      <div key={setting.id} className="flex items-center justify-between py-2">
                        <div className="flex-1">
                          <label htmlFor={setting.setting_key} className="block text-sm font-medium text-[#a0b3cc]">
                            {defaultSetting?.description || setting.setting_key}
                          </label>
                          <p className="text-xs text-[#6b7fa3] mt-0.5">{setting.setting_key}</p>
                        </div>
                        <div className="flex items-center space-x-2 ml-4">
                          <input
                            id={setting.setting_key}
                            type="number"
                            value={currentValue}
                            onChange={(e) => handleValueChange(setting.setting_key, e.target.value)}
                            className={`w-24 ${inputCls}`}
                            step="any"
                            min="1"
                          />
                          <span className="text-sm text-[#6b7fa3]">km</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* API Statistics */}
              <div className="px-6 py-4">
                <h3 className="text-sm font-semibold text-[#a0b3cc] mb-3">API Statistics</h3>
                {loadingOpenSkyStats ? (
                  <div className="text-center py-6">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                    <p className="mt-2 text-[#6b7fa3] text-sm">Loading statistics...</p>
                  </div>
                ) : !openSkyStats ? (
                  <p className="text-[#6b7fa3] text-sm text-center py-6">No statistics available.</p>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="bg-blue-900/20 border border-blue-700/30 rounded-xl p-4">
                        <div className="text-sm font-medium text-blue-300">Total Calls</div>
                        <div className="mt-2 text-2xl font-bold text-blue-400">
                          {openSkyStats.totalCalls.toLocaleString()}
                        </div>
                      </div>

                      <div className="bg-red-900/20 border border-red-700/30 rounded-xl p-4">
                        <div className="text-sm font-medium text-red-300">Rate Limited (429)</div>
                        <div className="mt-2 text-2xl font-bold text-red-400">
                          {openSkyStats.totalRejected.toLocaleString()}
                        </div>
                      </div>

                      <div className="bg-green-900/20 border border-green-700/30 rounded-xl p-4">
                        <div className="text-sm font-medium text-green-300">Max Calls / Day</div>
                        <div className="mt-2 text-2xl font-bold text-green-400">
                          {openSkyStats.maxPerDay.count}
                        </div>
                        <div className="mt-1 text-xs text-green-400/70">
                          {openSkyStats.maxPerDay.date
                            ? new Date(openSkyStats.maxPerDay.date).toLocaleDateString()
                            : 'N/A'}
                          {openSkyStats.maxPerDay.rejected > 0 && (
                            <span className="ml-1 text-red-400">
                              ({openSkyStats.maxPerDay.rejected} rejected)
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="bg-purple-900/20 border border-purple-700/30 rounded-xl p-4">
                        <div className="text-sm font-medium text-purple-300">Max Calls / Hour</div>
                        <div className="mt-2 text-2xl font-bold text-purple-400">
                          {openSkyStats.maxPerHour.count}
                        </div>
                        <div className="mt-1 text-xs text-purple-400/70">
                          {openSkyStats.maxPerHour.hour
                            ? new Date(openSkyStats.maxPerHour.hour).toLocaleString()
                            : 'N/A'}
                          {openSkyStats.maxPerHour.rejected > 0 && (
                            <span className="ml-1 text-red-400">
                              ({openSkyStats.maxPerHour.rejected} rejected)
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {openSkyStats.totalCalls === 0 && (
                      <p className="text-sm text-[#6b7fa3] text-center py-2">
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
            <div className="mb-6 bg-[#141d2e] rounded-xl border border-[#1e2a3a]">
              <div className="px-6 py-4 border-b border-[#1e2a3a]">
                <h2 className="text-base font-semibold text-white">Thumbnail Maintenance</h2>
                <p className="text-sm text-[#6b7fa3] mt-0.5">Regenerate thumbnails for all existing images</p>
              </div>

              <div className="px-6 py-4 space-y-4">
                <p className="text-sm text-[#6b7fa3]">
                  Use this if thumbnails appear rotated or are missing. Only image thumbnails are regenerated; video thumbnails are unaffected.
                </p>

                <div className="flex items-center gap-4">
                  <button
                    onClick={handleRegenerateThumbnails}
                    disabled={regeneratingThumbnails}
                    className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
                    <p className="text-sm text-[#a0b3cc]">
                      Done —{' '}
                      <span className="font-semibold text-green-400">{thumbnailResult.succeeded}</span>
                      {' '}of{' '}
                      <span className="font-semibold text-white">{thumbnailResult.processed}</span>
                      {' '}thumbnails regenerated
                      {thumbnailResult.failed > 0 && (
                        <span className="text-red-400"> ({thumbnailResult.failed} failed)</span>
                      )}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Database Backup (Admin Only) */}
          {user?.is_admin && (
            <div className="mb-6 bg-[#141d2e] rounded-xl border border-[#1e2a3a]">
              <div className="px-6 py-4 border-b border-[#1e2a3a]">
                <h2 className="text-base font-semibold text-white">Database Backup</h2>
                <p className="text-sm text-[#6b7fa3] mt-0.5">Configure automated database backups</p>
              </div>

              <div className="px-6 py-4 space-y-6">
                {/* Last Backup Status */}
                <div className="rounded-xl p-4" style={{ background: '#1e2a3a' }}>
                  <h3 className="text-sm font-semibold text-[#a0b3cc] mb-3">Last Backup Status</h3>
                  {loadingBackupStatus ? (
                    <div className="text-center py-4">
                      <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                    </div>
                  ) : backupStatus?.lastBackup ? (
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-[#6b7fa3]">Status:</span>
                        <span className={`font-semibold ${
                          backupStatus.lastBackup.status === 'success'
                            ? 'text-green-400'
                            : backupStatus.lastBackup.status === 'failed'
                            ? 'text-red-400'
                            : 'text-amber-400'
                        }`}>
                          {backupStatus.lastBackup.status.toUpperCase()}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#6b7fa3]">Type:</span>
                        <span className="text-white font-medium">
                          {backupStatus.lastBackup.type === 'manual' ? 'Manual' : 'Scheduled'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#6b7fa3]">Timestamp:</span>
                        <span className="text-white font-mono">
                          {new Date(backupStatus.lastBackup.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#6b7fa3]">Filename:</span>
                        <span className="text-white font-mono text-xs">
                          {backupStatus.lastBackup.filename}
                        </span>
                      </div>
                      {backupStatus.lastBackup.fileSize && (
                        <div className="flex justify-between">
                          <span className="text-[#6b7fa3]">Size:</span>
                          <span className="text-white">
                            {(backupStatus.lastBackup.fileSize / 1024 / 1024).toFixed(2)} MB
                          </span>
                        </div>
                      )}
                      {backupStatus.lastBackup.duration && (
                        <div className="flex justify-between">
                          <span className="text-[#6b7fa3]">Duration:</span>
                          <span className="text-white">
                            {(backupStatus.lastBackup.duration / 1000).toFixed(2)}s
                          </span>
                        </div>
                      )}
                      {backupStatus.lastBackup.error && (
                        <div className="mt-2 p-2 bg-red-900/20 rounded-lg border border-red-700/40">
                          <span className="text-xs text-red-400 font-mono">
                            {backupStatus.lastBackup.error}
                          </span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-[#6b7fa3]">No backups have been performed yet.</p>
                  )}

                  <button
                    onClick={handleManualBackup}
                    disabled={triggeringBackup}
                    className="mt-4 w-full px-4 py-2 bg-blue-600 text-white rounded-lg font-medium text-sm hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {triggeringBackup ? 'Backing up...' : 'Run Manual Backup Now'}
                  </button>

                  <button
                    onClick={() => {
                      loadBackupFiles();
                      setShowRestoreModal(true);
                    }}
                    disabled={loadingBackupFiles}
                    className="mt-2 w-full px-4 py-2 bg-red-600 text-white rounded-lg font-medium text-sm hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loadingBackupFiles ? 'Loading...' : 'Restore Database'}
                  </button>
                </div>

                {/* Backup Settings */}
                {settingsByCategory['Database Backup']?.map((setting) => {
                  const defaultSetting = defaults.find((d) => d.key === setting.setting_key);
                  const currentValue =
                    editedValues[setting.setting_key] !== undefined
                      ? editedValues[setting.setting_key]
                      : setting.setting_value;

                  const frequencyValue = editedValues['backup.frequency'] !== undefined
                    ? editedValues['backup.frequency']
                    : settingsByCategory['Database Backup']?.find(s => s.setting_key === 'backup.frequency')?.setting_value;

                  return (
                    <div key={setting.id} className="space-y-2">
                      <div>
                        <label className="block text-sm font-medium text-[#a0b3cc]">
                          {defaultSetting?.description || setting.setting_key}
                        </label>
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
                              currentValue === 'true' ? 'bg-blue-600' : 'bg-[#2a3a54]'
                            }`}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                currentValue === 'true' ? 'translate-x-6' : 'translate-x-1'
                              }`}
                            />
                          </button>
                          <span className="ml-3 text-sm text-[#6b7fa3]">
                            {currentValue === 'true' ? 'Enabled' : 'Disabled'}
                          </span>
                        </div>
                      ) : setting.setting_key === 'backup.frequency' ? (
                        <select
                          value={currentValue}
                          onChange={(e) => handleValueChange(setting.setting_key, e.target.value)}
                          className={`w-full ${inputCls}`}
                          style={{ colorScheme: 'dark' }}
                        >
                          <option value="daily">Daily</option>
                          <option value="weekly">Weekly</option>
                          <option value="monthly">Monthly</option>
                        </select>
                      ) : setting.setting_key === 'backup.day_of_week' ? (
                        <select
                          value={currentValue}
                          onChange={(e) => handleValueChange(setting.setting_key, e.target.value)}
                          disabled={frequencyValue !== 'weekly'}
                          className={`w-full ${inputCls} disabled:opacity-40 disabled:cursor-not-allowed`}
                          style={{ colorScheme: 'dark' }}
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
                          onChange={(e) => handleValueChange(setting.setting_key, e.target.value)}
                          disabled={frequencyValue !== 'monthly'}
                          className={`w-full ${inputCls} disabled:opacity-40 disabled:cursor-not-allowed`}
                          style={{ colorScheme: 'dark' }}
                        >
                          {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
                            <option key={day} value={day}>{day}</option>
                          ))}
                        </select>
                      ) : setting.setting_key === 'backup.time' ? (
                        <input
                          type="time"
                          value={currentValue}
                          onChange={(e) => handleValueChange(setting.setting_key, e.target.value)}
                          className={`w-full ${inputCls} font-mono`}
                          style={{ colorScheme: 'dark' }}
                        />
                      ) : (
                        <input
                          type="text"
                          value={currentValue}
                          onChange={(e) => handleValueChange(setting.setting_key, e.target.value)}
                          className={`w-full ${inputCls}`}
                        />
                      )}
                    </div>
                  );
                })}

                <div className="pt-4 border-t border-[#1e2a3a]">
                  <p className="text-xs text-[#4a5568] italic">
                    Note: Backup files are stored in the configured BACKUP_DIR and must be managed manually.
                    No automatic file pruning is performed.
                  </p>
                </div>
              </div>

              {showRestoreModal && (
                <RestoreModal
                  isOpen={showRestoreModal}
                  onClose={() => setShowRestoreModal(false)}
                  onSuccess={() => {
                    window.location.reload();
                  }}
                  existingBackups={backupFiles}
                />
              )}
            </div>
          )}

          {/* Site Management (Admin Only) */}
          {user?.is_admin && (
            <div className="mb-6 bg-[#141d2e] rounded-xl border border-[#1e2a3a]">
              <div className="px-6 py-4 border-b border-[#1e2a3a]">
                <h2 className="text-base font-semibold text-white">Site Management</h2>
                <p className="text-sm text-[#6b7fa3] mt-0.5">Manage flight sites (takeoff and parking locations)</p>
              </div>

              <div className="px-6 py-4">
                {isLoadingSites ? (
                  <div className="text-center py-8">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                    <p className="mt-2 text-[#6b7fa3] text-sm">Loading sites...</p>
                  </div>
                ) : sites.length === 0 ? (
                  <p className="text-[#6b7fa3] text-sm text-center py-8">
                    No sites found. Users can add sites from the map view.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full">
                      <thead>
                        <tr style={{ background: '#1e2a3a' }}>
                          <th className="px-4 py-3 text-left text-xs font-medium text-[#6b7fa3] uppercase tracking-wider rounded-tl-lg">Site Name</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-[#6b7fa3] uppercase tracking-wider">Takeoff</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-[#6b7fa3] uppercase tracking-wider">Parking</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-[#6b7fa3] uppercase tracking-wider">Status</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-[#6b7fa3] uppercase tracking-wider">Created</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-[#6b7fa3] uppercase tracking-wider rounded-tr-lg">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#1e2a3a]">
                        {sites.map((site) => (
                          <tr key={site.id} className="hover:bg-[#1a2234] transition-colors">
                            <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-white">
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
                                    className="w-full px-2 py-1 bg-[#0d1421] border border-blue-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium text-white disabled:opacity-40 disabled:cursor-not-allowed"
                                  />
                                  {editSiteError && (
                                    <div className="text-xs text-red-400 mt-1">{editSiteError}</div>
                                  )}
                                </div>
                              ) : (
                                <span
                                  onClick={() => handleStartEditing(site.id, site.name)}
                                  className="cursor-pointer hover:text-blue-400 hover:underline"
                                  title="Click to edit site name"
                                >
                                  {site.name}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-[#6b7fa3] font-mono">
                              {Number(site.takeoff_lat).toFixed(6)}, {Number(site.takeoff_lon).toFixed(6)}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-[#6b7fa3] font-mono">
                              {Number(site.parking_lat).toFixed(6)}, {Number(site.parking_lon).toFixed(6)}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              {site.enabled ? (
                                <button
                                  onClick={() => handleToggleSiteStatus(site.id)}
                                  disabled={toggleSiteEnabledMutation.isPending}
                                  className="px-2 py-1 text-xs bg-green-900/30 text-green-400 rounded-md cursor-pointer hover:bg-green-900/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                  title="Click to disable this site"
                                >
                                  {toggleSiteEnabledMutation.isPending ? 'Toggling...' : 'Enabled'}
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleToggleSiteStatus(site.id)}
                                  disabled={toggleSiteEnabledMutation.isPending}
                                  className="px-2 py-1 text-xs bg-[#1e2a3a] text-[#6b7fa3] rounded-md cursor-pointer hover:bg-[#243048] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                  title="Click to enable this site"
                                >
                                  {toggleSiteEnabledMutation.isPending ? 'Toggling...' : 'Disabled'}
                                </button>
                              )}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-[#6b7fa3]">
                              {new Date(site.created_at).toLocaleDateString()}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-right text-sm">
                              <button
                                onClick={() => handleDeleteSite(site.id, site.name)}
                                className="px-3 py-1 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
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
            <p className="text-xs text-[#4a5568]">v{version}</p>
            {user?.is_admin && apiVersion && (
              <p className="text-xs text-[#4a5568] mt-1">API v{apiVersion}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
