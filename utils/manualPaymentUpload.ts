import { NativeModulesProxy } from "expo-modules-core";
import { api } from "@/lib/api";

export async function submitManualPaymentWithPicker(sessionId: string, transactionReference = "") {
  const hasNativeImagePicker = Boolean((NativeModulesProxy as Record<string, unknown>)?.ExpoImagePicker);
  if (!hasNativeImagePicker) {
    throw new Error("This APK does not support screenshot upload yet. Please install the latest APK build.");
  }

  let ImagePicker: any;
  try {
    ImagePicker = await import("expo-image-picker");
  } catch {
    throw new Error("Image picker not available. Please install latest APK build.");
  }

  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error("Gallery permission is required to upload payment screenshot.");
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    quality: 0.85,
    allowsEditing: false
  });

  if (result.canceled || !result.assets?.length) {
    return { cancelled: true };
  }

  const asset = result.assets[0];
  const uri = asset.uri;
  const fileName = asset.fileName || `payment-${Date.now()}.jpg`;
  const mimeType = asset.mimeType || "image/jpeg";

  const formData = new FormData();
  formData.append("paymentScreenshotFile", {
    uri,
    name: fileName,
    type: mimeType
  } as any);
  if (transactionReference.trim()) {
    formData.append("transactionReference", transactionReference.trim());
  }

  await api.post(`/api/sessions/${sessionId}/manual-payment`, formData, {
    headers: {
      "Content-Type": "multipart/form-data"
    }
  });

  return { cancelled: false };
}
