import { api } from "@/lib/api";

type UploadResponse = {
  success?: boolean;
  url?: string;
  message?: string;
};

const SUPPORTED_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
];

export async function pickAndUploadProgramDocument(): Promise<{ url: string; fileName: string; mimeType: string } | null> {
  let DocumentPicker: any;
  try {
    DocumentPicker = await import("expo-document-picker");
  } catch {
    throw new Error("Document upload requires latest app build. Please install updated APK.");
  }

  if (typeof DocumentPicker?.getDocumentAsync !== "function") {
    throw new Error("Document picker is not available in this build. Please install latest APK.");
  }

  const result = await DocumentPicker.getDocumentAsync({
    type: SUPPORTED_MIME_TYPES,
    multiple: false,
    copyToCacheDirectory: true
  });

  if (!result || result.canceled || !result.assets?.length) {
    return null;
  }

  const asset = result.assets[0];
  const uri = asset.uri;
  const fileName = asset.name || `program-${Date.now()}.pdf`;
  const mimeType = asset.mimeType || "application/pdf";

  const formData = new FormData();
  formData.append("file", {
    uri,
    name: fileName,
    type: mimeType
  } as any);

  const { data } = await api.post<UploadResponse>("/api/uploads/file", formData, {
    headers: {
      "Content-Type": "multipart/form-data"
    },
    timeout: 30000
  });

  const url = data?.url || "";
  if (!url) {
    throw new Error(data?.message || "Failed to upload program document.");
  }

  return { url, fileName, mimeType };
}
