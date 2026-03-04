import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
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
import { submitManualPaymentWithPicker } from "@/utils/manualPaymentUpload";
import { FEATURE_FLAGS } from "@/constants/featureFlags";

type Booking = {
  _id: string;
  scheduledAt: string;
  status: "pending" | "approved" | "rejected";
  mentor?: {
    name: string;
    email: string;
  };
};

type Session = {
  _id: string;
  date: string;
  time: string;
  amount: number;
  currency?: string;
  paymentMode?: "manual" | "razorpay";
  paymentStatus: "pending" | "waiting_verification" | "verified" | "rejected" | "paid";
  paymentRejectReason?: string;
  paymentDueAt?: string | null;
  sessionStatus: "booked" | "confirmed" | "completed";
  status?: "pending" | "payment_pending" | "confirmed" | "approved" | "completed" | "cancelled" | "rejected";
  meetingLink?: string;
  mentorId?: {
    _id?: string;
    name?: string;
    email?: string;
  };
  paymentInstructions?: {
    upiId: string;
    qrImageUrl: string;
    amount: number;
    currency: string;
    dueAt?: string | null;
  } | null;
};

type NetworkPost = {
  _id: string;
  authorId?: { name?: string; role?: string } | null;
  content: string;
  postType: string;
  domainTags?: string[];
  likeCount?: number;
  commentCount?: number;
  shareCount?: number;
  saveCount?: number;
};

