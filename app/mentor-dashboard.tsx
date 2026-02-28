import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { useFocusEffect } from "expo-router";
import { useRouter } from "expo-router";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { notify } from "@/utils/notify";

type Booking = {
  _id: string;
  scheduledAt: string;
  status: "pending" | "approved" | "rejected";
  notes?: string;
  student?: {
    name: string;
    email: string;
  };
};

type DirectMessage = {
  _id: string;
  title: string;
  message: string;
  createdAt: string;
  sentBy?: { _id?: string; name?: string; role?: string };
  recipient?: { _id?: string; name?: string; role?: string };
};

export default function MentorDashboard() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [chatTitle, setChatTitle] = useState("Mentor Support");
  const [chatMessage, setChatMessage] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBookings = useCallback(async (refresh = false) => {
    try {
      if (refresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);
      const [bookingRes, messageRes] = await Promise.all([
        api.get<Booking[]>("/api/bookings/mentor"),
        api.get<DirectMessage[]>("/api/messages/me")
      ]);
      setBookings(bookingRes.data);
      setMessages(messageRes.data);
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to load mentor bookings.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchBookings();
    }, [fetchBookings])
  );

  async function updateBookingStatus(bookingId: string, status: "approved" | "rejected") {
    try {
      await api.patch(`/api/bookings/${bookingId}/status`, { status });
      notify(`Booking ${status}.`);
      await fetchBookings(true);
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to update booking status.");
    }
  }

  async function sendMessageToAdmin() {
    if (!chatTitle.trim() || !chatMessage.trim()) {
      setError("Title and message are required for admin chat.");
      return;
    }

    try {
      setSendingMessage(true);
      setError(null);
      await api.post("/api/messages/admin", {
        title: chatTitle.trim(),
        message: chatMessage.trim()
      });
      setChatMessage("");
      notify("Message sent to admin.");
      await fetchBookings(true);
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to send message to admin.");
    } finally {
      setSendingMessage(false);
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
    <View style={styles.container}>
      <Text style={styles.heading}>Mentor Dashboard</Text>
      <Text style={styles.subheading}>Manage incoming booking requests.</Text>
      <TouchableOpacity style={styles.secondaryCta} onPress={() => router.push("/mentor-profile" as never)}>
        <Text style={styles.secondaryCtaText}>Edit LinkedIn-Style Profile</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.secondaryCta} onPress={() => router.push("/chat" as never)}>
        <Text style={styles.secondaryCtaText}>Open Student Messages</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.secondaryCta} onPress={() => router.push("/ai-assistant" as never)}>
        <Text style={styles.secondaryCtaText}>Ask AI Assistant</Text>
      </TouchableOpacity>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#1F7A4C" />
        </View>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {!isLoading ? (
        <FlatList
          data={bookings}
          keyExtractor={(item) => item._id}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => fetchBookings(true)} />}
          ListHeaderComponent={
            <View>
              <View style={styles.card}>
                <Text style={styles.title}>Chat With Admin</Text>
                <TextInput
                  style={styles.input}
                  value={chatTitle}
                  onChangeText={setChatTitle}
                  placeholder="Title"
                />
                <TextInput
                  style={[styles.input, styles.messageInput]}
                  value={chatMessage}
                  onChangeText={setChatMessage}
                  placeholder="Write your message to admin"
                  multiline
                />
                <TouchableOpacity style={styles.approveButton} onPress={sendMessageToAdmin} disabled={sendingMessage}>
                  <Text style={styles.actionText}>{sendingMessage ? "Sending..." : "Send To Admin"}</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.card}>
                <Text style={styles.title}>Recent Admin Messages</Text>
                {messages.length === 0 ? (
                  <Text style={styles.empty}>No admin messages yet.</Text>
                ) : (
                  messages.slice(0, 8).map((msg) => (
                    <View key={msg._id} style={styles.messageRow}>
                      <Text style={styles.metaStrong}>{msg.title}</Text>
                      <Text style={styles.meta}>{msg.message}</Text>
                      <Text style={styles.meta}>
                        {msg.sentBy?.name || "Unknown"} • {new Date(msg.createdAt).toLocaleString()}
                      </Text>
                    </View>
                  ))
                )}
              </View>

              <Text style={styles.sectionHeader}>Booking Requests</Text>
            </View>
          }
          ListEmptyComponent={<Text style={styles.empty}>No booking requests yet.</Text>}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.title}>{item.student?.name || "Student"}</Text>
              <Text style={styles.meta}>{item.student?.email}</Text>
              <Text style={styles.meta}>{new Date(item.scheduledAt).toLocaleString()}</Text>
              <Text style={styles.status}>Status: {item.status}</Text>
              {item.status === "pending" ? (
                <View style={styles.actions}>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.approveButton]}
                    onPress={() => updateBookingStatus(item._id, "approved")}
                  >
                    <Text style={styles.actionText}>Approve</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.rejectButton]}
                    onPress={() => updateBookingStatus(item._id, "rejected")}
                  >
                    <Text style={styles.actionText}>Reject</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
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
  secondaryCta: {
    borderColor: "#1F7A4C",
    borderWidth: 1.5,
    padding: 11,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 14
  },
  secondaryCtaText: { color: "#1F7A4C", fontWeight: "700" },
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
  status: { marginTop: 8, fontWeight: "600", color: "#1F7A4C" },
  actions: { flexDirection: "row", gap: 10, marginTop: 10 },
  actionButton: { flex: 1, borderRadius: 10, paddingVertical: 10, alignItems: "center" },
  approveButton: { backgroundColor: "#1F7A4C" },
  rejectButton: { backgroundColor: "#B42318" },
  actionText: { color: "#fff", fontWeight: "700" },
  error: { color: "#B42318", marginBottom: 8 },
  empty: { color: "#667085", textAlign: "center", marginTop: 14 },
  sectionHeader: { marginTop: 4, marginBottom: 8, color: "#1E2B24", fontWeight: "700", fontSize: 16 },
  input: {
    marginTop: 8,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#D0D5DD",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10
  },
  messageInput: { minHeight: 84, textAlignVertical: "top" },
  messageRow: { marginTop: 10, borderTopWidth: 1, borderTopColor: "#EEF2F0", paddingTop: 10 },
  metaStrong: { color: "#1E2B24", fontWeight: "700" },
  logout: { marginTop: 8, padding: 12, alignItems: "center" },
  logoutText: { color: "#7A271A", fontWeight: "600" }
});
