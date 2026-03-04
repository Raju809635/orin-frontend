import React, { useCallback, useEffect, useMemo, useState } from "react";
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
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { notify } from "@/utils/notify";
import { FEATURE_FLAGS } from "@/constants/featureFlags";

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
  specificDate?: string | null;
};

type MentorProfilePayload = {
  title?: string;
  sessionPrice?: number;
  profilePhotoUrl?: string;
};

type NetworkPost = {
  _id: string;
  authorId?: { _id?: string; name?: string; role?: string } | null;
  content: string;
  postType: string;
  likeCount?: number;
  commentCount?: number;
  shareCount?: number;
  saveCount?: number;
};

type DailyTask = {
  key: string;
  title: string;
  completed: boolean;
};

type DailyDashboard = {
  tasks: DailyTask[];
  streakDays: number;
  xp: number;
  levelTag: string;
  reputationScore: number;
  leaderboard?: {
    globalRank?: number | null;
    collegeRank?: number | null;
  };
};

type SmartSuggestion = {
  id: string;
  name: string;
  role: "student" | "mentor";
  reason: string;
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

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

function toDateLabel(dateStr: string) {
  const dateObj = new Date(`${dateStr}T00:00:00.000Z`);
  const weekday = WEEKDAY_LABELS[dateObj.getUTCDay()];
  const day = String(dateObj.getUTCDate()).padStart(2, "0");
  const month = dateObj.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
  return `${weekday} ${day} ${month}`;
}

function toDayFromDate(dateStr: string): AvailabilitySlot["day"] {
  const dateObj = new Date(`${dateStr}T00:00:00.000Z`);
  return WEEKDAY_LABELS[dateObj.getUTCDay()] as AvailabilitySlot["day"];
}

function nextDates(days = 14) {
  const out: string[] = [];
  const now = new Date();
  now.setUTCHours(0, 0, 0, 0);
  for (let i = 0; i < days; i += 1) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() + i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

export default function MentorDashboard() {
  const router = useRouter();
  const params = useLocalSearchParams<{ section?: string }>();
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
  const [availabilityMode, setAvailabilityMode] = useState<"weekly" | "date">("weekly");
  const [calendarDate, setCalendarDate] = useState(nextDates(1)[0]);
  const [dateSpecificSlots, setDateSpecificSlots] = useState<AvailabilitySlot[]>([]);
  const [blockedDateList, setBlockedDateList] = useState<string[]>([]);
  const [blockingDate, setBlockingDate] = useState(false);
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
  const [searchQuery, setSearchQuery] = useState("");
  const [networkFeed, setNetworkFeed] = useState<NetworkPost[]>([]);
  const [dailyDashboard, setDailyDashboard] = useState<DailyDashboard | null>(null);
  const [completingTaskKey, setCompletingTaskKey] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<SmartSuggestion[]>([]);
  const calendarDateOptions = useMemo(() => nextDates(14), []);
  const mentorServices = [
    {
      key: "notifications",
      label: "Alerts",
      icon: "notifications",
      tint: "#C11574",
      bg: "#FCE7F6",
      border: "#FBCFE8",
      onPress: () => router.push("/notifications" as never)
    },
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
    },
    {
      key: "policy",
      label: "Mentor Policy",
      icon: "document-text",
      tint: "#9A3412",
      bg: "#FFF3ED",
      border: "#F7DCCB",
      onPress: () => router.push("/mentor-policy" as never)
    }
  ] as const;

  useEffect(() => {
    const section = String(params.section || "");
    if (section === "requests" || section === "sessions" || section === "pricing" || section === "availability" || section === "adminChat" || section === "overview") {
      setActiveSection(section);
    }
  }, [params.section]);
  const mentorDeepMaps = [
    {
      title: "Academic Mentoring Depth",
      icon: "school",
      tint: "#1D4ED8",
      bg: "#EEF4FF",
      sections: [
        {
          name: "Intermediate",
          tracks: [
            { name: "MPC", topics: ["Maths", "Physics", "Chemistry"] },
            { name: "BiPC", topics: ["Botany", "Zoology", "Physics", "Chemistry"] }
          ]
        },
        {
          name: "Engineering",
          tracks: [
            { name: "CSE", topics: ["DSA", "Web", "System Design"] },
            { name: "ECE", topics: ["Signals", "Embedded", "Communication"] }
          ]
        }
      ]
    },
    {
      title: "Exam Mentoring Depth",
      icon: "trophy",
      tint: "#B45309",
      bg: "#FFF7ED",
      sections: [
        {
          name: "UPSC",
          tracks: [
            { name: "Prelims", topics: ["Polity", "History", "Economy"] },
            { name: "Mains", topics: ["Geography", "Law", "Ethics", "Society"] }
          ]
        }
      ]
    }
  ] as const;
  const mentorBanners = [
    {
      key: "mentor-banner-ops",
      tag: "Operations",
      title: "Keep slots, price, and profile updated weekly",
      copy: "Students trust mentors with clear availability, clear pricing, and consistent communication.",
      bg: "#EEF4FF",
      border: "#D6E4FF"
    },
    {
      key: "mentor-banner-delivery",
      tag: "Delivery",
      title: "Share meet link near session time",
      copy: "Confirmed paid sessions become smoother when mentors update links on time.",
      bg: "#ECFDF3",
      border: "#CBECD9"
    },
    {
      key: "mentor-banner-policy",
      tag: "Policy",
      title: "Review mentor policy and payout terms",
      copy: "Use Mentor Policy and Admin Chat for commission and payout clarifications.",
      bg: "#FFF7ED",
      border: "#F7DCCB"
    }
  ] as const;
  const mentorFeedPreview = [
    {
      _id: "preview-mentor-post-1",
      authorId: { name: "Mentor Community" },
      content: "Share one real student win this week to build profile trust.",
      postType: "learning_progress",
      likeCount: 8,
      commentCount: 2,
      shareCount: 1,
      saveCount: 3
    },
    {
      _id: "preview-mentor-post-2",
      authorId: { name: "ORIN Team" },
      content: "Update your slots every weekend so students see current availability.",
      postType: "project_update",
      likeCount: 5,
      commentCount: 1,
      shareCount: 0,
      saveCount: 4
    }
  ] as const;
  const mentorSuggestionsPreview = [
    { id: "preview-1", name: "Ravi P", role: "student" as const, reason: "Student interested in your domain" },
    { id: "preview-2", name: "Neha S", role: "mentor" as const, reason: "Similar mentoring track" }
  ];

  const fetchDashboard = useCallback(async (refresh = false) => {
    try {
      if (refresh) setIsRefreshing(true);
      else setIsLoading(true);

      setError(null);
      const [bookingRes, sessionRes, profileRes, feedRes, dailyRes, suggestionsRes] = await Promise.allSettled([
        api.get<Booking[]>("/api/bookings/mentor"),
        api.get<Session[]>("/api/sessions/mentor/me"),
        api.get<{ profile?: MentorProfilePayload }>("/api/profiles/mentor/me"),
        FEATURE_FLAGS.networking ? api.get<NetworkPost[]>("/api/network/feed") : Promise.resolve({ data: [] as NetworkPost[] }),
        FEATURE_FLAGS.dailyEngagement
          ? api.get<DailyDashboard>("/api/network/daily-dashboard")
          : Promise.resolve({ data: null as DailyDashboard | null }),
        FEATURE_FLAGS.smartSuggestions
          ? api.get<SmartSuggestion[]>("/api/network/suggestions")
          : Promise.resolve({ data: [] as SmartSuggestion[] })
      ]);

      if (bookingRes.status !== "fulfilled" || sessionRes.status !== "fulfilled" || profileRes.status !== "fulfilled") {
        throw new Error("Failed to load required mentor dashboard data");
      }

      let adminMessages: AdminChatMessage[] = [];
      try {
        const chatRes = await api.get<{ messages: AdminChatMessage[] }>("/api/chat/messages/admin");
        adminMessages = chatRes.data.messages || [];
      } catch {
        adminMessages = [];
      }

      if (user?.id) {
        const availabilityRes = await api.get<{
          weeklySlots: AvailabilitySlot[];
          dateSlots?: AvailabilitySlot[];
          blockedDates?: Array<{ blockedDate?: string }>;
        }>(
          `/api/availability/mentor/${user.id}`
        );
        setAvailabilitySlots(availabilityRes.data.weeklySlots || []);
        setDateSpecificSlots(availabilityRes.data.dateSlots || []);
        setBlockedDateList(
          (availabilityRes.data.blockedDates || [])
            .map((item) => item?.blockedDate || "")
            .filter(Boolean)
        );
      }

      setBookings(bookingRes.value.data || []);
      setSessions(sessionRes.value.data || []);
      setMessages(adminMessages);
      setSessionPrice(String(Number(profileRes.value.data?.profile?.sessionPrice || 0) || 499));
      setMentorTitle(profileRes.value.data?.profile?.title || "");
      setProfilePhotoUrl(profileRes.value.data?.profile?.profilePhotoUrl || "");
      setNetworkFeed(feedRes.status === "fulfilled" ? feedRes.value.data || [] : []);
      setDailyDashboard(dailyRes.status === "fulfilled" ? dailyRes.value.data || null : null);
      setSuggestions(suggestionsRes.status === "fulfilled" ? suggestionsRes.value.data || [] : []);
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
  const hasLiveSuggestions = suggestions.length > 0;
  const totalSearchMatches = useMemo(
    () => filteredConfirmedPaidSessions.length + filteredBookings.length + filteredMessages.length,
    [filteredConfirmedPaidSessions.length, filteredBookings.length, filteredMessages.length]
  );
  const searchBreakdown = useMemo(() => {
    const parts: string[] = [];
    if (filteredConfirmedPaidSessions.length) parts.push(`Sessions (${filteredConfirmedPaidSessions.length})`);
    if (filteredBookings.length) parts.push(`Booking Requests (${filteredBookings.length})`);
    if (filteredMessages.length) parts.push(`Admin Chat (${filteredMessages.length})`);
    return parts.join(" | ");
  }, [filteredConfirmedPaidSessions.length, filteredBookings.length, filteredMessages.length]);

  useEffect(() => {
    if (!normalizedQuery) return;
    if (filteredConfirmedPaidSessions.length > 0 && activeSection !== "sessions") {
      setActiveSection("sessions");
      return;
    }
    if (filteredBookings.length > 0 && activeSection !== "requests") {
      setActiveSection("requests");
      return;
    }
    if (filteredMessages.length > 0 && activeSection !== "adminChat") {
      setActiveSection("adminChat");
    }
  }, [
    normalizedQuery,
    filteredConfirmedPaidSessions.length,
    filteredBookings.length,
    filteredMessages.length,
    activeSection
  ]);

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
        day: availabilityMode === "weekly" ? newSlotDay : toDayFromDate(calendarDate),
        specificDate: availabilityMode === "date" ? calendarDate : undefined,
        startTime: newSlotStartTime,
        endTime: newSlotEndTime,
        sessionDurationMinutes: newSlotDuration
      });
      notify(availabilityMode === "date" ? "Date availability slot added." : "Weekly availability slot added.");
      await fetchDashboard(true);
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to add availability slot.");
    } finally {
      setCreatingSlot(false);
    }
  }

  async function blockSelectedDate() {
    try {
      setBlockingDate(true);
      setError(null);
      await api.post("/api/availability/block-date", { blockedDate: calendarDate });
      notify("Date blocked successfully.");
      await fetchDashboard(true);
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to block date.");
    } finally {
      setBlockingDate(false);
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

  async function connectWithSuggestion(targetId: string) {
    try {
      await api.post("/api/network/connections/request", { recipientId: targetId });
      notify("Connection request sent.");
      await fetchDashboard(true);
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to send connection request.");
    }
  }

  async function followSuggestion(targetId: string) {
    try {
      const { data } = await api.post<{ following: boolean }>(`/api/network/follow/${targetId}`);
      notify(data?.following ? "Now following." : "Unfollowed.");
      await fetchDashboard(true);
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to update follow.");
    }
  }

  async function completeDailyTask(taskKey: string) {
    try {
      setCompletingTaskKey(taskKey);
      setError(null);
      const { data } = await api.post<{ message?: string; xpEarned?: number }>("/api/network/daily-task/complete", {
        taskKey
      });
      notify(data?.message || "Task completed.");
      await fetchDashboard(true);
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to complete daily task.");
    } finally {
      setCompletingTaskKey(null);
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
        <View style={styles.topRightWrap}>
          <TouchableOpacity style={styles.topIconBtn} onPress={() => router.push("/chat" as never)}>
            <Ionicons name="chatbubble-ellipses" size={18} color="#1E2B24" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.topIconBtn} onPress={() => router.push("/notifications" as never)}>
            <Ionicons name="notifications" size={18} color="#1E2B24" />
          </TouchableOpacity>
          <View style={styles.profileMenuWrap}>
          <TouchableOpacity style={styles.avatarButton} onPress={() => router.push("/my-profile" as never)}>
            {profilePhotoUrl ? (
              <Image source={{ uri: profilePhotoUrl }} style={styles.avatarImage} />
            ) : (
              <View style={[styles.avatarImage, styles.avatarFallback]}>
                <Text style={styles.avatarText}>{user.name?.charAt(0)?.toUpperCase() || "M"}</Text>
              </View>
            )}
          </TouchableOpacity>
          </View>
        </View>
      </View>

      <View style={styles.searchBox}>
        <Ionicons name="search" size={18} color="#667085" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search students, sessions or chat"
          placeholderTextColor="#98A2B3"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>
      {normalizedQuery ? (
        <>
          <Text style={styles.searchMeta}>
            {totalSearchMatches > 0
              ? `Search results: ${totalSearchMatches} match${totalSearchMatches > 1 ? "es" : ""}`
              : "No results for your search"}
          </Text>
          {totalSearchMatches > 0 ? <Text style={styles.searchMetaDetail}>Matched in: {searchBreakdown}</Text> : null}
        </>
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

      <Text style={styles.sectionHeader}>Live Banners</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.bannerRow}>
        {mentorBanners.map((banner) => (
          <View key={banner.key} style={[styles.bannerCard, { backgroundColor: banner.bg, borderColor: banner.border }]}>
            <Text style={styles.bannerTag}>{banner.tag}</Text>
            <Text style={styles.bannerTitle}>{banner.title}</Text>
            <Text style={styles.bannerCopy}>{banner.copy}</Text>
          </View>
        ))}
      </ScrollView>

      <Text style={styles.sectionHeader}>Deep Subsections</Text>
      <View style={styles.mentorMapWrap}>
        {mentorDeepMaps.map((map) => (
          <View key={map.title} style={[styles.mentorMapCard, { backgroundColor: map.bg, borderColor: `${map.tint}44` }]}>
            <View style={styles.mentorMapHead}>
              <View style={[styles.mentorMapIcon, { backgroundColor: `${map.tint}22` }]}>
                <Ionicons name={map.icon} size={16} color={map.tint} />
              </View>
              <Text style={[styles.mentorMapTitle, { color: map.tint }]}>{map.title}</Text>
            </View>
            {map.sections.map((section) => (
              <View key={`${map.title}-${section.name}`} style={styles.mentorMapSectionCard}>
                <Text style={styles.mentorMapSectionName}>{section.name}</Text>
                {section.tracks.map((track) => (
                  <View key={`${section.name}-${track.name}`} style={styles.mentorMapTrackRow}>
                    <Text style={styles.mentorMapTrackName}>{track.name}</Text>
                    <View style={styles.mentorMapTopicWrap}>
                      {track.topics.map((topic) => (
                        <Text key={`${track.name}-${topic}`} style={[styles.mentorMapTopicChip, { borderColor: `${map.tint}55` }]}>
                          {topic}
                        </Text>
                      ))}
                    </View>
                  </View>
                ))}
              </View>
            ))}
          </View>
        ))}
      </View>

      {FEATURE_FLAGS.networking ? (
        <>
          <Text style={styles.sectionHeader}>Mentor Network Feed</Text>
          <View style={styles.feedWrap}>
            {(networkFeed.length ? networkFeed : mentorFeedPreview).slice(0, 6).map((post) => (
              <View key={post._id} style={styles.feedCard}>
                <Text style={styles.feedAuthor}>{post.authorId?.name || "ORIN User"}</Text>
                <Text style={styles.feedLine}>{post.content}</Text>
                <Text style={styles.feedMeta}>
                  {post.postType} | Likes {post.likeCount || 0} | Comments {post.commentCount || 0}
                </Text>
                <View style={styles.feedActions}>
                  <Text style={styles.feedActionText}>Like</Text>
                  <Text style={styles.feedActionText}>Comment</Text>
                  <Text style={styles.feedActionText}>Share</Text>
                  <Text style={styles.feedActionText}>Save</Text>
                </View>
              </View>
            ))}
          </View>
        </>
      ) : null}`r`n      {FEATURE_FLAGS.dailyEngagement ? (
        <>
          <Text style={styles.sectionHeader}>Mentor Growth Dashboard</Text>
          <View style={styles.dailyCard}>
            {!dailyDashboard ? (
              <Text style={styles.empty}>Daily progress unavailable right now.</Text>
            ) : (
              <>
                <Text style={styles.dailyTitle}>Reputation Score: {dailyDashboard.reputationScore}</Text>
                <Text style={styles.dailyMeta}>Tag: {dailyDashboard.levelTag}</Text>
                {(dailyDashboard.tasks || []).map((task) => {
                  const inProgress = completingTaskKey === task.key;
                  return (
                    <View key={task.key} style={styles.dailyTaskRow}>
                      <Text style={styles.dailyItem}>
                        {task.completed ? "✓ " : "- "}
                        {task.title}
                      </Text>
                      <TouchableOpacity
                        style={[styles.dailyTaskButton, task.completed && styles.dailyTaskButtonDone]}
                        onPress={() => completeDailyTask(task.key)}
                        disabled={task.completed || inProgress}
                      >
                        <Text style={styles.dailyTaskButtonText}>
                          {task.completed ? "Done" : inProgress ? "..." : "Complete"}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}
                <Text style={styles.dailyMeta}>
                  Streak: {dailyDashboard.streakDays} days | XP: {dailyDashboard.xp}
                </Text>
                <Text style={styles.dailyMeta}>
                  Leaderboard: College #{dailyDashboard.leaderboard?.collegeRank ?? "-"} | Global #
                  {dailyDashboard.leaderboard?.globalRank ?? "-"}
                </Text>
              </>
            )}
          </View>
        </>
      ) : null}

      {FEATURE_FLAGS.smartSuggestions ? (
        <>
          <Text style={styles.sectionHeader}>People You May Know</Text>
          <View style={styles.suggestionWrap}>
            {(hasLiveSuggestions ? suggestions : mentorSuggestionsPreview).slice(0, 8).map((item, index) => (
              <View key={`${item.id}-${index}`} style={styles.suggestionCard}>
                <Text style={styles.suggestionName}>{item.name}</Text>
                <Text style={styles.suggestionReason}>{item.reason}</Text>
                <View style={styles.suggestionActions}>
                  <TouchableOpacity
                    onPress={() =>
                      hasLiveSuggestions ? connectWithSuggestion(item.id) : notify("Live suggestions will appear after more network activity.")
                    }
                  >
                    <Text style={styles.suggestionAction}>Connect</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() =>
                      hasLiveSuggestions ? followSuggestion(item.id) : notify("Live suggestions will appear after more network activity.")
                    }
                  >
                    <Text style={styles.suggestionAction}>Follow</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        </>
      ) : null}

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
        <View style={[styles.panel, styles.panelOverview]}>
          <Text style={[styles.panelTitle, styles.panelTitleOverview]}>Overview</Text>
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
        <View style={[styles.panel, styles.panelPricing]}>
          <Text style={[styles.panelTitle, styles.panelTitlePricing]}>Profile & Pricing</Text>
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
        <View style={[styles.panel, styles.panelAvailability]}>
          <Text style={[styles.panelTitle, styles.panelTitleAvailability]}>Calendar Availability</Text>
          <Text style={styles.meta}>Set recurring weekly slots or exact date-time slots for the next 14 days.</Text>

          <View style={styles.rowWrap}>
            <TouchableOpacity
              style={[styles.dayChip, availabilityMode === "weekly" && styles.dayChipActive]}
              onPress={() => setAvailabilityMode("weekly")}
            >
              <Text style={[styles.dayChipText, availabilityMode === "weekly" && styles.dayChipTextActive]}>
                Weekly
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.dayChip, availabilityMode === "date" && styles.dayChipActive]}
              onPress={() => setAvailabilityMode("date")}
            >
              <Text style={[styles.dayChipText, availabilityMode === "date" && styles.dayChipTextActive]}>
                Specific Date
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dateStrip}>
            {calendarDateOptions.map((date) => {
              const active = calendarDate === date;
              const isBlocked = blockedDateList.includes(date);
              return (
                <TouchableOpacity
                  key={date}
                  style={[styles.dateChip, active && styles.dateChipActive, isBlocked && styles.dateChipBlocked]}
                  onPress={() => setCalendarDate(date)}
                >
                  <Text style={[styles.dateChipText, active && styles.dateChipTextActive]}>{toDateLabel(date)}</Text>
                  {isBlocked ? <Text style={styles.dateChipBlockedText}>Blocked</Text> : null}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <Text style={styles.meta}>
            Selected Date: {toDateLabel(calendarDate)} ({toDayFromDate(calendarDate)})
          </Text>

          {availabilityMode === "weekly" ? (
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
          ) : null}
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
            <Text style={styles.primaryButtonText}>
              {creatingSlot ? "Saving..." : availabilityMode === "date" ? "Add Date Slot" : "Add Weekly Slot"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.secondaryButton, blockingDate && styles.disabledButton]}
            onPress={blockSelectedDate}
            disabled={blockingDate}
          >
            <Text style={styles.secondaryButtonText}>{blockingDate ? "Blocking..." : "Block Selected Date"}</Text>
          </TouchableOpacity>

          {availabilitySlots.length === 0 ? (
            <Text style={styles.empty}>No weekly availability slots set yet.</Text>
          ) : (
            <>
              <Text style={styles.metaStrong}>Weekly Slots</Text>
              {availabilitySlots.map((slot) => (
                <Text key={slot._id} style={styles.meta}>
                  {slot.day}: {slot.startTime} - {slot.endTime} ({slot.sessionDurationMinutes} min)
                </Text>
              ))}
            </>
          )}
          {dateSpecificSlots.length > 0 ? (
            <>
              <Text style={styles.metaStrong}>Date-Specific Slots</Text>
              {dateSpecificSlots.map((slot) => (
                <Text key={slot._id} style={styles.meta}>
                  {slot.specificDate} ({slot.day}): {slot.startTime} - {slot.endTime} ({slot.sessionDurationMinutes} min)
                </Text>
              ))}
            </>
          ) : null}
        </View>
      ) : null}

      {!isLoading && activeSection === "sessions" ? (
        <View style={[styles.panel, styles.panelSessions]}>
          <Text style={[styles.panelTitle, styles.panelTitleSessions]}>Confirmed Paid Sessions</Text>
          {filteredConfirmedPaidSessions.length === 0 ? (
            <Text style={styles.empty}>No confirmed sessions yet.</Text>
          ) : (
            filteredConfirmedPaidSessions.map((session) => (
              <View key={session._id} style={[styles.card, styles.cardSessions]}>
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
        <View style={[styles.panel, styles.panelRequests]}>
          <Text style={[styles.panelTitle, styles.panelTitleRequests]}>Booking Requests</Text>
          {filteredBookings.length === 0 ? (
            <Text style={styles.empty}>No booking requests yet.</Text>
          ) : (
            filteredBookings.map((booking) => (
              <View key={booking._id} style={[styles.card, styles.cardRequests]}>
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
        <View style={[styles.panel, styles.panelAdminChat]}>
          <Text style={[styles.panelTitle, styles.panelTitleAdminChat]}>Admin Chat</Text>
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
              <View key={msg._id} style={[styles.card, styles.cardAdminChat]}>
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
  topRightWrap: { flexDirection: "row", alignItems: "center", gap: 8 },
  topIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D0D5DD",
    alignItems: "center",
    justifyContent: "center"
  },
  profileMenuWrap: { alignItems: "flex-end", position: "relative", zIndex: 2 },
  avatarButton: { width: 48, height: 48, borderRadius: 24, overflow: "hidden", borderWidth: 2, borderColor: "#CFE4D8" },
  avatarImage: { width: "100%", height: "100%" },
  avatarFallback: { alignItems: "center", justifyContent: "center", backgroundColor: "#E8F5EE" },
  avatarText: { color: "#0B3D2E", fontWeight: "700", fontSize: 18 },
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
    marginBottom: 3,
    color: "#475467",
    fontWeight: "600",
    fontSize: 12
  },
  searchMetaDetail: {
    marginBottom: 10,
    color: "#344054",
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
  bannerRow: { gap: 10, marginBottom: 10 },
  bannerCard: {
    width: 258,
    borderWidth: 1,
    borderRadius: 16,
    padding: 12
  },
  bannerTag: {
    alignSelf: "flex-start",
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    color: "#1E2B24",
    fontWeight: "700",
    fontSize: 11,
    paddingHorizontal: 9,
    paddingVertical: 4,
    overflow: "hidden",
    marginBottom: 8
  },
  bannerTitle: { fontSize: 16, color: "#13251E", fontWeight: "800", lineHeight: 20 },
  bannerCopy: { marginTop: 6, color: "#53635C", lineHeight: 18, fontWeight: "500" },
  mentorMapWrap: { gap: 10, marginBottom: 8 },
  mentorMapCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12
  },
  mentorMapHead: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  mentorMapIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8
  },
  mentorMapTitle: { fontSize: 15, fontWeight: "800" },
  mentorMapSectionCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    padding: 9,
    marginTop: 8
  },
  mentorMapSectionName: { color: "#1E2B24", fontWeight: "800", fontSize: 13 },
  mentorMapTrackRow: { marginTop: 7 },
  mentorMapTrackName: { color: "#344054", fontWeight: "700", fontSize: 12 },
  mentorMapTopicWrap: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 5 },
  mentorMapTopicChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 11,
    color: "#475467",
    backgroundColor: "#FFFFFF",
    overflow: "hidden"
  },
  feedWrap: { gap: 9, marginBottom: 10 },
  feedCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D8E4DE",
    borderRadius: 12,
    padding: 11
  },
  feedAuthor: { color: "#1E2B24", fontWeight: "800" },
  feedLine: { marginTop: 5, color: "#344054", lineHeight: 19 },
  feedMeta: { marginTop: 4, color: "#667085", fontSize: 12, fontWeight: "600" },
  feedActions: { marginTop: 8, flexDirection: "row", gap: 12 },
  feedActionText: { color: "#175CD3", fontWeight: "700", fontSize: 12 },
  dailyCard: {
    backgroundColor: "#EEF4FF",
    borderWidth: 1,
    borderColor: "#D6E4FF",
    borderRadius: 13,
    padding: 12,
    marginBottom: 10
  },
  dailyTitle: { color: "#1849A9", fontWeight: "800", marginBottom: 6 },
  dailyItem: { color: "#344054", marginBottom: 3, fontWeight: "500" },
  dailyTaskRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6, gap: 8 },
  dailyTaskButton: { backgroundColor: "#175CD3", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  dailyTaskButtonDone: { backgroundColor: "#12B76A" },
  dailyTaskButtonText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  dailyMeta: { marginTop: 6, color: "#475467", fontWeight: "600", fontSize: 12 },
  suggestionWrap: { gap: 9, marginBottom: 10 },
  suggestionCard: {
    backgroundColor: "#F5F3FF",
    borderWidth: 1,
    borderColor: "#DED8FF",
    borderRadius: 12,
    padding: 11
  },
  suggestionName: { color: "#1E2B24", fontWeight: "800" },
  suggestionReason: { marginTop: 4, color: "#667085" },
  suggestionActions: { marginTop: 8, flexDirection: "row", gap: 12 },
  suggestionAction: { color: "#5925DC", fontWeight: "700", fontSize: 12 },
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
  panel: { marginTop: 8, borderRadius: 14, padding: 12, borderWidth: 1 },
  panelOverview: { backgroundColor: "#EFF8FF", borderColor: "#CFE3F6" },
  panelPricing: { backgroundColor: "#FFF7ED", borderColor: "#F7D8B3" },
  panelAvailability: { backgroundColor: "#ECFDF3", borderColor: "#CBECD9" },
  panelSessions: { backgroundColor: "#EEF4FF", borderColor: "#D4E2FF" },
  panelRequests: { backgroundColor: "#FDF2FA", borderColor: "#F7D0E8" },
  panelAdminChat: { backgroundColor: "#F5F3FF", borderColor: "#DED8FF" },
  panelTitle: { fontSize: 18, fontWeight: "800", color: "#1E2B24", marginBottom: 8 },
  panelTitleOverview: { color: "#175CD3" },
  panelTitlePricing: { color: "#B54708" },
  panelTitleAvailability: { color: "#067647" },
  panelTitleSessions: { color: "#1849A9" },
  panelTitleRequests: { color: "#C11574" },
  panelTitleAdminChat: { color: "#5925DC" },
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
  cardSessions: { backgroundColor: "#F8FAFF", borderColor: "#DCE7FF" },
  cardRequests: { backgroundColor: "#FFF9FC", borderColor: "#F8DCEE" },
  cardAdminChat: { backgroundColor: "#FBFAFF", borderColor: "#E5E0FF" },
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
  dateStrip: { gap: 8, marginTop: 10, paddingRight: 10 },
  dateChip: {
    borderWidth: 1,
    borderColor: "#D0D5DD",
    borderRadius: 12,
    backgroundColor: "#fff",
    paddingHorizontal: 10,
    paddingVertical: 8,
    minWidth: 92
  },
  dateChipActive: { borderColor: "#1F7A4C", backgroundColor: "#E8F5EE" },
  dateChipBlocked: { borderColor: "#F04438", backgroundColor: "#FFF1F3" },
  dateChipText: { color: "#344054", fontWeight: "600", fontSize: 12 },
  dateChipTextActive: { color: "#1F7A4C" },
  dateChipBlockedText: { marginTop: 3, color: "#B42318", fontSize: 10, fontWeight: "700" },
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
  secondaryButton: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#B42318",
    backgroundColor: "#FFF5F6",
    borderRadius: 10,
    alignItems: "center",
    paddingVertical: 10
  },
  secondaryButtonText: { color: "#B42318", fontWeight: "700" },
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

