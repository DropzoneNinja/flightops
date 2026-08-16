import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { api } from '../services/api';

export default function ResetPassword() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate passwords match
    if (formData.newPassword !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    // Validate password length
    if (formData.newPassword.length < 9) {
      setError('Password must be at least 9 characters long');
      return;
    }

    // Validate password complexity
    if (!/(?=.*[A-Z])/.test(formData.newPassword)) {
      setError('Password must contain at least 1 uppercase letter');
      return;
    }

    if (!/(?=.*\d)/.test(formData.newPassword)) {
      setError('Password must contain at least 1 number');
      return;
    }

    try {
      setIsLoading(true);
      await api.patch('/auth/reset-password', {
        current_password: formData.currentPassword,
        new_password: formData.newPassword,
      });

      alert('Password updated successfully!');
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to reset password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!user?.needs_password_reset) {
    // If user doesn't need password reset, redirect to home
    navigate('/');
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0d1421] py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-white">
            Reset Your Password
          </h2>
          <p className="mt-2 text-center text-sm text-[#6b7fa3]">
            You are required to reset your password before continuing
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="rounded-md shadow-sm space-y-4">
            <div>
              <label htmlFor="current-password" className="block text-sm font-medium text-[#a0b3cc] mb-1">
                Temporary Password
              </label>
              <input
                id="current-password"
                name="currentPassword"
                type="password"
                autoComplete="current-password"
                required
                value={formData.currentPassword}
                onChange={(e) => setFormData({ ...formData, currentPassword: e.target.value })}
                className="appearance-none relative block w-full px-3 py-2 border bg-[#1e2a3a] border-[#2a3a54] placeholder-[#4a5a74] text-white rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Enter the temporary password your admin gave you"
              />
            </div>
            <div>
              <label htmlFor="new-password" className="block text-sm font-medium text-[#a0b3cc] mb-1">
                New Password
              </label>
              <input
                id="new-password"
                name="newPassword"
                type="password"
                autoComplete="new-password"
                required
                value={formData.newPassword}
                onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
                className="appearance-none relative block w-full px-3 py-2 border bg-[#1e2a3a] border-[#2a3a54] placeholder-[#4a5a74] text-white rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Enter new password (min 9 characters, 1 uppercase, 1 number)"
              />
            </div>
            <div>
              <label htmlFor="confirm-password" className="block text-sm font-medium text-[#a0b3cc] mb-1">
                Confirm Password
              </label>
              <input
                id="confirm-password"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                className="appearance-none relative block w-full px-3 py-2 border bg-[#1e2a3a] border-[#2a3a54] placeholder-[#4a5a74] text-white rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Confirm new password"
              />
            </div>
          </div>

          {error && (
            <div className="rounded-md bg-red-900/20 border border-red-800 p-4">
              <div className="flex">
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-400">{error}</h3>
                </div>
              </div>
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Resetting Password...' : 'Reset Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
