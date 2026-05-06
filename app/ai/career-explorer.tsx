import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { api } from "@/lib/api";
import { getAppErrorMessage } from "@/lib/appError";
import { useAppTheme } from "@/context/ThemeContext";
import { useLearner } from "@/context/LearnerContext";

type CareerItem = {
  title: string;
  field: string;
  subjects: string[];
  skills: string[];
  nextStep: string;
  futureScope: string;
  fitScore: number;
  salaryRange: string;
};

type FeaturedCareer = CareerItem & {
  overview: string;
  workEnvironment: string;
  jobSatisfaction: string;
  roadmap: string[];
  skillRatings: { skill: string; level: string; percent: number }[];
};

type CareerExplorer = {
  greeting: string;
  summary: string;
  categories: string[];
  careers: CareerItem[];
  featuredCareer: FeaturedCareer;
  compare: { title: string; factor: string; salary: string; growth: string; satisfaction: string; workLifeBalance: string }[];
  savedCareers: { title: string; field: string }[];
  progress: { profileCompletion: number; completed: string[]; pending: string[] };
  assistantPrompts: string[];
  subjectsCovered: string[];
};

const INTERESTS = ["Science", "Commerce", "Arts", "Tech", "Law", "Design", "Defense", "Other"];
const CLASS_OPTIONS = ["8", "9", "10", "11", "12"];
const FALLBACK_SUBJECTS = ["Mathematics", "Science", "Social Science", "English", "Computer", "Biology", "Commerce"];
type AcademicSubject = { name?: string; subject?: string; key?: string; slug?: string };

function subjectLabel(item: AcademicSubject | string) {
  if (typeof item === "string") return item;
  return String(item.name || item.subject || item.key || item.slug || "").trim();
}
const CATEGORY_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  Science: "flask",
  Commerce: "briefcase",
  Arts: "color-palette",
  Tech: "code-slash",
  Law: "scale",
  Design: "brush",
  Defense: "shield-checkmark",
  Other: "grid"
};

function fallbackExplorer(): CareerExplorer {
  return {
    greeting: "Hi, Student!",
    summary: "AI matched Science careers using your interest in biology, problem solving, and helping people.",
    categories: INTERESTS,
    careers: [
      { title: "Doctor", field: "Healthcare & Medical", subjects: ["Biology", "Chemistry", "Physics"], skills: ["Focus", "Empathy", "Decision Making"], nextStep: "Build Biology and Chemistry basics, then explore NEET path.", futureScope: "Hospitals, research, public health, and specialist medicine.", fitScore: 92, salaryRange: "High growth" },
      { title: "Scientist", field: "Research & Development", subjects: ["Science", "Maths"], skills: ["Curiosity", "Analysis", "Patience"], nextStep: "Start with science projects and research reading.", futureScope: "Labs, universities, biotech, and innovation teams.", fitScore: 84, salaryRange: "Steady growth" },
      { title: "Biotechnologist", field: "Biotech & Research", subjects: ["Biology", "Chemistry"], skills: ["Lab thinking", "Observation", "Data"], nextStep: "Explore genetics, cells, and simple lab concepts.", futureScope: "Biotech companies, agriculture, healthcare, and research.", fitScore: 80, salaryRange: "Growing field" }
    ],
    featuredCareer: {
      title: "Doctor",
      field: "Healthcare & Medical",
      subjects: ["Biology", "Chemistry", "Physics"],
      skills: ["Focus", "Empathy", "Decision Making"],
      nextStep: "Build Biology and Chemistry basics, then explore NEET path.",
      futureScope: "Hospitals, research, public health, and specialist medicine.",
      fitScore: 92,
      salaryRange: "High growth",
      overview: "Doctors diagnose and treat illnesses and help people maintain good health.",
      workEnvironment: "Dynamic",
      jobSatisfaction: "Very high",
      roadmap: ["10th Standard: focus on Science subjects.", "11th-12th: choose Biology, Chemistry, Physics.", "Entrance Exam: prepare for NEET.", "Degree: MBBS.", "Internship: clinical experience.", "Specialization: choose your field.", "Build Career: learn and grow."],
      skillRatings: [{ skill: "Communication", level: "High", percent: 86 }, { skill: "Focus & Patience", level: "High", percent: 82 }, { skill: "Problem Solving", level: "High", percent: 78 }, { skill: "Empathy", level: "Medium", percent: 70 }]
    },
    compare: [
      { title: "Doctor", factor: "Healthcare", salary: "High", growth: "High", satisfaction: "Very high", workLifeBalance: "Medium" },
      { title: "Scientist", factor: "Research", salary: "Medium", growth: "High", satisfaction: "High", workLifeBalance: "Good" }
    ],
    savedCareers: [{ title: "Doctor", field: "Healthcare & Medical" }, { title: "Scientist", field: "Research & Development" }],
    progress: { profileCompletion: 72, completed: ["Interest Areas", "Skills Assessment", "Career Shortlist"], pending: ["Study Preferences", "Career Roadmap"] },
    assistantPrompts: ["What should I do after 10th?", "Which subjects are important?", "Compare Doctor and Scientist."],
    subjectsCovered: ["Physics", "Chemistry", "Biology", "Maths", "Economics", "Computer Science", "English", "History", "Psychology"]
  };
}