type DailyTask = {
  key: string;
  title: string;
  xp: number;
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

export default function StudentDashboard() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [transactionRefBySession, setTransactionRefBySession] = useState<Record<string, string>>({});
  const [submittingBySession, setSubmittingBySession] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profilePhotoUrl, setProfilePhotoUrl] = useState("");
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [networkFeed, setNetworkFeed] = useState<NetworkPost[]>([]);
  const [dailyDashboard, setDailyDashboard] = useState<DailyDashboard | null>(null);
  const [suggestions, setSuggestions] = useState<SmartSuggestion[]>([]);
  const quickServices = [
    {
      key: "mentors",
      label: "Mentors",
      icon: "people",
      tint: "#165DFF",
      bg: "#EAF2FF",
      border: "#D7E6FF",
      onPress: () => router.push("/domains")
    },
    {
      key: "messages",
      label: "Messages",
      icon: "chatbubble-ellipses",
      tint: "#0F766E",
      bg: "#E7F9F6",
      border: "#CDEEE8",
      onPress: () => router.push("/chat" as never)
    },
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
      label: "AI Coach",
      icon: "sparkles",
      tint: "#7C3AED",
      bg: "#F0E9FF",
      border: "#E1D5FF",
      onPress: () => router.push("/ai-assistant" as never)
    },
    {
      key: "profile",
      label: "Profile",
      icon: "person-circle",
      tint: "#0369A1",
      bg: "#E8F5FF",
      border: "#D3EAFA",
      onPress: () => router.push("/student-profile" as never)
    },
    {
      key: "domain-guide",
      label: "Domain Guide",
      icon: "book",
      tint: "#1F7A4C",
      bg: "#E7F5EE",
      border: "#D5E9DB",
      onPress: () => router.push("/domain-guide" as never)
    },
    {
      key: "support",
      label: "Support",
      icon: "help-buoy",
      tint: "#B45309",
      bg: "#FFF4E5",
      border: "#F8E2C2",
      onPress: () => router.push("/complaints" as never)
    },
    {
      key: "settings",
      label: "Settings",
      icon: "settings",
      tint: "#475467",
      bg: "#EEF2F6",
      border: "#DCE3EA",
      onPress: () => router.push("/settings" as never)
    }
  ] as const;
  const domainHighlights = [
    { name: "Academic", icon: "school", color: "#2563EB", note: "School, Intermediate, Engineering, MBA, Law" },
    { name: "Competitive Exams", icon: "trophy", color: "#B45309", note: "JEE, NEET, UPSC, SSC, TGPSC, Banking" },
    { name: "Technology & AI", icon: "hardware-chip", color: "#0369A1", note: "Web, Data Science, AI/ML tracks" },
    { name: "Career & Placements", icon: "briefcase", color: "#9333EA", note: "Resume, Interviews, Roadmaps" }
  ] as const;
  const studentBanners = [
    {
      key: "banner-growth",
      tag: "Growth",
      title: "Track progress with confirmed sessions",
      copy: "Use pending, verification, and confirmed cards to stay on top of every booking.",
      bg: "#EEF4FF",
      border: "#D6E4FF"
    },
    {
      key: "banner-policy",
      tag: "Policy",
      title: "Pay only through official ORIN flow",
      copy: "Upload payment proof in-app and wait for admin verification before session confirmation.",
      bg: "#FFF7ED",
      border: "#F7DCCB"
    },
    {
      key: "banner-support",
      tag: "Support",
      title: "Use notifications for real-time updates",
      copy: "Payment verification, session confirmations, and mentor actions are pushed to your alerts page.",
      bg: "#ECFDF3",
      border: "#CBECD9"
    }
  ] as const;
  const deepDomainMaps = [
    {
      title: "Academic",
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
        }
      ]
    },
    {
      title: "Competitive Exams",
      icon: "trophy",
      tint: "#B45309",
      bg: "#FFF7ED",
      sections: [
        {
          name: "UPSC",
          tracks: [
            { name: "Prelims", topics: ["Polity", "History", "Economy", "Current Affairs"] },
            { name: "Mains", topics: ["Geography", "Law", "Ethics", "Society", "IR"] }
          ]
        }
      ]
    }
  ] as const;
  const networkFeedPreview = [
    {
      id: "post-1",
      author: "Ananya R",
      line: "Completed a ML mini-project on student performance prediction.",
      meta: "Same domain · AI/ML"
    },
    {
      id: "post-2",
      author: "Karthik S",
      line: "Got shortlisted for internship after mentor mock interview practice.",
      meta: "Mentor network · Career"
    }
  ] as const;
  const dailyTasksPreview = [
    "Solve 1 coding problem",
    "Read 1 career tip",
    "Update 1 resume bullet",
    "Explore 1 domain concept"
  ] as const;
  const smartSuggestions = [
    { name: "Sneha P", reason: "Same college · Data Science" },
    { name: "Rahul M", reason: "Mutual mentor connection" },
    { name: "Aditi K", reason: "Similar project interests" }
  ] as const;

  const fetchDashboard = useCallback(async (refresh = false) => {
    try {
      if (refresh) setIsRefreshing(true);
      else setIsLoading(true);

      setError(null);
      const [bookingsRes, sessionsRes, profileRes, feedRes, dailyRes, suggestionsRes] = await Promise.allSettled([
        api.get<Booking[]>("/api/bookings/student"),
        api.get<Session[]>("/api/sessions/student/me"),
        api.get<{ profile?: { profilePhotoUrl?: string } }>("/api/profiles/student/me"),
        FEATURE_FLAGS.networking ? api.get<NetworkPost[]>("/api/network/feed") : Promise.resolve({ data: [] as NetworkPost[] }),
        FEATURE_FLAGS.dailyEngagement
          ? api.get<DailyDashboard>("/api/network/daily-dashboard")
          : Promise.resolve({ data: null as DailyDashboard | null }),
        FEATURE_FLAGS.smartSuggestions
          ? api.get<SmartSuggestion[]>("/api/network/suggestions")
          : Promise.resolve({ data: [] as SmartSuggestion[] })
      ]);

      if (bookingsRes.status !== "fulfilled" || sessionsRes.status !== "fulfilled" || profileRes.status !== "fulfilled") {
        throw new Error("Failed to load required dashboard data");
      }

      setBookings(bookingsRes.value.data || []);
      setSessions(sessionsRes.value.data || []);
      setProfilePhotoUrl(profileRes.value.data?.profile?.profilePhotoUrl || "");
      setNetworkFeed(feedRes.status === "fulfilled" ? feedRes.value.data || [] : []);
      setDailyDashboard(dailyRes.status === "fulfilled" ? dailyRes.value.data || null : null);
      setSuggestions(suggestionsRes.status === "fulfilled" ? suggestionsRes.value.data || [] : []);
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to load your dashboard.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchDashboard();
    }, [fetchDashboard])
  );

  const pendingPaymentSessions = useMemo(
    () =>
      sessions.filter(
        (session) =>
          session.paymentMode === "manual" &&
          session.status !== "cancelled" &&
          (session.paymentStatus === "pending" || session.paymentStatus === "rejected")
      ),
    [sessions]
  );

  const waitingVerificationSessions = useMemo(
    () =>
      sessions.filter(
        (session) =>
          session.paymentMode === "manual" &&
          session.status !== "cancelled" &&
          session.paymentStatus === "waiting_verification"
      ),
    [sessions]
  );

  const confirmedSessions = useMemo(
    () =>
      sessions.filter(
        (session) =>
          (session.paymentStatus === "paid" || session.paymentStatus === "verified") &&
          session.sessionStatus === "confirmed"
      ),
    [sessions]
  );

  const filteredPendingPaymentSessions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return pendingPaymentSessions;
    return pendingPaymentSessions.filter((session) => {
      const mentorName = (session.mentorId?.name || "").toLowerCase();
      const mentorEmail = (session.mentorId?.email || "").toLowerCase();
      const date = (session.date || "").toLowerCase();
      const time = (session.time || "").toLowerCase();
      const paymentStatus = (session.paymentStatus || "").toLowerCase();
      const sessionStatus = (session.status || "").toLowerCase();
      return (
        mentorName.includes(query) ||
        mentorEmail.includes(query) ||
        date.includes(query) ||
        time.includes(query) ||
        paymentStatus.includes(query) ||
        sessionStatus.includes(query)
      );
    });
  }, [pendingPaymentSessions, searchQuery]);

  const filteredWaitingVerificationSessions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return waitingVerificationSessions;
    return waitingVerificationSessions.filter((session) => {
      const mentorName = (session.mentorId?.name || "").toLowerCase();
      const mentorEmail = (session.mentorId?.email || "").toLowerCase();
      const date = (session.date || "").toLowerCase();
      const time = (session.time || "").toLowerCase();
      const paymentStatus = (session.paymentStatus || "").toLowerCase();
      return (
        mentorName.includes(query) ||
        mentorEmail.includes(query) ||
        date.includes(query) ||
        time.includes(query) ||
        paymentStatus.includes(query)
      );
    });
  }, [waitingVerificationSessions, searchQuery]);

  const filteredConfirmedSessions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return confirmedSessions;
    return confirmedSessions.filter((session) => {
      const mentorName = (session.mentorId?.name || "").toLowerCase();
      const mentorEmail = (session.mentorId?.email || "").toLowerCase();
      const date = (session.date || "").toLowerCase();
      const time = (session.time || "").toLowerCase();
      const paymentStatus = (session.paymentStatus || "").toLowerCase();
      const sessionStatus = (session.sessionStatus || "").toLowerCase();
      return (
        mentorName.includes(query) ||
        mentorEmail.includes(query) ||
        date.includes(query) ||
        time.includes(query) ||
        paymentStatus.includes(query) ||
        sessionStatus.includes(query)
      );
    });
  }, [confirmedSessions, searchQuery]);

  const filteredBookings = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return bookings;
    return bookings.filter((booking) => {
      const mentorName = (booking.mentor?.name || "").toLowerCase();
      const mentorEmail = (booking.mentor?.email || "").toLowerCase();
      const scheduledAt = new Date(booking.scheduledAt).toLocaleString().toLowerCase();
      const status = (booking.status || "").toLowerCase();
      return (
        mentorName.includes(query) ||
        mentorEmail.includes(query) ||
        status.includes(query) ||
        scheduledAt.includes(query)
      );
    });
  }, [bookings, searchQuery]);

  const normalizedQuery = searchQuery.trim();
  const totalSearchMatches = useMemo(
    () =>
      filteredPendingPaymentSessions.length +
      filteredWaitingVerificationSessions.length +
      filteredConfirmedSessions.length +
      filteredBookings.length,
    [
      filteredPendingPaymentSessions.length,
      filteredWaitingVerificationSessions.length,
      filteredConfirmedSessions.length,
      filteredBookings.length
    ]
  );
  const searchBreakdown = useMemo(() => {
    const parts: string[] = [];
    if (filteredPendingPaymentSessions.length) parts.push(`Pending Payments (${filteredPendingPaymentSessions.length})`);
    if (filteredWaitingVerificationSessions.length) parts.push(`Awaiting Verification (${filteredWaitingVerificationSessions.length})`);
    if (filteredConfirmedSessions.length) parts.push(`Confirmed Sessions (${filteredConfirmedSessions.length})`);
    if (filteredBookings.length) parts.push(`Legacy Requests (${filteredBookings.length})`);
    return parts.join(" | ");
  }, [
    filteredPendingPaymentSessions.length,
    filteredWaitingVerificationSessions.length,
    filteredConfirmedSessions.length,
    filteredBookings.length
  ]);

  async function submitManualProof(session: Session) {
    const transactionReference = (transactionRefBySession[session._id] || "").trim();

    try {
      setSubmittingBySession((prev) => ({ ...prev, [session._id]: true }));
      setError(null);
      const result = await submitManualPaymentWithPicker(session._id, transactionReference);
      if (result.cancelled) {
        setSubmittingBySession((prev) => ({ ...prev, [session._id]: false }));
        return;
      }
      notify("Payment submitted. Awaiting admin verification.");
      setTransactionRefBySession((prev) => ({ ...prev, [session._id]: "" }));
      await fetchDashboard(true);
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to submit payment proof.");
    } finally {
      setSubmittingBySession((prev) => ({ ...prev, [session._id]: false }));
    }
  }

  function cancelPendingSession(session: Session) {
    Alert.alert(
      "Cancel session?",
      "You can cancel this pending payment session now. This action cannot be undone.",
      [
        { text: "Keep", style: "cancel" },
        {
          text: "Cancel Session",
          style: "destructive",
          onPress: async () => {
            try {
              setSubmittingBySession((prev) => ({ ...prev, [session._id]: true }));
              setError(null);
              await api.patch(`/api/sessions/${session._id}/cancel`);
              notify("Session cancelled.");
              await fetchDashboard(true);
            } catch (e: any) {
              setError(e?.response?.data?.message || "Failed to cancel session.");
            } finally {
              setSubmittingBySession((prev) => ({ ...prev, [session._id]: false }));
            }
          }
        }
      ]
    );
  }

  if (user?.role !== "student") {
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
          <Text style={styles.heading}>Home</Text>
          <Text style={styles.subheading}>Welcome back, {user.name}</Text>
        </View>
        <View style={styles.profileMenuWrap}>
          <TouchableOpacity style={styles.avatarButton} onPress={() => setShowProfileMenu((prev) => !prev)}>
            {profilePhotoUrl ? (
              <Image source={{ uri: profilePhotoUrl }} style={styles.avatarImage} />
            ) : (
              <View style={[styles.avatarImage, styles.avatarFallback]}>
                <Text style={styles.avatarText}>{user.name?.charAt(0)?.toUpperCase() || "S"}</Text>
              </View>
            )}
          </TouchableOpacity>
          {showProfileMenu ? (
            <View style={styles.profileMenuCard}>
              <TouchableOpacity onPress={() => router.push("/student-profile" as never)}>
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
          placeholder="Search mentors, dates or sessions"
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
        <Text style={styles.heroEyebrow}>Student Space</Text>
        <Text style={styles.heroTitle}>Unlock Your Mentorship Journey</Text>
        <Text style={styles.heroSubTitle}>Explore mentors, track sessions, and grow faster with ORIN.</Text>
      </View>

      <Text style={styles.sectionHeader}>Services</Text>
      <View style={styles.sectionGrid}>
        {quickServices.map((item) => (
          <TouchableOpacity key={item.key} style={[styles.sectionTile, { borderColor: item.border }]} onPress={item.onPress}>
            <View style={[styles.iconBadge, { backgroundColor: item.bg }]}>
              <Ionicons name={item.icon} size={18} color={item.tint} />
            </View>
            <Text style={styles.sectionTileTitle}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.sectionHeader}>Featured</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.featuredRow}>
        <TouchableOpacity style={[styles.featureCard, styles.featureCardOne]} onPress={() => router.push("/domains")}>
          <Text style={styles.featurePill}>Discover</Text>
          <Text style={styles.featureTitle}>Top Mentor Domains</Text>
          <Text style={styles.featureCopy}>Browse all approved mentors by category and specialization.</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.featureCard, styles.featureCardTwo]} onPress={() => router.push("/chat" as never)}>
          <Text style={styles.featurePill}>Connect</Text>
          <Text style={styles.featureTitle}>Session Conversations</Text>
          <Text style={styles.featureCopy}>Message confirmed mentors and prepare before live sessions.</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.featureCard, styles.featureCardThree]} onPress={() => router.push("/ai-assistant" as never)}>
          <Text style={styles.featurePill}>Boost</Text>
          <Text style={styles.featureTitle}>AI Career Coach</Text>
          <Text style={styles.featureCopy}>Get study plans, interview prep ideas, and guidance instantly.</Text>
        </TouchableOpacity>
      </ScrollView>

      <Text style={styles.sectionHeader}>Live Banners</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.bannerRow}>
        {studentBanners.map((banner) => (
          <View key={banner.key} style={[styles.bannerCard, { backgroundColor: banner.bg, borderColor: banner.border }]}>
            <Text style={styles.bannerTag}>{banner.tag}</Text>
            <Text style={styles.bannerTitle}>{banner.title}</Text>
            <Text style={styles.bannerCopy}>{banner.copy}</Text>
          </View>
        ))}
      </ScrollView>

      <Text style={styles.sectionHeader}>Domain Guide</Text>
      <View style={styles.domainGuideInlineCard}>
        <Text style={styles.domainGuideIntro}>
          Understand every domain, sub-domain, and what to choose based on your goal.
        </Text>
        <View style={styles.domainMiniGrid}>
          {domainHighlights.map((item) => (
            <View key={item.name} style={styles.domainMiniTile}>
              <View style={[styles.domainMiniIcon, { backgroundColor: `${item.color}22` }]}>
                <Ionicons name={item.icon} size={16} color={item.color} />
              </View>
              <Text style={styles.domainMiniTitle}>{item.name}</Text>
              <Text style={styles.domainMiniNote}>{item.note}</Text>
            </View>
          ))}
        </View>
        <TouchableOpacity style={styles.domainGuideButton} onPress={() => router.push("/domain-guide" as never)}>
          <Text style={styles.domainGuideButtonText}>Open Full Domain Guide</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionHeader}>Deep Subsections</Text>
      <View style={styles.deepMapWrap}>
        {deepDomainMaps.map((map) => (
          <View key={map.title} style={[styles.deepMapCard, { backgroundColor: map.bg, borderColor: `${map.tint}44` }]}>
            <View style={styles.deepMapHead}>
              <View style={[styles.deepMapIcon, { backgroundColor: `${map.tint}22` }]}>
                <Ionicons name={map.icon} size={16} color={map.tint} />
              </View>
              <Text style={[styles.deepMapTitle, { color: map.tint }]}>{map.title}</Text>
            </View>
            {map.sections.map((section) => (
              <View key={`${map.title}-${section.name}`} style={styles.deepSectionCard}>
                <Text style={styles.deepSectionName}>{section.name}</Text>
                {section.tracks.map((track) => (
                  <View key={`${section.name}-${track.name}`} style={styles.deepTrackRow}>
                    <Text style={styles.deepTrackName}>{track.name}</Text>
                    <View style={styles.deepTopicWrap}>
                      {track.topics.map((topic) => (
                        <Text key={`${track.name}-${topic}`} style={[styles.deepTopicChip, { borderColor: `${map.tint}55` }]}>
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
          <Text style={styles.sectionHeader}>Network Activity Feed</Text>
          <View style={styles.feedWrap}>
            {(networkFeed.length ? networkFeed : networkFeedPreview).map((post) => (
              <View key={"_id" in post ? post._id : post.id} style={styles.feedCard}>
                <Text style={styles.feedAuthor}>
                  {"authorId" in post ? post.authorId?.name || "ORIN User" : (post as any).author}
                </Text>
                <Text style={styles.feedLine}>{"content" in post ? post.content : (post as any).line}</Text>
                <Text style={styles.feedMeta}>
                  {"postType" in post
                    ? `${post.postType} | Likes ${post.likeCount || 0} | Comments ${post.commentCount || 0}`
                    : (post as any).meta}
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
      ) : null}

      {FEATURE_FLAGS.dailyEngagement ? (
        <>
          <Text style={styles.sectionHeader}>Daily Career Dashboard</Text>
          <View style={styles.dailyCard}>
            <Text style={styles.dailyTitle}>Today&apos;s Tasks</Text>
            {(dailyDashboard?.tasks || dailyTasksPreview.map((item, index) => ({
              key: `preview-${index}`,
              title: item,
              xp: 0,
              completed: false
            }))).map((task) => (
              <Text key={task.key} style={styles.dailyItem}>
                {task.completed ? "✓ " : "- "}
                {task.title}
              </Text>
            ))}
            <Text style={styles.dailyMeta}>
              Streak: {dailyDashboard?.streakDays ?? 3} days | XP: {dailyDashboard?.xp ?? 120} | Tag: {dailyDashboard?.levelTag ?? "Starter"}
            </Text>
            <Text style={styles.dailyMeta}>
              Leaderboard: College #{dailyDashboard?.leaderboard?.collegeRank ?? 12} | Global #{dailyDashboard?.leaderboard?.globalRank ?? 248}
            </Text>
          </View>
        </>
      ) : null}

      {FEATURE_FLAGS.smartSuggestions ? (
        <>
          <Text style={styles.sectionHeader}>People You May Know</Text>
          <View style={styles.suggestionWrap}>
            {(suggestions.length ? suggestions : smartSuggestions).map((item, index) => (
              <View key={`${item.name}-${index}`} style={styles.suggestionCard}>
                <Text style={styles.suggestionName}>{item.name}</Text>
                <Text style={styles.suggestionReason}>{item.reason}</Text>
                <View style={styles.suggestionActions}>
                  <Text style={styles.suggestionAction}>Connect</Text>
                  <Text style={styles.suggestionAction}>Follow</Text>
                </View>
              </View>
            ))}
          </View>
        </>
      ) : null}

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#1F7A4C" />
        </View>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {!isLoading ? (
        <>
          <View style={styles.panel}>
            <Text style={[styles.panelTitle, styles.panelTitlePending]}>Pending Payments</Text>
            {filteredPendingPaymentSessions.length === 0 ? (
              <Text style={styles.empty}>No pending manual payments.</Text>
            ) : (
              filteredPendingPaymentSessions.map((session) => {
                const instructions = session.paymentInstructions;
                const isSubmitting = Boolean(submittingBySession[session._id]);
                return (
                  <View key={session._id} style={[styles.card, styles.cardPending]}>
                    <Text style={styles.title}>{session.mentorId?.name || "Mentor"}</Text>
                    <Text style={styles.meta}>
                      {session.date} {session.time} | {session.currency || "INR"} {session.amount}
                    </Text>
                    <Text style={styles.statusWarning}>Payment status: {session.paymentStatus}</Text>
                    {session.paymentRejectReason ? (
                      <Text style={styles.error}>Reason: {session.paymentRejectReason}</Text>
                    ) : null}
                    <Text style={styles.meta}>UPI ID: {instructions?.upiId || "Not configured"}</Text>
                    {instructions?.qrImageUrl ? (
                      <Image source={{ uri: instructions.qrImageUrl }} style={styles.qrImage} resizeMode="contain" />
                    ) : (
                      <Text style={styles.meta}>QR image not configured by admin.</Text>
                    )}
                    <Text style={styles.meta}>
                      Pay before:{" "}
                      {instructions?.dueAt ? new Date(instructions.dueAt).toLocaleString() : "No due time set"}
                    </Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Transaction reference (optional)"
                      value={transactionRefBySession[session._id] || ""}
                      onChangeText={(value) =>
                        setTransactionRefBySession((prev) => ({ ...prev, [session._id]: value }))
                      }
                    />
                    <View style={styles.paymentActionsRow}>
                      <TouchableOpacity
                        style={[styles.joinButton, styles.paymentPrimaryAction]}
                        onPress={() => submitManualProof(session)}
                        disabled={isSubmitting}
                      >
                        <Text style={styles.joinButtonText}>
                          {isSubmitting ? "Submitting..." : "Upload Screenshot & Submit"}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.cancelButton, isSubmitting && styles.disabledButton]}
                        onPress={() => cancelPendingSession(session)}
                        disabled={isSubmitting}
                      >
                        <Text style={styles.cancelButtonText}>Cancel</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}
          </View>

          <View style={styles.panel}>
            <Text style={[styles.panelTitle, styles.panelTitleWaiting]}>Awaiting Verification</Text>
            {filteredWaitingVerificationSessions.length === 0 ? (
              <Text style={styles.empty}>No sessions waiting for verification.</Text>
            ) : (
              filteredWaitingVerificationSessions.map((session) => (
                <View key={session._id} style={[styles.card, styles.cardWaiting]}>
                  <Text style={styles.title}>{session.mentorId?.name || "Mentor"}</Text>
                  <Text style={styles.meta}>
                    {session.date} {session.time} | {session.currency || "INR"} {session.amount}
                  </Text>
                  <Text style={styles.statusInfo}>Payment submitted. Awaiting admin verification.</Text>
                </View>
              ))
            )}
          </View>

          <View style={styles.panel}>
            <Text style={[styles.panelTitle, styles.panelTitleConfirmed]}>Confirmed Sessions</Text>
            {filteredConfirmedSessions.length === 0 ? (
              <Text style={styles.empty}>No confirmed sessions yet.</Text>
            ) : (
              filteredConfirmedSessions.map((session) => (
                <View key={session._id} style={[styles.card, styles.cardConfirmed]}>
                  <Text style={styles.title}>{session.mentorId?.name || "Mentor"}</Text>
                  <Text style={styles.meta}>
                    {session.date} {session.time} | Amount: {session.currency || "INR"} {session.amount}
                  </Text>
                  <Text style={styles.status}>Payment: {session.paymentStatus} | Session: {session.sessionStatus}</Text>
                  {session.meetingLink ? (
                    <TouchableOpacity style={styles.joinButton} onPress={() => Linking.openURL(session.meetingLink as string)}>
                      <Text style={styles.joinButtonText}>Join Session</Text>
                    </TouchableOpacity>
                  ) : (
                    <Text style={styles.meta}>Meeting link will appear after mentor updates.</Text>
                  )}
                </View>
              ))
            )}
          </View>

          <View style={styles.panel}>
            <Text style={[styles.panelTitle, styles.panelTitleLegacy]}>Legacy Booking Requests</Text>
            {filteredBookings.length === 0 ? (
              <Text style={styles.empty}>No booking requests yet.</Text>
            ) : (
              filteredBookings.map((item) => (
                <View key={item._id} style={[styles.card, styles.cardLegacy]}>
                  <Text style={styles.title}>{item.mentor?.name || "Mentor"}</Text>
                  <Text style={styles.meta}>{item.mentor?.email}</Text>
                  <Text style={styles.meta}>{new Date(item.scheduledAt).toLocaleString()}</Text>
                  <Text style={styles.status}>Status: {item.status}</Text>
                </View>
              ))
            )}
          </View>
        </>
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
  subheading: { marginTop: 6, marginBottom: 14, color: "#475467", fontWeight: "500" },
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
  sectionGrid: { marginBottom: 14, flexDirection: "row", flexWrap: "wrap", gap: 10 },
  sectionTile: {
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
  sectionTileTitle: { color: "#1E2B24", fontWeight: "700", fontSize: 13, textAlign: "center" },
  featuredRow: { paddingBottom: 4, gap: 10, marginBottom: 6 },
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
  domainGuideInlineCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D7E6F6",
    borderRadius: 16,
    padding: 12,
    marginBottom: 8
  },
  domainGuideIntro: { color: "#475467", lineHeight: 19, marginBottom: 10, fontWeight: "500" },
  domainMiniGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  domainMiniTile: {
    width: "48.8%",
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    padding: 9
  },
  domainMiniIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center"
  },
  domainMiniTitle: { marginTop: 6, color: "#1E2B24", fontWeight: "700", fontSize: 12 },
  domainMiniNote: { marginTop: 3, color: "#667085", fontSize: 11, lineHeight: 15 },
  domainGuideButton: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#165DFF",
    borderRadius: 10,
    paddingVertical: 9,
    alignItems: "center",
    backgroundColor: "#EFF4FF"
  },
  domainGuideButtonText: { color: "#165DFF", fontWeight: "700" },
  deepMapWrap: { gap: 10, marginBottom: 8 },
  deepMapCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12
  },
  deepMapHead: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  deepMapIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8
  },
  deepMapTitle: { fontSize: 15, fontWeight: "800" },
  deepSectionCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    padding: 9,
    marginTop: 8
  },
  deepSectionName: { color: "#1E2B24", fontWeight: "800", fontSize: 13 },
  deepTrackRow: { marginTop: 7 },
  deepTrackName: { color: "#344054", fontWeight: "700", fontSize: 12 },
  deepTopicWrap: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 5 },
  deepTopicChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 11,
    color: "#475467",
    backgroundColor: "#FFFFFF",
    overflow: "hidden"
  },
  feedWrap: { gap: 9, marginBottom: 8 },
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
    marginBottom: 8
  },
  dailyTitle: { color: "#1849A9", fontWeight: "800", marginBottom: 6 },
  dailyItem: { color: "#344054", marginBottom: 3, fontWeight: "500" },
  dailyMeta: { marginTop: 6, color: "#475467", fontWeight: "600", fontSize: 12 },
  suggestionWrap: { gap: 9, marginBottom: 8 },
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
  centered: { alignItems: "center", justifyContent: "center", minHeight: 140 },
  panel: { marginTop: 8 },
  panelTitle: { fontSize: 17, fontWeight: "800", color: "#1E2B24", marginBottom: 8 },
  panelTitlePending: { color: "#B54708" },
  panelTitleWaiting: { color: "#1849A9" },
  panelTitleConfirmed: { color: "#067647" },
  panelTitleLegacy: { color: "#6941C6" },
  card: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E4E7EC",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10
  },
  cardPending: { backgroundColor: "#FFF8F1", borderColor: "#F9DBAF" },
  cardWaiting: { backgroundColor: "#F5F8FF", borderColor: "#D6E4FF" },
  cardConfirmed: { backgroundColor: "#F2FBF4", borderColor: "#C9E9D2" },
  cardLegacy: { backgroundColor: "#F8F5FF", borderColor: "#DDD2FE" },
  title: { fontWeight: "700", color: "#1E2B24", fontSize: 16 },
  meta: { color: "#667085", marginTop: 4, lineHeight: 18 },
  status: { marginTop: 8, fontWeight: "700", color: "#1F7A4C" },
  statusWarning: { marginTop: 8, fontWeight: "700", color: "#B54708" },
  statusInfo: { marginTop: 8, fontWeight: "700", color: "#1849A9" },
  input: {
    marginTop: 8,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#D0D5DD",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10
  },
  inputTall: { minHeight: 84, textAlignVertical: "top" },
  joinButton: {
    marginTop: 10,
    backgroundColor: "#1F7A4C",
    borderRadius: 10,
    alignItems: "center",
    paddingVertical: 10
  },
  joinButtonText: { color: "#fff", fontWeight: "700" },
  paymentActionsRow: { flexDirection: "row", gap: 10, marginTop: 10 },
  paymentPrimaryAction: { flex: 1, marginTop: 0 },
  cancelButton: {
    flex: 0.5,
    borderWidth: 1.5,
    borderColor: "#B42318",
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    backgroundColor: "#fff"
  },
  cancelButtonText: { color: "#B42318", fontWeight: "700" },
  disabledButton: { opacity: 0.6 },
  qrImage: {
    width: "100%",
    height: 180,
    marginTop: 8,
    backgroundColor: "#F8FAF8",
    borderRadius: 8
  },
  error: { color: "#B42318", marginBottom: 8 },
  empty: { color: "#667085", marginTop: 4 },
  logout: { marginTop: 14, padding: 12, alignItems: "center" },
  logoutText: { color: "#7A271A", fontWeight: "700" }
});
