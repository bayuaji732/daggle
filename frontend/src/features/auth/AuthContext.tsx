import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import { authService } from './authService';
import type { User } from '@/types/models';

interface AuthState {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: () => void;
  loginDirect: (username: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string, firstName?: string, lastName?: string) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
  updateProfile: (firstName?: string, lastName?: string, email?: string) => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const profile = await authService.getProfile();
    setUser(profile);
  }, []);

  // On mount: check if session exists (cookie sent automatically)
  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  const loginDirect = useCallback(async (username: string, password: string) => {
    setLoading(true);
    try {
      await authService.loginDirect(username, password);
      await refresh();
    } finally {
      setLoading(false);
    }
  }, [refresh]);

  const register = useCallback(async (username: string, email: string, password: string, firstName?: string, lastName?: string) => {
    setLoading(true);
    try {
      await authService.register(username, email, password, firstName, lastName);
      await refresh();
    } finally {
      setLoading(false);
    }
  }, [refresh]);

  const updateProfile = useCallback(async (firstName?: string, lastName?: string, email?: string) => {
    setLoading(true);
    try {
      await authService.updateProfile(firstName, lastName, email);
      await refresh();
    } finally {
      setLoading(false);
    }
  }, [refresh]);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticated: user !== null,
        login: authService.login,
        loginDirect,
        register,
        logout: authService.logout,
        refresh,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
