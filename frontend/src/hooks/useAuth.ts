import { create } from 'zustand';
import { authService, User, RegisterData, LoginData, SetupUsernameData } from '../services/auth.service';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  register: (data: RegisterData) => Promise<void>;
  login: (data: LoginData) => Promise<void>;
  setupUsername: (data: SetupUsernameData) => Promise<void>;
  logout: () => void;
  loadUser: () => Promise<void>;
  clearError: () => void;
}

export const useAuth = create<AuthState>((set) => ({
  user: authService.getStoredUser(),
  isAuthenticated: authService.isAuthenticated(),
  isLoading: false,
  error: null,

  register: async (data: RegisterData) => {
    try {
      set({ isLoading: true, error: null });
      const response = await authService.register(data);

      // Store token and user
      authService.setAccessToken(response.access_token);
      authService.setStoredUser(response.user);

      set({
        user: response.user,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.message || 'Registration failed';
      set({ isLoading: false, error: errorMessage });
      throw error;
    }
  },

  login: async (data: LoginData) => {
    try {
      set({ isLoading: true, error: null });
      const response = await authService.login(data);

      // Store token and user
      authService.setAccessToken(response.access_token);
      authService.setStoredUser(response.user);

      set({
        user: response.user,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Login failed';
      set({ isLoading: false, error: errorMessage });
      throw error;
    }
  },

  setupUsername: async (data: SetupUsernameData) => {
    try {
      set({ isLoading: true, error: null });
      const response = await authService.setupUsername(data);

      // Update stored user
      authService.setStoredUser(response.user);

      set({
        user: response.user,
        isLoading: false,
        error: null,
      });
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.message || 'Failed to setup username';
      set({ isLoading: false, error: errorMessage });
      throw error;
    }
  },

  logout: () => {
    authService.logout();
    set({
      user: null,
      isAuthenticated: false,
      error: null,
    });
  },

  loadUser: async () => {
    if (!authService.isAuthenticated()) {
      set({ isAuthenticated: false, user: null });
      return;
    }

    try {
      set({ isLoading: true });
      const user = await authService.getCurrentUser();

      authService.setStoredUser(user);
      set({
        user,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (error) {
      // Token invalid or expired
      authService.logout();
      set({
        user: null,
        isAuthenticated: false,
        isLoading: false,
      });
    }
  },

  clearError: () => {
    set({ error: null });
  },
}));
