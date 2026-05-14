import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { api } from "@/lib/api";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true
  })
});

let lastRegisteredToken = "";

function getProjectId() {
  return (
    Constants.easConfig?.projectId ||
    (Constants.expoConfig?.extra as any)?.eas?.projectId ||
    (Constants.expoConfig as any)?.extra?.projectId ||
    ""
  );
}

async function ensureAndroidChannel() {
  if (Platform.OS !== "android") return;

  await Notifications.setNotificationChannelAsync("default", {
    name: "ORIN updates",
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#22C55E"
  });
}

export async function registerForPushNotifications() {
  if (Platform.OS === "web" || !Device.isDevice) return null;

  try {
    await ensureAndroidChannel();

    const existing = await Notifications.getPermissionsAsync();
    let finalStatus = existing.status;
    if (existing.status !== "granted") {
      const requested = await Notifications.requestPermissionsAsync();
      finalStatus = requested.status;
    }

    if (finalStatus !== "granted") return null;

    const projectId = getProjectId();
    if (!projectId) return null;

    const tokenResult = await Notifications.getExpoPushTokenAsync({ projectId });
    const expoPushToken = tokenResult.data;
    if (!expoPushToken) return null;

    await api.post("/api/messages/push-token", {
      expoPushToken,
      platform: Platform.OS,
      deviceId: `${Device.brand || "device"}-${Device.modelName || "unknown"}`,
      appVersion: Constants.expoConfig?.version || ""
    });

    lastRegisteredToken = expoPushToken;
    return expoPushToken;
  } catch {
    return null;
  }
}

export async function unregisterLastPushToken() {
  if (!lastRegisteredToken) return;
  try {
    await api.delete("/api/messages/push-token", {
      data: {
        expoPushToken: lastRegisteredToken,
        platform: Platform.OS,
        deviceId: "",
        appVersion: Constants.expoConfig?.version || ""
      }
    });
  } catch {
    // logout should never be blocked by notification cleanup
  } finally {
    lastRegisteredToken = "";
  }
}

export async function setPushNotificationsEnabled(enabled: boolean) {
  if (enabled) {
    return registerForPushNotifications();
  }
  await unregisterLastPushToken();
  return null;
}

export async function getPushNotificationStatus() {
  if (Platform.OS === "web") return { available: false, granted: false, status: "web" };
  if (!Device.isDevice) return { available: false, granted: false, status: "simulator" };
  const permissions = await Notifications.getPermissionsAsync();
  return {
    available: true,
    granted: permissions.status === "granted",
    status: permissions.status
  };
}

export function addNotificationTapListener(onOpen: (data: Record<string, any>) => void) {
  return Notifications.addNotificationResponseReceivedListener((response) => {
    const data = (response.notification.request.content.data || {}) as Record<string, any>;
    onOpen(data);
  });
}
