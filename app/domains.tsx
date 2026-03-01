import React, { useEffect, useState } from "react";
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { CATEGORY_OPTIONS } from "@/constants/categories";
import { api } from "@/lib/api";

type MentorPreview = {
  _id: string;
  name: string;
  email?: string;
  bio?: string;
  expertise?: string;
  primaryCategory?: string;
  subCategory?: string;
  specializations?: string[];
  profilePhotoUrl?: string;
};

export default function DomainScreen() {
  const router = useRouter();
  const [mentors, setMentors] = useState<MentorPreview[]>([]);
  const [loadingMentors, setLoadingMentors] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data } = await api.get<MentorPreview[]>("/api/mentors");
        if (mounted) setMentors(data.slice(0, 8));
      } finally {
        if (mounted) setLoadingMentors(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.heading}>Choose Your Domain</Text>
      <Text style={styles.subheading}>Explore approved mentors and book a session.</Text>
      <Text style={styles.sectionTitle}>Browse by Category</Text>
      {CATEGORY_OPTIONS.map((domain) => (
        <TouchableOpacity
          key={domain}
          style={styles.card}
          onPress={() => router.push(`/mentors?domain=${encodeURIComponent(domain)}` as never)}
        >
          <Text style={styles.text}>{domain}</Text>
        </TouchableOpacity>
      ))}

      <Text style={styles.sectionTitle}>All Mentors</Text>
      <TouchableOpacity style={styles.allCard} onPress={() => router.push("/mentors" as never)}>
        <Text style={styles.allTitle}>View All Mentor Profiles</Text>
        <Text style={styles.allSubtext}>See every approved mentor in one list.</Text>
      </TouchableOpacity>

      <Text style={styles.sectionTitle}>Featured Mentors</Text>
      {loadingMentors ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color="#1F7A4C" />
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {mentors.map((mentor) => (
            <TouchableOpacity
              key={mentor._id}
              style={styles.mentorCard}
              onPress={() => router.push(`/mentor/${mentor._id}` as never)}
            >
              {mentor.profilePhotoUrl ? (
                <Image source={{ uri: mentor.profilePhotoUrl }} style={styles.heroImage} />
              ) : (
                <View style={[styles.heroImage, styles.avatarFallback]}>
                  <Text style={styles.avatarText}>{mentor.name?.charAt(0)?.toUpperCase() || "M"}</Text>
                </View>
              )}
              <Text style={styles.mentorName} numberOfLines={1}>{mentor.name}</Text>
              <Text style={styles.mentorEmail} numberOfLines={1}>{mentor.email || "Mentor"}</Text>
              <Text style={styles.mentorDomain} numberOfLines={1}>
                {[mentor.primaryCategory, mentor.subCategory].filter(Boolean).join(" > ") || "General"}
              </Text>
              <Text style={styles.aboutLabel}>About</Text>
              <Text style={styles.aboutText} numberOfLines={3}>
                {mentor.bio?.trim() ||
                  mentor.expertise?.trim() ||
                  (mentor.specializations?.length ? mentor.specializations.join(", ") : "Mentor profile available.")}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#F4F9F6",
    padding: 20,
    paddingBottom: 30
  },
  heading: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1E2B24",
    marginBottom: 6
  },
  subheading: {
    color: "#475467",
    marginBottom: 16
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1E2B24",
    marginBottom: 8
  },
  card: {
    backgroundColor: "white",
    padding: 18,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E4E7EC"
  },
  text: {
    fontSize: 16,
    color: "#1E2B24",
    fontWeight: "600"
  },
  allCard: {
    marginTop: 2,
    backgroundColor: "#E8F5EE",
    borderColor: "#1F7A4C",
    borderWidth: 1,
    borderRadius: 16,
    padding: 18
  },
  allTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F5132"
  },
  allSubtext: {
    marginTop: 6,
    color: "#1E2B24"
  },
  loadingBox: { paddingVertical: 16, alignItems: "center" },
  mentorCard: {
    width: 250,
    marginRight: 10,
    marginTop: 2,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E4E7EC",
    borderRadius: 12,
    padding: 10
  },
  heroImage: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#D0D5DD"
  },
  avatarFallback: { alignItems: "center", justifyContent: "center", backgroundColor: "#E8F5EE" },
  avatarText: { color: "#0B3D2E", fontWeight: "700", fontSize: 42 },
  mentorName: { marginTop: 8, color: "#1E2B24", fontWeight: "700", fontSize: 15 },
  mentorEmail: { marginTop: 2, color: "#667085", fontSize: 12 },
  mentorDomain: { marginTop: 4, color: "#1F7A4C", fontSize: 12, fontWeight: "600" },
  aboutLabel: { marginTop: 8, color: "#1E2B24", fontWeight: "700", fontSize: 12 },
  aboutText: { marginTop: 3, color: "#667085", fontSize: 12, lineHeight: 16 }
});
