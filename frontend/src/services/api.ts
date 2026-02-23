import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

// CSRF token management
let csrfToken: string | null = null;

// Function to fetch CSRF token
export const fetchCsrfToken = async (): Promise<string> => {
  try {
    const response = await axios.get(`${API_BASE_URL}/auth/csrf-token`, {
      withCredentials: true,
    });
    const token = response.data.csrfToken as string;
    csrfToken = token;
    return token;
  } catch (error) {
    console.error('Failed to fetch CSRF token:', error);
    throw error;
  }
};

// Initialize CSRF token on module load
fetchCsrfToken().catch((error) => {
  console.warn('Initial CSRF token fetch failed:', error);
});

// Create axios instance
export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Enable credentials to allow cookies
});

// Request interceptor to add auth token and CSRF token
api.interceptors.request.use(
  async (config) => {
    // Add JWT auth token
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Add CSRF token for state-changing requests
    const method = config.method?.toLowerCase();
    if (method && ['post', 'put', 'patch', 'delete'].includes(method)) {
      // Fetch token if not already cached
      if (!csrfToken) {
        try {
          await fetchCsrfToken();
        } catch (error) {
          console.error('Failed to get CSRF token for request:', error);
        }
      }

      if (csrfToken) {
        config.headers['X-CSRF-Token'] = csrfToken;
      }
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Handle CSRF token errors - refetch token and retry once
    if (
      error.response?.status === 403 &&
      error.response?.data?.message?.toLowerCase().includes('csrf') &&
      !originalRequest._retry
    ) {
      originalRequest._retry = true;
      try {
        await fetchCsrfToken();
        if (csrfToken) {
          originalRequest.headers['X-CSRF-Token'] = csrfToken;
        }
        return api(originalRequest);
      } catch (retryError) {
        return Promise.reject(retryError);
      }
    }

    // Handle auth token errors
    if (error.response?.status === 401) {
      // Token expired or invalid - clear auth state
      localStorage.removeItem('access_token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }

    return Promise.reject(error);
  },
);
