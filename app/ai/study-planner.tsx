import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { api } from "@/lib/api";
import { getAppErrorMessage } from "@/lib/appError";
import { useAppTheme } from "@/context/ThemeContext";
import { useLearner } from "@/context/LearnerContext";

type PlanTask = {
  id: string;
  type: string;
  title: string;
  duration: string;
  completed: boolean;
};

type PlanWeek = {
  id: string;
  week: string;
  title: string;
  status: "active" | "locked" | "completed";
  progress: number;
  focus: string;
  tasks: PlanTask[];
};

type StudyPlan = {
  title: string;
  subject: string;
  goal: string;
  summary: string;
  overallProgress: number;
  weeks: PlanWeek[];
  dailyTasks: PlanTask[];
  analytics: { label: string; percent: number }[];
  adaptivePlan: {
    newFocus: string;
    reason: string;
    updatedWeeks: PlanWeek[];
  };
  reminders: string[];
};

type AcademicSubject = { name?: string; subject?: string; key?: string; slug?: string };
type AcademicChapter = { title?: string; name?: string };
type AcademicSubjectResponse = { subject?: { chapters?: AcademicChapter[] }; chapters?: AcademicChapter[] };

const CLASS_OPTIONS = ["6", "7", "8", "9", "10", "11", "12"];
const SUBJECTS = ["Mathematics", "Science", "Social Science", "English", "Telugu", "Hindi", "Computer"];
const LEVELS = ["Basics", "Average", "Strong"];
const TIMES = ["30-45 min", "1-2 hours", "2+ hours"];

function subjectLabel(item: AcademicSubject | string) {
  if (typeof item === "string") return item;
  return String(item.name || item.subject || item.key || item.slug || "").trim();
}

function buildLocalPlan(subject: string, goal: string, skills: string): StudyPlan {
  const chapters = skills.split(",").map((item) => item.trim()).filter(Boolean);
  const topics = [chapters[0] || "Basics", chapters[1] || "Revision", chapters[2] || "Practice Tests", "Weak Area Repair", "Mock Test"];
  const weeks = topics.map((topic, index) => ({
    id: `week-${index + 1}`,
    week: `Week ${index + 1}`,
    title: topic,
    status: index === 0 ? "active" as const : "locked" as const,
    progress: index === 0 ? 25 : 0,
    focus: index === 0 ? "Start with short revision and a quick practice check." : "Unlock after completing the previous week.",
    tasks: [
      { id: `w${index + 1}-read`, type: "Read", title: `Read: ${topic}`, duration: "15 min", completed: index === 0 },
      { id: `w${index + 1}-practice`, type: "Practice", title: "Practice: 10 Questions", duration: "15 min", completed: false },
      { id: `w${index + 1}-quiz`, type: "Quiz", title: "Quick Quiz", duration: "10 min", completed: false }
    ]
  }));
  return {
    title: `${subject} Study Plan`,
    subject,
    goal,
    summary: `A weekly plan for ${subject}: ${goal}. ORIN starts from your current chapters and updates the next focus using progress.`,
    overallProgress: 25,
    weeks,
    dailyTasks: weeks[0].tasks,
    analytics: [{ label: "Revision", percent: 35 }, { label: "Practice", percent: 25 }, { label: "Tests", percent: 15 }],
    adaptivePlan: {
      newFocus: weeks[1].title,
      reason: "Added to improve the next weak area after your first week.",
      updatedWeeks: weeks.map((week, index) => ({ ...week, status: index === 0 ? "completed" : index === 1 ? "active" : week.status }))
    },
    reminders: ["Complete daily tasks first.", "Take one quiz after revision.", "Review wrong answers before moving ahead."]
  };
}

function barColor(value: number) {
  if (value < 40) return "#EF4444";
  if (value < 75) return "#F59E0B";
  return "#12B76A";
}

