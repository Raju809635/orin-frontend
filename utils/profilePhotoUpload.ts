import { api } from "@/lib/api";
import { Platform } from "react-native";

type UploadResponse = {
  message: string;
  url: string;
  path: string;
};

export async function pickAndUploadProfilePhoto(): Promise<string | null> {
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

  try {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      return null;
    }
  } catch {
    // Some Android OEM builds fail on explicit permission API; continue with picker call.
  }

  let result: any;
  try {
    result = await ImagePicker.launchImageLibraryAsync({
      quality: 0.8,
      allowsEditing: false,
      selectionLimit: 1
    });
  } catch (firstError) {
    // Fallback for Android devices where default picker flow crashes/blank-screens.
    if (Platform.OS === "android") {
      result = await ImagePicker.launchImageLibraryAsync({
        quality: 0.8,
        allowsEditing: false,
        selectionLimit: 1,
        legacy: true
      });
    } else {
      throw firstError;
    }
  }

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
