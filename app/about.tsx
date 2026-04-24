import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

const SECTIONS: { title: string; body: string[] }[] = [
  {
    title: "What ORIN Is",
    body: [
      "ORIN is a student-first growth platform built around mentorship, guided learning, AI support, community, and institution-based journeys.",
      "It is designed to help learners move from confusion to action using roadmaps, projects, support systems, and real mentor interaction."
    ]
  },
  {
    title: "Current Experiences",
    body: [
      "AI guidance including assistant, career roadmap, project ideas, skill-aware progression, and resume support.",
      "Mentorship experiences including mentor discovery, profile matching, session bookings, chat, live-session support, and sprint workflows.",
      "Community experiences including posts, comments, reactions, circles, collaboration, challenges, certifications, opportunities, and knowledge library.",
      "Institution experiences including institution feed, institution resources, institution mentors, institution leaderboard, institution roadmaps, and class-ready support."
    ]
  },
  {
    title: "Who Uses ORIN",
    body: [
      "Students and early learners use ORIN to plan goals, get guidance, build proof of work, and grow through community and institution support.",
      "Mentors use ORIN to guide learners, manage sessions, run programs, review roadmap submissions, and contribute learning resources.",
      "Admins use ORIN to review approvals, moderate content, manage payouts, verify workflows, and keep the platform safe and reliable."
    ]
  },
  {
    title: "Product Direction",
    body: [
      "ORIN currently focuses strongly on school and institution-friendly flows while keeping the platform flexible for broader domains over time.",
      "The product is moving toward clearer guided journeys where roadmap progress, projects, resources, and institution programs work together without confusing the learner."
    ]
  }
];

export default function AboutScreen() {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>About ORIN</Text>
        <Text style={styles.intro}>
          ORIN combines AI guidance, real mentorship, community learning, and institution-based growth into one mobile
          learning platform.
        </Text>

        {SECTIONS.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.subtitle}>{section.title}</Text>
            {section.body.map((item) => (
              <Text key={`${section.title}-${item}`} style={styles.text}>
                - {item}
              </Text>
            ))}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: "#F4F9F6",
    padding: 20
  },
  card: {
    backgroundColor: "#fff",
    borderColor: "#E4E7EC",
    borderWidth: 1,
    borderRadius: 14,
    padding: 16
  },
  title: { fontSize: 24, fontWeight: "800", color: "#1E2B24", marginBottom: 8 },
  intro: { color: "#475467", lineHeight: 22 },
  section: { marginTop: 14 },
  subtitle: { marginTop: 4, marginBottom: 4, fontSize: 16, fontWeight: "700", color: "#1F7A4C" },
  text: { color: "#475467", lineHeight: 22, marginBottom: 4 }
});
