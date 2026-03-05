import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/lib/api";

type ChallengeItem = { id: string; title: string; domain?: string; participantsCount?: number; deadline: string };
type LeaderboardResponse = { globalTop?: Array<{ rank: number; name: string; score: number }> };

export default function CommunityChallengesPage() {
  const [items, setItems] = useState<ChallengeItem[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    try {
      if (refresh) setRefreshing(true); else setLoading(true);
      setError(null);
      const [chRes, lbRes] = await Promise.allSettled([
        api.get<ChallengeItem[]>("/api/network/challenges"),
        api.get<LeaderboardResponse>("/api/network/leaderboard")
      ]);
      setItems(chRes.status === "fulfilled" ? chRes.value.data || [] : []);
      setLeaderboard(lbRes.status === "fulfilled" ? lbRes.value.data || null : null);
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to load challenges.");
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const active = useMemo(() => items[0], [items]);

  return (
    <ScrollView contentContainerStyle={styles.page} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}>
      <Text style={styles.pageTitle}>Challenges</Text>
      <Text style={styles.pageSub}>Compete in active challenges and improve your reputation score.</Text>

      <View style={styles.section}><View style={styles.sectionHeader}><Ionicons name="trophy" size={16} color="#1F7A4C" /><Text style={styles.sectionTitle}>Active Challenge Banner</Text></View>{active ? <View style={styles.banner}><Text style={styles.bannerTitle}>{active.title}</Text><Text style={styles.meta}>{active.domain || "General"} | Deadline: {new Date(active.deadline).toLocaleDateString()}</Text></View> : <Text style={styles.meta}>No active challenge.</Text>}</View>

      <View style={styles.section}><View style={styles.sectionHeader}><Ionicons name="flag" size={16} color="#1F7A4C" /><Text style={styles.sectionTitle}>Challenge Details</Text></View>{items.map((item) => <View key={item.id} style={styles.card}><Text style={styles.cardTitle}>{item.title}</Text><Text style={styles.meta}>Participants: {item.participantsCount || 0}</Text></View>)}<TouchableOpacity style={styles.primaryBtn}><Text style={styles.primaryBtnText}>Participate</Text></TouchableOpacity></View>

      <View style={styles.section}><View style={styles.sectionHeader}><Ionicons name="podium" size={16} color="#1F7A4C" /><Text style={styles.sectionTitle}>Leaderboard</Text></View>{error ? <Text style={styles.error}>{error}</Text> : null}{loading ? <ActivityIndicator size="large" color="#1F7A4C" /> : null}{(leaderboard?.globalTop || []).slice(0,5).map((u) => <Text key={`${u.rank}-${u.name}`} style={styles.meta}>{u.rank}. {u.name} - {u.score}</Text>)}</View>

      <View style={styles.section}><View style={styles.sectionHeader}><Ionicons name="star" size={16} color="#1F7A4C" /><Text style={styles.sectionTitle}>Previous Winners</Text></View><Text style={styles.meta}>Winners are featured on leaderboard snapshots and receive bonus XP.</Text></View>
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
  banner: { backgroundColor: "#FFF7ED", borderColor: "#F9DBAF", borderWidth: 1, borderRadius: 12, padding: 10, gap: 4 },
  bannerTitle: { fontWeight: "800", color: "#B54708" },
  card: { backgroundColor: "#FFF7ED", borderColor: "#F9DBAF", borderWidth: 1, borderRadius: 12, padding: 10, gap: 4 },
  cardTitle: { fontWeight: "800", color: "#1E2B24" },
  meta: { color: "#667085" },
  error: { color: "#B42318" },
  primaryBtn: { alignSelf: "flex-start", backgroundColor: "#1F7A4C", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9 },
  primaryBtnText: { color: "#fff", fontWeight: "700" }
});
