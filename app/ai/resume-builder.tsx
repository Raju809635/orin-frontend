import React, { useCallback, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/lib/api";

type ResumeResponse = { markdown?: string; export?: { fileName?: string } };

export default function AiResumeBuilderPage() {
  const [data, setData] = useState<ResumeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    try {
      if (refresh) setRefreshing(true); else setLoading(true);
      setError(null);
      const res = await api.get<ResumeResponse>("/api/network/resume/generate");
      setData(res.data || null);
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to load resume builder.");
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <ScrollView contentContainerStyle={styles.page} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}>
      <Text style={styles.pageTitle}>AI Resume Builder</Text>
      <Text style={styles.pageSub}>Generate and preview resume content from your ORIN profile data.</Text>

      <View style={styles.section}><View style={styles.sectionHeader}><Ionicons name="document-text" size={16} color="#1F7A4C" /><Text style={styles.sectionTitle}>Overview</Text></View><Text style={styles.meta}>The builder compiles skills, projects, and achievements into resume format.</Text></View>

      <View style={styles.section}><View style={styles.sectionHeader}><Ionicons name="person" size={16} color="#1F7A4C" /><Text style={styles.sectionTitle}>Main Feature</Text></View><Text style={styles.meta}>Profile Data: fetched from your account</Text><Text style={styles.meta}>Skills: auto-collected</Text><Text style={styles.meta}>Projects: auto-collected</Text><TouchableOpacity style={styles.primaryBtn} onPress={() => load(true)}><Text style={styles.primaryBtnText}>Generate Resume</Text></TouchableOpacity></View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}><Ionicons name="eye" size={16} color="#1F7A4C" /><Text style={styles.sectionTitle}>Resume Preview</Text></View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {loading ? <ActivityIndicator size="large" color="#1F7A4C" /> : null}
        {!loading && !data?.markdown ? <Text style={styles.meta}>Resume preview unavailable.</Text> : null}
        {data?.markdown ? <View style={styles.previewCard}><Text style={styles.meta}>{data.markdown}</Text></View> : null}
      </View>

      <View style={styles.section}><View style={styles.sectionHeader}><Ionicons name="download" size={16} color="#1F7A4C" /><Text style={styles.sectionTitle}>Actions</Text></View><TouchableOpacity style={styles.primaryBtn}><Text style={styles.primaryBtnText}>Download ({data?.export?.fileName || "orin_resume.md"})</Text></TouchableOpacity></View>
      <View style={styles.section}><View style={styles.sectionHeader}><Ionicons name="help-circle" size={16} color="#1F7A4C" /><Text style={styles.sectionTitle}>Tips</Text></View><Text style={styles.meta}>Keep projects quantified with outcomes for stronger resume impact.</Text></View>
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
  previewCard: { backgroundColor: "#FEF3F2", borderColor: "#F7C1BB", borderWidth: 1, borderRadius: 12, padding: 10 },
  meta: { color: "#667085", lineHeight: 20 },
  error: { color: "#B42318" },
  primaryBtn: { alignSelf: "flex-start", backgroundColor: "#1F7A4C", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9 },
  primaryBtnText: { color: "#fff", fontWeight: "700" }
});
