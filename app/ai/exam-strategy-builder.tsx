import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { api } from "@/lib/api";
import { getAppErrorMessage } from "@/lib/appError";
import { useAppTheme } from "@/context/ThemeContext";

type StrategyTopic = {
  subject: string;
  topic: string;
  priority: "high" | "medium" | "low";
  weightageMarks: number;
  reason: string;
  tasks: string[];
};

type StrategyResponse = {
  expectedScore: number;
  summary: string;
  priorityCounts: { high: number; medium: number; low: number };
  timeAllocation: { subject: string; percent: number }[];
  highPriorityTopics: StrategyTopic[];
  weeklyPlan: { week: string; title: string; tasks: string[] }[];
  reminders: string[];
};

const SUBJECTS = [
  "Mathematics",
  "Science",
  "English",
  "Social Studies",
  "Telugu",
  "Hindi",
  "Sanskrit",
  "Computer",
  "Physics",
  "Chemistry",
  "Biology"
];

const SUBJECT_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  Mathematics: "calculator",
  Science: "flask",
  English: "book",
  "Social Studies": "globe",
  Telugu: "language",
  Hindi: "language",
  Sanskrit: "library",
  Computer: "desktop",
  Physics: "planet",
  Chemistry: "beaker",
  Biology: "leaf"
};

function priorityColor(priority: string) {
  if (priority === "high") return "#F97316";
  if (priority === "medium") return "#F59E0B";
  return "#12B76A";
}

