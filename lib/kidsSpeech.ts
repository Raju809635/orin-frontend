import { Alert, Platform } from "react-native";

export async function speakKidText(text: string) {
  const content = String(text || "").trim();
  if (!content) return;

  if (Platform.OS === "web" && typeof window !== "undefined" && "speechSynthesis" in window) {
    try {
      const utterance = new SpeechSynthesisUtterance(content);
      utterance.rate = 0.9;
      utterance.pitch = 1.05;
      utterance.lang = "en-IN";
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
      return;
    } catch {
      // fall through to alert fallback
    }
  }

  Alert.alert("Read aloud", content);
}

