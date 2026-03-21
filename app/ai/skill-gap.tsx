import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/lib/api";
import { getDomainTree, type DomainTreeResponse } from "@/lib/domainTree";
import { notify } from "@/utils/notify";
import { saveAiItem } from "@/utils/aiSaves";

type SkillGapResponse = { goal: string; currentSkills: string[]; missingSkills: string[]; suggestions?: { courses?: string[] } };

export default function AiSkillGapPage() {
  const [domainTree, setDomainTree] = useState<DomainTreeResponse | null>(null);
  const [primaryCategory, setPrimaryCategory] = useState("");
  const [subCategory, setSubCategory] = useState("");
  const [focus, setFocus] = useState("");
  const [customGoal, setCustomGoal] = useState("");
  const [skillsInput, setSkillsInput] = useState("");
  const [data, setData] = useState<SkillGapResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
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
      .catch(() => {
        // If this fails, backend still falls back to saved user profile + goal.
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!domainTree || !primaryCategory) return;
    const subs = domainTree.subCategoriesByPrimary?.[primaryCategory] || [];
    if (!subs.length) return;
    if (!subs.includes(subCategory)) {
      setSubCategory(subs[0]);
    }
  }, [domainTree, primaryCategory, subCategory]);

  useEffect(() => {
    if (!domainTree || !primaryCategory || !subCategory) return;
    const focuses = domainTree.focusByPrimarySub?.[`${primaryCategory}::${subCategory}`] || [];
    if (!focuses.length) {
      setFocus("");
      return;
    }
    if (!focuses.includes(focus)) {
      setFocus(focuses[0]);
    }
  }, [domainTree, primaryCategory, subCategory, focus]);

  const load = useCallback(async (refresh = false) => {
    try {
      if (refresh) setRefreshing(true); else setLoading(true);
      setError(null);
      const res = await api.get<SkillGapResponse>("/api/network/skill-gap", {
        params: {
          primaryCategory,
          subCategory,
          focus,
          goal: customGoal.trim() || [primaryCategory, subCategory, focus].filter(Boolean).join(" > "),
          // CSV override; if empty the backend falls back to saved profile skills.
          skills: skillsInput
        }
      });
      setData(res.data || null);
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to load skill gap.");
    } finally {
      setLoading(false); setRefreshing(false); setAnalyzing(false);
    }
  }, [primaryCategory, subCategory, focus, customGoal, skillsInput]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const enteredSkills = useMemo(() => skillsInput.split(",").map((s) => s.trim()).filter(Boolean), [skillsInput]);

  return (
    <ScrollView contentContainerStyle={styles.page} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}>
      <Text style={styles.pageTitle}>AI Skill Gap Analysis</Text>
      <Text style={styles.pageSub}>Analyze missing skills for your target career and get learning recommendations.</Text>

      <View style={styles.section}>
        <View style={styles.sectionHeader}><Ionicons name="analytics" size={16} color="#1F7A4C" /><Text style={styles.sectionTitle}>Overview</Text></View>
        <Text style={styles.meta}>
          Select your path from the Domain Guide (domain, sub-domain, focus). ORIN then checks what skills/topics you're missing and suggests next steps.
        </Text>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}><Ionicons name="build" size={16} color="#1F7A4C" /><Text style={styles.sectionTitle}>Main Feature</Text></View>
        <Text style={styles.label}>Domain (Domain Guide)</Text>
        <View style={styles.chips}>
          {(domainTree?.primaryCategories || []).map((p) => (
            <TouchableOpacity
              key={p}
              style={[styles.chip, primaryCategory === p && styles.chipActive]}
              onPress={() => setPrimaryCategory(p)}
            >
              <Text style={[styles.chipText, primaryCategory === p && styles.chipTextActive]}>{p}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Sub-domain</Text>
        <View style={styles.chips}>
          {(domainTree?.subCategoriesByPrimary?.[primaryCategory] || []).map((s) => (
            <TouchableOpacity
              key={s}
              style={[styles.chip, subCategory === s && styles.chipActive]}
              onPress={() => setSubCategory(s)}
            >
              <Text style={[styles.chipText, subCategory === s && styles.chipTextActive]}>{s}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Focus</Text>
        <View style={styles.chips}>
          {(domainTree?.focusByPrimarySub?.[`${primaryCategory}::${subCategory}`] || []).map((f) => (
            <TouchableOpacity
              key={f}
              style={[styles.chip, focus === f && styles.chipActive]}
              onPress={() => setFocus(f)}
            >
              <Text style={[styles.chipText, focus === f && styles.chipTextActive]}>{f}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Custom Goal (optional)</Text>
        <TextInput
          style={styles.input}
          value={customGoal}
          onChangeText={setCustomGoal}
          placeholder="Example: UPSC Prelims, Frontend Developer, Constitutional Law"
        />

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
            <Text style={styles.meta}>Goal: {data.goal}</Text>
            <Text style={styles.meta}>Skills Used: {(data.currentSkills || enteredSkills).join(", ") || "None"}</Text>
            <Text style={styles.resultTitle}>Missing Skills</Text>
            {(data.missingSkills || []).map((s) => <Text key={s} style={styles.meta}>• {s}</Text>)}
            <Text style={styles.resultTitle}>Recommended Resources</Text>
            {(data.suggestions?.courses || []).slice(0, 8).map((c, i) => <Text key={`${c}-${i}`} style={styles.meta}>• {c}</Text>)}
          </>
        ) : null}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}><Ionicons name="flash" size={16} color="#1F7A4C" /><Text style={styles.sectionTitle}>Actions</Text></View>
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={async () => {
            if (!data) {
              notify("Run analysis first.");
              return;
            }
            await saveAiItem({
              type: "skill_gap",
              title: `Skill Gap: ${primaryCategory}${subCategory ? ` > ${subCategory}` : ""}${focus ? ` > ${focus}` : ""}`,
              payload: {
                primaryCategory,
                subCategory,
                focus,
                goal: data.goal,
                currentSkills: data.currentSkills || enteredSkills,
                missingSkills: data.missingSkills || [],
                suggestions: data.suggestions || {}
              }
            });
            notify("Saved to Saved AI.");
          }}
        >
          <Text style={styles.primaryBtnText}>Save Analysis</Text>
        </TouchableOpacity>
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
