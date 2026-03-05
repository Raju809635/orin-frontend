import React from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/context/AuthContext";

export default function AiHubScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const isMentor = user?.role === "mentor";

  const studentRoute = "/student-dashboard?section=growth";
  const mentorRoute = "/mentor-dashboard?section=growth";

  const items = [
    { title: "AI Mentor Matching", desc: "Get mentor recommendations with match score.", route: studentRoute },
    { title: "AI Skill Gap Analyzer", desc: "See missing skills and suggested next steps.", route: studentRoute },
    { title: "AI Career Roadmap", desc: "Follow a structured step-by-step plan.", route: studentRoute },
    { title: "AI Project Idea Generator", desc: "Generate project ideas based on your goals.", route: studentRoute },
    { title: "AI Resume Builder", desc: "Build and preview a resume from your profile.", route: studentRoute },
    { title: "AI Assistant", desc: "Ask career and mentorship questions directly.", route: "/ai-assistant" },
    { title: "Mentor AI Workspace", desc: "Use mentor-focused AI growth and guidance modules.", route: mentorRoute }
  ];

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>AI Hub</Text>
      <Text style={styles.sub}>Career intelligence and AI-powered planning modules.</Text>
      {items
        .filter((item) => (isMentor ? true : item.title !== "Mentor AI Workspace"))
        .map((item) => (
          <TouchableOpacity key={item.title} style={styles.card} onPress={() => router.push(item.route as never)}>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.cardDesc}>{item.desc}</Text>
          </TouchableOpacity>
        ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: "#F4F9F6", gap: 10 },
  title: { fontSize: 28, fontWeight: "800", color: "#11261E" },
  sub: { marginTop: 4, marginBottom: 2, color: "#475467" },
  card: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DDE6E1",
    borderRadius: 12,
    padding: 12
  },
  cardTitle: { color: "#1E2B24", fontWeight: "800" },
  cardDesc: { marginTop: 4, color: "#667085" }
});
