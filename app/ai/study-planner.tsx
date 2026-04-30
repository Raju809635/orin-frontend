import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { api } from "@/lib/api";
import { getAppErrorMessage } from "@/lib/appError";
import { useAppTheme } from "@/context/ThemeContext";

type PlannerStep = {
  id?: string;
  stepNumber: number;
  title: string;
  completed?: boolean;
  status?: string;
};

type PlannerResponse = {
  goal: string;
  steps: PlannerStep[];
  progress?: {
    progressPercent?: number;
  };
};

const SUBJECTS = ["Maths", "Science", "English", "Social Studies", "Computer Science", "Exam Prep"];

export default function HighSchoolStudyPlannerScreen() {
  const { colors, isDark } = useAppTheme();
  const [subject, setSubject] = useState("Science");
  const [goal, setGoal] = useState("Improve marks and complete weekly revision");
  const [skills, setSkills] = useState("basics, revision, practice tests");
  const [data, setData] = useState<PlannerResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const normalizedGoal = useMemo(() => `${subject}: ${goal.trim()}`, [goal, subject]);

  async function generatePlan() {
    if (!goal.trim()) {
      setError("Please add your study goal.");
      return;
    }
    if (!skills.split(",").map((item) => item.trim()).filter(Boolean).length) {
      setError("Please add your current skills or subjects.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      const { data: response } = await api.get<PlannerResponse>("/api/network/career-roadmap", {
        params: {
          primaryCategory: "Academic",
          subCategory: subject,
          focus: "Study Planning",
          goal: normalizedGoal,
          skills
        }
      });
      setData(response || null);
    } catch (err) {
      setError(getAppErrorMessage(err, "Unable to create study plan. Please try again."));
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.text }]}>Study Planner</Text>
      <Text style={[styles.subtitle, { color: colors.textMuted }]}>Build a simple weekly study path from your subject, goal, and current skills.</Text>

      <Text style={[styles.label, { color: colors.text }]}>Subject</Text>
      <View style={styles.subjectRow}>
        {SUBJECTS.map((item) => {
          const active = item === subject;
          return (
            <TouchableOpacity
              key={item}
              style={[styles.subjectChip, { borderColor: active ? colors.accent : colors.border, backgroundColor: active ? colors.accentSoft : colors.surface }]}
              onPress={() => setSubject(item)}
            >
              <Text style={[styles.subjectText, { color: active ? colors.accent : colors.textMuted }]}>{item}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

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

      {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}

      <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: colors.accent }]} onPress={generatePlan} disabled={loading}>
        {loading ? <ActivityIndicator color={colors.accentText} /> : <Ionicons name="calendar" size={18} color={colors.accentText} />}
        <Text style={[styles.primaryText, { color: colors.accentText }]}>{loading ? "Creating..." : "Create Study Plan"}</Text>
      </TouchableOpacity>

      {data ? (
        <View style={[styles.planCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.planTitle, { color: colors.text }]}>{data.goal || normalizedGoal}</Text>
          <Text style={[styles.planMeta, { color: colors.textMuted }]}>Progress: {data.progress?.progressPercent || 0}%</Text>
          <View style={styles.stepList}>
            {(data.steps || []).map((step) => (
              <View key={step.id || `${step.stepNumber}-${step.title}`} style={[styles.stepRow, { backgroundColor: isDark ? colors.surfaceAlt : "#F8FAFC", borderColor: colors.border }]}>
                <View style={[styles.stepNumber, { backgroundColor: colors.accentSoft }]}>
                  <Text style={[styles.stepNumberText, { color: colors.accent }]}>{step.stepNumber}</Text>
                </View>
                <View style={styles.stepBody}>
                  <Text style={[styles.stepTitle, { color: colors.text }]}>{step.title}</Text>
                  <Text style={[styles.stepMeta, { color: colors.textMuted }]}>{step.status || (step.completed ? "completed" : "next")}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 20, paddingBottom: 120 },
  title: { fontSize: 30, fontWeight: "900", marginBottom: 6 },
  subtitle: { fontSize: 15, lineHeight: 22, marginBottom: 18 },
  label: { fontSize: 14, fontWeight: "900", marginBottom: 8 },
  subjectRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  subjectChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  subjectText: { fontWeight: "800" },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11, marginBottom: 14 },
  multiInput: { minHeight: 86, textAlignVertical: "top" },
  error: { fontWeight: "700", marginBottom: 10 },
  primaryBtn: { minHeight: 50, borderRadius: 14, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 },
  primaryText: { fontWeight: "900", fontSize: 16 },
  planCard: { borderWidth: 1, borderRadius: 16, padding: 16, marginTop: 18 },
  planTitle: { fontSize: 20, fontWeight: "900", lineHeight: 27 },
  planMeta: { marginTop: 6, fontWeight: "700" },
  stepList: { gap: 10, marginTop: 14 },
  stepRow: { borderWidth: 1, borderRadius: 14, padding: 12, flexDirection: "row", gap: 10 },
  stepNumber: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  stepNumberText: { fontWeight: "900" },
  stepBody: { flex: 1 },
  stepTitle: { fontWeight: "900", lineHeight: 21 },
  stepMeta: { marginTop: 4, textTransform: "capitalize" }
});
