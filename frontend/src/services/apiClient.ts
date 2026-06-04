import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://api.localhost';

/**
 * Axios instance with credentials (session cookie) automatically attached.
 * All feature-specific API modules import this client.
 */
export const apiClient = axios.create({
  baseURL: `${API_BASE}/api`,
  withCredentials: true,          // send HttpOnly session cookie
  headers: { 'Content-Type': 'application/json' },
});

// Redirect to login on 401 (session expired)
apiClient.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      // Do not auto-redirect on profile checks (allows landing page to load for anonymous users)
      const isProfileCheck = error.config?.url?.includes('/auth/me');
      if (!isProfileCheck) {
        window.location.href = `${API_BASE}/api/auth/login`;
      }
    }
    return Promise.reject(error);
  },
);
