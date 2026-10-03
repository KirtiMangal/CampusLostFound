import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authApi, authToken } from '../services/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const clearSession = useCallback(() => {
    authToken.clear();
    setUser(null);
  }, []);

  useEffect(() => {
    let active = true;
    const onExpired = () => { if (active) setUser(null); };
    window.addEventListener('campus-auth-expired', onExpired);

    async function restoreSession() {
      if (!authToken.get()) {
        if (active) setLoading(false);
        return;
      }
      try {
        const { user: restoredUser } = await authApi.me();
        if (active) setUser(restoredUser);
      } catch {
        if (active) clearSession();
      } finally {
        if (active) setLoading(false);
      }
    }

    void restoreSession();
    return () => {
      active = false;
      window.removeEventListener('campus-auth-expired', onExpired);
    };
  }, [clearSession]);

  const login = useCallback(async (credentials) => {
    const result = await authApi.login(credentials);
    authToken.set(result.token);
    setUser(result.user);
    return result.user;
  }, []);

  const register = useCallback(async (details) => {
    const result = await authApi.register(details);
    authToken.set(result.token);
    setUser(result.user);
    return result.user;
  }, []);

  const logout = useCallback(() => clearSession(), [clearSession]);
  const value = useMemo(() => ({ user, isAuthenticated: Boolean(user), loading, login, register, logout }), [user, loading, login, register, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider.');
  return context;
}
