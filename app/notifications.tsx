import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/lib/api";
import { useAppTheme } from "@/context/ThemeContext";

type NotificationRecord = {
  _id: string;
  title: string;
  message: string;
  type: "announcement" | "system" | "booking" | "approval" | "direct";
  targetRole: "student" | "mentor" | "admin" | "all";
  readByRecipient?: boolean;
  createdAt: string;
  recipient?: string | { _id: string };
};

export default function NotificationsScreen() {
  const { colors, isDark } = useAppTheme();
  const [items, setItems] = useState<NotificationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    try {
      if (refresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      const res = await api.get<NotificationRecord[]>("/api/messages/notifications");
      setItems(res.data || []);
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to load notifications.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const unreadCount = useMemo(() => items.filter((item) => item.readByRecipient === false).length, [items]);

  async function markRead(item: NotificationRecord) {
    if (!item.recipient || item.readByRecipient) return;
    try {
      await api.patch(`/api/messages/notifications/${item._id}/read`);
      setItems((prev) =>
        prev.map((it) => (it._id === item._id ? { ...it, readByRecipient: true } : it))
      );
    } catch {
      // keep non-blocking for UX
    }
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[styles.container, { backgroundColor: colors.background }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
    >
      <View style={[styles.headerCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.heading, { color: colors.text }]}>Notifications</Text>
        <Text style={[styles.subheading, { color: colors.textMuted }]}>
          Important updates from sessions, payments, approvals, and platform announcements.
        </Text>
        <View style={[styles.countPill, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}>
          <Ionicons name="notifications" size={14} color={colors.accent} />
          <Text style={[styles.countText, { color: colors.text }]}>Unread: {unreadCount}</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : null}

      {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}

      {!loading && items.length === 0 ? <Text style={[styles.empty, { color: colors.textMuted }]}>No notifications yet.</Text> : null}

      {!loading &&
        items.map((item) => (
          <TouchableOpacity
            key={item._id}
            style={[
              styles.card,
              {
                backgroundColor: item.readByRecipient === false ? colors.accentSoft : colors.surface,
                borderColor: item.readByRecipient === false ? colors.accent : colors.border
              }
            ]}
            activeOpacity={0.9}
            onPress={() => markRead(item)}
          >
            <View style={styles.row}>
              <Text style={[styles.title, { color: colors.text }]}>{item.title}</Text>
              <Text style={[styles.type, { color: colors.accent, backgroundColor: colors.surfaceAlt }]}>{item.type}</Text>
            </View>
            <Text style={[styles.message, { color: colors.textMuted }]}>{item.message}</Text>
            <Text style={[styles.meta, { color: colors.textMuted }]}>
              {new Date(item.createdAt).toLocaleString()} | Target: {item.targetRole}
            </Text>
            {item.readByRecipient === false ? <Text style={[styles.tapHint, { color: colors.accent }]}>Tap to mark as read</Text> : null}
          </TouchableOpacity>
        ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: "#F3F5F7", padding: 18, paddingBottom: 28 },
  headerCard: {
    backgroundColor: "#FFF7ED",
    borderWidth: 1,
    borderColor: "#F7DCCB",
    borderRadius: 16,
    padding: 14,
    marginBottom: 10
  },
  heading: { fontSize: 27, fontWeight: "800", color: "#13251E" },
  subheading: { marginTop: 5, color: "#475467", lineHeight: 19 },
  countPill: {
    marginTop: 10,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: "#F8D3BD",
    borderRadius: 999,
    backgroundColor: "#FFF2E8",
    paddingHorizontal: 10,
    paddingVertical: 5
  },
  countText: { color: "#7A271A", fontWeight: "700", fontSize: 12 },
  centered: { minHeight: 140, alignItems: "center", justifyContent: "center" },
  error: { color: "#B42318", marginBottom: 8 },
  empty: { color: "#667085", marginTop: 6 },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 9
  },
  cardUnread: { backgroundColor: "#EFF8FF", borderColor: "#CFE3F6" },
  cardRead: { backgroundColor: "#FFFFFF", borderColor: "#E4E7EC" },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  title: { color: "#1E2B24", fontWeight: "800", flex: 1 },
  type: {
    color: "#175CD3",
    fontWeight: "700",
    textTransform: "capitalize",
    backgroundColor: "#EAF2FF",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    overflow: "hidden",
    fontSize: 11
  },
  message: { marginTop: 7, color: "#475467", lineHeight: 19 },
  meta: { marginTop: 7, color: "#667085", fontSize: 12, fontWeight: "500" },
  tapHint: { marginTop: 6, color: "#175CD3", fontWeight: "700", fontSize: 12 }
});
