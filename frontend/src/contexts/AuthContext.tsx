import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { apiFetch } from '../lib/api';

interface User {
  id: string;
  email: string;
  name: string | null;
  systemRole: 'GENERAL_ADMIN' | 'USER';
  roleId: string | null;
  role: {
    id: string;
    name: string;
    color: string | null;
  } | null;
  companyId: string | null;
}

interface AuthContextValue {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (googleCredential: string) => Promise<void>;
  logout: () => Promise<void>;
  impersonate: (userId: string) => Promise<void>;
  stopImpersonating: () => Promise<void>;
  isImpersonating: boolean;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  token: null,
  isLoading: true,
  login: async () => {},
  logout: async () => {},
  impersonate: async () => {},
  stopImpersonating: async () => {},
  isImpersonating: false,
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isImpersonating, setIsImpersonating] = useState(() => !!localStorage.getItem('isImpersonating'));

  // Restore session on mount
  useEffect(() => {
    apiFetch<{ status: string; user: User; token: string }>('/api/auth/me')
      .then((data) => {
        if (data.status === 'ok') {
          setUser(data.user);
          setToken(data.token);
        }
      })
      .catch(() => {
        localStorage.removeItem('isImpersonating');
      })
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(async (googleCredential: string) => {
    const data = await apiFetch<{ status: string; user: User; token: string; message?: string }>(
      '/api/auth/google',
      {
        method: 'POST',
        body: JSON.stringify({ credential: googleCredential }),
      }
    );

    if (data.status === 'ok') {
      setUser(data.user);
      setToken(data.token);
    } else {
      throw new Error(data.message || 'Auth failed');
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {
      console.error('Logout error', e);
    }
    localStorage.removeItem('isImpersonating');
    setUser(null);
    setToken(null);
    setIsImpersonating(false);
  }, []);

  const impersonate = useCallback(async (userId: string) => {
    const data = await apiFetch<{ status: string; user: User; token: string }>(
      `/api/auth/impersonate/${userId}`,
      { method: 'POST' }
    );

    if (data.status === 'ok') {
      localStorage.setItem('isImpersonating', 'true');
      setUser(data.user);
      setToken(data.token);
      setIsImpersonating(true);
      // Reload to reset all query caches
      window.location.reload();
    }
  }, []);

  const stopImpersonating = useCallback(async () => {
    try {
      const data = await apiFetch<{ status: string }>('/api/auth/stop-impersonating', { method: 'POST' });
      if (data.status === 'ok') {
        localStorage.removeItem('isImpersonating');
        setIsImpersonating(false);
        // Reload to reset all query caches and restore admin session
        window.location.reload();
      }
    } catch (e) {
      console.error('Stop impersonating error', e);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout, impersonate, stopImpersonating, isImpersonating }}>
      {children}
    </AuthContext.Provider>
  );
}
