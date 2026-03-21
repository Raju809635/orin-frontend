import React from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "@/context/AuthContext";
import GlobalHeader from "@/components/global-header";

type AiModule = {
  id: string;
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  path: string;
  border: string;
  gradient: [string, string];
};

export default function AiHubScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const isMentor = user?.role === "mentor";
  const [searchQuery, setSearchQuery] = React.useState("");

  const modules: AiModule[] = [
    {
      id: "mentor_matching",
      label: "AI Mentor Matching",
      description: isMentor
        ? "Identify students whose goals and interests align with your mentoring domains."
        : "Find best-fit mentors with match score and experience insights.",
      icon: "sparkles",
      path: "/ai/mentor-matching",
      border: "#A4BCFD",
      gradient: ["#FFFFFF", "#EEF4FF"]
    },
    {
      id: "skill_gap",
      label: "AI Skill Gap Analysis",
      description: isMentor
        ? "Review likely student skill gaps before sessions and plan better guidance."
        : "Identify missing skills and course suggestions for your goal.",
      icon: "analytics",
      path: "/ai/skill-gap",
      border: "#C4B5FD",
      gradient: ["#FFFFFF", "#F4F3FF"]
    },
    {
      id: "roadmap",
      label: "AI Career Roadmap",
      description: isMentor
        ? "Generate structured mentoring plans and milestone-based guidance for mentees."
        : "Get your step-by-step path and next milestones.",
      icon: "map",
      path: "/ai/career-roadmap",
      border: "#ABEFC6",
      gradient: ["#FFFFFF", "#ECFDF3"]
    },
    {
      id: "project_ideas",
      label: "AI Project Ideas",
      description: isMentor
        ? "Generate assignments, practice tasks, and project suggestions for students."
        : "Generate practical project ideas aligned to your career track.",
      icon: "bulb",
      path: "/ai/project-ideas",
      border: "#F9DBAF",
      gradient: ["#FFFFFF", "#FFF7ED"]
    },
    {
      id: "resume_builder",
      label: "AI Resume Builder",
      description: isMentor
        ? "Review student resumes and prepare sharper improvement suggestions."
        : "Create resume draft from profile and activity data.",
      icon: "document-text",
      path: "/ai/resume-builder",
      border: "#FDA29B",
      gradient: ["#FFFFFF", "#FEF3F2"]
    },
    {
      id: "assistant",
      label: "AI Assistant",
      description: isMentor
        ? "Open your mentoring assistant for session preparation and student guidance support."
        : "Open AI chat for personalized answers and guidance.",
      icon: "chatbubbles",
      path: "/ai/assistant",
      border: "#D6BBFB",
      gradient: ["#FFFFFF", "#F9F5FF"]
    }
  ];

  const filteredModules = modules.filter((item) =>
    `${item.label} ${item.description}`.toLowerCase().includes(searchQuery.trim().toLowerCase())
  );

  return (
    <View style={{ flex: 1, backgroundColor: "#F3F6FB" }}>
      <GlobalHeader
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        onSubmitSearch={() => null}
        searchPlaceholder="Search AI tools"
      />
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>AI</Text>
      <Text style={styles.sub}>
        {isMentor
          ? "Open a mentor-focused AI tool to prepare sessions, guide students, and improve mentoring delivery."
          : "Open a module to go to its dedicated full page."}
      </Text>

      <View style={styles.moduleStack}>
        {filteredModules.map((item) => (
          <TouchableOpacity key={item.id} activeOpacity={0.92} onPress={() => router.push(item.path as never)}>
            <LinearGradient colors={item.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.moduleCard, { borderColor: item.border }]}>
              <View style={styles.moduleIconWrap}>
                <Ionicons name={item.icon} size={20} color="#1F7A4C" />
              </View>
              <View style={styles.moduleTextWrap}>
                <Text style={styles.moduleTitle}>{item.label}</Text>
                <Text style={styles.moduleDesc}>{item.description}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#98A2B3" />
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
    backgroundColor: "rgba(255,255,255,0.95)",
    alignItems: "center",
    justifyContent: "center"
  },
  moduleTextWrap: { flex: 1, gap: 2 },
  moduleTitle: { color: "#1E2B24", fontWeight: "800", fontSize: 15 },
  moduleDesc: { color: "#667085", fontSize: 12, lineHeight: 16 }
});
