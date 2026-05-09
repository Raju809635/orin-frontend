import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { api } from "@/lib/api";

const INSTALLATION_ID_KEY = "orin_installation_id";

function makeInstallationId() {
  return `orin-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

async function getInstallationId() {
  const existing = await AsyncStorage.getItem(INSTALLATION_ID_KEY);
  if (existing) return existing;
  const next = makeInstallationId();
  await AsyncStorage.setItem(INSTALLATION_ID_KEY, next);
  return next;
}

export async function recordAppMetric(eventName: "app_open" | "login" | "error", extra: Record<string, unknown> = {}) {
  try {
    const constants = Constants as any;
    await api.post(
      "/api/app-metrics/event",
      {
        installationId: await getInstallationId(),
        eventName,
        appName: "orin",
        appVersion: Constants.expoConfig?.version || constants.nativeAppVersion || "",
        buildNumber: constants.nativeBuildVersion || "",
        platform: Platform.OS,
        osVersion: String(Platform.Version || ""),
        deviceBrand: constants.brand || "",
        deviceModel: constants.deviceName || constants.modelName || "",
        ...extra
      },
      { timeout: 5000 }
    );
  } catch {
    // Metrics must never block app launch, login, or navigation.
  }
}
