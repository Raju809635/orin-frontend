import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { api } from "@/lib/api";
import { CATEGORY_OPTIONS } from "@/constants/categories";

type Mentor = {
  _id: string;
  name: string;
  email: string;
  bio?: string;
  expertise?: string;
  primaryCategory?: string;
  subCategory?: string;
  specializations?: string[];
  sessionPrice?: number;
  rating?: number;
  role: "mentor";
  status: "approved";
  profilePhotoUrl?: string;
};

export default function MentorsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ domain?: string }>();
  const requestedDomain = useMemo(() => (params.domain || "").trim(), [params.domain]);
  const [activeDomain, setActiveDomain] = useState<string>(requestedDomain || "All");

  const [mentors, setMentors] = useState<Mentor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (requestedDomain) {
      setActiveDomain(requestedDomain);
    }
  }, [requestedDomain]);

  useEffect(() => {
    let isMounted = true;

    async function fetchMentors() {
      try {
        setIsLoading(true);
        setErrorMessage(null);
        const endpoint =
          activeDomain === "All"
            ? "/api/mentors"
            : `/api/mentors/filter?primary=${encodeURIComponent(activeDomain)}`;

        const response = await api.get<Mentor[]>(endpoint);
        if (isMounted) {
          setMentors(response.data);
        }
      } catch (e: any) {
        if (isMounted) {
          setErrorMessage(e?.response?.data?.message || "Unable to load mentors.");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    fetchMentors();

    return () => {
      isMounted = false;
    };
  }, [activeDomain]);

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Find Mentors</Text>
      <Text style={styles.subHeading}>Drag to scroll categories, then tap a chip to filter mentors.</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroller}>
        <TouchableOpacity
          style={[styles.chip, activeDomain === "All" && styles.chipActive]}
          onPress={() => setActiveDomain("All")}
        >
          <Text style={[styles.chipText, activeDomain === "All" && styles.chipTextActive]}>All</Text>
        </TouchableOpacity>

        {CATEGORY_OPTIONS.map((domain) => {
          const isActive = activeDomain === domain;
          return (
            <TouchableOpacity
              key={domain}
              style={[styles.chip, isActive && styles.chipActive]}
              onPress={() => setActiveDomain(domain)}
            >
              <Text style={[styles.chipText, isActive && styles.chipTextActive]}>{domain}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <Text style={styles.activeLabel}>Showing: {activeDomain}</Text>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#1F7A4C" />
          <Text style={styles.statusText}>Loading mentors...</Text>
        </View>
      ) : null}

      {!isLoading && errorMessage ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      ) : null}

      {!isLoading && !errorMessage ? (
        <FlatList
          data={mentors}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => router.push(`/mentor/${item._id}` as never)}
            >
              {item.profilePhotoUrl ? (
                <Image source={{ uri: item.profilePhotoUrl }} style={styles.heroImage} />
              ) : (
                <View style={[styles.heroImage, styles.avatarFallback]}>
                  <Text style={styles.avatarText}>{item.name?.charAt(0)?.toUpperCase() || "M"}</Text>
                </View>
              )}
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.email}>{item.email}</Text>
              <Text style={styles.domain}>
                {[item.primaryCategory, item.subCategory].filter(Boolean).join(" > ") || "General"}
              </Text>
              <Text style={styles.aboutLabel}>About</Text>
              <Text style={styles.aboutText}>
                {item.bio?.trim() ||
                  item.expertise?.trim() ||
                  (item.specializations?.length ? item.specializations.join(", ") : "Mentor profile available.")}
              </Text>
              {!!item.specializations?.length ? (
                <Text style={styles.specs}>{item.specializations.join(", ")}</Text>
              ) : null}
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.centered}>
              <Text style={styles.statusText}>No approved mentors found.</Text>
            </View>
          }
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F4F9F6",
    padding: 20
  },
  heading: {
    fontSize: 22,
    fontWeight: "700",
    color: "#1E2B24",
    marginBottom: 4
  },
  subHeading: {
    color: "#475467",
    marginBottom: 10
  },
  chipScroller: {
    marginBottom: 8,
    maxHeight: 44
  },
  chip: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D0D5DD",
    borderRadius: 999,
    paddingVertical: 9,
    paddingHorizontal: 14,
    marginRight: 8
  },
  chipActive: {
    borderColor: "#1F7A4C",
    backgroundColor: "#E8F5EE"
  },
  chipText: {
    color: "#344054",
    fontWeight: "600",
    fontSize: 13
  },
  chipTextActive: {
    color: "#1F7A4C"
  },
  activeLabel: {
    color: "#1F7A4C",
    fontWeight: "600",
    marginBottom: 12
  },
  centered: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 28
  },
  statusText: {
    marginTop: 10,
    color: "#1E2B24",
    fontSize: 15
  },
  errorText: {
    color: "#B42318",
    fontSize: 15,
    textAlign: "center"
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#EAECF0"
  },
  heroImage: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#D0D5DD",
    backgroundColor: "#F4F6F8"
  },
  avatarFallback: { alignItems: "center", justifyContent: "center", backgroundColor: "#E8F5EE" },
  avatarText: { color: "#0B3D2E", fontWeight: "700", fontSize: 42 },
  name: {
    marginTop: 10,
    fontSize: 16,
    fontWeight: "700",
    color: "#1E2B24"
  },
  email: {
    marginTop: 4,
    fontSize: 14,
    color: "#475467"
  },
  domain: {
    marginTop: 8,
    color: "#1F7A4C",
    fontWeight: "600"
  },
  aboutLabel: {
    marginTop: 10,
    color: "#1E2B24",
    fontWeight: "700"
  },
  aboutText: {
    marginTop: 4,
    color: "#475467",
    lineHeight: 19
  },
  specs: {
    marginTop: 6,
    color: "#667085",
    fontSize: 12
  }
});
