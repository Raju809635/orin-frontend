import React, { useCallback, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/lib/api";

type LeaderboardResponse = {
  collegeName?: string;
  collegeTop: Array<{ rank: number; name: string; score: number }>;
  globalTop?: Array<{ rank: number; name: string; score: number }>;
  me?: { rank?: number; score?: number };
};

export default function CommunityLeaderboardPage() {
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    try {
      if (refresh) setRefreshing(true); else setLoading(true);
      setError(null);
      const res = await api.get<LeaderboardResponse>("/api/network/leaderboard");
      setData(res.data || null);
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to load leaderboard.");
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <ScrollView contentContainerStyle={styles.page} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}>
      <Text style={styles.pageTitle}>College Leaderboard</Text>
      <Text style={styles.pageSub}>Track top students, your position, and the scoring logic.</Text>

      <View style={styles.section}><View style={styles.sectionHeader}><Ionicons name="podium" size={16} color="#1F7A4C" /><Text style={styles.sectionTitle}>Ranking Board</Text></View>{error ? <Text style={styles.error}>{error}</Text> : null}{loading ? <ActivityIndicator size="large" color="#1F7A4C" /> : null}{!loading && (!data || data.collegeTop.length===0) ? <Text style={styles.meta}>Leaderboard unavailable.</Text> : null}{data?.collegeTop?.map((u) => <Text key={`${u.rank}-${u.name}`} style={styles.meta}>{u.rank}. {u.name} - {u.score}</Text>)}</View>
      <View style={styles.section}><View style={styles.sectionHeader}><Ionicons name="person" size={16} color="#1F7A4C" /><Text style={styles.sectionTitle}>Your Rank</Text></View><Text style={styles.meta}>Rank: {data?.me?.rank || "-"} | Score: {data?.me?.score || 0}</Text></View>
      <View style={styles.section}><View style={styles.sectionHeader}><Ionicons name="information-circle" size={16} color="#1F7A4C" /><Text style={styles.sectionTitle}>Points System</Text></View><Text style={styles.meta}>Points come from sessions, daily quiz, challenge participation, and network activity.</Text></View>
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
  meta: { color: "#667085" },
  error: { color: "#B42318" }
});
