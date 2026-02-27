import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { notify } from "@/utils/notify";

type MentorSession = {
  _id: string;
  date: string;
  time: string;
  durationMinutes: number;
  scheduledStart: string;
  status: "pending" | "approved" | "completed" | "cancelled" | "rejected";
  studentId?: {
    _id: string;
    name: string;
    email: string;
  };
};

type AvailabilitySlot = {
  _id: string;
  day: string;
  startTime: string;
  endTime: string;
  sessionDurationMinutes: number;
};

type BlockedDate = {
  _id: string;
  blockedDate: string;
};

const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function MentorDashboard() {
  const router = useRouter();
  const { user, logout } = useAuth();

  const [sessions, setSessions] = useState<MentorSession[]>([]);
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [newSlot, setNewSlot] = useState({
    day: "Mon",
    startTime: "18:00",
    endTime: "19:00",
    sessionDurationMinutes: "60"
  });
  const [blockDate, setBlockDate] = useState("");
  const [rescheduleBySession, setRescheduleBySession] = useState<Record<string, { date: string; time: string; durationMinutes: string }>>({});

  const fetchData = useCallback(
    async (refresh = false) => {
      if (!user?.id) return;
      try {
        if (refresh) setIsRefreshing(true);
        else setIsLoading(true);
        setError(null);

        const [sessionRes, availabilityRes] = await Promise.all([
          api.get<MentorSession[]>("/api/sessions/mentor/me"),
          api.get<{ weeklySlots: AvailabilitySlot[]; blockedDates: BlockedDate[] }>(`/api/availability/mentor/${user.id}`)
        ]);

        setSessions(sessionRes.data);
        setSlots(availabilityRes.data.weeklySlots || []);
        setBlockedDates(availabilityRes.data.blockedDates || []);
      } catch (e: any) {
        setError(e?.response?.data?.message || "Failed to load mentor dashboard.");
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [user?.id]
  );

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  async function updateSessionStatus(sessionId: string, status: "approve" | "reject" | "cancel") {
    try {
      if (status === "approve") await api.patch(`/api/sessions/${sessionId}/approve`);
      if (status === "reject") await api.patch(`/api/sessions/${sessionId}/reject`);
      if (status === "cancel") await api.patch(`/api/sessions/${sessionId}/cancel`);
      notify(`Session ${status}d.`);
      await fetchData(true);
    } catch (e: any) {
      setError(e?.response?.data?.message || "Session update failed.");
    }
  }

  async function rescheduleSession(sessionId: string) {
    const payload = rescheduleBySession[sessionId];
    if (!payload?.date || !payload?.time) {
      setError("Enter both date and time to reschedule.");
      return;
    }
    try {
      await api.patch(`/api/sessions/${sessionId}/reschedule`, {
        date: payload.date,
        time: payload.time,
        durationMinutes: Number(payload.durationMinutes || 60)
      });
      notify("Session rescheduled.");
      await fetchData(true);
    } catch (e: any) {
      setError(e?.response?.data?.message || "Reschedule failed.");
    }
  }

  async function addAvailability() {
    try {
      await api.post("/api/availability", {
        day: newSlot.day,
        startTime: newSlot.startTime,
        endTime: newSlot.endTime,
        sessionDurationMinutes: Number(newSlot.sessionDurationMinutes || 60)
      });
      notify("Availability added.");
      await fetchData(true);
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to add availability.");
    }
  }

  async function updateAvailability(slot: AvailabilitySlot) {
    try {
      await api.patch(`/api/availability/${slot._id}`, {
        day: slot.day,
        startTime: slot.startTime,
        endTime: slot.endTime,
        sessionDurationMinutes: slot.sessionDurationMinutes
      });
      notify("Availability updated.");
      await fetchData(true);
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to update availability.");
    }
  }

  async function addBlockedDate() {
    if (!blockDate) {
      setError("Enter a blocked date in YYYY-MM-DD format.");
      return;
    }
    try {
      await api.post("/api/availability/block-date", { blockedDate: blockDate });
      notify("Blocked date added.");
      setBlockDate("");
      await fetchData(true);
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to block date.");
    }
  }

  if (user?.role !== "mentor") {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>Access denied for current role.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => fetchData(true)} />}
    >
      <Text style={styles.heading}>Mentor Dashboard</Text>
      <Text style={styles.subheading}>Update session dates, timings and your availability.</Text>

      {user.approvalStatus !== "approved" ? (
        <View style={styles.pendingBanner}>
          <Text style={styles.pendingText}>
            Waiting for admin approval. You can set availability now. Public mentor visibility starts after approval.
          </Text>
        </View>
      ) : null}

      <TouchableOpacity style={styles.secondaryCta} onPress={() => router.push("/mentor-profile" as never)}>
        <Text style={styles.secondaryCtaText}>Edit Mentor Profile</Text>
      </TouchableOpacity>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#1F7A4C" />
        </View>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Set Weekly Availability</Text>
        <View style={styles.row}>
          {days.map((d) => (
            <TouchableOpacity
              key={d}
              style={[styles.dayChip, newSlot.day === d && styles.dayChipActive]}
              onPress={() => setNewSlot((prev) => ({ ...prev, day: d }))}
            >
              <Text style={[styles.dayChipText, newSlot.day === d && styles.dayChipTextActive]}>{d}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TextInput style={styles.input} placeholder="Start Time (HH:mm)" value={newSlot.startTime} onChangeText={(v) => setNewSlot((p) => ({ ...p, startTime: v }))} />
        <TextInput style={styles.input} placeholder="End Time (HH:mm)" value={newSlot.endTime} onChangeText={(v) => setNewSlot((p) => ({ ...p, endTime: v }))} />
        <TextInput
          style={styles.input}
          placeholder="Session duration (minutes)"
          keyboardType="numeric"
          value={newSlot.sessionDurationMinutes}
          onChangeText={(v) => setNewSlot((p) => ({ ...p, sessionDurationMinutes: v }))}
        />
        <TouchableOpacity style={styles.primaryButton} onPress={addAvailability}>
          <Text style={styles.primaryButtonText}>Add Availability Slot</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Your Availability Slots</Text>
        {slots.length === 0 ? <Text style={styles.empty}>No slots added yet.</Text> : null}
        {slots.map((slot) => (
          <View key={slot._id} style={styles.slotCard}>
            <Text style={styles.slotTitle}>{slot.day}</Text>
            <TextInput
              style={styles.input}
              value={slot.startTime}
              onChangeText={(v) => setSlots((prev) => prev.map((s) => (s._id === slot._id ? { ...s, startTime: v } : s)))}
            />
            <TextInput
              style={styles.input}
              value={slot.endTime}
              onChangeText={(v) => setSlots((prev) => prev.map((s) => (s._id === slot._id ? { ...s, endTime: v } : s)))}
            />
            <TouchableOpacity style={styles.secondaryButton} onPress={() => updateAvailability(slot)}>
              <Text style={styles.secondaryButtonText}>Update Slot Timing</Text>
            </TouchableOpacity>
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Block Unavailable Dates</Text>
        <TextInput style={styles.input} placeholder="YYYY-MM-DD" value={blockDate} onChangeText={setBlockDate} />
        <TouchableOpacity style={styles.primaryButton} onPress={addBlockedDate}>
          <Text style={styles.primaryButtonText}>Block Date</Text>
        </TouchableOpacity>
        {blockedDates.map((entry) => (
          <Text key={entry._id} style={styles.meta}>
            {entry.blockedDate}
          </Text>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Session Requests & Schedule</Text>
        {sessions.length === 0 ? <Text style={styles.empty}>No sessions yet.</Text> : null}
        {sessions.map((item) => (
          <View key={item._id} style={styles.sessionCard}>
            <Text style={styles.title}>{item.studentId?.name || "Student"}</Text>
            <Text style={styles.meta}>{item.studentId?.email}</Text>
            <Text style={styles.meta}>
              {item.date} {item.time} ({item.durationMinutes} min)
            </Text>
            <Text style={styles.status}>Status: {item.status}</Text>

            {item.status === "pending" ? (
              <View style={styles.actions}>
                <TouchableOpacity style={[styles.actionButton, styles.approveButton]} onPress={() => updateSessionStatus(item._id, "approve")}>
                  <Text style={styles.actionText}>Approve</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionButton, styles.rejectButton]} onPress={() => updateSessionStatus(item._id, "reject")}>
                  <Text style={styles.actionText}>Reject</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {(item.status === "pending" || item.status === "approved") ? (
              <View style={styles.rescheduleBlock}>
                <TextInput
                  style={styles.input}
                  placeholder="New date (YYYY-MM-DD)"
                  value={rescheduleBySession[item._id]?.date || ""}
                  onChangeText={(v) =>
                    setRescheduleBySession((prev) => ({
                      ...prev,
                      [item._id]: { ...prev[item._id], date: v, time: prev[item._id]?.time || "", durationMinutes: prev[item._id]?.durationMinutes || String(item.durationMinutes || 60) }
                    }))
                  }
                />
                <TextInput
                  style={styles.input}
                  placeholder="New time (HH:mm)"
                  value={rescheduleBySession[item._id]?.time || ""}
                  onChangeText={(v) =>
                    setRescheduleBySession((prev) => ({
                      ...prev,
                      [item._id]: { ...prev[item._id], time: v, date: prev[item._id]?.date || "", durationMinutes: prev[item._id]?.durationMinutes || String(item.durationMinutes || 60) }
                    }))
                  }
                />
                <TouchableOpacity style={styles.secondaryButton} onPress={() => rescheduleSession(item._id)}>
                  <Text style={styles.secondaryButtonText}>Reschedule Session</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.ghostDanger} onPress={() => updateSessionStatus(item._id, "cancel")}>
                  <Text style={styles.ghostDangerText}>Cancel Session</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        ))}
      </View>

      <TouchableOpacity style={styles.logout} onPress={logout}>
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F4F9F6", padding: 20 },
  heading: { fontSize: 24, fontWeight: "700", color: "#1E2B24" },
  subheading: { marginTop: 4, marginBottom: 12, color: "#475467" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  card: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#EAECF0", borderRadius: 12, padding: 14, marginBottom: 12 },
  cardTitle: { fontSize: 17, fontWeight: "700", color: "#1E2B24", marginBottom: 10 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
  dayChip: { borderWidth: 1, borderColor: "#D0D5DD", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: "#fff" },
  dayChipActive: { borderColor: "#1F7A4C", backgroundColor: "#E8F5EE" },
  dayChipText: { color: "#344054", fontWeight: "600" },
  dayChipTextActive: { color: "#1F7A4C" },
  input: { borderWidth: 1, borderColor: "#D0D5DD", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 8, backgroundColor: "#fff" },
  primaryButton: { backgroundColor: "#1F7A4C", borderRadius: 10, alignItems: "center", paddingVertical: 10 },
  primaryButtonText: { color: "#fff", fontWeight: "700" },
  secondaryButton: { borderWidth: 1.5, borderColor: "#1F7A4C", borderRadius: 10, alignItems: "center", paddingVertical: 10, marginTop: 4 },
  secondaryButtonText: { color: "#1F7A4C", fontWeight: "700" },
  pendingBanner: { backgroundColor: "#FFF4E5", borderWidth: 1, borderColor: "#F8D6A3", borderRadius: 12, padding: 12, marginBottom: 12 },
  pendingText: { color: "#8A4B00", fontWeight: "600", lineHeight: 20 },
  secondaryCta: { borderColor: "#1F7A4C", borderWidth: 1.5, padding: 11, borderRadius: 12, alignItems: "center", marginBottom: 14 },
  secondaryCtaText: { color: "#1F7A4C", fontWeight: "700" },
  slotCard: { borderTopWidth: 1, borderTopColor: "#EAECF0", paddingTop: 10, marginTop: 8 },
  slotTitle: { fontWeight: "700", marginBottom: 8, color: "#1E2B24" },
  sessionCard: { borderTopWidth: 1, borderTopColor: "#EAECF0", paddingTop: 10, marginTop: 8 },
  title: { fontWeight: "700", color: "#1E2B24", fontSize: 16 },
  meta: { color: "#667085", marginTop: 4 },
  status: { marginTop: 8, fontWeight: "600", color: "#1F7A4C" },
  actions: { flexDirection: "row", gap: 10, marginTop: 10 },
  actionButton: { flex: 1, borderRadius: 10, paddingVertical: 10, alignItems: "center" },
  approveButton: { backgroundColor: "#1F7A4C" },
  rejectButton: { backgroundColor: "#B42318" },
  actionText: { color: "#fff", fontWeight: "700" },
  rescheduleBlock: { marginTop: 10 },
  ghostDanger: { borderWidth: 1, borderColor: "#B42318", borderRadius: 10, alignItems: "center", paddingVertical: 10, marginTop: 8 },
  ghostDangerText: { color: "#B42318", fontWeight: "700" },
  empty: { color: "#667085" },
  error: { color: "#B42318", marginBottom: 8 },
  logout: { marginTop: 8, padding: 12, alignItems: "center" },
  logoutText: { color: "#7A271A", fontWeight: "600" }
});

