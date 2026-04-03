import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
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
import { useAppTheme } from "@/context/ThemeContext";
import { notify } from "@/utils/notify";
import { saveAiItem } from "@/utils/aiSaves";

type RoadmapStep = {
  id: string;
  stepNumber: number;
  title: string;
  completed?: boolean;
  status?: "locked" | "active" | "completed";
  startedAt?: string | null;
  completedAt?: string | null;
  unlockedAt?: string | null;
  proofStatus?: "not_submitted" | "submitted" | "approved";
  proofSubmitted?: boolean;
  proofSubmittedAt?: string | null;
  proofImageUrl?: string;
  canStart?: boolean;
  canSubmitProof?: boolean;
  proofRequired?: boolean;
};
type CareerRoadmapResponse = {
  goal: string;
  steps: RoadmapStep[];
  progress?: {
    completedSteps?: number;
    totalSteps?: number;
    progressPercent?: number;
    currentStepId?: string;
    lockHours?: number;
  };
};

const GENERATION_STAGES = ["Analyzing goal...", "Building steps...", "Optimizing path..."];
const MISSION_XP = 20;

function formatRoadmapDate(value?: string | null) {
  if (!value) return "soon";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "soon";
  return date.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit"
  });
}

export default function AiCareerRoadmapPage() {
  const { colors, isDark } = useAppTheme();
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
  const [claimingCertificate, setClaimingCertificate] = useState(false);
  const [proofText, setProofText] = useState("");
  const [proofLink, setProofLink] = useState("");
  const [proofImageUrl, setProofImageUrl] = useState("");
  const [uploadingProof, setUploadingProof] = useState(false);
  const [submittingProof, setSubmittingProof] = useState(false);
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
      if (data) load(true);
    }, [data, load])
  );

  const completedSteps = useMemo(
    () => (data?.steps || []).filter((step) => step.completed).map((step) => step.stepNumber),
    [data]
  );
  const completedCount = completedSteps.length;
  const totalSteps = data?.steps.length || 0;
  const progressPct = Number(data?.progress?.progressPercent || (totalSteps ? Math.round((completedCount / totalSteps) * 100) : 0));
  const totalXp = completedCount * MISSION_XP;
  const currentMission = data?.steps.find((step) => step.status === "active") || null;
  const nextRoadmapStep = data?.steps.find((step) => !step.completed) || null;
  const lockedMission = !currentMission && nextRoadmapStep?.status === "locked" ? nextRoadmapStep : null;
  const nextTarget = Math.max(0, 100 - (totalXp % 100 || 0));
  const streakDays = completedCount ? Math.min(completedCount, 14) : 0;
  const currentLevelIndex = Math.min(Math.floor(totalXp / 100), 5);
  const nextLevelIndex = Math.min(currentLevelIndex + 1, 5);
  const levels = ["Starter", "Explorer", "Builder", "Pro", "Elite", "Legend"];
  const socialCount = 12 + totalSteps * 14;
  const isMissionStarted = Boolean(currentMission?.startedAt);

  useEffect(() => {
    if (!currentMission || !currentMission.startedAt) {
      setProofText("");
      setProofLink("");
      setProofImageUrl("");
      return;
    }
    setProofImageUrl(currentMission.proofImageUrl || "");
  }, [currentMission]);

  const startMission = useCallback(
    async (stepId: string) => {
      try {
        await api.post(`/api/network/career-roadmap/${encodeURIComponent(stepId)}/start`);
        notify("Mission started. Complete the work, then submit proof.");
        await load(true);
      } catch (e: any) {
        notify(e?.response?.data?.message || "Unable to start mission.");
      }
    },
    [load]
  );

  const uploadProofImage = useCallback(async () => {
    let ImagePicker: any;
    try {
      ImagePicker = await import("expo-image-picker");
    } catch {
      notify("Image upload requires the latest Android build.");
      return;
    }

    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) return;
    } catch {
      // Continue and try picker launch directly on OEM Android devices.
    }

    try {
      setUploadingProof(true);
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker?.MediaTypeOptions?.Images ?? ["images"],
        quality: 0.85,
        allowsEditing: true
      } as any);

      if (result?.canceled || !result?.assets?.length) return;
      const asset = result.assets[0];
      const formData = new FormData();
      formData.append("file", {
        uri: asset.uri,
        name: asset.fileName || `roadmap-proof-${Date.now()}.jpg`,
        type: asset.mimeType || "image/jpeg"
      } as any);

      const { data: uploadRes } = await api.post<{ url: string }>("/api/uploads/image", formData, {
        headers: {
          "Content-Type": "multipart/form-data"
        }
      });
      if (uploadRes?.url) {
        setProofImageUrl(uploadRes.url);
        notify("Proof screenshot added.");
      }
    } catch (e: any) {
      notify(e?.response?.data?.message || "Unable to upload proof screenshot.");
    } finally {
      setUploadingProof(false);
    }
  }, []);

  const submitProof = useCallback(
    async (stepId: string) => {
      try {
        setSubmittingProof(true);
        await api.post(`/api/network/career-roadmap/${encodeURIComponent(stepId)}/submit-proof`, {
          proofText,
          proofLink,
          proofImageUrl
        });
        setProofText("");
        setProofLink("");
        setProofImageUrl("");
        notify(`Proof submitted. +${MISSION_XP} XP`);
        await load(true);
      } catch (e: any) {
        notify(e?.response?.data?.message || "Unable to submit proof.");
      } finally {
        setSubmittingProof(false);
      }
    },
    [load, proofImageUrl, proofLink, proofText]
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
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[styles.page, { backgroundColor: colors.background }]}
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

      <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.sectionHeader}>
          <Ionicons name="map" size={16} color={colors.accent} />
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Roadmap Setup</Text>
        </View>
        <Text style={[styles.meta, { color: colors.textMuted }]}>
          Choose your Domain Guide path and ORIN will build a guided mission plan around it.
        </Text>

        <Text style={[styles.label, { color: colors.text }]}>Domain (Domain Guide)</Text>
        <View style={styles.chips}>
          {(domainTree?.primaryCategories || []).map((item) => (
            <TouchableOpacity
              key={item}
              style={[styles.chip, { backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF", borderColor: colors.border }, primaryCategory === item && [styles.chipActive, { backgroundColor: colors.accentSoft, borderColor: colors.accent }]]}
              onPress={() => setPrimaryCategory(item)}
            >
              <Text style={[styles.chipText, { color: colors.textMuted }, primaryCategory === item && [styles.chipTextActive, { color: colors.accent }]]}>{item}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[styles.label, { color: colors.text }]}>Sub-domain</Text>
        <View style={styles.chips}>
          {(domainTree?.subCategoriesByPrimary?.[primaryCategory] || []).map((item) => (
            <TouchableOpacity
              key={item}
              style={[styles.chip, { backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF", borderColor: colors.border }, subCategory === item && [styles.chipActive, { backgroundColor: colors.accentSoft, borderColor: colors.accent }]]}
              onPress={() => setSubCategory(item)}
            >
              <Text style={[styles.chipText, { color: colors.textMuted }, subCategory === item && [styles.chipTextActive, { color: colors.accent }]]}>{item}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[styles.label, { color: colors.text }]}>Focus</Text>
        <View style={styles.chips}>
          {(domainTree?.focusByPrimarySub?.[`${primaryCategory}::${subCategory}`] || []).map((item) => (
            <TouchableOpacity
              key={item}
              style={[styles.chip, { backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF", borderColor: colors.border }, focus === item && [styles.chipActive, { backgroundColor: colors.accentSoft, borderColor: colors.accent }]]}
              onPress={() => setFocus(item)}
            >
              <Text style={[styles.chipText, { color: colors.textMuted }, focus === item && [styles.chipTextActive, { color: colors.accent }]]}>{item}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[styles.label, { color: colors.text }]}>Custom Goal (optional)</Text>
        <TextInput
          style={[styles.input, { backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF", borderColor: colors.border, color: colors.text }]}
          value={customGoal}
          onChangeText={setCustomGoal}
          placeholder="Example: UPSC Mains, Backend Developer, Corporate Law"
          placeholderTextColor={colors.textMuted}
        />
        <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: colors.accent }]} onPress={() => load(true)}>
          <Text style={styles.primaryBtnText}>Generate Journey</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.sectionHeader}>
          <Ionicons name="flash" size={16} color={colors.accent} />
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Today&apos;s Mission</Text>
        </View>
        {currentMission ? (
          <LinearGradient colors={["#FFF9E8", "#FFF2CC"]} style={styles.todayCard}>
            <View style={styles.todayHeader}>
              <Text style={styles.todayTag}>Today's Task</Text>
              <Text style={styles.todayXp}>+{MISSION_XP} XP</Text>
            </View>
            <Text style={styles.todayTitle}>{currentMission.title}</Text>
            <Text style={[styles.meta, { color: colors.textMuted }]}>
              {isMissionStarted
                ? "Submit at least one proof item to complete this mission and unlock the next week on schedule."
                : "Start this mission first, then come back with a screenshot, proof link, or short proof note."}
            </Text>
            {!isMissionStarted ? (
              <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: colors.accent }]} onPress={() => startMission(currentMission.id)}>
                <Text style={styles.primaryBtnText}>Start Mission</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.proofForm}>
                <TextInput
                  style={[styles.input, { backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF", borderColor: colors.border, color: colors.text }]}
                  value={proofText}
                  onChangeText={setProofText}
                  placeholder="What did you complete? Add a short proof note"
                  placeholderTextColor={colors.textMuted}
                  multiline
                />
                <TextInput
                  style={[styles.input, { backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF", borderColor: colors.border, color: colors.text }]}
                  value={proofLink}
                  onChangeText={setProofLink}
                  placeholder="Project / GitHub / Drive / practice link (optional)"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="none"
                />
                {proofImageUrl ? (
                  <Image source={{ uri: proofImageUrl }} style={styles.proofPreview} />
                ) : null}
                <View style={styles.actionRow}>
                  <TouchableOpacity style={[styles.secondaryOutlineBtn, { borderColor: colors.accent }]} onPress={uploadProofImage} disabled={uploadingProof}>
                    <Text style={[styles.secondaryOutlineBtnText, { color: colors.accent }]}>
                      {uploadingProof ? "Uploading..." : proofImageUrl ? "Change Screenshot" : "Upload Screenshot"}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.primaryBtn, { backgroundColor: colors.accent }]}
                    onPress={() => submitProof(currentMission.id)}
                    disabled={submittingProof}
                  >
                    <Text style={styles.primaryBtnText}>{submittingProof ? "Submitting..." : "Submit Proof"}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </LinearGradient>
        ) : lockedMission ? (
          <View style={[styles.doneCard, { backgroundColor: isDark ? colors.surfaceAlt : "#F7FFF9", borderColor: colors.border }]}>
            <Text style={[styles.doneTitle, { color: colors.text }]}>Next mission locked</Text>
            <Text style={[styles.meta, { color: colors.textMuted }]}>
              {lockedMission.title} unlocks on {formatRoadmapDate(lockedMission.unlockedAt)}. This keeps roadmap progress effort-based instead of instant click-through.
            </Text>
          </View>
        ) : (
          <View style={[styles.doneCard, { backgroundColor: isDark ? colors.surfaceAlt : "#F7FFF9", borderColor: colors.border }]}>
            <Text style={[styles.doneTitle, { color: colors.text }]}>Journey completed</Text>
            <Text style={[styles.meta, { color: colors.textMuted }]}>You completed every mission in this roadmap. Refresh or choose a new goal to keep going.</Text>
            <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: colors.accent }]} onPress={claimRoadmapCertificate} disabled={claimingCertificate}>
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
                          ? "Completed with proof submitted. Badge unlocked and streak continues."
                          : step.status === "locked"
                            ? `Locked until ${formatRoadmapDate(step.unlockedAt)}`
                            : step.startedAt
                              ? "Mission in progress. Submit proof from Today's Mission to complete it."
                              : "Start the mission, do the work, then submit proof to complete it."}
                      </Text>
                      <TouchableOpacity
                        style={[
                          styles.secondaryBtn,
                          isCompleted && styles.completedBtn,
                          step.startedAt && step.status === "active" && styles.inProgressBtn,
                          !isCompleted && step.status === "locked" && styles.lockedBtn
                        ]}
                        disabled={isCompleted || step.status === "locked" || Boolean(step.startedAt)}
                        onPress={() => startMission(step.id)}
                      >
                        <Text style={[
                          styles.secondaryBtnText,
                          isCompleted && styles.completedBtnText,
                          !isCompleted && step.status === "locked" && styles.lockedBtnText
                        ]}>
                          {isCompleted ? "Completed" : step.status === "locked" ? "Locked" : step.startedAt ? "In Progress" : "Start Mission"}
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
          <TouchableOpacity style={styles.primaryBtn} onPress={() => currentMission && startMission(currentMission.id)} disabled={!currentMission || Boolean(currentMission.startedAt)}>
            <Text style={styles.primaryBtnText}>
              {currentMission ? (currentMission.startedAt ? "Mission In Progress" : "Continue Journey") : "Journey Complete"}
            </Text>
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
  proofForm: { gap: 10 },
  proofPreview: { width: "100%", height: 180, borderRadius: 14, backgroundColor: "#E5E7EB" },
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






