import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Linking,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

type Booking = {
  _id: string;
  scheduledAt: string;
  status: "pending" | "approved" | "rejected";
  notes?: string;
  mentor?: {
    name: string;
    email: string;
    domain?: string;
  };
};

type Session = {
  _id: string;
  date: string;
  time: string;
  amount: number;
  paymentStatus: "pending" | "paid";
  sessionStatus: "booked" | "confirmed" | "completed";
  meetingLink?: string;
  mentorId?: {
    name?: string;
    email?: string;
  };
};

export default function StudentDashboard() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
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
      const [bookingsRes, sessionsRes] = await Promise.all([
        api.get<Booking[]>("/api/bookings/student"),
        api.get<Session[]>("/api/sessions/student/me")
      ]);
      setBookings(bookingsRes.data);
      setSessions(sessionsRes.data);
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to load your bookings.");
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

  if (user?.role !== "student") {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>Access denied for current role.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Student Dashboard</Text>
      <Text style={styles.subheading}>Welcome back, {user.name}</Text>
      <TouchableOpacity style={styles.cta} onPress={() => router.push("/domains")}>
        <Text style={styles.ctaText}>Find Mentors</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.secondaryCta} onPress={() => router.push("/chat" as never)}>
        <Text style={styles.secondaryCtaText}>Open Messages</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.secondaryCta} onPress={() => router.push("/ai-assistant" as never)}>
        <Text style={styles.secondaryCtaText}>Ask AI Assistant</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.secondaryCta} onPress={() => router.push("/complaints" as never)}>
        <Text style={styles.secondaryCtaText}>Raise Complaint</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.secondaryCta} onPress={() => router.push("/student-profile" as never)}>
        <Text style={styles.secondaryCtaText}>Edit LinkedIn-Style Profile</Text>
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
              <Text style={styles.sectionTitle}>Paid Sessions</Text>
              {sessions.length === 0 ? (
                <Text style={styles.empty}>No paid sessions yet.</Text>
              ) : (
                sessions.map((session) => (
                  <View key={session._id} style={styles.card}>
                    <Text style={styles.title}>{session.mentorId?.name || "Mentor"}</Text>
                    <Text style={styles.meta}>
                      {session.date} {session.time} | Amount: INR {session.amount}
                    </Text>
                    <Text style={styles.status}>
                      Payment: {session.paymentStatus} | Session: {session.sessionStatus}
                    </Text>
                    {session.meetingLink && session.paymentStatus === "paid" ? (
                      <TouchableOpacity
                        style={styles.joinButton}
                        onPress={() => Linking.openURL(session.meetingLink as string)}
                      >
                        <Text style={styles.joinButtonText}>Join Session</Text>
                      </TouchableOpacity>
                    ) : (
                      <Text style={styles.meta}>Meeting link will appear after mentor updates.</Text>
                    )}
                  </View>
                ))
              )}
              <Text style={styles.sectionTitle}>Legacy Booking Requests</Text>
            </View>
          }
          ListEmptyComponent={<Text style={styles.empty}>No booking requests yet.</Text>}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.title}>{item.mentor?.name || "Mentor"}</Text>
              <Text style={styles.meta}>{item.mentor?.email}</Text>
              <Text style={styles.meta}>{new Date(item.scheduledAt).toLocaleString()}</Text>
              <Text style={styles.status}>Status: {item.status}</Text>
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
  cta: { backgroundColor: "#1F7A4C", padding: 12, borderRadius: 12, alignItems: "center", marginBottom: 14 },
  ctaText: { color: "#fff", fontWeight: "700" },
  secondaryCta: {
    borderColor: "#1F7A4C",
    borderWidth: 1.5,
    padding: 11,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 14
  },
  secondaryCtaText: { color: "#1F7A4C", fontWeight: "700" },
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
  status: { marginTop: 8, fontWeight: "600", color: "#1F7A4C" },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1E2B24",
    marginBottom: 8,
    marginTop: 4
  },
  joinButton: {
    marginTop: 10,
    backgroundColor: "#1F7A4C",
    borderRadius: 10,
    alignItems: "center",
    paddingVertical: 10
  },
  joinButtonText: { color: "#fff", fontWeight: "700" },
  error: { color: "#B42318", marginBottom: 8 },
  empty: { color: "#667085", textAlign: "center", marginTop: 14 },
  logout: { marginTop: 8, padding: 12, alignItems: "center" },
  logoutText: { color: "#7A271A", fontWeight: "600" }
});
