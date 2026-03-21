import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { api } from "@/lib/api";
import { notify } from "@/utils/notify";
import { pickAndUploadProfilePhoto } from "@/utils/profilePhotoUpload";
import { pickAndUploadResumeFile } from "@/utils/resumeUpload";

type ProfileProject = {
  name?: string;
  summary?: string;
  link?: string;
  techStack?: string[];
  demoVideoUrl?: string;
  screenshots?: string[];
};

type ProfileAchievement = {
  title?: string;
  type?: string;
  issuer?: string;
  date?: string;
  description?: string;
  url?: string;
};

type ProfileExperience = {
  organization?: string;
  role?: string;
  startDate?: string;
  endDate?: string;
  description?: string;
};

type StudentProfile = {
  profilePhotoUrl: string;
  headline: string;
  about: string;
  skills: string[];
  careerGoals: string;
  profileCompleteness: number;
  resumeUrl: string;
  collegeName: string;
  projects: ProfileProject[];
  achievements: ProfileAchievement[];
  experiences: ProfileExperience[];
};

const emptyProfile: StudentProfile = {
  profilePhotoUrl: "",
  headline: "",
  about: "",
  skills: [],
  careerGoals: "",
  profileCompleteness: 0,
  resumeUrl: "",
  collegeName: "",
  projects: [],
  achievements: [],
  experiences: []
};

function projectsToText(projects: ProfileProject[]) {
  return projects
    .map((project) =>
      [project.name || "", (project.techStack || []).join(","), project.link || "", project.summary || ""].join(" | ")
    )
    .filter((line) => line.trim())
    .join("\n");
}

function achievementsToText(achievements: ProfileAchievement[]) {
  return achievements
    .map((item) => [item.title || "", item.issuer || "", item.date || "", item.url || ""].join(" | "))
    .filter((line) => line.trim())
    .join("\n");
}

function experiencesToText(experiences: ProfileExperience[]) {
  return experiences
    .map((item) =>
      [item.organization || "", item.role || "", item.startDate || "", item.endDate || "", item.description || ""].join(
        " | "
      )
    )
    .filter((line) => line.trim())
    .join("\n");
}

function textToProjects(value: string): ProfileProject[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, techStack, link, summary] = line.split("|").map((s) => s.trim());
      return {
        name: name || "",
        techStack: (techStack || "")
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        link: link || "",
        summary: summary || ""
      };
    });
}

function textToAchievements(value: string): ProfileAchievement[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [title, issuer, date, url] = line.split("|").map((s) => s.trim());
      return {
        title: title || "",
        issuer: issuer || "",
        date: date || "",
        url: url || ""
      };
    });
}

function textToExperiences(value: string): ProfileExperience[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [organization, role, startDate, endDate, description] = line.split("|").map((s) => s.trim());
      return {
        organization: organization || "",
        role: role || "",
        startDate: startDate || "",
        endDate: endDate || "",
        description: description || ""
      };
    });
}

