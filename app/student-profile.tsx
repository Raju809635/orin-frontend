import React, { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { api } from "@/lib/api";
import { notify } from "@/utils/notify";
import { PRIMARY_CATEGORIES } from "@/constants/categories";

type StudentProfile = {
  profilePhotoUrl: string;
  headline: string;
  about: string;
  skills: string[];
  careerGoals: string;
  educationLevel: string;
  targetExam: string;
  interestedCategories: string[];
  preferredLanguage: string;
  goals: string;
  profileCompleteness: number;
  resumeUrl: string;
};

export default function StudentProfileScreen() {
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data } = await api.get("/api/profiles/student/me");
        if (mounted) {
          setProfile({
            ...data.profile,
            educationLevel: data.user?.educationLevel || "",
            targetExam: data.user?.targetExam || "",
            interestedCategories: data.user?.interestedCategories || [],
            preferredLanguage: data.user?.preferredLanguage || "",
            goals: data.user?.goals || ""
          });
        }
      } catch (e: any) {
        if (mounted) setError(e?.response?.data?.message || "Failed to load profile");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  async function save() {
    if (!profile) return;
    try {
      setSaving(true);
      setError(null);
      const payload = {
        ...profile,
        skills: profile.skills
      };
      const { data } = await api.patch("/api/profiles/student/me", payload);
      setProfile(data.profile);
      notify("Student profile updated");
    } catch (e: any) {
      setError(e?.response?.data?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0B3D2E" />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error || "Profile unavailable"}</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Student Profile</Text>
      <Text style={styles.sub}>Profile completeness: {profile.profileCompleteness || 0}%</Text>

      <Text style={styles.label}>Profile Photo URL</Text>
      <TextInput
        style={styles.input}
        placeholder="https://your-image-link.com/photo.jpg"
        value={profile.profilePhotoUrl || ""}
        onChangeText={(profilePhotoUrl) => setProfile((prev) => (prev ? { ...prev, profilePhotoUrl } : prev))}
      />

      <Text style={styles.label}>Headline</Text>
      <TextInput
        style={styles.input}
        value={profile.headline || ""}
        onChangeText={(headline) => setProfile((prev) => (prev ? { ...prev, headline } : prev))}
      />

      <Text style={styles.label}>About</Text>
      <TextInput
        style={[styles.input, styles.multiline]}
        multiline
        value={profile.about || ""}
        onChangeText={(about) => setProfile((prev) => (prev ? { ...prev, about } : prev))}
      />

      <Text style={styles.label}>Skills (comma separated)</Text>
      <TextInput
        style={styles.input}
        value={(profile.skills || []).join(", ")}
        onChangeText={(val) =>
          setProfile((prev) =>
            prev
              ? {
                  ...prev,
                  skills: val
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean)
                }
              : prev
          )
        }
      />

      <Text style={styles.label}>Career Goals</Text>
      <TextInput
        style={styles.input}
        value={profile.careerGoals || ""}
        onChangeText={(careerGoals) => setProfile((prev) => (prev ? { ...prev, careerGoals } : prev))}
      />

      <Text style={styles.label}>Education Level</Text>
      <TextInput
        style={styles.input}
        value={profile.educationLevel || ""}
        onChangeText={(educationLevel) => setProfile((prev) => (prev ? { ...prev, educationLevel } : prev))}
      />

      <Text style={styles.label}>Target Exam</Text>
      <TextInput
        style={styles.input}
        value={profile.targetExam || ""}
        onChangeText={(targetExam) => setProfile((prev) => (prev ? { ...prev, targetExam } : prev))}
      />

      <Text style={styles.label}>Interested Categories</Text>
      <View style={styles.chipWrap}>
        {PRIMARY_CATEGORIES.map((category) => {
          const selected = (profile.interestedCategories || []).includes(category);
          return (
            <TouchableOpacity
              key={category}
              style={[styles.chip, selected && styles.chipActive]}
              onPress={() =>
                setProfile((prev) => {
                  if (!prev) return prev;
                  const current = prev.interestedCategories || [];
                  const next = selected ? current.filter((item) => item !== category) : [...current, category];
                  return { ...prev, interestedCategories: next };
                })
              }
            >
              <Text style={[styles.chipText, selected && styles.chipTextActive]}>{category}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={styles.label}>Preferred Language</Text>
      <TextInput
        style={styles.input}
        value={profile.preferredLanguage || ""}
        onChangeText={(preferredLanguage) => setProfile((prev) => (prev ? { ...prev, preferredLanguage } : prev))}
      />

      <Text style={styles.label}>Goals</Text>
      <TextInput
        style={[styles.input, styles.multiline]}
        value={profile.goals || ""}
        onChangeText={(goals) => setProfile((prev) => (prev ? { ...prev, goals } : prev))}
      />

      <Text style={styles.label}>Resume URL</Text>
      <TextInput
        style={styles.input}
        value={profile.resumeUrl || ""}
        onChangeText={(resumeUrl) => setProfile((prev) => (prev ? { ...prev, resumeUrl } : prev))}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <TouchableOpacity style={styles.button} onPress={save} disabled={saving}>
        <Text style={styles.buttonText}>{saving ? "Saving..." : "Save Profile"}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: "#F4F9F6", padding: 20 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#F4F9F6" },
  title: { fontSize: 28, fontWeight: "700", color: "#0B3D2E" },
  sub: { marginTop: 6, marginBottom: 16, color: "#475467" },
  label: { marginTop: 10, marginBottom: 6, fontWeight: "600", color: "#1E2B24" },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 4 },
  chip: {
    borderWidth: 1,
    borderColor: "#D0D5DD",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#fff"
  },
  chipActive: { borderColor: "#0B3D2E", backgroundColor: "#E8F5EE" },
  chipText: { color: "#344054", fontWeight: "600", fontSize: 13 },
  chipTextActive: { color: "#0B3D2E" },
  input: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#D0D5DD",
    paddingHorizontal: 12,
    paddingVertical: 11
  },
  multiline: { minHeight: 110, textAlignVertical: "top" },
  button: { marginTop: 18, backgroundColor: "#0B3D2E", borderRadius: 12, paddingVertical: 13, alignItems: "center" },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  error: { marginTop: 10, color: "#B42318" }
});
