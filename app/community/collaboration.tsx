import React, { useCallback, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/lib/api";

type MentorGroupItem = { id: string; name: string; schedule?: string; membersCount?: number; mentor?: { name?: string } };

export default function CommunityCollaborationPage() {
  const router = useRouter();
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
      setError(e?.response?.data?.message || "Failed to load communities.");
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <ScrollView contentContainerStyle={styles.page} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}>
      <Text style={styles.pageTitle}>Community & Collaboration</Text>
      <Text style={styles.pageSub}>Join learning communities and participate in shared discussions.</Text>

      <View style={styles.section}><View style={styles.sectionHeader}><Ionicons name="people" size={16} color="#1F7A4C" /><Text style={styles.sectionTitle}>Overview</Text></View><Text style={styles.meta}>Collaborate with peers and mentors in topic-focused groups.</Text></View>

      <View style={styles.section}><View style={styles.sectionHeader}><Ionicons name="settings" size={16} color="#1F7A4C" /><Text style={styles.sectionTitle}>Main Feature</Text></View><TouchableOpacity style={styles.primaryBtn} onPress={() => router.push("/collaborate" as never)}><Text style={styles.primaryBtnText}>Join Community</Text></TouchableOpacity></View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}><Ionicons name="chatbubbles" size={16} color="#1F7A4C" /><Text style={styles.sectionTitle}>Community Discussions</Text></View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {loading ? <ActivityIndicator size="large" color="#1F7A4C" /> : null}
        {!loading && groups.length === 0 ? <Text style={styles.meta}>No active communities right now.</Text> : null}
        {groups.map((g) => (
          <View key={g.id} style={styles.card}>
            <Text style={styles.cardTitle}>{g.name}</Text>
            <Text style={styles.meta}>Mentor: {g.mentor?.name || "Mentor"}</Text>
            <Text style={styles.meta}>Members: {g.membersCount || 0}</Text>
            <Text style={styles.meta}>Schedule: {g.schedule || "Weekly"}</Text>
          </View>
        ))}
      </View>

      <View style={styles.section}><View style={styles.sectionHeader}><Ionicons name="help-circle" size={16} color="#1F7A4C" /><Text style={styles.sectionTitle}>Tips</Text></View><Text style={styles.meta}>Join communities aligned with your domain for better networking value.</Text></View>
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
