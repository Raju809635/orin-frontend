import AsyncStorage from "@react-native-async-storage/async-storage";

export type AiSaveType =
  | "mentor_matching"
  | "skill_gap"
  | "career_roadmap"
  | "project_ideas"
  | "resume"
  | "assistant";

export type SavedAiItem = {
  id: string;
  type: AiSaveType;
  title: string;
  createdAt: string;
  payload: any;
};

const STORAGE_KEY = "orin:saved_ai:v1";
const MAX_ITEMS = 60;

function makeId() {
  return `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
}

export async function getSavedAiItems(): Promise<SavedAiItem[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SavedAiItem[]) : [];
  } catch {
    return [];
  }
}

export async function saveAiItem(input: Omit<SavedAiItem, "id" | "createdAt">): Promise<SavedAiItem> {
  const next: SavedAiItem = {
    id: makeId(),
    createdAt: new Date().toISOString(),
    ...input
  };

  const items = await getSavedAiItems();
  const merged = [next, ...items].slice(0, MAX_ITEMS);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  return next;
}

export async function deleteSavedAiItem(id: string): Promise<void> {
  const items = await getSavedAiItems();
  const next = items.filter((x) => x.id !== id);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export async function clearSavedAiItems(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}

