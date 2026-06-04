import { apiClient } from '@/services/apiClient';
import type { User } from '@/types/models';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://api.localhost';

export const authService = {
  /**
   * Redirect to Keycloak login page (via backend proxy).
   * After login Keycloak redirects → /api/auth/callback → frontend dashboard.
   */
  login(): void {
    window.location.href = `${API_BASE}/api/auth/login`;
  },

  /**
   * Authenticate directly using username and password.
   */
  async loginDirect(username: string, password: string): Promise<void> {
    await apiClient.post('/auth/login', { username, password });
  },

  /**
   * Register a new user and automatically authenticate them.
   */
  async register(username: string, email: string, password: string, firstName?: string, lastName?: string): Promise<void> {
    await apiClient.post('/auth/register', { username, email, password, firstName, lastName });
  },

  /**
   * Clear server session + Keycloak SSO session, redirect to home.
   */
  logout(): void {
    window.location.href = `${API_BASE}/api/auth/logout`;
  },

  /**
   * Fetch the current user from the server-side session.
   * Returns null if not authenticated (no 401 thrown — used for app init).
   */
  async getProfile(): Promise<User | null> {
    try {
      const res = await apiClient.get<User>('/auth/me');
      return res.data;
    } catch {
      return null;
    }
  },

  /**
   * Update the current authenticated user's profile info.
   */
  async updateProfile(firstName?: string, lastName?: string, email?: string): Promise<void> {
    await apiClient.put('/auth/me', { firstName, lastName, email });
  },
};
