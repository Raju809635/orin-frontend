import React, { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { api } from "@/lib/api";
import { notify } from "@/utils/notify";
import { ORIN_CATEGORIES, PRIMARY_CATEGORIES } from "@/constants/categories";

type MentorProfile = {
  profilePhotoUrl: string;
  title: string;
  company: string;
  experienceYears: number;
  expertiseDomains: string[];
  primaryCategory: string;
  subCategory: string;
  sessionPrice: number;
  weeklyAvailabilitySlots: Array<{ day: string; startTime: string; endTime: string }>;
  about: string;
  achievements: string[];
  linkedInUrl: string;
  profileCompleteness: number;
};

export default function MentorProfileScreen() {
  const [profile, setProfile] = useState<MentorProfile | null>(null);
  const [availabilityText, setAvailabilityText] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data } = await api.get("/api/profiles/mentor/me");
        if (mounted) {
          setProfile(data.profile);
          const text = (data.profile.weeklyAvailabilitySlots || [])
            .map((slot: any) => `${slot.day} ${slot.startTime}-${slot.endTime}`)
            .join(", ");
          setAvailabilityText(text);
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
      const weeklyAvailabilitySlots = availabilityText
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean)
        .map((entry) => {
          const [dayPart, timePart] = entry.split(" ");
          const [startTime, endTime] = (timePart || "").split("-");
          return {
            day: dayPart || "",
            startTime: startTime || "",
            endTime: endTime || ""
          };
        })
        .filter((slot) => slot.day && slot.startTime && slot.endTime);

      const { data } = await api.patch("/api/profiles/mentor/me", {
        ...profile,
        weeklyAvailabilitySlots
      });
      setProfile(data.profile);
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

  const subCategories = ORIN_CATEGORIES[profile.primaryCategory] || [];

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Mentor Profile</Text>
      <Text style={styles.sub}>Profile completeness: {profile.profileCompleteness || 0}%</Text>

      <Text style={styles.label}>Profile Photo URL</Text>
      <TextInput
        style={styles.input}
        placeholder="https://your-image-link.com/photo.jpg"
        value={profile.profilePhotoUrl || ""}
        onChangeText={(profilePhotoUrl) => setProfile((prev) => (prev ? { ...prev, profilePhotoUrl } : prev))}
      />

      <Text style={styles.label}>Title</Text>
      <TextInput
        style={styles.input}
        value={profile.title || ""}
        onChangeText={(title) => setProfile((prev) => (prev ? { ...prev, title } : prev))}
      />

      <Text style={styles.label}>Company</Text>
      <TextInput
        style={styles.input}
        value={profile.company || ""}
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

      <Text style={styles.label}>Primary Category</Text>
      <View style={styles.domainWrap}>
        {PRIMARY_CATEGORIES.map((domain) => {
          const selected = profile.primaryCategory === domain;
          return (
            <TouchableOpacity
              key={domain}
              style={[styles.domainChip, selected && styles.domainChipActive]}
              onPress={() =>
                setProfile((prev) =>
                  prev
                    ? {
                        ...prev,
                        primaryCategory: domain,
                        subCategory: ORIN_CATEGORIES[domain]?.[0] || "",
                        expertiseDomains: []
                      }
                    : prev
                )
              }
            >
              <Text style={[styles.domainChipText, selected && styles.domainChipTextActive]}>{domain}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={styles.label}>Subcategory</Text>
      <View style={styles.domainWrap}>
        {subCategories.map((item) => {
          const selected = profile.subCategory === item;
          return (
            <TouchableOpacity
              key={item}
              style={[styles.domainChip, selected && styles.domainChipActive]}
              onPress={() => setProfile((prev) => (prev ? { ...prev, subCategory: item } : prev))}
            >
              <Text style={[styles.domainChipText, selected && styles.domainChipTextActive]}>{item}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={styles.label}>Specializations</Text>
      <View style={styles.domainWrap}>
        {subCategories.map((domain) => {
          const selected = (profile.expertiseDomains || []).includes(domain);
          return (
            <TouchableOpacity
              key={domain}
              style={[styles.domainChip, selected && styles.domainChipActive]}
              onPress={() =>
                setProfile((prev) => {
                  if (!prev) return prev;
                  const current = prev.expertiseDomains || [];
                  const next = current.includes(domain)
                    ? current.filter((item) => item !== domain)
                    : [...current, domain];
                  return { ...prev, expertiseDomains: next };
                })
              }
            >
              <Text style={[styles.domainChipText, selected && styles.domainChipTextActive]}>{domain}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={styles.label}>Session Price (INR)</Text>
      <TextInput
        style={styles.input}
        keyboardType="numeric"
        value={String(profile.sessionPrice || 0)}
        onChangeText={(val) =>
          setProfile((prev) => (prev ? { ...prev, sessionPrice: Number(val || 0) } : prev))
        }
      />

      <Text style={styles.label}>Availability Schedule</Text>
      <TextInput
        style={styles.input}
        placeholder="Mon 18:00-20:00, Tue 19:00-21:00"
        value={availabilityText}
        onChangeText={setAvailabilityText}
      />

      <Text style={styles.label}>About</Text>
      <TextInput
        style={[styles.input, styles.multiline]}
        multiline
        value={profile.about || ""}
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
        value={profile.linkedInUrl || ""}
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
  domainWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 4
  },
  domainChip: {
    borderWidth: 1,
    borderColor: "#D0D5DD",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#fff"
  },
  domainChipActive: {
    borderColor: "#0B3D2E",
    backgroundColor: "#E8F5EE"
  },
  domainChipText: {
    color: "#344054",
    fontWeight: "600",
    fontSize: 13
  },
  domainChipTextActive: {
    color: "#0B3D2E"
  },
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
