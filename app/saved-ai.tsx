import React, { useCallback, useMemo, useState } from "react";
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { clearSavedAiItems, deleteSavedAiItem, getSavedAiItems, type SavedAiItem } from "@/utils/aiSaves";

function typeLabel(type: string) {
  switch (type) {
    case "mentor_matching":
      return "AI Mentor Matching";
    case "skill_gap":
      return "AI Skill Gap";
    case "career_roadmap":
      return "AI Roadmap";
    case "project_ideas":
      return "AI Project Ideas";
    case "resume":
      return "AI Resume";
    case "assistant":
      return "AI Assistant";
    default:
      return "AI Save";
  }
}

export default function SavedAiScreen() {
  const [items, setItems] = useState<SavedAiItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const data = await getSavedAiItems();
    setItems(data);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const groups = useMemo(() => {
    const map = new Map<string, SavedAiItem[]>();
    items.forEach((item) => {
      const key = typeLabel(item.type);
      map.set(key, [...(map.get(key) || []), item]);
    });
    return Array.from(map.entries());
  }, [items]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  function confirmClearAll() {
    Alert.alert("Clear all saved AI?", "This will remove all saved AI results from this device.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Clear",
        style: "destructive",
        onPress: async () => {
          await clearSavedAiItems();
          await load();
        }
      }
    ]);
  }

  function confirmDelete(item: SavedAiItem) {
    Alert.alert("Delete saved item?", item.title, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteSavedAiItem(item.id);
          await load();
        }
      }
    ]);
  }

  return (
    <ScrollView
      contentContainerStyle={styles.page}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Saved AI</Text>
          <Text style={styles.sub}>Saved AI results stored on this device.</Text>
        </View>
        <TouchableOpacity style={styles.clearBtn} onPress={confirmClearAll}>
          <Ionicons name="trash" size={16} color="#B42318" />
          <Text style={styles.clearText}>Clear</Text>
        </TouchableOpacity>
      </View>

      {items.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No saved items yet.</Text>
          <Text style={styles.emptySub}>Use the Save button inside any AI tool to store results here.</Text>
        </View>
      ) : null}

      {groups.map(([groupName, groupItems]) => (
        <View key={groupName} style={styles.group}>
          <Text style={styles.groupTitle}>{groupName}</Text>
          {groupItems.map((item) => (
            <TouchableOpacity key={item.id} style={styles.card} onLongPress={() => confirmDelete(item)}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={styles.cardMeta}>
                  {new Date(item.createdAt).toLocaleString()}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#98A2B3" />
            </TouchableOpacity>
          ))}
        </View>
      ))}

      <Text style={styles.hint}>Tip: Long-press an item to delete it.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, backgroundColor: "#F3F6FB", gap: 12 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  title: { fontSize: 26, fontWeight: "900", color: "#11261E" },
  sub: { color: "#667085" },
  clearBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#FEE4E2",
    borderWidth: 1,
    borderColor: "#FECDCA"
  },
  clearText: { color: "#B42318", fontWeight: "900" },
  emptyCard: { backgroundColor: "#fff", borderRadius: 14, borderWidth: 1, borderColor: "#E4E7EC", padding: 14 },
  emptyTitle: { fontWeight: "900", color: "#1E2B24" },
  emptySub: { marginTop: 6, color: "#667085", lineHeight: 18 },
  group: { gap: 8 },
  groupTitle: { fontWeight: "900", color: "#344054", marginTop: 8 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E4E7EC",
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  cardTitle: { fontWeight: "900", color: "#1E2B24" },
  cardMeta: { marginTop: 4, color: "#667085", fontSize: 12 },
  hint: { color: "#667085", textAlign: "center", marginTop: 10 }
});

