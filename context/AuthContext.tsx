import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
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
  phoneNumber?: string;
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
  refreshToken: string;
  user: AuthUser;
};

type RefreshResponse = {
  token: string;
  refreshToken: string;
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const refreshRequestRef = useRef<Promise<string> | null>(null);

  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      try {
        const session = await loadAuthSession();
        if (!mounted || !session) {
          return;
        }

        setToken(session.token);
        setRefreshToken(session.refreshToken);
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

  const logout = useCallback(async () => {
    setToken(null);
    setRefreshToken(null);
    setUser(null);
    setApiAuthToken(null);
    await clearAuthSession();
  }, []);

  const login = useCallback(async (payload: LoginPayload) => {
    const { data } = await api.post<LoginResponse>("/api/auth/login", payload);
    setToken(data.token);
    setRefreshToken(data.refreshToken);
    setUser(data.user);
    setApiAuthToken(data.token);
    await saveAuthSession(data.token, data.refreshToken, data.user);
  }, []);

  const register = useCallback(async (payload: RegisterPayload) => {
    await api.post("/api/auth/register", payload);
  }, []);

  useEffect(() => {
    const interceptorId = api.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error?.config as
          | (Record<string, any> & { url?: string; headers?: Record<string, string>; _retry?: boolean })
          | undefined;
        const status = error?.response?.status;
        const url = (originalRequest?.url || "").toString();

        const isRefreshCall = url.includes("/api/auth/refresh");
        const isAuthPublicCall =
          url.includes("/api/auth/login") ||
          url.includes("/api/auth/register") ||
          url.includes("/api/auth/forgot-password") ||
          url.includes("/api/auth/reset-password");
        const shouldTryRefresh =
          status === 401 &&
          !isRefreshCall &&
          !isAuthPublicCall &&
          !originalRequest?._retry &&
          !!refreshToken;

        if (!shouldTryRefresh || !originalRequest) {
          return Promise.reject(error);
        }

        originalRequest._retry = true;

        try {
          if (!refreshRequestRef.current) {
            refreshRequestRef.current = (async () => {
              const { data } = await api.post<RefreshResponse>("/api/auth/refresh", { refreshToken });
              const nextToken = data.token;
              const nextRefreshToken = data.refreshToken || refreshToken;

              setToken(nextToken);
              setRefreshToken(nextRefreshToken);
              setApiAuthToken(nextToken);

              if (user) {
                await saveAuthSession(nextToken, nextRefreshToken, user);
              }

              return nextToken;
            })().finally(() => {
              refreshRequestRef.current = null;
            });
          }

          const nextToken = await refreshRequestRef.current;
          originalRequest.headers = originalRequest.headers || {};
          originalRequest.headers.Authorization = `Bearer ${nextToken}`;
          return api.request(originalRequest);
        } catch (refreshError) {
          await logout();
          return Promise.reject(refreshError);
        }
      }
    );

    return () => {
      api.interceptors.response.eject(interceptorId);
    };
  }, [logout, refreshToken, user]);

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
    [user, token, isBootstrapping, login, register, logout]
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
