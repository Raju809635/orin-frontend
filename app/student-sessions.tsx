import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { useFocusEffect } from "expo-router";
import { api } from "@/lib/api";

type SessionHistoryItem = {
  sessionId: string;
  mentorName: string;
  date: string;
  time: string;
  notes?: string;
};

type SessionItem = {
  _id: string;
  date: string;
  time: string;
  amount: number;
  currency?: string;
  paymentStatus?: string;
  sessionStatus?: string;
  status?: string;
  meetingLink?: string;
  mentorId?: { name?: string } | null;
};

export default function StudentSessionsScreen() {
  const [history, setHistory] = useState<SessionHistoryItem[]>([]);
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [noteModal, setNoteModal] = useState<{ open: boolean; sessionId: string; note: string }>({
    open: false,
    sessionId: "",
    note: ""
  });

  const [reviewModal, setReviewModal] = useState<{ open: boolean; sessionId: string; rating: number; review: string }>({
    open: false,
    sessionId: "",
    rating: 5,
    review: ""
  });

  const loadData = useCallback(async (refresh = false) => {
    try {
      if (refresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      const [historyRes, sessionsRes] = await Promise.allSettled([
        api.get<SessionHistoryItem[]>("/api/network/session-history"),
        api.get<SessionItem[]>("/api/sessions/my")
      ]);
      setHistory(historyRes.status === "fulfilled" ? historyRes.value.data || [] : []);
      setSessions(sessionsRes.status === "fulfilled" ? sessionsRes.value.data || [] : []);
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to load sessions.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const pendingPayments = useMemo(
    () => sessions.filter((s) => s.paymentStatus === "pending" || s.paymentStatus === "rejected"),
    [sessions]
  );
  const waitingVerification = useMemo(
    () => sessions.filter((s) => s.paymentStatus === "waiting_verification"),
    [sessions]
  );
  const confirmedSessions = useMemo(
    () => sessions.filter((s) => s.paymentStatus === "verified" || s.sessionStatus === "confirmed"),
    [sessions]
  );

  async function saveNote() {
    const note = noteModal.note.trim();
    if (!note) {
      Alert.alert("Note required", "Please type a note.");
      return;
    }
    try {
      await api.patch(`/api/network/session-history/${noteModal.sessionId}/note`, { note });
      setNoteModal({ open: false, sessionId: "", note: "" });
      loadData(true);
    } catch (e: any) {
      Alert.alert("Failed", e?.response?.data?.message || "Failed to update note.");
    }
  }

  async function submitRating() {
    try {
      await api.post(`/api/network/sessions/${reviewModal.sessionId}/review`, {
        rating: reviewModal.rating,
        review: reviewModal.review || "Great session"
      });
      setReviewModal({ open: false, sessionId: "", rating: 5, review: "" });
      loadData(true);
    } catch (e: any) {
      Alert.alert("Failed", e?.response?.data?.message || "Failed to submit rating.");
    }
  }

  return (
    <>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} />}
      >
        <Text style={styles.heading}>Session Management</Text>
        <Text style={styles.sub}>Manage history, payments, verifications, and confirmed sessions in one place.</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {loading ? (
          <View style={styles.loaderWrap}>
            <ActivityIndicator size="large" color="#1F7A4C" />
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>Session History & Notes</Text>
        {history.length === 0 ? <Text style={styles.meta}>No completed sessions yet.</Text> : null}
        {history.map((item) => (
          <View key={item.sessionId} style={styles.card}>
            <Text style={styles.cardTitle}>{item.mentorName || "Mentor"}</Text>
            <Text style={styles.meta}>{item.date} {item.time}</Text>
            <Text style={styles.meta}>Notes: {item.notes || "No notes yet."}</Text>
            <View style={styles.actionRow}>
              <TouchableOpacity style={styles.secondaryBtn} onPress={() => setNoteModal({ open: true, sessionId: item.sessionId, note: item.notes || "" })}>
                <Text style={styles.secondaryBtnText}>Add Note</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={() => setReviewModal({ open: true, sessionId: item.sessionId, rating: 5, review: "" })}
              >
                <Text style={styles.primaryBtnText}>Rate Mentor</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}

        <Text style={[styles.sectionTitle, styles.pending]}>Pending Payments</Text>
        {pendingPayments.length === 0 ? <Text style={styles.meta}>No pending manual payments.</Text> : null}
        {pendingPayments.map((item) => (
          <View key={item._id} style={styles.card}>
            <Text style={styles.cardTitle}>{item.mentorId?.name || "Mentor"}</Text>
            <Text style={styles.meta}>{item.date} {item.time} | Amount: {item.currency || "INR"} {item.amount}</Text>
            <Text style={styles.meta}>Payment: {item.paymentStatus || "pending"}</Text>
          </View>
        ))}

        <Text style={[styles.sectionTitle, styles.awaiting]}>Awaiting Verification</Text>
        {waitingVerification.length === 0 ? <Text style={styles.meta}>No sessions waiting for verification.</Text> : null}
        {waitingVerification.map((item) => (
          <View key={item._id} style={styles.card}>
            <Text style={styles.cardTitle}>{item.mentorId?.name || "Mentor"}</Text>
            <Text style={styles.meta}>{item.date} {item.time} | Amount: {item.currency || "INR"} {item.amount}</Text>
            <Text style={styles.meta}>Payment: waiting_verification</Text>
          </View>
        ))}

        <Text style={[styles.sectionTitle, styles.confirmed]}>Confirmed Sessions</Text>
        {confirmedSessions.length === 0 ? <Text style={styles.meta}>No confirmed sessions yet.</Text> : null}
        {confirmedSessions.map((item) => (
          <View key={item._id} style={[styles.card, styles.confirmedCard]}>
            <Text style={styles.cardTitle}>{item.mentorId?.name || "Mentor"}</Text>
            <Text style={styles.meta}>{item.date} {item.time} | Amount: {item.currency || "INR"} {item.amount}</Text>
            <Text style={styles.meta}>Payment: {item.paymentStatus || "verified"} | Session: {item.sessionStatus || "confirmed"}</Text>
            <TouchableOpacity
              style={[styles.primaryBtn, styles.joinBtn]}
              onPress={() => {
                if (item.meetingLink) {
                  Linking.openURL(item.meetingLink);
                } else {
                  Alert.alert("Meeting link not available", "Mentor has not added the meeting link yet.");
                }
              }}
            >
              <Text style={styles.primaryBtnText}>Join Session</Text>
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>

      <Modal visible={noteModal.open} transparent animationType="slide" onRequestClose={() => setNoteModal({ open: false, sessionId: "", note: "" })}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Add Session Note</Text>
            <TextInput
              style={styles.input}
              multiline
              value={noteModal.note}
              onChangeText={(text) => setNoteModal((prev) => ({ ...prev, note: text }))}
              placeholder="Type what you learned in this session"
            />
            <View style={styles.actionRow}>
              <TouchableOpacity style={styles.secondaryBtn} onPress={() => setNoteModal({ open: false, sessionId: "", note: "" })}>
                <Text style={styles.secondaryBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.primaryBtn} onPress={saveNote}>
                <Text style={styles.primaryBtnText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={reviewModal.open} transparent animationType="slide" onRequestClose={() => setReviewModal({ open: false, sessionId: "", rating: 5, review: "" })}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Rate Mentor</Text>
            <View style={styles.ratingRow}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity key={star} onPress={() => setReviewModal((prev) => ({ ...prev, rating: star }))}>
                  <Text style={[styles.star, reviewModal.rating >= star && styles.starActive]}>?</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              style={styles.input}
              multiline
              value={reviewModal.review}
              onChangeText={(text) => setReviewModal((prev) => ({ ...prev, review: text }))}
              placeholder="Write quick feedback"
            />
            <View style={styles.actionRow}>
              <TouchableOpacity style={styles.secondaryBtn} onPress={() => setReviewModal({ open: false, sessionId: "", rating: 5, review: "" })}>
                <Text style={styles.secondaryBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.primaryBtn} onPress={submitRating}>
                <Text style={styles.primaryBtnText}>Submit</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: "#F3F6FB", gap: 10, paddingBottom: 96 },
  heading: { fontSize: 28, fontWeight: "800", color: "#11261E" },
  sub: { color: "#667085" },
  error: { color: "#B42318" },
  loaderWrap: { minHeight: 120, alignItems: "center", justifyContent: "center" },
  sectionTitle: { marginTop: 2, fontSize: 20, fontWeight: "800", color: "#1E2B24" },
  pending: { color: "#B54708" },
  awaiting: { color: "#175CD3" },
  confirmed: { color: "#027A48" },
  card: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#D1E4D9", borderRadius: 14, padding: 12, gap: 6 },
  confirmedCard: { backgroundColor: "#EAF6EF", borderColor: "#B7E5CC" },
  cardTitle: { fontWeight: "800", color: "#1E2B24", fontSize: 18 },
  meta: { color: "#667085", fontSize: 14, fontWeight: "600" },
  actionRow: { flexDirection: "row", gap: 10, marginTop: 4 },
  primaryBtn: { backgroundColor: "#1F7A4C", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  primaryBtnText: { color: "#fff", fontWeight: "800" },
  secondaryBtn: { borderWidth: 1, borderColor: "#1F7A4C", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: "#fff" },
  secondaryBtnText: { color: "#1F7A4C", fontWeight: "800" },
  joinBtn: { alignSelf: "stretch", alignItems: "center", marginTop: 4 },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(15,23,42,0.45)", justifyContent: "flex-end" },
  modalCard: { backgroundColor: "#fff", borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 16, gap: 10 },
  modalTitle: { fontSize: 20, fontWeight: "800", color: "#1E2B24" },
  input: {
    borderWidth: 1,
    borderColor: "#D0D5DD",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 90,
    textAlignVertical: "top",
    color: "#344054",
    backgroundColor: "#fff"
  },
  ratingRow: { flexDirection: "row", gap: 6 },
  star: { fontSize: 28, color: "#D0D5DD" },
  starActive: { color: "#F79009" }
});
