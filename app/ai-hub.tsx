import React from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "@/context/AuthContext";
import { useLearner } from "@/context/LearnerContext";
import { isKidStage } from "@/lib/learnerExperience";
import { useAppTheme } from "@/context/ThemeContext";
import GlobalHeader from "@/components/global-header";

type AiModule = {
  id: string;
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  path: string;
  iconColor: string;
  iconBg: string;
  darkIconBg: string;
  border: string;
  gradient: [string, string];
  darkGradient: [string, string];
};

export default function AiHubScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ search?: string }>();
  const { user } = useAuth();
  const { learnerStage } = useLearner();
  const { colors, isDark } = useAppTheme();
  const isMentor = user?.role === "mentor";
  const isKid = !isMentor && isKidStage(learnerStage);
  const isHighSchool = !isMentor && learnerStage === "highschool";
  const [searchQuery, setSearchQuery] = React.useState("");

  React.useEffect(() => {
    setSearchQuery(String(params.search || "").trim());
  }, [params.search]);

  const modules: AiModule[] = [
    {
      id: "mentor_matching",
      label: isKid ? "Learning Games" : isHighSchool ? "Career Explorer" : "AI Mentor Matching",
      description: isMentor
        ? "Identify students whose goals and interests align with your mentoring domains."
        : isKid
          ? "Play guided learning activities and simple practice sessions."
          : isHighSchool
            ? "Explore future streams and mentor-guided direction with simpler suggestions."
            : "Find best-fit mentors with match score and experience insights.",
      icon: isKid ? "game-controller" : "sparkles",
      path: isKid ? "/ai/kids-learning-games" : isHighSchool ? "/ai/career-explorer" : "/ai/mentor-matching",
      iconColor: "#D4A017",
      iconBg: "#FFF7D6",
      darkIconBg: "rgba(212,160,23,0.16)",
      border: "#A4BCFD",
      gradient: ["#FFFFFF", "#EEF4FF"],
      darkGradient: ["#1C2333", "#101827"]
    },
    {
      id: "skill_gap",
      label: isKid ? "Reading & Numbers" : "AI Skill Gap Analysis",
      description: isMentor
        ? "Review likely student skill gaps before sessions and plan better guidance."
        : isKid
          ? "Practice reading, numbers, and basic concept support in a simpler guided format."
          : "Identify missing skills and course suggestions for your goal.",
      icon: isKid ? "school" : "analytics",
      path: isKid ? "/ai/reading-and-numbers" : "/ai/skill-gap",
      iconColor: "#6D28D9",
      iconBg: "#F3E8FF",
      darkIconBg: "rgba(109,40,217,0.18)",
      border: "#C4B5FD",
      gradient: ["#FFFFFF", "#F4F3FF"],
      darkGradient: ["#20192F", "#111827"]
    },
    {
      id: "roadmap",
      label: isKid ? "Learning Activities" : "AI Career Roadmap",
      description: isMentor
        ? "Generate structured mentoring plans and milestone-based guidance for mentees."
        : isKid
          ? "Open simpler weekly activities and mentor-guided progress instead of a career roadmap."
          : "Get your step-by-step path and next milestones.",
      icon: "map",
      path: isKid ? "/ai/career-roadmap?section=institution" : "/ai/career-roadmap",
      iconColor: "#0F766E",
      iconBg: "#DDF7F2",
      darkIconBg: "rgba(15,118,110,0.18)",
      border: "#ABEFC6",
      gradient: ["#FFFFFF", "#ECFDF3"],
      darkGradient: ["#14292A", "#0F1E24"]
    },
    {
      id: "project_ideas",
      label: isKid ? "Creative Corner" : "AI Project Ideas",
      description: isMentor
        ? "Generate assignments, practice tasks, and project suggestions for students."
        : isKid
          ? "Get drawing, story, and simple make-and-build ideas for class activities."
          : "Generate practical project ideas aligned to your career track.",
      icon: isKid ? "color-wand" : "bulb",
      path: isKid ? "/ai/creative-corner" : "/ai/project-ideas",
      iconColor: "#D97706",
      iconBg: "#FFF1DA",
      darkIconBg: "rgba(217,119,6,0.18)",
      border: "#F9DBAF",
      gradient: ["#FFFFFF", "#FFF7ED"],
      darkGradient: ["#2B1F14", "#161B22"]
    },
    {
      id: "resume_builder",
      label: isKid ? "Story & Drawing" : isHighSchool ? "Study Planner" : "AI Resume Builder",
      description: isMentor
        ? "Review student resumes and prepare sharper improvement suggestions."
        : isKid
          ? "Use ORIN for storytelling, creativity prompts, and simple self-expression tasks."
          : isHighSchool
            ? "Turn goals and school tasks into a simpler study plan."
            : "Create resume draft from profile and activity data.",
      icon: isKid ? "brush" : isHighSchool ? "calendar" : "document-text",
      path: isKid ? "/ai/creative-corner" : isHighSchool ? "/ai/study-planner" : "/ai/resume-builder",
      iconColor: "#DC2626",
      iconBg: "#FEE2E2",
      darkIconBg: "rgba(220,38,38,0.18)",
      border: "#FDA29B",
      gradient: ["#FFFFFF", "#FEF3F2"],
      darkGradient: ["#2D171A", "#161B22"]
    },
    {
      id: "assistant",
      label: isKid ? "Ask ORIN" : "AI Assistant",
      description: isMentor
        ? "Open your mentoring assistant for session preparation and student guidance support."
        : isKid
          ? "Open a simpler AI helper for class doubts, learning help, and guided support."
          : "Open AI chat for personalized answers and guidance.",
      icon: "chatbubbles",
      path: "/ai/assistant",
      iconColor: "#7C3AED",
      iconBg: "#F3E8FF",
      darkIconBg: "rgba(124,58,237,0.18)",
      border: "#D6BBFB",
      gradient: ["#FFFFFF", "#F9F5FF"],
      darkGradient: ["#22182F", "#111827"]
    }
  ];

  const filteredModules = modules.filter((item) =>
    `${item.label} ${item.description}`.toLowerCase().includes(searchQuery.trim().toLowerCase())
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GlobalHeader
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        onSubmitSearch={() => null}
        searchPlaceholder="Search AI tools"
      />
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.text }]}>AI</Text>
      <Text style={[styles.sub, { color: colors.textMuted }]}>
        {isMentor
          ? "Open a mentor-focused AI tool to prepare sessions, guide students, and improve mentoring delivery."
          : isKid
            ? "Open simple AI learning tools chosen for younger students."
            : isHighSchool
              ? "Open guided AI tools for study planning, projects, and school growth."
              : "Open a module to go to its dedicated full page."}
      </Text>

      <View style={styles.moduleStack}>
        {filteredModules.map((item) => (
          <TouchableOpacity key={item.id} activeOpacity={0.92} onPress={() => router.push(item.path as never)}>
            <LinearGradient
              colors={isDark ? item.darkGradient : item.gradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.moduleCard, { borderColor: isDark ? item.iconColor : item.border, shadowColor: item.iconColor, shadowOpacity: isDark ? 0.18 : 0.08 }]}
            >
              <View style={[styles.moduleIconWrap, { backgroundColor: isDark ? item.darkIconBg : item.iconBg, borderColor: isDark ? `${item.iconColor}55` : "transparent" }]}>
                <Ionicons name={item.icon} size={20} color={item.iconColor} />
              </View>
              <View style={styles.moduleTextWrap}>
                <Text style={[styles.moduleTitle, { color: colors.text }]}>{item.label}</Text>
                <Text style={[styles.moduleDesc, { color: colors.textMuted }]}>{item.description}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </LinearGradient>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: "#F3F6FB", gap: 10 },
  title: { fontSize: 28, fontWeight: "800", color: "#11261E" },
  sub: { color: "#475467" },
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
  moduleIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: "rgba(255,255,255,0.95)",
    alignItems: "center",
    justifyContent: "center"
  },
  moduleTextWrap: { flex: 1, gap: 2 },
  moduleTitle: { color: "#1E2B24", fontWeight: "800", fontSize: 15 },
  moduleDesc: { color: "#667085", fontSize: 12, lineHeight: 16 }
});
