'use client';

/**
 * Provedor de autenticação.
 *
 * Persiste `accessToken`, `refreshToken`, usuário e vínculos em `localStorage`
 * (chave `qualitytest.auth`). Só acessa `window`/`localStorage` em efeitos ou
 * quando `typeof window !== 'undefined'` (SSR seguro).
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import type { GlobalRole, ProjectRole, RegistrationStatus } from '@qualitytest/shared';

import { apiGet, apiPost, configureApiClient } from './api-client';
import type { LoginResult, MeResult } from './types';

const STORAGE_KEY = 'qualitytest.auth';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  globalRole: GlobalRole | null;
  status: RegistrationStatus;
}

export interface Membership {
  projectId: string;
  name: string;
  code: string;
  role: ProjectRole;
}

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
  memberships: Membership[];
}

const EMPTY_STATE: AuthState = {
  accessToken: null,
  refreshToken: null,
  user: null,
  memberships: [],
};

interface AuthContextValue {
  user: AuthUser | null;
  memberships: Membership[];
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function readStoredState(): AuthState | null {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === null) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<AuthState>;
    if (typeof parsed.accessToken !== 'string' || typeof parsed.refreshToken !== 'string') {
      return null;
    }
    return {
      accessToken: parsed.accessToken,
      refreshToken: parsed.refreshToken,
      user: parsed.user ?? null,
      memberships: Array.isArray(parsed.memberships) ? parsed.memberships : [],
    };
  } catch {
    return null;
  }
}

function persistState(state: AuthState): void {
  if (typeof window === 'undefined') {
    return;
  }
  if (state.accessToken === null || state.user === null) {
    window.localStorage.removeItem(STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(EMPTY_STATE);
  const [isLoading, setIsLoading] = useState(true);
  const stateRef = useRef<AuthState>(EMPTY_STATE);

  const commit = useCallback((next: AuthState) => {
    stateRef.current = next;
    persistState(next);
    setState(next);
  }, []);

  const refreshMe = useCallback(async (): Promise<void> => {
    const current = stateRef.current;
    if (current.accessToken === null) {
      return;
    }
    const me = await apiGet<MeResult>('/auth/me');
    commit({
      ...current,
      user: {
        id: me.user.id,
        name: me.user.name,
        email: me.user.email,
        globalRole: me.user.globalRole,
        status: me.user.status,
      },
      memberships: me.projects.map((project) => ({
        projectId: project.projectId,
        name: project.name,
        code: project.code,
        role: project.role,
      })),
    });
  }, [commit]);

  // Ponte com o cliente HTTP: fornece tokens e reage a refresh/logout.
  useEffect(() => {
    configureApiClient({
      getTokens: () => ({
        accessToken: stateRef.current.accessToken,
        refreshToken: stateRef.current.refreshToken,
      }),
      onTokensRefreshed: (next) => {
        const updated: AuthState = {
          ...stateRef.current,
          accessToken: next.accessToken,
          refreshToken: next.refreshToken,
        };
        stateRef.current = updated;
        persistState(updated);
        setState(updated);
      },
      onAuthLost: () => {
        stateRef.current = EMPTY_STATE;
        persistState(EMPTY_STATE);
        setState(EMPTY_STATE);
      },
    });
  }, []);

  // Reidratação no cliente.
  useEffect(() => {
    const stored = readStoredState();
    if (stored !== null) {
      stateRef.current = stored;
      setState(stored);
    }

    let active = true;
    const bootstrap = async (): Promise<void> => {
      if (stored !== null) {
        try {
          await refreshMe();
        } catch {
          // Token pode ter expirado: a ponte já cuidou do logout quando aplicável.
        }
      }
      if (active) {
        setIsLoading(false);
      }
    };
    void bootstrap();

    return () => {
      active = false;
    };
  }, [refreshMe]);

  const login = useCallback(
    async (email: string, password: string): Promise<void> => {
      const result = await apiPost<LoginResult>(
        '/auth/login',
        { email, password },
        { authenticated: false },
      );
      commit({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        user: {
          id: result.user.id,
          name: result.user.name,
          email: result.user.email,
          globalRole: result.user.globalRole,
          status: result.user.status,
        },
        memberships: [],
      });
      await refreshMe();
    },
    [commit, refreshMe],
  );

  const logout = useCallback(async (): Promise<void> => {
    const refreshToken = stateRef.current.refreshToken;
    commit(EMPTY_STATE);
    if (refreshToken !== null) {
      try {
        await apiPost('/auth/logout', { refreshToken }, { authenticated: false });
      } catch {
        // Logout local já efetuado; falha na revogação remota é tolerada.
      }
    }
  }, [commit]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: state.user,
      memberships: state.memberships,
      accessToken: state.accessToken,
      refreshToken: state.refreshToken,
      isAuthenticated: state.accessToken !== null && state.user !== null,
      isLoading,
      login,
      logout,
      refreshMe,
    }),
    [state, isLoading, login, logout, refreshMe],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === null) {
    throw new Error('useAuth deve ser usado dentro de <AuthProvider>.');
  }
  return context;
}
