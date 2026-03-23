import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { api } from "@/lib/api";
import { getDomainTree, type DomainTreeResponse } from "@/lib/domainTree";
import { notify } from "@/utils/notify";
import { saveAiItem } from "@/utils/aiSaves";

type RoadmapStep = { stepNumber: number; title: string; completed?: boolean };
type CareerRoadmapResponse = { goal: string; steps: RoadmapStep[] };

const GENERATION_STAGES = ["Analyzing goal...", "Building steps...", "Optimizing path..."];
const MISSION_XP = 20;
const STORAGE_PREFIX = "orin:career-roadmap-progress:";

export default function AiCareerRoadmapPage() {
  const [domainTree, setDomainTree] = useState<DomainTreeResponse | null>(null);
  const [primaryCategory, setPrimaryCategory] = useState("");
  const [subCategory, setSubCategory] = useState("");
  const [focus, setFocus] = useState("");
  const [customGoal, setCustomGoal] = useState("");
  const [data, setData] = useState<CareerRoadmapResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStage, setGenerationStage] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [activeStepNumber, setActiveStepNumber] = useState<number | null>(null);
  const [claimingCertificate, setClaimingCertificate] = useState(false);
  const initialLoadRef = useRef(false);

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
    () => [primaryCategory, subCategory, focus].filter(Boolean).join(" > "),
    [primaryCategory, subCategory, focus]
  );

  const roadmapKey = useMemo(() => {
    const goal = customGoal.trim() || goalLabel || data?.goal || "career-growth";
    return `${STORAGE_PREFIX}${goal.toLowerCase()}`;
  }, [customGoal, data?.goal, goalLabel]);

  const loadProgress = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(roadmapKey);
      const parsed = raw ? JSON.parse(raw) : null;
      setCompletedSteps(Array.isArray(parsed?.completedSteps) ? parsed.completedSteps : []);
      setActiveStepNumber(Number.isFinite(parsed?.activeStepNumber) ? Number(parsed.activeStepNumber) : null);
    } catch {
      setCompletedSteps([]);
      setActiveStepNumber(null);
    }
  }, [roadmapKey]);

  useEffect(() => {
    if (!data) return;
    loadProgress();
  }, [data, loadProgress]);

  const persistProgress = useCallback(
    async (steps: number[], nextActiveStepNumber: number | null) => {
      setCompletedSteps(steps);
      setActiveStepNumber(nextActiveStepNumber);
      try {
        await AsyncStorage.setItem(
          roadmapKey,
          JSON.stringify({
            completedSteps: steps,
            activeStepNumber: nextActiveStepNumber
          })
        );
      } catch {}
    },
    [roadmapKey]
  );

  const load = useCallback(
    async (refresh = false) => {
      let stageTimer: ReturnType<typeof setInterval> | null = null;
      try {
        if (refresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }
        setError(null);
        setIsGenerating(true);
        setGenerationStage(0);
        stageTimer = setInterval(() => {
          setGenerationStage((prev) => (prev + 1) % GENERATION_STAGES.length);
        }, 700);

        const res = await api.get<CareerRoadmapResponse>("/api/network/career-roadmap", {
          params: {
            primaryCategory,
            subCategory,
            focus,
            goal: customGoal.trim() || goalLabel
          }
        });

        if (stageTimer) clearInterval(stageTimer);
        await new Promise((resolve) => setTimeout(resolve, 900));
        setData(res.data || null);
      } catch (e: any) {
        if (stageTimer) clearInterval(stageTimer);
        setError(e?.response?.data?.message || "Failed to load roadmap.");
      } finally {
        setIsGenerating(false);
        setLoading(false);
        setRefreshing(false);
      }
    },
    [primaryCategory, subCategory, focus, goalLabel, customGoal]
  );

  useEffect(() => {
    if (!primaryCategory || initialLoadRef.current) return;
    initialLoadRef.current = true;
    load();
  }, [primaryCategory, load]);

  useFocusEffect(
    useCallback(() => {
      if (data) loadProgress();
    }, [data, loadProgress])
  );

  const completedCount = completedSteps.length;
  const totalSteps = data?.steps.length || 0;
  const progressPct = totalSteps ? Math.round((completedCount / totalSteps) * 100) : 0;
  const totalXp = completedCount * MISSION_XP;
  const currentMission = data?.steps.find((step) => !completedSteps.includes(step.stepNumber));
  const nextTarget = Math.max(0, 100 - (totalXp % 100 || 0));
  const streakDays = completedCount ? Math.min(completedCount, 14) : 0;
  const currentLevelIndex = Math.min(Math.floor(totalXp / 100), 5);
  const nextLevelIndex = Math.min(currentLevelIndex + 1, 5);
  const levels = ["Starter", "Explorer", "Builder", "Pro", "Elite", "Legend"];
  const socialCount = 12 + totalSteps * 14;

  const startMission = useCallback(
    async (stepNumber: number) => {
      if (!currentMission || currentMission.stepNumber !== stepNumber) {
        notify("Finish your current mission first.");
        return;
      }
      if (completedSteps.includes(stepNumber)) {
        notify("This mission is already completed.");
        return;
      }
      await persistProgress(completedSteps, stepNumber);
      notify("Mission started. Complete it after you finish the work.");
    },
    [completedSteps, currentMission, persistProgress]
  );

  const completeMission = useCallback(
    async (stepNumber: number) => {
      if (activeStepNumber !== stepNumber) {
        notify("Start this mission before completing it.");
        return;
      }
      const next = [...completedSteps, stepNumber].sort((a, b) => a - b);
      await persistProgress(next, null);
      notify(`Mission completed. +${MISSION_XP} XP`);
    },
    [activeStepNumber, completedSteps, persistProgress]
  );

  const futurePreview = useMemo(() => {
    if (!data?.steps?.length) return [];
    const titles = data.steps.slice(-3).map((step) => step.title);
    return titles.map((title, index) => {
      if (index === 0) return `Build projects around ${title}`;
      if (index === 1) return `Gain confidence in ${title}`;
      return `Move closer to internships after ${title}`;
    });
  }, [data]);

  const roadmapCertificateRef = useMemo(() => {
    const raw = customGoal.trim() || goalLabel || data?.goal || "career-growth";
    return raw.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120);
  }, [customGoal, goalLabel, data?.goal]);

  const claimRoadmapCertificate = useCallback(async () => {
    if (!data || progressPct < 100) {
      notify("Complete every mission before claiming a certificate.");
      return;
    }
    try {
      setClaimingCertificate(true);
      const res = await api.post("/api/network/certifications/generate", {
        type: "roadmap",
        title: `${customGoal.trim() || goalLabel || data.goal} Roadmap Completion`,
        domain: focus || subCategory || primaryCategory || "",
        level: levels[currentLevelIndex],
        referenceId: roadmapCertificateRef,
        metadata: {
          domain: focus || subCategory || primaryCategory || "",
          level: levels[currentLevelIndex],
          goal: customGoal.trim() || goalLabel || data.goal,
          totalSteps,
          completedSteps: totalSteps
        }
      });
      notify(res.data?.created ? "Certificate generated and added to your achievements." : "Certificate already exists in your achievements.");
    } catch (e: any) {
      notify(e?.response?.data?.message || "Unable to claim roadmap certificate.");
    } finally {
      setClaimingCertificate(false);
    }
  }, [
    currentLevelIndex,
    customGoal,
    data,
    focus,
    goalLabel,
    levels,
    primaryCategory,
    progressPct,
    roadmapCertificateRef,
    subCategory,
    totalSteps
  ]);

  return (
    <ScrollView
      contentContainerStyle={styles.page}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
    >
      <LinearGradient colors={["#0E6A42", "#1F7A4C", "#5CBF88"]} style={styles.hero}>
        <View style={styles.heroTopRow}>
          <View style={styles.heroBadge}>
            <Ionicons name="sparkles" size={14} color="#0E6A42" />
            <Text style={styles.heroBadgeText}>AI Journey</Text>
          </View>
          <Text style={styles.heroMeta}>{totalXp} XP</Text>
        </View>
        <Text style={styles.heroTitle}>AI Career Roadmap</Text>
        <Text style={styles.heroSub}>
          Build a mission-based journey for your domain and return every day to move one step closer.
        </Text>
        <View style={styles.heroProgressCard}>
          <View style={styles.heroProgressHeader}>
            <Text style={styles.heroProgressLabel}>
              Level {currentLevelIndex + 1} - {levels[currentLevelIndex]}
            </Text>
            <Text style={styles.heroProgressLabel}>{progressPct}% complete</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
          </View>
          <Text style={styles.heroProgressMeta}>Next rank: {nextTarget} XP to {levels[nextLevelIndex]}</Text>
        </View>
      </LinearGradient>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="map" size={16} color="#1F7A4C" />
          <Text style={styles.sectionTitle}>Roadmap Setup</Text>
        </View>
        <Text style={styles.meta}>
          Choose your Domain Guide path and ORIN will build a guided mission plan around it.
        </Text>

        <Text style={styles.label}>Domain (Domain Guide)</Text>
        <View style={styles.chips}>
          {(domainTree?.primaryCategories || []).map((item) => (
            <TouchableOpacity
              key={item}
              style={[styles.chip, primaryCategory === item && styles.chipActive]}
              onPress={() => setPrimaryCategory(item)}
            >
              <Text style={[styles.chipText, primaryCategory === item && styles.chipTextActive]}>{item}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Sub-domain</Text>
        <View style={styles.chips}>
          {(domainTree?.subCategoriesByPrimary?.[primaryCategory] || []).map((item) => (
            <TouchableOpacity
              key={item}
              style={[styles.chip, subCategory === item && styles.chipActive]}
              onPress={() => setSubCategory(item)}
            >
              <Text style={[styles.chipText, subCategory === item && styles.chipTextActive]}>{item}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Focus</Text>
        <View style={styles.chips}>
          {(domainTree?.focusByPrimarySub?.[`${primaryCategory}::${subCategory}`] || []).map((item) => (
            <TouchableOpacity
              key={item}
              style={[styles.chip, focus === item && styles.chipActive]}
              onPress={() => setFocus(item)}
            >
              <Text style={[styles.chipText, focus === item && styles.chipTextActive]}>{item}</Text>
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
        <TouchableOpacity style={styles.primaryBtn} onPress={() => load(true)}>
          <Text style={styles.primaryBtnText}>Generate Journey</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="flash" size={16} color="#1F7A4C" />
          <Text style={styles.sectionTitle}>Today&apos;s Mission</Text>
        </View>
        {currentMission ? (
          <LinearGradient colors={["#FFF9E8", "#FFF2CC"]} style={styles.todayCard}>
            <View style={styles.todayHeader}>
              <Text style={styles.todayTag}>Today's Task</Text>
              <Text style={styles.todayXp}>+{MISSION_XP} XP</Text>
            </View>
            <Text style={styles.todayTitle}>{currentMission.title}</Text>
            <Text style={styles.meta}>Complete 1 more task to move your journey ahead today.</Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={() => startMission(currentMission.stepNumber)} disabled={activeStepNumber === currentMission.stepNumber}>
              <Text style={styles.primaryBtnText}>{activeStepNumber === currentMission.stepNumber ? "Mission In Progress" : "Start Mission"}</Text>
            </TouchableOpacity>
          </LinearGradient>
        ) : (
          <View style={styles.doneCard}>
            <Text style={styles.doneTitle}>Journey completed</Text>
            <Text style={styles.meta}>You completed every mission in this roadmap. Refresh or choose a new goal to keep going.</Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={claimRoadmapCertificate} disabled={claimingCertificate}>
              <Text style={styles.primaryBtnText}>{claimingCertificate ? "Claiming..." : "Claim Certificate"}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="sparkles" size={16} color="#1F7A4C" />
          <Text style={styles.sectionTitle}>AI Generation</Text>
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {(loading || isGenerating) ? (
          <View style={styles.generateCard}>
            <ActivityIndicator size="large" color="#1F7A4C" />
            <Text style={styles.generateTitle}>Creating your roadmap...</Text>
            <Text style={styles.generateMeta}>{GENERATION_STAGES[generationStage]}</Text>
          </View>
        ) : null}
        {!loading && !isGenerating && !data ? <Text style={styles.meta}>Roadmap unavailable.</Text> : null}
      </View>

      {data ? (
        <>
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="git-network" size={16} color="#1F7A4C" />
              <Text style={styles.sectionTitle}>Journey Timeline</Text>
            </View>
            <Text style={styles.resultTitle}>Generated for: {customGoal.trim() || goalLabel || data.goal}</Text>
            <Text style={styles.meta}>{socialCount} people are on a similar journey in ORIN right now.</Text>
            <View style={styles.timeline}>
              <View style={styles.timelineRail} />
              {data.steps.map((step, index) => {
                const isCompleted = completedSteps.includes(step.stepNumber);
                const isCurrent = currentMission?.stepNumber === step.stepNumber;
                return (
                  <View key={`${step.stepNumber}-${step.title}`} style={styles.timelineItem}>
                    <View
                      style={[
                        styles.timelineDot,
                        isCompleted && styles.timelineDotComplete,
                        isCurrent && styles.timelineDotCurrent
                      ]}
                    >
                      <Ionicons
                        name={isCompleted ? "checkmark" : index === 0 ? "rocket" : "flag"}
                        size={14}
                        color="#fff"
                      />
                    </View>
                    <View style={[styles.missionCard, isCurrent && styles.missionCardCurrent]}>
                      <View style={styles.missionHeader}>
                        <Text style={styles.missionWeek}>Week {index + 1}</Text>
                        <Text style={styles.missionXp}>+{MISSION_XP} XP</Text>
                      </View>
                      <Text style={styles.missionTitle}>{step.title}</Text>
                      <Text style={styles.meta}>
                        {isCompleted
                          ? "Completed. Badge unlocked and streak continues."
                          : "Upload proof like a project link or screenshot after completing this mission."}
                      </Text>
                      <TouchableOpacity
                        style={[
                          styles.secondaryBtn,
                          isCompleted && styles.completedBtn,
                          activeStepNumber === step.stepNumber && styles.inProgressBtn,
                          !isCompleted && !isCurrent && styles.lockedBtn
                        ]}
                        disabled={isCompleted || (!isCurrent && activeStepNumber !== step.stepNumber)}
                        onPress={() => (activeStepNumber === step.stepNumber ? completeMission(step.stepNumber) : startMission(step.stepNumber))}
                      >
                        <Text style={[
                          styles.secondaryBtnText,
                          isCompleted && styles.completedBtnText,
                          !isCompleted && !isCurrent && styles.lockedBtnText
                        ]}>
                          {isCompleted ? "Completed" : activeStepNumber === step.stepNumber ? "Complete Mission" : isCurrent ? "Start Mission" : "Locked"}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>

          <View style={styles.splitRow}>
            <View style={[styles.section, styles.halfSection]}>
              <View style={styles.sectionHeader}>
                <Ionicons name="stats-chart" size={16} color="#1F7A4C" />
                <Text style={styles.sectionTitle}>Progress</Text>
              </View>
              <Text style={styles.progressTitle}>Journey: {progressPct}% complete</Text>
              <View style={styles.progressTrackLight}>
                <View style={[styles.progressFillLight, { width: `${progressPct}%` }]} />
              </View>
              <Text style={styles.meta}>Streak: {streakDays} day{streakDays === 1 ? "" : "s"}</Text>
            </View>

            <View style={[styles.section, styles.halfSection]}>
              <View style={styles.sectionHeader}>
                <Ionicons name="trending-up" size={16} color="#1F7A4C" />
                <Text style={styles.sectionTitle}>Future Preview</Text>
              </View>
              {futurePreview.map((item) => (
                <Text key={item} style={styles.previewItem}>
                  - {item}
                </Text>
              ))}
            </View>
          </View>
        </>
      ) : null}

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="flash" size={16} color="#1F7A4C" />
          <Text style={styles.sectionTitle}>Actions</Text>
        </View>
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => currentMission && startMission(currentMission.stepNumber)} disabled={!currentMission || activeStepNumber === currentMission?.stepNumber}>
            <Text style={styles.primaryBtnText}>{activeStepNumber && currentMission?.stepNumber === activeStepNumber ? "Mission In Progress" : "Continue Journey"}</Text>
          </TouchableOpacity>
          {progressPct === 100 ? (
            <TouchableOpacity style={styles.secondaryOutlineBtn} onPress={claimRoadmapCertificate} disabled={claimingCertificate}>
              <Text style={styles.secondaryOutlineBtnText}>{claimingCertificate ? "Claiming..." : "Claim Certificate"}</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            style={styles.secondaryOutlineBtn}
            onPress={async () => {
              if (!data) {
                notify("Generate roadmap first.");
                return;
              }
              await saveAiItem({
                type: "career_roadmap",
                title: `Roadmap: ${customGoal.trim() || goalLabel || data.goal}`,
                payload: {
                  primaryCategory,
                  subCategory,
                  focus,
                  goal: data.goal,
                  completedSteps,
                  activeStepNumber,
                  steps: data.steps || []
                }
              });
              notify("Saved to Saved AI.");
            }}
          >
            <Text style={styles.secondaryOutlineBtnText}>Save Roadmap</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="help-circle" size={16} color="#1F7A4C" />
          <Text style={styles.sectionTitle}>Resources</Text>
        </View>
        <Text style={styles.meta}>Pair each milestone with one mini project, one proof upload, and one mentor session for better results.</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, backgroundColor: "#F3F6FB", gap: 12 },
  hero: { borderRadius: 24, padding: 18, gap: 12, shadowColor: "#0F5132", shadowOpacity: 0.18, shadowRadius: 16, elevation: 8 },
  heroTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  heroBadge: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#F6FFF8", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  heroBadgeText: { color: "#0E6A42", fontWeight: "800", fontSize: 12 },
  heroMeta: { color: "#FFFFFF", fontWeight: "800" },
  heroTitle: { fontSize: 28, fontWeight: "900", color: "#FFFFFF" },
  heroSub: { color: "#E6FFF1", lineHeight: 20 },
  heroProgressCard: { backgroundColor: "rgba(255,255,255,0.14)", borderRadius: 16, padding: 14, gap: 8 },
  heroProgressHeader: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  heroProgressLabel: { color: "#FFFFFF", fontWeight: "700", flexShrink: 1 },
  heroProgressMeta: { color: "#E6FFF1", fontSize: 12 },
  progressTrack: { height: 10, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.2)", overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 999, backgroundColor: "#FFE08A" },
  section: { backgroundColor: "#FFFFFF", borderRadius: 18, borderWidth: 1, borderColor: "#E4E7EC", padding: 14, gap: 10, shadowColor: "#101828", shadowOpacity: 0.04, shadowRadius: 10, elevation: 2 },
  splitRow: { gap: 12 },
  halfSection: { flex: 1 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  sectionTitle: { fontWeight: "800", color: "#1E2B24", fontSize: 16 },
  resultTitle: { fontWeight: "800", color: "#1E2B24", fontSize: 16 },
  label: { color: "#344054", fontWeight: "700", marginTop: 4 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: "#D0D5DD",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#fff"
  },
  chipActive: { borderColor: "#1F7A4C", backgroundColor: "#EAF6EF" },
  chipText: { color: "#475467", fontWeight: "700", fontSize: 12 },
  chipTextActive: { color: "#1F7A4C" },
  input: {
    borderWidth: 1,
    borderColor: "#D0D5DD",
    borderRadius: 12,
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: "#344054"
  },
  todayCard: { borderRadius: 16, padding: 16, gap: 8 },
  todayHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  todayTag: { color: "#8A5B00", fontWeight: "900" },
  todayXp: { color: "#8A5B00", fontWeight: "800" },
  todayTitle: { color: "#1E2B24", fontWeight: "800", fontSize: 18, lineHeight: 24 },
  doneCard: { padding: 16, borderRadius: 16, backgroundColor: "#EEF8F1", gap: 6 },
  doneTitle: { color: "#0E6A42", fontSize: 18, fontWeight: "800" },
  generateCard: { borderRadius: 16, backgroundColor: "#F7FBF8", borderWidth: 1, borderColor: "#D9EFE2", padding: 20, alignItems: "center", gap: 10 },
  generateTitle: { color: "#0E6A42", fontWeight: "800", fontSize: 18 },
  generateMeta: { color: "#667085" },
  timeline: { position: "relative", gap: 12, paddingTop: 2 },
  timelineRail: { position: "absolute", left: 15, top: 0, bottom: 0, width: 2, backgroundColor: "#DCE4DF" },
  timelineItem: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  timelineDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#98A2B3",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1
  },
  timelineDotCurrent: { backgroundColor: "#1F7A4C" },
  timelineDotComplete: { backgroundColor: "#F59E0B" },
  missionCard: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: "#FAFBFC",
    borderWidth: 1,
    borderColor: "#E6EAF0",
    padding: 14,
    gap: 8
  },
  missionCardCurrent: {
    backgroundColor: "#F4FBF7",
    borderColor: "#1F7A4C"
  },
  missionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  missionWeek: { color: "#475467", fontWeight: "700" },
  missionXp: { color: "#1F7A4C", fontWeight: "800" },
  missionTitle: { color: "#101828", fontWeight: "800", fontSize: 16, lineHeight: 22 },
  progressTitle: { color: "#101828", fontWeight: "800" },
  progressTrackLight: { height: 10, borderRadius: 999, backgroundColor: "#E9EEF5", overflow: "hidden" },
  progressFillLight: { height: "100%", borderRadius: 999, backgroundColor: "#1F7A4C" },
  previewItem: { color: "#344054", lineHeight: 22 },
  meta: { color: "#667085", lineHeight: 20 },
  error: { color: "#B42318" },
  primaryBtn: {
    alignSelf: "flex-start",
    backgroundColor: "#1F7A4C",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11
  },
  primaryBtnText: { color: "#fff", fontWeight: "800" },
  secondaryBtn: {
    alignSelf: "flex-start",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "#EAF6EF"
  },
  secondaryBtnText: { color: "#1F7A4C", fontWeight: "800" },
  completedBtn: { backgroundColor: "#FFF3D9" },
  completedBtnText: { color: "#8A5B00" },
  inProgressBtn: { backgroundColor: "#EAF6EF" },
  lockedBtn: { backgroundColor: "#F2F4F7" },
  lockedBtnText: { color: "#98A2B3" },
  secondaryOutlineBtn: {
    borderWidth: 1,
    borderColor: "#1F7A4C",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    backgroundColor: "#fff"
  },
  secondaryOutlineBtnText: { color: "#1F7A4C", fontWeight: "800" },
  actionRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 }
});






