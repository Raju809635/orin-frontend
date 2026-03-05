import React, { useCallback, useState } from "react";
import { ActivityIndicator, BackHandler, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { api } from "@/lib/api";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

type AiSectionId = "mentor_matching" | "skill_gap" | "roadmap" | "project_ideas" | "resume_builder" | "assistant";

type MentorMatch = {
  mentorId: string;
  name: string;
  title?: string;
  matchScore: number;
  experienceYears?: number;
  rating?: number;
};

type SkillGapResponse = {
  goal: string;
  currentSkills: string[];
  missingSkills: string[];
  suggestions?: { courses?: string[] };
};

type CareerRoadmapResponse = {
  goal: string;
  steps: Array<{ stepNumber: number; title: string }>;
};

type ProjectIdeasResponse = {
  goal: string;
  ideas: Array<{ title: string }>;
};

type ResumeResponse = {
  markdown?: string;
  export?: { fileName?: string };
};

const sections: {
  id: AiSectionId;
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  border: string;
  gradient: [string, string];
  gradientActive: [string, string];
}[] = [
  {
    id: "mentor_matching",
    label: "AI Mentor Matching",
    description: "Find best-fit mentors with match score and experience insights.",
    icon: "sparkles",
    border: "#A4BCFD",
    gradient: ["#FFFFFF", "#EEF4FF"],
    gradientActive: ["#E0EAFF", "#EEF4FF"]
  },
  {
    id: "skill_gap",
    label: "AI Skill Gap Analysis",
    description: "Identify missing skills and smart suggestions for your goal.",
    icon: "analytics",
    border: "#C4B5FD",
    gradient: ["#FFFFFF", "#F4F3FF"],
    gradientActive: ["#EDE9FE", "#F4F3FF"]
  },
  {
    id: "roadmap",
    label: "AI Career Roadmap",
    description: "Get step-by-step path and prioritize your next milestones.",
    icon: "map",
    border: "#ABEFC6",
    gradient: ["#FFFFFF", "#ECFDF3"],
    gradientActive: ["#DCFCE7", "#ECFDF3"]
  },
  {
    id: "project_ideas",
    label: "AI Project Ideas",
    description: "Generate practical project ideas aligned to your career track.",
    icon: "bulb",
    border: "#F9DBAF",
    gradient: ["#FFFFFF", "#FFF7ED"],
    gradientActive: ["#FFEDD5", "#FFF7ED"]
  },
  {
    id: "resume_builder",
    label: "AI Resume Builder",
    description: "Auto-build resume drafts from your ORIN activity profile.",
    icon: "document-text",
    border: "#FDA29B",
    gradient: ["#FFFFFF", "#FEF3F2"],
    gradientActive: ["#FEE4E2", "#FEF3F2"]
  },
  {
    id: "assistant",
    label: "AI Assistant",
    description: "Open AI chat for personalized answers and guidance.",
    icon: "chatbubbles",
    border: "#D6BBFB",
    gradient: ["#FFFFFF", "#F9F5FF"],
    gradientActive: ["#F4EBFF", "#F9F5FF"]
  }
];

export default function AiHubScreen() {
  const router = useRouter();
  const [activeSection, setActiveSection] = useState<AiSectionId>("mentor_matching");
  const [mentorMatches, setMentorMatches] = useState<MentorMatch[]>([]);
  const [skillGap, setSkillGap] = useState<SkillGapResponse | null>(null);
  const [roadmap, setRoadmap] = useState<CareerRoadmapResponse | null>(null);
  const [projectIdeas, setProjectIdeas] = useState<ProjectIdeasResponse | null>(null);
  const [resumePreview, setResumePreview] = useState<ResumeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async (refresh = false) => {
    try {
      if (refresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      const [mentorRes, skillGapRes, roadmapRes, ideasRes, resumeRes] = await Promise.allSettled([
        api.get<{ recommendations: MentorMatch[] }>("/api/network/mentor-matches"),
        api.get<SkillGapResponse>("/api/network/skill-gap"),
        api.get<CareerRoadmapResponse>("/api/network/career-roadmap"),
        api.get<ProjectIdeasResponse>("/api/network/project-ideas"),
        api.get<ResumeResponse>("/api/network/resume/generate")
      ]);
      setMentorMatches(mentorRes.status === "fulfilled" ? mentorRes.value.data?.recommendations || [] : []);
      setSkillGap(skillGapRes.status === "fulfilled" ? skillGapRes.value.data || null : null);
      setRoadmap(roadmapRes.status === "fulfilled" ? roadmapRes.value.data || null : null);
      setProjectIdeas(ideasRes.status === "fulfilled" ? ideasRes.value.data || null : null);
      setResumePreview(resumeRes.status === "fulfilled" ? resumeRes.value.data || null : null);
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to load AI modules.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        if (activeSection !== "mentor_matching") {
          setActiveSection("mentor_matching");
          return true;
        }
        return false;
      };
      const subscription = BackHandler.addEventListener("hardwareBackPress", onBackPress);
      return () => subscription.remove();
    }, [activeSection])
  );

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} />}
    >
      <Text style={styles.title}>AI</Text>
      <Text style={styles.sub}>Pick a module to open focused AI tools in one place.</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.moduleStack}>
        {sections.map((item) => {
          const active = activeSection === item.id;
          return (
            <TouchableOpacity key={item.id} activeOpacity={0.92} onPress={() => setActiveSection(item.id)}>
              <LinearGradient
                colors={active ? item.gradientActive : item.gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.moduleCard, { borderColor: item.border }, active && styles.moduleCardActive]}
              >
                <View style={[styles.moduleIconWrap, active && styles.moduleIconWrapActive]}>
                  <Ionicons name={item.icon} size={20} color={active ? "#1F7A4C" : "#475467"} />
                </View>
                <View style={styles.moduleTextWrap}>
                  <Text style={styles.moduleTitle}>{item.label}</Text>
                  <Text style={styles.moduleDesc}>{item.description}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={active ? "#1F7A4C" : "#98A2B3"} />
              </LinearGradient>
            </TouchableOpacity>
          );
        })}
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color="#1F7A4C" />
        </View>
      ) : null}

      {!loading && activeSection === "mentor_matching" ? (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>AI Mentor Matching</Text>
          {mentorMatches.length === 0 ? (
            <Text style={styles.meta}>No mentor recommendations right now.</Text>
          ) : (
            mentorMatches.slice(0, 6).map((item) => (
              <View key={item.mentorId} style={[styles.card, styles.cardBlue]}>
                <Text style={styles.cardTitle}>{item.name}</Text>
                <Text style={styles.meta}>{item.title || "Mentor"}</Text>
                <Text style={styles.meta}>Experience: {item.experienceYears || 0} yrs | Rating: {item.rating || 0}</Text>
                <Text style={styles.score}>Match Score: {item.matchScore}%</Text>
              </View>
            ))
          )}
        </View>
      ) : null}

      {!loading && activeSection === "skill_gap" ? (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>AI Skill Gap Analyzer</Text>
          {!skillGap ? (
            <Text style={styles.meta}>Skill gap data unavailable right now.</Text>
          ) : (
            <View style={[styles.card, styles.cardPurple]}>
              <Text style={styles.cardTitle}>Goal: {skillGap.goal}</Text>
              <Text style={styles.meta}>Current: {skillGap.currentSkills.join(", ") || "None"}</Text>
              <Text style={styles.meta}>Missing: {skillGap.missingSkills.join(", ") || "No major gaps"}</Text>
              <Text style={styles.meta}>Suggested Courses: {skillGap.suggestions?.courses?.slice(0, 4).join(", ") || "No suggestions"}</Text>
            </View>
          )}
        </View>
      ) : null}

      {!loading && activeSection === "roadmap" ? (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>AI Career Roadmap</Text>
          {!roadmap ? (
            <Text style={styles.meta}>Roadmap data unavailable right now.</Text>
          ) : (
            <View style={[styles.card, styles.cardGreen]}>
              <Text style={styles.cardTitle}>Goal: {roadmap.goal}</Text>
              {roadmap.steps.map((step) => (
                <Text key={`${step.stepNumber}-${step.title}`} style={styles.meta}>
                  Step {step.stepNumber}: {step.title}
                </Text>
              ))}
            </View>
          )}
        </View>
      ) : null}

      {!loading && activeSection === "project_ideas" ? (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>AI Project Idea Generator</Text>
          {!projectIdeas ? (
            <Text style={styles.meta}>Project ideas unavailable right now.</Text>
          ) : (
            <View style={[styles.card, styles.cardOrange]}>
              <Text style={styles.cardTitle}>Goal: {projectIdeas.goal}</Text>
              {projectIdeas.ideas.slice(0, 8).map((idea, index) => (
                <Text key={`${idea.title}-${index}`} style={styles.meta}>
                  {index + 1}. {idea.title}
                </Text>
              ))}
            </View>
          )}
        </View>
      ) : null}

      {!loading && activeSection === "resume_builder" ? (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>AI Resume Builder</Text>
          {!resumePreview?.markdown ? (
            <Text style={styles.meta}>Resume preview unavailable right now.</Text>
          ) : (
            <View style={[styles.card, styles.cardRed]}>
              <Text style={styles.cardTitle}>Resume generated</Text>
              <Text style={styles.meta}>File: {resumePreview.export?.fileName || "orin_resume.md"}</Text>
              <Text style={styles.meta} numberOfLines={8}>
                {resumePreview.markdown}
              </Text>
            </View>
          )}
        </View>
      ) : null}

      {!loading && activeSection === "assistant" ? (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>AI Assistant</Text>
          <View style={[styles.card, styles.cardViolet]}>
            <Text style={styles.meta}>Open assistant chat for detailed guidance and personalized answers.</Text>
            <TouchableOpacity style={styles.openBtn} onPress={() => router.push("/ai-assistant" as never)}>
              <Text style={styles.openBtnText}>Open AI Assistant</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: "#F3F6FB", gap: 10 },
  title: { fontSize: 28, fontWeight: "800", color: "#11261E" },
  sub: { color: "#475467" },
  error: { color: "#B42318" },
  moduleStack: { gap: 10 },
  moduleCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    shadowColor: "#101828",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4
  },
  moduleCardActive: { shadowOpacity: 0.13, elevation: 6 },
  moduleIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.85)",
    alignItems: "center",
    justifyContent: "center"
  },
  moduleIconWrapActive: { backgroundColor: "rgba(255,255,255,1)" },
  moduleTextWrap: { flex: 1, gap: 2 },
  moduleTitle: { color: "#1E2B24", fontWeight: "800", fontSize: 15 },
  moduleDesc: { color: "#667085", fontSize: 12, lineHeight: 16 },
  loadingWrap: { alignItems: "center", justifyContent: "center", minHeight: 180 },
  panel: { gap: 8, marginTop: 4 },
  panelTitle: { fontSize: 16, fontWeight: "800", color: "#1E2B24" },
  card: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DDE6E1",
    borderRadius: 12,
    padding: 12,
    gap: 4
  },
  cardBlue: { backgroundColor: "#EEF4FF", borderColor: "#C7D7FE" },
  cardPurple: { backgroundColor: "#F4F3FF", borderColor: "#DDD6FE" },
  cardGreen: { backgroundColor: "#ECFDF3", borderColor: "#B7E5CC" },
  cardOrange: { backgroundColor: "#FFF7ED", borderColor: "#F9DBAF" },
  cardRed: { backgroundColor: "#FEF3F2", borderColor: "#F7C1BB" },
  cardViolet: { backgroundColor: "#F9F5FF", borderColor: "#E2D6FF" },
  cardTitle: { color: "#1E2B24", fontWeight: "800" },
  meta: { color: "#667085" },
  score: { color: "#165DFF", fontWeight: "800", marginTop: 4 },
  openBtn: {
    marginTop: 8,
    alignSelf: "flex-start",
    backgroundColor: "#1F7A4C",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9
  },
  openBtnText: { color: "#fff", fontWeight: "700" }
});
