import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { api } from "@/lib/api";
import { getAppErrorMessage } from "@/lib/appError";
import { useAppTheme } from "@/context/ThemeContext";

type PlannerStep = {
  id?: string;
  stepNumber: number;
  title: string;
};

type RoadmapResponse = {
  goal: string;
  steps: PlannerStep[];
};

type InstitutionRoadmap = {
  id: string;
  title: string;
  weeks: { id: string; title: string; tasks?: string[]; submission?: { status: string } | null }[];
  mentor?: { name?: string };
};

export default function HighSchoolStudyRoadmapScreen() {
  const { colors } = useAppTheme();
  const [roadmap, setRoadmap] = useState<RoadmapResponse | null>(null);
  const [institutionRoadmaps, setInstitutionRoadmaps] = useState<InstitutionRoadmap[]>([]);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [aiRes, institutionRes] = await Promise.allSettled([
        api.get<RoadmapResponse>("/api/network/career-roadmap", {
          params: {
            primaryCategory: "Academic",
            subCategory: "High School",
            focus: "Study Roadmap",
            goal: "Academic improvement plan",
            skills: "revision, attendance, note making"
          }
        }),
        api.get<{ roadmaps: InstitutionRoadmap[] }>("/api/network/institution-roadmaps")
      ]);
      setRoadmap(aiRes.status === "fulfilled" ? aiRes.value.data || null : null);
      setInstitutionRoadmaps(institutionRes.status === "fulfilled" ? institutionRes.value.data?.roadmaps || [] : []);
    } catch (e) {
      setError(getAppErrorMessage(e, "Unable to load study roadmap."));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const progress = useMemo(() => {
    const values = Object.values(checked);
    if (!values.length) return 0;
    return Math.round((values.filter(Boolean).length / values.length) * 100);
  }, [checked]);

  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.text }]}>Study Roadmap</Text>
      <Text style={[styles.subtitle, { color: colors.textMuted }]}>
        Follow weekly AI and institution study tasks, tick daily actions, and track progress.
      </Text>
      {loading ? <ActivityIndicator color={colors.accent} style={{ marginVertical: 14 }} /> : null}
      {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}

      {roadmap ? (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>AI Roadmap</Text>
          <Text style={[styles.cardMeta, { color: colors.textMuted }]}>Goal: {roadmap.goal}</Text>
          <Text style={[styles.cardMeta, { color: colors.textMuted }]}>Progress: {progress}% · Build streaks by ticking completed tasks.</Text>
          {(roadmap.steps || []).slice(0, 5).map((step) => {
            const key = `ai-${step.id || step.stepNumber}`;
            return (
              <TouchableOpacity key={key} style={[styles.stepRow, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]} onPress={() => setChecked((prev) => ({ ...prev, [key]: !prev[key] }))}>
                <Text style={[styles.stepCheck, { color: checked[key] ? colors.accent : colors.textMuted }]}>{checked[key] ? "✓" : "○"}</Text>
                <Text style={[styles.stepText, { color: colors.text }]}>{step.title}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ) : null}

      {institutionRoadmaps.slice(0, 2).map((item) => (
        <View key={item.id} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>{item.title}</Text>
          <Text style={[styles.cardMeta, { color: colors.textMuted }]}>Teacher: {item.mentor?.name || "Guide"}</Text>
          {item.weeks.slice(0, 3).map((week) => {
            const key = `institution-${item.id}-${week.id}`;
            return (
              <TouchableOpacity key={key} style={[styles.stepRow, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]} onPress={() => setChecked((prev) => ({ ...prev, [key]: !prev[key] }))}>
                <Text style={[styles.stepCheck, { color: checked[key] ? colors.accent : colors.textMuted }]}>{checked[key] ? "✓" : "○"}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.stepText, { color: colors.text }]}>{week.title}</Text>
                  <Text style={[styles.cardMeta, { color: colors.textMuted }]}>
                    {week.submission?.status ? `Submission: ${week.submission.status}` : `${week.tasks?.length || 0} tasks`}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 20, paddingBottom: 120, gap: 14 },
  title: { fontSize: 30, fontWeight: "900", marginBottom: 6 },
  subtitle: { fontSize: 15, lineHeight: 22 },
  error: { fontWeight: "700" },
  card: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 10 },
  cardTitle: { fontSize: 18, fontWeight: "900" },
  cardMeta: { lineHeight: 19 },
  stepRow: { borderWidth: 1, borderRadius: 12, padding: 12, flexDirection: "row", gap: 10, alignItems: "center" },
  stepCheck: { fontWeight: "900", width: 18 },
  stepText: { fontWeight: "800", flex: 1, lineHeight: 20 }
});

