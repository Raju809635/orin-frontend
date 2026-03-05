import React, { useCallback, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/lib/api";

type CertificationItem = { id: string; title: string; level?: string };

export default function CommunityCertificationsPage() {
  const [items, setItems] = useState<CertificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    try {
      if (refresh) setRefreshing(true); else setLoading(true);
      setError(null);
      const res = await api.get<CertificationItem[]>("/api/network/certifications");
      setItems(res.data || []);
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to load certifications.");
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <ScrollView contentContainerStyle={styles.page} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}>
      <Text style={styles.pageTitle}>Certifications</Text>
      <Text style={styles.pageSub}>Track available certifications, requirements, and earned badges.</Text>

      <View style={styles.section}><View style={styles.sectionHeader}><Ionicons name="ribbon" size={16} color="#1F7A4C" /><Text style={styles.sectionTitle}>Overview</Text></View><Text style={styles.meta}>Certifications validate your progress and improve profile credibility.</Text></View>

      <View style={styles.section}><View style={styles.sectionHeader}><Ionicons name="list" size={16} color="#1F7A4C" /><Text style={styles.sectionTitle}>Available Certifications</Text></View>{error ? <Text style={styles.error}>{error}</Text> : null}{loading ? <ActivityIndicator size="large" color="#1F7A4C" /> : null}{items.map((item) => <View key={item.id} style={styles.card}><Text style={styles.cardTitle}>{item.title}</Text><Text style={styles.meta}>Level: {item.level || "Beginner"}</Text><Text style={styles.meta}>Requirements: Complete related challenges and sessions.</Text></View>)}</View>

      <View style={styles.section}><View style={styles.sectionHeader}><Ionicons name="flash" size={16} color="#1F7A4C" /><Text style={styles.sectionTitle}>Actions</Text></View><TouchableOpacity style={styles.primaryBtn}><Text style={styles.primaryBtnText}>Start Certification</Text></TouchableOpacity></View>
      <View style={styles.section}><View style={styles.sectionHeader}><Ionicons name="medal" size={16} color="#1F7A4C" /><Text style={styles.sectionTitle}>Earned Badges</Text></View><Text style={styles.meta}>Your earned badges appear here after completion.</Text></View>
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
  card: { backgroundColor: "#EEF4FF", borderColor: "#C7D7FE", borderWidth: 1, borderRadius: 12, padding: 10, gap: 4 },
  cardTitle: { fontWeight: "800", color: "#1E2B24" },
  meta: { color: "#667085" },
  error: { color: "#B42318" },
  primaryBtn: { alignSelf: "flex-start", backgroundColor: "#1F7A4C", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9 },
  primaryBtnText: { color: "#fff", fontWeight: "700" }
});
