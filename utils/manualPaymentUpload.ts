import { api } from "@/lib/api";

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

  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error("Gallery permission is required to upload payment screenshot.");
  }

  const result = await ImagePicker.launchImageLibraryAsync({
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