export default function HighSchoolStudyPlannerScreen() {
  const { colors, isDark } = useAppTheme();
  const { className } = useLearner();
  const [board] = useState("CBSE");
  const [classLevel, setClassLevel] = useState(className || "10");
  const [subjects, setSubjects] = useState<string[]>(SUBJECTS);
  const [chapters, setChapters] = useState<string[]>([]);
  const [subject, setSubject] = useState("Science");
  const [goal, setGoal] = useState("Improve marks and complete weekly revision");
  const [skills, setSkills] = useState("basics, revision, practice tests");
  const [currentLevel, setCurrentLevel] = useState("Basics");
  const [timePerDay, setTimePerDay] = useState("1-2 hours");
  const [plan, setPlan] = useState<StudyPlan | null>(null);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");

  const taskProgress = useMemo(() => {
    const tasks = plan?.dailyTasks || [];
    const completed = tasks.filter((task) => checked[task.id] ?? task.completed).length;
    return tasks.length ? Math.round((completed / tasks.length) * 100) : 0;
  }, [checked, plan?.dailyTasks]);

  const loadSubjects = useCallback(async () => {
    try {
      const { data } = await api.get<{ subjects?: (AcademicSubject | string)[] }>(`/api/academics/${board}/class/${classLevel}/subjects`);
      const next = (data?.subjects || []).map(subjectLabel).filter(Boolean);
      if (next.length) {
        setSubjects(next);
        if (!next.includes(subject)) setSubject(next[0]);
      }
    } catch {
      setSubjects(SUBJECTS);
    }
  }, [board, classLevel, subject]);

  const loadChapters = useCallback(async () => {
    try {
      const { data } = await api.get<AcademicSubjectResponse>(`/api/academics/${board}/class/${classLevel}/subject/${encodeURIComponent(subject)}`);
      const next = (data?.subject?.chapters || data?.chapters || [])
        .map((item) => String(item.title || item.name || "").trim())
        .filter(Boolean)
        .slice(0, 10);
      setChapters(next);
      if (next.length && skills === "basics, revision, practice tests") setSkills(next.slice(0, 3).join(", "));
    } catch {
      setChapters([]);
    }
  }, [board, classLevel, skills, subject]);

  useFocusEffect(useCallback(() => { loadSubjects(); }, [loadSubjects]));
  useFocusEffect(useCallback(() => { loadChapters(); }, [loadChapters]));

  async function generatePlan() {
    if (!goal.trim()) {
      setError("Please add your study goal.");
      return;
    }
    if (!skills.split(",").map((item) => item.trim()).filter(Boolean).length) {
      setError("Please add your current skills or chapters.");
      return;
    }

    setLoading(true);
    setError("");
    setStatusMessage("");
    const fallback = buildLocalPlan(subject, goal, skills);
    try {
      const { data } = await api.post<{ source?: "ai" | "fallback"; plan?: StudyPlan }>("/api/ai/highschool/study-planner", {
        subject,
        goal,
        skills,
        currentLevel,
        timePerDay,
        classLevel
      });
      setPlan(data?.plan || fallback);
      setChecked({});
      setStatusMessage(data?.source === "ai" ? "AI created this adaptive study plan." : "Using a safe study plan until AI is available.");
    } catch (err) {
      setPlan(fallback);
      setChecked({});
      setStatusMessage(getAppErrorMessage(err, "AI planner is unavailable, so ORIN loaded a safe study plan."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: colors.background }]} showsVerticalScrollIndicator={false}>
      <View style={[styles.heroCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.eyebrow, { color: colors.accent }]}>AI Study Planner</Text>
        <Text style={[styles.title, { color: colors.text }]}>Create Study Plan</Text>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>
          Build a weekly timetable from class, subject, chapters, level, and available time.
        </Text>
      </View>

      {statusMessage ? (
        <View style={[styles.aiNotice, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="sparkles" size={18} color={colors.accent} />
          <Text style={[styles.aiNoticeText, { color: colors.textMuted }]}>{statusMessage}</Text>
        </View>
      ) : null}

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.label, { color: colors.text }]}>Class</Text>
        <View style={styles.subjectRow}>
          {CLASS_OPTIONS.map((item) => {
            const active = item === classLevel;
            return (
              <TouchableOpacity key={item} style={[styles.subjectChip, { borderColor: active ? colors.accent : colors.border, backgroundColor: active ? colors.accentSoft : colors.surfaceAlt }]} onPress={() => setClassLevel(item)}>
                <Text style={[styles.subjectText, { color: active ? colors.accent : colors.textMuted }]}>Class {item}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={[styles.label, { color: colors.text }]}>Subject</Text>
        <View style={styles.subjectRow}>
          {subjects.slice(0, 8).map((item) => {
            const active = item === subject;
            return (
              <TouchableOpacity
                key={item}
                style={[styles.subjectChip, { borderColor: active ? colors.accent : colors.border, backgroundColor: active ? colors.accentSoft : colors.surfaceAlt }]}
                onPress={() => setSubject(item)}
              >
                <Text style={[styles.subjectText, { color: active ? colors.accent : colors.textMuted }]}>{item}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {chapters.length ? (
          <>
            <Text style={[styles.label, { color: colors.text }]}>Quick Chapter Focus</Text>
            <View style={styles.subjectRow}>
              {chapters.slice(0, 6).map((item) => (
                <TouchableOpacity key={item} style={[styles.subjectChip, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }]} onPress={() => setSkills(item)}>
                  <Text style={[styles.subjectText, { color: colors.textMuted }]}>{item}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        ) : null}

        <Text style={[styles.label, { color: colors.text }]}>Study Goal</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.surfaceAlt, borderColor: colors.border, color: colors.text }]}
          placeholder="Example: prepare for board exam science chapters"
          placeholderTextColor={colors.textMuted}
          value={goal}
          onChangeText={setGoal}
        />

        <Text style={[styles.label, { color: colors.text }]}>Current Skills / Chapters</Text>
        <TextInput
          style={[styles.input, styles.multiInput, { backgroundColor: colors.surfaceAlt, borderColor: colors.border, color: colors.text }]}
          placeholder="Example: algebra basics, electricity chapter, reading notes"
          placeholderTextColor={colors.textMuted}
          value={skills}
          onChangeText={setSkills}
          multiline
        />

        <Text style={[styles.label, { color: colors.text }]}>Current Level</Text>
        <SegmentRow values={LEVELS} selected={currentLevel} onSelect={setCurrentLevel} colors={colors} />

        <Text style={[styles.label, { color: colors.text }]}>Available Time per Day</Text>
        <SegmentRow values={TIMES} selected={timePerDay} onSelect={setTimePerDay} colors={colors} />

        {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}

        <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: colors.accent }]} onPress={generatePlan} disabled={loading}>
          {loading ? <ActivityIndicator color={colors.accentText} /> : <Ionicons name="calendar" size={18} color={colors.accentText} />}
          <Text style={[styles.primaryText, { color: colors.accentText }]}>{loading ? "Creating Smart Plan..." : "Create Study Plan"}</Text>
        </TouchableOpacity>
      </View>

      {plan ? (
        <>
          <View style={[styles.planCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.planTop}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.eyebrow, { color: colors.accent }]}>Smart Plan</Text>
                <Text style={[styles.planTitle, { color: colors.text }]}>{plan.title}</Text>
                <Text style={[styles.planMeta, { color: colors.textMuted }]}>{plan.summary}</Text>
              </View>
              <View style={[styles.progressRing, { borderColor: colors.accentSoft }]}>
                <Text style={[styles.progressRingText, { color: colors.accent }]}>{plan.overallProgress}%</Text>
              </View>
            </View>
            <ProgressTrack value={plan.overallProgress} color={colors.accent} />
          </View>

          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <SectionHeader icon="calendar" title="Week View" color="#12B76A" />
            {plan.weeks.map((week) => <WeekRow key={week.id} week={week} colors={colors} />)}
          </View>

          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <SectionHeader icon="checkbox" title="Daily Tasks" color="#0EA5E9" />
            <Text style={[styles.planMeta, { color: colors.textMuted }]}>Today progress: {taskProgress}%</Text>
            {plan.dailyTasks.map((task) => (
              <TaskRow key={task.id} task={task} checked={checked[task.id] ?? task.completed} onPress={() => setChecked((prev) => ({ ...prev, [task.id]: !(prev[task.id] ?? task.completed) }))} colors={colors} />
            ))}
          </View>

          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <SectionHeader icon="stats-chart" title="Progress & Analytics" color="#F59E0B" />
            {plan.analytics.map((item) => <MetricRow key={item.label} label={item.label} value={item.percent} />)}
            <View style={[styles.streakCard, { backgroundColor: isDark ? "rgba(245,158,11,0.12)" : "#FFFBEB" }]}>
              <Ionicons name="flame" size={22} color="#F59E0B" />
              <Text style={[styles.streakText, { color: colors.text }]}>7 Days study streak</Text>
            </View>
          </View>

          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <SectionHeader icon="git-branch" title="Adaptive Plan" color="#7C3AED" />
            <View style={[styles.adaptiveFocus, { backgroundColor: isDark ? "rgba(18,183,106,0.12)" : "#ECFDF3" }]}>
              <Text style={[styles.adaptiveLabel, { color: colors.textMuted }]}>New Focus</Text>
              <Text style={[styles.adaptiveTitle, { color: colors.text }]}>{plan.adaptivePlan.newFocus}</Text>
              <Text style={[styles.adaptiveText, { color: colors.textMuted }]}>{plan.adaptivePlan.reason}</Text>
            </View>
            {plan.adaptivePlan.updatedWeeks.slice(0, 4).map((week) => <WeekRow key={`adaptive-${week.id}`} week={week} colors={colors} />)}
          </View>
        </>
      ) : null}
    </ScrollView>
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

function SectionHeader({ icon, title, color }: { icon: keyof typeof Ionicons.glyphMap; title: string; color: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Ionicons name={icon} size={18} color={color} />
      <Text style={[styles.sectionHeaderText, { color }]}>{title}</Text>
    </View>
  );
}

function WeekRow({ week, colors }: { week: PlanWeek; colors: any }) {
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

function TaskRow({ task, checked, onPress, colors }: { task: PlanTask; checked: boolean; onPress: () => void; colors: any }) {
  const icon = (task.type.toLowerCase().includes("quiz") ? "help-circle" : task.type.toLowerCase().includes("practice") ? "create" : "book") as keyof typeof Ionicons.glyphMap;
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
  container: { flexGrow: 1, padding: 16, paddingBottom: 120, gap: 14 },
  heroCard: { borderWidth: 1, borderRadius: 26, padding: 18, gap: 8 },
  eyebrow: { fontSize: 11, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.8 },
  title: { fontSize: 30, fontWeight: "900" },
  subtitle: { fontSize: 15, lineHeight: 22 },
  aiNotice: { borderWidth: 1, borderRadius: 18, padding: 12, flexDirection: "row", gap: 9, alignItems: "flex-start" },
  aiNoticeText: { flex: 1, fontSize: 12, lineHeight: 18, fontWeight: "800" },
  card: { borderWidth: 1, borderRadius: 22, padding: 15, gap: 13 },
  label: { fontSize: 14, fontWeight: "900" },
  subjectRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  subjectChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  subjectText: { fontWeight: "800" },
  input: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 11 },
  multiInput: { minHeight: 86, textAlignVertical: "top" },
  segmentRow: { flexDirection: "row", gap: 8 },
  segmentButton: { flex: 1, minHeight: 42, borderWidth: 1, borderRadius: 999, alignItems: "center", justifyContent: "center", paddingHorizontal: 8 },
  segmentText: { fontWeight: "900", fontSize: 12, textAlign: "center" },
  error: { fontWeight: "700" },
  primaryBtn: { minHeight: 50, borderRadius: 999, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 },
  primaryText: { fontWeight: "900", fontSize: 16 },
  planCard: { borderWidth: 1, borderRadius: 24, padding: 16, gap: 14 },
  planTop: { flexDirection: "row", gap: 12, alignItems: "center", justifyContent: "space-between" },
  planTitle: { fontSize: 22, fontWeight: "900", lineHeight: 28 },
  planMeta: { lineHeight: 20, fontWeight: "700" },
  progressRing: { width: 70, height: 70, borderRadius: 35, borderWidth: 8, alignItems: "center", justifyContent: "center" },
  progressRingText: { fontSize: 16, fontWeight: "900" },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 7 },
  sectionHeaderText: { fontSize: 16, fontWeight: "900" },
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
  adaptiveText: { fontWeight: "700", lineHeight: 19 }
});
