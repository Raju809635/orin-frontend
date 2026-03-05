import React, { useCallback, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/lib/api";

type ReputationSummary = { score: number; levelTag: string; topPercent: number; breakdown?: Record<string, number> };

export default function CommunityReputationPage() {
  const [data, setData] = useState<ReputationSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    try {
      if (refresh) setRefreshing(true); else setLoading(true);
      setError(null);
      const res = await api.get<ReputationSummary>("/api/network/reputation-summary");
      setData(res.data || null);
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to load reputation.");
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <ScrollView contentContainerStyle={styles.page} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}>
      <Text style={styles.pageTitle}>Reputation & Ranking</Text>
      <Text style={styles.pageSub}>Track your score, level progression, and percentile rank.</Text>

      <View style={styles.section}><View style={styles.sectionHeader}><Ionicons name="stats-chart" size={16} color="#1F7A4C" /><Text style={styles.sectionTitle}>Score Overview</Text></View>{error ? <Text style={styles.error}>{error}</Text> : null}{loading ? <ActivityIndicator size="large" color="#1F7A4C" /> : null}{data ? <><Text style={styles.score}>Score: {data.score}</Text><Text style={styles.meta}>Level: {data.levelTag}</Text><Text style={styles.meta}>Rank Percentile: Top {data.topPercent}%</Text></> : null}</View>

      <View style={styles.section}><View style={styles.sectionHeader}><Ionicons name="trending-up" size={16} color="#1F7A4C" /><Text style={styles.sectionTitle}>Level Progression</Text></View><Text style={styles.meta}>Progress grows with sessions, quizzes, posts, and community participation.</Text></View>

      <View style={styles.section}><View style={styles.sectionHeader}><Ionicons name="time" size={16} color="#1F7A4C" /><Text style={styles.sectionTitle}>Activity History</Text></View>{Object.entries(data?.breakdown || {}).map(([k,v]) => <Text key={k} style={styles.meta}>{k}: {v}</Text>)}{!data?.breakdown ? <Text style={styles.meta}>No detailed activity breakdown available.</Text> : null}</View>

      <View style={styles.section}><View style={styles.sectionHeader}><Ionicons name="medal" size={16} color="#1F7A4C" /><Text style={styles.sectionTitle}>Achievement Badges</Text></View><Text style={styles.meta}>Badges unlock at higher level tags and challenge milestones.</Text></View>
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
  score: { color: "#B42318", fontWeight: "800", fontSize: 20 },
  meta: { color: "#667085" },
  error: { color: "#B42318" }
});
