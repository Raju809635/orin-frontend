import { api } from "@/lib/api";
import { Platform } from "react-native";

type UploadResponse = {
  message: string;
  url: string;
  path: string;
};

export async function pickAndUploadPostImage(): Promise<string | null> {
  const urls = await pickAndUploadPostImages(1);
  return urls[0] || null;
}

export async function pickAndUploadPostImages(maxSelection = 5): Promise<string[]> {
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
      return [];
    }
  } catch {
    // Continue and try launcher directly on OEM devices that fail permission call.
  }

  const safeMax = Math.min(Math.max(maxSelection, 1), 5);
  const imageMediaType =
    ImagePicker?.MediaTypeOptions?.Images !== undefined ? ImagePicker.MediaTypeOptions.Images : ["images"];
  const launchConfigs =
    Platform.OS === "android"
      ? [
          {
            mediaTypes: imageMediaType,
            quality: 0.85,
            allowsEditing: false,
            allowsMultipleSelection: safeMax > 1,
            selectionLimit: safeMax,
            orderedSelection: true,
            legacy: true
          },
          {
            mediaTypes: imageMediaType,
            quality: 0.85,
            allowsEditing: false,
            allowsMultipleSelection: safeMax > 1,
            selectionLimit: safeMax,
            orderedSelection: true
          },
          { quality: 0.85, allowsEditing: false }
        ]
      : [
          {
            mediaTypes: imageMediaType,
            quality: 0.85,
            allowsEditing: false,
            allowsMultipleSelection: safeMax > 1,
            selectionLimit: safeMax,
            orderedSelection: true
          }
        ];

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
    return [];
  }

  const pickedAssets = result.assets.slice(0, safeMax);
  const uploadedUrls: string[] = [];

  for (const asset of pickedAssets) {
    const uri = asset.uri;
    const fileName = asset.fileName || `post-${Date.now()}-${uploadedUrls.length}.jpg`;
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
    if (data?.url) uploadedUrls.push(data.url);
  }

  return uploadedUrls;
}
