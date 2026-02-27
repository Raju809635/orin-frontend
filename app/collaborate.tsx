import React, { useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { api } from "@/lib/api";

type CollaborateType = "leader" | "founder" | "mentor";

const sections: Array<{ key: CollaborateType; title: string; description: string }> = [
  {
    key: "leader",
    title: "For Community Leaders",
    description: "Partner with ORIN to support student communities, campus clubs and growth programs."
  },
  {
    key: "founder",
    title: "For Founders & Startups",
    description: "Collaborate to mentor early talent, run startup workshops and hire strong learners."
  },
  {
    key: "mentor",
    title: "For Industry Mentors",
    description: "Join ORIN mentor network and guide students across academics, exams and careers."
  }
];

export default function CollaborateScreen() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [organization, setOrganization] = useState("");
  const [message, setMessage] = useState("");
  const [type, setType] = useState<CollaborateType>("leader");
  const [submitting, setSubmitting] = useState(false);

  async function applyNow(nextType: CollaborateType) {
    try {
      setType(nextType);
      setSubmitting(true);
      await api.post("/api/collaborate/apply", {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        organization: organization.trim(),
        type: nextType,
        message: message.trim()
      });
      Alert.alert("Application Sent", "Thanks. Our team will contact you.");
      setMessage("");
    } catch (error: any) {
      Alert.alert("Unable to submit", error?.response?.data?.message || "Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.heading}>Collaborate With Us</Text>
      <Text style={styles.subheading}>Open for students and mentors.</Text>

      <Text style={styles.label}>Name</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName} />
      <Text style={styles.label}>Email</Text>
      <TextInput style={styles.input} value={email} onChangeText={setEmail} autoCapitalize="none" />
      <Text style={styles.label}>Organization</Text>
      <TextInput style={styles.input} value={organization} onChangeText={setOrganization} />
      <Text style={styles.label}>Message</Text>
      <TextInput style={[styles.input, styles.multiline]} value={message} onChangeText={setMessage} multiline />

      {sections.map((section) => (
        <View key={section.key} style={styles.card}>
          <Text style={styles.cardTitle}>{section.title}</Text>
          <Text style={styles.cardBody}>{section.description}</Text>
          <TouchableOpacity style={styles.button} disabled={submitting} onPress={() => applyNow(section.key)}>
            <Text style={styles.buttonText}>
              {submitting && section.key === type ? "Submitting..." : "Apply Now"}
            </Text>
          </TouchableOpacity>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: "#F4F9F6", padding: 20 },
  heading: { fontSize: 28, fontWeight: "700", color: "#0B3D2E" },
  subheading: { marginTop: 6, marginBottom: 14, color: "#475467" },
  label: { color: "#344054", fontWeight: "600", marginTop: 8, marginBottom: 6 },
  input: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#D0D5DD",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  multiline: { minHeight: 90, textAlignVertical: "top" },
  card: {
    marginTop: 14,
    borderWidth: 1,
    borderColor: "#D5E5DC",
    borderRadius: 14,
    backgroundColor: "#fff",
    padding: 14
  },
  cardTitle: { fontSize: 18, fontWeight: "700", color: "#0B3D2E" },
  cardBody: { color: "#344054", marginTop: 4, lineHeight: 20 },
  button: { marginTop: 10, backgroundColor: "#0B3D2E", borderRadius: 10, alignItems: "center", paddingVertical: 10 },
  buttonText: { color: "#fff", fontWeight: "700" }
});

