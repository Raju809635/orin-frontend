import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/lib/api";

type ProjectIdeasResponse = { goal: string; ideas: Array<{ title: string }> };

const DOMAIN_OPTIONS = ["AI", "Web", "Cybersecurity", "Data Science"];
const LEVEL_OPTIONS = ["Beginner", "Intermediate", "Advanced"];

export default function AiProjectIdeasPage() {
  const [domain, setDomain] = useState(DOMAIN_OPTIONS[0]);
  const [level, setLevel] = useState(LEVEL_OPTIONS[0]);
  const [data, setData] = useState<ProjectIdeasResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    try {
      if (refresh) setRefreshing(true); else setLoading(true);
      setError(null);
      const res = await api.get<ProjectIdeasResponse>("/api/network/project-ideas");
      setData(res.data || null);
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to load project ideas.");
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const difficulty = useMemo(() => (level === "Beginner" ? "Easy" : level === "Intermediate" ? "Medium" : "Hard"), [level]);

  return (
    <ScrollView contentContainerStyle={styles.page} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}>
      <Text style={styles.pageTitle}>AI Project Ideas</Text>
      <Text style={styles.pageSub}>Generate practical projects with difficulty and stack suggestions.</Text>

      <View style={styles.section}><View style={styles.sectionHeader}><Ionicons name="bulb" size={16} color="#1F7A4C" /><Text style={styles.sectionTitle}>Overview</Text></View><Text style={styles.meta}>Pick domain and skill level to generate project ideas you can build now.</Text></View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}><Ionicons name="options" size={16} color="#1F7A4C" /><Text style={styles.sectionTitle}>Main Feature</Text></View>
        <Text style={styles.label}>Domain</Text>
        <View style={styles.chips}>{DOMAIN_OPTIONS.map((d) => <TouchableOpacity key={d} style={[styles.chip, domain===d && styles.chipActive]} onPress={() => setDomain(d)}><Text style={[styles.chipText, domain===d && styles.chipTextActive]}>{d}</Text></TouchableOpacity>)}</View>
        <Text style={styles.label}>Skill Level</Text>
        <View style={styles.chips}>{LEVEL_OPTIONS.map((d) => <TouchableOpacity key={d} style={[styles.chip, level===d && styles.chipActive]} onPress={() => setLevel(d)}><Text style={[styles.chipText, level===d && styles.chipTextActive]}>{d}</Text></TouchableOpacity>)}</View>
        <TouchableOpacity style={styles.primaryBtn} onPress={() => load(true)}><Text style={styles.primaryBtnText}>Generate Ideas</Text></TouchableOpacity>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}><Ionicons name="list" size={16} color="#1F7A4C" /><Text style={styles.sectionTitle}>Results</Text></View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {loading ? <ActivityIndicator size="large" color="#1F7A4C" /> : null}
        {!loading && !data ? <Text style={styles.meta}>No ideas available.</Text> : null}
        {data?.ideas.slice(0, 12).map((item, idx) => (
          <View key={`${item.title}-${idx}`} style={styles.ideaCard}>
            <Text style={styles.resultTitle}>{item.title}</Text>
            <Text style={styles.meta}>Difficulty: {difficulty}</Text>
            <Text style={styles.meta}>Suggested Stack: {domain === "AI" ? "Python, NumPy, ML libs" : domain === "Web" ? "React, Node.js, MongoDB" : domain === "Cybersecurity" ? "Python, Wireshark, Linux" : "Python, SQL, PowerBI"}</Text>
          </View>
        ))}
      </View>

      <View style={styles.section}><View style={styles.sectionHeader}><Ionicons name="flash" size={16} color="#1F7A4C" /><Text style={styles.sectionTitle}>Actions</Text></View><TouchableOpacity style={styles.primaryBtn}><Text style={styles.primaryBtnText}>Save to My Projects</Text></TouchableOpacity></View>
      <View style={styles.section}><View style={styles.sectionHeader}><Ionicons name="help-circle" size={16} color="#1F7A4C" /><Text style={styles.sectionTitle}>Tips</Text></View><Text style={styles.meta}>Start with a mini MVP and add one new feature per week.</Text></View>
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
  label: { color: "#344054", fontWeight: "700", marginTop: 4 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1, borderColor: "#D0D5DD", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: "#fff" },
  chipActive: { borderColor: "#1F7A4C", backgroundColor: "#EAF6EF" },
  chipText: { color: "#475467", fontWeight: "700", fontSize: 12 },
  chipTextActive: { color: "#1F7A4C" },
  ideaCard: { backgroundColor: "#FFF7ED", borderColor: "#F9DBAF", borderWidth: 1, borderRadius: 12, padding: 10, gap: 3 },
  resultTitle: { fontWeight: "800", color: "#1E2B24" },
  meta: { color: "#667085" },
  error: { color: "#B42318" },
  primaryBtn: { alignSelf: "flex-start", backgroundColor: "#1F7A4C", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9 },
  primaryBtnText: { color: "#fff", fontWeight: "700" }
});
