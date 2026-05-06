import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { api } from "@/lib/api";
import { getAppErrorMessage } from "@/lib/appError";
import { useAppTheme } from "@/context/ThemeContext";
import { useLearner } from "@/context/LearnerContext";

type AcademicSubject = { name?: string; subject?: string; key?: string; slug?: string };
type AcademicChapter = { title?: string; name?: string };
type AcademicSubjectResponse = { subject?: { chapters?: AcademicChapter[] }; chapters?: AcademicChapter[] };
type SchoolProject = {
  id: string;
  title: string;
  type: string;
  difficulty: string;
  duration: string;
  why: string;
  materials: string[];
  steps: string[];
  outcome: string;
  proofRequired?: boolean;
  teacherFeedbackPrompt?: string;
};
type SchoolProjectsResult = {
  title: string;
  summary: string;
  projects: SchoolProject[];
};

const CLASS_OPTIONS = ["6", "7", "8", "9", "10", "11", "12"];
const FALLBACK_SUBJECTS = ["Mathematics", "Science", "Social Science", "English", "Telugu", "Hindi"];

function subjectLabel(item: AcademicSubject | string) {
  if (typeof item === "string") return item;
  return String(item.name || item.subject || item.key || item.slug || "").trim();
}

export default function HighSchoolSchoolProjectsScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const { className } = useLearner();
  const [board] = useState("CBSE");
  const [classLevel, setClassLevel] = useState(className || "10");
  const [subjects, setSubjects] = useState<string[]>(FALLBACK_SUBJECTS);
  const [subject, setSubject] = useState("Science");
  const [chapters, setChapters] = useState<string[]>([]);
  const [chapter, setChapter] = useState("");
  const [goal, setGoal] = useState("Make a school-ready project and submit proof");
  const [difficulty, setDifficulty] = useState("Medium");
  const [result, setResult] = useState<SchoolProjectsResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingContext, setLoadingContext] = useState(false);
  const [status, setStatus] = useState("");

  const loadSubjects = useCallback(async () => {
    try {
      setLoadingContext(true);
      const { data } = await api.get<{ subjects?: AcademicSubject[] | string[] }>(`/api/academics/${board}/class/${classLevel}/subjects`);
      const next = (data?.subjects || []).map(subjectLabel).filter(Boolean);
      if (next.length) {
        setSubjects(next);
        if (!next.includes(subject)) setSubject(next[0]);
      }
    } catch {
      setSubjects(FALLBACK_SUBJECTS);
    } finally {
      setLoadingContext(false);
    }
  }, [board, classLevel, subject]);

  const loadChapters = useCallback(async () => {
    try {
      const { data } = await api.get<AcademicSubjectResponse>(`/api/academics/${board}/class/${classLevel}/subject/${encodeURIComponent(subject)}`);
      const next = (data?.subject?.chapters || data?.chapters || [])
        .map((item) => String(item.title || item.name || "").trim())
        .filter(Boolean)
        .slice(0, 12);
      setChapters(next);
      setChapter((prev) => prev && next.includes(prev) ? prev : next[0] || "");
    } catch {
      setChapters([]);
      setChapter("");
    }
  }, [board, classLevel, subject]);

  useFocusEffect(useCallback(() => { loadSubjects(); }, [loadSubjects]));
  useFocusEffect(useCallback(() => { loadChapters(); }, [loadChapters]));

  async function generateProjects() {
    setLoading(true);
    setStatus("");
    try {
      const { data } = await api.post<{ source?: "ai" | "fallback"; result?: SchoolProjectsResult }>("/api/ai/highschool/school-projects", {
        board,
        classLevel,
        subject,
        chapter,
        goal,
        difficulty
      });
      setResult(data?.result || null);
      setStatus(data?.source === "ai" ? "AI generated syllabus-linked school projects." : "Using safe project ideas until AI is available.");
    } catch (error) {
      setStatus(getAppErrorMessage(error, "Unable to generate projects right now."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.topBar, { backgroundColor: colors.background }]}>
        <TouchableOpacity style={styles.topIconBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.topTitle, { color: colors.text }]}>School Projects</Text>
        <View style={styles.topIconBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={[styles.hero, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.eyebrow, { color: colors.accent }]}>After 12 Project Ideas, school version</Text>
          <Text style={[styles.title, { color: colors.text }]}>Build projects from your syllabus</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            Choose class, subject, and chapter. ORIN creates school-safe projects with materials, steps, proof, and teacher feedback prompts.
          </Text>
        </View>

        {status ? (
          <View style={[styles.notice, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name="sparkles" size={18} color={colors.accent} />
            <Text style={[styles.noticeText, { color: colors.textMuted }]}>{status}</Text>
          </View>
        ) : null}

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.label, { color: colors.text }]}>Class</Text>
          <ChipRow values={CLASS_OPTIONS} selected={classLevel} onSelect={setClassLevel} colors={colors} />

          <Text style={[styles.label, { color: colors.text }]}>Subject {loadingContext ? "(loading...)" : ""}</Text>
          <ChipRow values={subjects.slice(0, 8)} selected={subject} onSelect={setSubject} colors={colors} />

          <Text style={[styles.label, { color: colors.text }]}>Chapter / Topic</Text>
          {chapters.length ? (
            <ChipRow values={chapters.slice(0, 8)} selected={chapter} onSelect={setChapter} colors={colors} />
          ) : (
            <TextInput value={chapter} onChangeText={setChapter} placeholder="Topic name" placeholderTextColor={colors.textMuted} style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceAlt }]} />
          )}

          <Text style={[styles.label, { color: colors.text }]}>Difficulty</Text>
          <ChipRow values={["Easy", "Medium", "Advanced"]} selected={difficulty} onSelect={setDifficulty} colors={colors} />

          <Text style={[styles.label, { color: colors.text }]}>Goal</Text>
          <TextInput value={goal} onChangeText={setGoal} placeholder="Project goal" placeholderTextColor={colors.textMuted} style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceAlt }]} />

          <TouchableOpacity disabled={loading} style={[styles.primaryButton, { backgroundColor: colors.accent }]} onPress={generateProjects}>
            {loading ? <ActivityIndicator color={colors.accentText} /> : <Ionicons name="bulb" size={18} color={colors.accentText} />}
            <Text style={[styles.primaryButtonText, { color: colors.accentText }]}>{loading ? "Creating Projects..." : "Generate School Projects"}</Text>
          </TouchableOpacity>
        </View>

        {result ? (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.titleSmall, { color: colors.text }]}>{result.title}</Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>{result.summary}</Text>
            {(result.projects || []).map((project) => (
              <View key={project.id} style={[styles.projectCard, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}>
                <View style={styles.projectTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.projectTitle, { color: colors.text }]}>{project.title}</Text>
                    <Text style={[styles.meta, { color: colors.textMuted }]}>{project.type} | {project.difficulty} | {project.duration}</Text>
                  </View>
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>Proof</Text>
                  </View>
                </View>
                <Text style={[styles.meta, { color: colors.textMuted }]}>{project.why}</Text>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Materials</Text>
                <Text style={[styles.meta, { color: colors.textMuted }]}>{project.materials?.join(", ") || "Notebook, chart, textbook"}</Text>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Steps</Text>
                {(project.steps || []).map((step, index) => (
                  <Text key={`${project.id}-${index}`} style={[styles.stepText, { color: colors.textMuted }]}>{index + 1}. {step}</Text>
                ))}
                <Text style={[styles.outcome, { color: colors.text }]}>{project.outcome}</Text>
                <Text style={[styles.meta, { color: colors.textMuted }]}>{project.teacherFeedbackPrompt}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>
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

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: { minHeight: 58, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  topIconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  topTitle: { fontSize: 18, fontWeight: "900" },
  container: { padding: 16, paddingBottom: 118, gap: 14 },
  hero: { borderWidth: 1, borderRadius: 26, padding: 17, gap: 8 },
  eyebrow: { fontSize: 11, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.8 },
  title: { fontSize: 25, lineHeight: 31, fontWeight: "900" },
  titleSmall: { fontSize: 20, lineHeight: 25, fontWeight: "900" },
  subtitle: { fontSize: 14, lineHeight: 21, fontWeight: "600" },
  notice: { borderWidth: 1, borderRadius: 18, padding: 12, flexDirection: "row", gap: 9, alignItems: "flex-start" },
  noticeText: { flex: 1, fontSize: 12, lineHeight: 18, fontWeight: "800" },
  card: { borderWidth: 1, borderRadius: 24, padding: 16, gap: 14 },
  label: { fontSize: 14, fontWeight: "900" },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  chipText: { fontWeight: "900" },
  input: { minHeight: 46, borderWidth: 1, borderRadius: 16, paddingHorizontal: 12, fontWeight: "800" },
  primaryButton: { minHeight: 50, borderRadius: 999, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8, paddingHorizontal: 16 },
  primaryButtonText: { fontWeight: "900", fontSize: 15 },
  projectCard: { borderWidth: 1, borderRadius: 20, padding: 14, gap: 10 },
  projectTop: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  projectTitle: { fontSize: 16, fontWeight: "900" },
  meta: { fontSize: 13, lineHeight: 19, fontWeight: "700" },
  sectionTitle: { fontSize: 13, fontWeight: "900", marginTop: 4 },
  stepText: { fontSize: 13, lineHeight: 19, fontWeight: "700" },
  outcome: { fontSize: 13, lineHeight: 19, fontWeight: "900" },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: "#ECFDF3" },
  badgeText: { color: "#0F766E", fontWeight: "900", fontSize: 11 }
});
