import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import type {
  LoginInput,
  RegisterInput,
  UpdateProfileInput,
  UserProfile,
} from '@discvault/shared';
import {
  checkApiHealth,
  fetchCurrentUser,
  loginRequest,
  logoutRequest,
  registerRequest,
  updateProfileRequest,
} from '../api';

export type ApiStatus = 'checking' | 'api' | 'offline';

export interface AuthContextValue {
  /** `api` means the backend and PostgreSQL are reachable. */
  status: ApiStatus;
  user: UserProfile | null;
  isApiMode: boolean;
  isAuthenticated: boolean;
  /** Admin or moderator: the account can open the moderation queue. */
  isModerator: boolean;
  /** Administrator: the account can manage users and block accounts. */
  isAdmin: boolean;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (input: UpdateProfileInput) => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Detects whether the API is usable and restores the cookie session. When the
 * API failure is explicit; business data is never replaced by browser demo data.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<ApiStatus>('checking');
  const [user, setUser] = useState<UserProfile | null>(null);

  const refresh = useCallback(async () => {
    setStatus('checking');

    const controller = new AbortController();
    const isHealthy = await checkApiHealth(controller.signal);

    if (!isHealthy) {
      setStatus('offline');
      setUser(null);
      return;
    }

    setStatus('api');

    try {
      const response = await fetchCurrentUser();
      setUser(response.user);
    } catch {
      // A 401 simply means there is no active session. The API is still usable.
      setUser(null);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(async (input: LoginInput) => {
    const response = await loginRequest(input);
    setStatus('api');
    setUser(response.user);
  }, []);

  const register = useCallback(async (input: RegisterInput) => {
    const response = await registerRequest(input);
    setStatus('api');
    setUser(response.user);
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutRequest();
    } finally {
      setUser(null);
    }
  }, []);

  const updateProfile = useCallback(async (input: UpdateProfileInput) => {
    const response = await updateProfileRequest(input);
    setUser(response.user);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      isApiMode: status === 'api',
      isAuthenticated: Boolean(user),
      isModerator:
        user?.role === 'admin' || user?.role === 'moderator',
      isAdmin: user?.role === 'admin',
      login,
      register,
      logout,
      updateProfile,
      refresh,
    }),
    [login, logout, refresh, register, status, updateProfile, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider.');
  }

  return context;
}
