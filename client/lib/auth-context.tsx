'use client';

import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useRouter } from 'next/navigation';
import type { User, LoginInput, RegisterInput } from '@shared/types/user';
import type { AuthResponse } from '@shared/types/auth';
import { apiClient } from '@/lib/api-client';
import { disconnectSocket } from '@/lib/socket';

const TOKEN_KEY = 'auth_token';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

function setTokenCookie(token: string) {
  document.cookie = `${TOKEN_KEY}=${token}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
}

function clearTokenCookie() {
  document.cookie = `${TOKEN_KEY}=; path=/; max-age=0`;
}

export interface AuthContextValue {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  // Hydrate auth state on mount
  useEffect(() => {
    const storedToken = localStorage.getItem(TOKEN_KEY);
    if (!storedToken) {
      setIsLoading(false);
      return;
    }

    setToken(storedToken);
    apiClient
      .get<{ user: User }>('/auth/me')
      .then((data) => {
        setUser(data.user);
      })
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY);
        clearTokenCookie();
        setToken(null);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  const login = useCallback(
    async (input: LoginInput) => {
      const data = await apiClient.post<AuthResponse>('/auth/login', input);
      localStorage.setItem(TOKEN_KEY, data.token);
      setTokenCookie(data.token);
      setToken(data.token);
      setUser(data.user);

      if (data.user.role === 'admin') {
        router.push('/dashboard');
      } else {
        router.push('/products');
      }
    },
    [router],
  );

  const register = useCallback(
    async (input: RegisterInput) => {
      const data = await apiClient.post<AuthResponse>(
        '/auth/register',
        input,
      );
      localStorage.setItem(TOKEN_KEY, data.token);
      setTokenCookie(data.token);
      setToken(data.token);
      setUser(data.user);
      router.push('/products');
    },
    [router],
  );

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    clearTokenCookie();
    setToken(null);
    setUser(null);
    disconnectSocket();
    router.push('/login');
  }, [router]);

  const value = useMemo(
    () => ({ user, token, isLoading, login, register, logout }),
    [user, token, isLoading, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
