import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { api } from "@/lib/api";

type Mentor = {
  _id: string;
  name: string;
  email: string;
  domain?: string;
  role: "mentor";
  status: "approved";
};

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
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.email}>{item.email}</Text>
              <Text style={styles.domain}>{item.domain || "General"}</Text>
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
