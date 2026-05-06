import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { api } from "@/lib/api";
import { getAppErrorMessage, handleAppError } from "@/lib/appError";
import { useAppTheme } from "@/context/ThemeContext";
import { useLearner } from "@/context/LearnerContext";
import { notify } from "@/utils/notify";

type AcademicSubject = { name?: string; subject?: string; key?: string; slug?: string; chapterCount?: number };
type AcademicChapter = { title?: string; name?: string; topics?: (string | { title?: string; name?: string })[] };
type AcademicSubjectResponse = {
  subject?: { chapters?: AcademicChapter[] };
  chapters?: AcademicChapter[];
};

type RoadmapStep = {
  id: string;
  stepNumber: number;
  title: string;
  status: "locked" | "active" | "completed";
  completed?: boolean;
  canStart?: boolean;
  canSubmitProof?: boolean;
  proofRequired?: boolean;
  proofStatus?: "not_submitted" | "submitted" | "approved";
  startedAt?: string | null;
  completedAt?: string | null;
  unlockedAt?: string | null;
  focus?: string;
  outcome?: string;
  xpReward?: number;
  tasks?: { id: string; type: string; title: string; duration?: string; completed?: boolean }[];
};

type StudyRoadmap = {
  title: string;
  goal: string;
  subject: string;
  classLevel: string;
  summary: string;
  steps: RoadmapStep[];
  progress?: {
    completedSteps?: number;
    totalSteps?: number;
    progressPercent?: number;
    currentStepId?: string;
    lockHours?: number;
  };
  certificatePrompt?: string;
  reminders?: string[];
};

type InstitutionRoadmap = {
  id: string;
  title: string;
  weeks: { id: string; title: string; tasks?: string[]; submission?: { status: string } | null }[];
  mentor?: { name?: string };
};

const CLASS_OPTIONS = ["6", "7", "8", "9", "10", "11", "12"];
const FALLBACK_SUBJECTS = ["Mathematics", "Science", "Social Science", "English", "Telugu", "Hindi"];

function normalizeSubjectLabel(item: AcademicSubject | string) {
  if (typeof item === "string") return item;
  return String(item.name || item.subject || item.key || item.slug || "").trim();
}

function normalizeStep(step: RoadmapStep, index: number): RoadmapStep {
  const status = ["active", "locked", "completed"].includes(String(step.status || ""))
    ? step.status
    : index === 0 ? "active" : "locked";
  return {
    ...step,
    id: String(step.id || `step-${index + 1}`),
    stepNumber: Number(step.stepNumber || index + 1),
    title: String(step.title || `Mission ${index + 1}`),
    status,
    completed: status === "completed" || Boolean(step.completed),
    canStart: status === "active" && !step.startedAt,
    canSubmitProof: status === "active" && Boolean(step.startedAt),
    proofRequired: true,
    proofStatus: step.proofStatus || "not_submitted",
    tasks: Array.isArray(step.tasks) ? step.tasks : []
  };
}

function buildLocalRoadmap(subject: string, classLevel: string, chapter: string, goal: string): StudyRoadmap {
  const topics = [chapter || "Core Concepts", "Examples & Notes", "Practice Set", "Weak Area Drill", "Final Check"];
  const steps = topics.map((topic, index) => normalizeStep({
    id: `local-${index + 1}`,
    stepNumber: index + 1,
    title: topic,
    status: index === 0 ? "active" : "locked",
    focus: index === 0 ? "Start with textbook concept clarity." : "Unlock after completing the previous mission.",
    outcome: `Show progress in ${topic}.`,
    xpReward: 20,
    tasks: [
      { id: `local-${index + 1}-read`, type: "Read", title: `Revise ${topic}`, duration: "15 min" },
      { id: `local-${index + 1}-practice`, type: "Practice", title: "Solve 5-10 questions", duration: "20 min" },
      { id: `local-${index + 1}-proof`, type: "Proof", title: "Submit notes, score, or screenshot", duration: "5 min" }
    ]
  } as RoadmapStep, index));

  return {
    title: `${subject} Academic Mission Roadmap`,
    goal,
    subject,
    classLevel,
    summary: `A proof-based Class ${classLevel} roadmap for ${subject}. Complete one mission, submit proof, and unlock the next milestone.`,
    steps,
    progress: { completedSteps: 0, totalSteps: steps.length, progressPercent: 0, currentStepId: steps[0]?.id || "", lockHours: 0 },
    certificatePrompt: "Complete all missions to unlock an achievement prompt.",
    reminders: ["Start one mission at a time.", "Keep proof simple.", "Review weak answers before moving ahead."]
  };
}

