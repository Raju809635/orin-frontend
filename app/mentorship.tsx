import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, BackHandler, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

type MentorshipSectionId = "discovery" | "interaction" | "session_management";

type VerifiedMentor = { mentorId: string; name: string; title?: string; rating?: number; verifiedBadge?: boolean };
type MentorGroupItem = { id: string; name: string; schedule?: string; membersCount?: number; mentor?: { name?: string } };
type LiveSessionItem = { id: string; title: string; topic?: string; startsAt: string; mentor?: { name?: string } };
type SessionHistoryItem = { sessionId: string; mentorName: string; date: string; time: string; notes?: string };
type SessionItem = {
  _id: string;
  date: string;
  time: string;
  amount: number;
  currency?: string;
  paymentStatus?: string;
  sessionStatus?: string;
  status?: string;
  mentorId?: { name?: string } | null;
};
type BookingItem = { _id: string; status?: string; scheduledAt: string; mentor?: { name?: string; email?: string } };

export default function MentorshipHubScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const isMentor = user?.role === "mentor";
  const [activeSection, setActiveSection] = useState<MentorshipSectionId>("discovery");
  const [verifiedMentors, setVerifiedMentors] = useState<VerifiedMentor[]>([]);
  const [mentorGroups, setMentorGroups] = useState<MentorGroupItem[]>([]);
  const [liveSessions, setLiveSessions] = useState<LiveSessionItem[]>([]);
  const [sessionHistory, setSessionHistory] = useState<SessionHistoryItem[]>([]);
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async (refresh = false) => {
    try {
      if (refresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      const [verifiedRes, groupsRes, liveRes, historyRes, sessionsRes, bookingsRes] = await Promise.allSettled([
        api.get<VerifiedMentor[]>("/api/network/verified-mentors"),
        api.get<MentorGroupItem[]>("/api/network/mentor-groups"),
        api.get<LiveSessionItem[]>("/api/network/live-sessions"),
        api.get<SessionHistoryItem[]>("/api/network/session-history"),
        api.get<SessionItem[]>("/api/sessions/my"),
        api.get<BookingItem[]>("/api/bookings/my")
      ]);
      setVerifiedMentors(verifiedRes.status === "fulfilled" ? verifiedRes.value.data || [] : []);
      setMentorGroups(groupsRes.status === "fulfilled" ? groupsRes.value.data || [] : []);
      setLiveSessions(liveRes.status === "fulfilled" ? liveRes.value.data || [] : []);
      setSessionHistory(historyRes.status === "fulfilled" ? historyRes.value.data || [] : []);
      setSessions(sessionsRes.status === "fulfilled" ? sessionsRes.value.data || [] : []);
      setBookings(bookingsRes.status === "fulfilled" ? bookingsRes.value.data || [] : []);
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to load mentorship modules.");
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

  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        if (activeSection !== "discovery") {
          setActiveSection("discovery");
          return true;
        }
        return false;
      };
      const subscription = BackHandler.addEventListener("hardwareBackPress", onBackPress);
      return () => subscription.remove();
    }, [activeSection])
  );

  const pendingSessions = useMemo(
    () => sessions.filter((s) => s.paymentStatus === "pending" || s.paymentStatus === "rejected"),
    [sessions]
  );
  const waitingSessions = useMemo(
    () => sessions.filter((s) => s.paymentStatus === "waiting_verification"),
    [sessions]
  );
  const confirmedSessions = useMemo(
    () => sessions.filter((s) => s.paymentStatus === "verified" || s.sessionStatus === "confirmed"),
    [sessions]
  );
  const completedSessions = useMemo(
    () => sessions.filter((s) => s.sessionStatus === "completed" || s.status === "completed"),
    [sessions]
  );

  const sections: {
    id: MentorshipSectionId;
    label: string;
    description: string;
    icon: keyof typeof Ionicons.glyphMap;
    border: string;
    gradient: [string, string];
    gradientActive: [string, string];
  }[] = [
    {
      id: "discovery",
      label: isMentor ? "Mentor Operations" : "Discover Mentors",
      description: isMentor
        ? "Manage pricing, domains, and the mentor-side controls that students depend on."
        : "Browse domains, open guides, and find verified mentors.",
      icon: isMentor ? "briefcase" : "search",
      border: "#A4BCFD",
      gradient: ["#FFFFFF", "#EEF4FF"],
      gradientActive: ["#E0EAFF", "#EEF4FF"]
    },
    {
      id: "interaction",
      label: isMentor ? "Student Interaction" : "Mentor Interaction",
      description: isMentor
        ? "Review student chats, mentor groups, and live sessions that support your mentoring delivery."
        : "Explore mentor groups and upcoming live mentoring sessions.",
      icon: "people",
      border: "#ABEFC6",
      gradient: ["#FFFFFF", "#ECFDF3"],
      gradientActive: ["#DCFCE7", "#ECFDF3"]
    },
    {
      id: "session_management",
      label: "Session Management",
      description: isMentor
        ? "Handle booking requests, upcoming sessions, completed sessions, notes, pricing, and availability."
        : "Track bookings, payments, verification, and confirmed sessions.",
      icon: "calendar",
      border: "#F9DBAF",
      gradient: ["#FFFFFF", "#FFF7ED"],
      gradientActive: ["#FFEDD5", "#FFF7ED"]
    }
  ];

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} />}
    >
      <Text style={styles.title}>Mentorship</Text>
      <Text style={styles.sub}>
        {isMentor
          ? "Use the same mentorship workspace in mentor mode to manage requests, sessions, pricing, and availability."
          : "Select a module below to open focused mentorship tools."}
      </Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.moduleStack}>
        {sections.map((item) => {
          const active = activeSection === item.id;
          return (
            <TouchableOpacity key={item.id} activeOpacity={0.92} onPress={() => setActiveSection(item.id)}>
              <LinearGradient
                colors={active ? item.gradientActive : item.gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.moduleCard, { borderColor: item.border }, active && styles.moduleCardActive]}
              >
                <View style={[styles.moduleIconWrap, active && styles.moduleIconWrapActive]}>
                  <Ionicons name={item.icon} size={20} color={active ? "#1F7A4C" : "#475467"} />
                </View>
                <View style={styles.moduleTextWrap}>
                  <Text style={styles.moduleTitle}>{item.label}</Text>
                  <Text style={styles.moduleDesc}>{item.description}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={active ? "#1F7A4C" : "#98A2B3"} />
              </LinearGradient>
            </TouchableOpacity>
          );
        })}
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color="#1F7A4C" />
        </View>
      ) : null}

      {!loading && activeSection === "discovery" ? (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>{isMentor ? "Mentor Operations" : "Discovery"}</Text>
          {isMentor ? (
            <>
              <TouchableOpacity style={[styles.card, styles.cardBlue]} onPress={() => router.push("/mentor-dashboard?section=requests" as never)}>
                <Text style={styles.cardTitle}>Booking Requests</Text>
                <Text style={styles.meta}>Review student booking requests and respond from your mentor dashboard.</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.card, styles.cardBlue]} onPress={() => router.push("/mentor-dashboard?section=pricing" as never)}>
                <Text style={styles.cardTitle}>Pricing Management</Text>
                <Text style={styles.meta}>Update your mentor title and session fee without leaving the existing app flow.</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.card, styles.cardBlue]} onPress={() => router.push("/mentor-dashboard?section=availability" as never)}>
                <Text style={styles.cardTitle}>Availability & Slot Management</Text>
                <Text style={styles.meta}>Publish only the slots you want students to book.</Text>
              </TouchableOpacity>
              <View style={[styles.card, styles.cardBlue]}>
                <Text style={styles.cardTitle}>Verified Mentor System</Text>
                {verifiedMentors.some((item) => item.mentorId === user?.id && item.verifiedBadge) ? (
                  <Text style={styles.meta}>Your mentor profile currently carries a verified badge.</Text>
                ) : (
                  <Text style={styles.meta}>Verification status is managed by ORIN admin review and mentor profile quality.</Text>
                )}
              </View>
            </>
          ) : (
            <>
              <TouchableOpacity style={[styles.card, styles.cardBlue]} onPress={() => router.push("/domains" as never)}>
                <Text style={styles.cardTitle}>Domains</Text>
                <Text style={styles.meta}>Browse mentorship categories and mentors.</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.card, styles.cardBlue]} onPress={() => router.push("/domain-guide" as never)}>
                <Text style={styles.cardTitle}>Domain Guide</Text>
                <Text style={styles.meta}>Understand domain paths and sub-domains.</Text>
              </TouchableOpacity>
              <View style={[styles.card, styles.cardBlue]}>
                <Text style={styles.cardTitle}>Verified Mentor System</Text>
                {verifiedMentors.length === 0 ? (
                  <Text style={styles.meta}>No verified mentors available now.</Text>
                ) : (
                  verifiedMentors.slice(0, 6).map((item) => (
                    <Text key={item.mentorId} style={styles.meta}>
                      {item.name} {item.verifiedBadge ? "(Verified)" : ""} | Rating {item.rating || 0}
                    </Text>
                  ))
                )}
              </View>
            </>
          )}
        </View>
      ) : null}

      {!loading && activeSection === "interaction" ? (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>{isMentor ? "Student Interaction" : "Interaction"}</Text>
          {isMentor ? (
            <>
              <TouchableOpacity style={[styles.card, styles.cardGreen]} onPress={() => router.push("/chat" as never)}>
                <Text style={styles.cardTitle}>Student Chats</Text>
                <Text style={styles.meta}>Open your conversation workspace for student coordination and follow-up.</Text>
              </TouchableOpacity>
              <View style={[styles.card, styles.cardGreen]}>
                <Text style={styles.cardTitle}>Mentor Groups</Text>
                {mentorGroups.length === 0 ? (
                  <Text style={styles.meta}>No mentor groups available.</Text>
                ) : (
                  mentorGroups.slice(0, 6).map((item) => (
                    <Text key={item.id} style={styles.meta}>
                      {item.name} | Mentor: {item.mentor?.name || "Mentor"} | Students: {item.membersCount || 0}
                    </Text>
                  ))
                )}
              </View>
              <View style={[styles.card, styles.cardGreen]}>
                <Text style={styles.cardTitle}>Mentor Live Sessions</Text>
                {liveSessions.length === 0 ? (
                  <Text style={styles.meta}>No live sessions scheduled.</Text>
                ) : (
                  liveSessions.slice(0, 6).map((item) => (
                    <Text key={item.id} style={styles.meta}>
                      {item.title} | {item.mentor?.name || "Mentor"} | {new Date(item.startsAt).toLocaleString()}
                    </Text>
                  ))
                )}
              </View>
            </>
          ) : (
            <>
              <View style={[styles.card, styles.cardGreen]}>
                <Text style={styles.cardTitle}>Mentor Groups</Text>
                {mentorGroups.length === 0 ? (
                  <Text style={styles.meta}>No mentor groups available.</Text>
                ) : (
                  mentorGroups.slice(0, 6).map((item) => (
                    <Text key={item.id} style={styles.meta}>
                      {item.name} | Mentor: {item.mentor?.name || "Mentor"} | Students: {item.membersCount || 0}
                    </Text>
                  ))
                )}
              </View>
              <View style={[styles.card, styles.cardGreen]}>
                <Text style={styles.cardTitle}>Mentor Live Sessions</Text>
                {liveSessions.length === 0 ? (
                  <Text style={styles.meta}>No live sessions scheduled.</Text>
                ) : (
                  liveSessions.slice(0, 6).map((item) => (
                    <Text key={item.id} style={styles.meta}>
                      {item.title} | {item.mentor?.name || "Mentor"} | {new Date(item.startsAt).toLocaleString()}
                    </Text>
                  ))
                )}
              </View>
            </>
          )}
        </View>
      ) : null}

      {!loading && activeSection === "session_management" ? (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Session Management</Text>
          {isMentor ? (
            <>
              <TouchableOpacity style={[styles.card, styles.cardOrange]} onPress={() => router.push("/mentor-dashboard?section=requests" as never)}>
                <Text style={styles.cardTitle}>View Booking Requests</Text>
                <Text style={styles.meta}>Pending student requests: {bookings.filter((item) => item.status === "pending").length}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.card, styles.cardOrange]} onPress={() => router.push("/mentor-dashboard?section=sessions" as never)}>
                <Text style={styles.cardTitle}>Upcoming Sessions</Text>
                <Text style={styles.meta}>Confirmed or active sessions: {confirmedSessions.length}</Text>
              </TouchableOpacity>
              <View style={[styles.card, styles.cardOrange]}>
                <Text style={styles.cardTitle}>Completed Sessions</Text>
                <Text style={styles.meta}>{completedSessions.length} completed mentoring session(s)</Text>
              </View>
              <TouchableOpacity style={[styles.card, styles.cardOrange]} onPress={() => router.push("/mentor-dashboard?section=availability" as never)}>
                <Text style={styles.cardTitle}>Manage Availability Slots</Text>
                <Text style={styles.meta}>Open mentor availability controls.</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.card, styles.cardOrange]} onPress={() => router.push("/mentor-dashboard?section=pricing" as never)}>
                <Text style={styles.cardTitle}>Manage Pricing</Text>
                <Text style={styles.meta}>Open mentor pricing controls for session fee updates.</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.card, styles.cardOrange]} onPress={() => router.push("/mentor-dashboard?section=sessions" as never)}>
                <Text style={styles.cardTitle}>Add Session Notes & Meet Links</Text>
                <Text style={styles.meta}>Use the mentor sessions panel to add links and session delivery details.</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <View style={[styles.card, styles.cardOrange]}>
                <Text style={styles.cardTitle}>Session History & Notes</Text>
                {sessionHistory.length === 0 ? (
                  <Text style={styles.meta}>No completed sessions yet.</Text>
                ) : (
                  sessionHistory.slice(0, 5).map((item) => (
                    <Text key={item.sessionId} style={styles.meta}>
                      {item.mentorName} | {item.date} {item.time}
                    </Text>
                  ))
                )}
              </View>
              <View style={[styles.card, styles.cardOrange]}>
                <Text style={styles.cardTitle}>Pending Payments</Text>
                <Text style={styles.meta}>{pendingSessions.length} session(s)</Text>
              </View>
              <View style={[styles.card, styles.cardOrange]}>
                <Text style={styles.cardTitle}>Awaiting Verification</Text>
                <Text style={styles.meta}>{waitingSessions.length} session(s)</Text>
              </View>
              <View style={[styles.card, styles.cardOrange]}>
                <Text style={styles.cardTitle}>Confirmed Sessions</Text>
                <Text style={styles.meta}>{confirmedSessions.length} session(s)</Text>
              </View>
              <View style={[styles.card, styles.cardOrange]}>
                <Text style={styles.cardTitle}>Legacy Booking Requests</Text>
                <Text style={styles.meta}>{bookings.length} request(s)</Text>
              </View>
              <TouchableOpacity style={styles.openBtn} onPress={() => router.push("/student-sessions" as never)}>
                <Text style={styles.openBtnText}>Open Full Session Panel</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: "#F3F6FB", gap: 10 },
  title: { fontSize: 28, fontWeight: "800", color: "#11261E" },
  sub: { color: "#475467" },
  error: { color: "#B42318" },
  moduleStack: { gap: 10 },
  moduleCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    shadowColor: "#101828",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4
  },
  moduleCardActive: { shadowOpacity: 0.13, elevation: 6 },
  moduleIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.85)",
    alignItems: "center",
    justifyContent: "center"
  },
  moduleIconWrapActive: { backgroundColor: "rgba(255,255,255,1)" },
  moduleTextWrap: { flex: 1, gap: 2 },
  moduleTitle: { color: "#1E2B24", fontWeight: "800", fontSize: 15 },
  moduleDesc: { color: "#667085", fontSize: 12, lineHeight: 16 },
  loadingWrap: { alignItems: "center", justifyContent: "center", minHeight: 180 },
  panel: { gap: 8, marginTop: 4 },
  panelTitle: { fontSize: 16, fontWeight: "800", color: "#1E2B24" },
  card: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DDE6E1",
    borderRadius: 12,
    padding: 12,
    gap: 4
  },
  cardBlue: { backgroundColor: "#EEF4FF", borderColor: "#C7D7FE" },
  cardGreen: { backgroundColor: "#ECFDF3", borderColor: "#B7E5CC" },
  cardOrange: { backgroundColor: "#FFF7ED", borderColor: "#F9DBAF" },
  cardTitle: { color: "#1E2B24", fontWeight: "800" },
  meta: { color: "#667085" },
  openBtn: {
    marginTop: 2,
    alignSelf: "flex-start",
    backgroundColor: "#1F7A4C",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9
  },
  openBtnText: { color: "#fff", fontWeight: "700" }
});
