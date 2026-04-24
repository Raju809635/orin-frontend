import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/lib/api";
import { getAppErrorMessage, handleAppError } from "@/lib/appError";
import { getDomainTree, getFallbackDomainTree, type DomainTreeResponse } from "@/lib/domainTree";
import { useAuth } from "@/context/AuthContext";
import { useAppTheme } from "@/context/ThemeContext";
import { notify } from "@/utils/notify";
import { saveAiItem } from "@/utils/aiSaves";

const AI_GOLD = "#D4A017";
const AI_GOLD_SOFT = "#FFF4CC";
const AI_TEAL = "#0F766E";
const AI_INDIGO = "#6D28D9";

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
type InstitutionRoadmapItem = {
  id: string;
  title: string;
  description?: string;
  domain?: string;
  className?: string;
  status?: string;
  weeks: {
    id: string;
    title: string;
    description?: string;
    tasks?: string[];
    resources?: string[];
    quizTitle?: string;
    challengeTitle?: string;
    xpReward?: number;
    submission?: {
      id: string;
      status: "submitted" | "accepted" | "rejected";
      proofText?: string;
      proofLink?: string;
      proofImageUrl?: string;
      submittedAt?: string | null;
      mentorReview?: {
        reviewedAt?: string | null;
        notes?: string;
        xpAwarded?: number;
        certificateId?: string | null;
      };
    } | null;
  }[];
  mentor?: { id?: string | null; name?: string };
};
type InstitutionRoadmapSubmissionItem = {
  id: string;
  roadmapTitle: string;
  weekTitle: string;
  status: "submitted" | "accepted" | "rejected";
  proofText?: string;
  proofLink?: string;
  proofImageUrl?: string;
  student?: {
    id?: string | null;
    name?: string;
    email?: string;
  };
  mentorReview?: {
    reviewedAt?: string | null;
    notes?: string;
    xpAwarded?: number;
    certificateId?: string | null;
  };
};

const GENERATION_STAGES = ["Analyzing goal...", "Building steps...", "Optimizing path..."];
const MISSION_XP = 20;
const ROADMAP_REQUEST_TIMEOUT_MS = 12000;
const ROADMAP_LEVELS = ["Starter", "Explorer", "Builder", "Pro", "Elite", "Legend"];
type RoadmapDrawerSection = "ai" | "institution" | "completed" | "recent";

function getRoadmapDrawerTone(section: RoadmapDrawerSection, isDark: boolean) {
  if (section === "institution") {
    return {
      accent: AI_INDIGO,
      background: isDark ? "rgba(109,40,217,0.18)" : "#F4F3FF"
    };
  }

  if (section === "completed") {
    return {
      accent: AI_TEAL,
      background: isDark ? "rgba(15,118,110,0.18)" : "#E6F5F2"
    };
  }

  if (section === "recent") {
    return {
      accent: AI_GOLD,
      background: isDark ? "rgba(212,160,23,0.18)" : AI_GOLD_SOFT
    };
  }

  return {
    accent: AI_GOLD,
    background: isDark ? "rgba(212,160,23,0.18)" : AI_GOLD_SOFT
  };
}

