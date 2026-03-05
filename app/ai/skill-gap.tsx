import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/lib/api";

type SkillGapResponse = { goal: string; currentSkills: string[]; missingSkills: string[]; suggestions?: { courses?: string[] } };

const GOALS = ["AI Engineer", "Full Stack Developer", "Cyber Security Analyst", "Data Scientist"];

export default function AiSkillGapPage() {
  const [selectedGoal, setSelectedGoal] = useState(GOALS[0]);
  const [skillsInput, setSkillsInput] = useState("");
  const [data, setData] = useState<SkillGapResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    try {
      if (refresh) setRefreshing(true); else setLoading(true);
      setError(null);
      const res = await api.get<SkillGapResponse>("/api/network/skill-gap");
      setData(res.data || null);
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to load skill gap.");
    } finally {
      setLoading(false); setRefreshing(false); setAnalyzing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const enteredSkills = useMemo(() => skillsInput.split(",").map((s) => s.trim()).filter(Boolean), [skillsInput]);

  return (
    <ScrollView contentContainerStyle={styles.page} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}>
      <Text style={styles.pageTitle}>AI Skill Gap Analysis</Text>
      <Text style={styles.pageSub}>Analyze missing skills for your target career and get learning recommendations.</Text>

      <View style={styles.section}>
        <View style={styles.sectionHeader}><Ionicons name="analytics" size={16} color="#1F7A4C" /><Text style={styles.sectionTitle}>Overview</Text></View>
        <Text style={styles.meta}>This module compares your current skill set with required skills for the selected goal.</Text>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}><Ionicons name="build" size={16} color="#1F7A4C" /><Text style={styles.sectionTitle}>Main Feature</Text></View>
        <Text style={styles.label}>Career Goal</Text>
        <View style={styles.chips}>{GOALS.map((goal) => <TouchableOpacity key={goal} style={[styles.chip, selectedGoal===goal && styles.chipActive]} onPress={() => setSelectedGoal(goal)}><Text style={[styles.chipText, selectedGoal===goal && styles.chipTextActive]}>{goal}</Text></TouchableOpacity>)}</View>
        <Text style={styles.label}>Current Skills (comma separated)</Text>
        <TextInput style={styles.input} value={skillsInput} onChangeText={setSkillsInput} placeholder="Python, SQL, React" />
        <TouchableOpacity style={styles.primaryBtn} onPress={() => { setAnalyzing(true); load(true); }}><Text style={styles.primaryBtnText}>{analyzing ? "Analyzing..." : "Analyze"}</Text></TouchableOpacity>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}><Ionicons name="list" size={16} color="#1F7A4C" /><Text style={styles.sectionTitle}>Results</Text></View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {loading ? <ActivityIndicator size="large" color="#1F7A4C" /> : null}
        {!loading && !data ? <Text style={styles.meta}>No analysis data available.</Text> : null}
        {data ? (
          <>
            <Text style={styles.meta}>Goal: {selectedGoal}</Text>
            <Text style={styles.meta}>Entered Skills: {enteredSkills.join(", ") || "None"}</Text>
            <Text style={styles.resultTitle}>Missing Skills</Text>
            {(data.missingSkills || []).map((s) => <Text key={s} style={styles.meta}>• {s}</Text>)}
            <Text style={styles.resultTitle}>Recommended Resources</Text>
            {(data.suggestions?.courses || []).slice(0, 8).map((c, i) => <Text key={`${c}-${i}`} style={styles.meta}>• {c}</Text>)}
          </>
        ) : null}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}><Ionicons name="flash" size={16} color="#1F7A4C" /><Text style={styles.sectionTitle}>Actions</Text></View>
        <TouchableOpacity style={styles.primaryBtn}><Text style={styles.primaryBtnText}>Update Learning Plan</Text></TouchableOpacity>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}><Ionicons name="help-circle" size={16} color="#1F7A4C" /><Text style={styles.sectionTitle}>Tips</Text></View>
        <Text style={styles.meta}>Add both core and tool-specific skills for better gap analysis.</Text>
      </View>
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
  input: { borderWidth: 1, borderColor: "#D0D5DD", borderRadius: 10, backgroundColor: "#fff", paddingHorizontal: 12, paddingVertical: 10, color: "#344054" },
  resultTitle: { marginTop: 4, fontWeight: "800", color: "#1E2B24" },
  meta: { color: "#667085" },
  error: { color: "#B42318" },
  primaryBtn: { alignSelf: "flex-start", backgroundColor: "#1F7A4C", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9 },
  primaryBtnText: { color: "#fff", fontWeight: "700" }
});
