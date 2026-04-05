import { useState, useEffect, useCallback } from 'react';
import { api, setToken, clearToken, hasToken, ApiError } from '../api/client';

interface AuthState {
  isAuthenticated: boolean;
  setupRequired: boolean | null;
  loading: boolean;
  error: string | null;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    isAuthenticated: hasToken(),
    setupRequired: null,
    loading: true,
    error: null,
  });

  const checkStatus = useCallback(async () => {
    try {
      const res = await api.get<{ setupRequired: boolean }>('/api/auth/status');
      setState((prev) => ({
        ...prev,
        setupRequired: res.setupRequired,
        loading: false,
      }));
    } catch {
      setState((prev) => ({ ...prev, loading: false }));
    }
  }, []);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  const login = useCallback(async (username: string, password: string) => {
    setState((prev) => ({ ...prev, error: null, loading: true }));
    try {
      const res = await api.post<{ token: string }>('/api/auth/login', { username, password });
      setToken(res.token);
      setState((prev) => ({
        ...prev,
        isAuthenticated: true,
        loading: false,
      }));
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Login failed';
      setState((prev) => ({ ...prev, error: message, loading: false }));
      throw err;
    }
  }, []);

  const setup = useCallback(async (username: string, password: string) => {
    setState((prev) => ({ ...prev, error: null, loading: true }));
    try {
      const res = await api.post<{ token: string }>('/api/auth/setup', { username, password });
      setToken(res.token);
      setState((prev) => ({
        ...prev,
        isAuthenticated: true,
        setupRequired: false,
        loading: false,
      }));
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Setup failed';
      setState((prev) => ({ ...prev, error: message, loading: false }));
      throw err;
    }
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setState((prev) => ({ ...prev, isAuthenticated: false }));
  }, []);

  return { ...state, login, setup, logout };
}
