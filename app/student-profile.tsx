import React, { useEffect, useState } from "react";
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { api } from "@/lib/api";
import { notify } from "@/utils/notify";
import { pickAndUploadProfilePhoto } from "@/utils/profilePhotoUpload";

type StudentProfile = {
  profilePhotoUrl: string;
  headline: string;
  about: string;
  skills: string[];
  careerGoals: string;
  profileCompleteness: number;
  resumeUrl: string;
};

export default function StudentProfileScreen() {
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data } = await api.get("/api/profiles/student/me");
        if (mounted) {
          const profileData = data.profile || {};
          setProfile({
            profilePhotoUrl: profileData.profilePhotoUrl || "",
            headline: profileData.headline || "",
            about: profileData.about || "",
            skills: Array.isArray(profileData.skills) ? profileData.skills : [],
            careerGoals: profileData.careerGoals || "",
            profileCompleteness: Number(profileData.profileCompleteness || 0),
            resumeUrl: profileData.resumeUrl || ""
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

  async function uploadPhoto() {
    try {
      setUploadingPhoto(true);
      setError(null);
      const uploadedUrl = await pickAndUploadProfilePhoto();
      if (!uploadedUrl) return;
      setProfile((prev) => (prev ? { ...prev, profilePhotoUrl: uploadedUrl } : prev));
      notify("Profile photo uploaded. Save profile to apply.");
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to upload profile photo");
    } finally {
      setUploadingPhoto(false);
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

      <View style={styles.photoWrap}>
        {profile.profilePhotoUrl ? (
          <Image source={{ uri: profile.profilePhotoUrl }} style={styles.photo} />
        ) : (
          <View style={[styles.photo, styles.photoFallback]}>
            <Text style={styles.photoFallbackText}>
              {(profile.headline || "S").trim().charAt(0).toUpperCase() || "S"}
            </Text>
          </View>
        )}
        <TouchableOpacity style={styles.uploadBtn} onPress={uploadPhoto} disabled={uploadingPhoto}>
          <Text style={styles.uploadBtnText}>{uploadingPhoto ? "Uploading..." : "Upload Profile Picture"}</Text>
        </TouchableOpacity>
      </View>

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
  error: { marginTop: 10, color: "#B42318" },
  photoWrap: { alignItems: "center", marginBottom: 10 },
  photo: { width: 92, height: 92, borderRadius: 46, borderWidth: 2, borderColor: "#D0D5DD" },
  photoFallback: { alignItems: "center", justifyContent: "center", backgroundColor: "#E8F5EE" },
  photoFallbackText: { color: "#0B3D2E", fontSize: 30, fontWeight: "700" },
  uploadBtn: { marginTop: 10, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: "#0B3D2E" },
  uploadBtnText: { color: "#0B3D2E", fontWeight: "700" }
});