export default function StudentProfileScreen() {
  const [profile, setProfile] = useState<StudentProfile>(emptyProfile);
  const [projectsText, setProjectsText] = useState("");
  const [achievementsText, setAchievementsText] = useState("");
  const [experiencesText, setExperiencesText] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadingResume, setUploadingResume] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data } = await api.get("/api/profiles/student/me");
        if (!mounted) return;
        const profileData = data.profile || {};
        const nextProfile: StudentProfile = {
          ...emptyProfile,
          profilePhotoUrl: profileData.profilePhotoUrl || "",
          headline: profileData.headline || "",
          about: profileData.about || "",
          skills: Array.isArray(profileData.skills) ? profileData.skills : [],
          careerGoals: profileData.careerGoals || "",
          profileCompleteness: Number(profileData.profileCompleteness || 0),
          resumeUrl: profileData.resumeUrl || "",
          collegeName: profileData.collegeName || "",
          projects: Array.isArray(profileData.projects) ? profileData.projects : [],
          achievements: Array.isArray(profileData.achievements) ? profileData.achievements : [],
          experiences: Array.isArray(profileData.experiences) ? profileData.experiences : []
        };
        setProfile(nextProfile);
        setProjectsText(projectsToText(nextProfile.projects));
        setAchievementsText(achievementsToText(nextProfile.achievements));
        setExperiencesText(experiencesToText(nextProfile.experiences));
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

  const skillsValue = useMemo(() => (profile.skills || []).join(", "), [profile.skills]);

  async function save() {
    try {
      setSaving(true);
      setError(null);
      const payload = {
        ...profile,
        skills: profile.skills,
        projects: textToProjects(projectsText),
        achievements: textToAchievements(achievementsText),
        experiences: textToExperiences(experiencesText)
      };
      const { data } = await api.patch("/api/profiles/student/me", payload);
      const updated = {
        ...profile,
        ...(data.profile || {})
      };
      setProfile(updated);
      setProjectsText(projectsToText(updated.projects || []));
      setAchievementsText(achievementsToText(updated.achievements || []));
      setExperiencesText(experiencesToText(updated.experiences || []));
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
      setProfile((prev) => ({ ...prev, profilePhotoUrl: uploadedUrl }));
      notify("Profile photo uploaded. Save profile to apply.");
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to upload profile photo");
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function uploadResume() {
    try {
      setError(null);
      setUploadingResume(true);
      const uploaded = await pickAndUploadResumeFile();
      if (!uploaded) return;

      setProfile((prev) => ({ ...prev, resumeUrl: uploaded.url }));
      // Save immediately so students don't forget to hit "Save Profile".
      await api.patch("/api/profiles/student/me", { resumeUrl: uploaded.url });
      notify("Resume uploaded successfully.");
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || "Failed to upload resume");
    } finally {
      setUploadingResume(false);
    }
  }

  async function removeResume() {
    const confirmed = await new Promise<boolean>((resolve) => {
      Alert.alert("Remove resume?", "This will remove the resume link from your profile.", [
        { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
        { text: "Remove", style: "destructive", onPress: () => resolve(true) }
      ]);
    });
    if (!confirmed) return;

    try {
      setError(null);
      setUploadingResume(true);
      await api.patch("/api/profiles/student/me", { resumeUrl: "" });
      setProfile((prev) => ({ ...prev, resumeUrl: "" }));
      notify("Resume removed.");
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to remove resume");
    } finally {
      setUploadingResume(false);
    }
  }

  async function openResume() {
    const url = (profile.resumeUrl || "").trim();
    if (!url) return;
    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        notify("Unable to open resume on this device.");
        return;
      }
      await Linking.openURL(url);
    } catch {
      notify("Unable to open resume. Please try again.");
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0B3D2E" />
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
            <Text style={styles.photoFallbackText}>{(profile.headline || "S").trim().charAt(0).toUpperCase() || "S"}</Text>
          </View>
        )}
        <TouchableOpacity style={styles.uploadBtn} onPress={uploadPhoto} disabled={uploadingPhoto}>
          <Text style={styles.uploadBtnText}>{uploadingPhoto ? "Uploading..." : "Upload Profile Picture"}</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.label}>Headline</Text>
      <TextInput style={styles.input} value={profile.headline} onChangeText={(headline) => setProfile((prev) => ({ ...prev, headline }))} />

      <Text style={styles.label}>College</Text>
      <TextInput style={styles.input} value={profile.collegeName} onChangeText={(collegeName) => setProfile((prev) => ({ ...prev, collegeName }))} />

      <Text style={styles.label}>About</Text>
      <TextInput style={[styles.input, styles.multiline]} multiline value={profile.about} onChangeText={(about) => setProfile((prev) => ({ ...prev, about }))} />

      <Text style={styles.label}>Skills (comma separated)</Text>
      <TextInput
        style={styles.input}
        value={skillsValue}
        onChangeText={(val) =>
          setProfile((prev) => ({
            ...prev,
            skills: val
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
          }))
        }
      />

      <Text style={styles.label}>Projects (one per line: title | tech1,tech2 | github/demo link | summary)</Text>
      <TextInput style={[styles.input, styles.multiline]} multiline value={projectsText} onChangeText={setProjectsText} />

      <Text style={styles.label}>Achievements (one per line: title | issuer | date | url)</Text>
      <TextInput style={[styles.input, styles.multiline]} multiline value={achievementsText} onChangeText={setAchievementsText} />

      <Text style={styles.label}>Experience (one per line: organization | role | start | end | description)</Text>
      <TextInput style={[styles.input, styles.multiline]} multiline value={experiencesText} onChangeText={setExperiencesText} />

      <Text style={styles.label}>Career Goals</Text>
      <TextInput style={styles.input} value={profile.careerGoals} onChangeText={(careerGoals) => setProfile((prev) => ({ ...prev, careerGoals }))} />

      <View style={styles.resumeSection}>
        <Text style={styles.resumeTitle}>Resume (PDF/DOC)</Text>
        <Text style={styles.resumeSub}>
          Upload your resume file. Students/mentors can open it from your profile when needed.
        </Text>

        <View style={styles.resumeActions}>
          <TouchableOpacity style={styles.uploadBtn} onPress={uploadResume} disabled={uploadingResume}>
            <Text style={styles.uploadBtnText}>{uploadingResume ? "Uploading..." : profile.resumeUrl ? "Replace Resume" : "Upload Resume"}</Text>
          </TouchableOpacity>
          {profile.resumeUrl ? (
            <TouchableOpacity style={styles.resumeOpenBtn} onPress={openResume} disabled={uploadingResume}>
              <Text style={styles.resumeOpenBtnText}>Open</Text>
            </TouchableOpacity>
          ) : null}
          {profile.resumeUrl ? (
            <TouchableOpacity style={styles.resumeRemoveBtn} onPress={removeResume} disabled={uploadingResume}>
              <Text style={styles.resumeRemoveBtnText}>Remove</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <Text style={styles.resumeLinkLabel}>Resume link (auto-filled after upload)</Text>
        <TextInput
          style={styles.input}
          value={profile.resumeUrl}
          onChangeText={(resumeUrl) => setProfile((prev) => ({ ...prev, resumeUrl }))}
          placeholder="https://..."
          autoCapitalize="none"
        />
      </View>

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
  uploadBtnText: { color: "#0B3D2E", fontWeight: "700" },
  resumeSection: {
    marginTop: 14,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E4E7EC",
    padding: 12
  },
  resumeTitle: { fontSize: 16, fontWeight: "800", color: "#1E2B24" },
  resumeSub: { marginTop: 4, color: "#667085", lineHeight: 18 },
  resumeActions: { marginTop: 10, flexDirection: "row", flexWrap: "wrap", gap: 10, alignItems: "center" },
  resumeOpenBtn: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, backgroundColor: "#1F7A4C" },
  resumeOpenBtnText: { color: "#fff", fontWeight: "800" },
  resumeRemoveBtn: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: "#B42318" },
  resumeRemoveBtnText: { color: "#B42318", fontWeight: "800" },
  resumeLinkLabel: { marginTop: 10, marginBottom: 6, fontWeight: "700", color: "#344054" }
});
