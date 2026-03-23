import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { api } from "@/lib/api";
import { getDomainTree, type DomainTreeResponse } from "@/lib/domainTree";
import { notify } from "@/utils/notify";
import { saveAiItem } from "@/utils/aiSaves";

type SkillGapResponse = {
  goal: string;
  currentSkills: string[];
  missingSkills: string[];
  suggestions?: { courses?: string[] };
};

export default function AiSkillGapPage() {
  const router = useRouter();
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
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null);
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

  const goalLabel = useMemo(
    () => customGoal.trim() || [primaryCategory, subCategory, focus].filter(Boolean).join(" > "),
    [customGoal, primaryCategory, subCategory, focus]
  );

  const enteredSkills = useMemo(
    () => skillsInput.split(",").map((item) => item.trim()).filter(Boolean),
    [skillsInput]
  );

  const load = useCallback(
    async (refresh = false) => {
      try {
        if (refresh) setRefreshing(true);
        else setLoading(true);
        setError(null);
        const res = await api.get<SkillGapResponse>("/api/network/skill-gap", {
          params: {
            primaryCategory,
            subCategory,
            focus,
            goal: goalLabel,
            skills: skillsInput
          }
        });
        setData(res.data || null);
        setSelectedSkill(null);
      } catch (e: any) {
        setError(e?.response?.data?.message || "Failed to load skill gap.");
      } finally {
        setLoading(false);
        setRefreshing(false);
        setAnalyzing(false);
      }
    },
    [primaryCategory, subCategory, focus, goalLabel, skillsInput]
  );

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const currentSkills = data?.currentSkills?.length ? data.currentSkills : enteredSkills;
  const missingSkills = data?.missingSkills || [];
  const totalSkillCount = currentSkills.length + missingSkills.length;
  const readiness = totalSkillCount ? Math.round((currentSkills.length / totalSkillCount) * 100) : 0;
  const selectedSkillResources = useMemo(() => {
    const courses = data?.suggestions?.courses || [];
    if (!selectedSkill) return courses.slice(0, 4);
    return courses.filter((item) => item.toLowerCase().includes(selectedSkill.toLowerCase())).slice(0, 4);
  }, [data?.suggestions?.courses, selectedSkill]);

  return (
    <ScrollView contentContainerStyle={styles.page} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}>
      <LinearGradient colors={["#304FFE", "#6C63FF", "#8E7CFF"]} style={styles.hero}>
        <Text style={styles.heroTitle}>Skill Dashboard</Text>
        <Text style={styles.heroSub}>Your personal readiness report for the next career jump.</Text>
        <View style={styles.heroCard}>
          <Text style={styles.heroGoal}>Goal: {data?.goal || goalLabel || "Career Growth"}</Text>
          <Text style={styles.heroReadiness}>Readiness: {readiness}%</Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${readiness}%` }]} />
          </View>
          <Text style={styles.heroMeta}>Missing {missingSkills.length} key skill{missingSkills.length === 1 ? "" : "s"}</Text>
        </View>
      </LinearGradient>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Analyze Your Path</Text>
        <Text style={styles.label}>Domain</Text>
        <View style={styles.chips}>
          {(domainTree?.primaryCategories || []).map((item) => (
            <TouchableOpacity key={item} style={[styles.chip, primaryCategory === item && styles.chipActive]} onPress={() => setPrimaryCategory(item)}>
              <Text style={[styles.chipText, primaryCategory === item && styles.chipTextActive]}>{item}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Sub-domain</Text>
        <View style={styles.chips}>
          {(domainTree?.subCategoriesByPrimary?.[primaryCategory] || []).map((item) => (
            <TouchableOpacity key={item} style={[styles.chip, subCategory === item && styles.chipActive]} onPress={() => setSubCategory(item)}>
              <Text style={[styles.chipText, subCategory === item && styles.chipTextActive]}>{item}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Focus</Text>
        <View style={styles.chips}>
          {(domainTree?.focusByPrimarySub?.[`${primaryCategory}::${subCategory}`] || []).map((item) => (
            <TouchableOpacity key={item} style={[styles.chip, focus === item && styles.chipActive]} onPress={() => setFocus(item)}>
              <Text style={[styles.chipText, focus === item && styles.chipTextActive]}>{item}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Custom Goal</Text>
        <TextInput style={styles.input} value={customGoal} onChangeText={setCustomGoal} placeholder="Example: AI Engineer, UPSC Mains, Corporate Lawyer" />

        <Text style={styles.label}>Current Skills</Text>
        <TextInput style={styles.input} value={skillsInput} onChangeText={setSkillsInput} placeholder="Python, SQL, Research Basics" />

        <TouchableOpacity style={styles.primaryBtn} onPress={() => { setAnalyzing(true); load(true); }}>
          <Text style={styles.primaryBtnText}>{analyzing ? "Analyzing..." : "Analyze Skills"}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Visual Skill Report</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {loading ? <ActivityIndicator size="large" color="#5B4DFF" /> : null}
        {!loading && !data ? <Text style={styles.meta}>No analysis available yet.</Text> : null}
        {data ? (
          <>
            <View style={styles.grid}>
              <View style={[styles.skillCard, styles.knownCard]}>
                <Text style={styles.skillCardTitle}>You Know</Text>
                {currentSkills.length ? (
                  currentSkills.map((item) => (
                    <TouchableOpacity key={item} style={styles.skillPillKnown} onPress={() => setSelectedSkill(item)}>
                      <Text style={styles.skillPillKnownText}>Known · {item}</Text>
                    </TouchableOpacity>
                  ))
                ) : (
                  <Text style={styles.meta}>No skills detected yet.</Text>
                )}
              </View>

              <View style={[styles.skillCard, styles.missingCard]}>
                <Text style={styles.skillCardTitle}>Missing</Text>
                {missingSkills.length ? (
                  missingSkills.map((item, index) => (
                    <TouchableOpacity key={item} style={styles.skillPillMissing} onPress={() => setSelectedSkill(item)}>
                      <Text style={styles.skillPillMissingText}>{index < 2 ? "High Priority" : "Missing"} · {item}</Text>
                    </TouchableOpacity>
                  ))
                ) : (
                  <Text style={styles.meta}>Great job. No major gaps detected.</Text>
                )}
              </View>
            </View>

            <View style={styles.resourceCard}>
              <View style={styles.resourceHeader}>
                <Text style={styles.resourceTitle}>{selectedSkill ? `${selectedSkill} Resources` : "Recommended Resources"}</Text>
                {selectedSkill ? <Text style={styles.resourceTag}>Tap another skill to switch</Text> : null}
              </View>
              {(selectedSkillResources.length ? selectedSkillResources : data.suggestions?.courses || []).slice(0, 5).map((item, index) => (
                <View key={`${item}-${index}`} style={styles.resourceRow}>
                  <Ionicons name="school-outline" size={16} color="#5B4DFF" />
                  <Text style={styles.resourceText}>{item}</Text>
                </View>
              ))}
              {missingSkills.length ? (
                <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.push("/ai/career-roadmap" as never)}>
                  <Text style={styles.secondaryBtnText}>Start Learning</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </>
        ) : null}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Actions</Text>
        <View style={styles.actionRow}>
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
                  currentSkills,
                  missingSkills,
                  suggestions: data.suggestions || {}
                }
              });
              notify("Saved to Saved AI.");
            }}
          >
            <Text style={styles.primaryBtnText}>Save Dashboard</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.push("/ai/project-ideas" as never)}>
            <Text style={styles.secondaryBtnText}>Get Projects</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, backgroundColor: "#F3F6FB", gap: 12 },
  hero: { borderRadius: 24, padding: 18, gap: 12 },
  heroTitle: { color: "#FFFFFF", fontSize: 28, fontWeight: "900" },
  heroSub: { color: "#E8E7FF" },
  heroCard: { backgroundColor: "rgba(255,255,255,0.14)", borderRadius: 16, padding: 14, gap: 8 },
  heroGoal: { color: "#FFFFFF", fontWeight: "800", fontSize: 16 },
  heroReadiness: { color: "#FFFFFF", fontWeight: "800" },
  heroMeta: { color: "#E8E7FF", fontWeight: "700" },
  progressTrack: { height: 10, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.2)", overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 999, backgroundColor: "#8CFFB8" },
  section: { backgroundColor: "#FFFFFF", borderRadius: 18, borderWidth: 1, borderColor: "#E4E7EC", padding: 14, gap: 10 },
  sectionTitle: { fontWeight: "800", color: "#1E2B24", fontSize: 17 },
  label: { color: "#344054", fontWeight: "700", marginTop: 2 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1, borderColor: "#D0D5DD", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: "#fff" },
  chipActive: { borderColor: "#5B4DFF", backgroundColor: "#F0EEFF" },
  chipText: { color: "#475467", fontWeight: "700", fontSize: 12 },
  chipTextActive: { color: "#5B4DFF" },
  input: { borderWidth: 1, borderColor: "#D0D5DD", borderRadius: 12, backgroundColor: "#fff", paddingHorizontal: 12, paddingVertical: 12, color: "#344054" },
  grid: { gap: 12 },
  skillCard: { borderRadius: 16, padding: 14, gap: 8 },
  knownCard: { backgroundColor: "#ECFDF3", borderWidth: 1, borderColor: "#B7E4C7" },
  missingCard: { backgroundColor: "#FFF7ED", borderWidth: 1, borderColor: "#F7C99A" },
  skillCardTitle: { color: "#1E2B24", fontSize: 16, fontWeight: "800" },
  skillPillKnown: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: "#D1FADF" },
  skillPillKnownText: { color: "#166534", fontWeight: "700" },
  skillPillMissing: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: "#FEE4E2" },
  skillPillMissingText: { color: "#B42318", fontWeight: "700" },
  resourceCard: { borderRadius: 16, backgroundColor: "#F8F7FF", borderWidth: 1, borderColor: "#DBD8FF", padding: 14, gap: 8 },
  resourceHeader: { gap: 4 },
  resourceTitle: { color: "#312E81", fontWeight: "800", fontSize: 16 },
  resourceTag: { color: "#667085", fontSize: 12 },
  resourceRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  resourceText: { flex: 1, color: "#344054" },
  actionRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  meta: { color: "#667085", lineHeight: 20 },
  error: { color: "#B42318" },
  primaryBtn: { alignSelf: "flex-start", backgroundColor: "#5B4DFF", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11 },
  primaryBtnText: { color: "#fff", fontWeight: "800" },
  secondaryBtn: { alignSelf: "flex-start", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, backgroundColor: "#EAF6EF" },
  secondaryBtnText: { color: "#1F7A4C", fontWeight: "800" }
});

