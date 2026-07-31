/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { apiRequest, tokenStorage } from "../lib/api";

interface AuthContextValue {
  token: string | null;
  user: { id: string; email: string; name?: string | null; role: string } | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{ id: string; email: string; name?: string | null; role: string }>;
  signup: (email: string, password: string, name?: string) => Promise<{ id: string; email: string; name?: string | null; role: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<{ id: string; email: string; name?: string | null; role: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = tokenStorage.get();
    if (!stored) {
      setLoading(false);
      return;
    }
    setToken(stored);
    apiRequest<{ id: string; email: string; name?: string | null; role: string }>("/auth/me")
      .then(setUser)
      .catch(() => {
        tokenStorage.clear();
        setToken(null);
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    if (!email || !password) throw new Error("Enter an email and password.");
    const response = await apiRequest<{ token: string; user: { id: string; email: string; name?: string | null; role: string } }>("/auth/login", {
      method: "POST",
      auth: false,
      body: JSON.stringify({ email, password })
    });
    tokenStorage.set(response.token);
    setToken(response.token);
    setUser(response.user);
    return response.user;
  }, []);

  const signup = useCallback(async (email: string, password: string, name?: string) => {
    if (!email || !password || !name) throw new Error("Enter your name, email and password.");
    const response = await apiRequest<{ token: string; user: { id: string; email: string; name?: string | null; role: string } }>("/auth/signup", {
      method: "POST",
      auth: false,
      body: JSON.stringify({ email, password, name, loginUrl: `${window.location.origin}/login` })
    });
    tokenStorage.set(response.token);
    setToken(response.token);
    setUser(response.user);
    return response.user;
  }, []);

  const logout = useCallback(() => {
    tokenStorage.clear();
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      token,
      user,
      loading,
      isAuthenticated: Boolean(token),
      login,
      signup,
      logout
    }),
    [token, user, loading, login, signup, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
