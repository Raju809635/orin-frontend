import { api } from "@/lib/api";
import { NativeModulesProxy } from "expo-modules-core";

type UploadResponse = {
  message: string;
  url: string;
  path: string;
};

export async function pickAndUploadProfilePhoto(): Promise<string | null> {
  const nativeModules = NativeModulesProxy as Record<string, unknown>;
  const hasNativeImagePicker = Boolean(
    nativeModules?.ExpoImagePicker || nativeModules?.ExponentImagePicker
  );
  if (!hasNativeImagePicker) {
    throw new Error("This APK does not support image upload yet. Please install the latest APK build.");
  }

  let ImagePicker: any;
  try {
    ImagePicker = await import("expo-image-picker");
  } catch {
    throw new Error("Image upload requires latest app build. Please install updated APK.");
  }

  if (
    typeof ImagePicker?.requestMediaLibraryPermissionsAsync !== "function" ||
    typeof ImagePicker?.launchImageLibraryAsync !== "function"
  ) {
    throw new Error("Image picker is not available in this build. Please install latest APK.");
  }

  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    return null;
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    quality: 0.8,
    allowsEditing: true,
    aspect: [1, 1]
  });

  if (result.canceled || !result.assets?.length) {
    return null;
  }

  const asset = result.assets[0];
  const uri = asset.uri;
  const fileName = asset.fileName || `profile-${Date.now()}.jpg`;
  const mimeType = asset.mimeType || "image/jpeg";

  const formData = new FormData();
  formData.append("file", {
    uri,
    name: fileName,
    type: mimeType
  } as any);

  const { data } = await api.post<UploadResponse>("/api/uploads/profile-photo", formData, {
    headers: {
      "Content-Type": "multipart/form-data"
    }
  });

  return data.url;
}
