import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/lib/api";
import { getDomainTree, type DomainTreeResponse } from "@/lib/domainTree";
import { notify } from "@/utils/notify";
import { saveAiItem } from "@/utils/aiSaves";

type ProjectIdeasResponse = { goal: string; ideas: Array<{ title: string }> };

const LEVEL_OPTIONS = ["Beginner", "Intermediate", "Advanced"];

export default function AiProjectIdeasPage() {
  const [domainTree, setDomainTree] = useState<DomainTreeResponse | null>(null);
  const [primaryCategory, setPrimaryCategory] = useState("");
  const [subCategory, setSubCategory] = useState("");
  const [focus, setFocus] = useState("");
  const [customGoal, setCustomGoal] = useState("");
  const [level, setLevel] = useState(LEVEL_OPTIONS[0]);
  const [data, setData] = useState<ProjectIdeasResponse | null>(null);
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

  const load = useCallback(async (refresh = false) => {
    try {
      if (refresh) setRefreshing(true); else setLoading(true);
      setError(null);
      const res = await api.get<ProjectIdeasResponse>("/api/network/project-ideas", {
        params: {
          primaryCategory,
          subCategory,
          focus,
          domain: primaryCategory,
          level,
          goal: customGoal.trim() || [primaryCategory, subCategory, focus].filter(Boolean).join(" > ")
        }
      });
      setData(res.data || null);
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to load project ideas.");
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, [primaryCategory, subCategory, focus, level, customGoal]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const difficulty = useMemo(() => (level === "Beginner" ? "Easy" : level === "Intermediate" ? "Medium" : "Hard"), [level]);
  const suggestedStack = useMemo(() => {
    if (primaryCategory === "Technology & AI") {
      if (subCategory === "Web Development") return "React, Node.js, MongoDB";
      if (subCategory === "Data Science") return "Python, Pandas, Matplotlib";
      if (subCategory === "AI/ML") return "Python, ML libraries, APIs";
      return "JavaScript, Python, Git";
    }
    return "Notes, planning, practice systems (ORIN tools)";
  }, [primaryCategory, subCategory]);

  return (
    <ScrollView contentContainerStyle={styles.page} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}>
      <Text style={styles.pageTitle}>AI Project Ideas</Text>
      <Text style={styles.pageSub}>Generate practical projects with difficulty and stack suggestions.</Text>

      <View style={styles.section}><View style={styles.sectionHeader}><Ionicons name="bulb" size={16} color="#1F7A4C" /><Text style={styles.sectionTitle}>Overview</Text></View><Text style={styles.meta}>Pick your Domain Guide path and skill level to generate ideas you can start today.</Text></View>

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
          placeholder="Example: UPSC Prelims, Frontend, Personal Finance"
        />
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
            <Text style={styles.meta}>Suggested Stack: {suggestedStack}</Text>
          </View>
        ))}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}><Ionicons name="flash" size={16} color="#1F7A4C" /><Text style={styles.sectionTitle}>Actions</Text></View>
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={async () => {
            if (!data || !(data.ideas || []).length) {
              notify("Generate ideas first.");
              return;
            }
            await saveAiItem({
              type: "project_ideas",
              title: `Project Ideas: ${primaryCategory}${subCategory ? ` > ${subCategory}` : ""}`,
              payload: {
                primaryCategory,
                subCategory,
                focus,
                level,
                difficulty,
                suggestedStack,
                ideas: data.ideas || []
              }
            });
            notify("Saved to Saved AI.");
          }}
        >
          <Text style={styles.primaryBtnText}>Save Ideas</Text>
        </TouchableOpacity>
      </View>
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
  input: { borderWidth: 1, borderColor: "#D0D5DD", borderRadius: 10, backgroundColor: "#fff", paddingHorizontal: 12, paddingVertical: 10, color: "#344054" },
  ideaCard: { backgroundColor: "#FFF7ED", borderColor: "#F9DBAF", borderWidth: 1, borderRadius: 12, padding: 10, gap: 3 },
  resultTitle: { fontWeight: "800", color: "#1E2B24" },
  meta: { color: "#667085" },
  error: { color: "#B42318" },
  primaryBtn: { alignSelf: "flex-start", backgroundColor: "#1F7A4C", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9 },
  primaryBtnText: { color: "#fff", fontWeight: "700" }
});
