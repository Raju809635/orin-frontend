import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

export default function HelpScreen() {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Help & Support</Text>
        <Text style={styles.text}>If you face issues, use in-app sections first:</Text>
        <Text style={styles.text}>- Students: Complaints section for booking/payment/report issues</Text>
        <Text style={styles.text}>- Mentors: Admin Chat for operational support</Text>
        <Text style={styles.text}>- Settings: Password reset and account management</Text>
        <Text style={styles.subtitle}>Support Workflow</Text>
        <Text style={styles.text}>1. Submit clear description with screenshot</Text>
        <Text style={styles.text}>2. Include session date/time if session-related</Text>
        <Text style={styles.text}>3. Admin reviews and responds through dashboard workflows</Text>
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
