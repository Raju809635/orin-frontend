import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api, setApiAuthToken } from "@/lib/api";
import {
  AuthUser,
  clearAuthSession,
  loadAuthSession,
  saveAuthSession
} from "@/services/tokenStorage";

type RegisterPayload = {
  name: string;
  email: string;
  password: string;
  role: "student" | "mentor";
  domain?: string;
};

type LoginPayload = {
  email: string;
  password: string;
};

type AuthContextType = {
  user: AuthUser | null;
  token: string | null;
  isBootstrapping: boolean;
  isAuthenticated: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

type LoginResponse = {
  token: string;
  user: AuthUser;
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      try {
        const session = await loadAuthSession();
        if (!mounted || !session) {
          return;
        }

        setToken(session.token);
        setUser(session.user);
        setApiAuthToken(session.token);
      } finally {
        if (mounted) {
          setIsBootstrapping(false);
        }
      }
    }

    bootstrap();

    return () => {
      mounted = false;
    };
  }, []);

  async function login(payload: LoginPayload) {
    const { data } = await api.post<LoginResponse>("/api/auth/login", payload);
    setToken(data.token);
    setUser(data.user);
    setApiAuthToken(data.token);
    await saveAuthSession(data.token, data.user);
  }

  async function register(payload: RegisterPayload) {
    await api.post("/api/auth/register", payload);
  }

  async function logout() {
    setToken(null);
    setUser(null);
    setApiAuthToken(null);
    await clearAuthSession();
  }

  const value = useMemo(
    () => ({
      user,
      token,
      isBootstrapping,
      isAuthenticated: Boolean(user && token),
      login,
      register,
      logout
    }),
    [user, token, isBootstrapping]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}
