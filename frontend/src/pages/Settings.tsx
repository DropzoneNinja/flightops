import { useState, useMemo, useEffect } from 'react';
import { useSettings } from '../hooks/useSettings';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { SettingType, UpdateSettingData } from '../services/settings.service';
import { preAuthorizedEmailsService, PreAuthorizedEmail } from '../services/pre-authorized-emails.service';
import { usersService, UserData } from '../services/users.service';
import { weatherService, WeatherApiStats } from '../services/weather.service';

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

  // Weather API stats state (admin only)
  const [weatherStats, setWeatherStats] = useState<WeatherApiStats | null>(null);
  const [loadingWeatherStats, setLoadingWeatherStats] = useState(false);

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
                <button
                  onClick={handleResetWeatherStats}
                  className="px-4 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 transition-colors"
                >
                  Reset Stats
                </button>
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
                        at {new Date(weatherStats.maxPerHour.hour).toLocaleString()}
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
      </div>
    </div>
  );
}
