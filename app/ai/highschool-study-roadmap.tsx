import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { api } from "@/lib/api";
import { getAppErrorMessage } from "@/lib/appError";
import { useAppTheme } from "@/context/ThemeContext";
import { useLearner } from "@/context/LearnerContext";

type SubjectName = "Mathematics" | "Science" | "English";

type RoadmapTask = {
  id: string;
  type: string;
  title: string;
  duration: string;
  completed: boolean;
};

type RoadmapWeek = {
  id: string;
  week: string;
  title: string;
  status: "active" | "locked" | "completed";
  progress: number;
  focus: string;
  tasks: RoadmapTask[];
};

type StudyRoadmap = {
  title: string;
  subject: SubjectName;
  summary: string;
  overallProgress: number;
  activeWeek: RoadmapWeek;
  weeks: RoadmapWeek[];
  dailyTasks: RoadmapTask[];
  progressAnalytics: { label: string; percent: number }[];
  adaptivePlan: {
    newFocus: string;
    reason: string;
    updatedWeeks: RoadmapWeek[];
  };
  reminders: string[];
};

type InstitutionRoadmap = {
  id: string;
  title: string;
  weeks: { id: string; title: string; tasks?: string[]; submission?: { status: string } | null }[];
  mentor?: { name?: string };
};

const SUBJECTS: SubjectName[] = ["Mathematics", "Science", "English"];
const SUBJECT_META: Record<SubjectName, { icon: keyof typeof Ionicons.glyphMap; color: string; bg: string }> = {
  Mathematics: { icon: "calculator", color: "#0EA5E9", bg: "#E0F2FE" },
  Science: { icon: "flask", color: "#12B76A", bg: "#ECFDF3" },
  English: { icon: "book", color: "#F59E0B", bg: "#FEF3C7" }
};

function buildLocalRoadmap(subject: SubjectName): StudyRoadmap {
  const topics: Record<SubjectName, string[]> = {
    Mathematics: ["Numbers & Basics", "Algebra", "Geometry", "Fractions", "Revision Test"],
    Science: ["Matter in Our Surroundings", "Atoms & Molecules", "Life Processes", "Electricity", "Revision Test"],
    English: ["Reading Skills", "Grammar", "Vocabulary", "Writing Skills", "Revision Test"]
  };
  const weeks = topics[subject].map((topic, index) => ({
    id: `week-${index + 1}`,
    week: `Week ${index + 1}`,
    title: topic,
    status: index === 0 ? "active" as const : "locked" as const,
    progress: index === 0 ? 25 : 0,
    focus: index === 0 ? "Start with concept clarity and short practice." : "Unlock after completing the previous week.",
    tasks: [
      { id: `w${index}-read`, type: "Read", title: `Read: ${topic}`, duration: "15 min", completed: index === 0 },
      { id: `w${index}-watch`, type: "Watch", title: "Watch: Explanation Video", duration: "20 min", completed: index === 0 },
      { id: `w${index}-practice`, type: "Practice", title: "Practice: 10 Questions", duration: "15 min", completed: false },
      { id: `w${index}-quiz`, type: "Quiz", title: "Quick Quiz", duration: "10 min", completed: false }
    ]
  }));
  return {
    title: `${subject} Weekly Study Roadmap`,
    subject,
    summary: `A subject-first weekly plan for ${subject}. Finish daily tasks, take quick quizzes, and update weak areas from progress.`,
    overallProgress: 25,
    activeWeek: weeks[0],
    weeks,
    dailyTasks: weeks[0].tasks,
    progressAnalytics: [{ label: subject, percent: 40 }, { label: "Practice", percent: 25 }, { label: "Tests", percent: 15 }],
    adaptivePlan: {
      newFocus: weeks[1].title,
      reason: "Added to improve the next weak area after your active week.",
      updatedWeeks: weeks.map((week, index) => ({ ...week, status: index === 0 ? "completed" : index === 1 ? "active" : week.status }))
    },
    reminders: ["Finish daily tasks before quiz.", "Review wrong answers the same day.", "Retake weak topics every weekend."]
  };
}

