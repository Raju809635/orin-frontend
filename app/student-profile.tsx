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
import { useAppTheme } from "@/context/ThemeContext";
import { notify } from "@/utils/notify";
import { pickAndUploadProfilePhoto } from "@/utils/profilePhotoUpload";
import { pickAndUploadResumeFile } from "@/utils/resumeUpload";
import DateField from "@/components/profile/date-field";

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

type ProfileEducation = {
  school: string;
  degree: string;
  year: string;
};

type InstitutionSearchResult = {
  id: string;
  name: string;
  institutionType: string;
  district?: string;
  state?: string;
  source?: string;
};

type StudentProfile = {
  profilePhotoUrl: string;
  headline: string;
  about: string;
  profileType: "student" | "graduate" | "job_seeker";
  state: string;
  institutionName: string;
  institutionType: string;
  institutionDistrict: string;
  institutionSource: string;
  className: string;
  skills: string[];
  careerGoals: string;
  profileCompleteness: number;
  resumeUrl: string;
  collegeName: string;
  education: ProfileEducation[];
  projects: ProfileProject[];
  achievements: ProfileAchievement[];
  experiences: ProfileExperience[];
};

const emptyProject = (): ProfileProject => ({ title: "", tech: [], link: "", description: "" });
const emptyAchievement = (): ProfileAchievement => ({ title: "", issuer: "", date: "", url: "" });
const emptyExperience = (): ProfileExperience => ({ organization: "", role: "", start: "", end: "", description: "" });
const emptyEducation = (): ProfileEducation => ({ school: "", degree: "", year: "" });