export default function ExamStrategyBuilderScreen() {
  const { colors, isDark } = useAppTheme();
  const [examName, setExamName] = useState("Half Yearly Exam");
  const [examDate, setExamDate] = useState("25 June 2026");
  const [classLevel, setClassLevel] = useState("Class 10");
  const [syllabus, setSyllabus] = useState("CBSE 2024-25");
  const [selectedSubjects, setSelectedSubjects] = useState(["Mathematics", "Science", "English", "Social Studies"]);
  const [strategy, setStrategy] = useState<StrategyResponse | null>(null);
  const [source, setSource] = useState<"ai" | "fallback">("fallback");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const selectedLabel = useMemo(() => selectedSubjects.join(", "), [selectedSubjects]);

  function toggleSubject(subject: string) {
    setSelectedSubjects((prev) => {
      if (prev.includes(subject)) return prev.filter((item) => item !== subject);
      return [...prev, subject];
    });
  }

  async function buildStrategy() {
    if (!examName.trim()) {
      setError("Please add your exam name.");
      return;
    }
    if (!selectedSubjects.length) {
      setError("Select at least one subject.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      const { data } = await api.post<{ source?: "ai" | "fallback"; strategy?: StrategyResponse }>("/api/ai/highschool/exam-strategy", {
        examName,
        examDate,
        classLevel,
        syllabus,
        subjects: selectedSubjects
      });
      setStrategy(data.strategy || null);
      setSource(data.source === "ai" ? "ai" : "fallback");
    } catch (err) {
      setError(getAppErrorMessage(err, "Unable to build exam strategy. Please try again."));
      setStrategy(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: colors.background }]} showsVerticalScrollIndicator={false}>
      <View style={[styles.hero, { backgroundColor: isDark ? "#2A1B12" : "#FFF7ED", borderColor: isDark ? "rgba(251,146,60,0.35)" : "#FED7AA" }]}>
        <View style={styles.heroTop}>
          <View style={[styles.heroIcon, { backgroundColor: "#FFEDD5" }]}>
            <Ionicons name="locate" size={30} color="#F97316" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.featureTag, { color: "#EA580C" }]}>Feature 3</Text>
            <Text style={[styles.title, { color: colors.text }]}>Exam Strategy Builder</Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>AI creates a marks-focused plan for your upcoming exams.</Text>
          </View>
        </View>
        <View style={styles.benefitRow}>
          {["Personalized strategy", "High weightage topics", "Smart time allocation"].map((item) => (
            <View key={item} style={styles.benefitPill}>
              <Ionicons name="sparkles" size={14} color="#F97316" />
              <Text style={styles.benefitText}>{item}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Choose Your Exam</Text>
        <Text style={[styles.cardMeta, { color: colors.textMuted }]}>Select exam details and subjects. ORIN analyzes syllabus, weightage, and study time.</Text>
        <TextInput style={[styles.input, { backgroundColor: colors.surfaceAlt, borderColor: colors.border, color: colors.text }]} value={examName} onChangeText={setExamName} placeholder="Exam name" placeholderTextColor={colors.textMuted} />
        <View style={styles.twoCol}>
          <TextInput style={[styles.input, styles.flexInput, { backgroundColor: colors.surfaceAlt, borderColor: colors.border, color: colors.text }]} value={examDate} onChangeText={setExamDate} placeholder="Exam date" placeholderTextColor={colors.textMuted} />
          <TextInput style={[styles.input, styles.flexInput, { backgroundColor: colors.surfaceAlt, borderColor: colors.border, color: colors.text }]} value={classLevel} onChangeText={setClassLevel} placeholder="Class" placeholderTextColor={colors.textMuted} />
        </View>
        <TextInput style={[styles.input, { backgroundColor: colors.surfaceAlt, borderColor: colors.border, color: colors.text }]} value={syllabus} onChangeText={setSyllabus} placeholder="Syllabus" placeholderTextColor={colors.textMuted} />
      </View>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>All Subjects Covered</Text>
        <Text style={[styles.cardMeta, { color: colors.textMuted }]}>Selected: {selectedLabel || "None"}</Text>
        <View style={styles.subjectGrid}>
          {SUBJECTS.map((subject) => {
            const active = selectedSubjects.includes(subject);
            return (
              <TouchableOpacity
                key={subject}
                style={[styles.subjectTile, { backgroundColor: active ? "#FFF7ED" : colors.surfaceAlt, borderColor: active ? "#FB923C" : colors.border }]}
                onPress={() => toggleSubject(subject)}
              >
                <View style={[styles.subjectIcon, { backgroundColor: active ? "#FFEDD5" : colors.surface }]}>
                  <Ionicons name={SUBJECT_ICONS[subject] || "book"} size={22} color={active ? "#F97316" : colors.textMuted} />
                </View>
                <Text style={[styles.subjectText, { color: active ? "#9A3412" : colors.text }]}>{subject}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
      <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: "#F97316" }]} onPress={buildStrategy} disabled={loading}>
        {loading ? <ActivityIndicator color="#FFFFFF" /> : <Ionicons name="flash" size={18} color="#FFFFFF" />}
        <Text style={styles.primaryText}>{loading ? "Building Strategy..." : "Generate Exam Strategy"}</Text>
      </TouchableOpacity>

      {strategy ? (
        <>
          <View style={[styles.strategyHero, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.scoreCircle, { borderColor: "#12B76A" }]}>
              <Text style={[styles.scoreText, { color: colors.text }]}>{strategy.expectedScore}%</Text>
              <Text style={[styles.scoreLabel, { color: colors.textMuted }]}>Expected</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>Your Exam Strategy</Text>
              <Text style={[styles.cardMeta, { color: colors.textMuted }]}>{strategy.summary}</Text>
              <Text style={[styles.aiMeta, { color: colors.textMuted }]}>{source === "ai" ? "AI-powered strategy" : "Safe strategy fallback"}</Text>
            </View>
          </View>

          <View style={styles.priorityRow}>
            {[
              ["High", strategy.priorityCounts.high, "#F97316"],
              ["Medium", strategy.priorityCounts.medium, "#F59E0B"],
              ["Low", strategy.priorityCounts.low, "#12B76A"]
            ].map(([label, count, color]) => (
              <View key={String(label)} style={[styles.priorityBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.priorityCount, { color: String(color) }]}>{count}</Text>
                <Text style={[styles.priorityLabel, { color: colors.textMuted }]}>{label} Priority</Text>
              </View>
            ))}
          </View>

          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Time Allocation</Text>
            {strategy.timeAllocation.map((item) => (
              <View key={item.subject} style={styles.allocationRow}>
                <Text style={[styles.allocationName, { color: colors.text }]}>{item.subject}</Text>
                <View style={[styles.track, { backgroundColor: colors.surfaceAlt }]}>
                  <View style={[styles.trackFill, { width: `${Math.min(100, item.percent)}%`, backgroundColor: "#12B76A" }]} />
                </View>
                <Text style={[styles.allocationPercent, { color: colors.textMuted }]}>{item.percent}%</Text>
              </View>
            ))}
          </View>

          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Topic Priorities</Text>
            {strategy.highPriorityTopics.slice(0, 10).map((item) => (
              <View key={`${item.subject}-${item.topic}`} style={[styles.topicRow, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
                <View style={[styles.topicBadge, { backgroundColor: `${priorityColor(item.priority)}22` }]}>
                  <Ionicons name="flag" size={16} color={priorityColor(item.priority)} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.topicTitle, { color: colors.text }]}>{item.topic}</Text>
                  <Text style={[styles.topicMeta, { color: colors.textMuted }]}>{item.subject} · Weightage: {item.weightageMarks} marks</Text>
                  <Text style={[styles.topicReason, { color: colors.textMuted }]}>{item.reason}</Text>
                </View>
              </View>
            ))}
          </View>

          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Weekly Study Plan</Text>
            {strategy.weeklyPlan.map((week) => (
              <View key={week.week} style={[styles.weekCard, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
                <Text style={[styles.weekTitle, { color: colors.text }]}>{week.week} · {week.title}</Text>
                {week.tasks.map((task) => (
                  <Text key={task} style={[styles.weekTask, { color: colors.textMuted }]}>✓ {task}</Text>
                ))}
              </View>
            ))}
          </View>

          <View style={[styles.tipCard, { backgroundColor: "#FFF7ED", borderColor: "#FED7AA" }]}>
            <Ionicons name="trophy" size={22} color="#F97316" />
            <View style={{ flex: 1 }}>
              <Text style={styles.tipTitle}>Plan smart. Prepare better. Score higher.</Text>
              {strategy.reminders.map((item) => (
                <Text key={item} style={styles.tipText}>• {item}</Text>
              ))}
            </View>
          </View>
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 16, paddingBottom: 120, gap: 14 },
  hero: { borderWidth: 1, borderRadius: 28, padding: 18, gap: 16 },
  heroTop: { flexDirection: "row", alignItems: "center", gap: 14 },
  heroIcon: { width: 58, height: 58, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  featureTag: { fontSize: 12, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.8 },
  title: { fontSize: 32, lineHeight: 38, fontWeight: "900", marginTop: 2 },
  subtitle: { fontSize: 14, lineHeight: 21, fontWeight: "700", marginTop: 5 },
  benefitRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  benefitPill: { backgroundColor: "#FFFFFF", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7, flexDirection: "row", gap: 6, alignItems: "center" },
  benefitText: { color: "#7C2D12", fontWeight: "900", fontSize: 11 },
  card: { borderWidth: 1, borderRadius: 22, padding: 16, gap: 12 },
  cardTitle: { fontSize: 18, fontWeight: "900" },
  cardMeta: { lineHeight: 20, fontWeight: "700" },
  input: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, minHeight: 48, fontWeight: "800" },
  twoCol: { flexDirection: "row", gap: 10 },
  flexInput: { flex: 1 },
  subjectGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  subjectTile: { width: "30.5%", minHeight: 92, borderWidth: 1, borderRadius: 18, padding: 9, alignItems: "center", justifyContent: "center", gap: 7 },
  subjectIcon: { width: 40, height: 40, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  subjectText: { textAlign: "center", fontSize: 11, fontWeight: "900" },
  error: { fontWeight: "800" },
  primaryBtn: { minHeight: 54, borderRadius: 999, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 },
  primaryText: { color: "#FFFFFF", fontWeight: "900", fontSize: 16 },
  strategyHero: { borderWidth: 1, borderRadius: 24, padding: 16, flexDirection: "row", gap: 14, alignItems: "center" },
  scoreCircle: { width: 86, height: 86, borderRadius: 43, borderWidth: 8, alignItems: "center", justifyContent: "center" },
  scoreText: { fontSize: 22, fontWeight: "900" },
  scoreLabel: { fontSize: 10, fontWeight: "900" },
  aiMeta: { marginTop: 8, fontSize: 12, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.4 },
  priorityRow: { flexDirection: "row", gap: 10 },
  priorityBox: { flex: 1, borderWidth: 1, borderRadius: 18, padding: 12, alignItems: "center" },
  priorityCount: { fontSize: 24, fontWeight: "900" },
  priorityLabel: { fontSize: 11, fontWeight: "900", marginTop: 2 },
  allocationRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  allocationName: { width: 98, fontWeight: "900", fontSize: 12 },
  track: { flex: 1, height: 9, borderRadius: 999, overflow: "hidden" },
  trackFill: { height: "100%", borderRadius: 999 },
  allocationPercent: { width: 42, textAlign: "right", fontWeight: "900" },
  topicRow: { borderWidth: 1, borderRadius: 16, padding: 12, flexDirection: "row", gap: 10 },
  topicBadge: { width: 34, height: 34, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  topicTitle: { fontWeight: "900", lineHeight: 20 },
  topicMeta: { marginTop: 2, fontSize: 12, fontWeight: "800" },
  topicReason: { marginTop: 4, lineHeight: 18, fontSize: 12, fontWeight: "700" },
  weekCard: { borderWidth: 1, borderRadius: 16, padding: 12, gap: 6 },
  weekTitle: { fontWeight: "900" },
  weekTask: { lineHeight: 19, fontWeight: "700" },
  tipCard: { borderWidth: 1, borderRadius: 22, padding: 14, flexDirection: "row", gap: 10 },
  tipTitle: { color: "#9A3412", fontWeight: "900", marginBottom: 5 },
  tipText: { color: "#7C2D12", lineHeight: 20, fontWeight: "700" }
});
