import AsyncStorage from "@react-native-async-storage/async-storage";

export type NewsLanguageCode = "en" | "hi" | "te" | "ta" | "ml" | "kn";

export const NEWS_LANGUAGE_KEY = "orin_news_language";

export const NEWS_LANGUAGES: { code: NewsLanguageCode; label: string }[] = [
  { code: "en", label: "English" },
  { code: "hi", label: "Hindi" },
  { code: "te", label: "Telugu" },
  { code: "ta", label: "Tamil" },
  { code: "ml", label: "Malayalam" },
  { code: "kn", label: "Kannada" }
];

export async function getStoredNewsLanguage(): Promise<NewsLanguageCode> {
  try {
    const value = await AsyncStorage.getItem(NEWS_LANGUAGE_KEY);
    if (value && NEWS_LANGUAGES.some((item) => item.code === value)) {
      return value as NewsLanguageCode;
    }
  } catch {
    // ignore read errors
  }
  return "en";
}

export async function setStoredNewsLanguage(code: NewsLanguageCode): Promise<void> {
  try {
    await AsyncStorage.setItem(NEWS_LANGUAGE_KEY, code);
  } catch {
    // ignore write errors
  }
}
