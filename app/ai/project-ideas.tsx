import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { api } from "@/lib/api";
import { getDomainTree, type DomainTreeResponse } from "@/lib/domainTree";
import { useAppTheme } from "@/context/ThemeContext";
import { notify } from "@/utils/notify";
import { saveAiItem } from "@/utils/aiSaves";

type ProjectIdea = {
  title: string;
  level?: string;
  tags?: string[];
  recommended?: boolean;
  why?: string;
  stage?: string;
};
type ProjectIdeasResponse = {
  goal: string;
  ideas: ProjectIdea[];
  journey?: {
    currentStep?: string;
    readinessScore?: number;
    focusLabel?: string;
    personalizationReason?: string;
  };
};
type ProjectMissionState = { tasks: { id: string; title: string; done: boolean }[] };

const LEVEL_OPTIONS = ["Beginner", "Intermediate", "Advanced"];
const STORAGE_PREFIX = "orin:project-build:";

export default function AiProjectIdeasPage() {
  const { colors } = useAppTheme();
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
  const [activeProject, setActiveProject] = useState<string | null>(null);
  const [missions, setMissions] = useState<Record<string, ProjectMissionState>>({});

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

  const load = useCallback(
    async (refresh = false) => {
      try {
        if (refresh) setRefreshing(true);
        else setLoading(true);
        setError(null);
        const res = await api.get<ProjectIdeasResponse>("/api/network/project-ideas", {
          params: {
            primaryCategory,
            subCategory,
            focus,
            domain: primaryCategory,
            level,
            goal: goalLabel
          }
        });
        setData(res.data || null);
      } catch (e: any) {
        setError(e?.response?.data?.message || "Failed to load project ideas.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [primaryCategory, subCategory, focus, level, goalLabel]
  );

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  useEffect(() => {
    const ideas = data?.ideas || [];
    if (!ideas.length) return;
    let mounted = true;
    (async () => {
      const pairs = await Promise.all(
        ideas.map(async (idea) => {
          const raw = await AsyncStorage.getItem(`${STORAGE_PREFIX}${idea.title.toLowerCase()}`);
          return [idea.title, raw ? (JSON.parse(raw) as ProjectMissionState) : buildMissionTemplate(idea.title)] as const;
        })
      );
      if (!mounted) return;
      setMissions(Object.fromEntries(pairs));
    })();
    return () => {
      mounted = false;
    };
  }, [data]);

  const difficulty = useMemo(() => {
    if (level === "Beginner") return "Easy";
    if (level === "Intermediate") return "Medium";
    return "Hard";
  }, [level]);

  const difficultyColor = useMemo(() => {
    if (difficulty === "Easy") return "#1F7A4C";
    if (difficulty === "Medium") return "#B54708";
    return "#B42318";
  }, [difficulty]);

  const suggestedStack = useMemo(() => {
    if (primaryCategory === "Technology & AI") {
      if (subCategory === "Web Development") return "React, Node.js, MongoDB";
      if (subCategory === "Data Science") return "Python, Pandas, Matplotlib";
      if (subCategory === "AI/ML") return "Python, APIs, ML libraries";
      return "JavaScript, Python, Git";
    }
    if (primaryCategory === "Law & Governance") return "Reading system, case analysis, note bank";
    if (primaryCategory === "Competitive Exams") return "Mocks, revision planner, PYQs";
    return "Research, notes, execution tracker";
  }, [primaryCategory, subCategory]);

  const toggleTask = useCallback(async (title: string, taskId: string) => {
    const current = missions[title] || buildMissionTemplate(title);
    const next: ProjectMissionState = {
      tasks: current.tasks.map((task) => (task.id === taskId ? { ...task, done: !task.done } : task))
    };
    setMissions((prev) => ({ ...prev, [title]: next }));
    await AsyncStorage.setItem(`${STORAGE_PREFIX}${title.toLowerCase()}`, JSON.stringify(next));
    const completedCount = next.tasks.filter((task) => task.done).length;
    if (completedCount === next.tasks.length) {
      notify("Project completed. +50 XP and certificate unlocked.");
    } else {
      notify("Task updated. Streak +1");
    }
  }, [missions]);

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={[styles.page, { backgroundColor: colors.background }]} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}>
      <LinearGradient colors={["#0E6A42", "#1F7A4C", "#7AD39D"]} style={styles.hero}>
        <Text style={styles.heroTitle}>Build Mode</Text>
        <Text style={styles.heroSub}>Choose a project and turn it into a real execution system.</Text>
      </LinearGradient>

      <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Generate Ideas</Text>
        <Text style={[styles.label, { color: colors.text }]}>Domain</Text>
        <View style={styles.chips}>
          {(domainTree?.primaryCategories || []).map((item) => (
            <TouchableOpacity key={item} style={[styles.chip, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }, primaryCategory === item && [styles.chipActive, { backgroundColor: colors.accentSoft, borderColor: colors.accent }]]} onPress={() => setPrimaryCategory(item)}>
              <Text style={[styles.chipText, { color: colors.textMuted }, primaryCategory === item && [styles.chipTextActive, { color: colors.accent }]]}>{item}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[styles.label, { color: colors.text }]}>Sub-domain</Text>
        <View style={styles.chips}>
          {(domainTree?.subCategoriesByPrimary?.[primaryCategory] || []).map((item) => (
            <TouchableOpacity key={item} style={[styles.chip, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }, subCategory === item && [styles.chipActive, { backgroundColor: colors.accentSoft, borderColor: colors.accent }]]} onPress={() => setSubCategory(item)}>
              <Text style={[styles.chipText, { color: colors.textMuted }, subCategory === item && [styles.chipTextActive, { color: colors.accent }]]}>{item}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[styles.label, { color: colors.text }]}>Focus</Text>
        <View style={styles.chips}>
          {(domainTree?.focusByPrimarySub?.[`${primaryCategory}::${subCategory}`] || []).map((item) => (
            <TouchableOpacity key={item} style={[styles.chip, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }, focus === item && [styles.chipActive, { backgroundColor: colors.accentSoft, borderColor: colors.accent }]]} onPress={() => setFocus(item)}>
              <Text style={[styles.chipText, { color: colors.textMuted }, focus === item && [styles.chipTextActive, { color: colors.accent }]]}>{item}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[styles.label, { color: colors.text }]}>Custom Goal</Text>
        <TextInput style={[styles.input, { backgroundColor: colors.surfaceAlt, borderColor: colors.border, color: colors.text }]} value={customGoal} onChangeText={setCustomGoal} placeholder="Example: AI Chatbot, UPSC Revision App, Legal Draft Helper" placeholderTextColor={colors.textMuted} />

        <Text style={[styles.label, { color: colors.text }]}>Skill Level</Text>
        <View style={styles.chips}>
          {LEVEL_OPTIONS.map((item) => (
            <TouchableOpacity key={item} style={[styles.chip, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }, level === item && [styles.chipActive, { backgroundColor: colors.accentSoft, borderColor: colors.accent }]]} onPress={() => setLevel(item)}>
              <Text style={[styles.chipText, { color: colors.textMuted }, level === item && [styles.chipTextActive, { color: colors.accent }]]}>{item}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: colors.accent }]} onPress={() => load(true)}>
          <Text style={styles.primaryBtnText}>Generate Ideas</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Project Ideas</Text>
        {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
        {loading ? <ActivityIndicator size="large" color={colors.accent} /> : null}
        {!loading && !data ? <Text style={[styles.meta, { color: colors.textMuted }]}>No ideas available yet.</Text> : null}
        {data?.journey ? (
          <View style={styles.journeyCard}>
            <Text style={styles.journeyLabel}>Personalized Build Track</Text>
            <Text style={styles.journeyTitle}>{data.journey.personalizationReason || `Built for ${data.goal}`}</Text>
            <Text style={styles.meta}>
              {data.journey.currentStep
                ? `Current step: ${data.journey.currentStep}`
                : `Focus: ${data.journey.focusLabel || data.goal}`}
            </Text>
            <Text style={styles.meta}>Readiness: {Math.max(0, Math.round(Number(data.journey.readinessScore || 0)))}%</Text>
          </View>
        ) : null}
        {(data?.ideas || []).slice(0, 8).map((idea, index) => {
          const mission = missions[idea.title] || buildMissionTemplate(idea.title);
          const completed = mission.tasks.filter((task) => task.done).length;
          const progress = mission.tasks.length ? Math.round((completed / mission.tasks.length) * 100) : 0;
          const isOpen = activeProject === idea.title;
          return (
            <View key={`${idea.title}-${index}`} style={styles.projectCard}>
              <View style={styles.projectTop}>
                <Text style={styles.projectTitle}>{idea.title}</Text>
                <Text style={[styles.difficultyBadge, { color: difficultyColor }]}>{difficulty}</Text>
              </View>
              <View style={styles.metaRow}>
                {idea.recommended ? <Text style={styles.recommendedPill}>Recommended</Text> : null}
                {idea.stage ? <Text style={styles.stagePill}>{idea.stage}</Text> : null}
              </View>
              <Text style={styles.meta}>Learn: {suggestedStack}</Text>
              {idea.why ? <Text style={styles.whyText}>{idea.why}</Text> : null}
              <Text style={styles.meta}>People building: {18 + index * 3}</Text>
              {!!idea.tags?.length ? (
                <View style={styles.tagRow}>
                  {idea.tags.map((tag) => (
                    <Text key={`${idea.title}-${tag}`} style={styles.tagPill}>
                      {tag}
                    </Text>
                  ))}
                </View>
              ) : null}
              <TouchableOpacity style={styles.secondaryBtn} onPress={() => setActiveProject((prev) => (prev === idea.title ? null : idea.title))}>
                <Text style={styles.secondaryBtnText}>{isOpen ? "Hide Build Plan" : "Start Project"}</Text>
              </TouchableOpacity>

              {isOpen ? (
                <View style={styles.buildBox}>
                  <View style={styles.buildHeader}>
                    <Text style={styles.buildTitle}>Execution Tasks</Text>
                    <Text style={styles.buildProgress}>{progress}%</Text>
                  </View>
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${progress}%` }]} />
                  </View>
                  {mission.tasks.map((task) => (
                    <TouchableOpacity key={task.id} style={styles.taskRow} onPress={() => toggleTask(idea.title, task.id)}>
                      <Ionicons name={task.done ? "checkmark-circle" : "ellipse-outline"} size={20} color={task.done ? "#1F7A4C" : "#98A2B3"} />
                      <Text style={[styles.taskText, task.done && styles.taskTextDone]}>{task.title}</Text>
                    </TouchableOpacity>
                  ))}
                  {progress === 100 ? <Text style={styles.completeText}>Project completed. +50 XP and certificate unlocked.</Text> : null}
                </View>
              ) : null}
            </View>
          );
        })}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Actions</Text>
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
                ideas: data.ideas || [],
                missions
              }
            });
            notify("Saved to Saved AI.");
          }}
        >
          <Text style={styles.primaryBtnText}>Save Build Mode</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

function buildMissionTemplate(title: string): ProjectMissionState {
  const taskBase = title.toLowerCase();
  const tasks = [
    { id: `${taskBase}-setup`, title: "Setup project structure", done: false },
    { id: `${taskBase}-ui`, title: "Build core UI / workflow", done: false },
    { id: `${taskBase}-logic`, title: "Implement core logic", done: false },
    { id: `${taskBase}-deploy`, title: "Test and publish outcome", done: false }
  ];
  return { tasks };
}

const styles = StyleSheet.create({
  page: { padding: 16, backgroundColor: "#F3F6FB", gap: 12 },
  hero: { borderRadius: 24, padding: 18, gap: 10 },
  heroTitle: { color: "#FFFFFF", fontSize: 28, fontWeight: "900" },
  heroSub: { color: "#E8FFF0" },
  section: { backgroundColor: "#FFFFFF", borderRadius: 18, borderWidth: 1, borderColor: "#E4E7EC", padding: 14, gap: 10 },
  sectionTitle: { fontWeight: "800", color: "#1E2B24", fontSize: 17 },
  label: { color: "#344054", fontWeight: "700", marginTop: 2 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1, borderColor: "#D0D5DD", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: "#fff" },
  chipActive: { borderColor: "#1F7A4C", backgroundColor: "#EAF6EF" },
  chipText: { color: "#475467", fontWeight: "700", fontSize: 12 },
  chipTextActive: { color: "#1F7A4C" },
  input: { borderWidth: 1, borderColor: "#D0D5DD", borderRadius: 12, backgroundColor: "#fff", paddingHorizontal: 12, paddingVertical: 12, color: "#344054" },
  journeyCard: { borderWidth: 1, borderColor: "#D9F2E4", borderRadius: 16, backgroundColor: "#F1FBF5", padding: 12, gap: 4 },
  journeyLabel: { color: "#1F7A4C", fontWeight: "800", fontSize: 12, textTransform: "uppercase", letterSpacing: 0.6 },
  journeyTitle: { color: "#163A2A", fontWeight: "800", fontSize: 16 },
  projectCard: { borderWidth: 1, borderColor: "#E6EAF0", borderRadius: 16, padding: 14, gap: 8, backgroundColor: "#FCFCFD" },
  projectTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8 },
  projectTitle: { flex: 1, color: "#101828", fontWeight: "800", fontSize: 16 },
  difficultyBadge: { fontWeight: "800" },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  recommendedPill: { alignSelf: "flex-start", backgroundColor: "#EEF2FF", color: "#4457FF", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, fontWeight: "800", fontSize: 12 },
  stagePill: { alignSelf: "flex-start", backgroundColor: "#FFF7ED", color: "#B54708", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, fontWeight: "800", fontSize: 12 },
  whyText: { color: "#344054", fontWeight: "600", lineHeight: 20 },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tagPill: { alignSelf: "flex-start", backgroundColor: "#F2F4F7", color: "#475467", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, fontWeight: "700", fontSize: 12 },
  buildBox: { backgroundColor: "#F8FAFC", borderRadius: 14, padding: 12, gap: 8, borderWidth: 1, borderColor: "#E4E7EC" },
  buildHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  buildTitle: { color: "#1E2B24", fontWeight: "800" },
  buildProgress: { color: "#1F7A4C", fontWeight: "800" },
  progressTrack: { height: 10, borderRadius: 999, backgroundColor: "#E8EEF3", overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 999, backgroundColor: "#1F7A4C" },
  taskRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 2 },
  taskText: { color: "#344054", flex: 1 },
  taskTextDone: { color: "#667085", textDecorationLine: "line-through" },
  completeText: { color: "#1F7A4C", fontWeight: "800" },
  meta: { color: "#667085", lineHeight: 20 },
  error: { color: "#B42318" },
  primaryBtn: { alignSelf: "flex-start", backgroundColor: "#1F7A4C", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11 },
  primaryBtnText: { color: "#fff", fontWeight: "800" },
  secondaryBtn: { alignSelf: "flex-start", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, backgroundColor: "#FFF3D9" },
  secondaryBtnText: { color: "#B54708", fontWeight: "800" }
});

