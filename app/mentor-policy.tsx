import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export default function MentorPolicyScreen() {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.heroCard}>
        <View style={styles.heroRow}>
          <View style={styles.heroIconWrap}>
            <Ionicons name="shield-checkmark" size={18} color="#9A3412" />
          </View>
          <Text style={styles.heroTitle}>Mentor Policy & Responsibility</Text>
        </View>
        <Text style={styles.heroText}>
          This page defines mentor responsibilities for handling students, conducting sessions, and working on ORIN.
        </Text>
      </View>

      <View style={[styles.sectionCard, styles.commissionCard]}>
        <Text style={styles.sectionTitle}>Commission Structure</Text>
        <Text style={styles.sectionText}>Platform commission: 30% per paid session.</Text>
        <Text style={styles.sectionText}>Mentor payout: 70% per paid session.</Text>
        <Text style={styles.sectionText}>
          Payout processing: Admin sends mentor payout after session is booked and mentor confirms completion.
        </Text>
        <Text style={styles.sectionText}>
          Payout destination: Mentor must provide valid bank account or UPI details to receive payout.
        </Text>
        <Text style={styles.noteText}>
          Commission helps ORIN maintain platform operations, support, moderation, and technical infrastructure.
        </Text>
      </View>

      <View style={[styles.sectionCard, styles.responsibilityCard]}>
        <Text style={styles.sectionTitle}>Mentor Responsibilities</Text>
        <Text style={styles.bullet}>- Conduct sessions professionally and on time.</Text>
        <Text style={styles.bullet}>- Share meeting links and session instructions clearly.</Text>
        <Text style={styles.bullet}>- Guide students based on domain and sub-domain expertise.</Text>
        <Text style={styles.bullet}>- Maintain respectful communication and ethical behavior.</Text>
        <Text style={styles.bullet}>- Handle session quality, content delivery, and follow-up.</Text>
      </View>

      <View style={[styles.sectionCard, styles.liabilityCard]}>
        <Text style={styles.sectionTitle}>Platform Responsibility Limits</Text>
        <Text style={styles.sectionText}>
          ORIN provides discovery, booking, and payment workflow support. Mentors are independently responsible for
          session conduct, teaching quality, and interactions with students.
        </Text>
        <Text style={styles.sectionText}>
          The platform is not responsible for mentor-specific promises, personal commitments, or outcomes claimed
          outside listed platform workflows.
        </Text>
      </View>

      <View style={[styles.sectionCard, styles.complianceCard]}>
        <Text style={styles.sectionTitle}>Compliance Reminder</Text>
        <Text style={styles.bullet}>- Confirm and keep your bank/UPI payout details updated and accurate.</Text>
        <Text style={styles.bullet}>- You can directly chat with Admin in the Mentor Dashboard (Admin Chat) for payout or policy support.</Text>
        <Text style={styles.bullet}>- Follow platform terms, community standards, and applicable laws.</Text>
        <Text style={styles.bullet}>- Avoid harassment, abuse, false guarantees, and misleading claims.</Text>
        <Text style={styles.bullet}>- Violations may lead to warnings, suspension, or account removal.</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#F3F5F7",
    padding: 18,
    paddingBottom: 28
  },
  heroCard: {
    backgroundColor: "#FFF7ED",
    borderColor: "#F7DCCB",
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12
  },
  heroRow: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  heroIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#FEEAD9",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 9
  },
  heroTitle: { color: "#7C2D12", fontSize: 20, fontWeight: "800" },
  heroText: { color: "#7A4D2A", lineHeight: 20, fontWeight: "500" },
  sectionCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 13,
    marginBottom: 10
  },
  commissionCard: { backgroundColor: "#EEF4FF", borderColor: "#D3E1FF" },
  responsibilityCard: { backgroundColor: "#ECFDF3", borderColor: "#CBECD9" },
  liabilityCard: { backgroundColor: "#FDF2FA", borderColor: "#F8DCEE" },
  complianceCard: { backgroundColor: "#F5F3FF", borderColor: "#DED8FF" },
  sectionTitle: { color: "#1E2B24", fontSize: 16, fontWeight: "800", marginBottom: 8 },
  sectionText: { color: "#475467", lineHeight: 20, marginBottom: 6 },
  noteText: { color: "#344054", lineHeight: 20, fontWeight: "600", marginTop: 2 },
  bullet: { color: "#475467", lineHeight: 20, marginBottom: 4 }
});
