import React from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/context/AuthContext";

type Item = { title: string; desc: string; route: string };

export default function CommunityGrowthScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const growthRoute = user?.role === "mentor" ? "/mentor-dashboard?section=growth" : "/student-dashboard?section=growth";

  const items: Item[] = [
    { title: "Community & Collaboration", desc: "Connect with initiatives and platform collaboration.", route: "/collaborate" },
    { title: "Community Challenges", desc: "Join challenges and track participation.", route: growthRoute },
    { title: "ORIN Certification", desc: "View certification tracks and levels.", route: growthRoute },
    { title: "Internship Opportunities", desc: "Discover opportunities and internships.", route: growthRoute },
    { title: "College Leaderboard", desc: "Track rank and community standing.", route: growthRoute },
    { title: "Knowledge Library", desc: "Access curated learning resources.", route: growthRoute },
    { title: "Reputation & Ranking", desc: "Monitor score, level and top percentile.", route: growthRoute }
  ];

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Community & Growth</Text>
      <Text style={styles.sub}>Community engagement and long-term career growth modules.</Text>
      {items.map((item) => (
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
