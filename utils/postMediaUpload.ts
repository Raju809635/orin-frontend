import { api } from "@/lib/api";
import { Platform } from "react-native";

type UploadResponse = {
  message: string;
  url: string;
  path: string;
};

export async function pickAndUploadPostImage(): Promise<string | null> {
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
    // Continue and try launcher directly on OEM devices that fail permission call.
  }

  const imageMediaType =
    ImagePicker?.MediaTypeOptions?.Images !== undefined ? ImagePicker.MediaTypeOptions.Images : ["images"];
  const launchConfigs =
    Platform.OS === "android"
      ? [
          { mediaTypes: imageMediaType, quality: 0.85, allowsEditing: false, legacy: true },
          { mediaTypes: imageMediaType, quality: 0.85, allowsEditing: false },
          { quality: 0.85, allowsEditing: false }
        ]
      : [{ mediaTypes: imageMediaType, quality: 0.85, allowsEditing: false }];

  let result: any;
  let launchError: any = null;
  for (const config of launchConfigs) {
    try {
      result = await ImagePicker.launchImageLibraryAsync(config as any);
      launchError = null;
      break;
    } catch (error) {
      launchError = error;
    }
  }

  if (launchError) {
    throw new Error("Unable to open gallery picker on this device. Please try again or restart app.");
  }

  if (result?.canceled || !result?.assets?.length) {
    return null;
  }

  const asset = result.assets[0];
  const uri = asset.uri;
  const fileName = asset.fileName || `post-${Date.now()}.jpg`;
  const mimeType = asset.mimeType || "image/jpeg";

  const formData = new FormData();
  formData.append("file", {
    uri,
    name: fileName,
    type: mimeType
  } as any);

  const { data } = await api.post<UploadResponse>("/api/uploads/post-media", formData, {
    headers: {
      "Content-Type": "multipart/form-data"
    }
  });

  return data.url;
}

