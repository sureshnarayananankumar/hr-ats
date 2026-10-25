import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api, ApiError, setSessionExpiredHandler } from './api';
import type { CurrentUser, RoleName } from './types';

interface AuthContextValue {
  user: CurrentUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  /** True when the server demanded an MFA code at sign-in. */
  mfaPending: boolean;
  login: (email: string, password: string) => Promise<{ mfaRequired: boolean }>;
  verifyMfa: (code: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  /**
   * Permission check used for MENU VISIBILITY ONLY.
   *
   * This is a convenience for the UI, never a security boundary: the
   * backend independently enforces every permission, so hiding a button
   * here changes nothing about what the API will accept.
   */
  can: (permission: string) => boolean;
  canAny: (...permissions: string[]) => boolean;
  hasRole: (...roles: RoleName[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [mfaPending, setMfaPending] = useState(false);

  const loadUser = useCallback(async () => {
    try {
      const profile = await api.get<CurrentUser>('/auth/me');
      setUser(profile);
      setMfaPending(false);
    } catch (error) {
      // A 401 here simply means "not signed in" -- it is the normal
      // path on first load, not an error worth surfacing.
      if (!(error instanceof ApiError && error.isUnauthorized)) {
        console.error('Failed to load the current user', error);
      }
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUser();
  }, [loadUser]);

  // Clear local state when the API reports the session is unrecoverable.
  useEffect(() => {
    setSessionExpiredHandler(() => {
      setUser(null);
      setMfaPending(false);
    });
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const result = await api.post<{ mfaRequired: boolean; user?: CurrentUser }>(
        '/auth/login',
        { email, password },
      );

      if (result.mfaRequired) {
        setMfaPending(true);
        return { mfaRequired: true };
      }

      // Re-read the profile rather than trusting the login payload, so
      // permissions always come from a single source.
      await loadUser();
      return { mfaRequired: false };
    },
    [loadUser],
  );

  const verifyMfa = useCallback(
    async (code: string) => {
      await api.post('/auth/mfa/verify', { code });
      await loadUser();
    },
    [loadUser],
  );

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Even if the call fails, drop local state -- the user asked to
      // sign out and must not be left looking signed in.
    } finally {
      setUser(null);
      setMfaPending(false);
    }
  }, []);

  const value = useMemo<AuthContextValue>(() => {
    const permissions = new Set(user?.permissions ?? []);
    return {
      user,
      isLoading,
      isAuthenticated: Boolean(user),
      mfaPending,
      login,
      verifyMfa,
      logout,
      refreshUser: loadUser,
      can: (permission: string) => permissions.has(permission),
      canAny: (...list: string[]) => list.some((entry) => permissions.has(entry)),
      hasRole: (...roles: RoleName[]) =>
        roles.some((role) => user?.roles.includes(role) ?? false),
    };
  }, [user, isLoading, mfaPending, login, verifyMfa, logout, loadUser]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside an AuthProvider');
  return context;
}
