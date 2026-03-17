import React, { useCallback, useMemo, useRef, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

type MentorMatch = {
  mentorId: string;
  name: string;
  title?: string;
  matchScore: number;
  experienceYears?: number;
  rating?: number;
  primaryCategory?: string;
  subCategory?: string;
  reasons?: string[];
};

const DOMAIN_OPTIONS = ["AI", "Web Development", "Cybersecurity", "Data Science", "UPSC", "Academics"];
const LEVEL_OPTIONS = ["Beginner", "Intermediate", "Advanced"];

export default function AiMentorMatchingPage() {
  const { user } = useAuth();
  const [selectedDomain, setSelectedDomain] = useState("AI");
  const [selectedLevel, setSelectedLevel] = useState("Beginner");
  const [items, setItems] = useState<MentorMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [finding, setFinding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const didAutofill = useRef(false);

  const load = useCallback(async (refresh = false) => {
    try {
      if (refresh) setRefreshing(true); else setLoading(true);
      setError(null);
      const { data } = await api.get<{ studentSignals?: any; recommendations: MentorMatch[] }>("/api/network/mentor-matches", {
        params: {
          domain: selectedDomain,
          level: selectedLevel
        }
      });
      const recs = data?.recommendations || [];
      setItems(recs);

      // Autofill domain once from the student's saved profile/category (if available).
      const suggestedDomain = String(data?.studentSignals?.domain || "").trim();
      if (!didAutofill.current && suggestedDomain) {
        didAutofill.current = true;
        const match = DOMAIN_OPTIONS.find((d) => d.toLowerCase() === suggestedDomain.toLowerCase());
        if (match && match !== selectedDomain) setSelectedDomain(match);
      }
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to load mentor matching.");
    } finally {
      setLoading(false);
      setRefreshing(false);
      setFinding(false);
    }
  }, [selectedDomain, selectedLevel]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const filtered = useMemo(() => {
    // Backend already applies the filters; this is a safe fallback if stale data is shown.
    return items.filter((item) => {
      const years = Number(item.experienceYears || 0);
      const byLevel =
        selectedLevel === "Beginner"
          ? years <= 3
          : selectedLevel === "Intermediate"
            ? years >= 2 && years <= 6
            : years >= 5;
      return byLevel;
    });
  }, [items, selectedDomain, selectedLevel]);

  return (
    <ScrollView contentContainerStyle={styles.page} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}>
      <Text style={styles.pageTitle}>AI Mentor Matching</Text>
      <Text style={styles.pageSub}>
        {user?.role === "mentor"
          ? "Find students aligned to your mentoring domains (based on your profile)."
          : "Match with the right mentor using your domain, goal, and profile skills."}
      </Text>

      <View style={styles.section}>
        <View style={styles.sectionHeader}><Ionicons name="sparkles" size={16} color="#1F7A4C" /><Text style={styles.sectionTitle}>Overview</Text></View>
        <Text style={styles.meta}>
          Recommendations are personalized using your saved ORIN profile (domain, sub-domain, goals, skills). You can also filter by domain/level.
        </Text>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}><Ionicons name="options" size={16} color="#1F7A4C" /><Text style={styles.sectionTitle}>Main Feature</Text></View>
        <Text style={styles.label}>Domain</Text>
        <View style={styles.chips}>{DOMAIN_OPTIONS.map((d) => <TouchableOpacity key={d} style={[styles.chip, selectedDomain===d && styles.chipActive]} onPress={() => setSelectedDomain(d)}><Text style={[styles.chipText, selectedDomain===d && styles.chipTextActive]}>{d}</Text></TouchableOpacity>)}</View>
        <Text style={styles.label}>Experience Level</Text>
        <View style={styles.chips}>{LEVEL_OPTIONS.map((d) => <TouchableOpacity key={d} style={[styles.chip, selectedLevel===d && styles.chipActive]} onPress={() => setSelectedLevel(d)}><Text style={[styles.chipText, selectedLevel===d && styles.chipTextActive]}>{d}</Text></TouchableOpacity>)}</View>
        <TouchableOpacity style={styles.primaryBtn} onPress={() => { setFinding(true); load(true); }}><Text style={styles.primaryBtnText}>{finding ? "Finding..." : "Find Mentor"}</Text></TouchableOpacity>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}><Ionicons name="list" size={16} color="#1F7A4C" /><Text style={styles.sectionTitle}>Results</Text></View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {loading ? <ActivityIndicator size="large" color="#1F7A4C" /> : null}
        {!loading && filtered.length === 0 ? <Text style={styles.meta}>No mentors found for current filters.</Text> : null}
        {filtered.map((item) => (
          <View key={item.mentorId} style={styles.resultCard}>
            <Text style={styles.resultTitle}>{item.name}</Text>
            <Text style={styles.meta}>{item.title || "Mentor"}</Text>
            <Text style={styles.meta}>
              {(item.primaryCategory || selectedDomain) ? `${item.primaryCategory || selectedDomain}${item.subCategory ? ` > ${item.subCategory}` : ""}` : ""}
            </Text>
            <Text style={styles.meta}>Experience: {item.experienceYears || 0} yrs | Rating: {item.rating || 0}</Text>
            <Text style={styles.score}>Match Score: {item.matchScore}%</Text>
            {(item.reasons || []).length ? (
              <Text style={styles.meta}>Why: {(item.reasons || []).slice(0, 3).join(" · ")}</Text>
            ) : null}
            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() => router.push(`/mentor/${item.mentorId}` as never)}
            >
              <Text style={styles.secondaryBtnText}>View Profile</Text>
            </TouchableOpacity>
          </View>
        ))}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}><Ionicons name="flash" size={16} color="#1F7A4C" /><Text style={styles.sectionTitle}>Actions</Text></View>
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => {
            const first = filtered[0];
            if (!first) return;
            router.push(`/mentor/${first.mentorId}` as never);
          }}
        >
          <Text style={styles.primaryBtnText}>Book a Session</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}><Ionicons name="help-circle" size={16} color="#1F7A4C" /><Text style={styles.sectionTitle}>Tips</Text></View>
        <Text style={styles.meta}>Choose a narrow domain and realistic level for better matching accuracy.</Text>
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
  resultCard: { backgroundColor: "#EEF4FF", borderColor: "#C7D7FE", borderWidth: 1, borderRadius: 12, padding: 10, gap: 4 },
  resultTitle: { fontWeight: "800", color: "#1E2B24" },
  score: { color: "#165DFF", fontWeight: "800" },
  meta: { color: "#667085" },
  error: { color: "#B42318" },
  primaryBtn: { alignSelf: "flex-start", backgroundColor: "#1F7A4C", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9 },
  primaryBtnText: { color: "#fff", fontWeight: "700" },
  secondaryBtn: { alignSelf: "flex-start", borderWidth: 1, borderColor: "#175CD3", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, marginTop: 4 },
  secondaryBtnText: { color: "#175CD3", fontWeight: "700" }
});
