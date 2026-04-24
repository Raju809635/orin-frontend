import React, { useCallback, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/lib/api";
import { getAppErrorMessage } from "@/lib/appError";
import { useAuth } from "@/context/AuthContext";
import { useAppTheme } from "@/context/ThemeContext";

type MentorGroupItem = { id: string; name: string; schedule?: string; membersCount?: number; mentor?: { name?: string } };

export default function CommunityCollaborationPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { colors, isDark } = useAppTheme();
  const isMentor = user?.role === "mentor";
  const [groups, setGroups] = useState<MentorGroupItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    try {
      if (refresh) setRefreshing(true); else setLoading(true);
      setError(null);
      const res = await api.get<MentorGroupItem[]>("/api/network/mentor-groups");
      setGroups(res.data || []);
    } catch (e: any) {
      setError(getAppErrorMessage(e, "Failed to load communities."));
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={[styles.page, { backgroundColor: colors.background }]} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}>
      <Text style={[styles.pageTitle, { color: colors.text }]}>Community & Collaboration</Text>
      <Text style={[styles.pageSub, { color: colors.textMuted }]}>
        {isMentor
          ? "Work with other mentors, join mentoring circles, and contribute to shared discussions."
          : "Join learning communities and participate in shared discussions."}
      </Text>

      <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}><View style={styles.sectionHeader}><Ionicons name="people" size={16} color={colors.accent} /><Text style={[styles.sectionTitle, { color: colors.text }]}>Overview</Text></View><Text style={[styles.meta, { color: colors.textMuted }]}>{isMentor ? "Collaborate with mentors, manage shared groups, and strengthen your credibility through community contribution." : "Collaborate with peers and mentors in topic-focused groups."}</Text></View>

      <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}><View style={styles.sectionHeader}><Ionicons name="settings" size={16} color={colors.accent} /><Text style={[styles.sectionTitle, { color: colors.text }]}>Main Feature</Text></View><TouchableOpacity style={[styles.primaryBtn, { backgroundColor: colors.accent }]} onPress={() => router.push("/collaborate" as never)}><Text style={[styles.primaryBtnText, { color: colors.accentText }]}>{isMentor ? "Open Mentor Collaboration" : "Join Community"}</Text></TouchableOpacity></View>

      <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.sectionHeader}><Ionicons name="chatbubbles" size={16} color={colors.accent} /><Text style={[styles.sectionTitle, { color: colors.text }]}>Community Discussions</Text></View>
        {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
        {loading ? <ActivityIndicator size="large" color={colors.accent} /> : null}
        {!loading && groups.length === 0 ? <Text style={[styles.meta, { color: colors.textMuted }]}>No active communities right now.</Text> : null}
        {groups.map((g) => (
          <View key={g.id} style={[styles.card, { backgroundColor: isDark ? colors.surfaceAlt : "#F9F5FF", borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>{g.name}</Text>
            <Text style={[styles.meta, { color: colors.textMuted }]}>Mentor: {g.mentor?.name || "Mentor"}</Text>
            <Text style={[styles.meta, { color: colors.textMuted }]}>Members: {g.membersCount || 0}</Text>
            <Text style={[styles.meta, { color: colors.textMuted }]}>Schedule: {g.schedule || "Weekly"}</Text>
          </View>
        ))}
      </View>

      <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}><View style={styles.sectionHeader}><Ionicons name="help-circle" size={16} color={colors.accent} /><Text style={[styles.sectionTitle, { color: colors.text }]}>Tips</Text></View><Text style={[styles.meta, { color: colors.textMuted }]}>{isMentor ? "Use community groups to collaborate with mentors, run small learning circles, and stay visible to students in your domain." : "Join communities aligned with your domain for better networking value."}</Text></View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, backgroundColor: "#F3F6FB", gap: 10 },
  pageTitle: { fontSize: 26, fontWeight: "800", color: "#11261E" },
  pageSub: { color: "#667085" },
  section: { backgroundColor: "#FFFFFF", borderRadius: 14, borderWidth: 1, borderColor: "#E4E7EC", padding: 12, gap: 8 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  sectionTitle: { fontWeight: "800", color: "#1E2B24" },
  card: { backgroundColor: "#F9F5FF", borderColor: "#E2D6FF", borderWidth: 1, borderRadius: 12, padding: 10, gap: 4 },
  cardTitle: { fontWeight: "800", color: "#1E2B24" },
  meta: { color: "#667085" },
  error: { color: "#B42318" },
  primaryBtn: { alignSelf: "flex-start", backgroundColor: "#1F7A4C", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9 },
  primaryBtnText: { color: "#fff", fontWeight: "700" }
});
