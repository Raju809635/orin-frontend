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
  title: string;
  tech: string[];
  link: string;
  description: string;
};

type ProfileAchievement = {
  title: string;
  issuer: string;
  date: string;
  url: string;
};

type ProfileExperience = {
  organization: string;
  role: string;
  start: string;
  end: string;
  description: string;
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

const emptyProject = (): ProfileProject => ({ title: "", tech: [], link: "", description: "" });
const emptyAchievement = (): ProfileAchievement => ({ title: "", issuer: "", date: "", url: "" });
const emptyExperience = (): ProfileExperience => ({ organization: "", role: "", start: "", end: "", description: "" });

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

function normalizeProject(project: any = {}): ProfileProject {
  return {
    title: String(project?.title || project?.name || "").trim(),
    tech: Array.isArray(project?.tech)
      ? project.tech.map((item: any) => String(item || "").trim()).filter(Boolean)
      : Array.isArray(project?.techStack)
        ? project.techStack.map((item: any) => String(item || "").trim()).filter(Boolean)
        : [],
    link: String(project?.link || "").trim(),
    description: String(project?.description || project?.summary || "").trim()
  };
}

function normalizeAchievement(achievement: any = {}): ProfileAchievement {
  return {
    title: String(achievement?.title || "").trim(),
    issuer: String(achievement?.issuer || "").trim(),
    date: String(achievement?.date || "").trim(),
    url: String(achievement?.url || "").trim()
  };
}

function normalizeExperience(experience: any = {}): ProfileExperience {
  return {
    organization: String(experience?.organization || "").trim(),
    role: String(experience?.role || "").trim(),
    start: String(experience?.start || experience?.startDate || "").trim(),
    end: String(experience?.end || experience?.endDate || "").trim(),
    description: String(experience?.description || "").trim()
  };
}

export default function StudentProfileScreen() {
  const [profile, setProfile] = useState<StudentProfile>(emptyProfile);
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
        setProfile({
          ...emptyProfile,
          profilePhotoUrl: profileData.profilePhotoUrl || "",
          headline: profileData.headline || "",
          about: profileData.about || "",
          skills: Array.isArray(profileData.skills) ? profileData.skills.filter(Boolean) : [],
          careerGoals: profileData.careerGoals || "",
          profileCompleteness: Number(profileData.profileCompleteness || 0),
          resumeUrl: profileData.resumeUrl || "",
          collegeName: profileData.collegeName || "",
          projects: Array.isArray(profileData.projects) ? profileData.projects.map(normalizeProject) : [],
          achievements: Array.isArray(profileData.achievements)
            ? profileData.achievements.map(normalizeAchievement)
            : [],
          experiences: Array.isArray(profileData.experiences) ? profileData.experiences.map(normalizeExperience) : []
        });
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

  const updateProject = (index: number, key: keyof ProfileProject, value: string | string[]) => {
    setProfile((prev) => ({
      ...prev,
      projects: prev.projects.map((item, itemIndex) => (itemIndex === index ? { ...item, [key]: value } : item))
    }));
  };

  const updateAchievement = (index: number, key: keyof ProfileAchievement, value: string) => {
    setProfile((prev) => ({
      ...prev,
      achievements: prev.achievements.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [key]: value } : item
      )
    }));
  };

  const updateExperience = (index: number, key: keyof ProfileExperience, value: string) => {
    setProfile((prev) => ({
      ...prev,
      experiences: prev.experiences.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [key]: value } : item
      )
    }));
  };

  async function save() {
    try {
      setSaving(true);
      setError(null);
      const payload = {
        ...profile,
        skills: profile.skills,
        projects: profile.projects.filter((item) => item.title || item.description || item.link || item.tech.length),
        achievements: profile.achievements.filter((item) => item.title || item.issuer || item.date || item.url),
        experiences: profile.experiences.filter(
          (item) => item.organization || item.role || item.start || item.end || item.description
        )
      };
      const { data } = await api.patch("/api/profiles/student/me", payload);
      const profileData = data.profile || {};
      setProfile((prev) => ({
        ...prev,
        ...profileData,
        projects: Array.isArray(profileData.projects) ? profileData.projects.map(normalizeProject) : payload.projects,
        achievements: Array.isArray(profileData.achievements)
          ? profileData.achievements.map(normalizeAchievement)
          : payload.achievements,
        experiences: Array.isArray(profileData.experiences)
          ? profileData.experiences.map(normalizeExperience)
          : payload.experiences
      }));
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

      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>Projects</Text>
            <Text style={styles.sectionSub}>Add projects with tech stack, link, and description.</Text>
          </View>
          <TouchableOpacity style={styles.addBtn} onPress={() => setProfile((prev) => ({ ...prev, projects: [...prev.projects, emptyProject()] }))}>
            <Text style={styles.addBtnText}>+ Add</Text>
          </TouchableOpacity>
        </View>
        {profile.projects.length === 0 ? <Text style={styles.emptyText}>No projects added yet.</Text> : null}
        {profile.projects.map((item, index) => (
          <View key={`project-${index}`} style={styles.entryCard}>
            <View style={styles.entryHeader}>
              <Text style={styles.entryTitle}>Project {index + 1}</Text>
              <TouchableOpacity onPress={() => setProfile((prev) => ({ ...prev, projects: prev.projects.filter((_, itemIndex) => itemIndex !== index) }))}>
                <Text style={styles.removeText}>Remove</Text>
              </TouchableOpacity>
            </View>
            <TextInput style={styles.input} placeholder="Title" value={item.title} onChangeText={(value) => updateProject(index, "title", value)} />
            <TextInput
              style={styles.input}
              placeholder="Tech stack (comma separated)"
              value={item.tech.join(", ")}
              onChangeText={(value) => updateProject(index, "tech", value.split(",").map((tech) => tech.trim()).filter(Boolean))}
            />
            <TextInput style={styles.input} placeholder="GitHub / Demo link" value={item.link} onChangeText={(value) => updateProject(index, "link", value)} autoCapitalize="none" />
            <TextInput style={[styles.input, styles.multilineSmall]} placeholder="Description" multiline value={item.description} onChangeText={(value) => updateProject(index, "description", value)} />
          </View>
        ))}
      </View>

      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>Achievements</Text>
            <Text style={styles.sectionSub}>Add certifications, awards, and recognitions.</Text>
          </View>
          <TouchableOpacity style={styles.addBtn} onPress={() => setProfile((prev) => ({ ...prev, achievements: [...prev.achievements, emptyAchievement()] }))}>
            <Text style={styles.addBtnText}>+ Add</Text>
          </TouchableOpacity>
        </View>
        {profile.achievements.length === 0 ? <Text style={styles.emptyText}>No achievements added yet.</Text> : null}
        {profile.achievements.map((item, index) => (
          <View key={`achievement-${index}`} style={styles.entryCard}>
            <View style={styles.entryHeader}>
              <Text style={styles.entryTitle}>Achievement {index + 1}</Text>
              <TouchableOpacity onPress={() => setProfile((prev) => ({ ...prev, achievements: prev.achievements.filter((_, itemIndex) => itemIndex !== index) }))}>
                <Text style={styles.removeText}>Remove</Text>
              </TouchableOpacity>
            </View>
            <TextInput style={styles.input} placeholder="Title" value={item.title} onChangeText={(value) => updateAchievement(index, "title", value)} />
            <TextInput style={styles.input} placeholder="Issuer" value={item.issuer} onChangeText={(value) => updateAchievement(index, "issuer", value)} />
            <TextInput style={styles.input} placeholder="Date" value={item.date} onChangeText={(value) => updateAchievement(index, "date", value)} />
            <TextInput style={styles.input} placeholder="URL (optional)" value={item.url} onChangeText={(value) => updateAchievement(index, "url", value)} autoCapitalize="none" />
          </View>
        ))}
      </View>

      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>Experience</Text>
            <Text style={styles.sectionSub}>Add internships, work, research, or volunteer roles.</Text>
          </View>
          <TouchableOpacity style={styles.addBtn} onPress={() => setProfile((prev) => ({ ...prev, experiences: [...prev.experiences, emptyExperience()] }))}>
            <Text style={styles.addBtnText}>+ Add</Text>
          </TouchableOpacity>
        </View>
        {profile.experiences.length === 0 ? <Text style={styles.emptyText}>No experience added yet.</Text> : null}
        {profile.experiences.map((item, index) => (
          <View key={`experience-${index}`} style={styles.entryCard}>
            <View style={styles.entryHeader}>
              <Text style={styles.entryTitle}>Experience {index + 1}</Text>
              <TouchableOpacity onPress={() => setProfile((prev) => ({ ...prev, experiences: prev.experiences.filter((_, itemIndex) => itemIndex !== index) }))}>
                <Text style={styles.removeText}>Remove</Text>
              </TouchableOpacity>
            </View>
            <TextInput style={styles.input} placeholder="Organization" value={item.organization} onChangeText={(value) => updateExperience(index, "organization", value)} />
            <TextInput style={styles.input} placeholder="Role" value={item.role} onChangeText={(value) => updateExperience(index, "role", value)} />
            <TextInput style={styles.input} placeholder="Start" value={item.start} onChangeText={(value) => updateExperience(index, "start", value)} />
            <TextInput style={styles.input} placeholder="End" value={item.end} onChangeText={(value) => updateExperience(index, "end", value)} />
            <TextInput style={[styles.input, styles.multilineSmall]} placeholder="Description" multiline value={item.description} onChangeText={(value) => updateExperience(index, "description", value)} />
          </View>
        ))}
      </View>

      <Text style={styles.label}>Career Goals</Text>
      <TextInput style={styles.input} value={profile.careerGoals} onChangeText={(careerGoals) => setProfile((prev) => ({ ...prev, careerGoals }))} />

      <View style={styles.resumeSection}>
        <Text style={styles.resumeTitle}>Resume (PDF/DOC)</Text>
        <Text style={styles.resumeSub}>
          Upload your resume file. Students and mentors can open it from your profile when needed.
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
    paddingVertical: 11,
    marginBottom: 10
  },
  multiline: { minHeight: 110, textAlignVertical: "top" },
  multilineSmall: { minHeight: 90, textAlignVertical: "top" },
  button: { marginTop: 18, backgroundColor: "#0B3D2E", borderRadius: 12, paddingVertical: 13, alignItems: "center" },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  error: { marginTop: 10, color: "#B42318" },
  photoWrap: { alignItems: "center", marginBottom: 10 },
  photo: { width: 92, height: 92, borderRadius: 46, borderWidth: 2, borderColor: "#D0D5DD" },
  photoFallback: { alignItems: "center", justifyContent: "center", backgroundColor: "#E8F5EE" },
  photoFallbackText: { color: "#0B3D2E", fontSize: 30, fontWeight: "700" },
  uploadBtn: { marginTop: 10, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: "#0B3D2E" },
  uploadBtnText: { color: "#0B3D2E", fontWeight: "700" },
  sectionCard: {
    marginTop: 16,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E4E7EC",
    padding: 14
  },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 10 },
  sectionTitle: { fontSize: 17, fontWeight: "800", color: "#1E2B24" },
  sectionSub: { marginTop: 2, color: "#667085", maxWidth: 240 },
  addBtn: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, backgroundColor: "#E8F5EE" },
  addBtnText: { color: "#0B3D2E", fontWeight: "800" },
  emptyText: { color: "#667085", marginBottom: 4 },
  entryCard: {
    marginTop: 10,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#DDE6DF",
    backgroundColor: "#FAFCFA"
  },
  entryHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  entryTitle: { fontSize: 15, fontWeight: "700", color: "#1E2B24" },
  removeText: { color: "#B42318", fontWeight: "700" },
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
