import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import api, { storage } from "../services/api";

const AuthContext = createContext(null);

export const HOME_BY_ROLE = { admin: "/admin", faculty: "/faculty", student: "/student" };

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(Boolean(storage.get()));

  const loadMe = useCallback(async () => {
    if (!storage.get()) {
      setLoading(false);
      return;
    }
    try {
      const { data } = await api.get("/auth/me");
      setUser(data.data.user);
      setProfile(data.data.profile);
    } catch {
      storage.clear();
      setUser(null);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMe();
  }, [loadMe]);

  useEffect(() => {
    const onExpired = (e) => {
      setUser((prev) => {
        if (prev) toast.error(e.detail || "Session expired, please log in again");
        return null;
      });
      setProfile(null);
    };
    window.addEventListener("auth:expired", onExpired);
    return () => window.removeEventListener("auth:expired", onExpired);
  }, []);

  const login = useCallback(async (identifier, password) => {
    const { data } = await api.post("/auth/login", { identifier, password });
    storage.set(data.data.token);
    setUser(data.data.user);
    setProfile(data.data.profile);
    return data.data.user;
  }, []);

  const logout = useCallback(async () => {
    try { await api.post("/auth/logout"); } catch { /* token may already be invalid */ }
    storage.clear();
    setUser(null);
    setProfile(null);
  }, []);

  const value = useMemo(
    () => ({ user, profile, loading, login, logout, refresh: loadMe, setUser, setProfile }),
    [user, profile, loading, login, logout, loadMe]
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
