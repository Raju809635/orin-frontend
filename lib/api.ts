import axios from "axios";
import Constants from "expo-constants";
import { Platform } from "react-native";

function getApiBaseUrl() {
  const extraApiUrl = (Constants.expoConfig?.extra as any)?.apiBaseUrl as string | undefined;
  const explicitUrl = process.env.EXPO_PUBLIC_API_BASE_URL || extraApiUrl;
  const isDev = typeof __DEV__ !== "undefined" ? __DEV__ : process.env.NODE_ENV !== "production";

  if (explicitUrl) {
    return explicitUrl;
  }

  if (!isDev) {
    // Keep production web exports working even if env vars are missing on the build server.
    // You can always override with EXPO_PUBLIC_API_BASE_URL.
    return "https://orin-backend.onrender.com";
  }

  if (Platform.OS === "android") {
    return "http://10.0.2.2:5000";
  }

  const hostUri = Constants.expoConfig?.hostUri;
  const host = hostUri?.split(":")[0];

  if (host) {
    return `http://${host}:5000`;
  }

  return "http://localhost:5000";
}

export const api = axios.create({
  baseURL: getApiBaseUrl(),
  timeout: 15000
});

const RETRYABLE_STATUS = new Set([502, 503, 504, 521, 522, 523, 524]);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error?.config as
      | (Record<string, any> & { method?: string; _networkRetryCount?: number; url?: string })
      | undefined;

    if (!originalRequest) {
      return Promise.reject(error);
    }

    const method = String(originalRequest.method || "get").toLowerCase();
    const status = Number(error?.response?.status || 0);
    const isSafeGet = method === "get";
    const isRetryableFailure =
      !error?.response || RETRYABLE_STATUS.has(status);

    if (!isSafeGet || !isRetryableFailure) {
      return Promise.reject(error);
    }

    const retryCount = Number(originalRequest._networkRetryCount || 0);
    if (retryCount >= 1) {
      return Promise.reject(error);
    }

    originalRequest._networkRetryCount = retryCount + 1;
    await new Promise((resolve) => setTimeout(resolve, 1200));
    return api.request(originalRequest);
  }
);

export function setApiAuthToken(token: string | null) {
  if (!token) {
    delete api.defaults.headers.common.Authorization;
    return;
  }

  api.defaults.headers.common.Authorization = `Bearer ${token}`;
}

export async function pingBackendReady() {
  const { data } = await api.get<{ ready?: boolean; ok?: boolean }>("/ready", {
    timeout: 6000
  });
  return Boolean(data?.ready ?? data?.ok);
}
