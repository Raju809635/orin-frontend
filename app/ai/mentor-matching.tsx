import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useAppTheme } from "@/context/ThemeContext";
import { getDomainTree, type DomainTreeResponse } from "@/lib/domainTree";
import { notify } from "@/utils/notify";
import { saveAiItem } from "@/utils/aiSaves";

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

const LEVEL_OPTIONS = ["Beginner", "Intermediate", "Advanced"];

export default function AiMentorMatchingPage() {
  const { user } = useAuth();
  const { colors, isDark } = useAppTheme();
  const [domainTree, setDomainTree] = useState<DomainTreeResponse | null>(null);
  const [selectedDomain, setSelectedDomain] = useState("");
  const [selectedLevel, setSelectedLevel] = useState("Beginner");
  const [items, setItems] = useState<MentorMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [finding, setFinding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const didAutofill = useRef(false);

  useEffect(() => {
    let mounted = true;
    getDomainTree()
      .then((tree) => {
        if (!mounted) return;
        setDomainTree(tree);
        setSelectedDomain((prev) => prev || tree.primaryCategories?.[0] || "");
      })
      .catch(() => {
        setSelectedDomain((prev) => prev || "Technology & AI");
      });

    return () => {
      mounted = false;
    };
  }, []);

  const load = useCallback(async (refresh = false) => {
    try {
      if (!selectedDomain) {
        setItems([]);
        setLoading(false);
        setRefreshing(false);
        setFinding(false);
        return;
      }
      if (refresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      const { data } = await api.get<{ studentSignals?: any; recommendations: MentorMatch[] }>("/api/network/mentor-matches", {
        params: {
          domain: selectedDomain,
          level: selectedLevel
        }
      });
      const recs = data?.recommendations || [];
      setItems(recs);

      const suggestedDomain = String(data?.studentSignals?.domain || "").trim();
      if (!didAutofill.current && suggestedDomain) {
        didAutofill.current = true;
        const match = (domainTree?.primaryCategories || []).find((d) => d.toLowerCase() === suggestedDomain.toLowerCase());
        if (match && match !== selectedDomain) setSelectedDomain(match);
      }
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to load mentor matching.");
    } finally {
      setLoading(false);
      setRefreshing(false);
      setFinding(false);
    }
  }, [selectedDomain, selectedLevel, domainTree]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const filtered = useMemo(() => {
    return items.filter((item) => {
      const years = Number(item.experienceYears || 0);
      return selectedLevel === "Beginner"
        ? years <= 3
        : selectedLevel === "Intermediate"
          ? years >= 2 && years <= 6
          : years >= 5;
    });
  }, [items, selectedLevel]);

  const topMatch = filtered[0] || null;
  const avgScore = filtered.length ? Math.round(filtered.reduce((sum, item) => sum + Number(item.matchScore || 0), 0) / filtered.length) : 0;

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={[styles.page, { backgroundColor: colors.background }]} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}>
      <LinearGradient colors={["#0E6A42", "#1F7A4C", "#6FCF97"]} style={styles.hero}>
        <Text style={styles.heroTitle}>AI Mentor Matching</Text>
        <Text style={styles.heroSub}>
          {user?.role === "mentor"
            ? "Discover students who align with your mentoring domains and teaching level."
            : "Find mentors who fit your domain, skill stage, and career direction."}
        </Text>
        <View style={styles.heroStatsRow}>
          <View style={styles.heroStatCard}>
            <Text style={styles.heroStatValue}>{filtered.length}</Text>
            <Text style={styles.heroStatLabel}>Matches</Text>
          </View>
          <View style={styles.heroStatCard}>
            <Text style={styles.heroStatValue}>{avgScore}%</Text>
            <Text style={styles.heroStatLabel}>Avg Match</Text>
          </View>
          <View style={styles.heroStatCard}>
            <Text style={styles.heroStatValue}>{selectedLevel}</Text>
            <Text style={styles.heroStatLabel}>Level</Text>
          </View>
        </View>
      </LinearGradient>

      <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Find Your Best Match</Text>
        <Text style={[styles.label, { color: colors.text }]}>Domain</Text>
        <View style={styles.chips}>
          {(domainTree?.primaryCategories || []).map((item) => (
            <TouchableOpacity key={item} style={[styles.chip, { backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF", borderColor: colors.border }, selectedDomain === item && [styles.chipActive, { backgroundColor: colors.accentSoft, borderColor: colors.accent }]]} onPress={() => setSelectedDomain(item)}>
              <Text style={[styles.chipText, { color: colors.textMuted }, selectedDomain === item && [styles.chipTextActive, { color: colors.accent }]]}>{item}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={[styles.label, { color: colors.text }]}>Experience Level</Text>
        <View style={styles.chips}>
          {LEVEL_OPTIONS.map((item) => (
            <TouchableOpacity key={item} style={[styles.chip, { backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF", borderColor: colors.border }, selectedLevel === item && [styles.chipActive, { backgroundColor: colors.accentSoft, borderColor: colors.accent }]]} onPress={() => setSelectedLevel(item)}>
              <Text style={[styles.chipText, { color: colors.textMuted }, selectedLevel === item && [styles.chipTextActive, { color: colors.accent }]]}>{item}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: colors.accent }]} onPress={() => { setFinding(true); load(true); }}>
          <Text style={styles.primaryBtnText}>{finding ? "Finding..." : "Find Best Match"}</Text>
        </TouchableOpacity>
      </View>

      {topMatch ? (
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Top Recommendation</Text>
          <LinearGradient colors={["#EEF4FF", "#F7F8FF"]} style={styles.topCard}>
            <View style={styles.topCardHeader}>
              <View>
                <Text style={[styles.topCardName, { color: colors.text }]}>{topMatch.name}</Text>
                <Text style={[styles.meta, { color: colors.textMuted }]}>{topMatch.title || "Mentor"}</Text>
              </View>
              <View style={styles.matchBadge}>
                <Text style={styles.matchBadgeText}>{topMatch.matchScore}%</Text>
              </View>
            </View>
            <Text style={[styles.meta, { color: colors.textMuted }]}>
              {(topMatch.primaryCategory || selectedDomain) ? `${topMatch.primaryCategory || selectedDomain}${topMatch.subCategory ? ` > ${topMatch.subCategory}` : ""}` : ""}
            </Text>
            <Text style={[styles.meta, { color: colors.textMuted }]}>Experience: {topMatch.experienceYears || 0} yrs | Rating: {Number(topMatch.rating || 0).toFixed(1)}</Text>
            <View style={styles.reasonRow}>
              {(topMatch.reasons || []).slice(0, 3).map((reason) => (
                <View key={reason} style={styles.reasonPill}>
                  <Text style={styles.reasonText}>{reason}</Text>
                </View>
              ))}
            </View>
            <View style={styles.actionRow}>
              <TouchableOpacity style={styles.primaryBtn} onPress={() => router.push(`/mentor/${topMatch.mentorId}` as never)}>
                <Text style={styles.primaryBtnText}>View Profile</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.push(`/mentor/${topMatch.mentorId}` as never)}>
                <Text style={styles.secondaryBtnText}>Book Session</Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </View>
      ) : null}

      <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Recommended Mentors</Text>
        {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
        {loading ? <ActivityIndicator size="large" color={colors.accent} /> : null}
        {!loading && filtered.length === 0 ? <Text style={[styles.meta, { color: colors.textMuted }]}>No mentors found for the current filters.</Text> : null}
        {filtered.map((item) => (
          <View key={item.mentorId} style={[styles.resultCard, { backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF", borderColor: colors.border }]}>
            <View style={styles.resultTop}>
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarText}>{item.name.charAt(0).toUpperCase()}</Text>
              </View>
              <View style={styles.resultBody}>
                <View style={styles.resultHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.resultTitle, { color: colors.text }]}>{item.name}</Text>
                    <Text style={[styles.meta, { color: colors.textMuted }]}>{item.title || "Mentor"}</Text>
                  </View>
                  <Text style={styles.score}>{item.matchScore}% Match</Text>
                </View>
                <Text style={[styles.meta, { color: colors.textMuted }]}>
                  {(item.primaryCategory || selectedDomain) ? `${item.primaryCategory || selectedDomain}${item.subCategory ? ` > ${item.subCategory}` : ""}` : ""}
                </Text>
                <Text style={[styles.meta, { color: colors.textMuted }]}>Experience: {item.experienceYears || 0} yrs | Rating: {Number(item.rating || 0).toFixed(1)}</Text>
                {(item.reasons || []).length ? (
                  <View style={styles.reasonRow}>
                    {(item.reasons || []).slice(0, 3).map((reason) => (
                      <View key={reason} style={styles.reasonPillSoft}>
                        <Text style={styles.reasonSoftText}>{reason}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}
                <View style={styles.actionRow}>
                  <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.push(`/mentor/${item.mentorId}` as never)}>
                    <Text style={styles.secondaryBtnText}>View Profile</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.ghostBtn} onPress={() => router.push(`/mentor/${item.mentorId}` as never)}>
                    <Text style={styles.ghostBtnText}>Connect</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Actions</Text>
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => {
              const first = filtered[0];
              if (!first) {
                notify("No mentor available yet.");
                return;
              }
              router.push(`/mentor/${first.mentorId}` as never);
            }}
          >
            <Text style={styles.primaryBtnText}>Open Best Match</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={async () => {
              if (!filtered.length) {
                notify("No results to save yet.");
                return;
              }
              await saveAiItem({
                type: "mentor_matching",
                title: `Mentor Matches: ${selectedDomain} (${selectedLevel})`,
                payload: {
                  domain: selectedDomain,
                  level: selectedLevel,
                  savedCount: Math.min(filtered.length, 12),
                  results: filtered.slice(0, 12)
                }
              });
              notify("Saved to Saved AI.");
            }}
          >
            <Text style={styles.secondaryBtnText}>Save Results</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, backgroundColor: "#F3F6FB", gap: 12 },
  hero: { borderRadius: 24, padding: 18, gap: 12 },
  heroTitle: { fontSize: 28, fontWeight: "900", color: "#FFFFFF" },
  heroSub: { color: "#EAFBF1", lineHeight: 20 },
  heroStatsRow: { flexDirection: "row", gap: 10 },
  heroStatCard: { flex: 1, backgroundColor: "rgba(255,255,255,0.14)", borderRadius: 16, padding: 12, gap: 4 },
  heroStatValue: { color: "#FFFFFF", fontWeight: "900", fontSize: 18 },
  heroStatLabel: { color: "#EAFBF1", fontSize: 12, fontWeight: "700" },
  section: { backgroundColor: "#FFFFFF", borderRadius: 18, borderWidth: 1, borderColor: "#E4E7EC", padding: 14, gap: 10 },
  sectionTitle: { fontWeight: "800", color: "#1E2B24", fontSize: 17 },
  label: { color: "#344054", fontWeight: "700", marginTop: 2 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1, borderColor: "#D0D5DD", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: "#fff" },
  chipActive: { borderColor: "#1F7A4C", backgroundColor: "#EAF6EF" },
  chipText: { color: "#475467", fontWeight: "700", fontSize: 12 },
  chipTextActive: { color: "#1F7A4C" },
  topCard: { borderRadius: 18, padding: 16, gap: 10, borderWidth: 1, borderColor: "#D6E4FF" },
  topCardHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 },
  topCardName: { color: "#101828", fontSize: 20, fontWeight: "900" },
  matchBadge: { backgroundColor: "#175CD3", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  matchBadgeText: { color: "#FFFFFF", fontWeight: "900" },
  resultCard: { backgroundColor: "#FCFDFF", borderColor: "#D9E3F0", borderWidth: 1, borderRadius: 16, padding: 12 },
  resultTop: { flexDirection: "row", gap: 12 },
  avatarPlaceholder: { width: 54, height: 54, borderRadius: 27, backgroundColor: "#EAF6EF", alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#1F7A4C", fontWeight: "900", fontSize: 20 },
  resultBody: { flex: 1, gap: 6 },
  resultHeader: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  resultTitle: { fontWeight: "800", color: "#1E2B24", fontSize: 16 },
  score: { color: "#175CD3", fontWeight: "900" },
  reasonRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  reasonPill: { backgroundColor: "#FFFFFF", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: "#D6E4FF" },
  reasonText: { color: "#344054", fontWeight: "700", fontSize: 12 },
  reasonPillSoft: { backgroundColor: "#F5F8FF", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  reasonSoftText: { color: "#175CD3", fontWeight: "700", fontSize: 12 },
  meta: { color: "#667085", lineHeight: 20 },
  error: { color: "#B42318" },
  actionRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  primaryBtn: { alignSelf: "flex-start", backgroundColor: "#1F7A4C", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11 },
  primaryBtnText: { color: "#fff", fontWeight: "800" },
  secondaryBtn: { alignSelf: "flex-start", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, backgroundColor: "#EEF4FF" },
  secondaryBtnText: { color: "#175CD3", fontWeight: "800" },
  ghostBtn: { alignSelf: "flex-start", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, backgroundColor: "#F4FBF7", borderWidth: 1, borderColor: "#B7E4C7" },
  ghostBtnText: { color: "#1F7A4C", fontWeight: "800" }
});