const FALLBACK_DOMAIN_TREE = getFallbackDomainTree();

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
  const { user } = useAuth();
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ section?: string }>();
  const [domainTree, setDomainTree] = useState<DomainTreeResponse | null>(FALLBACK_DOMAIN_TREE);
  const [primaryCategory, setPrimaryCategory] = useState(FALLBACK_DOMAIN_TREE.primaryCategories?.[0] || "");
  const [subCategory, setSubCategory] = useState((FALLBACK_DOMAIN_TREE.subCategoriesByPrimary?.[FALLBACK_DOMAIN_TREE.primaryCategories?.[0] || ""] || [])[0] || "");
  const [focus, setFocus] = useState(
    (
      FALLBACK_DOMAIN_TREE.focusByPrimarySub?.[
        `${FALLBACK_DOMAIN_TREE.primaryCategories?.[0] || ""}::${(FALLBACK_DOMAIN_TREE.subCategoriesByPrimary?.[FALLBACK_DOMAIN_TREE.primaryCategories?.[0] || ""] || [])[0] || ""}`
      ] || []
    )[0] || ""
  );
  const [customGoal, setCustomGoal] = useState("");
  const [skillsInput, setSkillsInput] = useState("");
  const [data, setData] = useState<CareerRoadmapResponse | null>(null);
  const [institutionRoadmaps, setInstitutionRoadmaps] = useState<InstitutionRoadmapItem[]>([]);
  const [loading, setLoading] = useState(false);
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
  const [institutionProofDrafts, setInstitutionProofDrafts] = useState<Record<string, { proofText: string; proofLink: string; proofImageUrl: string }>>({});
  const [uploadingInstitutionProofKey, setUploadingInstitutionProofKey] = useState<string | null>(null);
  const [submittingInstitutionProofKey, setSubmittingInstitutionProofKey] = useState<string | null>(null);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [drawerSection, setDrawerSection] = useState<RoadmapDrawerSection>("ai");
  const [recentInstitutionRoadmapIds, setRecentInstitutionRoadmapIds] = useState<string[]>([]);
  const [institutionRoadmapTitle, setInstitutionRoadmapTitle] = useState("");
  const [institutionRoadmapDomain, setInstitutionRoadmapDomain] = useState("");
  const [institutionRoadmapClassName, setInstitutionRoadmapClassName] = useState("");
  const [institutionRoadmapDescription, setInstitutionRoadmapDescription] = useState("");
  const [institutionRoadmapWeekOne, setInstitutionRoadmapWeekOne] = useState("");
  const [institutionRoadmapWeekTwo, setInstitutionRoadmapWeekTwo] = useState("");
  const [institutionRoadmapWeekThree, setInstitutionRoadmapWeekThree] = useState("");
  const [creatingInstitutionRoadmap, setCreatingInstitutionRoadmap] = useState(false);
  const [mentorInstitutionSubmissions, setMentorInstitutionSubmissions] = useState<InstitutionRoadmapSubmissionItem[]>([]);
  const [institutionReviewDrafts, setInstitutionReviewDrafts] = useState<Record<string, { xpAwarded: string; notes: string; issueCertificate: boolean }>>({});
  const [reviewingInstitutionSubmissionId, setReviewingInstitutionSubmissionId] = useState<string | null>(null);

  useEffect(() => {
    const requestedSection = String(params.section || "").trim().toLowerCase();
    if (requestedSection === "institution") {
      setDrawerSection("institution");
    } else if (requestedSection === "completed") {
      setDrawerSection("completed");
    } else if (requestedSection === "recent") {
      setDrawerSection("recent");
    } else if (requestedSection === "ai") {
      setDrawerSection("ai");
    }
  }, [params.section]);

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
        if (!mounted) return;
        setDomainTree(FALLBACK_DOMAIN_TREE);
      });
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
  const enteredSkills = useMemo(
    () => skillsInput.split(",").map((item) => item.trim()).filter(Boolean),
    [skillsInput]
  );
  const resolvedGoal = useMemo(
    () => customGoal.trim() || goalLabel,
    [customGoal, goalLabel]
  );

  const load = useCallback(
    async (refresh = false) => {
      let stageTimer: ReturnType<typeof setInterval> | null = null;
      try {
        if (user?.role === "mentor") {
          if (refresh) setRefreshing(true);
          else setLoading(true);
          setError(null);
          const [institutionRes, submissionsRes] = await Promise.allSettled([
            api.get<{ roadmaps: InstitutionRoadmapItem[] }>("/api/network/institution-roadmaps"),
            api.get<InstitutionRoadmapSubmissionItem[]>("/api/network/institution-roadmaps/submissions/mentor")
          ]);
          setInstitutionRoadmaps(institutionRes.status === "fulfilled" ? institutionRes.value.data?.roadmaps || [] : []);
          setMentorInstitutionSubmissions(submissionsRes.status === "fulfilled" ? submissionsRes.value.data || [] : []);
          setData(null);
          return;
        }
        if (!customGoal.trim()) {
          setError("Please add your goal here before generating a roadmap.");
          setData(null);
          setLoading(false);
          setRefreshing(false);
          return;
        }
        if (!enteredSkills.length) {
          setError("Please add your current skills here before generating a roadmap.");
          setData(null);
          setLoading(false);
          setRefreshing(false);
          return;
        }
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

        const res = await Promise.race([
          api.get<CareerRoadmapResponse>("/api/network/career-roadmap", {
            params: {
              primaryCategory,
              subCategory,
              focus,
              goal: resolvedGoal,
              skills: skillsInput
            }
          }),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("Roadmap generation is taking too long. Please try again.")), ROADMAP_REQUEST_TIMEOUT_MS)
          )
        ]);

        if (stageTimer) clearInterval(stageTimer);
        await new Promise((resolve) => setTimeout(resolve, 900));
        setData(res.data || null);
        try {
          const institutionRes = await api.get<{ roadmaps: InstitutionRoadmapItem[] }>("/api/network/institution-roadmaps");
          setInstitutionRoadmaps(institutionRes.data?.roadmaps || []);
        } catch {
          setInstitutionRoadmaps([]);
        }
      } catch (e: any) {
        if (stageTimer) clearInterval(stageTimer);
        setError(getAppErrorMessage(e, "Something went wrong. Please try again."));
      } finally {
        setIsGenerating(false);
        setLoading(false);
        setRefreshing(false);
      }
    },
    [customGoal, enteredSkills.length, focus, primaryCategory, resolvedGoal, skillsInput, subCategory, user?.role]
  );

  const completedSteps = useMemo(
    () => (data?.steps || []).filter((step) => step.completed).map((step) => step.stepNumber),
    [data]
  );
  const completedCount = completedSteps.length;
  const totalSteps = data?.steps.length || 0;
  const hasRoadmapData = totalSteps > 0;
  const progressPct = Number(data?.progress?.progressPercent || (totalSteps ? Math.round((completedCount / totalSteps) * 100) : 0));
  const totalXp = completedCount * MISSION_XP;
  const currentMission = data?.steps.find((step) => step.status === "active") || null;
  const nextRoadmapStep = data?.steps.find((step) => !step.completed) || null;
  const lockedMission = !currentMission && nextRoadmapStep?.status === "locked" ? nextRoadmapStep : null;
  const nextTarget = Math.max(0, 100 - (totalXp % 100 || 0));
  const streakDays = completedCount ? Math.min(completedCount, 14) : 0;
  const currentLevelIndex = Math.min(Math.floor(totalXp / 100), 5);
  const nextLevelIndex = Math.min(currentLevelIndex + 1, 5);
  const socialCount = 12 + totalSteps * 14;
  const isMissionStarted = Boolean(currentMission?.startedAt);
  const completedInstitutionRoadmaps = useMemo(
    () =>
      institutionRoadmaps.filter((roadmap) =>
        (roadmap.weeks || []).length > 0 &&
        roadmap.weeks.every((week) => week.submission?.status === "accepted")
      ),
    [institutionRoadmaps]
  );
  const recentInstitutionRoadmaps = useMemo(
    () =>
      recentInstitutionRoadmapIds
        .map((id) => institutionRoadmaps.find((item) => item.id === id))
        .filter(Boolean) as InstitutionRoadmapItem[],
    [institutionRoadmaps, recentInstitutionRoadmapIds]
  );
  const activeDrawerTitle = useMemo(() => {
    if (drawerSection === "institution") return "Institution Roadmaps";
    if (drawerSection === "completed") return "Completed Roadmaps";
    if (drawerSection === "recent") return "Recent Roadmap Activity";
    return "AI Roadmaps";
  }, [drawerSection]);
  const isMentorView = user?.role === "mentor";
  const studentAiVisible = drawerSection === "ai" && !isMentorView;

  useEffect(() => {
    if (user?.role === "mentor") {
      load();
    }
  }, [load, user?.role]);

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
        handleAppError(e, { fallbackMessage: "Unable to start this mission right now." });
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
      handleAppError(e, { fallbackMessage: "Unable to upload proof screenshot right now." });
    } finally {
      setUploadingProof(false);
    }
  }, []);

  const updateInstitutionDraft = useCallback((key: string, patch: Partial<{ proofText: string; proofLink: string; proofImageUrl: string }>) => {
    setInstitutionProofDrafts((prev) => ({
      ...prev,
      [key]: {
        proofText: prev[key]?.proofText || "",
        proofLink: prev[key]?.proofLink || "",
        proofImageUrl: prev[key]?.proofImageUrl || "",
        ...patch
      }
    }));
  }, []);

  const uploadInstitutionProofImage = useCallback(async (draftKey: string) => {
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
      // Continue and try picker launch directly.
    }

    try {
      setUploadingInstitutionProofKey(draftKey);
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
        name: asset.fileName || `institution-roadmap-proof-${Date.now()}.jpg`,
        type: asset.mimeType || "image/jpeg"
      } as any);

      const { data: uploadRes } = await api.post<{ url: string }>("/api/uploads/image", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      if (uploadRes?.url) {
        updateInstitutionDraft(draftKey, { proofImageUrl: uploadRes.url });
        notify("Proof screenshot added.");
      }
    } catch (e: any) {
      handleAppError(e, { fallbackMessage: "Unable to upload proof screenshot right now." });
    } finally {
      setUploadingInstitutionProofKey(null);
    }
  }, [updateInstitutionDraft]);

  const submitInstitutionRoadmapProof = useCallback(async (roadmapId: string, weekId: string) => {
    const draftKey = `${roadmapId}::${weekId}`;
    const draft = institutionProofDrafts[draftKey] || { proofText: "", proofLink: "", proofImageUrl: "" };
    try {
      setSubmittingInstitutionProofKey(draftKey);
      await api.post(`/api/network/institution-roadmaps/${encodeURIComponent(roadmapId)}/weeks/${encodeURIComponent(weekId)}/submissions`, {
        proofText: draft.proofText,
        proofLink: draft.proofLink,
        proofImageUrl: draft.proofImageUrl
      });
      setInstitutionProofDrafts((prev) => ({ ...prev, [draftKey]: { proofText: "", proofLink: "", proofImageUrl: "" } }));
      notify("Institution roadmap proof submitted.");
      await load(true);
    } catch (e: any) {
      handleAppError(e, { fallbackMessage: "Unable to submit institution roadmap proof right now." });
    } finally {
      setSubmittingInstitutionProofKey(null);
    }
  }, [institutionProofDrafts, load]);

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
        handleAppError(e, { fallbackMessage: "Unable to submit proof right now." });
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
        level: ROADMAP_LEVELS[currentLevelIndex],
        referenceId: roadmapCertificateRef,
        metadata: {
          domain: focus || subCategory || primaryCategory || "",
          level: ROADMAP_LEVELS[currentLevelIndex],
          goal: customGoal.trim() || goalLabel || data.goal,
          totalSteps,
          completedSteps: totalSteps
        }
      });
      notify(res.data?.created ? "Certificate generated and added to your achievements." : "Certificate already exists in your achievements.");
    } catch (e: any) {
      handleAppError(e, { fallbackMessage: "Unable to claim your roadmap certificate right now." });
    } finally {
      setClaimingCertificate(false);
    }
  }, [
    currentLevelIndex,
    customGoal,
    data,
    focus,
    goalLabel,
    primaryCategory,
    progressPct,
    roadmapCertificateRef,
    subCategory,
    totalSteps
  ]);

  const markInstitutionRoadmapRecent = useCallback((roadmapId: string) => {
    setRecentInstitutionRoadmapIds((prev) => [roadmapId, ...prev.filter((id) => id !== roadmapId)].slice(0, 12));
  }, []);

  const createInstitutionRoadmap = useCallback(async () => {
    const weeks = [institutionRoadmapWeekOne, institutionRoadmapWeekTwo, institutionRoadmapWeekThree]
      .map((title, index) => ({
        id: `week-${index + 1}`,
        title: String(title || "").trim(),
        tasks: [`Complete ${String(title || `week ${index + 1}`).trim()} tasks`, "Submit proof to mentor", "Review linked resources"]
      }))
      .filter((item) => item.title);

    if (!institutionRoadmapTitle.trim() || !weeks.length) {
      notify("Add a roadmap title and at least one week.");
      return;
    }

    try {
      setCreatingInstitutionRoadmap(true);
      await api.post("/api/network/institution-roadmaps", {
        title: institutionRoadmapTitle.trim(),
        description: institutionRoadmapDescription.trim(),
        domain: institutionRoadmapDomain.trim(),
        className: institutionRoadmapClassName.trim(),
        weeks
      });
      setInstitutionRoadmapTitle("");
      setInstitutionRoadmapDescription("");
      setInstitutionRoadmapDomain("");
      setInstitutionRoadmapClassName("");
      setInstitutionRoadmapWeekOne("");
      setInstitutionRoadmapWeekTwo("");
      setInstitutionRoadmapWeekThree("");
      notify("Institution roadmap created.");
      await load(true);
    } catch (e: any) {
      handleAppError(e, { fallbackMessage: "Unable to create institution roadmap right now." });
    } finally {
      setCreatingInstitutionRoadmap(false);
    }
  }, [institutionRoadmapClassName, institutionRoadmapDescription, institutionRoadmapDomain, institutionRoadmapTitle, institutionRoadmapWeekOne, institutionRoadmapWeekThree, institutionRoadmapWeekTwo, load]);

  const updateInstitutionReviewDraft = useCallback((submissionId: string, patch: Partial<{ xpAwarded: string; notes: string; issueCertificate: boolean }>) => {
    setInstitutionReviewDrafts((prev) => ({
      ...prev,
      [submissionId]: {
        xpAwarded: prev[submissionId]?.xpAwarded || "",
        notes: prev[submissionId]?.notes || "",
        issueCertificate: prev[submissionId]?.issueCertificate || false,
        ...patch
      }
    }));
  }, []);

  const reviewInstitutionSubmission = useCallback(async (submissionId: string, status: "accepted" | "rejected") => {
    const draft = institutionReviewDrafts[submissionId] || { xpAwarded: "", notes: "", issueCertificate: false };
    try {
      setReviewingInstitutionSubmissionId(submissionId);
      await api.patch(`/api/network/institution-roadmaps/submissions/${encodeURIComponent(submissionId)}/review`, {
        status,
        xpAwarded: status === "accepted" ? Number(draft.xpAwarded || 0) : 0,
        notes: draft.notes,
        issueCertificate: status === "accepted" ? draft.issueCertificate : false
      });
      notify(status === "accepted" ? "Submission approved." : "Submission sent back for rework.");
      await load(true);
    } catch (e: any) {
      handleAppError(e, { fallbackMessage: "Unable to review institution roadmap submission right now." });
    } finally {
      setReviewingInstitutionSubmissionId(null);
    }
  }, [institutionReviewDrafts, load]);

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
          <Text style={[styles.drawerTitle, { color: colors.text }]}>Career Roadmaps</Text>
          <Text style={[styles.drawerSub, { color: colors.textMuted }]}>AI, institution, completed, and recent</Text>
        </View>
        <TouchableOpacity style={[styles.drawerCloseBtn, { borderColor: colors.border }]} onPress={() => setDrawerVisible(false)}>
          <Ionicons name="close" size={18} color={colors.text} />
        </TouchableOpacity>
      </View>

      <View style={styles.drawerSection}>
        <Text style={[styles.drawerSectionTitle, { color: colors.textMuted }]}>Browse</Text>
        {([
          { key: "ai", label: "AI Roadmaps", meta: currentMission?.title ? `Current mission: ${currentMission.title}` : "Generate and continue your AI roadmap" },
          { key: "institution", label: "Institution Roadmaps", meta: institutionRoadmaps.length ? `${institutionRoadmaps.length} institution roadmap${institutionRoadmaps.length === 1 ? "" : "s"}` : "Institution mentor roadmaps" },
          { key: "completed", label: "Completed", meta: `${completedCount} AI steps completed${completedInstitutionRoadmaps.length ? ` · ${completedInstitutionRoadmaps.length} institution roadmap${completedInstitutionRoadmaps.length === 1 ? "" : "s"}` : ""}` },
          { key: "recent", label: "Recent", meta: recentInstitutionRoadmaps.length ? `${recentInstitutionRoadmaps.length} recently opened institution roadmap${recentInstitutionRoadmaps.length === 1 ? "" : "s"}` : "Your latest roadmap activity" }
        ] as { key: RoadmapDrawerSection; label: string; meta: string }[]).map((item) => {
          const active = drawerSection === item.key;
          return (
            <TouchableOpacity
              key={item.key}
              style={[
                styles.drawerModeRow,
                { borderColor: colors.border, backgroundColor: colors.surfaceAlt },
                active && { backgroundColor: getRoadmapDrawerTone(item.key, isDark).background, borderColor: getRoadmapDrawerTone(item.key, isDark).accent }
              ]}
              onPress={() => {
                setDrawerSection(item.key);
                setDrawerVisible(false);
              }}
            >
              <Ionicons
                name={item.key === "institution" ? "school-outline" : item.key === "completed" ? "checkmark-done-circle-outline" : item.key === "recent" ? "time-outline" : "map-outline"}
                size={16}
                color={active ? (item.key === "institution" ? AI_INDIGO : AI_GOLD) : colors.textMuted}
              />
              <View style={{ flex: 1 }}>
                <Text style={[styles.drawerModeTitle, { color: colors.text }]}>{item.label}</Text>
                <Text style={[styles.drawerModeMeta, { color: colors.textMuted }]}>{item.meta}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={[styles.drawerSection, styles.drawerHistorySection]}>
        <Text style={[styles.drawerSectionTitle, { color: colors.textMuted }]}>
          {drawerSection === "institution" ? "Institution list" : drawerSection === "completed" ? "Completed summary" : drawerSection === "recent" ? "Recent institution roadmaps" : "Roadmap summary"}
        </Text>
        <ScrollView showsVerticalScrollIndicator={false}>
          {drawerSection === "institution" ? (
            institutionRoadmaps.length ? institutionRoadmaps.map((roadmap) => (
              <TouchableOpacity
                key={roadmap.id}
                style={[styles.historyRow, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}
                onPress={() => {
                  markInstitutionRoadmapRecent(roadmap.id);
                  setDrawerVisible(false);
                }}
              >
                <Text style={[styles.historyTitle, { color: colors.text }]} numberOfLines={1}>{roadmap.title}</Text>
                <Text style={[styles.historyPreview, { color: colors.textMuted }]} numberOfLines={2}>
                  {roadmap.className ? `${roadmap.className} · ` : ""}{roadmap.description || "Institution mentor guided roadmap"}
                </Text>
                <Text style={[styles.historyMeta, { color: colors.textMuted }]}>{roadmap.weeks.length} weeks</Text>
              </TouchableOpacity>
            )) : <Text style={[styles.drawerEmptyText, { color: colors.textMuted }]}>No institution roadmaps yet.</Text>
          ) : drawerSection === "completed" ? (
            <>
              <View style={[styles.historyRow, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}>
                <Text style={[styles.historyTitle, { color: colors.text }]}>AI Roadmap Progress</Text>
                <Text style={[styles.historyPreview, { color: colors.textMuted }]}>
                  {completedCount}/{totalSteps} steps completed · {progressPct}% progress
                </Text>
              </View>
              {completedInstitutionRoadmaps.length ? completedInstitutionRoadmaps.map((roadmap) => (
                <View key={roadmap.id} style={[styles.historyRow, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}>
                  <Text style={[styles.historyTitle, { color: colors.text }]} numberOfLines={1}>{roadmap.title}</Text>
                  <Text style={[styles.historyPreview, { color: colors.textMuted }]} numberOfLines={2}>Institution roadmap completed with all approved submissions.</Text>
                </View>
              )) : <Text style={[styles.drawerEmptyText, { color: colors.textMuted }]}>No completed institution roadmap yet.</Text>}
            </>
          ) : drawerSection === "recent" ? (
            recentInstitutionRoadmaps.length ? recentInstitutionRoadmaps.map((roadmap) => (
              <View key={roadmap.id} style={[styles.historyRow, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}>
                <Text style={[styles.historyTitle, { color: colors.text }]} numberOfLines={1}>{roadmap.title}</Text>
                <Text style={[styles.historyPreview, { color: colors.textMuted }]} numberOfLines={2}>
                  {roadmap.weeks.find((week) => week.submission)?.title ? `Recent proof activity in ${roadmap.weeks.find((week) => week.submission)?.title}` : "Recently opened roadmap"}
                </Text>
              </View>
            )) : <Text style={[styles.drawerEmptyText, { color: colors.textMuted }]}>No recent roadmap activity yet.</Text>
          ) : (
            <View style={[styles.historyRow, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}>
              <Text style={[styles.historyTitle, { color: colors.text }]}>AI Roadmap Summary</Text>
              <Text style={[styles.historyPreview, { color: colors.textMuted }]} numberOfLines={2}>
                {data?.goal || customGoal.trim() || goalLabel || "Generate a roadmap to begin"}
              </Text>
              <Text style={[styles.historyMeta, { color: colors.textMuted }]}>{progressPct}% complete</Text>
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
          <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>{activeDrawerTitle}</Text>
          <Text style={[styles.headerSub, { color: colors.textMuted }]} numberOfLines={1}>
            {drawerSection === "institution" ? "Mentor-led institution learning paths" : drawerSection === "completed" ? "Finished roadmap progress" : drawerSection === "recent" ? "Latest roadmap activity" : "Generate and grow with AI roadmaps"}
          </Text>
        </View>
        <TouchableOpacity style={[styles.headerIconBtn, { borderColor: colors.border, backgroundColor: colors.surface }]} onPress={() => load(true)}>
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
        <View style={styles.heroTopRow}>
          <View style={styles.heroBadge}>
            <Ionicons name="sparkles" size={14} color={AI_GOLD} />
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
              Level {currentLevelIndex + 1} - {ROADMAP_LEVELS[currentLevelIndex]}
            </Text>
            <Text style={styles.heroProgressLabel}>{progressPct}% complete</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
          </View>
          <Text style={styles.heroProgressMeta}>Next rank: {nextTarget} XP to {ROADMAP_LEVELS[nextLevelIndex]}</Text>
        </View>
      </LinearGradient>

      {isMentorView ? (
      <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.sectionHeader}>
          <Ionicons name="build" size={16} color={AI_INDIGO} />
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Mentor Roadmap Control</Text>
        </View>
        <Text style={[styles.meta, { color: colors.textMuted }]}>Create institution or class roadmaps here. Students will consume them on the same roadmap page and submit proof back to you.</Text>
        <TextInput style={[styles.input, { backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF", borderColor: colors.border, color: colors.text }]} value={institutionRoadmapTitle} onChangeText={setInstitutionRoadmapTitle} placeholder="Roadmap title" placeholderTextColor={colors.textMuted} />
        <TextInput style={[styles.input, { backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF", borderColor: colors.border, color: colors.text }]} value={institutionRoadmapDomain} onChangeText={setInstitutionRoadmapDomain} placeholder="Domain (optional)" placeholderTextColor={colors.textMuted} />
        <TextInput style={[styles.input, { backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF", borderColor: colors.border, color: colors.text }]} value={institutionRoadmapClassName} onChangeText={setInstitutionRoadmapClassName} placeholder="Class / Section (optional)" placeholderTextColor={colors.textMuted} />
        <TextInput style={[styles.input, { backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF", borderColor: colors.border, color: colors.text }]} value={institutionRoadmapDescription} onChangeText={setInstitutionRoadmapDescription} placeholder="Roadmap description" placeholderTextColor={colors.textMuted} multiline />
        <TextInput style={[styles.input, { backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF", borderColor: colors.border, color: colors.text }]} value={institutionRoadmapWeekOne} onChangeText={setInstitutionRoadmapWeekOne} placeholder="Week 1 title" placeholderTextColor={colors.textMuted} />
        <TextInput style={[styles.input, { backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF", borderColor: colors.border, color: colors.text }]} value={institutionRoadmapWeekTwo} onChangeText={setInstitutionRoadmapWeekTwo} placeholder="Week 2 title" placeholderTextColor={colors.textMuted} />
        <TextInput style={[styles.input, { backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF", borderColor: colors.border, color: colors.text }]} value={institutionRoadmapWeekThree} onChangeText={setInstitutionRoadmapWeekThree} placeholder="Week 3 title" placeholderTextColor={colors.textMuted} />
        <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: AI_INDIGO }]} onPress={createInstitutionRoadmap} disabled={creatingInstitutionRoadmap}>
          <Text style={styles.primaryBtnText}>{creatingInstitutionRoadmap ? "Creating..." : "Create Institution Roadmap"}</Text>
        </TouchableOpacity>
      </View>
      ) : null}

      {isMentorView ? (
      <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.sectionHeader}>
          <Ionicons name="checkmark-done-circle" size={16} color={AI_TEAL} />
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Roadmap Reviews</Text>
        </View>
        {!mentorInstitutionSubmissions.length ? <Text style={[styles.meta, { color: colors.textMuted }]}>No student roadmap submissions yet.</Text> : null}
        {mentorInstitutionSubmissions.slice(0, 10).map((item) => {
          const reviewDraft = institutionReviewDrafts[item.id] || {
            xpAwarded: String(item.mentorReview?.xpAwarded || ""),
            notes: item.mentorReview?.notes || "",
            issueCertificate: Boolean(item.mentorReview?.certificateId)
          };
          return (
            <View key={item.id} style={styles.institutionWeekCard}>
              <Text style={styles.institutionWeekTitle}>{item.roadmapTitle}</Text>
              <Text style={styles.meta}>{item.weekTitle} · {item.student?.name || "Student"}{item.student?.email ? ` · ${item.student.email}` : ""}</Text>
              {item.proofText ? <Text style={styles.meta}>{item.proofText}</Text> : null}
              {item.proofLink ? <Text style={styles.meta}>{item.proofLink}</Text> : null}
              <TextInput style={[styles.input, { backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF", borderColor: colors.border, color: colors.text }]} value={reviewDraft.xpAwarded} onChangeText={(value) => updateInstitutionReviewDraft(item.id, { xpAwarded: value })} placeholder="XP to award" placeholderTextColor={colors.textMuted} keyboardType="numeric" />
              <TextInput style={[styles.input, { backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF", borderColor: colors.border, color: colors.text }]} value={reviewDraft.notes} onChangeText={(value) => updateInstitutionReviewDraft(item.id, { notes: value })} placeholder="Mentor review note" placeholderTextColor={colors.textMuted} multiline />
              <TouchableOpacity style={[styles.secondaryBtn, { backgroundColor: reviewDraft.issueCertificate ? (isDark ? "rgba(109,40,217,0.18)" : "#F4F3FF") : (isDark ? colors.surfaceAlt : "#F9FAFB") }]} onPress={() => updateInstitutionReviewDraft(item.id, { issueCertificate: !reviewDraft.issueCertificate })}>
                <Text style={[styles.secondaryBtnText, { color: reviewDraft.issueCertificate ? AI_INDIGO : colors.textMuted }]}>{reviewDraft.issueCertificate ? "Certificate: Yes" : "Issue Certificate"}</Text>
              </TouchableOpacity>
              <View style={styles.actionRow}>
                <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: AI_TEAL, flex: 1 }]} onPress={() => reviewInstitutionSubmission(item.id, "accepted")} disabled={reviewingInstitutionSubmissionId === item.id}>
                  <Text style={styles.primaryBtnText}>{reviewingInstitutionSubmissionId === item.id ? "Saving..." : "Approve + XP"}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.secondaryOutlineBtn, { borderColor: colors.border, flex: 1 }]} onPress={() => reviewInstitutionSubmission(item.id, "rejected")} disabled={reviewingInstitutionSubmissionId === item.id}>
                  <Text style={[styles.secondaryOutlineBtnText, { color: colors.text }]}>Reject</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
      </View>
      ) : null}

      {studentAiVisible ? (
      <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.sectionHeader}>
          <Ionicons name="map" size={16} color={AI_INDIGO} />
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
              style={[styles.chip, { backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF", borderColor: colors.border }, primaryCategory === item && [styles.chipActive, { backgroundColor: AI_GOLD_SOFT, borderColor: AI_GOLD }]]}
              onPress={() => setPrimaryCategory(item)}
            >
              <Text style={[styles.chipText, { color: colors.textMuted }, primaryCategory === item && [styles.chipTextActive, { color: AI_GOLD }]]}>{item}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[styles.label, { color: colors.text }]}>Sub-domain</Text>
        <View style={styles.chips}>
          {(domainTree?.subCategoriesByPrimary?.[primaryCategory] || []).map((item) => (
            <TouchableOpacity
              key={item}
              style={[styles.chip, { backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF", borderColor: colors.border }, subCategory === item && [styles.chipActive, { backgroundColor: AI_GOLD_SOFT, borderColor: AI_GOLD }]]}
              onPress={() => setSubCategory(item)}
            >
              <Text style={[styles.chipText, { color: colors.textMuted }, subCategory === item && [styles.chipTextActive, { color: AI_GOLD }]]}>{item}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[styles.label, { color: colors.text }]}>Focus</Text>
        <View style={styles.chips}>
          {(domainTree?.focusByPrimarySub?.[`${primaryCategory}::${subCategory}`] || []).map((item) => (
            <TouchableOpacity
              key={item}
              style={[styles.chip, { backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF", borderColor: colors.border }, focus === item && [styles.chipActive, { backgroundColor: AI_GOLD_SOFT, borderColor: AI_GOLD }]]}
              onPress={() => setFocus(item)}
            >
              <Text style={[styles.chipText, { color: colors.textMuted }, focus === item && [styles.chipTextActive, { color: AI_GOLD }]]}>{item}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[styles.label, { color: colors.text }]}>Custom Goal</Text>
        <TextInput
          style={[styles.input, { backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF", borderColor: colors.border, color: colors.text }]}
          value={customGoal}
          onChangeText={setCustomGoal}
          placeholder="Example: UPSC Mains, Backend Developer, Corporate Law"
          placeholderTextColor={colors.textMuted}
        />
        <Text style={[styles.label, { color: colors.text }]}>Current Skills</Text>
        <TextInput
          style={[styles.input, { backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF", borderColor: colors.border, color: colors.text }]}
          value={skillsInput}
          onChangeText={setSkillsInput}
          placeholder="Example: Python, SQL, Basic Math"
          placeholderTextColor={colors.textMuted}
        />
        <Text style={[styles.meta, { color: colors.textMuted }]}>
          Add your real current skills so ORIN can suggest the next step after them.
        </Text>
        <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: AI_GOLD }]} onPress={() => load(true)}>
          <Text style={styles.primaryBtnText}>Generate Journey</Text>
        </TouchableOpacity>
      </View>) : null}

      {studentAiVisible ? (
      <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.sectionHeader}>
          <Ionicons name="flash" size={16} color={AI_TEAL} />
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Today&apos;s Mission</Text>
        </View>
        {!hasRoadmapData ? (
          <View style={[styles.doneCard, { backgroundColor: isDark ? colors.surfaceAlt : "#F7FFF9", borderColor: colors.border }]}>
            <Text style={[styles.doneTitle, { color: colors.text }]}>Roadmap not loaded</Text>
            <Text style={[styles.meta, { color: colors.textMuted }]}>
              {error || "Add your goal and current skills above, then generate your roadmap."}
            </Text>
            <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: AI_TEAL }]} onPress={() => load(true)}>
              <Text style={styles.primaryBtnText}>Generate Journey</Text>
            </TouchableOpacity>
          </View>
        ) : currentMission ? (
          <LinearGradient colors={["#FFF9E8", "#FFF2CC"]} style={styles.todayCard}>
            <View style={styles.todayHeader}>
              <Text style={styles.todayTag}>Today&apos;s Task</Text>
              <Text style={styles.todayXp}>+{MISSION_XP} XP</Text>
            </View>
            <Text style={styles.todayTitle}>{currentMission.title}</Text>
            <Text style={[styles.meta, { color: colors.textMuted }]}>
              {isMissionStarted
                ? "Your active week is open below. Submit proof inside that week card to unlock the next week."
                : "Start this mission first, then come back with a screenshot, proof link, or short proof note."}
            </Text>
            {!isMissionStarted ? (
              <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: AI_TEAL }]} onPress={() => startMission(currentMission.id)}>
                <Text style={styles.primaryBtnText}>Start Mission</Text>
              </TouchableOpacity>
            ) : (
              <Text style={[styles.inlineHint, { color: colors.textMuted }]}>Open the active week in Journey Timeline below and submit your proof there.</Text>
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
            <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: AI_TEAL }]} onPress={claimRoadmapCertificate} disabled={claimingCertificate}>
              <Text style={styles.primaryBtnText}>{claimingCertificate ? "Claiming..." : "Claim Certificate"}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>) : null}

      {studentAiVisible ? (
      <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.sectionHeader}>
          <Ionicons name="sparkles" size={16} color={AI_GOLD} />
          <Text style={styles.sectionTitle}>AI Generation</Text>
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {!data && (loading || isGenerating) ? (
          <View style={styles.generateCard}>
            <ActivityIndicator size="large" color={AI_GOLD} />
            <Text style={styles.generateTitle}>Creating your roadmap...</Text>
            <Text style={styles.generateMeta}>{GENERATION_STAGES[generationStage]}</Text>
          </View>
        ) : null}
        {!loading && !isGenerating && !data ? <Text style={styles.meta}>Roadmap unavailable.</Text> : null}
      </View>) : null}

      {data && studentAiVisible ? (
        <>
          <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.sectionHeader}>
              <Ionicons name="git-network" size={16} color={AI_INDIGO} />
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
                              ? "Mission in progress. Submit proof inside this week card to complete it."
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
                      {isCurrent && step.startedAt && !isCompleted ? (
                        <View style={styles.inlineProofCard}>
                          <Text style={styles.inlineProofTitle}>Week {index + 1} Proof Submission</Text>
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
                          {proofImageUrl ? <Image source={{ uri: proofImageUrl }} style={styles.proofPreview} /> : null}
                          <View style={styles.actionRow}>
                            <TouchableOpacity style={[styles.secondaryOutlineBtn, { borderColor: AI_GOLD }]} onPress={uploadProofImage} disabled={uploadingProof}>
                              <Text style={[styles.secondaryOutlineBtnText, { color: AI_GOLD }]}>
                                {uploadingProof ? "Uploading..." : proofImageUrl ? "Change Screenshot" : "Upload Screenshot"}
                              </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[styles.primaryBtn, { backgroundColor: AI_TEAL }]}
                              onPress={() => submitProof(step.id)}
                              disabled={submittingProof}
                            >
                              <Text style={styles.primaryBtnText}>{submittingProof ? "Submitting..." : "Submit Proof"}</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </View>
          </View>

          <View style={styles.splitRow}>
            <View style={[styles.section, styles.halfSection, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.sectionHeader}>
                <Ionicons name="stats-chart" size={16} color={AI_TEAL} />
                <Text style={styles.sectionTitle}>Progress</Text>
              </View>
              <Text style={styles.progressTitle}>Journey: {progressPct}% complete</Text>
              <View style={styles.progressTrackLight}>
                <View style={[styles.progressFillLight, { width: `${progressPct}%` }]} />
              </View>
              <Text style={styles.meta}>Streak: {streakDays} day{streakDays === 1 ? "" : "s"}</Text>
            </View>

            <View style={[styles.section, styles.halfSection, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.sectionHeader}>
                <Ionicons name="trending-up" size={16} color={AI_TEAL} />
                <Text style={styles.sectionTitle}>Future Preview</Text>
              </View>
              {futurePreview.map((item) => (
                <Text key={item} style={styles.previewItem}>
                  - {item}
                </Text>
              ))}
            </View>
          </View>

          <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.sectionHeader}>
              <Ionicons name="school" size={16} color={AI_INDIGO} />
              <Text style={styles.sectionTitle}>Institution Roadmaps</Text>
            </View>
            {!institutionRoadmaps.length ? (
              <Text style={styles.meta}>No institution roadmaps published for your institution yet.</Text>
            ) : (
              institutionRoadmaps.map((roadmap) => (
                <View key={roadmap.id} style={styles.institutionCard}>
                  <Text style={styles.institutionTitle}>{roadmap.title}</Text>
                  <Text style={styles.meta}>{roadmap.description || "Institution mentor guided roadmap."}</Text>
                  {roadmap.className ? <Text style={styles.meta}>Class: {roadmap.className}</Text> : null}
                  <Text style={styles.meta}>Mentor: {roadmap.mentor?.name || "Institution Mentor"}</Text>
                  {roadmap.weeks.slice(0, 4).map((week, weekIndex) => {
                    const draftKey = `${roadmap.id}::${week.id}`;
                    const draft = institutionProofDrafts[draftKey] || { proofText: "", proofLink: "", proofImageUrl: "" };
                    const submission = week.submission || null;
                    return (
                      <View key={`${roadmap.id}-${week.id}`} style={styles.institutionWeekCard}>
                        <Text style={styles.institutionWeekTitle}>Week {weekIndex + 1}: {week.title}</Text>
                        {week.description ? <Text style={styles.meta}>{week.description}</Text> : null}
                        {(week.tasks || []).slice(0, 3).map((task) => (
                          <Text key={`${roadmap.id}-${week.id}-${task}`} style={styles.previewItem}>- {task}</Text>
                        ))}
                        {submission ? (
                          <View style={styles.institutionSubmissionCard}>
                            <Text style={styles.institutionSubmissionTitle}>
                              Status: {submission.status === "accepted" ? "Approved" : submission.status === "rejected" ? "Needs Rework" : "Submitted"}
                            </Text>
                            {submission.submittedAt ? <Text style={styles.meta}>Submitted on {formatRoadmapDate(submission.submittedAt)}</Text> : null}
                            {submission.mentorReview?.xpAwarded ? <Text style={styles.meta}>XP awarded: {submission.mentorReview.xpAwarded}</Text> : null}
                            {submission.mentorReview?.notes ? <Text style={styles.meta}>Mentor note: {submission.mentorReview.notes}</Text> : null}
                            {submission.mentorReview?.certificateId ? <Text style={styles.meta}>Certificate issued for this week.</Text> : null}
                          </View>
                        ) : null}
                        {submission?.status !== "accepted" ? (
                          <View style={styles.inlineProofCard}>
                            <Text style={styles.inlineProofTitle}>Submit Week {weekIndex + 1} Proof</Text>
                            <TextInput
                              style={[styles.input, { backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF", borderColor: colors.border, color: colors.text }]}
                              value={draft.proofText}
                              onChangeText={(value) => updateInstitutionDraft(draftKey, { proofText: value })}
                              placeholder="What did you complete in this week?"
                              placeholderTextColor={colors.textMuted}
                              multiline
                            />
                            <TextInput
                              style={[styles.input, { backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF", borderColor: colors.border, color: colors.text }]}
                              value={draft.proofLink}
                              onChangeText={(value) => updateInstitutionDraft(draftKey, { proofLink: value })}
                              placeholder="Project / GitHub / Drive / demo link (optional)"
                              placeholderTextColor={colors.textMuted}
                              autoCapitalize="none"
                            />
                            {draft.proofImageUrl ? <Image source={{ uri: draft.proofImageUrl }} style={styles.proofPreview} /> : null}
                            <View style={styles.actionRow}>
                              <TouchableOpacity
                                style={[styles.secondaryOutlineBtn, { borderColor: AI_GOLD }]}
                                onPress={() => uploadInstitutionProofImage(draftKey)}
                                disabled={uploadingInstitutionProofKey === draftKey}
                              >
                                <Text style={[styles.secondaryOutlineBtnText, { color: AI_GOLD }]}>
                                  {uploadingInstitutionProofKey === draftKey ? "Uploading..." : draft.proofImageUrl ? "Change Screenshot" : "Upload Screenshot"}
                                </Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={[styles.primaryBtn, { backgroundColor: AI_TEAL }]}
                                onPress={() => submitInstitutionRoadmapProof(roadmap.id, week.id)}
                                disabled={submittingInstitutionProofKey === draftKey}
                              >
                                <Text style={styles.primaryBtnText}>
                                  {submittingInstitutionProofKey === draftKey ? "Submitting..." : submission ? "Resubmit Proof" : "Submit Proof"}
                                </Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        ) : null}
                      </View>
                    );
                  })}
                </View>
              ))
            )}
          </View>
        </>
      ) : null}

      {drawerSection === "institution" ? (
          <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="school" size={16} color={AI_INDIGO} />
            <Text style={styles.sectionTitle}>Institution Roadmaps</Text>
          </View>
          {!institutionRoadmaps.length ? (
            <Text style={styles.meta}>No institution roadmaps published for your institution yet.</Text>
          ) : (
            institutionRoadmaps.map((roadmap) => (
              <View key={roadmap.id} style={styles.institutionCard}>
                <Text style={styles.institutionTitle}>{roadmap.title}</Text>
                <Text style={styles.meta}>{roadmap.description || "Institution mentor guided roadmap."}</Text>
                {roadmap.className ? <Text style={styles.meta}>Class: {roadmap.className}</Text> : null}
                <Text style={styles.meta}>Mentor: {roadmap.mentor?.name || "Institution Mentor"}</Text>
                <TouchableOpacity style={[styles.secondaryBtn, { backgroundColor: isDark ? "rgba(109,40,217,0.18)" : "#F4F3FF" }]} onPress={() => markInstitutionRoadmapRecent(roadmap.id)}>
                  <Text style={[styles.secondaryBtnText, { color: AI_INDIGO }]}>Open Roadmap</Text>
                </TouchableOpacity>
                {roadmap.weeks.slice(0, 4).map((week, weekIndex) => {
                  const draftKey = `${roadmap.id}::${week.id}`;
                  const draft = institutionProofDrafts[draftKey] || { proofText: "", proofLink: "", proofImageUrl: "" };
                  const submission = week.submission || null;
                  return (
                    <View key={`${roadmap.id}-${week.id}`} style={styles.institutionWeekCard}>
                      <Text style={styles.institutionWeekTitle}>Week {weekIndex + 1}: {week.title}</Text>
                      {week.description ? <Text style={styles.meta}>{week.description}</Text> : null}
                      {(week.tasks || []).slice(0, 3).map((task) => (
                        <Text key={`${roadmap.id}-${week.id}-${task}`} style={styles.previewItem}>- {task}</Text>
                      ))}
                      {submission ? (
                        <View style={styles.institutionSubmissionCard}>
                          <Text style={styles.institutionSubmissionTitle}>
                            Status: {submission.status === "accepted" ? "Approved" : submission.status === "rejected" ? "Needs Rework" : "Submitted"}
                          </Text>
                          {submission.submittedAt ? <Text style={styles.meta}>Submitted on {formatRoadmapDate(submission.submittedAt)}</Text> : null}
                          {submission.mentorReview?.xpAwarded ? <Text style={styles.meta}>XP awarded: {submission.mentorReview.xpAwarded}</Text> : null}
                          {submission.mentorReview?.notes ? <Text style={styles.meta}>Mentor note: {submission.mentorReview.notes}</Text> : null}
                          {submission.mentorReview?.certificateId ? <Text style={styles.meta}>Certificate issued for this week.</Text> : null}
                        </View>
                      ) : null}
                      {submission?.status !== "accepted" ? (
                        <View style={styles.inlineProofCard}>
                          <Text style={styles.inlineProofTitle}>Submit Week {weekIndex + 1} Proof</Text>
                          <TextInput
                            style={[styles.input, { backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF", borderColor: colors.border, color: colors.text }]}
                            value={draft.proofText}
                            onChangeText={(value) => updateInstitutionDraft(draftKey, { proofText: value })}
                            placeholder="What did you complete in this week?"
                            placeholderTextColor={colors.textMuted}
                            multiline
                          />
                          <TextInput
                            style={[styles.input, { backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF", borderColor: colors.border, color: colors.text }]}
                            value={draft.proofLink}
                            onChangeText={(value) => updateInstitutionDraft(draftKey, { proofLink: value })}
                            placeholder="Project / GitHub / Drive / demo link (optional)"
                            placeholderTextColor={colors.textMuted}
                            autoCapitalize="none"
                          />
                          {draft.proofImageUrl ? <Image source={{ uri: draft.proofImageUrl }} style={styles.proofPreview} /> : null}
                          <View style={styles.actionRow}>
                            <TouchableOpacity
                              style={[styles.secondaryOutlineBtn, { borderColor: AI_GOLD }]}
                              onPress={() => uploadInstitutionProofImage(draftKey)}
                              disabled={uploadingInstitutionProofKey === draftKey}
                            >
                              <Text style={[styles.secondaryOutlineBtnText, { color: AI_GOLD }]}>
                                {uploadingInstitutionProofKey === draftKey ? "Uploading..." : draft.proofImageUrl ? "Change Screenshot" : "Upload Screenshot"}
                              </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[styles.primaryBtn, { backgroundColor: AI_TEAL }]}
                              onPress={() => submitInstitutionRoadmapProof(roadmap.id, week.id)}
                              disabled={submittingInstitutionProofKey === draftKey}
                            >
                              <Text style={styles.primaryBtnText}>
                                {submittingInstitutionProofKey === draftKey ? "Submitting..." : submission ? "Resubmit Proof" : "Submit Proof"}
                              </Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            ))
          )}
        </View>
      ) : null}

      {drawerSection === "completed" ? (
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="checkmark-done-circle" size={16} color={AI_TEAL} />
            <Text style={styles.sectionTitle}>Completed Roadmaps</Text>
          </View>
          <View style={styles.doneCard}>
            <Text style={styles.doneTitle}>AI Roadmap</Text>
            <Text style={styles.meta}>{completedCount}/{totalSteps} steps completed · {progressPct}% progress</Text>
          </View>
          {completedInstitutionRoadmaps.length ? completedInstitutionRoadmaps.map((roadmap) => (
            <View key={roadmap.id} style={styles.institutionCard}>
              <Text style={styles.institutionTitle}>{roadmap.title}</Text>
              <Text style={styles.meta}>All weeks approved in this institution roadmap.</Text>
            </View>
          )) : <Text style={styles.meta}>No completed institution roadmaps yet.</Text>}
        </View>
      ) : null}

      {drawerSection === "recent" ? (
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="time" size={16} color={AI_GOLD} />
            <Text style={styles.sectionTitle}>Recent Roadmap Activity</Text>
          </View>
          <View style={styles.doneCard}>
            <Text style={styles.doneTitle}>AI Roadmap</Text>
            <Text style={styles.meta}>{currentMission?.title ? `Current mission: ${currentMission.title}` : "Generate or continue your AI roadmap."}</Text>
          </View>
          {recentInstitutionRoadmaps.length ? recentInstitutionRoadmaps.map((roadmap) => (
            <View key={roadmap.id} style={styles.institutionCard}>
              <Text style={styles.institutionTitle}>{roadmap.title}</Text>
              <Text style={styles.meta}>
                {roadmap.weeks.find((week) => week.submission)?.title
                  ? `Recent proof activity in ${roadmap.weeks.find((week) => week.submission)?.title}`
                  : "Recently opened institution roadmap"}
              </Text>
            </View>
          )) : <Text style={styles.meta}>No recent institution roadmap activity yet.</Text>}
        </View>
      ) : null}

        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.sectionHeader}>
          <Ionicons name="flash" size={16} color={AI_TEAL} />
          <Text style={styles.sectionTitle}>Actions</Text>
        </View>
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: AI_TEAL }]}
            onPress={() => {
              if (!hasRoadmapData) {
                load(true);
                return;
              }
              if (currentMission && !currentMission.startedAt) {
                startMission(currentMission.id);
              }
            }}
            disabled={hasRoadmapData ? (!currentMission || Boolean(currentMission.startedAt)) : false}
          >
            <Text style={styles.primaryBtnText}>
              {!hasRoadmapData ? "Generate Journey" : currentMission ? (currentMission.startedAt ? "Mission In Progress" : "Continue Journey") : "Journey Complete"}
            </Text>
          </TouchableOpacity>
          {hasRoadmapData && progressPct === 100 ? (
            <TouchableOpacity style={[styles.secondaryOutlineBtn, { borderColor: AI_GOLD }]} onPress={claimRoadmapCertificate} disabled={claimingCertificate}>
              <Text style={[styles.secondaryOutlineBtnText, { color: AI_GOLD }]}>{claimingCertificate ? "Claiming..." : "Claim Certificate"}</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            style={[styles.secondaryOutlineBtn, { borderColor: AI_GOLD }]}
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
            <Text style={[styles.secondaryOutlineBtnText, { color: AI_GOLD }]}>Save Roadmap</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.sectionHeader}>
          <Ionicons name="help-circle" size={16} color={AI_INDIGO} />
          <Text style={styles.sectionTitle}>Resources</Text>
        </View>
        <Text style={styles.meta}>Pair each milestone with one mini project, one proof upload, and one mentor session for better results.</Text>
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
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  headerCenter: { flex: 1, gap: 2 },
  headerTitle: { fontSize: 18, fontWeight: "900" },
  headerSub: { fontSize: 12, fontWeight: "600" },
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
  inlineHint: { fontWeight: "600" },
  error: { color: "#B42318" },
  proofForm: { gap: 10 },
  inlineProofCard: {
    marginTop: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E6EAF0",
    backgroundColor: "#FFFFFF",
    padding: 12,
    gap: 10
  },
  inlineProofTitle: { color: "#1E2B24", fontWeight: "800", fontSize: 14 },
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
  actionRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  institutionCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E6EAF0",
    backgroundColor: "#FCFCFD",
    padding: 14,
    gap: 8
  },
  institutionTitle: { color: "#101828", fontWeight: "800", fontSize: 16 },
  institutionWeekCard: {
    borderRadius: 12,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E4E7EC",
    padding: 10,
    gap: 4
  },
  institutionWeekTitle: { color: "#1E2B24", fontWeight: "800" },
  institutionSubmissionCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#D6F5DD",
    backgroundColor: "#F3FFF6",
    padding: 10,
    gap: 4
  },
  institutionSubmissionTitle: { color: "#0E6A42", fontWeight: "800" },
  drawerOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.24)",
    flexDirection: "row"
  },
  drawerBackdrop: { flex: 1 },
  drawerPanel: {
    width: Math.min(340, 340),
    maxWidth: "86%",
    borderLeftWidth: 1,
    gap: 14,
    paddingHorizontal: 16
  },
  drawerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  drawerTitle: { fontSize: 20, fontWeight: "900" },
  drawerSub: { fontSize: 12, fontWeight: "600" },
  drawerCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  drawerSection: { gap: 10 },
  drawerHistorySection: { flex: 1 },
  drawerSectionTitle: {
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.6
  },
  drawerModeRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12
  },
  drawerModeTitle: { fontSize: 14, fontWeight: "800" },
  drawerModeMeta: { fontSize: 12, lineHeight: 18, marginTop: 2 },
  historyRow: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    gap: 4,
    marginBottom: 10
  },
  historyTitle: { fontSize: 14, fontWeight: "800" },
  historyPreview: { fontSize: 12, lineHeight: 18 },
  historyMeta: { fontSize: 11, fontWeight: "700" },
  drawerEmptyText: { fontSize: 13, lineHeight: 18 }
});






