import React, { useEffect, useState } from "react";
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { api } from "@/lib/api";

type PublicUser = {
  _id: string;
  name: string;
  email: string;
  role: "student" | "mentor";
  status?: string;
  primaryCategory?: string;
  subCategory?: string;
  specializations?: string[];
};

type PublicProfile = {
  profilePhotoUrl?: string;
  title?: string;
  headline?: string;
  about?: string;
  bio?: string;
  skills?: string[];
  experienceYears?: number;
  rating?: number;
  careerGoals?: string;
};

type PublicProfileResponse = {
  user: PublicUser;
  profile: PublicProfile | null;
};

export default function PublicProfileScreen() {
  const params = useLocalSearchParams<{ userId?: string }>();
  const userId = String(params.userId || "").trim();
  const [data, setData] = useState<PublicProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadProfile() {
      if (!userId) {
        setError("Missing user id.");
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        setError(null);
        const res = await api.get<PublicProfileResponse>(`/api/profiles/public/${userId}`);
        if (!mounted) return;
        setData(res.data);
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.response?.data?.message || "Failed to load profile.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadProfile();
    return () => {
      mounted = false;
    };
  }, [userId]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#1F7A4C" />
      </View>
    );
  }

  if (!data) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error || "Profile not found."}</Text>
      </View>
    );
  }

  const profile = data.profile || {};
  const displayLine = [data.user.primaryCategory, data.user.subCategory].filter(Boolean).join(" > ");

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {profile.profilePhotoUrl ? (
        <Image source={{ uri: profile.profilePhotoUrl }} style={styles.avatar} />
      ) : (
        <View style={styles.avatarFallback}>
          <Text style={styles.avatarText}>{data.user.name?.charAt(0)?.toUpperCase() || "U"}</Text>
        </View>
      )}

      <Text style={styles.name}>{data.user.name}</Text>
      <Text style={styles.role}>{data.user.role}</Text>
      {profile.title || profile.headline ? <Text style={styles.title}>{profile.title || profile.headline}</Text> : null}
      {displayLine ? <Text style={styles.domain}>{displayLine}</Text> : null}
      {typeof profile.rating === "number" ? <Text style={styles.meta}>Rating: {profile.rating}</Text> : null}
      {typeof profile.experienceYears === "number" && profile.experienceYears > 0 ? (
        <Text style={styles.meta}>Experience: {profile.experienceYears} years</Text>
      ) : null}

      <Text style={styles.sectionTitle}>About</Text>
      <Text style={styles.about}>{profile.about || profile.bio || "No profile summary yet."}</Text>

      {(profile.skills || []).length ? (
        <>
          <Text style={styles.sectionTitle}>Skills</Text>
          <View style={styles.chips}>
            {(profile.skills || []).map((item) => (
              <View key={item} style={styles.chip}>
                <Text style={styles.chipText}>{item}</Text>
              </View>
            ))}
          </View>
        </>
      ) : null}

      {(data.user.specializations || []).length ? (
        <>
          <Text style={styles.sectionTitle}>Specializations</Text>
          <View style={styles.chips}>
            {(data.user.specializations || []).map((item) => (
              <View key={item} style={styles.chip}>
                <Text style={styles.chipText}>{item}</Text>
              </View>
            ))}
          </View>
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: "#F4F9F6", padding: 20, paddingBottom: 28 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#F4F9F6" },
  avatar: { width: 100, height: 100, borderRadius: 50, alignSelf: "center", borderWidth: 2, borderColor: "#CFE4D8" },
  avatarFallback: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#CFE4D8",
    backgroundColor: "#E8F5EE"
  },
  avatarText: { color: "#0B3D2E", fontSize: 36, fontWeight: "800" },
  name: { marginTop: 12, fontSize: 24, fontWeight: "800", color: "#1E2B24", textAlign: "center" },
  role: { marginTop: 4, color: "#667085", textTransform: "capitalize", textAlign: "center" },
  title: { marginTop: 4, color: "#344054", textAlign: "center" },
  domain: { marginTop: 4, color: "#1F7A4C", fontWeight: "700", textAlign: "center" },
  meta: { marginTop: 4, color: "#667085", textAlign: "center" },
  sectionTitle: { marginTop: 18, marginBottom: 8, color: "#1E2B24", fontWeight: "800", fontSize: 16 },
  about: { color: "#344054", lineHeight: 20 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: "#D0D5DD",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#FFFFFF"
  },
  chipText: { color: "#344054", fontWeight: "600", fontSize: 12 },
  error: { color: "#B42318" }
});

