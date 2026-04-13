import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

export default function PrivacyScreen() {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Privacy Policy</Text>
        <Text style={styles.text}>
          ORIN collects the information needed to provide mentorship, live sessions, sprint programs,
          AI tools, certificates, social feed features, chat, notifications, and payment handling.
        </Text>
        <Text style={styles.subtitle}>Data We Use</Text>
        <Text style={styles.text}>- Account and profile details</Text>
        <Text style={styles.text}>- Session, live program, sprint, and certificate data</Text>
        <Text style={styles.text}>- Razorpay/manual payment and payout verification data</Text>
        <Text style={styles.text}>- Posts, chat, notifications, complaints, and support records</Text>
        <Text style={styles.text}>- Uploaded media/files such as profile photos, posters, resumes, and screenshots</Text>
        <Text style={styles.subtitle}>Your Controls</Text>
        <Text style={styles.text}>
          You can update profile data, change password, and request account deletion from Settings.
        </Text>
        <Text style={styles.subtitle}>Public Policy</Text>
        <Text style={styles.text}>Full policy URL: https://orin-privacy-policy.vercel.app/privacy-policy</Text>
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
