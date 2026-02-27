import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { api } from "@/lib/api";

type Mentor = {
  _id: string;
  name: string;
  email: string;
  domain?: string;
  profilePhotoUrl?: string;
  title?: string;
  verifiedBadge?: boolean;
  role: "mentor";
  status: "approved";
};

function avatarInitial(name: string) {
  return name?.trim()?.charAt(0)?.toUpperCase() || "M";
}

export default function MentorsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ domain?: string }>();
  const domain = useMemo(() => (params.domain || "").trim(), [params.domain]);

  const [mentors, setMentors] = useState<Mentor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function fetchMentors() {
      if (!domain) {
        setErrorMessage("Domain not provided.");
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setErrorMessage(null);
        const response = await api.get<Mentor[]>(`/api/mentors/by-domain/${encodeURIComponent(domain)}`);
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
  }, [domain]);

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>{domain || "Mentors"}</Text>

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
              <View style={styles.row}>
                {item.profilePhotoUrl ? (
                  <Image source={{ uri: item.profilePhotoUrl }} style={styles.avatar} />
                ) : (
                  <View style={styles.avatarFallback}>
                    <Text style={styles.avatarInitial}>{avatarInitial(item.name)}</Text>
                  </View>
                )}
                <View style={styles.info}>
                  <Text style={styles.name}>
                    {item.name} {item.verifiedBadge ? "• Verified" : ""}
                  </Text>
                  <Text style={styles.email}>{item.email}</Text>
                  <Text style={styles.domain}>{item.title || item.domain || "General Mentor"}</Text>
                </View>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.centered}>
              <Text style={styles.statusText}>No approved mentors found for this domain.</Text>
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
    marginBottom: 16
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
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#EAECF0"
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  info: {
    flex: 1
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: "#D0D5DD"
  },
  avatarFallback: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#E6F4ED",
    alignItems: "center",
    justifyContent: "center"
  },
  avatarInitial: {
    color: "#0B3D2E",
    fontWeight: "700",
    fontSize: 18
  },
  name: {
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
  }
});
