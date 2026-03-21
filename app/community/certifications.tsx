import React, { useCallback, useState } from "react";
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

type TrackItem = { id: string; title: string; level?: string; domain?: string; description?: string; requirements?: string[] };
type EarnedCert = { id: string; title: string; level?: string; domain?: string; issuedAt?: string | null; source?: string };
type MyRequest = { id: string; status: string; note?: string; track?: { id?: string; title?: string; level?: string; domain?: string } };

export default function CommunityCertificationsPage() {
  const { user } = useAuth();
  const [tracks, setTracks] = useState<TrackItem[]>([]);
  const [earned, setEarned] = useState<EarnedCert[]>([]);
  const [requests, setRequests] = useState<MyRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requestNoteById, setRequestNoteById] = useState<Record<string, string>>({});
  const [submittingId, setSubmittingId] = useState<string>("");

  const load = useCallback(async (refresh = false) => {
    try {
      if (refresh) setRefreshing(true); else setLoading(true);
      setError(null);
      const [tracksRes, earnedRes, reqRes] = await Promise.allSettled([
        api.get<TrackItem[]>("/api/network/certification-tracks"),
        api.get<EarnedCert[]>("/api/network/certifications"),
        api.get<MyRequest[]>("/api/network/certification-requests/me")
      ]);

      setTracks(tracksRes.status === "fulfilled" ? tracksRes.value.data || [] : []);
      setEarned(earnedRes.status === "fulfilled" ? earnedRes.value.data || [] : []);
      setRequests(reqRes.status === "fulfilled" ? reqRes.value.data || [] : []);
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to load certifications.");
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <ScrollView contentContainerStyle={styles.page} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}>
      <Text style={styles.pageTitle}>Certifications</Text>
      <Text style={styles.pageSub}>Track available certifications, requirements, and earned badges.</Text>

      <View style={styles.section}><View style={styles.sectionHeader}><Ionicons name="ribbon" size={16} color="#1F7A4C" /><Text style={styles.sectionTitle}>Overview</Text></View><Text style={styles.meta}>Certifications validate your progress and improve profile credibility.</Text></View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}><Ionicons name="list" size={16} color="#1F7A4C" /><Text style={styles.sectionTitle}>Available Certifications</Text></View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {loading ? <ActivityIndicator size="large" color="#1F7A4C" /> : null}
        {!loading && tracks.length === 0 ? <Text style={styles.meta}>No certification tracks published yet.</Text> : null}
        {tracks.map((item) => (
          <View key={item.id} style={styles.card}>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.meta}>
              Level: {item.level || "Beginner"}{item.domain ? ` | Domain: ${item.domain}` : ""}
            </Text>
            {item.description ? <Text style={styles.meta}>{item.description}</Text> : null}
            <Text style={styles.meta}>
              Requirements: {(item.requirements || []).length ? (item.requirements || []).slice(0, 3).join(", ") : "Complete related challenges and sessions."}
            </Text>
            {user?.role === "student" ? (
              <>
                <TextInput
                  style={styles.input}
                  placeholder="Note to admin (optional)"
                  value={requestNoteById[item.id] || ""}
                  onChangeText={(t) => setRequestNoteById((p) => ({ ...p, [item.id]: t }))}
                />
                <TouchableOpacity
                  style={[styles.primaryBtn, submittingId === item.id && styles.primaryBtnDisabled]}
                  disabled={submittingId === item.id}
                  onPress={async () => {
                    try {
                      setSubmittingId(item.id);
                      await api.post(`/api/network/certification-tracks/${item.id}/request`, {
                        note: (requestNoteById[item.id] || "").trim()
                      });
                      Alert.alert("Requested", "Sent to admin for verification.");
                      await load(true);
                    } catch (e: any) {
                      Alert.alert("Failed", e?.response?.data?.message || "Unable to request certification.");
                    } finally {
                      setSubmittingId("");
                    }
                  }}
                >
                  <Text style={styles.primaryBtnText}>{submittingId === item.id ? "Submitting..." : "Request Verification"}</Text>
                </TouchableOpacity>
              </>
            ) : null}
          </View>
        ))}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}><Ionicons name="time" size={16} color="#1F7A4C" /><Text style={styles.sectionTitle}>My Requests</Text></View>
        {!loading && requests.length === 0 ? <Text style={styles.meta}>No certification requests yet.</Text> : null}
        {requests.map((r) => (
          <View key={r.id} style={styles.cardAlt}>
            <Text style={styles.cardTitle}>{r.track?.title || "Certification"}</Text>
            <Text style={styles.meta}>Status: {r.status}</Text>
            {r.note ? <Text style={styles.meta}>Note: {r.note}</Text> : null}
          </View>
        ))}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}><Ionicons name="medal" size={16} color="#1F7A4C" /><Text style={styles.sectionTitle}>Earned Badges</Text></View>
        {!loading && earned.length === 0 ? <Text style={styles.meta}>No certifications earned yet.</Text> : null}
        {earned.map((item) => (
          <View key={item.id} style={styles.cardAlt}>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.meta}>
              Level: {item.level || "Beginner"}{item.domain ? ` | Domain: ${item.domain}` : ""}
            </Text>
            <Text style={styles.meta}>Source: {item.source || "ORIN"}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, backgroundColor: "#F3F6FB", gap: 10 },
  pageTitle: { fontSize: 26, fontWeight: "800", color: "#11261E" },
  pageSub: { color: "#667085" },
  section: { backgroundColor: "#FFFFFF", borderRadius: 14, borderWidth: 1, borderColor: "#E4E7EC", padding: 12, gap: 8 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  sectionTitle: { fontWeight: "800", color: "#1E2B24" },
  card: { backgroundColor: "#EEF4FF", borderColor: "#C7D7FE", borderWidth: 1, borderRadius: 12, padding: 10, gap: 6 },
  cardAlt: { backgroundColor: "#ECFDF3", borderColor: "#B7E5CC", borderWidth: 1, borderRadius: 12, padding: 10, gap: 4 },
  cardTitle: { fontWeight: "800", color: "#1E2B24" },
  meta: { color: "#667085" },
  error: { color: "#B42318" },
  primaryBtn: { alignSelf: "flex-start", backgroundColor: "#1F7A4C", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9 },
  primaryBtnDisabled: { opacity: 0.7 },
  primaryBtnText: { color: "#fff", fontWeight: "700" },
  input: { borderWidth: 1, borderColor: "#D0D5DD", borderRadius: 12, backgroundColor: "#fff", paddingHorizontal: 10, paddingVertical: 9 }
});
