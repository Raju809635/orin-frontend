import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

export default function TermsScreen() {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Terms of Use</Text>
        <Text style={styles.text}>
          By using ORIN, you agree to use the platform responsibly for mentorship and educational collaboration.
        </Text>
        <Text style={styles.subtitle}>Core Terms</Text>
        <Text style={styles.text}>- Respectful communication is mandatory</Text>
        <Text style={styles.text}>- No fraudulent bookings or fake payment proofs</Text>
        <Text style={styles.text}>- Mentors and students must follow scheduled session timings</Text>
        <Text style={styles.text}>- Admin decisions on approvals and payment verification are final</Text>
        <Text style={styles.subtitle}>Violation Handling</Text>
        <Text style={styles.text}>Accounts may be restricted or removed for abuse, impersonation, or policy violations.</Text>
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
  subtitle: { marginTop: 12, marginBottom: 4, fontSize: 16, fontWeight: "700", color: "#1F7A4C" },
  text: { color: "#475467", lineHeight: 22, marginBottom: 4 }
});