function progressPercent(roadmap: StudyRoadmap | null) {
  if (!roadmap?.steps?.length) return 0;
  if (typeof roadmap.progress?.progressPercent === "number") return roadmap.progress.progressPercent;
  const done = roadmap.steps.filter((step) => step.status === "completed" || step.completed).length;
  return Math.round((done / roadmap.steps.length) * 100);
}

export default function HighSchoolStudyRoadmapScreen() {
  const router = useRouter();
  const { colors, isDark } = useAppTheme();
  const { className } = useLearner();
  const [classLevel, setClassLevel] = useState(className || "10");
  const [subjects, setSubjects] = useState<string[]>(FALLBACK_SUBJECTS);
  const [subject, setSubject] = useState("Mathematics");
  const [chapters, setChapters] = useState<string[]>([]);
  const [chapter, setChapter] = useState("");
  const [goal, setGoal] = useState("Improve marks and complete weak chapters");
  const [currentLevel, setCurrentLevel] = useState("Basics");
  const [roadmap, setRoadmap] = useState<StudyRoadmap | null>(null);
  const [institutionRoadmaps, setInstitutionRoadmaps] = useState<InstitutionRoadmap[]>([]);
  const [proofText, setProofText] = useState("");
  const [proofLink, setProofLink] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingContext, setLoadingContext] = useState(false);
  const [loadingInstitution, setLoadingInstitution] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  const activeMission = useMemo(
    () => roadmap?.steps.find((step) => step.status === "active") || roadmap?.steps.find((step) => !step.completed) || null,
    [roadmap]
  );
  const completedSteps = roadmap?.steps.filter((step) => step.status === "completed" || step.completed).length || 0;
  const totalSteps = roadmap?.steps.length || 0;
  const percent = progressPercent(roadmap);

  const loadSubjects = useCallback(async () => {
    try {
      setLoadingContext(true);
      const { data } = await api.get<{ subjects?: AcademicSubject[] | string[]; message?: string }>(`/api/academics/class/${classLevel}/subjects`);
      const nextSubjects = (data?.subjects || []).map(normalizeSubjectLabel).filter(Boolean);
      if (nextSubjects.length) {
        setSubjects(nextSubjects);
        if (!nextSubjects.includes(subject)) setSubject(nextSubjects[0]);
      } else if (data?.message) {
        setSubjects([]);
        setChapters([]);
        setChapter("");
        setStatusMessage(data.message);
      }
    } catch {
      setSubjects(FALLBACK_SUBJECTS);
    } finally {
      setLoadingContext(false);
    }
  }, [classLevel, subject]);

  const loadChapters = useCallback(async () => {
    if (!subject) return;
    try {
      const subjectKey = encodeURIComponent(subject);
      const { data } = await api.get<AcademicSubjectResponse & { message?: string }>(`/api/academics/class/${classLevel}/subject/${subjectKey}`);
      const rawChapters = data?.subject?.chapters || data?.chapters || [];
      const nextChapters = rawChapters.map((item: any) => String(item.chapter_name || item.title || item.name || "").trim()).filter(Boolean).slice(0, 12);
      setChapters(nextChapters);
      setChapter((prev) => prev && nextChapters.includes(prev) ? prev : nextChapters[0] || "");
      if (!nextChapters.length && data?.message) setStatusMessage(data.message);
    } catch {
      setChapters([]);
      setChapter("");
    }
  }, [classLevel, subject]);

  const loadInstitutionRoadmaps = useCallback(async () => {
    try {
      setLoadingInstitution(true);
      const { data } = await api.get<{ roadmaps: InstitutionRoadmap[] }>("/api/network/institution-roadmaps");
      setInstitutionRoadmaps(data?.roadmaps || []);
    } catch {
      setInstitutionRoadmaps([]);
    } finally {
      setLoadingInstitution(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    loadSubjects();
    loadInstitutionRoadmaps();
  }, [loadSubjects, loadInstitutionRoadmaps]));

  useFocusEffect(useCallback(() => {
    loadChapters();
  }, [loadChapters]));

  async function createRoadmap() {
    setLoading(true);
    setStatusMessage("");
    const fallback = buildLocalRoadmap(subject, classLevel, chapter, goal);
    try {
      const { data } = await api.post<{ source?: "ai" | "fallback"; roadmap?: StudyRoadmap }>("/api/ai/highschool/study-roadmap", {
        classLevel,
        subject,
        chapter,
        goal,
        studyGoal: goal,
        currentLevel,
        timePerDay: "1-2 hours"
      });
      const next = data?.roadmap || fallback;
      setRoadmap({ ...next, steps: (next.steps || []).map(normalizeStep) });
      setStatusMessage(data?.source === "ai" ? "AI created your academic mission roadmap." : "Using a safe roadmap until AI is available.");
      setProofText("");
      setProofLink("");
    } catch (error) {
      setRoadmap(fallback);
      setStatusMessage(getAppErrorMessage(error, "AI roadmap is unavailable, so ORIN loaded a safe mission roadmap."));
    } finally {
      setLoading(false);
    }
  }

  async function refreshFromNetwork() {
    try {
      const { data } = await api.get<{ goal: string; steps: RoadmapStep[]; progress?: StudyRoadmap["progress"] }>("/api/network/career-roadmap", {
        params: { goal, primaryCategory: `Class ${classLevel}`, subCategory: subject, focus: chapter || goal }
      });
      if (data?.steps?.length) {
        setRoadmap((prev) => ({
          ...(prev || buildLocalRoadmap(subject, classLevel, chapter, goal)),
          goal: data.goal || goal,
          steps: data.steps.map(normalizeStep),
          progress: data.progress
        }));
      }
    } catch {
      // Keep the generated AI roadmap visible if synced state is unavailable.
    }
  }

  async function startMission(stepId: string) {
    try {
      await api.post(`/api/network/career-roadmap/${encodeURIComponent(stepId)}/start`);
      notify("Mission started. Complete the work, then submit proof.");
      await refreshFromNetwork();
    } catch (error) {
      handleAppError(error, { fallbackMessage: "Unable to start this mission right now." });
    }
  }

  async function submitProof(stepId: string) {
    if (!proofText.trim() && !proofLink.trim()) {
      notify("Add a short proof note or proof link first.");
      return;
    }
    try {
      await api.post(`/api/network/career-roadmap/${encodeURIComponent(stepId)}/submit-proof`, {
        proofText,
        proofLink,
        proofImageUrl: ""
      });
      notify("Proof submitted. Mission completed.");
      setProofText("");
      setProofLink("");
      await refreshFromNetwork();
    } catch (error) {
      handleAppError(error, { fallbackMessage: "Unable to submit proof right now." });
    }
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.topBar, { backgroundColor: colors.background }]}>
        <TouchableOpacity style={styles.topIconBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.topTitle, { color: colors.text }]}>Study Roadmap</Text>
        <View style={styles.topIconBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={[styles.heroCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.eyebrow, { color: colors.accent }]}>Academic Missions</Text>
          <Text style={[styles.heroTitle, { color: colors.text }]}>Create Academic Roadmap</Text>
          <Text style={[styles.heroSubtitle, { color: colors.textMuted }]}>
            Like the After 12 roadmap, but built for school: choose class, subject, chapter, then complete missions with proof.
          </Text>
        </View>

        {statusMessage ? (
          <View style={[styles.notice, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name="sparkles" size={18} color={colors.accent} />
            <Text style={[styles.noticeText, { color: colors.textMuted }]}>{statusMessage}</Text>
          </View>
        ) : null}

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <SectionHeader icon="options" title="Roadmap Context" color={colors.accent} />
          <Text style={[styles.label, { color: colors.text }]}>Class</Text>
          <ChipRow values={CLASS_OPTIONS} selected={classLevel} onSelect={setClassLevel} colors={colors} />

          <Text style={[styles.label, { color: colors.text }]}>Subject {loadingContext ? "(loading...)" : ""}</Text>
          <ChipRow values={subjects.slice(0, 8)} selected={subject} onSelect={setSubject} colors={colors} />

          <Text style={[styles.label, { color: colors.text }]}>Chapter / Topic</Text>
          {chapters.length ? (
            <ChipRow values={chapters.slice(0, 8)} selected={chapter} onSelect={setChapter} colors={colors} />
          ) : (
            <TextInput
              value={chapter}
              onChangeText={setChapter}
              placeholder="Example: Algebra, Life Processes, Grammar"
              placeholderTextColor={colors.textMuted}
              style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}
            />
          )}

          <Text style={[styles.label, { color: colors.text }]}>Goal</Text>
          <TextInput
            value={goal}
            onChangeText={setGoal}
            placeholder="Example: Improve marks and complete weak chapters"
            placeholderTextColor={colors.textMuted}
            style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}
          />

          <Text style={[styles.label, { color: colors.text }]}>Current Level</Text>
          <ChipRow values={["Basics", "Average", "Strong"]} selected={currentLevel} onSelect={setCurrentLevel} colors={colors} />

          <TouchableOpacity disabled={loading} style={[styles.primaryButton, { backgroundColor: colors.accent }]} onPress={createRoadmap}>
            {loading ? <ActivityIndicator color={colors.accentText} /> : <Ionicons name="git-branch" size={18} color={colors.accentText} />}
            <Text style={[styles.primaryButtonText, { color: colors.accentText }]}>{loading ? "Creating Roadmap..." : "Create Academic Roadmap"}</Text>
          </TouchableOpacity>
        </View>

        {roadmap ? (
          <>
            <View style={[styles.heroCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.heroTop}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.eyebrow, { color: colors.accent }]}>AI Roadmap</Text>
                  <Text style={[styles.heroTitle, { color: colors.text }]}>{roadmap.title}</Text>
                  <Text style={[styles.heroSubtitle, { color: colors.textMuted }]}>{roadmap.summary}</Text>
                </View>
                <View style={[styles.progressRing, { borderColor: colors.accentSoft }]}>
                  <Text style={[styles.progressRingText, { color: colors.accent }]}>{percent}%</Text>
                </View>
              </View>
              <ProgressTrack value={percent} />
              <Text style={[styles.cardMeta, { color: colors.textMuted }]}>{completedSteps}/{totalSteps} missions completed</Text>
            </View>

            {activeMission ? (
              <View style={[styles.card, { backgroundColor: isDark ? "rgba(15,118,110,0.12)" : "#ECFDF3", borderColor: "#ABEFC6" }]}>
                <SectionHeader icon="flag" title="Current Mission" color="#0F766E" />
                <Text style={[styles.missionTitle, { color: colors.text }]}>{activeMission.title}</Text>
                <Text style={[styles.cardMeta, { color: colors.textMuted }]}>{activeMission.focus || activeMission.outcome}</Text>
                {(activeMission.tasks || []).map((task) => (
                  <View key={task.id} style={[styles.taskRow, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                    <Ionicons name={task.type.toLowerCase().includes("quiz") ? "help-circle" : "book"} size={17} color={colors.accent} />
                    <Text style={[styles.taskText, { color: colors.text }]}>{task.title}</Text>
                    {task.duration ? <Text style={[styles.taskDuration, { color: colors.textMuted }]}>{task.duration}</Text> : null}
                  </View>
                ))}

                {!activeMission.startedAt ? (
                  <TouchableOpacity style={[styles.primaryButton, { backgroundColor: "#0F766E" }]} onPress={() => startMission(activeMission.id)}>
                    <Ionicons name="play" size={18} color="#FFFFFF" />
                    <Text style={[styles.primaryButtonText, { color: "#FFFFFF" }]}>Start Mission</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={styles.proofBox}>
                    <TextInput
                      value={proofText}
                      onChangeText={setProofText}
                      multiline
                      placeholder="What did you complete? Add a short proof note."
                      placeholderTextColor={colors.textMuted}
                      style={[styles.proofInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
                    />
                    <TextInput
                      value={proofLink}
                      onChangeText={setProofLink}
                      placeholder="Optional proof link"
                      placeholderTextColor={colors.textMuted}
                      style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
                    />
                    <TouchableOpacity style={[styles.primaryButton, { backgroundColor: "#0F766E" }]} onPress={() => submitProof(activeMission.id)}>
                      <Ionicons name="cloud-upload" size={18} color="#FFFFFF" />
                      <Text style={[styles.primaryButtonText, { color: "#FFFFFF" }]}>Submit Proof</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ) : null}

            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <SectionHeader icon="map" title="Mission Timeline" color="#7C3AED" />
              {roadmap.steps.map((step) => <MissionRow key={step.id} step={step} colors={colors} />)}
            </View>

            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <SectionHeader icon="trophy" title="Achievement Prompt" color="#F59E0B" />
              <Text style={[styles.cardMeta, { color: colors.textMuted }]}>
                {roadmap.certificatePrompt || "Complete every mission to unlock a teacher-reviewed achievement prompt."}
              </Text>
            </View>
          </>
        ) : null}

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <SectionHeader icon="school" title="Institution Roadmaps" color="#12B76A" />
          {loadingInstitution ? <ActivityIndicator color={colors.accent} /> : null}
          {!loadingInstitution && !institutionRoadmaps.length ? (
            <Text style={[styles.cardMeta, { color: colors.textMuted }]}>No teacher roadmap assigned yet.</Text>
          ) : null}
          {institutionRoadmaps.slice(0, 3).map((item) => (
            <View key={item.id} style={[styles.institutionBox, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}>
              <Text style={[styles.missionTitle, { color: colors.text }]}>{item.title}</Text>
              <Text style={[styles.cardMeta, { color: colors.textMuted }]}>Teacher: {item.mentor?.name || "Guide"}</Text>
              {item.weeks.slice(0, 3).map((week) => (
                <Text key={week.id} style={[styles.institutionWeek, { color: colors.textMuted }]}>
                  {week.title} - {week.submission?.status || `${week.tasks?.length || 0} tasks`}
                </Text>
              ))}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function SectionHeader({ icon, title, color }: { icon: keyof typeof Ionicons.glyphMap; title: string; color: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Ionicons name={icon} size={18} color={color} />
      <Text style={[styles.sectionHeaderText, { color }]}>{title}</Text>
    </View>
  );
}

function ChipRow({ values, selected, onSelect, colors }: { values: string[]; selected: string; onSelect: (value: string) => void; colors: any }) {
  return (
    <View style={styles.chipWrap}>
      {values.map((value) => {
        const active = selected === value;
        return (
          <TouchableOpacity key={value} style={[styles.chip, { backgroundColor: active ? colors.accentSoft : colors.surfaceAlt, borderColor: active ? colors.accent : colors.border }]} onPress={() => onSelect(value)}>
            <Text style={[styles.chipText, { color: active ? colors.accent : colors.textMuted }]}>{value}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function MissionRow({ step, colors }: { step: RoadmapStep; colors: any }) {
  const done = step.status === "completed" || step.completed;
  const active = step.status === "active";
  const color = done ? "#12B76A" : active ? "#0EA5E9" : "#98A2B3";
  return (
    <View style={[styles.missionRow, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}>
      <View style={[styles.missionNumber, { backgroundColor: `${color}22` }]}>
        <Text style={[styles.missionNumberText, { color }]}>{step.stepNumber}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.missionTitle, { color: colors.text }]}>{step.title}</Text>
        <Text style={[styles.cardMeta, { color: colors.textMuted }]}>{done ? "Completed with proof." : active ? "Active mission. Start and submit proof." : "Locked until previous mission is complete."}</Text>
      </View>
      <View style={[styles.statusPill, { backgroundColor: `${color}22` }]}>
        <Text style={[styles.statusText, { color }]}>{done ? "Done" : active ? "Active" : "Locked"}</Text>
      </View>
    </View>
  );
}

function ProgressTrack({ value, color = "#12B76A" }: { value: number; color?: string }) {
  return (
    <View style={styles.track}>
      <View style={[styles.trackFill, { width: `${Math.max(4, Math.min(100, value))}%`, backgroundColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: { minHeight: 58, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  topIconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  topTitle: { fontSize: 18, fontWeight: "900" },
  container: { padding: 16, paddingBottom: 118, gap: 14 },
  heroCard: { borderWidth: 1, borderRadius: 26, padding: 17, gap: 14 },
  heroTop: { flexDirection: "row", gap: 12, alignItems: "center", justifyContent: "space-between" },
  eyebrow: { fontSize: 11, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.8 },
  heroTitle: { fontSize: 24, lineHeight: 30, fontWeight: "900", marginTop: 4 },
  heroSubtitle: { fontSize: 14, lineHeight: 21, fontWeight: "600", marginTop: 5 },
  notice: { borderWidth: 1, borderRadius: 18, padding: 12, flexDirection: "row", gap: 9, alignItems: "flex-start" },
  noticeText: { flex: 1, fontSize: 12, lineHeight: 18, fontWeight: "800" },
  card: { borderWidth: 1, borderRadius: 24, padding: 16, gap: 14 },
  label: { fontSize: 14, fontWeight: "900", marginTop: 4 },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  chipText: { fontWeight: "900" },
  input: { minHeight: 46, borderWidth: 1, borderRadius: 16, paddingHorizontal: 12, fontWeight: "800" },
  proofInput: { minHeight: 92, borderWidth: 1, borderRadius: 16, padding: 12, fontWeight: "800", textAlignVertical: "top" },
  primaryButton: { minHeight: 50, borderRadius: 999, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8, paddingHorizontal: 16 },
  primaryButtonText: { fontWeight: "900", fontSize: 15 },
  progressRing: { width: 70, height: 70, borderRadius: 35, borderWidth: 8, alignItems: "center", justifyContent: "center" },
  progressRingText: { fontSize: 16, fontWeight: "900" },
  track: { height: 9, borderRadius: 999, overflow: "hidden", backgroundColor: "#E5E7EB" },
  trackFill: { height: "100%", borderRadius: 999 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 7 },
  sectionHeaderText: { fontSize: 16, fontWeight: "900" },
  cardMeta: { lineHeight: 19, fontWeight: "700" },
  missionTitle: { fontSize: 15, fontWeight: "900" },
  missionRow: { borderWidth: 1, borderRadius: 18, padding: 12, flexDirection: "row", alignItems: "center", gap: 10 },
  missionNumber: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  missionNumberText: { fontWeight: "900" },
  statusPill: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 5 },
  statusText: { fontSize: 10, fontWeight: "900", textTransform: "uppercase" },
  taskRow: { minHeight: 48, borderWidth: 1, borderRadius: 14, padding: 10, flexDirection: "row", alignItems: "center", gap: 9 },
  taskText: { flex: 1, fontSize: 13, fontWeight: "900" },
  taskDuration: { fontSize: 11, fontWeight: "800" },
  proofBox: { gap: 10 },
  institutionBox: { borderWidth: 1, borderRadius: 16, padding: 12, gap: 6 },
  institutionWeek: { fontSize: 12, fontWeight: "700", lineHeight: 18 }
});
