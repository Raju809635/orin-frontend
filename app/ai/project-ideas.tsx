import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const AI_GOLD = "#D4A017";
const AI_GOLD_SOFT = "#FFF4CC";
const AI_TEAL = "#0F766E";
import { api } from "@/lib/api";
import { getAppErrorMessage, handleAppError } from "@/lib/appError";
import { getDomainTree, type DomainTreeResponse } from "@/lib/domainTree";
import { useAppTheme } from "@/context/ThemeContext";
import { notify } from "@/utils/notify";
import { saveAiItem } from "@/utils/aiSaves";
import { pickAndUploadPostImage } from "@/utils/postMediaUpload";

type ProjectTask = {
  id: string;
  title: string;
  done: boolean;
};

type ProjectIdea = {
  title: string;
  projectKey: string;
  level?: string;
  tags?: string[];
  recommended?: boolean;
  why?: string;
  stage?: string;
  tasks: ProjectTask[];
  status?: "not_started" | "active" | "completed";
  proofRequired?: boolean;
  proofSubmitted?: boolean;
  proofNote?: string;
  proofLink?: string;
  proofImageUrl?: string;
  progressPercent?: number;
  completedTasks?: number;
  totalTasks?: number;
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

type ProofDraft = {
  note: string;
  link: string;
  imageUrl: string;
  uploading: boolean;
  submitting: boolean;
};

const LEVEL_OPTIONS = ["Beginner", "Intermediate", "Advanced"];

function buildProjectKey(title: string) {
  return String(title || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function buildFallbackTasks(title: string): ProjectTask[] {
  const taskBase = buildProjectKey(title) || "project";
  return [
    { id: `${taskBase}-problem`, title: "Define the problem + target user", done: false },
    { id: `${taskBase}-plan`, title: "Sketch the flow + feature list", done: false },
    { id: `${taskBase}-build`, title: "Build the core MVP", done: false },
    { id: `${taskBase}-test`, title: "Test and improve the result", done: false },
    { id: `${taskBase}-share`, title: "Share a demo or proof link", done: false }
  ];
}

function normalizeProjectIdea(idea: ProjectIdea): ProjectIdea {
  const title = String(idea?.title || "Project Idea").trim() || "Project Idea";
  const tasks = Array.isArray(idea?.tasks) && idea.tasks.length ? idea.tasks : buildFallbackTasks(title);
  const completedTasks = typeof idea?.completedTasks === "number" ? idea.completedTasks : tasks.filter((task) => task.done).length;
  const totalTasks = typeof idea?.totalTasks === "number" && idea.totalTasks > 0 ? idea.totalTasks : tasks.length;

  return {
    ...idea,
    title,
    projectKey: String(idea?.projectKey || "").trim() || buildProjectKey(title),
    tasks,
    completedTasks,
    totalTasks,
    progressPercent:
      typeof idea?.progressPercent === "number"
        ? idea.progressPercent
        : totalTasks
          ? Math.round((completedTasks / totalTasks) * 100)
          : 0,
    status:
      idea?.status ||
      (completedTasks >= totalTasks && totalTasks > 0
        ? "completed"
        : completedTasks > 0
          ? "active"
          : "not_started")
  };
}

export default function AiProjectIdeasPage() {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
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
  const [proofDrafts, setProofDrafts] = useState<Record<string, ProofDraft>>({});

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
        setData(
          res.data
            ? {
                ...res.data,
                ideas: Array.isArray(res.data.ideas) ? res.data.ideas.map(normalizeProjectIdea) : []
              }
            : null
        );
      } catch (e: any) {
        setError(getAppErrorMessage(e, "Something went wrong. Please try again."));
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
    if (!data?.ideas?.length) return;
    setProofDrafts((prev) => {
      const next = { ...prev };
      data.ideas.forEach((idea) => {
        if (next[idea.projectKey]) return;
        next[idea.projectKey] = {
          note: idea.proofNote || "",
          link: idea.proofLink || "",
          imageUrl: idea.proofImageUrl || "",
          uploading: false,
          submitting: false
        };
      });
      return next;
    });
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

  function patchIdea(projectKey: string, nextIdea: Partial<ProjectIdea>) {
    setData((prev) =>
      prev
        ? {
            ...prev,
            ideas: (prev.ideas || []).map((idea) => (idea.projectKey === projectKey ? normalizeProjectIdea({ ...idea, ...nextIdea }) : idea))
          }
        : prev
    );
  }

  async function openProject(idea: ProjectIdea) {
    const nextOpen = activeProject === idea.projectKey ? null : idea.projectKey;
    setActiveProject(nextOpen);
    if (nextOpen && idea.status === "not_started") {
      try {
        const { data: response } = await api.post(`/api/network/project-ideas/${encodeURIComponent(idea.projectKey)}/start`, {
          title: idea.title
        });
        patchIdea(idea.projectKey, response?.project || { status: "active" });
      } catch (e: any) {
        handleAppError(e, { fallbackMessage: "Unable to start this project right now." });
      }
    }
  }

  async function toggleTask(idea: ProjectIdea, taskId: string) {
    try {
      const { data: response } = await api.post(`/api/network/project-ideas/${encodeURIComponent(idea.projectKey)}/task`, {
        title: idea.title,
        taskId
      });
      patchIdea(idea.projectKey, response?.project || {});
      notify("Task updated.");
    } catch (e: any) {
      handleAppError(e, { fallbackMessage: "Unable to update this task right now." });
    }
  }

  async function uploadProofImage(idea: ProjectIdea) {
    try {
      setProofDrafts((prev) => ({
        ...prev,
        [idea.projectKey]: { ...(prev[idea.projectKey] || emptyProofDraft()), uploading: true }
      }));
      const imageUrl = await pickAndUploadPostImage();
      if (!imageUrl) return;
      setProofDrafts((prev) => ({
        ...prev,
        [idea.projectKey]: { ...(prev[idea.projectKey] || emptyProofDraft()), imageUrl, uploading: false }
      }));
      notify("Proof screenshot added.");
    } catch (e: any) {
      setProofDrafts((prev) => ({
        ...prev,
        [idea.projectKey]: { ...(prev[idea.projectKey] || emptyProofDraft()), uploading: false }
      }));
      handleAppError(e, { fallbackMessage: "Unable to upload proof screenshot right now." });
    }
  }

  async function submitProof(idea: ProjectIdea) {
    const draft = proofDrafts[idea.projectKey] || emptyProofDraft();
    try {
      setProofDrafts((prev) => ({
        ...prev,
        [idea.projectKey]: { ...draft, submitting: true }
      }));
      const { data: response } = await api.post(`/api/network/project-ideas/${encodeURIComponent(idea.projectKey)}/submit-proof`, {
        title: idea.title,
        proofNote: draft.note,
        proofLink: draft.link,
        proofImageUrl: draft.imageUrl
      });
      patchIdea(idea.projectKey, response?.project || { status: "completed", proofSubmitted: true });
      notify("Project proof submitted. Great work.");
    } catch (e: any) {
      handleAppError(e, { fallbackMessage: "Unable to submit project proof right now." });
    } finally {
      setProofDrafts((prev) => ({
        ...prev,
        [idea.projectKey]: { ...(prev[idea.projectKey] || draft), submitting: false }
      }));
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 12 : 0}
    >
      <ScrollView
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={[styles.page, { backgroundColor: colors.background, paddingBottom: Math.max(insets.bottom, 20) + 32 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
        keyboardShouldPersistTaps="handled"
      >
      <LinearGradient colors={["#7C5A00", "#D4A017", "#F2C94C"]} style={styles.hero}>
        <Text style={styles.heroTitle}>Build Mode</Text>
        <Text style={styles.heroSub}>Choose a project, execute it, and submit real proof before ORIN marks it complete.</Text>
      </LinearGradient>

      <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Generate Ideas</Text>
        <Text style={[styles.label, { color: colors.text }]}>Domain</Text>
        <View style={styles.chips}>
          {(domainTree?.primaryCategories || []).map((item) => (
            <TouchableOpacity key={item} style={[styles.chip, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }, primaryCategory === item && [styles.chipActive, { backgroundColor: AI_GOLD_SOFT, borderColor: AI_GOLD }]]} onPress={() => setPrimaryCategory(item)}>
              <Text style={[styles.chipText, { color: colors.textMuted }, primaryCategory === item && [styles.chipTextActive, { color: AI_GOLD }]]}>{item}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[styles.label, { color: colors.text }]}>Sub-domain</Text>
        <View style={styles.chips}>
          {(domainTree?.subCategoriesByPrimary?.[primaryCategory] || []).map((item) => (
            <TouchableOpacity key={item} style={[styles.chip, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }, subCategory === item && [styles.chipActive, { backgroundColor: AI_GOLD_SOFT, borderColor: AI_GOLD }]]} onPress={() => setSubCategory(item)}>
              <Text style={[styles.chipText, { color: colors.textMuted }, subCategory === item && [styles.chipTextActive, { color: AI_GOLD }]]}>{item}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[styles.label, { color: colors.text }]}>Focus</Text>
        <View style={styles.chips}>
          {(domainTree?.focusByPrimarySub?.[`${primaryCategory}::${subCategory}`] || []).map((item) => (
            <TouchableOpacity key={item} style={[styles.chip, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }, focus === item && [styles.chipActive, { backgroundColor: AI_GOLD_SOFT, borderColor: AI_GOLD }]]} onPress={() => setFocus(item)}>
              <Text style={[styles.chipText, { color: colors.textMuted }, focus === item && [styles.chipTextActive, { color: AI_GOLD }]]}>{item}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[styles.label, { color: colors.text }]}>Custom Goal</Text>
        <TextInput style={[styles.input, { backgroundColor: colors.surfaceAlt, borderColor: colors.border, color: colors.text }]} value={customGoal} onChangeText={setCustomGoal} placeholder="Example: AI Chatbot, UPSC Revision App, Legal Draft Helper" placeholderTextColor={colors.textMuted} />

        <Text style={[styles.label, { color: colors.text }]}>Skill Level</Text>
        <View style={styles.chips}>
          {LEVEL_OPTIONS.map((item) => (
            <TouchableOpacity key={item} style={[styles.chip, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }, level === item && [styles.chipActive, { backgroundColor: AI_GOLD_SOFT, borderColor: AI_GOLD }]]} onPress={() => setLevel(item)}>
              <Text style={[styles.chipText, { color: colors.textMuted }, level === item && [styles.chipTextActive, { color: AI_GOLD }]]}>{item}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: AI_GOLD }]} onPress={() => load(true)}>
          <Text style={styles.primaryBtnText}>Generate Ideas</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Project Ideas</Text>
        {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
        {loading ? <ActivityIndicator size="large" color={AI_GOLD} /> : null}
        {!loading && !data ? <Text style={[styles.meta, { color: colors.textMuted }]}>No ideas available yet.</Text> : null}
        {data?.journey ? (
          <View style={styles.journeyCard}>
            <Text style={styles.journeyLabel}>Personalized Build Track</Text>
            <Text style={styles.journeyTitle}>{data.journey.personalizationReason || `Built for ${data.goal}`}</Text>
            <Text style={styles.meta}>{data.journey.currentStep ? `Current step: ${data.journey.currentStep}` : `Focus: ${data.journey.focusLabel || data.goal}`}</Text>
            <Text style={styles.meta}>Readiness: {Math.max(0, Math.round(Number(data.journey.readinessScore || 0)))}%</Text>
          </View>
        ) : null}

        {(data?.ideas || []).slice(0, 8).map((rawIdea, index) => {
          const idea = normalizeProjectIdea(rawIdea);
          const completed = idea.completedTasks ?? idea.tasks.filter((task) => task.done).length;
          const progress = idea.progressPercent ?? (idea.totalTasks ? Math.round((completed / idea.totalTasks) * 100) : 0);
          const isOpen = activeProject === idea.projectKey;
          const allTasksDone = idea.tasks.every((task) => task.done);
          const proofDraft = proofDrafts[idea.projectKey] || emptyProofDraft();

          return (
            <View key={`${idea.projectKey}-${index}`} style={styles.projectCard}>
              <View style={styles.projectTop}>
                <Text style={styles.projectTitle}>{idea.title}</Text>
                <Text style={[styles.difficultyBadge, { color: difficultyColor }]}>{difficulty}</Text>
              </View>
              <View style={styles.metaRow}>
                {idea.recommended ? <Text style={styles.recommendedPill}>Recommended</Text> : null}
                {idea.stage ? <Text style={styles.stagePill}>{idea.stage}</Text> : null}
                {idea.proofSubmitted ? <Text style={styles.successPill}>Proof Submitted</Text> : null}
              </View>
              <Text style={styles.meta}>Learn: {suggestedStack}</Text>
              {idea.why ? <Text style={styles.whyText}>{idea.why}</Text> : null}
              <Text style={styles.meta}>People building: {18 + index * 3}</Text>
              {!!idea.tags?.length ? (
                <View style={styles.tagRow}>
                  {idea.tags.map((tag) => (
                    <Text key={`${idea.projectKey}-${tag}`} style={styles.tagPill}>
                      {tag}
                    </Text>
                  ))}
                </View>
              ) : null}

              <TouchableOpacity style={styles.secondaryBtn} onPress={() => openProject(idea)}>
                <Text style={styles.secondaryBtnText}>{isOpen ? "Hide Build Plan" : idea.status === "not_started" ? "Start Project" : "Continue Project"}</Text>
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

                  {idea.tasks.map((task) => (
                    <TouchableOpacity key={task.id} style={styles.taskRow} onPress={() => toggleTask(idea, task.id)}>
                      <Ionicons name={task.done ? "checkmark-circle" : "ellipse-outline"} size={20} color={task.done ? "#1F7A4C" : "#98A2B3"} />
                      <Text style={[styles.taskText, task.done && styles.taskTextDone]}>{task.title}</Text>
                    </TouchableOpacity>
                  ))}

                  <View style={styles.proofBox}>
                    <Text style={styles.buildTitle}>Project Proof</Text>
                    <Text style={styles.meta}>Submit screenshots, a demo link, or a short note before ORIN marks this project complete.</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="What did you build?"
                      value={proofDraft.note}
                      onChangeText={(text) => setProofDrafts((prev) => ({ ...prev, [idea.projectKey]: { ...proofDraft, note: text } }))}
                    />
                    <TextInput
                      style={styles.input}
                      placeholder="Demo / GitHub / deployed link"
                      autoCapitalize="none"
                      value={proofDraft.link}
                      onChangeText={(text) => setProofDrafts((prev) => ({ ...prev, [idea.projectKey]: { ...proofDraft, link: text } }))}
                    />
                    <TouchableOpacity style={styles.uploadBtn} onPress={() => uploadProofImage(idea)} disabled={proofDraft.uploading}>
                      <Text style={styles.uploadBtnText}>{proofDraft.uploading ? "Uploading..." : proofDraft.imageUrl ? "Change Proof Screenshot" : "Upload Proof Screenshot"}</Text>
                    </TouchableOpacity>
                    {proofDraft.imageUrl ? <Image source={{ uri: proofDraft.imageUrl }} style={styles.proofImage} /> : null}
                    <TouchableOpacity style={[styles.primaryBtn, !allTasksDone && styles.disabledBtn]} onPress={() => submitProof(idea)} disabled={!allTasksDone || proofDraft.submitting}>
                      <Text style={styles.primaryBtnText}>{proofDraft.submitting ? "Submitting..." : "Submit Project Proof"}</Text>
                    </TouchableOpacity>
                    {!allTasksDone ? <Text style={styles.meta}>Complete every task first, then submit proof.</Text> : null}
                    {idea.status === "completed" ? <Text style={styles.completeText}>Project completed with proof. This now strengthens opportunities and recommendations.</Text> : null}
                  </View>
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
                ideas: data.ideas || []
              }
            });
            notify("Saved to Saved AI.");
          }}
        >
          <Text style={styles.primaryBtnText}>Save Build Mode</Text>
        </TouchableOpacity>
      </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function emptyProofDraft(): ProofDraft {
  return {
    note: "",
    link: "",
    imageUrl: "",
    uploading: false,
    submitting: false
  };
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
  successPill: { alignSelf: "flex-start", backgroundColor: "#ECFDF3", color: "#027A48", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, fontWeight: "800", fontSize: 12 },
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
  proofBox: { marginTop: 6, gap: 8, borderTopWidth: 1, borderTopColor: "#E4E7EC", paddingTop: 10 },
  uploadBtn: {
    borderWidth: 1,
    borderColor: "#175CD3",
    backgroundColor: "#EFF8FF",
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center"
  },
  uploadBtnText: { color: "#175CD3", fontWeight: "800" },
  proofImage: { width: "100%", height: 160, borderRadius: 12, borderWidth: 1, borderColor: "#D0D5DD" },
  completeText: { color: "#1F7A4C", fontWeight: "800" },
  meta: { color: "#667085", lineHeight: 20 },
  error: { color: "#B42318" },
  primaryBtn: { alignSelf: "flex-start", backgroundColor: "#1F7A4C", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11 },
  primaryBtnText: { color: "#fff", fontWeight: "800" },
  secondaryBtn: { alignSelf: "flex-start", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, backgroundColor: "#FFF3D9" },
  secondaryBtnText: { color: "#B54708", fontWeight: "800" },
  disabledBtn: { opacity: 0.55 }
});
