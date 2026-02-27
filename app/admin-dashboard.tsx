import React, { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { notify } from "@/utils/notify";

type PendingMentor = {
  _id: string;
  name: string;
  email: string;
  primaryCategory?: string;
  approvalStatus: "pending" | "approved" | "rejected";
};

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const [pendingMentors, setPendingMentors] = useState<PendingMentor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPendingMentors = useCallback(async (refresh = false) => {
    try {
      if (refresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);
      const { data } = await api.get<PendingMentor[]>("/api/admin/pending-mentors");
      setPendingMentors(data);
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to load pending mentors.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchPendingMentors();
    }, [fetchPendingMentors])
  );

  async function approveMentor(mentorId: string) {
    try {
      await api.put(`/api/admin/approve/${mentorId}`);
      notify("Mentor approved.");
      await fetchPendingMentors(true);
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to approve mentor.");
    }
  }

  if (!user?.isAdmin) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>Access denied for current role.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Admin Dashboard</Text>
      <Text style={styles.subheading}>Review and approve mentor applications.</Text>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#1F7A4C" />
        </View>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {!isLoading ? (
        <FlatList
          data={pendingMentors}
          keyExtractor={(item) => item._id}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => fetchPendingMentors(true)} />}
          ListEmptyComponent={<Text style={styles.empty}>No pending mentor approvals.</Text>}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.title}>{item.name}</Text>
              <Text style={styles.meta}>{item.email}</Text>
              <Text style={styles.meta}>Primary Category: {item.primaryCategory || "Not set"}</Text>
              <TouchableOpacity style={styles.approveButton} onPress={() => approveMentor(item._id)}>
                <Text style={styles.approveText}>Approve</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      ) : null}

      <TouchableOpacity style={styles.logout} onPress={logout}>
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F4F9F6", padding: 20 },
  heading: { fontSize: 24, fontWeight: "700", color: "#1E2B24" },
  subheading: { marginTop: 4, marginBottom: 12, color: "#475467" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  card: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#EAECF0",
    borderRadius: 12,
    padding: 14,
    marginBottom: 10
  },
  title: { fontWeight: "700", color: "#1E2B24", fontSize: 16 },
  meta: { color: "#667085", marginTop: 4 },
  approveButton: {
    marginTop: 10,
    backgroundColor: "#1F7A4C",
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center"
  },
  approveText: { color: "#fff", fontWeight: "700" },
  error: { color: "#B42318", marginBottom: 8 },
  empty: { color: "#667085", textAlign: "center", marginTop: 14 },
  logout: { marginTop: 8, padding: 12, alignItems: "center" },
  logoutText: { color: "#7A271A", fontWeight: "600" }
});
