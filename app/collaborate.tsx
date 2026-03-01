import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { api } from "@/lib/api";

type CollaborateType = "leader" | "founder" | "mentor";
type ApplicationStatus = "pending" | "approved" | "rejected";
type ApplicationRecord = {
  _id: string;
  name: string;
  email: string;
  type: CollaborateType;
  organization?: string;
  message?: string;
  status: ApplicationStatus;
  adminNotes?: string;
  reviewedAt?: string;
  createdAt: string;
};

const sections: { key: CollaborateType; title: string; description: string }[] = [
  {
    key: "leader",
    title: "Community Leader",
    description: "Run campus and learning communities with ORIN mentorship support."
  },
  {
    key: "founder",
    title: "Founder / Startup",
    description: "Partner for workshops, talent pipelines, startup mentoring and hiring."
  },
  {
    key: "mentor",
    title: "Industry Mentor",
    description: "Contribute as a mentor and guide students in careers and interviews."
  }
];

export default function CollaborateScreen() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [organization, setOrganization] = useState("");
  const [message, setMessage] = useState("");
  const [type, setType] = useState<CollaborateType>("leader");
  const [submitting, setSubmitting] = useState(false);
  const [checking, setChecking] = useState(false);
  const [applications, setApplications] = useState<ApplicationRecord[]>([]);

  const selectedInfo = useMemo(
    () => sections.find((section) => section.key === type),
    [type]
  );

  async function applyNow() {
    if (!name.trim() || !email.trim()) {
      Alert.alert("Required", "Please fill name and email.");
      return;
    }

    try {
      setSubmitting(true);
      await api.post("/api/collaborate/apply", {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        organization: organization.trim(),
        type,
        message: message.trim()
      });
      Alert.alert(
        "Submitted",
        "Your collaboration request is submitted. Admin team will review and contact you."
      );
      setMessage("");
      await fetchStatus(email.trim().toLowerCase());
    } catch (error: any) {
      Alert.alert("Unable to submit", error?.response?.data?.message || "Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function fetchStatus(explicitEmail?: string) {
    const targetEmail = (explicitEmail || email).trim().toLowerCase();
    if (!targetEmail) {
      Alert.alert("Required", "Enter your email to check admin review status.");
      return;
    }

    try {
      setChecking(true);
      const response = await api.get<ApplicationRecord[]>("/api/collaborate/status", {
        params: { email: targetEmail }
      });
      setApplications(response.data || []);
    } catch (error: any) {
      Alert.alert("Unable to fetch", error?.response?.data?.message || "Please try again.");
    } finally {
      setChecking(false);
    }
  }

  function statusStyles(status: ApplicationStatus) {
    if (status === "approved") {
      return {
        badge: styles.badgeApproved,
        text: styles.badgeApprovedText,
        label: "Approved"
      };
    }

    if (status === "rejected") {
      return {
        badge: styles.badgeRejected,
        text: styles.badgeRejectedText,
        label: "Rejected"
      };
    }

    return {
      badge: styles.badgePending,
      text: styles.badgePendingText,
      label: "Pending Review"
    };
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.heading}>Collaborate With ORIN</Text>
      <Text style={styles.subheading}>
        Submit your proposal. Admin reviews every request before approval.
      </Text>

      <View style={styles.timelineCard}>
        <Text style={styles.timelineTitle}>How It Works</Text>
        <Text style={styles.timelineItem}>1. Submit collaboration request</Text>
        <Text style={styles.timelineItem}>2. Admin reviews details</Text>
        <Text style={styles.timelineItem}>3. Approved requests move to onboarding</Text>
      </View>

      <View style={styles.roleWrap}>
        {sections.map((section) => {
          const active = type === section.key;
          return (
            <TouchableOpacity
              key={section.key}
              style={[styles.roleChip, active && styles.roleChipActive]}
              onPress={() => setType(section.key)}
            >
              <Text style={[styles.roleChipText, active && styles.roleChipTextActive]}>{section.title}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>{selectedInfo?.title}</Text>
        <Text style={styles.infoText}>{selectedInfo?.description}</Text>
      </View>

      <View style={styles.formCard}>
        <Text style={styles.label}>Full Name</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Your name" />

        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="name@example.com"
        />

        <Text style={styles.label}>Organization</Text>
        <TextInput style={styles.input} value={organization} onChangeText={setOrganization} placeholder="Organization (optional)" />

        <Text style={styles.label}>Proposal Message</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          value={message}
          onChangeText={setMessage}
          multiline
          placeholder="Tell us what collaboration you want."
        />

        <TouchableOpacity style={styles.button} disabled={submitting} onPress={applyNow}>
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Submit For Admin Review</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.buttonGhost]}
          disabled={checking}
          onPress={() => fetchStatus()}
        >
          {checking ? (
            <ActivityIndicator color="#0B3D2E" />
          ) : (
            <Text style={styles.buttonGhostText}>Check My Request Status</Text>
          )}
        </TouchableOpacity>
      </View>

      {applications.length > 0 ? (
        <View style={styles.formCard}>
          <Text style={styles.infoTitle}>Your Applications</Text>
          {applications.map((item) => {
            const ui = statusStyles(item.status);
            return (
              <View key={item._id} style={styles.appCard}>
                <View style={styles.appRow}>
                  <Text style={styles.appRole}>{item.type.toUpperCase()}</Text>
                  <View style={[styles.badgeBase, ui.badge]}>
                    <Text style={[styles.badgeTextBase, ui.text]}>{ui.label}</Text>
                  </View>
                </View>
                <Text style={styles.appMeta}>
                  Submitted: {new Date(item.createdAt).toLocaleString()}
                </Text>
                {item.reviewedAt ? (
                  <Text style={styles.appMeta}>
                    Reviewed: {new Date(item.reviewedAt).toLocaleString()}
                  </Text>
                ) : null}
                {item.adminNotes ? (
                  <Text style={styles.adminNotes}>Admin notes: {item.adminNotes}</Text>
                ) : null}
              </View>
            );
          })}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: "#F4F9F6", padding: 20 },
  heading: { fontSize: 28, fontWeight: "800", color: "#0B3D2E" },
  subheading: { marginTop: 6, marginBottom: 14, color: "#475467", lineHeight: 20 },
  timelineCard: {
    borderWidth: 1,
    borderColor: "#D9E8DF",
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    padding: 14,
    marginBottom: 12
  },
  timelineTitle: { color: "#0B3D2E", fontWeight: "800", fontSize: 16, marginBottom: 6 },
  timelineItem: { color: "#475467", lineHeight: 21 },
  roleWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  roleChip: {
    borderWidth: 1,
    borderColor: "#D0D5DD",
    borderRadius: 999,
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  roleChipActive: { borderColor: "#1F7A4C", backgroundColor: "#E8F5EE" },
  roleChipText: { color: "#344054", fontWeight: "600" },
  roleChipTextActive: { color: "#1F7A4C" },
  infoCard: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#CFE4D8",
    borderRadius: 14,
    backgroundColor: "#ECF8F1",
    padding: 14
  },
  infoTitle: { color: "#0F5132", fontWeight: "800", fontSize: 16 },
  infoText: { color: "#334155", marginTop: 4, lineHeight: 20 },
  formCard: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#E4E7EC",
    borderRadius: 14,
    backgroundColor: "#fff",
    padding: 14
  },
  label: { color: "#344054", fontWeight: "600", marginTop: 8, marginBottom: 6 },
  input: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#D0D5DD",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  multiline: { minHeight: 100, textAlignVertical: "top" },
  button: {
    marginTop: 14,
    backgroundColor: "#0B3D2E",
    borderRadius: 12,
    alignItems: "center",
    paddingVertical: 12
  },
  buttonText: { color: "#fff", fontWeight: "800" },
  buttonGhost: {
    marginTop: 10,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#0B3D2E"
  },
  buttonGhostText: { color: "#0B3D2E", fontWeight: "800" },
  appCard: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#E4E7EC",
    borderRadius: 10,
    padding: 10,
    backgroundColor: "#FCFCFD"
  },
  appRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  appRole: { fontWeight: "700", color: "#334155" },
  appMeta: { color: "#667085", marginTop: 4, fontSize: 12 },
  adminNotes: { color: "#344054", marginTop: 6, fontWeight: "600" },
  badgeBase: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  badgeTextBase: { fontSize: 12, fontWeight: "700" },
  badgePending: { backgroundColor: "#FFFAEB" },
  badgePendingText: { color: "#B54708" },
  badgeApproved: { backgroundColor: "#ECFDF3" },
  badgeApprovedText: { color: "#027A48" },
  badgeRejected: { backgroundColor: "#FEF3F2" },
  badgeRejectedText: { color: "#B42318" }
});