function barColor(value: number) {
  if (value < 55) return "#EF4444";
  if (value < 80) return "#F59E0B";
  return "#12B76A";
}

export default function CareerExplorerScreen() {
  const { colors } = useAppTheme();
  const { className } = useLearner();
  const [board] = useState("CBSE");
  const [classLevel, setClassLevel] = useState(className || "10");
  const [subjects, setSubjects] = useState(FALLBACK_SUBJECTS);
  const [favoriteSubjects, setFavoriteSubjects] = useState(["Science", "Mathematics"]);
  const [interest, setInterest] = useState("Science");
  const [strengths, setStrengths] = useState("biology, problem solving, helping people");
  const [explorer, setExplorer] = useState<CareerExplorer>(fallbackExplorer);
  const [selectedCareer, setSelectedCareer] = useState<FeaturedCareer>(fallbackExplorer().featuredCareer);
  const [savedCareer, setSavedCareer] = useState("");
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  const topCareers = useMemo(() => explorer.careers.slice(0, 5), [explorer.careers]);

  const loadSubjects = useCallback(async () => {
    try {
      const { data } = await api.get<{ subjects?: (AcademicSubject | string)[] }>(`/api/academics/${board}/class/${classLevel}/subjects`);
      const next = (data?.subjects || []).map(subjectLabel).filter(Boolean);
      if (next.length) {
        setSubjects(next);
        setFavoriteSubjects((prev) => prev.filter((item) => next.includes(item)).length ? prev.filter((item) => next.includes(item)) : next.slice(0, 2));
      }
    } catch {
      setSubjects(FALLBACK_SUBJECTS);
    }
  }, [board, classLevel]);

  useFocusEffect(useCallback(() => { loadSubjects(); }, [loadSubjects]));

  function toggleFavoriteSubject(item: string) {
    setFavoriteSubjects((prev) => prev.includes(item) ? prev.filter((subject) => subject !== item) : [...prev, item].slice(0, 4));
  }

  async function explore(nextInterest = interest) {
    setInterest(nextInterest);
    setLoading(true);
    setStatusMessage("");
    try {
      const { data } = await api.post<{ source?: "ai" | "fallback"; explorer?: CareerExplorer }>("/api/ai/highschool/career-explorer", {
        interest: nextInterest,
        strengths: [strengths, favoriteSubjects.length ? `favorite subjects: ${favoriteSubjects.join(", ")}` : ""].filter(Boolean).join("; "),
        academicSubjects: favoriteSubjects,
        classLevel
      });
      const nextExplorer = data?.explorer || fallbackExplorer();
      setExplorer(nextExplorer);
      setSelectedCareer(nextExplorer.featuredCareer);
      setStatusMessage(data?.source === "ai" ? "AI personalized your career options." : "Using safe career guidance until AI is available.");
    } catch (error) {
      const fallback = fallbackExplorer();
      setExplorer(fallback);
      setSelectedCareer(fallback.featuredCareer);
      setStatusMessage(getAppErrorMessage(error, "AI career explorer is unavailable, so ORIN loaded safe career guidance."));
    } finally {
      setLoading(false);
    }
  }

  function openCareer(career: CareerItem) {
    setSelectedCareer({
      ...selectedCareer,
      ...career,
      overview: `${career.title} fits students interested in ${career.subjects.slice(0, 2).join(" and ")}.`,
      roadmap: selectedCareer.roadmap,
      skillRatings: career.skills.map((skill, index) => ({ skill, level: index < 2 ? "High" : "Medium", percent: index < 2 ? 82 : 68 }))
    });
  }

  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: colors.background }]} showsVerticalScrollIndicator={false}>
      <View style={[styles.hero, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.brand, { color: colors.accent }]}>ORIN</Text>
        <Text style={[styles.title, { color: colors.text }]}>Career Explorer</Text>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>Discover careers, subjects, skills, and your next step with AI.</Text>
      </View>

      {statusMessage ? (
        <View style={[styles.aiNotice, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="sparkles" size={18} color={colors.accent} />
          <Text style={[styles.aiNoticeText, { color: colors.textMuted }]}>{statusMessage}</Text>
        </View>
      ) : null}

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.greeting, { color: colors.text }]}>{explorer.greeting}</Text>
        <Text style={[styles.cardMeta, { color: colors.textMuted }]}>{explorer.summary}</Text>
        <TextInput
          value={strengths}
          onChangeText={setStrengths}
          placeholder="Your strengths or interests"
          placeholderTextColor={colors.textMuted}
          style={[styles.input, { backgroundColor: colors.surfaceAlt, borderColor: colors.border, color: colors.text }]}
        />
        <Text style={[styles.subHeader, { color: colors.text }]}>Class</Text>
        <View style={styles.categoryGrid}>
          {CLASS_OPTIONS.map((item) => {
            const active = classLevel === item;
            return (
              <TouchableOpacity key={item} style={[styles.categoryTile, { backgroundColor: active ? colors.accentSoft : colors.surfaceAlt, borderColor: active ? colors.accent : colors.border }]} onPress={() => setClassLevel(item)}>
                <Text style={[styles.categoryText, { color: active ? colors.accent : colors.text }]}>Class {item}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <Text style={[styles.subHeader, { color: colors.text }]}>Favourite Subjects</Text>
        <View style={styles.categoryGrid}>
          {subjects.slice(0, 8).map((item) => {
            const active = favoriteSubjects.includes(item);
            return (
              <TouchableOpacity key={item} style={[styles.categoryTile, { backgroundColor: active ? colors.accentSoft : colors.surfaceAlt, borderColor: active ? colors.accent : colors.border }]} onPress={() => toggleFavoriteSubject(item)}>
                <Text style={[styles.categoryText, { color: active ? colors.accent : colors.text }]}>{item}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: colors.accent }]} onPress={() => explore()} disabled={loading}>
          {loading ? <ActivityIndicator color={colors.accentText} /> : <Ionicons name="sparkles" size={18} color={colors.accentText} />}
          <Text style={[styles.primaryText, { color: colors.accentText }]}>{loading ? "Exploring..." : "Start AI Career Quiz"}</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <SectionHeader icon="grid" title="Choose a Category" color="#12B76A" />
        <View style={styles.categoryGrid}>
          {explorer.categories.map((category) => {
            const active = interest === category;
            return (
              <TouchableOpacity key={category} style={[styles.categoryTile, { backgroundColor: active ? colors.accentSoft : colors.surfaceAlt, borderColor: active ? colors.accent : colors.border }]} onPress={() => explore(category)}>
                <Ionicons name={CATEGORY_ICONS[category] || "grid"} size={21} color={active ? colors.accent : colors.textMuted} />
                <Text style={[styles.categoryText, { color: active ? colors.accent : colors.text }]}>{category}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <SectionHeader icon="briefcase" title={`${interest} Careers`} color="#0EA5E9" />
        {topCareers.map((career) => (
          <TouchableOpacity key={career.title} style={[styles.careerRow, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]} onPress={() => openCareer(career)}>
            <View style={[styles.careerIcon, { backgroundColor: "#ECFDF3" }]}>
              <Ionicons name="person" size={18} color="#12B76A" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.careerTitle, { color: colors.text }]}>{career.title}</Text>
              <Text style={[styles.cardMeta, { color: colors.textMuted }]}>{career.field}</Text>
            </View>
            <Text style={[styles.fitText, { color: barColor(career.fitScore) }]}>{career.fitScore}%</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={[styles.detailCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <SectionHeader icon="medkit" title={selectedCareer.title} color="#12B76A" />
        <Text style={[styles.cardMeta, { color: colors.textMuted }]}>{selectedCareer.field}</Text>
        <View style={styles.pillRow}>
          <InfoPill label={selectedCareer.salaryRange} icon="trending-up" />
          <InfoPill label={selectedCareer.jobSatisfaction} icon="happy" />
          <InfoPill label={selectedCareer.workEnvironment} icon="business" />
        </View>
        <Text style={[styles.sectionText, { color: colors.text }]}>{selectedCareer.overview}</Text>
        <Text style={[styles.subHeader, { color: colors.text }]}>Subjects</Text>
        <Text style={[styles.cardMeta, { color: colors.textMuted }]}>{selectedCareer.subjects.join(", ")}</Text>
        <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: colors.accent }]} onPress={() => setSavedCareer(selectedCareer.title)}>
          <Text style={[styles.primaryText, { color: colors.accentText }]}>Save Career</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <SectionHeader icon="map" title="Roadmap" color="#7C3AED" />
        {selectedCareer.roadmap.map((step, index) => (
          <View key={`${step}-${index}`} style={styles.roadmapRow}>
            <View style={[styles.stepNumber, { backgroundColor: colors.accentSoft }]}>
              <Text style={[styles.stepNumberText, { color: colors.accent }]}>{index + 1}</Text>
            </View>
            <Text style={[styles.roadmapText, { color: colors.text }]}>{step}</Text>
          </View>
        ))}
      </View>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <SectionHeader icon="bar-chart" title="Skills Required" color="#12B76A" />
        {selectedCareer.skillRatings.map((item) => (
          <MetricRow key={item.skill} label={`${item.skill} (${item.level})`} value={item.percent} />
        ))}
      </View>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <SectionHeader icon="git-compare" title="Compare Careers" color="#F59E0B" />
        {explorer.compare.map((item) => (
          <View key={item.title} style={[styles.compareBox, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
            <Text style={[styles.careerTitle, { color: colors.text }]}>{item.title}</Text>
            <Text style={[styles.cardMeta, { color: colors.textMuted }]}>Growth: {item.growth} - Salary: {item.salary} - Balance: {item.workLifeBalance}</Text>
          </View>
        ))}
      </View>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <SectionHeader icon="bookmark" title="Saved Careers & Progress" color="#0EA5E9" />
        {savedCareer ? <Text style={[styles.savedText, { color: colors.text }]}>Saved now: {savedCareer}</Text> : null}
        {explorer.savedCareers.map((item) => (
          <Text key={item.title} style={[styles.cardMeta, { color: colors.textMuted }]}>{item.title} - {item.field}</Text>
        ))}
        <View style={[styles.progressCircle, { borderColor: barColor(explorer.progress.profileCompletion) }]}>
          <Text style={[styles.progressValue, { color: colors.text }]}>{explorer.progress.profileCompletion}%</Text>
          <Text style={[styles.cardMeta, { color: colors.textMuted }]}>Profile</Text>
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <SectionHeader icon="school" title="All Subjects Covered" color="#12B76A" />
        <View style={styles.subjectGrid}>
          {explorer.subjectsCovered.map((item) => (
            <View key={item} style={[styles.subjectTile, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
              <Ionicons name="book" size={16} color={colors.accent} />
              <Text style={[styles.subjectTextSmall, { color: colors.text }]}>{item}</Text>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
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

function InfoPill({ label, icon }: { label: string; icon: keyof typeof Ionicons.glyphMap }) {
  return (
    <View style={styles.infoPill}>
      <Ionicons name={icon} size={14} color="#12B76A" />
      <Text style={styles.infoPillText}>{label}</Text>
    </View>
  );
}

function MetricRow({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.metricRow}>
      <View style={styles.metricTop}>
        <Text style={styles.metricLabel}>{label}</Text>
        <Text style={[styles.metricValue, { color: barColor(value) }]}>{value}%</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.trackFill, { width: `${Math.max(4, Math.min(100, value))}%`, backgroundColor: barColor(value) }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 16, paddingBottom: 120, gap: 14 },
  hero: { borderWidth: 1, borderRadius: 26, padding: 18, gap: 6 },
  brand: { fontSize: 42, fontWeight: "900", letterSpacing: 0 },
  title: { fontSize: 28, fontWeight: "900" },
  subtitle: { fontSize: 15, lineHeight: 22 },
  aiNotice: { borderWidth: 1, borderRadius: 18, padding: 12, flexDirection: "row", gap: 9, alignItems: "flex-start" },
  aiNoticeText: { flex: 1, fontSize: 12, lineHeight: 18, fontWeight: "800" },
  card: { borderWidth: 1, borderRadius: 22, padding: 15, gap: 13 },
  detailCard: { borderWidth: 1, borderRadius: 24, padding: 16, gap: 13 },
  greeting: { fontSize: 18, fontWeight: "900" },
  cardMeta: { lineHeight: 19, fontWeight: "700", fontSize: 12 },
  input: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 11, fontSize: 14 },
  primaryBtn: { minHeight: 48, borderRadius: 999, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 },
  primaryText: { fontWeight: "900" },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 7 },
  sectionHeaderText: { fontSize: 16, fontWeight: "900" },
  categoryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  categoryTile: { width: "48%", minHeight: 76, borderWidth: 1, borderRadius: 16, padding: 12, justifyContent: "center", gap: 7 },
  categoryText: { fontWeight: "900" },
  careerRow: { borderWidth: 1, borderRadius: 16, padding: 12, flexDirection: "row", alignItems: "center", gap: 11 },
  careerIcon: { width: 38, height: 38, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  careerTitle: { fontSize: 15, fontWeight: "900" },
  fitText: { fontWeight: "900" },
  pillRow: { gap: 8 },
  infoPill: { minHeight: 42, borderRadius: 14, backgroundColor: "#ECFDF3", flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 10 },
  infoPillText: { color: "#047857", fontWeight: "900", fontSize: 12 },
  sectionText: { fontSize: 14, lineHeight: 22, fontWeight: "700" },
  subHeader: { fontSize: 14, fontWeight: "900" },
  roadmapRow: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  stepNumber: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  stepNumberText: { fontWeight: "900", fontSize: 12 },
  roadmapText: { flex: 1, fontWeight: "800", lineHeight: 21 },
  metricRow: { gap: 6 },
  metricTop: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  metricLabel: { color: "#0F172A", fontWeight: "900", flex: 1 },
  metricValue: { fontWeight: "900" },
  track: { height: 9, borderRadius: 999, overflow: "hidden", backgroundColor: "#E5E7EB" },
  trackFill: { height: "100%", borderRadius: 999 },
  compareBox: { borderWidth: 1, borderRadius: 16, padding: 12, gap: 4 },
  savedText: { fontWeight: "900" },
  progressCircle: { width: 102, height: 102, borderRadius: 51, borderWidth: 9, alignItems: "center", justifyContent: "center", alignSelf: "center" },
  progressValue: { fontSize: 22, fontWeight: "900" },
  subjectGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  subjectTile: { width: "30%", minHeight: 66, borderWidth: 1, borderRadius: 16, alignItems: "center", justifyContent: "center", gap: 6, padding: 8 },
  subjectTextSmall: { fontSize: 11, fontWeight: "900", textAlign: "center" }
});
