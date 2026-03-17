import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/lib/api";
import { getDomainTree, type DomainTreeResponse } from "@/lib/domainTree";

type CareerRoadmapResponse = { goal: string; steps: Array<{ stepNumber: number; title: string }> };

export default function AiCareerRoadmapPage() {
  const [domainTree, setDomainTree] = useState<DomainTreeResponse | null>(null);
  const [primaryCategory, setPrimaryCategory] = useState("");
  const [subCategory, setSubCategory] = useState("");
  const [focus, setFocus] = useState("");
  const [customGoal, setCustomGoal] = useState("");
  const [data, setData] = useState<CareerRoadmapResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    getDomainTree()
      .then((tree) => {
        if (!mounted) return;
        setDomainTree(tree);
        const p = tree.primaryCategories?.[0] || "";
        const s = (tree.subCategoriesByPrimary?.[p] || [])[0] || "";
        const f = (tree.focusByPrimarySub?.[`${p}::${s}`] || [])[0] || "";
        setPrimaryCategory((prev) => prev || p);
        setSubCategory((prev) => prev || s);
        setFocus((prev) => prev || f);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!domainTree || !primaryCategory) return;
    const subs = domainTree.subCategoriesByPrimary?.[primaryCategory] || [];
    if (!subs.length) return;
    if (!subs.includes(subCategory)) setSubCategory(subs[0]);
  }, [domainTree, primaryCategory, subCategory]);

  useEffect(() => {
    if (!domainTree || !primaryCategory || !subCategory) return;
    const focuses = domainTree.focusByPrimarySub?.[`${primaryCategory}::${subCategory}`] || [];
    if (!focuses.length) {
      setFocus("");
      return;
    }
    if (!focuses.includes(focus)) setFocus(focuses[0]);
  }, [domainTree, primaryCategory, subCategory, focus]);

  const goalLabel = useMemo(() => [primaryCategory, subCategory, focus].filter(Boolean).join(" > "), [primaryCategory, subCategory, focus]);

  const load = useCallback(async (refresh = false) => {
    try {
      if (refresh) setRefreshing(true); else setLoading(true);
      setError(null);
      const res = await api.get<CareerRoadmapResponse>("/api/network/career-roadmap", {
        params: {
          primaryCategory,
          subCategory,
          focus,
          goal: customGoal.trim() || goalLabel
        }
      });
      setData(res.data || null);
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to load roadmap.");
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, [primaryCategory, subCategory, focus, goalLabel, customGoal]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <ScrollView contentContainerStyle={styles.page} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}>
      <Text style={styles.pageTitle}>AI Career Roadmap</Text>
      <Text style={styles.pageSub}>Generate a milestone-based roadmap for your target role.</Text>

      <View style={styles.section}>
        <View style={styles.sectionHeader}><Ionicons name="map" size={16} color="#1F7A4C" /><Text style={styles.sectionTitle}>Overview</Text></View>
        <Text style={styles.meta}>
          Select your Domain Guide path (domain, sub-domain, focus) and generate a step-by-step roadmap for it.
        </Text>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}><Ionicons name="options" size={16} color="#1F7A4C" /><Text style={styles.sectionTitle}>Main Feature</Text></View>
        <Text style={styles.label}>Domain (Domain Guide)</Text>
        <View style={styles.chips}>
          {(domainTree?.primaryCategories || []).map((p) => (
            <TouchableOpacity key={p} style={[styles.chip, primaryCategory===p && styles.chipActive]} onPress={() => setPrimaryCategory(p)}>
              <Text style={[styles.chipText, primaryCategory===p && styles.chipTextActive]}>{p}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.label}>Sub-domain</Text>
        <View style={styles.chips}>
          {(domainTree?.subCategoriesByPrimary?.[primaryCategory] || []).map((s) => (
            <TouchableOpacity key={s} style={[styles.chip, subCategory===s && styles.chipActive]} onPress={() => setSubCategory(s)}>
              <Text style={[styles.chipText, subCategory===s && styles.chipTextActive]}>{s}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.label}>Focus</Text>
        <View style={styles.chips}>
          {(domainTree?.focusByPrimarySub?.[`${primaryCategory}::${subCategory}`] || []).map((f) => (
            <TouchableOpacity key={f} style={[styles.chip, focus===f && styles.chipActive]} onPress={() => setFocus(f)}>
              <Text style={[styles.chipText, focus===f && styles.chipTextActive]}>{f}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.label}>Custom Goal (optional)</Text>
        <TextInput
          style={styles.input}
          value={customGoal}
          onChangeText={setCustomGoal}
          placeholder="Example: UPSC Mains, Backend Developer, Corporate Law"
        />
        <TouchableOpacity style={styles.primaryBtn} onPress={() => load(true)}><Text style={styles.primaryBtnText}>Generate Roadmap</Text></TouchableOpacity>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}><Ionicons name="list" size={16} color="#1F7A4C" /><Text style={styles.sectionTitle}>Results</Text></View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {loading ? <ActivityIndicator size="large" color="#1F7A4C" /> : null}
        {!loading && !data ? <Text style={styles.meta}>Roadmap unavailable.</Text> : null}
        {data ? (
          <>
            <Text style={styles.resultTitle}>Generated for: {goalLabel || data.goal}</Text>
            {data.steps.map((step, idx) => (
              <View key={`${step.stepNumber}-${step.title}`} style={styles.stepRow}>
                <View style={styles.stepDot}><Text style={styles.stepDotText}>{idx + 1}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.stepTitle}>{step.title}</Text>
                  <Text style={styles.meta}>Timeline: Week {idx + 1} - Week {idx + 2}</Text>
                </View>
              </View>
            ))}
          </>
        ) : null}
      </View>

      <View style={styles.section}><View style={styles.sectionHeader}><Ionicons name="flash" size={16} color="#1F7A4C" /><Text style={styles.sectionTitle}>Actions</Text></View><TouchableOpacity style={styles.primaryBtn}><Text style={styles.primaryBtnText}>Save Roadmap</Text></TouchableOpacity></View>
      <View style={styles.section}><View style={styles.sectionHeader}><Ionicons name="help-circle" size={16} color="#1F7A4C" /><Text style={styles.sectionTitle}>Resources</Text></View><Text style={styles.meta}>Pair each milestone with one mini project and one mentor session.</Text></View>
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
  resultTitle: { fontWeight: "800", color: "#1E2B24" },
  stepRow: { flexDirection: "row", gap: 10, alignItems: "center", marginTop: 4 },
  stepDot: { width: 24, height: 24, borderRadius: 12, backgroundColor: "#1F7A4C", alignItems: "center", justifyContent: "center" },
  stepDotText: { color: "#fff", fontWeight: "800", fontSize: 12 },
  stepTitle: { color: "#1E2B24", fontWeight: "700" },
  meta: { color: "#667085" },
  error: { color: "#B42318" },
  primaryBtn: { alignSelf: "flex-start", backgroundColor: "#1F7A4C", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9 },
  primaryBtnText: { color: "#fff", fontWeight: "700" }
});
