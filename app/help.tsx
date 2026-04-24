import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

const SECTIONS: { title: string; body: string[] }[] = [
  {
    title: "Best First Steps",
    body: [
      "Check the relevant in-app screen first: profile, sessions, roadmap, community, institution area, or payments.",
      "Refresh the page or reopen the app once if the issue looks like stale data or a recent update mismatch.",
      "If the problem affects a specific session, roadmap week, payment, proof upload, or complaint, include the exact screen and date in your report."
    ]
  },
  {
    title: "Where To Get Help",
    body: [
      "Students can use Complaints for booking issues, payment problems, mentor issues, technical blockers, and general support.",
      "Mentors can use Admin Chat and mentor workflows for payout, session, verification, and operational questions.",
      "Profile and account issues should first be checked from your profile/settings area where applicable."
    ]
  },
  {
    title: "What To Include",
    body: [
      "Clear subject and short summary of the problem.",
      "Screenshot or proof when available.",
      "Session date, payment reference, roadmap week, institution name, or feature name if the issue is tied to a specific workflow.",
      "What you expected to happen and what actually happened."
    ]
  },
  {
    title: "Current ORIN Support Areas",
    body: [
      "Login and account access",
      "Mentor bookings, live sessions, and sprint workflows",
      "Payments, manual verification, and payout-related issues",
      "AI assistant, AI roadmap, project ideas, and knowledge library behavior",
      "Community posts, comments, circles, and moderation issues",
      "Institution roadmaps, institution resources, and institution-linked student flows"
    ]
  }
];

export default function HelpScreen() {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Help & Support</Text>
        <Text style={styles.intro}>
          ORIN support works best when the issue is tied to the exact workflow where it happened, such as session
          booking, roadmap proof, payment verification, community activity, or institution features.
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

        <View style={styles.section}>
          <Text style={styles.subtitle}>Contact</Text>
          <Text style={styles.text}>- Support email: orin2k26@gmail.com</Text>
          <Text style={styles.text}>- Complaints and policy flows remain available inside the app.</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: "#F4F9F6", padding: 20 },
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
