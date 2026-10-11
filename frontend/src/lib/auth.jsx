import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api } from "./api.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    api("/auth/session")
      .then((d) => setUser(d.user))
      .catch(() => setUser(null))
      .finally(() => setReady(true));
  }, []);

  const login = useCallback(async (email, password, code) => {
    const d = await api("/auth/login", { method: "POST", body: { email, password, ...(code ? { code } : {}) } });
    if (d.mfaRequired) return { mfaRequired: true };
    setUser(d.user);
    return { user: d.user };
  }, []);

  const register = useCallback(async (fields) => {
    const d = await api("/auth/register", { method: "POST", body: fields });
    setUser(d.user);
    return d.user;
  }, []);

  const logout = useCallback(async () => {
    await api("/auth/logout", { method: "POST" }).catch(() => {});
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, setUser, ready, login, register, logout }), [user, ready, login, register, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
