import { api } from './api';

export interface User {
  id: string;
  email: string;
  username?: string;
  is_admin: boolean;
  created_at: string;
  needs_username_setup?: boolean;
}

export interface RegisterData {
  email: string;
  username: string;
  password: string;
}

export interface LoginData {
  email: string;
  password: string;
}

export interface SetupUsernameData {
  username: string;
}

export interface AuthResponse {
  access_token: string;
  user: User;
}

export const authService = {
  /**
   * Register a new user
   */
  async register(data: RegisterData): Promise<AuthResponse> {
    const response = await api.post<AuthResponse>('/auth/register', data);
    return response.data;
  },

  /**
   * Login with email and password
   */
  async login(data: LoginData): Promise<AuthResponse> {
    const response = await api.post<AuthResponse>('/auth/login', data);
    return response.data;
  },

  /**
   * Get current user profile
   */
  async getCurrentUser(): Promise<User> {
    const response = await api.get<User>('/auth/me');
    return response.data;
  },

  /**
   * Logout (clear local storage)
   */
  logout(): void {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
  },

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return !!localStorage.getItem('access_token');
  },

  /**
   * Get stored access token
   */
  getAccessToken(): string | null {
    return localStorage.getItem('access_token');
  },

  /**
   * Set access token in local storage
   */
  setAccessToken(token: string): void {
    localStorage.setItem('access_token', token);
  },

  /**
   * Get stored user
   */
  getStoredUser(): User | null {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  },

  /**
   * Set user in local storage
   */
  setStoredUser(user: User): void {
    localStorage.setItem('user', JSON.stringify(user));
  },

  /**
   * Setup username for existing users
   */
  async setupUsername(data: SetupUsernameData): Promise<{ user: User }> {
    const response = await api.post<{ user: User }>('/auth/setup-username', data);
    return response.data;
  },

  /**
   * Check if username is available
   */
  async checkUsernameAvailability(username: string): Promise<boolean> {
    const response = await api.get<{ available: boolean }>(
      `/auth/check-username?username=${encodeURIComponent(username)}`
    );
    return response.data.available;
  },
};
