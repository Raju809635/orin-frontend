import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  PanResponder,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { api } from "@/lib/api";
import { notify } from "@/utils/notify";

type MentorProfile = {
  title: string;
  phoneNumber: string;
  company: string;
  experienceYears: number;
  sessionPrice: number;
  about: string;
  achievements: string[];
  linkedInUrl: string;
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

function reorderArray<T>(items: T[], fromIndex: number, toIndex: number) {
  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

export default function MentorProfileScreen() {
  const [profile, setProfile] = useState<MentorProfile | null>(null);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
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
          title: profilePayload.title || "",
          phoneNumber: profilePayload.phoneNumber || "",
          company: profilePayload.company || "",
          experienceYears: Number(profilePayload.experienceYears || 0),
          sessionPrice: Number(profilePayload.sessionPrice || 0),
          about: profilePayload.about || "",
          achievements: Array.isArray(profilePayload.achievements) ? profilePayload.achievements : [],
          linkedInUrl: profilePayload.linkedInUrl || "",
          profileCompleteness: Number(profilePayload.profileCompleteness || 0),
          primaryCategory: profilePayload.primaryCategory || "",
          subCategory: profilePayload.subCategory || "",
          specializations: Array.isArray(profilePayload.specializations)
            ? profilePayload.specializations
            : []
        });
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
        expertiseDomains: profile.specializations
      };
      const { data } = await api.patch("/api/profiles/mentor/me", payload);
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              profileCompleteness: data?.profile?.profileCompleteness || prev.profileCompleteness
            }
          : prev
      );
      notify("Mentor profile updated");
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
      <Text style={styles.title}>Mentor Profile</Text>
      <Text style={styles.sub}>Profile completeness: {profile.profileCompleteness || 0}%</Text>

      <Text style={styles.label}>Title</Text>
      <TextInput
        style={styles.input}
        value={profile.title}
        onChangeText={(title) => setProfile((prev) => (prev ? { ...prev, title } : prev))}
      />

      <Text style={styles.label}>Company</Text>
      <TextInput
        style={styles.input}
        value={profile.company}
        onChangeText={(company) => setProfile((prev) => (prev ? { ...prev, company } : prev))}
      />

      <Text style={styles.label}>Experience Years</Text>
      <TextInput
        style={styles.input}
        keyboardType="numeric"
        value={String(profile.experienceYears || 0)}
        onChangeText={(val) =>
          setProfile((prev) => (prev ? { ...prev, experienceYears: Number(val || 0) } : prev))
        }
      />

      <Text style={styles.label}>Session Price (INR)</Text>
      <TextInput
        style={styles.input}
        keyboardType="numeric"
        value={String(profile.sessionPrice || 0)}
        onChangeText={(val) =>
          setProfile((prev) => (prev ? { ...prev, sessionPrice: Number(val || 0) } : prev))
        }
      />

      <Text style={styles.label}>Phone Number</Text>
      <TextInput
        style={styles.input}
        keyboardType="phone-pad"
        value={profile.phoneNumber}
        onChangeText={(phoneNumber) => setProfile((prev) => (prev ? { ...prev, phoneNumber } : prev))}
      />

      <Text style={styles.label}>Primary Category</Text>
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

      <Text style={styles.label}>Subcategory</Text>
      <View style={styles.selectionWrap}>
        {subCategoryOptions.length === 0 ? (
          <Text style={styles.hint}>Choose primary category first.</Text>
        ) : (
          subCategoryOptions.map((sub) => {
            const active = profile.subCategory === sub.sub;
            return (
              <TouchableOpacity
                key={sub.sub}
                style={[styles.optionChip, active && styles.optionChipActive]}
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
                <Text style={[styles.optionText, active && styles.optionTextActive]}>{sub.sub}</Text>
              </TouchableOpacity>
            );
          })
        )}
      </View>

      <Text style={styles.label}>Specializations</Text>
      <View style={styles.selectionWrap}>
        {specializationOptions.length === 0 ? (
          <Text style={styles.hint}>Choose subcategory first.</Text>
        ) : (
          specializationOptions.map((spec) => {
            const active = profile.specializations.includes(spec);
            return (
              <TouchableOpacity
                key={spec}
                style={[styles.optionChip, active && styles.optionChipActive]}
                onPress={() => toggleSpecialization(spec)}
              >
                <Text style={[styles.optionText, active && styles.optionTextActive]}>{spec}</Text>
              </TouchableOpacity>
            );
          })
        )}
      </View>

      <Text style={styles.label}>Reorder Selected Specializations (drag)</Text>
      {profile.specializations.length === 0 ? <Text style={styles.hint}>Select at least one specialization.</Text> : null}
      {profile.specializations.map((spec, index) => {
        const isDragging = draggingIndex === index;
        return (
          <Animated.View
            key={`${spec}-${index}`}
            {...panResponders[index]?.panHandlers}
            style={[
              styles.dragRow,
              isDragging && {
                zIndex: 2,
                transform: [{ translateY: dragOffset }]
              }
            ]}
          >
            <Text style={styles.dragHandle}>|||</Text>
            <Text style={styles.dragText}>{spec}</Text>
          </Animated.View>
        );
      })}

      <Text style={styles.label}>About</Text>
      <TextInput
        style={[styles.input, styles.multiline]}
        multiline
        value={profile.about}
        onChangeText={(about) => setProfile((prev) => (prev ? { ...prev, about } : prev))}
      />

      <Text style={styles.label}>Achievements (comma separated)</Text>
      <TextInput
        style={styles.input}
        value={(profile.achievements || []).join(", ")}
        onChangeText={(val) =>
          setProfile((prev) =>
            prev
              ? {
                  ...prev,
                  achievements: val
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean)
                }
              : prev
          )
        }
      />

      <Text style={styles.label}>LinkedIn URL</Text>
      <TextInput
        style={styles.input}
        value={profile.linkedInUrl}
        onChangeText={(linkedInUrl) => setProfile((prev) => (prev ? { ...prev, linkedInUrl } : prev))}
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
  error: { marginTop: 10, color: "#B42318" }
});
