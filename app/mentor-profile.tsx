import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  Linking,
  PanResponder,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { useAppTheme } from "@/context/ThemeContext";
import { api } from "@/lib/api";
import { notify } from "@/utils/notify";
import { pickAndUploadProfilePhoto } from "@/utils/profilePhotoUpload";
import { pickAndUploadResumeFile } from "@/utils/resumeUpload";
import DateField from "@/components/profile/date-field";

type ProfileAchievement = {
  title: string;
  issuer: string;
  date: string;
  url: string;
};

type ProfileProject = {
  title: string;
  tech: string[];
  link: string;
  description: string;
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

type MentorProfile = {
  profilePhotoUrl: string;
  title: string;
  phoneNumber: string;
  company: string;
  experienceYears: number;
  sessionPrice: number;
  about: string;
  state: string;
  education: ProfileEducation[];
  achievements: ProfileAchievement[];
  projects: ProfileProject[];
  experiences: ProfileExperience[];
  linkedInUrl: string;
  resumeUrl: string;
  profileCompleteness: number;
  primaryCategory: string;
  subCategory: string;
  specializations: string[];
};

type SubCategoryOption = {
  sub: string;
  specializations: string[];
};

type CategoryOption = {
  primary: string;
  subCategories: SubCategoryOption[];
};

const DRAG_ROW_HEIGHT = 50;
const emptyAchievement = (): ProfileAchievement => ({ title: "", issuer: "", date: "", url: "" });
const emptyProject = (): ProfileProject => ({ title: "", tech: [], link: "", description: "" });
const emptyExperience = (): ProfileExperience => ({ organization: "", role: "", start: "", end: "", description: "" });
const emptyEducation = (): ProfileEducation => ({ school: "", degree: "", year: "" });

function reorderArray<T>(items: T[], fromIndex: number, toIndex: number) {
  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

function normalizeAchievement(value: any = {}): ProfileAchievement {
  if (typeof value === "string") {
    return { title: value.trim(), issuer: "", date: "", url: "" };
  }
  return {
    title: String(value?.title || "").trim(),
    issuer: String(value?.issuer || "").trim(),
    date: String(value?.date || "").trim(),
    url: String(value?.url || "").trim()
  };
}

function normalizeProject(value: any = {}): ProfileProject {
  return {
    title: String(value?.title || value?.name || "").trim(),
    tech: Array.isArray(value?.tech)
      ? value.tech.map((item: any) => String(item || "").trim()).filter(Boolean)
      : Array.isArray(value?.techStack)
        ? value.techStack.map((item: any) => String(item || "").trim()).filter(Boolean)
        : [],
    link: String(value?.link || "").trim(),
    description: String(value?.description || value?.summary || "").trim()
  };
}

function normalizeExperience(value: any = {}): ProfileExperience {
  return {
    organization: String(value?.organization || "").trim(),
    role: String(value?.role || "").trim(),
    start: String(value?.start || value?.startDate || "").trim(),
    end: String(value?.end || value?.endDate || "").trim(),
    description: String(value?.description || "").trim()
  };
}

function normalizeEducation(value: any = {}): ProfileEducation {
  return {
    school: String(value?.school || "").trim(),
    degree: String(value?.degree || "").trim(),
    year: String(value?.year || "").trim()
  };
}

function parseCommaSeparated(value: string) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function MentorProfileScreen() {
  const { colors } = useAppTheme();
  const [profile, setProfile] = useState<MentorProfile | null>(null);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [savingPhoto, setSavingPhoto] = useState(false);
  const [photoDirty, setPhotoDirty] = useState(false);
  const [uploadingResume, setUploadingResume] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [projectTechDrafts, setProjectTechDrafts] = useState<Record<number, string>>({});
  const dragOffset = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [{ data: profileData }, { data: categoryData }] = await Promise.all([
          api.get("/api/profiles/mentor/me"),
          api.get("/api/profiles/mentor/categories")
        ]);

        if (!mounted) return;
        const profilePayload = profileData.profile || {};
        setProfile({
          profilePhotoUrl: profilePayload.profilePhotoUrl || "",
          title: profilePayload.title || "",
          phoneNumber: profilePayload.phoneNumber || "",
          company: profilePayload.company || "",
          experienceYears: Number(profilePayload.experienceYears || 0),
          sessionPrice: Number(profilePayload.sessionPrice || 0),
          about: profilePayload.about || "",
          state: profilePayload.state || "",
          education: Array.isArray(profilePayload.education) ? profilePayload.education.map(normalizeEducation) : [],
          achievements: Array.isArray(profilePayload.achievements)
            ? profilePayload.achievements.map(normalizeAchievement)
            : [],
          projects: Array.isArray(profilePayload.projects) ? profilePayload.projects.map(normalizeProject) : [],
          experiences: Array.isArray(profilePayload.experiences)
            ? profilePayload.experiences.map(normalizeExperience)
            : [],
          linkedInUrl: profilePayload.linkedInUrl || "",
          resumeUrl: profilePayload.resumeUrl || "",
          profileCompleteness: Number(profilePayload.profileCompleteness || 0),
          primaryCategory: profilePayload.primaryCategory || "",
          subCategory: profilePayload.subCategory || "",
          specializations: Array.isArray(profilePayload.specializations)
            ? profilePayload.specializations.filter(Boolean)
            : []
        });
        setProjectTechDrafts(
          Array.isArray(profilePayload.projects)
            ? Object.fromEntries(
                profilePayload.projects.map((project: any, index: number) => [index, normalizeProject(project).tech.join(", ")])
              )
            : {}
        );
        setCategories(Array.isArray(categoryData.categories) ? categoryData.categories : []);
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

  const subCategoryOptions = useMemo(() => {
    if (!profile?.primaryCategory) return [];
    return categories.find((cat) => cat.primary === profile.primaryCategory)?.subCategories || [];
  }, [categories, profile?.primaryCategory]);

  const specializationOptions = useMemo(() => {
    if (!profile?.subCategory) return [];
    return subCategoryOptions.find((sub) => sub.sub === profile.subCategory)?.specializations || [];
  }, [subCategoryOptions, profile?.subCategory]);

  const toggleSpecialization = (value: string) => {
    setProfile((prev) => {
      if (!prev) return prev;
      const exists = prev.specializations.includes(value);
      const specializations = exists
        ? prev.specializations.filter((spec) => spec !== value)
        : [...prev.specializations, value];
      return { ...prev, specializations };
    });
  };

  const updateAchievement = (index: number, key: keyof ProfileAchievement, value: string) => {
    setProfile((prev) =>
      prev
        ? {
            ...prev,
            achievements: prev.achievements.map((item, itemIndex) =>
              itemIndex === index ? { ...item, [key]: value } : item
            )
          }
        : prev
    );
  };

  const updateProject = (index: number, key: keyof ProfileProject, value: string | string[]) => {
    setProfile((prev) =>
      prev
        ? {
            ...prev,
            projects: prev.projects.map((item, itemIndex) =>
              itemIndex === index ? { ...item, [key]: value } : item
            )
          }
        : prev
    );
  };

  const syncProjectTechDraft = (index: number, value: string) => {
    setProjectTechDrafts((prev) => ({ ...prev, [index]: value }));
  };

  const commitProjectTechDraft = (index: number) => {
    updateProject(index, "tech", parseCommaSeparated(projectTechDrafts[index] || ""));
  };

  const updateExperience = (index: number, key: keyof ProfileExperience, value: string) => {
    setProfile((prev) =>
      prev
        ? {
            ...prev,
            experiences: prev.experiences.map((item, itemIndex) =>
              itemIndex === index ? { ...item, [key]: value } : item
            )
          }
        : prev
    );
  };

  const updateEducation = (index: number, key: keyof ProfileEducation, value: string) => {
    setProfile((prev) =>
      prev
        ? {
            ...prev,
            education: prev.education.map((item, itemIndex) =>
              itemIndex === index ? { ...item, [key]: value } : item
            )
          }
        : prev
    );
  };

  async function uploadResume() {
    if (!profile) return;
    try {
      setError(null);
      setUploadingResume(true);
      const uploaded = await pickAndUploadResumeFile();
      if (!uploaded) return;
      const nextUrl = uploaded.url;
      setProfile((prev) => (prev ? { ...prev, resumeUrl: nextUrl } : prev));
      await api.patch("/api/profiles/mentor/me", { resumeUrl: nextUrl });
      notify("Resume uploaded successfully.");
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || "Failed to upload resume");
    } finally {
      setUploadingResume(false);
    }
  }

  async function removeResume() {
    if (!profile?.resumeUrl) return;
    const confirmed = await new Promise<boolean>((resolve) => {
      Alert.alert("Remove resume?", "This will remove the resume link from your mentor profile.", [
        { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
        { text: "Remove", style: "destructive", onPress: () => resolve(true) }
      ]);
    });
    if (!confirmed) return;

    try {
      setError(null);
      setUploadingResume(true);
      await api.patch("/api/profiles/mentor/me", { resumeUrl: "" });
      setProfile((prev) => (prev ? { ...prev, resumeUrl: "" } : prev));
      notify("Resume removed.");
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to remove resume");
    } finally {
      setUploadingResume(false);
    }
  }

  async function openResume() {
    const url = (profile?.resumeUrl || "").trim();
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

  const panResponders = useMemo(() => {
    if (!profile) return [];
    return profile.specializations.map((_, index) =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          setDraggingIndex(index);
          dragOffset.setValue(0);
        },
        onPanResponderMove: (_evt, gestureState) => {
          dragOffset.setValue(gestureState.dy);
        },
        onPanResponderRelease: (_evt, gestureState) => {
          const moveSteps = Math.round(gestureState.dy / DRAG_ROW_HEIGHT);
          const targetIndex = Math.max(
            0,
            Math.min(index + moveSteps, (profile.specializations.length || 1) - 1)
          );
          if (targetIndex !== index) {
            setProfile((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                specializations: reorderArray(prev.specializations, index, targetIndex)
              };
            });
          }
          setDraggingIndex(null);
          dragOffset.setValue(0);
        }
      })
    );
  }, [dragOffset, profile]);

  async function save() {
    if (!profile) return;
    try {
      setSaving(true);
      setError(null);
      const payload = {
        ...profile,
        expertiseDomains: profile.specializations,
        education: profile.education.filter((item) => item.school || item.degree || item.year),
        achievements: profile.achievements.filter((item) => item.title || item.issuer || item.date || item.url),
        projects: profile.projects
          .map((item, index) => ({
            ...item,
            tech: parseCommaSeparated(projectTechDrafts[index] ?? item.tech.join(", "))
          }))
          .filter((item) => item.title || item.description || item.link || item.tech.length),
        experiences: profile.experiences.filter(
          (item) => item.organization || item.role || item.start || item.end || item.description
        )
      };
      const { data } = await api.patch("/api/profiles/mentor/me", payload);
      const profileData = data.profile || {};
      setProfile((prev) =>
        prev
            ? {
                ...prev,
                ...profileData,
                state: typeof profileData.state === "string" ? profileData.state : payload.state,
                education: Array.isArray(profileData.education)
                  ? profileData.education.map(normalizeEducation)
                  : payload.education,
                achievements: Array.isArray(profileData.achievements)
                  ? profileData.achievements.map(normalizeAchievement)
                  : payload.achievements,
              projects: Array.isArray(profileData.projects) ? profileData.projects.map(normalizeProject) : payload.projects,
              experiences: Array.isArray(profileData.experiences)
                ? profileData.experiences.map(normalizeExperience)
                : payload.experiences,
              specializations: Array.isArray(profileData.specializations)
                ? profileData.specializations.filter(Boolean)
                : prev.specializations
            }
          : prev
      );
      const nextProjects = Array.isArray(profileData.projects) ? profileData.projects.map(normalizeProject) : payload.projects;
      setProjectTechDrafts(Object.fromEntries(nextProjects.map((item, index) => [index, item.tech.join(", ")])));
      setPhotoDirty(false);
      notify("Mentor profile updated");
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
      setPhotoDirty(true);
      notify("Photo selected. Save photo to apply it everywhere.");
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to upload profile photo");
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function savePhoto() {
    if (!profile) return;
    try {
      setSavingPhoto(true);
      setError(null);
      const { data } = await api.patch("/api/profiles/mentor/me", { profilePhotoUrl: profile.profilePhotoUrl });
      setProfile((prev) => (prev ? { ...prev, profilePhotoUrl: data?.profile?.profilePhotoUrl || prev.profilePhotoUrl } : prev));
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
    if (!confirmed || !profile) return;

    setProfile((prev) => (prev ? { ...prev, profilePhotoUrl: "" } : prev));
    setPhotoDirty(true);
    notify("Photo removed locally. Save photo to apply.");
  }

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={[styles.error, { color: colors.danger }]}>{error || "Profile unavailable"}</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.text }]}>Mentor Profile</Text>
      <Text style={[styles.sub, { color: colors.textMuted }]}>Profile completeness: {profile.profileCompleteness || 0}%</Text>
      <View style={styles.photoWrap}>
        {profile.profilePhotoUrl ? (
          <Image source={{ uri: profile.profilePhotoUrl }} style={styles.photo} />
        ) : (
          <View style={[styles.photo, styles.photoFallback, { backgroundColor: colors.accentSoft }]}>
            <Text style={[styles.photoFallbackText, { color: colors.accent }]}>
              {(profile.title || "M").trim().charAt(0).toUpperCase() || "M"}
            </Text>
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
        <Text style={[styles.hint, { color: colors.textMuted, textAlign: "center" }]}>You can crop while selecting. Save Photo updates your avatar separately from the rest of the mentor profile.</Text>
      </View>

      <Text style={[styles.label, { color: colors.text }]}>Title</Text>
      <TextInput
        style={[styles.input, { backgroundColor: colors.surfaceAlt, borderColor: colors.border, color: colors.text }]}
        value={profile.title}
        onChangeText={(title) => setProfile((prev) => (prev ? { ...prev, title } : prev))}
      />

      <Text style={[styles.label, { color: colors.text }]}>Company</Text>
      <TextInput
        style={[styles.input, { backgroundColor: colors.surfaceAlt, borderColor: colors.border, color: colors.text }]}
        value={profile.company}
        onChangeText={(company) => setProfile((prev) => (prev ? { ...prev, company } : prev))}
      />

      <Text style={[styles.label, { color: colors.text }]}>State</Text>
      <TextInput
        style={[styles.input, { backgroundColor: colors.surfaceAlt, borderColor: colors.border, color: colors.text }]}
        value={profile.state}
        onChangeText={(state) => setProfile((prev) => (prev ? { ...prev, state } : prev))}
      />

      <Text style={[styles.label, { color: colors.text }]}>Experience Years</Text>
      <TextInput
        style={[styles.input, { backgroundColor: colors.surfaceAlt, borderColor: colors.border, color: colors.text }]}
        keyboardType="numeric"
        value={String(profile.experienceYears || 0)}
        onChangeText={(val) =>
          setProfile((prev) => (prev ? { ...prev, experienceYears: Number(val || 0) } : prev))
        }
      />

      <Text style={[styles.label, { color: colors.text }]}>Session Price (INR)</Text>
      <TextInput
        style={[styles.input, { backgroundColor: colors.surfaceAlt, borderColor: colors.border, color: colors.text }]}
        keyboardType="numeric"
        value={String(profile.sessionPrice || 0)}
        onChangeText={(val) =>
          setProfile((prev) => (prev ? { ...prev, sessionPrice: Number(val || 0) } : prev))
        }
      />

      <Text style={[styles.label, { color: colors.text }]}>Phone Number</Text>
      <TextInput
        style={[styles.input, { backgroundColor: colors.surfaceAlt, borderColor: colors.border, color: colors.text }]}
        keyboardType="phone-pad"
        value={profile.phoneNumber}
        onChangeText={(phoneNumber) => setProfile((prev) => (prev ? { ...prev, phoneNumber } : prev))}
      />

      <Text style={[styles.label, { color: colors.text }]}>Primary Category</Text>
      <View style={styles.selectionWrap}>
        {categories.map((cat) => {
          const active = profile.primaryCategory === cat.primary;
          return (
            <TouchableOpacity
              key={cat.primary}
              style={[styles.optionChip, active && styles.optionChipActive]}
              onPress={() =>
                setProfile((prev) =>
                  prev
                    ? {
                        ...prev,
                        primaryCategory: cat.primary,
                        subCategory: "",
                        specializations: []
                      }
                    : prev
                )
              }
            >
              <Text style={[styles.optionText, active && styles.optionTextActive]}>{cat.primary}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={[styles.label, { color: colors.text }]}>Subcategory</Text>
      <View style={styles.selectionWrap}>
        {subCategoryOptions.length === 0 ? (
          <Text style={[styles.hint, { color: colors.textMuted }]}>Choose primary category first.</Text>
        ) : (
          subCategoryOptions.map((sub) => {
            const active = profile.subCategory === sub.sub;
            return (
              <TouchableOpacity
                key={sub.sub}
                style={[styles.optionChip, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }, active && [styles.optionChipActive, { backgroundColor: colors.accentSoft, borderColor: colors.accent }]]}
                onPress={() =>
                  setProfile((prev) =>
                    prev
                      ? {
                          ...prev,
                          subCategory: sub.sub,
                          specializations: []
                        }
                      : prev
                  )
                }
              >
                <Text style={[styles.optionText, { color: active ? colors.accent : colors.textMuted }, active && styles.optionTextActive]}>{sub.sub}</Text>
              </TouchableOpacity>
            );
          })
        )}
      </View>

      <Text style={[styles.label, { color: colors.text }]}>Specializations</Text>
      <View style={styles.selectionWrap}>
        {specializationOptions.length === 0 ? (
          <Text style={[styles.hint, { color: colors.textMuted }]}>Choose subcategory first.</Text>
        ) : (
          specializationOptions.map((spec) => {
            const active = profile.specializations.includes(spec);
            return (
              <TouchableOpacity
                key={spec}
                style={[styles.optionChip, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }, active && [styles.optionChipActive, { backgroundColor: colors.accentSoft, borderColor: colors.accent }]]}
                onPress={() => toggleSpecialization(spec)}
              >
                <Text style={[styles.optionText, { color: active ? colors.accent : colors.textMuted }, active && styles.optionTextActive]}>{spec}</Text>
              </TouchableOpacity>
            );
          })
        )}
      </View>

      <Text style={[styles.label, { color: colors.text }]}>Reorder Selected Specializations (drag)</Text>
      {profile.specializations.length === 0 ? <Text style={[styles.hint, { color: colors.textMuted }]}>Select at least one specialization.</Text> : null}
      {profile.specializations.map((spec, index) => {
        const isDragging = draggingIndex === index;
        return (
          <Animated.View
            key={`${spec}-${index}`}
            {...panResponders[index]?.panHandlers}
            style={[
              styles.dragRow,
              { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
              isDragging && {
                zIndex: 2,
                transform: [{ translateY: dragOffset }]
              }
            ]}
          >
            <Text style={[styles.dragHandle, { color: colors.textMuted }]}>|||</Text>
            <Text style={[styles.dragText, { color: colors.text }]}>{spec}</Text>
          </Animated.View>
        );
      })}

      <Text style={[styles.label, { color: colors.text }]}>About</Text>
      <TextInput
        style={[styles.input, styles.multiline, { backgroundColor: colors.surfaceAlt, borderColor: colors.border, color: colors.text }]}
        multiline
        value={profile.about}
        onChangeText={(about) => setProfile((prev) => (prev ? { ...prev, about } : prev))}
      />

      <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.sectionHeader}>
          <View>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Education</Text>
            <Text style={[styles.sectionSub, { color: colors.textMuted }]}>Show degrees, colleges, or qualifications that support your mentor profile.</Text>
          </View>
          <TouchableOpacity style={[styles.addBtn, { backgroundColor: colors.accentSoft }]} onPress={() => setProfile((prev) => (prev ? { ...prev, education: [...prev.education, emptyEducation()] } : prev))}>
            <Text style={[styles.addBtnText, { color: colors.accent }]}>+ Add</Text>
          </TouchableOpacity>
        </View>
        {profile.education.length === 0 ? <Text style={[styles.emptyText, { color: colors.textMuted }]}>No education added yet.</Text> : null}
        {profile.education.map((item, index) => (
          <View key={`education-${index}`} style={[styles.entryCard, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
            <View style={styles.entryHeader}>
              <Text style={[styles.entryTitle, { color: colors.text }]}>Education {index + 1}</Text>
              <TouchableOpacity onPress={() => setProfile((prev) => (prev ? { ...prev, education: prev.education.filter((_, itemIndex) => itemIndex !== index) } : prev))}>
                <Text style={styles.removeText}>Remove</Text>
              </TouchableOpacity>
            </View>
            <TextInput style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]} placeholder="School / College" placeholderTextColor={colors.textMuted} value={item.school} onChangeText={(value) => updateEducation(index, "school", value)} />
            <TextInput style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]} placeholder="Degree / Qualification" placeholderTextColor={colors.textMuted} value={item.degree} onChangeText={(value) => updateEducation(index, "degree", value)} />
            <DateField label="Passing Year" mode="year" value={item.year} placeholder="Select passing year" onChange={(value) => updateEducation(index, "year", value)} />
          </View>
        ))}
      </View>

      <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.sectionHeader}>
          <View>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Achievements</Text>
            <Text style={[styles.sectionSub, { color: colors.textMuted }]}>Add certifications, badges, and recognitions.</Text>
          </View>
          <TouchableOpacity style={[styles.addBtn, { backgroundColor: colors.accentSoft }]} onPress={() => setProfile((prev) => (prev ? { ...prev, achievements: [...prev.achievements, emptyAchievement()] } : prev))}>
            <Text style={[styles.addBtnText, { color: colors.accent }]}>+ Add</Text>
          </TouchableOpacity>
        </View>
        {profile.achievements.length === 0 ? <Text style={[styles.emptyText, { color: colors.textMuted }]}>No achievements added yet.</Text> : null}
        {profile.achievements.map((item, index) => (
          <View key={`achievement-${index}`} style={[styles.entryCard, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
            <View style={styles.entryHeader}>
              <Text style={[styles.entryTitle, { color: colors.text }]}>Achievement {index + 1}</Text>
              <TouchableOpacity onPress={() => setProfile((prev) => (prev ? { ...prev, achievements: prev.achievements.filter((_, itemIndex) => itemIndex !== index) } : prev))}>
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
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Projects</Text>
            <Text style={[styles.sectionSub, { color: colors.textMuted }]}>Show mentor projects, case studies, or learning resources.</Text>
          </View>
          <TouchableOpacity
            style={[styles.addBtn, { backgroundColor: colors.accentSoft }]}
            onPress={() => {
              setProfile((prev) => (prev ? { ...prev, projects: [...prev.projects, emptyProject()] } : prev));
              setProjectTechDrafts((prev) => ({ ...prev, [profile.projects.length]: "" }));
            }}
          >
            <Text style={[styles.addBtnText, { color: colors.accent }]}>+ Add</Text>
          </TouchableOpacity>
        </View>
        {profile.projects.length === 0 ? <Text style={[styles.emptyText, { color: colors.textMuted }]}>No projects added yet.</Text> : null}
        {profile.projects.map((item, index) => (
          <View key={`project-${index}`} style={[styles.entryCard, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
            <View style={styles.entryHeader}>
              <Text style={[styles.entryTitle, { color: colors.text }]}>Project {index + 1}</Text>
              <TouchableOpacity
                onPress={() => {
                  setProfile((prev) => (prev ? { ...prev, projects: prev.projects.filter((_, itemIndex) => itemIndex !== index) } : prev));
                  setProjectTechDrafts((prev) => {
                    const next: Record<number, string> = {};
                    Object.entries(prev).forEach(([key, draft]) => {
                      const numericKey = Number(key);
                      if (numericKey < index) next[numericKey] = draft;
                      if (numericKey > index) next[numericKey - 1] = draft;
                    });
                    return next;
                  });
                }}
              >
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
            <TextInput style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]} placeholder="GitHub / Link" placeholderTextColor={colors.textMuted} value={item.link} onChangeText={(value) => updateProject(index, "link", value)} autoCapitalize="none" />
            <TextInput style={[styles.input, styles.multilineSmall, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]} placeholder="Description" placeholderTextColor={colors.textMuted} multiline value={item.description} onChangeText={(value) => updateProject(index, "description", value)} />
          </View>
        ))}
      </View>

      <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.sectionHeader}>
          <View>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Experience</Text>
            <Text style={[styles.sectionSub, { color: colors.textMuted }]}>List mentoring, work, startup, or leadership experience.</Text>
          </View>
          <TouchableOpacity style={[styles.addBtn, { backgroundColor: colors.accentSoft }]} onPress={() => setProfile((prev) => (prev ? { ...prev, experiences: [...prev.experiences, emptyExperience()] } : prev))}>
            <Text style={[styles.addBtnText, { color: colors.accent }]}>+ Add</Text>
          </TouchableOpacity>
        </View>
        {profile.experiences.length === 0 ? <Text style={[styles.emptyText, { color: colors.textMuted }]}>No experience added yet.</Text> : null}
        {profile.experiences.map((item, index) => (
          <View key={`experience-${index}`} style={[styles.entryCard, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
            <View style={styles.entryHeader}>
              <Text style={[styles.entryTitle, { color: colors.text }]}>Experience {index + 1}</Text>
              <TouchableOpacity onPress={() => setProfile((prev) => (prev ? { ...prev, experiences: prev.experiences.filter((_, itemIndex) => itemIndex !== index) } : prev))}>
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

      <Text style={[styles.label, { color: colors.text }]}>LinkedIn URL</Text>
      <TextInput
        style={[styles.input, { backgroundColor: colors.surfaceAlt, borderColor: colors.border, color: colors.text }]}
        value={profile.linkedInUrl}
        onChangeText={(linkedInUrl) => setProfile((prev) => (prev ? { ...prev, linkedInUrl } : prev))}
      />

      <View style={[styles.resumeSection, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.resumeTitle, { color: colors.text }]}>Resume (PDF/DOC)</Text>
        <Text style={[styles.resumeSub, { color: colors.textMuted }]}>Upload your resume for students to view when deciding to book sessions.</Text>
        <View style={styles.resumeActions}>
          <TouchableOpacity style={[styles.uploadBtn, { borderColor: colors.accent, backgroundColor: colors.surfaceAlt }]} onPress={uploadResume} disabled={uploadingResume}>
            <Text style={[styles.uploadBtnText, { color: colors.accent }]}>
              {uploadingResume ? "Uploading..." : profile.resumeUrl ? "Replace Resume" : "Upload Resume"}
            </Text>
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
          onChangeText={(resumeUrl) => setProfile((prev) => (prev ? { ...prev, resumeUrl } : prev))}
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
  selectionWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  optionChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#D0D5DD",
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  optionChipActive: {
    borderColor: "#0B3D2E",
    backgroundColor: "#E8F5EE"
  },
  optionText: { color: "#344054", fontWeight: "600" },
  optionTextActive: { color: "#0B3D2E" },
  hint: { color: "#667085", marginBottom: 4 },
  dragRow: {
    height: DRAG_ROW_HEIGHT,
    borderRadius: 10,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#D0D5DD",
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10
  },
  dragHandle: { color: "#98A2B3", marginRight: 10, fontWeight: "700" },
  dragText: { color: "#1E2B24", fontWeight: "600" },
  button: { marginTop: 18, backgroundColor: "#0B3D2E", borderRadius: 12, paddingVertical: 13, alignItems: "center" },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  error: { marginTop: 10, color: "#B42318" },
  photoWrap: { alignItems: "center", marginBottom: 12 },
  photo: { width: 96, height: 96, borderRadius: 48, borderWidth: 2, borderColor: "#D0D5DD" },
  photoFallback: { alignItems: "center", justifyContent: "center", backgroundColor: "#E8F5EE" },
  photoFallbackText: { color: "#0B3D2E", fontSize: 30, fontWeight: "700" },
  photoActionRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 8, marginTop: 10 },
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
