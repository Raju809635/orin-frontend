import React from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "@/context/AuthContext";

type CommunityModule = {
  id: string;
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  path: string;
  border: string;
  gradient: [string, string];
};

export default function CommunityGrowthScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const isMentor = user?.role === "mentor";

  const modules: CommunityModule[] = [
    {
      id: "collaboration",
      label: "Community & Collaboration",
      description: isMentor
        ? "Collaborate with other mentors, support initiatives, and grow your mentoring network."
        : "Join ORIN collaboration initiatives and partnerships.",
      icon: "people",
      path: "/community/collaboration",
      border: "#D6BBFB",
      gradient: ["#FFFFFF", "#F9F5FF"]
    },
    {
      id: "challenges",
      label: "Challenges",
      description: isMentor
        ? "Join mentoring challenges and contribute structured learning activities."
        : "Participate in monthly challenges and competitions.",
      icon: "trophy",
      path: "/community/challenges",
      border: "#F9DBAF",
      gradient: ["#FFFFFF", "#FFF7ED"]
    },
    {
      id: "certifications",
      label: "Certifications",
      description: isMentor
        ? "Track certification tracks you can recommend, review, or contribute toward."
        : "Explore ORIN certifications and level progression.",
      icon: "ribbon",
      path: "/community/certifications",
      border: "#A4BCFD",
      gradient: ["#FFFFFF", "#EEF4FF"]
    },
    {
      id: "opportunities",
      label: "Internship Opportunities",
      description: isMentor
        ? "Track opportunities you can share with students and your mentoring circle."
        : "Discover internships and career opportunities.",
      icon: "briefcase",
      path: "/community/opportunities",
      border: "#ABEFC6",
      gradient: ["#FFFFFF", "#ECFDF3"]
    },
    {
      id: "leaderboard",
      label: "College Leaderboard",
      description: isMentor
        ? "See where your students and mentoring community are performing across colleges."
        : "Check rankings and top students in your college.",
      icon: "podium",
      path: "/community/leaderboard",
      border: "#F9DBAF",
      gradient: ["#FFFFFF", "#FFF7ED"]
    },
    {
      id: "library",
      label: "Knowledge Library",
      description: isMentor
        ? "Contribute guides, mentoring notes, and reusable learning resources."
        : "Access resources, guides, and interview prep.",
      icon: "library",
      path: "/community/knowledge-library",
      border: "#B2DDFF",
      gradient: ["#FFFFFF", "#EFF8FF"]
    },
    {
      id: "reputation",
      label: "Reputation & Ranking",
      description: isMentor
        ? "Track your mentor reputation, ranking, and trust indicators inside ORIN."
        : "Track your score, tag, and percentile performance.",
      icon: "stats-chart",
      path: "/community/reputation",
      border: "#FDA29B",
      gradient: ["#FFFFFF", "#FEF3F2"]
    }
  ];

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Community & Growth</Text>
      <Text style={styles.sub}>
        {isMentor
          ? "Use community tools to collaborate with mentors, contribute knowledge, and track your mentor standing."
          : "Open a module to go to its dedicated full page."}
      </Text>

      <View style={styles.moduleStack}>
        {modules.map((item) => (
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
