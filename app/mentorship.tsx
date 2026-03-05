import React from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/context/AuthContext";

type LinkCard = {
  title: string;
  desc: string;
  route: string;
};

export default function MentorshipHubScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const isMentor = user?.role === "mentor";
  const growthRoute = isMentor ? "/mentor-dashboard?section=growth" : "/student-dashboard?section=growth";

  const discovery: LinkCard[] = [
    { title: "Domains", desc: "Browse mentorship domains and mentor categories.", route: "/domains" },
    { title: "Domain Guide", desc: "Understand domains and sub-domains in detail.", route: "/domain-guide" },
    { title: "Verified Mentor System", desc: "Trusted mentor cards and quality signals.", route: growthRoute }
  ];

  const interaction: LinkCard[] = [
    { title: "Mentor Groups", desc: "Join group-based learning with mentors.", route: growthRoute },
    { title: "Mentor Live Sessions", desc: "Discover upcoming live mentor sessions.", route: growthRoute }
  ];

  const sessionMgmt: LinkCard[] = isMentor
    ? [
        { title: "Session Requests", desc: "Review and manage incoming booking requests.", route: "/mentor-dashboard?section=requests" },
        { title: "Sessions", desc: "Track confirmed sessions and update meeting links.", route: "/mentor-dashboard?section=sessions" },
        { title: "Availability", desc: "Set weekly and date-specific slots.", route: "/mentor-dashboard?section=availability" }
      ]
    : [
        { title: "Session History & Notes", desc: "Review completed sessions and add notes.", route: "/student-dashboard?section=sessions" },
        { title: "Pending Payments", desc: "Complete payment upload or cancel pending sessions.", route: "/student-dashboard?section=sessions" },
        { title: "Awaiting Verification", desc: "Track submitted payments under review.", route: "/student-dashboard?section=sessions" },
        { title: "Confirmed Sessions", desc: "Open confirmed sessions and join links.", route: "/student-dashboard?section=sessions" },
        { title: "Legacy Booking Requests", desc: "View old request flow sessions.", route: "/student-dashboard?section=sessions" }
      ];

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Mentorship</Text>
      <Text style={styles.sub}>All mentorship discovery, interaction, and sessions in one place.</Text>

      <Section title="Discovery" items={discovery} onOpen={(route) => router.push(route as never)} />
      <Section title="Interaction" items={interaction} onOpen={(route) => router.push(route as never)} />
      <Section title="Session Management" items={sessionMgmt} onOpen={(route) => router.push(route as never)} />
    </ScrollView>
  );
}

function Section({ title, items, onOpen }: { title: string; items: LinkCard[]; onOpen: (route: string) => void }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {items.map((item) => (
        <TouchableOpacity key={`${title}-${item.title}`} style={styles.card} onPress={() => onOpen(item.route)}>
          <Text style={styles.cardTitle}>{item.title}</Text>
          <Text style={styles.cardDesc}>{item.desc}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: "#F4F9F6", gap: 14 },
  title: { fontSize: 28, fontWeight: "800", color: "#11261E" },
  sub: { marginTop: 4, color: "#475467" },
  section: { gap: 8 },
  sectionTitle: { marginTop: 8, fontSize: 16, fontWeight: "800", color: "#1E2B24" },
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
