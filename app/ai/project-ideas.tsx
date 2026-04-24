import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Image, KeyboardAvoidingView, Modal, Platform, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/lib/api";
import { getAppErrorMessage, handleAppError } from "@/lib/appError";
import { getDomainTree, type DomainTreeResponse } from "@/lib/domainTree";
import { useAppTheme } from "@/context/ThemeContext";
import { notify } from "@/utils/notify";
import { saveAiItem } from "@/utils/aiSaves";
import { pickAndUploadPostImage } from "@/utils/postMediaUpload";

const AI_GOLD = "#D4A017";
const AI_GOLD_SOFT = "#FFF4CC";
const AI_TEAL = "#0F766E";
const AI_ROADMAP_SOFT = "#F1FBF5";

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
  roadmapIdeas?: ProjectIdea[];
  domainIdeas?: ProjectIdea[];
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
type ProjectIdeasMode = "roadmap" | "domain";
type ProjectIdeasDrawerSection = "roadmap" | "domain" | "completed" | "recent";

function getProjectDrawerTone(section: ProjectIdeasDrawerSection, isDark: boolean) {
  if (section === "domain") {
    return {
      accent: AI_GOLD,
      background: isDark ? "rgba(212,160,23,0.18)" : AI_GOLD_SOFT
    };
  }

  if (section === "completed") {
    return {
      accent: "#1F7A4C",
      background: isDark ? "rgba(31,122,76,0.18)" : "#ECFDF3"
    };
  }

  if (section === "recent") {
    return {
      accent: "#0F766E",
      background: isDark ? "rgba(15,118,110,0.18)" : "#E6F5F2"
    };
  }

  return {
    accent: AI_TEAL,
    background: isDark ? "rgba(15,118,110,0.18)" : AI_ROADMAP_SOFT
  };
}

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
  const { colors, isDark } = useAppTheme();
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
  const [activeMode, setActiveMode] = useState<ProjectIdeasMode>("roadmap");
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [drawerSection, setDrawerSection] = useState<ProjectIdeasDrawerSection>("roadmap");
  const [recentProjectKeys, setRecentProjectKeys] = useState<string[]>([]);

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
                ideas: Array.isArray(res.data.ideas) ? res.data.ideas.map(normalizeProjectIdea) : [],
                roadmapIdeas: Array.isArray(res.data.roadmapIdeas) ? res.data.roadmapIdeas.map(normalizeProjectIdea) : [],
                domainIdeas: Array.isArray(res.data.domainIdeas) ? res.data.domainIdeas.map(normalizeProjectIdea) : []
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
    const allIdeas = [...(data?.roadmapIdeas || []), ...(data?.domainIdeas || []), ...(data?.ideas || [])];
    if (!allIdeas.length) return;
    setProofDrafts((prev) => {
      const next = { ...prev };
      allIdeas.forEach((idea) => {
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

  useEffect(() => {
    if (!data) return;
    const hasRoadmapIdeas = Boolean((data.roadmapIdeas?.length || data.ideas?.length) && data.journey?.currentStep);
    if (!hasRoadmapIdeas && activeMode === "roadmap") {
      setActiveMode("domain");
      setDrawerSection((prev) => (prev === "roadmap" ? "domain" : prev));
    }
  }, [activeMode, data]);

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
  const activeDrawerTone = useMemo(() => getProjectDrawerTone(drawerSection, isDark), [drawerSection, isDark]);

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

  const roadmapIdeas = useMemo(
    () => (data?.roadmapIdeas?.length ? data.roadmapIdeas : data?.ideas || []).slice(0, 8),
    [data]
  );
  const domainIdeas = useMemo(
    () => (data?.domainIdeas?.length ? data.domainIdeas : data?.ideas || []).slice(0, 8),
    [data]
  );
  const allIdeas = useMemo(() => {
    const merged = [...roadmapIdeas, ...domainIdeas];
    const seen = new Set<string>();
    return merged.filter((idea) => {
      if (seen.has(idea.projectKey)) return false;
      seen.add(idea.projectKey);
      return true;
    });
  }, [domainIdeas, roadmapIdeas]);
  const completedIdeas = useMemo(
    () => allIdeas.filter((idea) => idea.status === "completed" || idea.proofSubmitted),
    [allIdeas]
  );
  const recentIdeas = useMemo(
    () =>
      recentProjectKeys
        .map((key) => allIdeas.find((idea) => idea.projectKey === key))
        .filter(Boolean) as ProjectIdea[],
    [allIdeas, recentProjectKeys]
  );
  const visibleIdeas = useMemo(() => {
    if (drawerSection === "completed") return completedIdeas;
    if (drawerSection === "recent") return recentIdeas;
    if (drawerSection === "domain") return domainIdeas;
    return roadmapIdeas;
  }, [completedIdeas, domainIdeas, drawerSection, recentIdeas, roadmapIdeas]);

  const activeSectionTitle = useMemo(() => {
    if (drawerSection === "completed") return "Completed Projects";
    if (drawerSection === "recent") return "Recent Project Activity";
    if (drawerSection === "domain") return "Projects For Your Selected Domain";
    return "Projects For Your Current Roadmap Step";
  }, [drawerSection]);

  const activeSectionEmptyState = useMemo(() => {
    if (drawerSection === "completed") {
      return {
        title: "No completed projects yet",
        body: "Finish every task and submit proof to move your builds into the completed section."
      };
    }
    if (drawerSection === "recent") {
      return {
        title: "No recent project activity",
        body: "Open any project plan and it will start appearing here for quick return access."
      };
    }
    if (drawerSection === "domain") {
      return {
        title: "No domain ideas yet",
        body: "Adjust your domain filters or generate a fresh set of domain-based projects."
      };
    }
    return {
      title: "No roadmap projects yet",
      body: "Refresh your roadmap ideas to get project suggestions based on your current step."
    };
  }, [drawerSection]);

  function patchIdea(projectKey: string, nextIdea: Partial<ProjectIdea>) {
    const patchList = (ideas: ProjectIdea[] = []) =>
      ideas.map((idea) => (idea.projectKey === projectKey ? normalizeProjectIdea({ ...idea, ...nextIdea }) : idea));

    setData((prev) =>
      prev
        ? {
            ...prev,
            ideas: patchList(prev.ideas || []),
            roadmapIdeas: patchList(prev.roadmapIdeas || []),
            domainIdeas: patchList(prev.domainIdeas || [])
          }
        : prev
    );
  }

  async function openProject(idea: ProjectIdea) {
    const nextOpen = activeProject === idea.projectKey ? null : idea.projectKey;
    setActiveProject(nextOpen);
    if (nextOpen) {
      setRecentProjectKeys((prev) => [idea.projectKey, ...prev.filter((key) => key !== idea.projectKey)].slice(0, 12));
    }
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

  const drawerItems = (
    <View
      style={[
        styles.drawerPanel,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          paddingTop: Math.max(insets.top, 18),
          paddingBottom: Math.max(insets.bottom, 18)
        }
      ]}
    >
      <View style={styles.drawerHeader}>
        <View>
          <Text style={[styles.drawerTitle, { color: colors.text }]}>Project Ideas</Text>
          <Text style={[styles.drawerSub, { color: colors.textMuted }]}>Modes, history, and completed builds</Text>
        </View>
        <TouchableOpacity style={[styles.drawerCloseBtn, { borderColor: colors.border }]} onPress={() => setDrawerVisible(false)}>
          <Ionicons name="close" size={18} color={colors.text} />
        </TouchableOpacity>
      </View>

      <View style={styles.drawerSection}>
        <Text style={[styles.drawerSectionTitle, { color: colors.textMuted }]}>Browse</Text>
        {([
          { key: "roadmap", label: "Roadmap Based", meta: data?.journey?.currentStep ? `Current step: ${data.journey.currentStep}` : "Best next builds from your roadmap" },
          { key: "domain", label: "Domain Based", meta: "Explore builds by selected domain and focus" },
          { key: "completed", label: "Completed", meta: completedIdeas.length ? `${completedIdeas.length} project${completedIdeas.length === 1 ? "" : "s"} completed` : "Completed projects will appear here" },
          { key: "recent", label: "Recent", meta: recentIdeas.length ? `${recentIdeas.length} recent project${recentIdeas.length === 1 ? "" : "s"}` : "Open projects to build history here" }
        ] as { key: ProjectIdeasDrawerSection; label: string; meta: string }[]).map((item) => {
          const active = drawerSection === item.key;
          return (
            <TouchableOpacity
              key={item.key}
              style={[
                styles.drawerModeRow,
                { borderColor: colors.border, backgroundColor: colors.surfaceAlt },
                active && { backgroundColor: getProjectDrawerTone(item.key, isDark).background, borderColor: getProjectDrawerTone(item.key, isDark).accent }
              ]}
              onPress={() => {
                setDrawerSection(item.key);
                if (item.key === "roadmap" || item.key === "domain") {
                  setActiveMode(item.key);
                }
                setDrawerVisible(false);
              }}
            >
              <Ionicons
                name={item.key === "completed" ? "checkmark-done-circle-outline" : item.key === "recent" ? "time-outline" : item.key === "domain" ? "globe-outline" : "map-outline"}
                size={16}
                color={active ? (item.key === "domain" ? AI_GOLD : AI_TEAL) : colors.textMuted}
              />
              <View style={{ flex: 1 }}>
                <Text style={[styles.drawerModeTitle, { color: colors.text }]}>{item.label}</Text>
                <Text style={[styles.drawerModeMeta, { color: colors.textMuted }]}>{item.meta}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {drawerSection === "domain" ? (
        <View style={styles.drawerSection}>
          <Text style={[styles.drawerSectionTitle, { color: colors.textMuted }]}>Domain filters</Text>
          <View style={styles.chips}>
            {(domainTree?.primaryCategories || []).map((item) => (
              <TouchableOpacity
                key={item}
                style={[styles.chip, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }, primaryCategory === item && [styles.chipActive, { backgroundColor: isDark ? "rgba(212,160,23,0.18)" : AI_GOLD_SOFT, borderColor: AI_GOLD }]]}
                onPress={() => setPrimaryCategory(item)}
              >
                <Text style={[styles.chipText, { color: colors.textMuted }, primaryCategory === item && [styles.chipTextActive, { color: AI_GOLD }]]}>{item}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput
            style={[styles.input, { backgroundColor: colors.surfaceAlt, borderColor: colors.border, color: colors.text }]}
            value={customGoal}
            onChangeText={setCustomGoal}
            placeholder="Optional custom goal"
            placeholderTextColor={colors.textMuted}
          />
        </View>
      ) : null}

      <View style={[styles.drawerSection, styles.drawerHistorySection]}>
        <Text style={[styles.drawerSectionTitle, { color: colors.textMuted }]}>
          {drawerSection === "completed" ? "Completed builds" : drawerSection === "recent" ? "Recent builds" : "Quick picks"}
        </Text>
        <ScrollView showsVerticalScrollIndicator={false}>
          {visibleIdeas.length ? (
            visibleIdeas.map((idea) => (
              <TouchableOpacity
                key={idea.projectKey}
                style={[
                  styles.historyRow,
                  { borderColor: colors.border, backgroundColor: colors.surfaceAlt },
                  activeProject === idea.projectKey && {
                    borderColor: activeDrawerTone.accent,
                    backgroundColor: activeDrawerTone.background
                  }
                ]}
                onPress={() => {
                  setActiveProject(idea.projectKey);
                  setDrawerVisible(false);
                  setRecentProjectKeys((prev) => [idea.projectKey, ...prev.filter((key) => key !== idea.projectKey)].slice(0, 12));
                }}
              >
                <Text style={[styles.historyTitle, { color: colors.text }]} numberOfLines={1}>{idea.title}</Text>
                <Text style={[styles.historyPreview, { color: colors.textMuted }]} numberOfLines={2}>
                  {idea.why || idea.stage || "Build plan available"}
                </Text>
                <Text style={[styles.historyMeta, { color: colors.textMuted }]}>
                  {idea.status === "completed" ? "Completed" : `${idea.completedTasks || 0}/${idea.totalTasks || idea.tasks.length} tasks done`}
                </Text>
              </TouchableOpacity>
            ))
          ) : (
            <View style={[styles.drawerEmptyCard, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}>
              <Text style={[styles.drawerEmptyTitle, { color: colors.text }]}>{activeSectionEmptyState.title}</Text>
              <Text style={[styles.drawerEmptyText, { color: colors.textMuted }]}>{activeSectionEmptyState.body}</Text>
            </View>
          )}
        </ScrollView>
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 12 : 0}
    >
      <View style={[styles.headerBar, { backgroundColor: colors.background, borderBottomColor: colors.border, paddingTop: Math.max(insets.top, 12) }]}>
        <TouchableOpacity style={[styles.headerIconBtn, { borderColor: colors.border, backgroundColor: colors.surface }]} onPress={() => setDrawerVisible(true)}>
          <Ionicons name="menu" size={18} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>{activeSectionTitle}</Text>
          <Text style={[styles.headerSub, { color: colors.textMuted }]} numberOfLines={1}>
            {drawerSection === "roadmap" ? "Roadmap-guided build path" : drawerSection === "domain" ? "Domain exploration mode" : drawerSection === "completed" ? "Your finished builds" : "Recently opened builds"}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.headerIconBtn, { borderColor: colors.border, backgroundColor: colors.surface }]}
          onPress={() => load(true)}
        >
          <Ionicons name="refresh-outline" size={18} color={colors.text} />
        </TouchableOpacity>
      </View>

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

      {drawerSection === "domain" ? (
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Domain Setup</Text>
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
              <TouchableOpacity key={item} style={[styles.chip, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }, subCategory === item && [styles.chipActive, { backgroundColor: isDark ? "rgba(212,160,23,0.18)" : AI_GOLD_SOFT, borderColor: AI_GOLD }]]} onPress={() => setSubCategory(item)}>
                <Text style={[styles.chipText, { color: colors.textMuted }, subCategory === item && [styles.chipTextActive, { color: AI_GOLD }]]}>{item}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.label, { color: colors.text }]}>Focus</Text>
          <View style={styles.chips}>
            {(domainTree?.focusByPrimarySub?.[`${primaryCategory}::${subCategory}`] || []).map((item) => (
              <TouchableOpacity key={item} style={[styles.chip, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }, focus === item && [styles.chipActive, { backgroundColor: isDark ? "rgba(212,160,23,0.18)" : AI_GOLD_SOFT, borderColor: AI_GOLD }]]} onPress={() => setFocus(item)}>
                <Text style={[styles.chipText, { color: colors.textMuted }, focus === item && [styles.chipTextActive, { color: AI_GOLD }]]}>{item}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.label, { color: colors.text }]}>Custom Goal</Text>
          <TextInput style={[styles.input, { backgroundColor: colors.surfaceAlt, borderColor: colors.border, color: colors.text }]} value={customGoal} onChangeText={setCustomGoal} placeholder="Example: AI Chatbot, UPSC Revision App, Legal Draft Helper" placeholderTextColor={colors.textMuted} />
        </View>
      ) : drawerSection === "roadmap" ? (
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.journeyCard, { borderColor: isDark ? "rgba(15,118,110,0.32)" : "#D9F2E4", backgroundColor: isDark ? "rgba(15,118,110,0.14)" : AI_ROADMAP_SOFT }]}>
            <Text style={[styles.journeyLabel, { color: AI_TEAL }]}>Roadmap Guided</Text>
            <Text style={[styles.journeyTitle, { color: colors.text }]}>Projects based on your current roadmap step</Text>
            <Text style={[styles.meta, { color: colors.textMuted }]}>Domain selection is hidden here so ORIN can focus on your next realistic step.</Text>
          </View>
        </View>
      ) : null}

      {(drawerSection === "roadmap" || drawerSection === "domain") ? (
      <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.label, { color: colors.text }]}>Skill Level</Text>
        <View style={styles.chips}>
          {LEVEL_OPTIONS.map((item) => (
            <TouchableOpacity key={item} style={[styles.chip, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }, level === item && [styles.chipActive, { backgroundColor: isDark ? "rgba(212,160,23,0.18)" : AI_GOLD_SOFT, borderColor: AI_GOLD }]]} onPress={() => setLevel(item)}>
              <Text style={[styles.chipText, { color: colors.textMuted }, level === item && [styles.chipTextActive, { color: AI_GOLD }]]}>{item}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: AI_GOLD }]} onPress={() => load(true)}>
          <Text style={styles.primaryBtnText}>{activeMode === "roadmap" ? "Refresh Roadmap Ideas" : "Generate Domain Ideas"}</Text>
        </TouchableOpacity>
      </View>) : null}

      <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>{activeSectionTitle}</Text>
        {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
        {loading ? <ActivityIndicator size="large" color={AI_GOLD} /> : null}
        {!loading && !data ? <Text style={[styles.meta, { color: colors.textMuted }]}>No ideas available yet.</Text> : null}
        {drawerSection === "roadmap" && data?.journey ? (
          <View style={[styles.journeyCard, { borderColor: isDark ? "rgba(15,118,110,0.32)" : "#D9F2E4", backgroundColor: isDark ? "rgba(15,118,110,0.14)" : AI_ROADMAP_SOFT }]}>
            <Text style={[styles.journeyLabel, { color: AI_TEAL }]}>Personalized Build Track</Text>
            <Text style={[styles.journeyTitle, { color: colors.text }]}>{data.journey.personalizationReason || `Built for ${data.goal}`}</Text>
            <Text style={[styles.meta, { color: colors.textMuted }]}>{data.journey.currentStep ? `Current step: ${data.journey.currentStep}` : `Focus: ${data.journey.focusLabel || data.goal}`}</Text>
            <Text style={[styles.meta, { color: colors.textMuted }]}>Readiness: {Math.max(0, Math.round(Number(data.journey.readinessScore || 0)))}%</Text>
          </View>
        ) : null}

        {!loading && data && !visibleIdeas.length ? (
          <View style={[styles.emptyStateCard, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}>
            <Ionicons
              name={drawerSection === "completed" ? "checkmark-done-circle-outline" : drawerSection === "recent" ? "time-outline" : drawerSection === "domain" ? "globe-outline" : "map-outline"}
              size={22}
              color={activeDrawerTone.accent}
            />
            <Text style={[styles.emptyStateTitle, { color: colors.text }]}>{activeSectionEmptyState.title}</Text>
            <Text style={[styles.emptyStateText, { color: colors.textMuted }]}>{activeSectionEmptyState.body}</Text>
          </View>
        ) : null}

        {visibleIdeas.map((rawIdea, index) => {
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

      <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={styles.sectionTitle}>Actions</Text>
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={async () => {
            if (!data || !visibleIdeas.length) {
              notify("Generate ideas first.");
              return;
            }
            await saveAiItem({
              type: "project_ideas",
              title:
                activeMode === "roadmap"
                  ? `Project Ideas: ${data.journey?.currentStep || data.goal || "Roadmap"}`
                  : `Project Ideas: ${primaryCategory}${subCategory ? ` > ${subCategory}` : ""}`,
              payload: {
                mode: activeMode,
                primaryCategory,
                subCategory,
                focus,
                level,
                difficulty,
                suggestedStack,
                ideas: visibleIdeas
              }
            });
            notify("Saved to Saved AI.");
          }}
        >
          <Text style={styles.primaryBtnText}>Save Build Mode</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={drawerVisible} transparent animationType="slide" onRequestClose={() => setDrawerVisible(false)}>
        <View style={styles.drawerOverlay}>
          <TouchableOpacity style={styles.drawerBackdrop} activeOpacity={1} onPress={() => setDrawerVisible(false)} />
          {drawerItems}
        </View>
      </Modal>
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
  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1
  },
  headerIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  headerCenter: { flex: 1, gap: 2 },
  headerTitle: { fontSize: 18, fontWeight: "800" },
  headerSub: { fontSize: 12, fontWeight: "600" },
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
  modeGrid: { gap: 10 },
  modeCard: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 6 },
  modeCardActive: { shadowColor: "#101828", shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  modeTitle: { fontWeight: "800", fontSize: 15 },
  modeMeta: { lineHeight: 20 },
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
  disabledBtn: { opacity: 0.55 },
  drawerOverlay: { flex: 1, flexDirection: "row", backgroundColor: "rgba(15, 23, 42, 0.28)" },
  drawerBackdrop: { flex: 1 },
  drawerPanel: {
    width: "84%",
    maxWidth: 360,
    borderRightWidth: 1,
    paddingHorizontal: 16,
    gap: 14
  },
  drawerHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  drawerTitle: { fontSize: 20, fontWeight: "800" },
  drawerSub: { fontSize: 12, fontWeight: "600" },
  drawerCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  drawerSection: { gap: 10 },
  drawerHistorySection: { flex: 1 },
  drawerSectionTitle: { fontSize: 12, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5 },
  drawerModeRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12
  },
  drawerModeTitle: { fontSize: 14, fontWeight: "800" },
  drawerModeMeta: { marginTop: 2, fontSize: 12, lineHeight: 18 },
  drawerEmptyCard: { borderWidth: 1, borderRadius: 14, padding: 12, gap: 6 },
  drawerEmptyTitle: { fontSize: 14, fontWeight: "800" },
  historyRow: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    gap: 4,
    marginBottom: 10
  },
  historyTitle: { fontSize: 14, fontWeight: "800" },
  historyPreview: { fontSize: 12, lineHeight: 18 },
  historyMeta: { fontSize: 11, fontWeight: "600" },
  drawerEmptyText: { fontSize: 13, lineHeight: 20 },
  emptyStateCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 8,
    alignItems: "flex-start"
  },
  emptyStateTitle: { fontSize: 16, fontWeight: "800" },
  emptyStateText: { fontSize: 13, lineHeight: 20 }
});
