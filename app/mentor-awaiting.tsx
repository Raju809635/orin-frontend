import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

const MODE_COPY: Record<string, { title: string; body: string }> = {
  global_mentor: {
    title: "Global Mentor Review",
    body: "Your global mentor registration is submitted. Admin will review your profile before public mentorship tools unlock."
  },
  institution_teacher: {
    title: "Global Teacher Review",
    body: "Your global teacher registration is submitted. Admin will verify your institution and assigned classes before high-school teacher tools unlock."
  },
  organisation_head: {
    title: "Legacy Organisation Head Review",
    body: "Your legacy organisation head registration is submitted. Admin will verify your school or institution authority before management tools unlock."
  }
};

export default function MentorAwaitingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string }>();
  const modeCopy = MODE_COPY[String(params.mode || "")] || MODE_COPY.global_mentor;

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.kicker}>Waiting for Admin Approval</Text>
        <Text style={styles.title}>{modeCopy.title}</Text>
        <Text style={styles.body}>
          {modeCopy.body} Please login after approval to access your dashboard and profile editing.
        </Text>
        <TouchableOpacity style={styles.button} onPress={() => router.replace("/login" as never)}>
          <Text style={styles.buttonText}>Go to Login</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F4F9F6", alignItems: "center", justifyContent: "center", padding: 20 },
  card: { width: "100%", maxWidth: 420, backgroundColor: "#fff", borderRadius: 16, borderWidth: 1, borderColor: "#D3E4DB", padding: 18 },
  kicker: { color: "#1F7A4C", fontWeight: "800", marginBottom: 6 },
  title: { fontSize: 24, fontWeight: "700", color: "#0B3D2E", marginBottom: 8 },
  body: { color: "#344054", lineHeight: 22 },
  button: { marginTop: 16, backgroundColor: "#0B3D2E", borderRadius: 12, alignItems: "center", paddingVertical: 12 },
  buttonText: { color: "#fff", fontWeight: "700" }
});
