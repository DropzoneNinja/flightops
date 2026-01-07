import { api } from './api';

export interface UserData {
  id: string;
  email: string;
  username: string;
  is_admin: boolean;
  last_login: string | null;
  needs_password_reset: boolean;
  created_at: string;
  updated_at: string;
}

export const usersService = {
  /**
   * Get all users (admin only)
   */
  async getAll(): Promise<UserData[]> {
    const response = await api.get<UserData[]>('/users');
    return response.data;
  },

  /**
   * Delete a user (admin only)
   */
  async delete(id: string): Promise<void> {
    await api.delete(`/users/${id}`);
  },

  /**
   * Flag user for password reset on next login
   */
  async flagPasswordReset(id: string): Promise<void> {
    await api.patch(`/users/${id}/reset-password`);
  },
};
