import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

type ChallengeItem = { id: string; title: string; domain?: string; description?: string; participantsCount?: number; deadline: string; isActive?: boolean };
type LeaderboardResponse = { globalTop?: Array<{ rank: number; name: string; score: number }> };

export default function CommunityChallengesPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<ChallengeItem[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitForm, setSubmitForm] = useState({
    title: "",
    domain: "",
    description: "",
    // Keep it simple without native pickers: ISO-like input is easy to validate on backend.
    deadline: ""
  });

  const load = useCallback(async (refresh = false) => {
    try {
      if (refresh) setRefreshing(true); else setLoading(true);
      setError(null);
      const [chRes, lbRes] = await Promise.allSettled([
        api.get<ChallengeItem[]>("/api/network/challenges"),
        api.get<LeaderboardResponse>("/api/network/leaderboard")
      ]);
      setItems(chRes.status === "fulfilled" ? chRes.value.data || [] : []);
      setLeaderboard(lbRes.status === "fulfilled" ? lbRes.value.data || null : null);
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to load challenges.");
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const active = useMemo(() => items[0], [items]);
  const [joining, setJoining] = useState(false);

  const canJoin =
    user?.role === "student" &&
    Boolean(active?.id) &&
    /^[a-fA-F0-9]{24}$/.test(String(active?.id || ""));

  async function participate() {
    if (!canJoin) return;
    try {
      setJoining(true);
      await api.post(`/api/network/challenges/${active.id}/join`, {});
      Alert.alert("Joined", "You have joined the challenge. Your progress will reflect in reputation and leaderboard.");
      await load(true);
    } catch (e: any) {
      Alert.alert("Failed", e?.response?.data?.message || "Unable to join challenge.");
    } finally {
      setJoining(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.page} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}>
      <Text style={styles.pageTitle}>Challenges</Text>
      <Text style={styles.pageSub}>Compete in active challenges and improve your reputation score.</Text>

      <View style={styles.section}><View style={styles.sectionHeader}><Ionicons name="trophy" size={16} color="#1F7A4C" /><Text style={styles.sectionTitle}>Active Challenge Banner</Text></View>{active ? <View style={styles.banner}><Text style={styles.bannerTitle}>{active.title}</Text><Text style={styles.meta}>{active.domain || "General"} | Deadline: {new Date(active.deadline).toLocaleDateString()}</Text></View> : <Text style={styles.meta}>No active challenge.</Text>}</View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}><Ionicons name="flag" size={16} color="#1F7A4C" /><Text style={styles.sectionTitle}>Challenge Details</Text></View>
        {items.map((item) => (
          <View key={item.id} style={[styles.card, item.isActive === false && styles.cardPending]}>
            <Text style={styles.cardTitle}>
              {item.title} {item.isActive === false ? <Text style={styles.badgePending}> (Pending)</Text> : null}
            </Text>
            <Text style={styles.meta}>Participants: {item.participantsCount || 0}</Text>
            {item.description ? <Text style={styles.meta}>{item.description}</Text> : null}
          </View>
        ))}

        {user?.role === "student" ? (
          <>
            {!canJoin && active?.id ? <Text style={styles.meta}>This challenge is not yet available for participation.</Text> : null}
            <TouchableOpacity style={[styles.primaryBtn, (joining || !canJoin) && styles.primaryBtnDisabled]} onPress={participate} disabled={joining || !canJoin}>
              <Text style={styles.primaryBtnText}>{joining ? "Joining..." : "Participate"}</Text>
            </TouchableOpacity>
          </>
        ) : (
          <Text style={styles.meta}>Students can participate. Mentors can propose challenges for admin review below.</Text>
        )}
      </View>

      {user?.role === "mentor" ? (
        <View style={styles.section}>
          <View style={styles.sectionHeader}><Ionicons name="add-circle" size={16} color="#1F7A4C" /><Text style={styles.sectionTitle}>Propose A Challenge (Mentors)</Text></View>
          <Text style={styles.meta}>Your challenge will be published after admin approval.</Text>
          <TextInput style={styles.input} placeholder="Challenge title" value={submitForm.title} onChangeText={(t) => setSubmitForm((p) => ({ ...p, title: t }))} />
          <TextInput style={styles.input} placeholder="Domain (optional)" value={submitForm.domain} onChangeText={(t) => setSubmitForm((p) => ({ ...p, domain: t }))} />
          <TextInput style={[styles.input, styles.textArea]} placeholder="Description" value={submitForm.description} onChangeText={(t) => setSubmitForm((p) => ({ ...p, description: t }))} multiline />
          <TextInput
            style={styles.input}
            placeholder="Deadline (YYYY-MM-DD HH:mm)"
            value={submitForm.deadline}
            onChangeText={(t) => setSubmitForm((p) => ({ ...p, deadline: t }))}
          />
          <TouchableOpacity
            style={[styles.primaryBtn, submitting && styles.primaryBtnDisabled]}
            disabled={submitting}
            onPress={async () => {
              try {
                if (!submitForm.title.trim()) {
                  Alert.alert("Title required", "Please enter a challenge title.");
                  return;
                }
                if (!submitForm.deadline.trim()) {
                  Alert.alert("Deadline required", "Please enter a deadline like 2026-03-25 18:30");
                  return;
                }

                // Backend validates date; we just send a parse-friendly string.
                setSubmitting(true);
                await api.post("/api/network/challenges/submit", {
                  title: submitForm.title.trim(),
                  domain: submitForm.domain.trim(),
                  description: submitForm.description.trim(),
                  deadline: submitForm.deadline.trim().replace(" ", "T")
                });
                Alert.alert("Submitted", "Sent to admin for review.");
                setSubmitForm({ title: "", domain: "", description: "", deadline: "" });
                await load(true);
              } catch (e: any) {
                Alert.alert("Failed", e?.response?.data?.message || "Unable to submit challenge.");
              } finally {
                setSubmitting(false);
              }
            }}
          >
            <Text style={styles.primaryBtnText}>{submitting ? "Submitting..." : "Submit For Review"}</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <View style={styles.section}><View style={styles.sectionHeader}><Ionicons name="podium" size={16} color="#1F7A4C" /><Text style={styles.sectionTitle}>Leaderboard</Text></View>{error ? <Text style={styles.error}>{error}</Text> : null}{loading ? <ActivityIndicator size="large" color="#1F7A4C" /> : null}{(leaderboard?.globalTop || []).slice(0,5).map((u) => <Text key={`${u.rank}-${u.name}`} style={styles.meta}>{u.rank}. {u.name} - {u.score}</Text>)}</View>

      <View style={styles.section}><View style={styles.sectionHeader}><Ionicons name="star" size={16} color="#1F7A4C" /><Text style={styles.sectionTitle}>Previous Winners</Text></View><Text style={styles.meta}>Winners are featured on leaderboard snapshots and receive bonus XP.</Text></View>
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
  banner: { backgroundColor: "#FFF7ED", borderColor: "#F9DBAF", borderWidth: 1, borderRadius: 12, padding: 10, gap: 4 },
  bannerTitle: { fontWeight: "800", color: "#B54708" },
  card: { backgroundColor: "#FFF7ED", borderColor: "#F9DBAF", borderWidth: 1, borderRadius: 12, padding: 10, gap: 4 },
  cardPending: { backgroundColor: "#F2F4F7", borderColor: "#D0D5DD" },
  cardTitle: { fontWeight: "800", color: "#1E2B24" },
  badgePending: { color: "#667085", fontWeight: "800" },
  meta: { color: "#667085" },
  error: { color: "#B42318" },
  input: { borderWidth: 1, borderColor: "#D0D5DD", borderRadius: 12, backgroundColor: "#fff", paddingHorizontal: 10, paddingVertical: 9 },
  textArea: { minHeight: 80, textAlignVertical: "top" },
  primaryBtn: { alignSelf: "flex-start", backgroundColor: "#1F7A4C", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9 },
  primaryBtnDisabled: { opacity: 0.7 },
  primaryBtnText: { color: "#fff", fontWeight: "700" }
});