const emptyProfile: StudentProfile = {
  profilePhotoUrl: "",
  headline: "",
  about: "",
  profileType: "student",
  state: "",
  institutionName: "",
  institutionType: "",
  institutionDistrict: "",
  institutionSource: "",
  className: "",
  skills: [],
  careerGoals: "",
  profileCompleteness: 0,
  resumeUrl: "",
  collegeName: "",
  education: [],
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

function normalizeEducation(education: any = {}): ProfileEducation {
  return {
    school: String(education?.school || "").trim(),
    degree: String(education?.degree || "").trim(),
    year: String(education?.year || "").trim()
  };
}

function parseCommaSeparated(value: string) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

const INSTITUTION_TYPE_OPTIONS = [
  "School",
  "Junior College",
  "Diploma College",
  "Degree College",
  "Engineering College",
  "University"
];
const PROFILE_TYPE_OPTIONS: Array<StudentProfile["profileType"]> = ["student", "graduate", "job_seeker"];

export default function StudentProfileScreen() {
  const { colors } = useAppTheme();
  const [profile, setProfile] = useState<StudentProfile>(emptyProfile);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [savingPhoto, setSavingPhoto] = useState(false);
  const [photoDirty, setPhotoDirty] = useState(false);
  const [uploadingResume, setUploadingResume] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [skillsDraft, setSkillsDraft] = useState("");
  const [projectTechDrafts, setProjectTechDrafts] = useState<Record<number, string>>({});
  const [institutionQuery, setInstitutionQuery] = useState("");
  const [institutionResults, setInstitutionResults] = useState<InstitutionSearchResult[]>([]);
  const [searchingInstitutions, setSearchingInstitutions] = useState(false);
  const [institutionFocused, setInstitutionFocused] = useState(false);

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
          profileType: profileData.profileType || "student",
          state: profileData.state || "",
          institutionName: profileData.institutionName || profileData.collegeName || "",
          institutionType: profileData.institutionType || "",
          institutionDistrict: profileData.institutionDistrict || "",
          institutionSource: profileData.institutionSource || "",
          className: profileData.className || "",
          skills: Array.isArray(profileData.skills) ? profileData.skills.filter(Boolean) : [],
          careerGoals: profileData.careerGoals || "",
          profileCompleteness: Number(profileData.profileCompleteness || 0),
          resumeUrl: profileData.resumeUrl || "",
          collegeName: profileData.collegeName || "",
          education: Array.isArray(profileData.education) ? profileData.education.map(normalizeEducation) : [],
          projects: Array.isArray(profileData.projects) ? profileData.projects.map(normalizeProject) : [],
          achievements: Array.isArray(profileData.achievements)
            ? profileData.achievements.map(normalizeAchievement)
            : [],
          experiences: Array.isArray(profileData.experiences) ? profileData.experiences.map(normalizeExperience) : []
        });
        setSkillsDraft(Array.isArray(profileData.skills) ? profileData.skills.filter(Boolean).join(", ") : "");
        setProjectTechDrafts(
          Array.isArray(profileData.projects)
            ? Object.fromEntries(profileData.projects.map((project: any, index: number) => [index, normalizeProject(project).tech.join(", ")]))
            : {}
        );
        setInstitutionQuery(profileData.institutionName || profileData.collegeName || "");
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

  const skillsValue = useMemo(() => skillsDraft, [skillsDraft]);

  useEffect(() => {
    if (!institutionFocused) {
      setInstitutionResults([]);
      return;
    }

    const query = institutionQuery.trim();
    if (query.length < 2) {
      setInstitutionResults([]);
      setSearchingInstitutions(false);
      return;
    }

    let active = true;
    const timer = setTimeout(async () => {
      try {
        setSearchingInstitutions(true);
        const { data } = await api.get("/api/profiles/institutions/search", {
          params: {
            q: query,
            institutionType: profile.institutionType || undefined,
            state: profile.state || undefined,
            limit: 8
          }
        });
        if (!active) return;
        let nextResults = Array.isArray(data?.results) ? data.results : [];

        if (nextResults.length === 0 && (profile.institutionType || profile.state)) {
          const fallback = await api.get("/api/profiles/institutions/search", {
            params: {
              q: query,
              limit: 8
            }
          });
          if (!active) return;
          nextResults = Array.isArray(fallback?.data?.results) ? fallback.data.results : [];
        }

        setInstitutionResults(nextResults);
      } catch {
        if (active) setInstitutionResults([]);
      } finally {
        if (active) setSearchingInstitutions(false);
      }
    }, 250);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [institutionFocused, institutionQuery, profile.institutionType, profile.state]);

  const applyInstitutionSelection = (institution: InstitutionSearchResult) => {
    setProfile((prev) => ({
      ...prev,
      institutionName: institution.name,
      collegeName: institution.name,
      institutionType: institution.institutionType || prev.institutionType,
      institutionDistrict: institution.district || "",
      institutionSource: institution.source || "",
      state: institution.state || prev.state
    }));
    setInstitutionQuery(institution.name);
    setInstitutionResults([]);
    setInstitutionFocused(false);
  };

  const updateProject = (index: number, key: keyof ProfileProject, value: string | string[]) => {
    setProfile((prev) => ({
      ...prev,
      projects: prev.projects.map((item, itemIndex) => (itemIndex === index ? { ...item, [key]: value } : item))
    }));
  };

  const syncProjectTechDraft = (index: number, value: string) => {
    setProjectTechDrafts((prev) => ({ ...prev, [index]: value }));
  };

  const commitProjectTechDraft = (index: number) => {
    updateProject(index, "tech", parseCommaSeparated(projectTechDrafts[index] || ""));
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

  const updateEducation = (index: number, key: keyof ProfileEducation, value: string) => {
    setProfile((prev) => ({
      ...prev,
      education: prev.education.map((item, itemIndex) =>
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
        profileType: String(profile.profileType || "student").trim(),
        institutionName: String(profile.institutionName || profile.collegeName || institutionQuery || "").trim(),
        institutionType: String(profile.institutionType || "").trim(),
        institutionDistrict: String(profile.institutionDistrict || "").trim(),
        institutionSource: String(profile.institutionSource || "").trim(),
        className: String(profile.className || "").trim(),
        collegeName: String(profile.institutionName || profile.collegeName || institutionQuery || "").trim(),
        state: String(profile.state || "").trim(),
        skills: parseCommaSeparated(skillsDraft),
        education: profile.education.filter((item) => item.school || item.degree || item.year),
        projects: profile.projects
          .map((item, index) => ({
            ...item,
            tech: parseCommaSeparated(projectTechDrafts[index] ?? item.tech.join(", "))
          }))
          .filter((item) => item.title || item.description || item.link || item.tech.length),
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
        profileType: (profileData.profileType || payload.profileType || "student") as StudentProfile["profileType"],
        institutionName: typeof profileData.institutionName === "string"
          ? profileData.institutionName
          : payload.institutionName,
        institutionType: typeof profileData.institutionType === "string"
          ? profileData.institutionType
          : payload.institutionType,
        institutionDistrict: typeof profileData.institutionDistrict === "string"
          ? profileData.institutionDistrict
          : payload.institutionDistrict,
        institutionSource: typeof profileData.institutionSource === "string"
          ? profileData.institutionSource
          : payload.institutionSource,
        className: typeof profileData.className === "string" ? profileData.className : payload.className,
        collegeName: typeof profileData.collegeName === "string" ? profileData.collegeName : payload.collegeName,
        state: typeof profileData.state === "string" ? profileData.state : payload.state,
        skills: Array.isArray(profileData.skills) ? profileData.skills.filter(Boolean) : payload.skills,
        education: Array.isArray(profileData.education) ? profileData.education.map(normalizeEducation) : payload.education,
        projects: Array.isArray(profileData.projects) ? profileData.projects.map(normalizeProject) : payload.projects,
        achievements: Array.isArray(profileData.achievements)
          ? profileData.achievements.map(normalizeAchievement)
          : payload.achievements,
        experiences: Array.isArray(profileData.experiences)
          ? profileData.experiences.map(normalizeExperience)
          : payload.experiences
      }));
      setInstitutionQuery(
        typeof profileData.institutionName === "string"
          ? profileData.institutionName
          : typeof profileData.collegeName === "string"
            ? profileData.collegeName
            : payload.institutionName
      );
      setSkillsDraft((Array.isArray(profileData.skills) ? profileData.skills.filter(Boolean) : payload.skills).join(", "));
      const nextProjects = Array.isArray(profileData.projects) ? profileData.projects.map(normalizeProject) : payload.projects;
      setProjectTechDrafts(Object.fromEntries(nextProjects.map((item, index) => [index, item.tech.join(", ")])));
      setPhotoDirty(false);
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
      setPhotoDirty(true);
      notify("Photo selected. Save photo to apply it everywhere.");
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to upload profile photo");
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function savePhoto() {
    try {
      setSavingPhoto(true);
      setError(null);
      const { data } = await api.patch("/api/profiles/student/me", { profilePhotoUrl: profile.profilePhotoUrl });
      setProfile((prev) => ({ ...prev, profilePhotoUrl: data?.profile?.profilePhotoUrl || prev.profilePhotoUrl }));
      setPhotoDirty(false);
      notify("Profile photo saved.");
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to save profile photo");
    } finally {
      setSavingPhoto(false);
    }
  }

  async function removePhoto() {
    const confirmed = await new Promise<boolean>((resolve) => {
      Alert.alert("Delete photo?", "This removes your profile photo from ORIN.", [
        { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
        { text: "Delete", style: "destructive", onPress: () => resolve(true) }
      ]);
    });
    if (!confirmed) return;

    setProfile((prev) => ({ ...prev, profilePhotoUrl: "" }));
    setPhotoDirty(true);
    notify("Photo removed locally. Save photo to apply.");
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
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={[styles.container, { backgroundColor: colors.background }]}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={[styles.title, { color: colors.text }]}>Student Profile</Text>
      <Text style={[styles.sub, { color: colors.textMuted }]}>Profile completeness: {profile.profileCompleteness || 0}%</Text>

      <View style={styles.photoWrap}>
        {profile.profilePhotoUrl ? (
          <Image source={{ uri: profile.profilePhotoUrl }} style={styles.photo} />
        ) : (
          <View style={[styles.photo, styles.photoFallback, { backgroundColor: colors.accentSoft }]}>
            <Text style={[styles.photoFallbackText, { color: colors.accent }]}>{(profile.headline || "S").trim().charAt(0).toUpperCase() || "S"}</Text>
          </View>
        )}
        <View style={styles.photoActionRow}>
          <TouchableOpacity style={[styles.uploadBtn, { borderColor: colors.accent, backgroundColor: colors.surfaceAlt }]} onPress={uploadPhoto} disabled={uploadingPhoto}>
            <Text style={[styles.uploadBtnText, { color: colors.accent }]}>{uploadingPhoto ? "Cropping..." : profile.profilePhotoUrl ? "Change Photo" : "Add Photo"}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.uploadBtn, { borderColor: colors.border, backgroundColor: colors.surfaceAlt, opacity: photoDirty ? 1 : 0.65 }]} onPress={savePhoto} disabled={!photoDirty || savingPhoto}>
            <Text style={[styles.uploadBtnText, { color: colors.text }]}>{savingPhoto ? "Saving..." : "Save Photo"}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.uploadBtn, { borderColor: colors.danger, backgroundColor: colors.surfaceAlt, opacity: profile.profilePhotoUrl ? 1 : 0.65 }]} onPress={removePhoto} disabled={!profile.profilePhotoUrl}>
            <Text style={[styles.uploadBtnText, { color: colors.danger }]}>Delete</Text>
          </TouchableOpacity>
        </View>
        <Text style={[styles.photoHint, { color: colors.textMuted }]}>You can crop while selecting. Save Photo updates your avatar separately from the rest of the profile.</Text>
      </View>

      <Text style={[styles.label, { color: colors.text }]}>Headline</Text>
      <TextInput style={[styles.input, { backgroundColor: colors.surfaceAlt, borderColor: colors.border, color: colors.text }]} placeholderTextColor={colors.textMuted} value={profile.headline} onChangeText={(headline) => setProfile((prev) => ({ ...prev, headline }))} />

      <Text style={[styles.label, { color: colors.text }]}>Profile Type</Text>
      <View style={styles.selectionWrap}>
        {PROFILE_TYPE_OPTIONS.map((type) => {
          const active = profile.profileType === type;
          const label = type === "job_seeker" ? "Job Seeker" : type.charAt(0).toUpperCase() + type.slice(1);
          return (
            <TouchableOpacity
              key={type}
              style={[
                styles.optionChip,
                { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
                active && [styles.optionChipActive, { backgroundColor: colors.accentSoft, borderColor: colors.accent }]
              ]}
              onPress={() =>
                setProfile((prev) => ({
                  ...prev,
                  profileType: type
                }))
              }
            >
              <Text style={[styles.optionText, { color: colors.textMuted }, active && [styles.optionTextActive, { color: colors.accent }]]}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={[styles.label, { color: colors.text }]}>Institution Type</Text>
      <View style={styles.selectionWrap}>
        {INSTITUTION_TYPE_OPTIONS.map((type) => {
          const active = profile.institutionType === type;
          return (
            <TouchableOpacity
              key={type}
              style={[
                styles.optionChip,
                { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
                active && [styles.optionChipActive, { backgroundColor: colors.accentSoft, borderColor: colors.accent }]
              ]}
              onPress={() =>
                setProfile((prev) => ({
                  ...prev,
                  institutionType: prev.institutionType === type ? "" : type
                }))
              }
            >
              <Text style={[styles.optionText, { color: colors.textMuted }, active && [styles.optionTextActive, { color: colors.accent }]]}>
                {type}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={[styles.label, { color: colors.text }]}>Institution</Text>
      <TextInput
        style={[styles.input, { backgroundColor: colors.surfaceAlt, borderColor: colors.border, color: colors.text }]}
        placeholder="Search school, junior college, degree college, university..."
        placeholderTextColor={colors.textMuted}
        value={institutionQuery}
        onFocus={() => setInstitutionFocused(true)}
        onChangeText={(value) => {
          setInstitutionQuery(value);
          setInstitutionFocused(true);
          setProfile((prev) => ({
            ...prev,
            institutionName: value,
            collegeName: value,
            institutionDistrict: value.trim() ? prev.institutionDistrict : "",
            institutionSource: value.trim() ? prev.institutionSource : ""
          }));
        }}
      />
      {searchingInstitutions ? <ActivityIndicator size="small" color={colors.accent} style={styles.searchLoader} /> : null}
      {institutionFocused && institutionResults.length > 0 ? (
        <View style={[styles.suggestionBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {institutionResults.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={[styles.suggestionItem, { borderBottomColor: colors.border }]}
              onPress={() => applyInstitutionSelection(item)}
            >
              <Text style={[styles.suggestionTitle, { color: colors.text }]}>{item.name}</Text>
              <Text style={[styles.suggestionMeta, { color: colors.textMuted }]}>
                {[item.institutionType, item.district, item.state].filter(Boolean).join(" | ")}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}
      {institutionFocused && !searchingInstitutions && institutionQuery.trim().length >= 2 && institutionResults.length === 0 ? (
        <Text style={[styles.helperText, { color: colors.textMuted }]}>
          No institution match yet. Keep typing or save manually if your institution is rare.
        </Text>
      ) : null}
      <Text style={[styles.helperText, { color: colors.textMuted }]}>
        Pick a real institution when possible so your institution and state leaderboards stay accurate.
      </Text>
      {profile.institutionDistrict || profile.institutionSource ? (
        <Text style={[styles.helperText, { color: colors.textMuted }]}>
          {[profile.institutionDistrict, profile.institutionSource].filter(Boolean).join(" | ")}
        </Text>
      ) : null}

      <Text style={[styles.label, { color: colors.text }]}>State</Text>
      <TextInput style={[styles.input, { backgroundColor: colors.surfaceAlt, borderColor: colors.border, color: colors.text }]} placeholder="State" autoCapitalize="words" placeholderTextColor={colors.textMuted} value={profile.state} onChangeText={(state) => setProfile((prev) => ({ ...prev, state }))} />

      <Text style={[styles.label, { color: colors.text }]}>Class (Optional)</Text>
      <TextInput
        style={[styles.input, { backgroundColor: colors.surfaceAlt, borderColor: colors.border, color: colors.text }]}
        placeholder="Example: Class 10, Grade 12, Section A"
        placeholderTextColor={colors.textMuted}
        value={profile.className}
        onChangeText={(className) => setProfile((prev) => ({ ...prev, className }))}
      />
      <Text style={[styles.helperText, { color: colors.textMuted }]}>
        Add class only if it matters for your school workflow. It stays optional.
      </Text>

      <Text style={[styles.label, { color: colors.text }]}>About</Text>
      <TextInput style={[styles.input, styles.multiline, { backgroundColor: colors.surfaceAlt, borderColor: colors.border, color: colors.text }]} placeholderTextColor={colors.textMuted} multiline value={profile.about} onChangeText={(about) => setProfile((prev) => ({ ...prev, about }))} />

      <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.sectionHeader}>
          <View>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Education</Text>
            <Text style={[styles.sectionSub, { color: colors.textMuted }]}>Add school, institution, degree, and passing year to make your profile more complete.</Text>
          </View>
          <TouchableOpacity style={[styles.addBtn, { backgroundColor: colors.accentSoft }]} onPress={() => setProfile((prev) => ({ ...prev, education: [...prev.education, emptyEducation()] }))}>
            <Text style={[styles.addBtnText, { color: colors.accent }]}>+ Add</Text>
          </TouchableOpacity>
        </View>
        {profile.education.length === 0 ? <Text style={[styles.emptyText, { color: colors.textMuted }]}>No education added yet.</Text> : null}
        {profile.education.map((item, index) => (
          <View key={`education-${index}`} style={[styles.entryCard, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
            <View style={styles.entryHeader}>
              <Text style={[styles.entryTitle, { color: colors.text }]}>Education {index + 1}</Text>
              <TouchableOpacity onPress={() => setProfile((prev) => ({ ...prev, education: prev.education.filter((_, itemIndex) => itemIndex !== index) }))}>
                <Text style={styles.removeText}>Remove</Text>
              </TouchableOpacity>
            </View>
            <TextInput style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]} placeholder="School / College" placeholderTextColor={colors.textMuted} value={item.school} onChangeText={(value) => updateEducation(index, "school", value)} />
            <TextInput style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]} placeholder="Degree / Program" placeholderTextColor={colors.textMuted} value={item.degree} onChangeText={(value) => updateEducation(index, "degree", value)} />
            <DateField label="Passing Year" mode="year" value={item.year} placeholder="Select passing year" onChange={(value) => updateEducation(index, "year", value)} />
          </View>
        ))}
      </View>

      <Text style={[styles.label, { color: colors.text }]}>Skills (comma separated)</Text>
      <TextInput
        style={[styles.input, { backgroundColor: colors.surfaceAlt, borderColor: colors.border, color: colors.text }]}
        value={skillsValue}
        placeholder="React, Python, Communication"
        placeholderTextColor={colors.textMuted}
        onChangeText={setSkillsDraft}
        onBlur={() => setProfile((prev) => ({ ...prev, skills: parseCommaSeparated(skillsDraft) }))}
      />

      <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.sectionHeader}>
          <View>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Projects</Text>
            <Text style={[styles.sectionSub, { color: colors.textMuted }]}>Add projects with tech stack, link, and description.</Text>
          </View>
          <TouchableOpacity style={[styles.addBtn, { backgroundColor: colors.accentSoft }]} onPress={() => {
            setProfile((prev) => ({ ...prev, projects: [...prev.projects, emptyProject()] }));
            setProjectTechDrafts((prev) => ({ ...prev, [profile.projects.length]: "" }));
          }}>
            <Text style={[styles.addBtnText, { color: colors.accent }]}>+ Add</Text>
          </TouchableOpacity>
        </View>
        {profile.projects.length === 0 ? <Text style={[styles.emptyText, { color: colors.textMuted }]}>No projects added yet.</Text> : null}
        {profile.projects.map((item, index) => (
          <View key={`project-${index}`} style={[styles.entryCard, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
            <View style={styles.entryHeader}>
              <Text style={[styles.entryTitle, { color: colors.text }]}>Project {index + 1}</Text>
              <TouchableOpacity onPress={() => {
                setProfile((prev) => ({ ...prev, projects: prev.projects.filter((_, itemIndex) => itemIndex !== index) }));
                setProjectTechDrafts((prev) => {
                  const next: Record<number, string> = {};
                  Object.entries(prev).forEach(([key, draft]) => {
                    const numericKey = Number(key);
                    if (numericKey < index) next[numericKey] = draft;
                    if (numericKey > index) next[numericKey - 1] = draft;
                  });
                  return next;
                });
              }}>
                <Text style={styles.removeText}>Remove</Text>
              </TouchableOpacity>
            </View>
            <TextInput style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]} placeholder="Title" placeholderTextColor={colors.textMuted} value={item.title} onChangeText={(value) => updateProject(index, "title", value)} />
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
              placeholder="Tech stack (comma separated)"
              placeholderTextColor={colors.textMuted}
              value={projectTechDrafts[index] ?? item.tech.join(", ")}
              onChangeText={(value) => syncProjectTechDraft(index, value)}
              onBlur={() => commitProjectTechDraft(index)}
            />
            <TextInput style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]} placeholder="GitHub / Demo link" placeholderTextColor={colors.textMuted} value={item.link} onChangeText={(value) => updateProject(index, "link", value)} autoCapitalize="none" />
            <TextInput style={[styles.input, styles.multilineSmall, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]} placeholder="Description" placeholderTextColor={colors.textMuted} multiline value={item.description} onChangeText={(value) => updateProject(index, "description", value)} />
          </View>
        ))}
      </View>

      <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.sectionHeader}>
          <View>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Achievements</Text>
            <Text style={[styles.sectionSub, { color: colors.textMuted }]}>Add certifications, awards, and recognitions.</Text>
          </View>
          <TouchableOpacity style={[styles.addBtn, { backgroundColor: colors.accentSoft }]} onPress={() => setProfile((prev) => ({ ...prev, achievements: [...prev.achievements, emptyAchievement()] }))}>
            <Text style={[styles.addBtnText, { color: colors.accent }]}>+ Add</Text>
          </TouchableOpacity>
        </View>
        {profile.achievements.length === 0 ? <Text style={[styles.emptyText, { color: colors.textMuted }]}>No achievements added yet.</Text> : null}
        {profile.achievements.map((item, index) => (
          <View key={`achievement-${index}`} style={[styles.entryCard, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
            <View style={styles.entryHeader}>
              <Text style={[styles.entryTitle, { color: colors.text }]}>Achievement {index + 1}</Text>
              <TouchableOpacity onPress={() => setProfile((prev) => ({ ...prev, achievements: prev.achievements.filter((_, itemIndex) => itemIndex !== index) }))}>
                <Text style={styles.removeText}>Remove</Text>
              </TouchableOpacity>
            </View>
            <TextInput style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]} placeholder="Title" placeholderTextColor={colors.textMuted} value={item.title} onChangeText={(value) => updateAchievement(index, "title", value)} />
            <TextInput style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]} placeholder="Issuer" placeholderTextColor={colors.textMuted} value={item.issuer} onChangeText={(value) => updateAchievement(index, "issuer", value)} />
            <DateField label="Achievement Date" value={item.date} placeholder="Select achievement date" onChange={(value) => updateAchievement(index, "date", value)} />
            <TextInput style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]} placeholder="URL (optional)" placeholderTextColor={colors.textMuted} value={item.url} onChangeText={(value) => updateAchievement(index, "url", value)} autoCapitalize="none" />
          </View>
        ))}
      </View>

      <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.sectionHeader}>
          <View>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Experience</Text>
            <Text style={[styles.sectionSub, { color: colors.textMuted }]}>Add internships, work, research, or volunteer roles.</Text>
          </View>
          <TouchableOpacity style={[styles.addBtn, { backgroundColor: colors.accentSoft }]} onPress={() => setProfile((prev) => ({ ...prev, experiences: [...prev.experiences, emptyExperience()] }))}>
            <Text style={[styles.addBtnText, { color: colors.accent }]}>+ Add</Text>
          </TouchableOpacity>
        </View>
        {profile.experiences.length === 0 ? <Text style={[styles.emptyText, { color: colors.textMuted }]}>No experience added yet.</Text> : null}
        {profile.experiences.map((item, index) => (
          <View key={`experience-${index}`} style={[styles.entryCard, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
            <View style={styles.entryHeader}>
              <Text style={[styles.entryTitle, { color: colors.text }]}>Experience {index + 1}</Text>
              <TouchableOpacity onPress={() => setProfile((prev) => ({ ...prev, experiences: prev.experiences.filter((_, itemIndex) => itemIndex !== index) }))}>
                <Text style={styles.removeText}>Remove</Text>
              </TouchableOpacity>
            </View>
            <TextInput style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]} placeholder="Organization" placeholderTextColor={colors.textMuted} value={item.organization} onChangeText={(value) => updateExperience(index, "organization", value)} />
            <TextInput style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]} placeholder="Role" placeholderTextColor={colors.textMuted} value={item.role} onChangeText={(value) => updateExperience(index, "role", value)} />
            <TextInput style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]} placeholder="Start" placeholderTextColor={colors.textMuted} value={item.start} onChangeText={(value) => updateExperience(index, "start", value)} />
            <TextInput style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]} placeholder="End" placeholderTextColor={colors.textMuted} value={item.end} onChangeText={(value) => updateExperience(index, "end", value)} />
            <TextInput style={[styles.input, styles.multilineSmall, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]} placeholder="Description" placeholderTextColor={colors.textMuted} multiline value={item.description} onChangeText={(value) => updateExperience(index, "description", value)} />
          </View>
        ))}
      </View>

      <Text style={[styles.label, { color: colors.text }]}>Career Goals</Text>
      <TextInput style={[styles.input, { backgroundColor: colors.surfaceAlt, borderColor: colors.border, color: colors.text }]} placeholderTextColor={colors.textMuted} value={profile.careerGoals} onChangeText={(careerGoals) => setProfile((prev) => ({ ...prev, careerGoals }))} />

      <View style={[styles.resumeSection, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.resumeTitle, { color: colors.text }]}>Resume (PDF/DOC)</Text>
        <Text style={[styles.resumeSub, { color: colors.textMuted }]}>
          Upload your resume file. Students and mentors can open it from your profile when needed.
        </Text>

        <View style={styles.resumeActions}>
          <TouchableOpacity style={[styles.uploadBtn, { borderColor: colors.accent, backgroundColor: colors.surfaceAlt }]} onPress={uploadResume} disabled={uploadingResume}>
            <Text style={[styles.uploadBtnText, { color: colors.accent }]}>{uploadingResume ? "Uploading..." : profile.resumeUrl ? "Replace Resume" : "Upload Resume"}</Text>
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

        <Text style={[styles.resumeLinkLabel, { color: colors.text }]}>Resume link (auto-filled after upload)</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.surfaceAlt, borderColor: colors.border, color: colors.text }]}
          value={profile.resumeUrl}
          onChangeText={(resumeUrl) => setProfile((prev) => ({ ...prev, resumeUrl }))}
          placeholder="https://..."
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
        />
      </View>

      {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
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
  photoActionRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 8, marginTop: 10 },
  photoHint: { marginTop: 10, textAlign: "center", fontSize: 12, maxWidth: 320 },
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
  selectionWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 10 },
  optionChip: {
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1
  },
  optionChipActive: {
    backgroundColor: "#E8F5EE",
    borderColor: "#1F7A4C"
  },
  optionText: { fontWeight: "700", color: "#667085" },
  optionTextActive: { color: "#1F7A4C" },
  searchLoader: { marginBottom: 8 },
  suggestionBox: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: 8
  },
  suggestionItem: {
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderBottomWidth: 1
  },
  suggestionTitle: { fontSize: 14, fontWeight: "700", color: "#1E2B24" },
  suggestionMeta: { marginTop: 2, fontSize: 12, color: "#667085" },
  helperText: { marginTop: -2, marginBottom: 10, fontSize: 12, lineHeight: 17 },
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