function barColor(value: number) {
  if (value < 40) return "#EF4444";
  if (value < 75) return "#F59E0B";
  return "#12B76A";
}

export default function HighSchoolStudyRoadmapScreen() {
  const router = useRouter();
  const { colors, isDark } = useAppTheme();
  const { className } = useLearner();
  const [selectedSubject, setSelectedSubject] = useState<SubjectName>("Science");
  const [studyGoal, setStudyGoal] = useState("Improve marks and complete weekly revision");
  const [currentLevel, setCurrentLevel] = useState("Basics");
  const [timePerDay, setTimePerDay] = useState("1-2 hours");
  const [roadmap, setRoadmap] = useState<StudyRoadmap>(() => buildLocalRoadmap("Science"));
  const [institutionRoadmaps, setInstitutionRoadmaps] = useState<InstitutionRoadmap[]>([]);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [loadingInstitution, setLoadingInstitution] = useState(true);
  const [created, setCreated] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  const taskProgress = useMemo(() => {
    const taskIds = roadmap.dailyTasks.map((task) => task.id);
    const completed = taskIds.filter((id) => checked[id] ?? roadmap.dailyTasks.find((task) => task.id === id)?.completed).length;
    return taskIds.length ? Math.round((completed / taskIds.length) * 100) : 0;
  }, [checked, roadmap.dailyTasks]);

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

  useFocusEffect(useCallback(() => { loadInstitutionRoadmaps(); }, [loadInstitutionRoadmaps]));

  async function createRoadmap() {
    setLoading(true);
    setStatusMessage("");
    const fallback = buildLocalRoadmap(selectedSubject);
    try {
      const { data } = await api.post<{ source?: "ai" | "fallback"; roadmap?: StudyRoadmap }>("/api/ai/highschool/study-roadmap", {
        subject: selectedSubject,
        studyGoal,
        currentLevel,
        timePerDay,
        classLevel: className || "High School"
      });
      setRoadmap(data?.roadmap || fallback);
      setChecked({});
      setCreated(true);
      setStatusMessage(data?.source === "ai" ? "AI generated your adaptive weekly roadmap." : "Using a safe roadmap until AI is available.");
    } catch (error) {
      setRoadmap(fallback);
      setChecked({});
      setCreated(true);
      setStatusMessage(getAppErrorMessage(error, "AI roadmap is unavailable, so ORIN loaded a safe weekly plan."));
    } finally {
      setLoading(false);
    }
  }

  function toggleTask(task: RoadmapTask) {
    setChecked((prev) => ({ ...prev, [task.id]: !(prev[task.id] ?? task.completed) }));
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
        {statusMessage ? (
          <View style={[styles.aiNotice, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name="sparkles" size={18} color={colors.accent} />
            <Text style={[styles.aiNoticeText, { color: colors.textMuted }]}>{statusMessage}</Text>
          </View>
        ) : null}

        {!created ? (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.eyebrow, { color: colors.accent }]}>1. Plan Creation</Text>
            <Text style={[styles.heroTitle, { color: colors.text }]}>Create Study Plan</Text>
            <Text style={[styles.heroSubtitle, { color: colors.textMuted }]}>
              Choose subject, goal, current level, and study time. ORIN creates a smart adaptive weekly roadmap.
            </Text>

            <Text style={[styles.label, { color: colors.text }]}>Subject</Text>
            <View style={styles.selectorGrid}>
              {SUBJECTS.map((subject) => {
                const meta = SUBJECT_META[subject];
                const active = selectedSubject === subject;
                return (
                  <TouchableOpacity
                    key={subject}
                    style={[styles.selectorTile, { backgroundColor: active ? meta.bg : colors.surfaceAlt, borderColor: active ? meta.color : colors.border }]}
                    onPress={() => setSelectedSubject(subject)}
                  >
                    <Ionicons name={meta.icon} size={20} color={active ? meta.color : colors.textMuted} />
                    <Text style={[styles.selectorText, { color: active ? meta.color : colors.text }]}>{subject}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[styles.label, { color: colors.text }]}>Study Goal</Text>
            <ChipRow values={["Improve marks and complete weekly revision", "Prepare for exams", "Build strong basics"]} selected={studyGoal} onSelect={setStudyGoal} colors={colors} />

            <Text style={[styles.label, { color: colors.text }]}>Current Level</Text>
            <SegmentRow values={["Basics", "Average", "Strong"]} selected={currentLevel} onSelect={setCurrentLevel} colors={colors} />

            <Text style={[styles.label, { color: colors.text }]}>Available Time per Day</Text>
            <SegmentRow values={["30-45 min", "1-2 hours", "2+ hours"]} selected={timePerDay} onSelect={setTimePerDay} colors={colors} />

            <TouchableOpacity disabled={loading} style={[styles.primaryButton, { backgroundColor: colors.accent }]} onPress={createRoadmap}>
              {loading ? <ActivityIndicator color={colors.accentText} /> : <Ionicons name="sparkles" size={18} color={colors.accentText} />}
              <Text style={[styles.primaryButtonText, { color: colors.accentText }]}>{loading ? "Creating Smart Plan..." : "Create Study Plan"}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={[styles.heroCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.heroTop}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.eyebrow, { color: colors.accent }]}>2. Smart Plan</Text>
                  <Text style={[styles.heroTitle, { color: colors.text }]}>{roadmap.title}</Text>
                  <Text style={[styles.heroSubtitle, { color: colors.textMuted }]}>{roadmap.summary}</Text>
                </View>
                <View style={[styles.progressRing, { borderColor: colors.accentSoft }]}>
                  <Text style={[styles.progressRingText, { color: colors.accent }]}>{roadmap.overallProgress}%</Text>
                </View>
              </View>
              <ProgressTrack value={roadmap.overallProgress} />
            </View>

            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <SectionHeader icon="calendar" title="Week View" color="#12B76A" />
              {roadmap.weeks.map((week) => <WeekRow key={week.id} week={week} colors={colors} />)}
            </View>

            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <SectionHeader icon="checkbox" title="Daily Tasks" color="#0EA5E9" />
              <Text style={[styles.cardMeta, { color: colors.textMuted }]}>Today progress: {taskProgress}%</Text>
              {roadmap.dailyTasks.map((task) => (
                <TaskRow key={task.id} task={task} checked={checked[task.id] ?? task.completed} onPress={() => toggleTask(task)} colors={colors} />
              ))}
            </View>

            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <SectionHeader icon="stats-chart" title="Progress & Analytics" color="#F59E0B" />
              {roadmap.progressAnalytics.map((item) => <MetricRow key={item.label} label={item.label} value={item.percent} />)}
              <View style={[styles.streakCard, { backgroundColor: isDark ? "rgba(245,158,11,0.12)" : "#FFFBEB" }]}>
                <Ionicons name="flame" size={22} color="#F59E0B" />
                <Text style={[styles.streakText, { color: colors.text }]}>7 Days study streak</Text>
              </View>
            </View>

            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <SectionHeader icon="git-branch" title="Adaptive Plan" color="#7C3AED" />
              <View style={[styles.adaptiveFocus, { backgroundColor: isDark ? "rgba(18,183,106,0.12)" : "#ECFDF3" }]}>
                <Text style={[styles.adaptiveLabel, { color: colors.textMuted }]}>New Focus</Text>
                <Text style={[styles.adaptiveTitle, { color: colors.text }]}>{roadmap.adaptivePlan.newFocus}</Text>
                <Text style={[styles.adaptiveText, { color: colors.textMuted }]}>{roadmap.adaptivePlan.reason}</Text>
              </View>
              {roadmap.adaptivePlan.updatedWeeks.slice(0, 4).map((week) => <WeekRow key={`adaptive-${week.id}`} week={week} colors={colors} />)}
            </View>

            <TouchableOpacity style={[styles.secondaryButton, { borderColor: colors.border }]} onPress={() => setCreated(false)}>
              <Text style={[styles.secondaryButtonText, { color: colors.text }]}>Create Another Roadmap</Text>
            </TouchableOpacity>
          </>
        )}

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <SectionHeader icon="school" title="Institution Roadmaps" color="#12B76A" />
          {loadingInstitution ? <ActivityIndicator color={colors.accent} /> : null}
          {!loadingInstitution && !institutionRoadmaps.length ? (
            <Text style={[styles.cardMeta, { color: colors.textMuted }]}>No teacher roadmap assigned yet.</Text>
          ) : null}
          {institutionRoadmaps.slice(0, 2).map((item) => (
            <View key={item.id} style={[styles.institutionBox, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}>
              <Text style={[styles.weekTitle, { color: colors.text }]}>{item.title}</Text>
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

function SegmentRow({ values, selected, onSelect, colors }: { values: string[]; selected: string; onSelect: (value: string) => void; colors: any }) {
  return (
    <View style={styles.segmentRow}>
      {values.map((value) => {
        const active = selected === value;
        return (
          <TouchableOpacity key={value} style={[styles.segmentButton, { backgroundColor: active ? colors.accent : colors.surfaceAlt, borderColor: active ? colors.accent : colors.border }]} onPress={() => onSelect(value)}>
            <Text style={[styles.segmentText, { color: active ? colors.accentText : colors.textMuted }]}>{value}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function WeekRow({ week, colors }: { week: RoadmapWeek; colors: any }) {
  const statusColor = week.status === "completed" ? "#12B76A" : week.status === "active" ? "#0EA5E9" : "#98A2B3";
  return (
    <View style={[styles.weekRow, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}>
      <View style={styles.weekTop}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.weekLabel, { color: colors.textMuted }]}>{week.week}</Text>
          <Text style={[styles.weekTitle, { color: colors.text }]}>{week.title}</Text>
          <Text style={[styles.weekFocus, { color: colors.textMuted }]}>{week.focus}</Text>
        </View>
        <View style={[styles.statusPill, { backgroundColor: `${statusColor}22` }]}>
          <Text style={[styles.statusText, { color: statusColor }]}>{week.status}</Text>
        </View>
      </View>
      <ProgressTrack value={week.progress} color={statusColor} />
    </View>
  );
}

function TaskRow({ task, checked, onPress, colors }: { task: RoadmapTask; checked: boolean; onPress: () => void; colors: any }) {
  const icon = (task.type.toLowerCase().includes("quiz") ? "help-circle" : task.type.toLowerCase().includes("watch") ? "play-circle" : task.type.toLowerCase().includes("practice") ? "create" : "book") as keyof typeof Ionicons.glyphMap;
  return (
    <TouchableOpacity style={[styles.taskRow, { borderColor: colors.border }]} onPress={onPress}>
      <View style={[styles.taskIcon, { backgroundColor: checked ? "#DCFCE7" : colors.surfaceAlt }]}>
        <Ionicons name={checked ? "checkmark-circle" : icon} size={18} color={checked ? "#12B76A" : colors.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.taskTitle, { color: colors.text }]}>{task.title}</Text>
        <Text style={[styles.taskMeta, { color: colors.textMuted }]}>{task.duration}</Text>
      </View>
      <Ionicons name={checked ? "checkmark-circle" : "ellipse-outline"} size={20} color={checked ? "#12B76A" : colors.textMuted} />
    </TouchableOpacity>
  );
}

function MetricRow({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.metricRow}>
      <View style={styles.metricTop}>
        <Text style={styles.metricLabel}>{label}</Text>
        <Text style={[styles.metricValue, { color: barColor(value) }]}>{value}%</Text>
      </View>
      <ProgressTrack value={value} color={barColor(value)} />
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
  aiNotice: { borderWidth: 1, borderRadius: 18, padding: 12, flexDirection: "row", gap: 9, alignItems: "flex-start" },
  aiNoticeText: { flex: 1, fontSize: 12, lineHeight: 18, fontWeight: "800" },
  card: { borderWidth: 1, borderRadius: 24, padding: 16, gap: 14 },
  heroCard: { borderWidth: 1, borderRadius: 26, padding: 17, gap: 14 },
  heroTop: { flexDirection: "row", gap: 12, alignItems: "center", justifyContent: "space-between" },
  eyebrow: { fontSize: 11, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.8 },
  heroTitle: { fontSize: 24, lineHeight: 30, fontWeight: "900", marginTop: 4 },
  heroSubtitle: { fontSize: 14, lineHeight: 21, fontWeight: "600", marginTop: 5 },
  label: { fontSize: 14, fontWeight: "900", marginTop: 4 },
  selectorGrid: { flexDirection: "row", gap: 10 },
  selectorTile: { flex: 1, minHeight: 82, borderWidth: 1, borderRadius: 18, alignItems: "center", justifyContent: "center", gap: 7, padding: 10 },
  selectorText: { fontWeight: "900", fontSize: 12, textAlign: "center" },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  chipText: { fontWeight: "900" },
  segmentRow: { flexDirection: "row", gap: 8 },
  segmentButton: { flex: 1, minHeight: 42, borderWidth: 1, borderRadius: 999, alignItems: "center", justifyContent: "center", paddingHorizontal: 8 },
  segmentText: { fontWeight: "900", fontSize: 12, textAlign: "center" },
  primaryButton: { minHeight: 50, borderRadius: 999, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8, paddingHorizontal: 16 },
  primaryButtonText: { fontWeight: "900", fontSize: 15 },
  secondaryButton: { minHeight: 46, borderRadius: 999, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  secondaryButtonText: { fontWeight: "900" },
  progressRing: { width: 70, height: 70, borderRadius: 35, borderWidth: 8, alignItems: "center", justifyContent: "center" },
  progressRingText: { fontSize: 16, fontWeight: "900" },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 7 },
  sectionHeaderText: { fontSize: 16, fontWeight: "900" },
  cardMeta: { lineHeight: 19, fontWeight: "700" },
  weekRow: { borderWidth: 1, borderRadius: 16, padding: 12, gap: 9 },
  weekTop: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  weekLabel: { fontSize: 11, fontWeight: "900" },
  weekTitle: { fontSize: 14, fontWeight: "900", marginTop: 2 },
  weekFocus: { fontSize: 12, lineHeight: 17, fontWeight: "700", marginTop: 3 },
  statusPill: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 5 },
  statusText: { fontSize: 10, fontWeight: "900", textTransform: "capitalize" },
  taskRow: { minHeight: 56, borderWidth: 1, borderRadius: 16, padding: 10, flexDirection: "row", alignItems: "center", gap: 10 },
  taskIcon: { width: 34, height: 34, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  taskTitle: { fontSize: 13, fontWeight: "900" },
  taskMeta: { fontSize: 11, fontWeight: "700", marginTop: 2 },
  track: { height: 9, borderRadius: 999, overflow: "hidden", backgroundColor: "#E5E7EB" },
  trackFill: { height: "100%", borderRadius: 999 },
  metricRow: { gap: 6 },
  metricTop: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  metricLabel: { color: "#0F172A", fontWeight: "900" },
  metricValue: { fontWeight: "900" },
  streakCard: { borderRadius: 16, padding: 12, flexDirection: "row", alignItems: "center", gap: 10 },
  streakText: { fontWeight: "900" },
  adaptiveFocus: { borderRadius: 18, padding: 13, gap: 4 },
  adaptiveLabel: { fontSize: 11, fontWeight: "900", textTransform: "uppercase" },
  adaptiveTitle: { fontSize: 17, fontWeight: "900" },
  adaptiveText: { fontWeight: "700", lineHeight: 19 },
  institutionBox: { borderWidth: 1, borderRadius: 16, padding: 12, gap: 6 },
  institutionWeek: { fontSize: 12, fontWeight: "700", lineHeight: 18 }
});
