import { api } from './api';

export interface AlbumStatRow {
  username: string;
  email: string;
  images_uploaded: number;
  videos_uploaded: number;
  images_viewed: number;
  videos_viewed: number;
  storage_used: number;
}

export interface UserData {
  id: string;
  email: string;
  username: string;
  is_admin: boolean;
  last_login: string | null;
  needs_password_reset: boolean;
  is_locked: boolean;
  failed_login_attempts: number;
  last_failed_login: string | null;
  locked_at: string | null;
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
   * Get all usernames (for pilot selection)
   */
  async getUsernames(): Promise<string[]> {
    const response = await api.get<string[]>('/users/usernames');
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

  /**
   * Unlock a locked user account (admin only)
   */
  async unlockAccount(id: string): Promise<void> {
    await api.patch(`/users/${id}/unlock`);
  },

  /**
   * Get per-user album stats (admin only)
   */
  async getAlbumStats(): Promise<AlbumStatRow[]> {
    const response = await api.get<AlbumStatRow[]>('/users/album-stats');
    return response.data;
  },
};
