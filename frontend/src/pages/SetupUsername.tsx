import { useState, FormEvent, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { authService } from '../services/auth.service';

export default function SetupUsername() {
  const navigate = useNavigate();
  const { setupUsername, isLoading, error, clearError } = useAuth();

  const [username, setUsername] = useState('');
  const [validationError, setValidationError] = useState('');
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [checkingUsername, setCheckingUsername] = useState(false);

  // Debounced username availability check
  useEffect(() => {
    if (username.length < 3) {
      setUsernameAvailable(null);
      return;
    }

    // Validate format first
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      setUsernameAvailable(null);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setCheckingUsername(true);
      try {
        const available = await authService.checkUsernameAvailability(username);
        setUsernameAvailable(available);
      } catch (error) {
        console.error('Failed to check username:', error);
        setUsernameAvailable(null);
      } finally {
        setCheckingUsername(false);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [username]);

  const handleUsernameChange = (value: string) => {
    setUsername(value);
    setUsernameAvailable(null);

    // Validate format
    if (value && !/^[a-zA-Z0-9_]+$/.test(value)) {
      setValidationError('Username can only contain letters, numbers, and underscores');
      return;
    }

    setValidationError('');
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    clearError();
    setValidationError('');

    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      setValidationError('Username can only contain letters, numbers, and underscores');
      return;
    }

    if (username.length < 3 || username.length > 20) {
      setValidationError('Username must be between 3 and 20 characters');
      return;
    }

    if (usernameAvailable === false) {
      setValidationError('Username is already taken');
      return;
    }

    try {
      await setupUsername({ username });
      navigate('/'); // Redirect to home page after setup
    } catch (error) {
      // Error is handled by the store
    }
  };

  const displayError = validationError || error;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <div className="flex justify-center mb-6">
            <img
              src="/logo.png"
              alt="Throttle Junkies"
              className="h-32 w-auto"
            />
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Choose a Username
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Before you continue, please set up your username
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {displayError && (
            <div className="rounded-md bg-red-50 p-4">
              <div className="text-sm text-red-800">{displayError}</div>
            </div>
          )}

          <div className="relative">
            <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">
              Username
            </label>
            <input
              id="username"
              name="username"
              type="text"
              autoComplete="username"
              required
              className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
              placeholder="Enter your username (3-20 characters)"
              value={username}
              onChange={(e) => handleUsernameChange(e.target.value)}
            />
            {checkingUsername && (
              <div className="absolute right-3 top-9">
                <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full"></div>
              </div>
            )}
            {usernameAvailable === true && !checkingUsername && username && (
              <div className="absolute right-3 top-9 text-green-600 font-bold">✓</div>
            )}
            {usernameAvailable === false && !checkingUsername && username && (
              <div className="absolute right-3 top-9 text-red-600 font-bold">✗</div>
            )}
            <p className="mt-2 text-xs text-gray-500">
              Username can only contain letters, numbers, and underscores
            </p>
          </div>

          <div>
            <button
              type="submit"
              disabled={isLoading || usernameAvailable === false || !username}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Setting up...' : 'Continue'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
