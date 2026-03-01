import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
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

type Session = {
  _id: string;
  date: string;
  time: string;
  scheduledStart?: string;
  amount: number;
  paymentStatus: "pending" | "waiting_verification" | "verified" | "rejected" | "paid";
  sessionStatus: "booked" | "confirmed" | "completed";
  meetingLink?: string;
  studentId?: {
    name?: string;
    email?: string;
  };
};

type AdminChatMessage = {
  _id: string;
  sender: string;
  recipient: string;
  text: string;
  createdAt: string;
};

type AvailabilitySlot = {
  _id: string;
  day: "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";
  startTime: string;
  endTime: string;
  sessionDurationMinutes: 30 | 60;
};

type MentorProfilePayload = {
  title?: string;
  sessionPrice?: number;
  profilePhotoUrl?: string;
};

type SectionId = "overview" | "pricing" | "availability" | "sessions" | "requests" | "adminChat";

const sectionOrder: { id: SectionId; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "pricing", label: "Profile & Pricing" },
  { id: "availability", label: "Availability" },
  { id: "sessions", label: "Sessions" },
  { id: "requests", label: "Booking Requests" },
  { id: "adminChat", label: "Admin Chat" }
];

export default function MentorDashboard() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [activeSection, setActiveSection] = useState<SectionId>("overview");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [messages, setMessages] = useState<AdminChatMessage[]>([]);
  const [availabilitySlots, setAvailabilitySlots] = useState<AvailabilitySlot[]>([]);
  const [newSlotDay, setNewSlotDay] = useState<AvailabilitySlot["day"]>("Mon");
  const [newSlotStartTime, setNewSlotStartTime] = useState("10:00");
  const [newSlotEndTime, setNewSlotEndTime] = useState("11:00");
  const [newSlotDuration, setNewSlotDuration] = useState<30 | 60>(60);
  const [creatingSlot, setCreatingSlot] = useState(false);
  const [sessionPrice, setSessionPrice] = useState("499");
  const [mentorTitle, setMentorTitle] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [chatMessage, setChatMessage] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [meetingLinks, setMeetingLinks] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profilePhotoUrl, setProfilePhotoUrl] = useState("");
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const mentorServices = [
    {
      key: "ai",
      label: "AI Bot",
      icon: "sparkles",
      tint: "#7C3AED",
      bg: "#F0E9FF",
      border: "#E1D5FF",
      onPress: () => router.push("/ai-assistant" as never)
    },
    {
      key: "availability",
      label: "Availability",
      icon: "calendar",
      tint: "#165DFF",
      bg: "#EAF2FF",
      border: "#D7E6FF",
      onPress: () => setActiveSection("availability")
    },
    {
      key: "sessions",
      label: "Sessions",
      icon: "videocam",
      tint: "#0F766E",
      bg: "#E7F9F6",
      border: "#CDEEE8",
      onPress: () => setActiveSection("sessions")
    },
    {
      key: "chat",
      label: "Student Chats",
      icon: "chatbubble-ellipses",
      tint: "#0369A1",
      bg: "#E8F5FF",
      border: "#D3EAFA",
      onPress: () => router.push("/chat" as never)
    },
    {
      key: "pricing",
      label: "Pricing",
      icon: "cash",
      tint: "#B45309",
      bg: "#FFF4E5",
      border: "#F8E2C2",
      onPress: () => setActiveSection("pricing")
    },
    {
      key: "admin",
      label: "Admin Chat",
      icon: "shield-checkmark",
      tint: "#475467",
      bg: "#EEF2F6",
      border: "#DCE3EA",
      onPress: () => setActiveSection("adminChat")
    }
  ] as const;

  const fetchDashboard = useCallback(async (refresh = false) => {
    try {
      if (refresh) setIsRefreshing(true);
      else setIsLoading(true);

      setError(null);
      const [bookingRes, sessionRes, profileRes] = await Promise.all([
        api.get<Booking[]>("/api/bookings/mentor"),
        api.get<Session[]>("/api/sessions/mentor/me"),
        api.get<{ profile?: MentorProfilePayload }>("/api/profiles/mentor/me")
      ]);

      let adminMessages: AdminChatMessage[] = [];
      try {
        const chatRes = await api.get<{ messages: AdminChatMessage[] }>("/api/chat/messages/admin");
        adminMessages = chatRes.data.messages || [];
      } catch {
        adminMessages = [];
      }

      if (user?.id) {
        const availabilityRes = await api.get<{ weeklySlots: AvailabilitySlot[] }>(
          `/api/availability/mentor/${user.id}`
        );
        setAvailabilitySlots(availabilityRes.data.weeklySlots || []);
      }

      setBookings(bookingRes.data || []);
      setSessions(sessionRes.data || []);
      setMessages(adminMessages);
      setSessionPrice(String(Number(profileRes.data?.profile?.sessionPrice || 0) || 499));
      setMentorTitle(profileRes.data?.profile?.title || "");
      setProfilePhotoUrl(profileRes.data?.profile?.profilePhotoUrl || "");
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to load mentor dashboard.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      fetchDashboard();
    }, [fetchDashboard])
  );

  const pendingRequests = useMemo(
    () => bookings.filter((booking) => booking.status === "pending"),
    [bookings]
  );

  const confirmedPaidSessions = useMemo(
    () =>
      sessions.filter(
        (session) =>
          session.sessionStatus === "confirmed" &&
          (session.paymentStatus === "paid" || session.paymentStatus === "verified")
      ),
    [sessions]
  );

  const filteredConfirmedPaidSessions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return confirmedPaidSessions;
    return confirmedPaidSessions.filter((session) => {
      const studentName = (session.studentId?.name || "").toLowerCase();
      const studentEmail = (session.studentId?.email || "").toLowerCase();
      const date = (session.date || "").toLowerCase();
      const time = (session.time || "").toLowerCase();
      const paymentStatus = (session.paymentStatus || "").toLowerCase();
      const sessionStatus = (session.sessionStatus || "").toLowerCase();
      return (
        studentName.includes(query) ||
        studentEmail.includes(query) ||
        date.includes(query) ||
        time.includes(query) ||
        paymentStatus.includes(query) ||
        sessionStatus.includes(query)
      );
    });
  }, [confirmedPaidSessions, searchQuery]);

  const filteredBookings = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return bookings;
    return bookings.filter((booking) => {
      const studentName = (booking.student?.name || "").toLowerCase();
      const studentEmail = (booking.student?.email || "").toLowerCase();
      const scheduledAt = new Date(booking.scheduledAt).toLocaleString().toLowerCase();
      const status = (booking.status || "").toLowerCase();
      const notes = (booking.notes || "").toLowerCase();
      return (
        studentName.includes(query) ||
        studentEmail.includes(query) ||
        status.includes(query) ||
        notes.includes(query) ||
        scheduledAt.includes(query)
      );
    });
  }, [bookings, searchQuery]);

  const filteredMessages = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return messages;
    return messages.filter((msg) => msg.text.toLowerCase().includes(query));
  }, [messages, searchQuery]);

  const normalizedQuery = searchQuery.trim();
  const totalSearchMatches = useMemo(
    () => filteredConfirmedPaidSessions.length + filteredBookings.length + filteredMessages.length,
    [filteredConfirmedPaidSessions.length, filteredBookings.length, filteredMessages.length]
  );

  function canSetMeetingLink(session: Session) {
    const start = session.scheduledStart ? new Date(session.scheduledStart).getTime() : NaN;
    if (!Number.isFinite(start)) return true;
    return Date.now() >= start - 5 * 60 * 1000;
  }

  async function createAvailabilitySlot() {
    try {
      setCreatingSlot(true);
      setError(null);
      await api.post("/api/availability", {
        day: newSlotDay,
        startTime: newSlotStartTime,
        endTime: newSlotEndTime,
        sessionDurationMinutes: newSlotDuration
      });
      notify("Availability slot added.");
      await fetchDashboard(true);
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to add availability slot.");
    } finally {
      setCreatingSlot(false);
    }
  }

  async function saveMentorProfilePricing() {
    const parsedPrice = Number(sessionPrice || 0);
    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      setError("Please enter valid session price.");
      return;
    }

    try {
      setSavingProfile(true);
      setError(null);
      await api.patch("/api/profiles/mentor/me", {
        title: mentorTitle,
        sessionPrice: parsedPrice
      });
      notify("Profile & pricing updated.");
      await fetchDashboard(true);
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to save mentor profile.");
    } finally {
      setSavingProfile(false);
    }
  }

  async function updateBookingStatus(bookingId: string, status: "approved" | "rejected") {
    try {
      setError(null);
      await api.patch(`/api/bookings/${bookingId}/status`, { status });
      notify(`Booking ${status}.`);
      await fetchDashboard(true);
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to update booking status.");
    }
  }

  async function saveMeetingLink(sessionId: string) {
    try {
      const meetingLink = (meetingLinks[sessionId] || "").trim();
      if (!meetingLink) {
        setError("Meeting link is required.");
        return;
      }
      await api.patch(`/api/sessions/${sessionId}/meeting-link`, { meetingLink });
      notify("Meeting link updated.");
      await fetchDashboard(true);
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to update meeting link.");
    }
  }

  async function sendMessageToAdmin() {
    if (!chatMessage.trim()) {
      setError("Message is required for admin chat.");
      return;
    }
    try {
      setSendingMessage(true);
      setError(null);
      await api.post("/api/chat/messages/admin", { text: chatMessage.trim() });
      setChatMessage("");
      notify("Message sent to admin.");
      await fetchDashboard(true);
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
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => fetchDashboard(true)} />}
    >
      <View style={styles.topRow}>
        <View>
          <Text style={styles.heading}>Mentor Home</Text>
          <Text style={styles.subheading}>Manage profile, pricing, timings and sessions.</Text>
        </View>
        <View style={styles.profileMenuWrap}>
          <TouchableOpacity style={styles.avatarButton} onPress={() => setShowProfileMenu((prev) => !prev)}>
            {profilePhotoUrl ? (
              <Image source={{ uri: profilePhotoUrl }} style={styles.avatarImage} />
            ) : (
              <View style={[styles.avatarImage, styles.avatarFallback]}>
                <Text style={styles.avatarText}>{user.name?.charAt(0)?.toUpperCase() || "M"}</Text>
              </View>
            )}
          </TouchableOpacity>
          {showProfileMenu ? (
            <View style={styles.profileMenuCard}>
              <TouchableOpacity onPress={() => router.push("/mentor-profile" as never)}>
                <Text style={styles.profileMenuItem}>Edit Profile</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => router.push("/settings" as never)}>
                <Text style={styles.profileMenuItem}>Settings</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => router.push("/about" as never)}>
                <Text style={styles.profileMenuItem}>About ORIN</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      </View>

      <View style={styles.searchBox}>
        <Ionicons name="search" size={18} color="#667085" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search students, sessions or chat"
          placeholderTextColor="#98A2B3"
          value={searchQuery}
          onChangeText={(value) => {
            setSearchQuery(value);
            if (value.trim() && ["overview", "pricing", "availability"].includes(activeSection)) {
              setActiveSection("sessions");
            }
          }}
        />
      </View>
      {normalizedQuery ? (
        <Text style={styles.searchMeta}>
          {totalSearchMatches > 0
            ? `Search results: ${totalSearchMatches} match${totalSearchMatches > 1 ? "es" : ""}`
            : "No results for your search"}
        </Text>
      ) : null}

      <View style={styles.heroBanner}>
        <Text style={styles.heroEyebrow}>Mentor Workspace</Text>
        <Text style={styles.heroTitle}>Build Sessions That Students Trust</Text>
        <Text style={styles.heroSubTitle}>Manage pricing, availability, chat, and live links in one place.</Text>
      </View>

      <Text style={styles.sectionHeader}>Services</Text>
      <View style={styles.quickGrid}>
        {mentorServices.map((item) => (
          <TouchableOpacity key={item.key} style={[styles.quickTile, { borderColor: item.border }]} onPress={item.onPress}>
            <View style={[styles.iconBadge, { backgroundColor: item.bg }]}>
              <Ionicons name={item.icon} size={18} color={item.tint} />
            </View>
            <Text style={styles.quickTileTitle}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.sectionHeader}>Featured</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.featuredRow}>
        <TouchableOpacity style={[styles.featureCard, styles.featureCardOne]} onPress={() => setActiveSection("availability")}>
          <Text style={styles.featurePill}>Plan</Text>
          <Text style={styles.featureTitle}>Weekly Slot Planning</Text>
          <Text style={styles.featureCopy}>Publish only the timings you want students to book.</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.featureCard, styles.featureCardTwo]} onPress={() => setActiveSection("pricing")}>
          <Text style={styles.featurePill}>Earn</Text>
          <Text style={styles.featureTitle}>Smart Pricing Control</Text>
          <Text style={styles.featureCopy}>Set your profile title and session fee with full flexibility.</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.featureCard, styles.featureCardThree]} onPress={() => setActiveSection("sessions")}>
          <Text style={styles.featurePill}>Deliver</Text>
          <Text style={styles.featureTitle}>Meet Link Workflow</Text>
          <Text style={styles.featureCopy}>Attach session links at the right time and keep delivery clean.</Text>
        </TouchableOpacity>
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.sectionNav}>
        <View style={styles.sectionNavRow}>
          {sectionOrder.map((section) => {
            const active = activeSection === section.id;
            return (
              <TouchableOpacity
                key={section.id}
                style={[styles.sectionChip, active && styles.sectionChipActive]}
                onPress={() => setActiveSection(section.id)}
              >
                <Text style={[styles.sectionChipText, active && styles.sectionChipTextActive]}>{section.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#1F7A4C" />
        </View>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {!isLoading && activeSection === "overview" ? (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Overview</Text>
          <View style={styles.metricsRow}>
            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>{pendingRequests.length}</Text>
              <Text style={styles.metricLabel}>Pending Requests</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>{confirmedPaidSessions.length}</Text>
              <Text style={styles.metricLabel}>Confirmed Sessions</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>{messages.length}</Text>
              <Text style={styles.metricLabel}>Admin Messages</Text>
            </View>
          </View>
          <Text style={styles.meta}>Use sections above to update price, timings and session actions quickly.</Text>
        </View>
      ) : null}

      {!isLoading && activeSection === "pricing" ? (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Profile & Pricing</Text>
          <Text style={styles.meta}>Set your title and per-session amount students pay.</Text>
          <TextInput
            style={styles.input}
            placeholder="Mentor title (e.g. Senior SDE)"
            value={mentorTitle}
            onChangeText={setMentorTitle}
          />
          <TextInput
            style={styles.input}
            placeholder="Session price in INR"
            keyboardType="numeric"
            value={sessionPrice}
            onChangeText={setSessionPrice}
          />
          <TouchableOpacity style={styles.primaryButton} onPress={saveMentorProfilePricing} disabled={savingProfile}>
            <Text style={styles.primaryButtonText}>{savingProfile ? "Saving..." : "Save Profile & Price"}</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {!isLoading && activeSection === "availability" ? (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Weekly Availability</Text>
          <Text style={styles.meta}>Students can only book these timings for next 7 days.</Text>
          <View style={styles.rowWrap}>
            {(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const).map((day) => {
              const active = newSlotDay === day;
              return (
                <TouchableOpacity
                  key={day}
                  style={[styles.dayChip, active && styles.dayChipActive]}
                  onPress={() => setNewSlotDay(day)}
                >
                  <Text style={[styles.dayChipText, active && styles.dayChipTextActive]}>{day}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <TextInput
            style={styles.input}
            placeholder="Start Time (HH:MM)"
            value={newSlotStartTime}
            onChangeText={setNewSlotStartTime}
          />
          <TextInput
            style={styles.input}
            placeholder="End Time (HH:MM)"
            value={newSlotEndTime}
            onChangeText={setNewSlotEndTime}
          />
          <View style={styles.rowWrap}>
            {[30, 60].map((mins) => {
              const active = newSlotDuration === mins;
              return (
                <TouchableOpacity
                  key={mins}
                  style={[styles.dayChip, active && styles.dayChipActive]}
                  onPress={() => setNewSlotDuration(mins as 30 | 60)}
                >
                  <Text style={[styles.dayChipText, active && styles.dayChipTextActive]}>{mins} min</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <TouchableOpacity style={styles.primaryButton} onPress={createAvailabilitySlot} disabled={creatingSlot}>
            <Text style={styles.primaryButtonText}>{creatingSlot ? "Saving..." : "Add Availability Slot"}</Text>
          </TouchableOpacity>
          {availabilitySlots.length === 0 ? (
            <Text style={styles.empty}>No availability slots set yet.</Text>
          ) : (
            availabilitySlots.map((slot) => (
              <Text key={slot._id} style={styles.meta}>
                {slot.day}: {slot.startTime} - {slot.endTime} ({slot.sessionDurationMinutes} min)
              </Text>
            ))
          )}
        </View>
      ) : null}

      {!isLoading && activeSection === "sessions" ? (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Confirmed Paid Sessions</Text>
          {filteredConfirmedPaidSessions.length === 0 ? (
            <Text style={styles.empty}>No confirmed sessions yet.</Text>
          ) : (
            filteredConfirmedPaidSessions.map((session) => (
              <View key={session._id} style={styles.card}>
                <Text style={styles.title}>{session.studentId?.name || "Student"}</Text>
                <Text style={styles.meta}>
                  {session.date} {session.time} | INR {session.amount}
                </Text>
                <Text style={styles.status}>
                  Payment: {session.paymentStatus} | Session: {session.sessionStatus}
                </Text>
                {!canSetMeetingLink(session) ? (
                  <Text style={styles.meta}>Meeting link can be added only in last 5 minutes before start time.</Text>
                ) : null}
                <TextInput
                  style={styles.input}
                  placeholder="https://meet.google.com/..."
                  value={meetingLinks[session._id] ?? session.meetingLink ?? ""}
                  onChangeText={(value) => setMeetingLinks((prev) => ({ ...prev, [session._id]: value }))}
                />
                <TouchableOpacity
                  style={[styles.primaryButton, !canSetMeetingLink(session) && styles.disabledButton]}
                  onPress={() => saveMeetingLink(session._id)}
                  disabled={!canSetMeetingLink(session)}
                >
                  <Text style={styles.primaryButtonText}>Save Meet Link</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>
      ) : null}

      {!isLoading && activeSection === "requests" ? (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Booking Requests</Text>
          {filteredBookings.length === 0 ? (
            <Text style={styles.empty}>No booking requests yet.</Text>
          ) : (
            filteredBookings.map((booking) => (
              <View key={booking._id} style={styles.card}>
                <Text style={styles.title}>{booking.student?.name || "Student"}</Text>
                <Text style={styles.meta}>{booking.student?.email}</Text>
                <Text style={styles.meta}>{new Date(booking.scheduledAt).toLocaleString()}</Text>
                <Text style={styles.status}>Status: {booking.status}</Text>
                {booking.status === "pending" ? (
                  <View style={styles.actions}>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.approveButton]}
                      onPress={() => updateBookingStatus(booking._id, "approved")}
                    >
                      <Text style={styles.actionText}>Approve</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.rejectButton]}
                      onPress={() => updateBookingStatus(booking._id, "rejected")}
                    >
                      <Text style={styles.actionText}>Reject</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
              </View>
            ))
          )}
        </View>
      ) : null}

      {!isLoading && activeSection === "adminChat" ? (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Admin Chat</Text>
          <TextInput
            style={[styles.input, styles.inputTall]}
            value={chatMessage}
            onChangeText={setChatMessage}
            placeholder="Write your message to admin"
            multiline
          />
          <TouchableOpacity style={styles.primaryButton} onPress={sendMessageToAdmin} disabled={sendingMessage}>
            <Text style={styles.primaryButtonText}>{sendingMessage ? "Sending..." : "Send To Admin"}</Text>
          </TouchableOpacity>
          {filteredMessages.length === 0 ? (
            <Text style={styles.empty}>No admin messages yet.</Text>
          ) : (
            filteredMessages.slice(0, 20).map((msg) => (
              <View key={msg._id} style={styles.card}>
                <Text style={styles.metaStrong}>{msg.sender === user?.id ? "You" : "Admin"}</Text>
                <Text style={styles.meta}>{msg.text}</Text>
                <Text style={styles.meta}>{new Date(msg.createdAt).toLocaleString()}</Text>
              </View>
            ))
          )}
        </View>
      ) : null}

      <TouchableOpacity style={styles.logout} onPress={logout}>
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: "#F3F5F7", padding: 20, paddingBottom: 30 },
  heading: { fontSize: 28, fontWeight: "800", color: "#11261E" },
  subheading: { marginTop: 6, marginBottom: 12, color: "#475467", fontWeight: "500" },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  profileMenuWrap: { alignItems: "flex-end", position: "relative", zIndex: 2 },
  avatarButton: { width: 48, height: 48, borderRadius: 24, overflow: "hidden", borderWidth: 2, borderColor: "#CFE4D8" },
  avatarImage: { width: "100%", height: "100%" },
  avatarFallback: { alignItems: "center", justifyContent: "center", backgroundColor: "#E8F5EE" },
  avatarText: { color: "#0B3D2E", fontWeight: "700", fontSize: 18 },
  profileMenuCard: {
    marginTop: 10,
    position: "absolute",
    top: 48,
    right: 0,
    backgroundColor: "#fff",
    borderColor: "#D0D5DD",
    borderWidth: 1,
    borderRadius: 12,
    minWidth: 150,
    paddingVertical: 8
  },
  profileMenuItem: { paddingHorizontal: 12, paddingVertical: 9, color: "#1E2B24", fontWeight: "600" },
  centered: { alignItems: "center", justifyContent: "center", minHeight: 140 },
  searchBox: {
    marginTop: 4,
    marginBottom: 12,
    backgroundColor: "#fff",
    borderColor: "#D0D5DD",
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 46,
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  searchInput: { flex: 1, color: "#1E2B24", fontWeight: "500" },
  searchMeta: {
    marginTop: -4,
    marginBottom: 10,
    color: "#475467",
    fontWeight: "600",
    fontSize: 12
  },
  heroBanner: {
    backgroundColor: "#F7FBFF",
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: "#D7E6F6",
    marginBottom: 14
  },
  heroEyebrow: { color: "#165DFF", fontWeight: "700", marginBottom: 6 },
  heroTitle: { color: "#11261E", fontSize: 28, fontWeight: "900", lineHeight: 34 },
  heroSubTitle: { marginTop: 8, color: "#4A5B53", fontWeight: "500", lineHeight: 20 },
  sectionHeader: { fontSize: 16, fontWeight: "800", color: "#1E2B24", marginBottom: 10 },
  quickGrid: { marginBottom: 14, flexDirection: "row", flexWrap: "wrap", gap: 10 },
  quickTile: {
    backgroundColor: "#fff",
    borderColor: "#D8E4DE",
    borderWidth: 1,
    padding: 12,
    borderRadius: 14,
    width: "31%",
    alignItems: "center",
    gap: 7
  },
  iconBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center"
  },
  quickTileTitle: { color: "#1E2B24", fontWeight: "700", fontSize: 13, textAlign: "center" },
  featuredRow: { paddingBottom: 4, gap: 10, marginBottom: 8 },
  featureCard: {
    width: 250,
    borderRadius: 20,
    padding: 14,
    borderWidth: 1
  },
  featureCardOne: { backgroundColor: "#F8FBFF", borderColor: "#D9E8FF" },
  featureCardTwo: { backgroundColor: "#F5FAF6", borderColor: "#D4E8D8" },
  featureCardThree: { backgroundColor: "#FFF9F2", borderColor: "#F2DEC0" },
  featurePill: {
    alignSelf: "flex-start",
    backgroundColor: "#fff",
    color: "#1E2B24",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    fontSize: 11,
    overflow: "hidden",
    marginBottom: 8,
    fontWeight: "700"
  },
  featureTitle: { fontSize: 18, fontWeight: "800", color: "#13251E" },
  featureCopy: { marginTop: 6, color: "#53635C", lineHeight: 18, fontWeight: "500" },
  sectionNav: { marginBottom: 10, marginTop: 2 },
  sectionNavRow: { flexDirection: "row", gap: 8 },
  sectionChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#D0D5DD",
    backgroundColor: "#fff"
  },
  sectionChipActive: { borderColor: "#1F7A4C", backgroundColor: "#E8F5EE" },
  sectionChipText: { color: "#344054", fontWeight: "600" },
  sectionChipTextActive: { color: "#1F7A4C", fontWeight: "700" },
  panel: { marginTop: 8 },
  panelTitle: { fontSize: 18, fontWeight: "800", color: "#1E2B24", marginBottom: 8 },
  metricsRow: { flexDirection: "row", gap: 8 },
  metricCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E4E7EC",
    padding: 12,
    alignItems: "center"
  },
  metricValue: { fontSize: 24, fontWeight: "800", color: "#1F7A4C" },
  metricLabel: { marginTop: 2, color: "#667085", fontWeight: "600", textAlign: "center", fontSize: 12 },
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
  metaStrong: { color: "#1E2B24", fontWeight: "700" },
  status: { marginTop: 8, fontWeight: "700", color: "#1F7A4C" },
  input: {
    marginTop: 8,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#D0D5DD",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10
  },
  inputTall: { minHeight: 90, textAlignVertical: "top" },
  rowWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  dayChip: {
    borderWidth: 1,
    borderColor: "#D0D5DD",
    borderRadius: 999,
    backgroundColor: "#fff",
    paddingHorizontal: 10,
    paddingVertical: 7
  },
  dayChipActive: { borderColor: "#1F7A4C", backgroundColor: "#E8F5EE" },
  dayChipText: { color: "#344054", fontWeight: "600" },
  dayChipTextActive: { color: "#1F7A4C" },
  primaryButton: {
    marginTop: 10,
    backgroundColor: "#1F7A4C",
    borderRadius: 10,
    alignItems: "center",
    paddingVertical: 11
  },
  disabledButton: { opacity: 0.5 },
  primaryButtonText: { color: "#fff", fontWeight: "700" },
  actions: { flexDirection: "row", gap: 10, marginTop: 10 },
  actionButton: { flex: 1, borderRadius: 10, paddingVertical: 10, alignItems: "center" },
  approveButton: { backgroundColor: "#1F7A4C" },
  rejectButton: { backgroundColor: "#B42318" },
  actionText: { color: "#fff", fontWeight: "700" },
  error: { color: "#B42318", marginBottom: 8 },
  empty: { color: "#667085", marginTop: 8 },
  logout: { marginTop: 14, padding: 12, alignItems: "center" },
  logoutText: { color: "#7A271A", fontWeight: "700" }
});
