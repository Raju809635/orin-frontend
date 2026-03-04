import { api } from "@/lib/api";
import { Platform } from "react-native";

export async function submitManualPaymentWithPicker(sessionId: string, transactionReference = "") {
  let ImagePicker: any;
  try {
    ImagePicker = await import("expo-image-picker");
  } catch {
    throw new Error("Image picker not available. Please install latest APK build.");
  }

  if (
    typeof ImagePicker?.requestMediaLibraryPermissionsAsync !== "function" ||
    typeof ImagePicker?.launchImageLibraryAsync !== "function"
  ) {
    throw new Error("Image picker is not available in this build. Please install latest APK.");
  }

  try {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      throw new Error("Gallery permission is required to upload payment screenshot.");
    }
  } catch (error: any) {
    if ((error?.message || "").includes("required")) {
      throw error;
    }
  }

  let result: any;
  try {
    result = await ImagePicker.launchImageLibraryAsync({
      quality: 0.85,
      allowsEditing: false,
      selectionLimit: 1
    });
  } catch (firstError) {
    if (Platform.OS === "android") {
      result = await ImagePicker.launchImageLibraryAsync({
        quality: 0.85,
        allowsEditing: false,
        selectionLimit: 1,
        legacy: true
      });
    } else {
      throw firstError;
    }
  }

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
