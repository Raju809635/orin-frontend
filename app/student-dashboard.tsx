import React, { useCallback, useEffect, useMemo, useState } from "react";
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
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { notify } from "@/utils/notify";
import { submitManualPaymentWithPicker } from "@/utils/manualPaymentUpload";
import { FEATURE_FLAGS } from "@/constants/featureFlags";
import { getStoredNewsLanguage, NewsLanguageCode } from "@/utils/newsLanguage";

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
  authorId?: { _id?: string; name?: string; role?: string } | null;
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

type MentorMatch = {
  mentorId: string;
  name: string;
  title: string;
  primaryCategory: string;
  subCategory: string;
  experienceYears: number;
  rating: number;
  matchScore: number;
  reasons?: string[];
};

type SessionHistoryItem = {
  sessionId: string;
  mentorId?: string | null;
  mentorName: string;
  date: string;
  time: string;
  notes?: string;
};

type CareerRoadmapResponse = {
  goal: string;
  steps: Array<{ stepNumber: number; title: string; completed: boolean }>;
};

type OpportunityItem = {
  _id: string;
  title: string;
  company?: string;
  role?: string;
  duration?: string;
  type?: string;
  relevanceScore?: number;
};

type LeaderboardEntry = {
  rank: number;
  name: string;
  score: number;
};

type LeaderboardResponse = {
  collegeName?: string;
  collegeTop: LeaderboardEntry[];
  globalTop: LeaderboardEntry[];
};

type LiveSessionItem = {
  id: string;
  title: string;
  topic?: string;
  startsAt: string;
  meetingLink?: string;
  mentor?: { name?: string };
};

type ResumeResponse = {
  markdown: string;
  export?: { fileName?: string };
};

type SkillGapResponse = {
  goal: string;
  currentSkills: string[];
  missingSkills: string[];
  suggestions?: {
    courses?: string[];
    projects?: string[];
  };
};

type VerifiedMentor = {
  mentorId: string;
  name: string;
  title?: string;
  rating?: number;
  verifiedBadge?: boolean;
};

type ChallengeItem = {
  id: string;
  title: string;
  domain?: string;
  deadline: string;
  participantsCount?: number;
};

type CertificationItem = {
  id: string;
  title: string;
  level?: string;
};

type MentorGroupItem = {
  id: string;
  name: string;
  domain?: string;
  schedule?: string;
  membersCount?: number;
  mentor?: { name?: string };
};

type ProjectIdeasResponse = {
  goal: string;
  ideas: Array<{ title: string; level?: string }>;
};

type LibraryItem = {
  id: string;
  type: string;
  title: string;
  description?: string;
};

type ReputationSummary = {
  score: number;
  levelTag: string;
  topPercent: number;
};

type NewsCategoryKey = "tech" | "edtech" | "exams" | "scholarships" | "opportunities";
type NewsArticle = {
  title: string;
  description: string;
  imageUrl: string;
  source: string;
  url: string;
  publishedAt: string;
};

type StudentSectionId = "overview" | "growth" | "sessions" | "network";
type GrowthSubSectionId = "ai" | "community" | "resources";

const studentSections: { id: StudentSectionId; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "growth", label: "Career Growth" },
  { id: "sessions", label: "Sessions" },
  { id: "network", label: "Network" }
];

const growthSubSections: { id: GrowthSubSectionId; label: string }[] = [
  { id: "ai", label: "AI & Planning" },
  { id: "community", label: "Community" },
  { id: "resources", label: "Resources" }
];

const newsTabs: { key: NewsCategoryKey; label: string }[] = [
  { key: "tech", label: "Tech" },
  { key: "edtech", label: "EdTech" },
  { key: "exams", label: "Govt Exams" },
  { key: "scholarships", label: "Scholarships" },
  { key: "opportunities", label: "Opportunities" }
];

export default function StudentDashboard() {
  const params = useLocalSearchParams<{ section?: string }>();
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
  const [searchQuery, setSearchQuery] = useState("");
  const [networkFeed, setNetworkFeed] = useState<NetworkPost[]>([]);
  const [dailyDashboard, setDailyDashboard] = useState<DailyDashboard | null>(null);
  const [completingTaskKey, setCompletingTaskKey] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<SmartSuggestion[]>([]);
  const [mentorMatches, setMentorMatches] = useState<MentorMatch[]>([]);
  const [sessionHistory, setSessionHistory] = useState<SessionHistoryItem[]>([]);
  const [roadmap, setRoadmap] = useState<CareerRoadmapResponse | null>(null);
  const [opportunities, setOpportunities] = useState<OpportunityItem[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardResponse | null>(null);
  const [liveSessions, setLiveSessions] = useState<LiveSessionItem[]>([]);
  const [resumePreview, setResumePreview] = useState<ResumeResponse | null>(null);
  const [skillGap, setSkillGap] = useState<SkillGapResponse | null>(null);
  const [verifiedMentors, setVerifiedMentors] = useState<VerifiedMentor[]>([]);
  const [challenges, setChallenges] = useState<ChallengeItem[]>([]);
  const [certifications, setCertifications] = useState<CertificationItem[]>([]);
  const [mentorGroups, setMentorGroups] = useState<MentorGroupItem[]>([]);
  const [projectIdeas, setProjectIdeas] = useState<ProjectIdeasResponse | null>(null);
  const [knowledgeLibrary, setKnowledgeLibrary] = useState<LibraryItem[]>([]);
  const [reputationSummary, setReputationSummary] = useState<ReputationSummary | null>(null);
  const [activeNewsTab, setActiveNewsTab] = useState<NewsCategoryKey>("tech");
  const [newsByCategory, setNewsByCategory] = useState<Record<NewsCategoryKey, NewsArticle[]>>({
    tech: [],
    edtech: [],
    exams: [],
    scholarships: [],
    opportunities: []
  });
  const [newsLoading, setNewsLoading] = useState(false);
  const [newsLanguage, setNewsLanguage] = useState<NewsLanguageCode>("en");
  const [activeSection, setActiveSection] = useState<StudentSectionId>("overview");
  const [growthSubSection, setGrowthSubSection] = useState<GrowthSubSectionId>("ai");
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
  const fetchDashboard = useCallback(async (refresh = false) => {
    try {
      if (refresh) setIsRefreshing(true);
      else setIsLoading(true);

      setError(null);
      const [
        bookingsRes,
        sessionsRes,
        profileRes,
        feedRes,
        dailyRes,
        suggestionsRes,
        mentorMatchesRes,
        sessionHistoryRes,
        roadmapRes,
        opportunitiesRes,
        leaderboardRes,
        liveSessionsRes,
        resumeRes,
        skillGapRes,
        verifiedMentorsRes,
        challengesRes,
        certificationsRes,
        mentorGroupsRes,
        projectIdeasRes,
        knowledgeLibraryRes,
        reputationSummaryRes
      ] = await Promise.allSettled([
        api.get<Booking[]>("/api/bookings/student"),
        api.get<Session[]>("/api/sessions/student/me"),
        api.get<{ profile?: { profilePhotoUrl?: string } }>("/api/profiles/student/me"),
        FEATURE_FLAGS.networking ? api.get<NetworkPost[]>("/api/network/feed") : Promise.resolve({ data: [] as NetworkPost[] }),
        FEATURE_FLAGS.dailyEngagement
          ? api.get<DailyDashboard>("/api/network/daily-dashboard")
          : Promise.resolve({ data: null as DailyDashboard | null }),
        FEATURE_FLAGS.smartSuggestions
          ? api.get<SmartSuggestion[]>("/api/network/suggestions")
          : Promise.resolve({ data: [] as SmartSuggestion[] }),
        api.get<{ recommendations: MentorMatch[] }>("/api/network/mentor-matches"),
        api.get<SessionHistoryItem[]>("/api/network/session-history"),
        api.get<CareerRoadmapResponse>("/api/network/career-roadmap"),
        api.get<OpportunityItem[]>("/api/network/opportunities"),
        api.get<LeaderboardResponse>("/api/network/leaderboard"),
        api.get<LiveSessionItem[]>("/api/network/live-sessions"),
        api.get<ResumeResponse>("/api/network/resume/generate"),
        api.get<SkillGapResponse>("/api/network/skill-gap"),
        api.get<VerifiedMentor[]>("/api/network/verified-mentors"),
        api.get<ChallengeItem[]>("/api/network/challenges"),
        api.get<CertificationItem[]>("/api/network/certifications"),
        api.get<MentorGroupItem[]>("/api/network/mentor-groups"),
        api.get<ProjectIdeasResponse>("/api/network/project-ideas"),
        api.get<LibraryItem[]>("/api/network/knowledge-library"),
        api.get<ReputationSummary>("/api/network/reputation-summary")
      ]);

      setBookings(bookingsRes.status === "fulfilled" ? bookingsRes.value.data || [] : []);
      setSessions(sessionsRes.status === "fulfilled" ? sessionsRes.value.data || [] : []);
      setProfilePhotoUrl(profileRes.status === "fulfilled" ? profileRes.value.data?.profile?.profilePhotoUrl || "" : "");
      setNetworkFeed(feedRes.status === "fulfilled" ? feedRes.value.data || [] : []);
      setDailyDashboard(dailyRes.status === "fulfilled" ? dailyRes.value.data || null : null);
      setSuggestions(suggestionsRes.status === "fulfilled" ? suggestionsRes.value.data || [] : []);
      setMentorMatches(
        mentorMatchesRes.status === "fulfilled" ? mentorMatchesRes.value.data?.recommendations || [] : []
      );
      setSessionHistory(sessionHistoryRes.status === "fulfilled" ? sessionHistoryRes.value.data || [] : []);
      setRoadmap(roadmapRes.status === "fulfilled" ? roadmapRes.value.data || null : null);
      setOpportunities(opportunitiesRes.status === "fulfilled" ? opportunitiesRes.value.data || [] : []);
      setLeaderboard(leaderboardRes.status === "fulfilled" ? leaderboardRes.value.data || null : null);
      setLiveSessions(liveSessionsRes.status === "fulfilled" ? liveSessionsRes.value.data || [] : []);
      setResumePreview(resumeRes.status === "fulfilled" ? resumeRes.value.data || null : null);
      setSkillGap(skillGapRes.status === "fulfilled" ? skillGapRes.value.data || null : null);
      setVerifiedMentors(verifiedMentorsRes.status === "fulfilled" ? verifiedMentorsRes.value.data || [] : []);
      setChallenges(challengesRes.status === "fulfilled" ? challengesRes.value.data || [] : []);
      setCertifications(certificationsRes.status === "fulfilled" ? certificationsRes.value.data || [] : []);
      setMentorGroups(mentorGroupsRes.status === "fulfilled" ? mentorGroupsRes.value.data || [] : []);
      setProjectIdeas(projectIdeasRes.status === "fulfilled" ? projectIdeasRes.value.data || null : null);
      setKnowledgeLibrary(knowledgeLibraryRes.status === "fulfilled" ? knowledgeLibraryRes.value.data || [] : []);
      setReputationSummary(reputationSummaryRes.status === "fulfilled" ? reputationSummaryRes.value.data || null : null);
      const hardFailures = [bookingsRes, sessionsRes].filter((item) => item.status !== "fulfilled").length;
      if (hardFailures > 0) {
        setError("Some dashboard sections could not load. Pull to refresh.");
      }
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to load dashboard data.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    getStoredNewsLanguage().then((lang) => {
      if (mounted) setNewsLanguage(lang);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const fetchNews = useCallback(
    async (refresh = false) => {
      try {
        if (refresh) {
          setNewsLoading(true);
        }
        const endpoints: NewsCategoryKey[] = ["tech", "edtech", "exams", "scholarships", "opportunities"];
        const responses = await Promise.allSettled(
          endpoints.map((category) =>
            api.get<{ category: string; articles: NewsArticle[] }>(`/api/news/${category}?limit=6&language=${newsLanguage}`)
          )
        );
        setNewsByCategory((prev) => {
          const next = { ...prev };
          responses.forEach((result, index) => {
            const key = endpoints[index];
            if (result.status === "fulfilled") {
              next[key] = result.value.data?.articles || [];
            }
          });
          return next;
        });
      } catch {
        // news is optional on dashboard; keep other sections unaffected
      } finally {
        setNewsLoading(false);
      }
    },
    [newsLanguage]
  );

  useFocusEffect(
    useCallback(() => {
      fetchDashboard();
      fetchNews(true);
    }, [fetchDashboard, fetchNews])
  );

  useEffect(() => {
    const section = String(params.section || "");
    if (section === "overview" || section === "growth" || section === "sessions" || section === "network") {
      setActiveSection(section);
    }
  }, [params.section]);

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
  const activeNewsArticles = useMemo(() => newsByCategory[activeNewsTab] || [], [activeNewsTab, newsByCategory]);
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

  const searchResultItems = useMemo(() => {
    if (!normalizedQuery) return [];
    const items: Array<{ id: string; title: string; subtitle: string }> = [];

    filteredPendingPaymentSessions.slice(0, 2).forEach((session) => {
      items.push({
        id: `pending-${session._id}`,
        title: session.mentorId?.name || "Mentor session",
        subtitle: `Pending payment | ${session.date} ${session.time}`
      });
    });

    filteredWaitingVerificationSessions.slice(0, 2).forEach((session) => {
      items.push({
        id: `waiting-${session._id}`,
        title: session.mentorId?.name || "Mentor session",
        subtitle: `Awaiting verification | ${session.date} ${session.time}`
      });
    });

    filteredConfirmedSessions.slice(0, 2).forEach((session) => {
      items.push({
        id: `confirmed-${session._id}`,
        title: session.mentorId?.name || "Mentor session",
        subtitle: `Confirmed | ${session.date} ${session.time}`
      });
    });

    filteredBookings.slice(0, 2).forEach((booking) => {
      items.push({
        id: `legacy-${booking._id}`,
        title: booking.mentor?.name || "Booking request",
        subtitle: `${booking.status} | ${new Date(booking.scheduledAt).toLocaleString()}`
      });
    });

    return items.slice(0, 6);
  }, [
    normalizedQuery,
    filteredPendingPaymentSessions,
    filteredWaitingVerificationSessions,
    filteredConfirmedSessions,
    filteredBookings
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

  async function addQuickSessionNote(sessionId: string) {
    try {
      setError(null);
      const text = `Student note updated on ${new Date().toLocaleString()}`;
      await api.patch(`/api/network/session-history/${sessionId}/note`, { note: text });
      notify("Session note saved.");
      await fetchDashboard(true);
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to save session note.");
    }
  }

  async function addQuickReview(sessionId: string) {
    try {
      setError(null);
      await api.post(`/api/network/sessions/${sessionId}/review`, {
        rating: 5,
        reviewText: "Very helpful mentor session."
      });
      notify("Review submitted.");
      await fetchDashboard(true);
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to submit review.");
    }
  }

  async function joinChallenge(challengeId: string) {
    try {
      setError(null);
      await api.post(`/api/network/challenges/${challengeId}/join`);
      notify("Challenge joined.");
      await fetchDashboard(true);
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to join challenge.");
    }
  }

  async function joinGroup(groupId: string) {
    try {
      setError(null);
      await api.post(`/api/network/mentor-groups/${groupId}/join`);
      notify("Group joined.");
      await fetchDashboard(true);
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to join group.");
    }
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
                <Text style={styles.avatarText}>{user.name?.charAt(0)?.toUpperCase() || "S"}</Text>
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
          {totalSearchMatches > 0 ? (
            <View style={styles.searchResultList}>
              {searchResultItems.map((item) => (
                <View key={item.id} style={styles.searchResultCard}>
                  <Text style={styles.searchResultTitle}>{item.title}</Text>
                  <Text style={styles.searchResultSubtitle}>{item.subtitle}</Text>
                </View>
              ))}
            </View>
          ) : (
            <TouchableOpacity style={styles.searchAskAiBtn} onPress={() => router.push(`/ai-assistant?q=${encodeURIComponent(normalizedQuery)}` as never)}>
              <Text style={styles.searchAskAiBtnText}>Ask AI about "{normalizedQuery}"</Text>
            </TouchableOpacity>
          )}
        </>
      ) : null}

      <View style={styles.heroBanner}>
        <Text style={styles.heroEyebrow}>Student Space</Text>
        <Text style={styles.heroTitle}>Unlock Your Mentorship Journey</Text>
        <Text style={styles.heroSubTitle}>Explore mentors, track sessions, and grow faster with ORIN.</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sectionNavRow}>
        {studentSections.map((item) => {
          const active = activeSection === item.id;
          return (
            <TouchableOpacity
              key={item.id}
              style={[styles.sectionChip, active && styles.sectionChipActive]}
              onPress={() => setActiveSection(item.id)}
            >
              <Text style={[styles.sectionChipText, active && styles.sectionChipTextActive]}>{item.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {activeSection === "overview" ? (
      <>
      <Text style={styles.sectionHeader}>Career & Tech Updates</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.newsTabRow}>
        {newsTabs.map((tab) => {
          const active = activeNewsTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.newsTabChip, active && styles.newsTabChipActive]}
              onPress={() => setActiveNewsTab(tab.key)}
            >
              <Text style={[styles.newsTabText, active && styles.newsTabTextActive]}>{tab.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.newsRow}>
        {newsLoading && activeNewsArticles.length === 0 ? (
          <View style={styles.newsLoaderWrap}>
            <ActivityIndicator size="small" color="#1F7A4C" />
            <Text style={styles.meta}>Loading updates...</Text>
          </View>
        ) : activeNewsArticles.length === 0 ? (
          <View style={styles.newsLoaderWrap}>
            <Text style={styles.meta}>No updates available right now.</Text>
          </View>
        ) : (
          activeNewsArticles.slice(0, 8).map((item, index) => (
            <View key={`${item.url}-${index}`} style={styles.newsCard}>
              {item.imageUrl ? <Image source={{ uri: item.imageUrl }} style={styles.newsImage} resizeMode="cover" /> : null}
              <Text style={styles.newsTitle} numberOfLines={3}>{item.title}</Text>
              <Text style={styles.newsDesc} numberOfLines={3}>{item.description || "Tap Read More for full details."}</Text>
              <View style={styles.newsMetaRow}>
                <Text style={styles.newsSource} numberOfLines={1}>{item.source || "News Source"}</Text>
                <TouchableOpacity onPress={() => item.url && Linking.openURL(item.url)}>
                  <Text style={styles.newsReadMore}>Read More</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>

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
      </>
      ) : null}

      {activeSection === "growth" ? (
      <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sectionNavRow}>
        {growthSubSections.map((item) => {
          const active = growthSubSection === item.id;
          return (
            <TouchableOpacity
              key={item.id}
              style={[styles.sectionChip, active && styles.sectionChipActive]}
              onPress={() => setGrowthSubSection(item.id)}
            >
              <Text style={[styles.sectionChipText, active && styles.sectionChipTextActive]}>{item.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {growthSubSection === "ai" ? (
        <>
      <Text style={styles.groupTitle}>AI Intelligence</Text>
      <Text style={styles.groupNote}>Personalized AI guidance based on your goal, skills, and progress.</Text>
      <Text style={styles.sectionHeader}>AI Mentor Matching</Text>
      <View style={styles.matchWrap}>
        {mentorMatches.length === 0 ? (
          <Text style={styles.empty}>No mentor recommendations available right now.</Text>
        ) : (
          mentorMatches.slice(0, 5).map((item) => (
            <View key={item.mentorId} style={styles.matchCard}>
              <Text style={styles.matchName}>{item.name}</Text>
              <Text style={styles.matchMeta}>
                {item.primaryCategory || "General"} {item.subCategory ? `> ${item.subCategory}` : ""}
              </Text>
              <Text style={styles.matchMeta}>
                Experience {item.experienceYears || 0} yrs | Rating {item.rating || 0}
              </Text>
              <Text style={styles.matchScore}>Match Score: {item.matchScore}%</Text>
              <View style={styles.matchActions}>
                <TouchableOpacity
                  style={styles.matchBtn}
                  onPress={() => router.push(`/mentor/${item.mentorId}` as never)}
                >
                  <Text style={styles.matchBtnText}>View Profile</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.matchBtn, styles.matchBtnPrimary]}
                  onPress={() => router.push(`/mentor/${item.mentorId}` as never)}
                >
                  <Text style={[styles.matchBtnText, styles.matchBtnTextPrimary]}>Book Session</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </View>

      <Text style={styles.sectionHeader}>AI Skill Gap Analyzer</Text>
      <View style={styles.roadmapCard}>
        {!skillGap ? (
          <Text style={styles.empty}>Skill gap analysis unavailable right now.</Text>
        ) : (
          <>
            <Text style={styles.roadmapGoal}>Goal: {skillGap.goal}</Text>
            <Text style={styles.historyMeta}>Current Skills: {skillGap.currentSkills.join(", ") || "None yet"}</Text>
            <Text style={styles.historyMeta}>
              Missing Skills: {skillGap.missingSkills.length ? skillGap.missingSkills.join(", ") : "No gaps detected"}
            </Text>
            <Text style={styles.historyMeta}>
              Suggested Courses: {skillGap.suggestions?.courses?.slice(0, 3).join(", ") || "No suggestions"}
            </Text>
          </>
        )}
      </View>

      <Text style={styles.groupTitle}>Trust & Mentor Quality</Text>
      <Text style={styles.groupNote}>Verified mentors and transparent quality signals for safer mentorship.</Text>
      <Text style={styles.sectionHeader}>Verified Mentor System</Text>
      <View style={styles.matchWrap}>
        {verifiedMentors.length === 0 ? (
          <Text style={styles.empty}>No verified mentors available currently.</Text>
        ) : (
          verifiedMentors.slice(0, 4).map((item) => (
            <View key={item.mentorId} style={styles.matchCard}>
              <Text style={styles.matchName}>
                {item.name} {item.verifiedBadge ? "(Verified)" : ""}
              </Text>
              <Text style={styles.matchMeta}>{item.title || "Mentor"}</Text>
              <Text style={styles.matchMeta}>Rating: {item.rating || 0}</Text>
            </View>
          ))
        )}
      </View>

      <Text style={styles.groupTitle}>Career Progress</Text>
      <Text style={styles.groupNote}>Roadmaps, opportunities, and live sessions to accelerate your journey.</Text>
      <Text style={styles.sectionHeader}>AI Career Roadmap</Text>
      <View style={styles.roadmapCard}>
        {!roadmap ? (
          <Text style={styles.empty}>Roadmap unavailable right now.</Text>
        ) : (
          <>
            <Text style={styles.roadmapGoal}>Goal: {roadmap.goal}</Text>
            {roadmap.steps.map((step) => (
              <Text key={`${step.stepNumber}-${step.title}`} style={styles.roadmapStep}>
                Step {step.stepNumber}: {step.title}
              </Text>
            ))}
          </>
        )}
      </View>

      <Text style={styles.sectionHeader}>Internships & Opportunities</Text>
      <View style={styles.opportunityWrap}>
        {opportunities.length === 0 ? (
          <Text style={styles.empty}>No opportunities available right now.</Text>
        ) : (
          opportunities.slice(0, 5).map((item) => (
            <View key={item._id} style={styles.opportunityCard}>
              <Text style={styles.opportunityTitle}>{item.title}</Text>
              <Text style={styles.opportunityMeta}>
                {item.company || "ORIN Network"} | {item.role || item.type || "Opportunity"}
              </Text>
              <Text style={styles.opportunityMeta}>Duration: {item.duration || "Flexible"}</Text>
            </View>
          ))
        )}
      </View>

      <Text style={styles.sectionHeader}>College Leaderboard</Text>
      <View style={styles.leaderboardCard}>
        {!leaderboard || leaderboard.collegeTop.length === 0 ? (
          <Text style={styles.empty}>Leaderboard will appear after enough activity.</Text>
        ) : (
          <>
            <Text style={styles.leaderboardTitle}>{leaderboard.collegeName || "Your College"}</Text>
            {leaderboard.collegeTop.slice(0, 5).map((entry) => (
              <Text key={`${entry.rank}-${entry.name}`} style={styles.leaderboardRow}>
                {entry.rank}. {entry.name} - {entry.score}
              </Text>
            ))}
          </>
        )}
      </View>

      <Text style={styles.sectionHeader}>Mentor Live Sessions</Text>
      <View style={styles.liveWrap}>
        {liveSessions.length === 0 ? (
          <Text style={styles.empty}>No upcoming live sessions right now.</Text>
        ) : (
          liveSessions.slice(0, 5).map((item) => (
            <View key={item.id} style={styles.liveCard}>
              <Text style={styles.liveTitle}>{item.title}</Text>
              <Text style={styles.liveMeta}>{item.topic || "Live mentoring session"}</Text>
              <Text style={styles.liveMeta}>
                Mentor: {item.mentor?.name || "Mentor"} | {new Date(item.startsAt).toLocaleString()}
              </Text>
            </View>
          ))
        )}
      </View>

      </>
      ) : null}

      {growthSubSection === "community" ? (
      <>
      <Text style={styles.groupTitle}>Community & Collaboration</Text>
      <Text style={styles.groupNote}>Learn together through challenges, certifications, and mentor-led groups.</Text>
      <Text style={styles.sectionHeader}>Community Challenges</Text>
      <View style={styles.opportunityWrap}>
        {challenges.length === 0 ? (
          <Text style={styles.empty}>No active challenges right now.</Text>
        ) : (
          challenges.slice(0, 4).map((item) => (
            <View key={item.id} style={styles.opportunityCard}>
              <Text style={styles.opportunityTitle}>{item.title}</Text>
              <Text style={styles.opportunityMeta}>
                {item.domain || "General"} | Participants: {item.participantsCount || 0}
              </Text>
              <Text style={styles.opportunityMeta}>Deadline: {new Date(item.deadline).toLocaleDateString()}</Text>
              <TouchableOpacity style={styles.matchBtn} onPress={() => joinChallenge(item.id)}>
                <Text style={styles.matchBtnText}>Join Challenge</Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </View>

      <Text style={styles.sectionHeader}>ORIN Certification System</Text>
      <View style={styles.historyWrap}>
        {certifications.length === 0 ? (
          <Text style={styles.empty}>No certifications yet.</Text>
        ) : (
          certifications.slice(0, 5).map((item) => (
            <View key={item.id} style={styles.historyCard}>
              <Text style={styles.historyTitle}>{item.title}</Text>
              <Text style={styles.historyMeta}>Level: {item.level || "Beginner"}</Text>
            </View>
          ))
        )}
      </View>

      <Text style={styles.sectionHeader}>Mentor Groups</Text>
      <View style={styles.opportunityWrap}>
        {mentorGroups.length === 0 ? (
          <Text style={styles.empty}>No mentor groups available.</Text>
        ) : (
          mentorGroups.slice(0, 4).map((item) => (
            <View key={item.id} style={styles.opportunityCard}>
              <Text style={styles.opportunityTitle}>{item.name}</Text>
              <Text style={styles.opportunityMeta}>
                Mentor: {item.mentor?.name || "Mentor"} | Students: {item.membersCount || 0}
              </Text>
              <Text style={styles.opportunityMeta}>{item.schedule || "Weekly sessions"}</Text>
              <TouchableOpacity style={styles.matchBtn} onPress={() => joinGroup(item.id)}>
                <Text style={styles.matchBtnText}>Join Group</Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </View>

      </>
      ) : null}

      {growthSubSection === "resources" ? (
      <>
      <Text style={styles.groupTitle}>Resources & Portfolio</Text>
      <Text style={styles.groupNote}>Build projects, access knowledge, and generate your resume.</Text>
      <Text style={styles.sectionHeader}>AI Project Idea Generator</Text>
      <View style={styles.roadmapCard}>
        {!projectIdeas ? (
          <Text style={styles.empty}>Project ideas unavailable right now.</Text>
        ) : (
          <>
            <Text style={styles.roadmapGoal}>Goal: {projectIdeas.goal}</Text>
            {projectIdeas.ideas.slice(0, 5).map((idea, idx) => (
              <Text key={`${idea.title}-${idx}`} style={styles.roadmapStep}>
                {idx + 1}. {idea.title}
              </Text>
            ))}
          </>
        )}
      </View>

      <Text style={styles.sectionHeader}>Knowledge Library</Text>
      <View style={styles.historyWrap}>
        {knowledgeLibrary.length === 0 ? (
          <Text style={styles.empty}>No resources available right now.</Text>
        ) : (
          knowledgeLibrary.slice(0, 6).map((item) => (
            <View key={item.id} style={styles.historyCard}>
              <Text style={styles.historyTitle}>{item.title}</Text>
              <Text style={styles.historyMeta}>{item.type}</Text>
              <Text style={styles.historyMeta}>{item.description || ""}</Text>
            </View>
          ))
        )}
      </View>

      <Text style={styles.groupTitle}>Reputation & Ranking</Text>
      <Text style={styles.groupNote}>Track your ORIN standing and percentile among learners.</Text>
      <Text style={styles.sectionHeader}>ORIN Reputation Score</Text>
      <View style={styles.leaderboardCard}>
        {!reputationSummary ? (
          <Text style={styles.empty}>Reputation summary unavailable.</Text>
        ) : (
          <>
            <Text style={styles.leaderboardTitle}>Reputation Score: {reputationSummary.score}</Text>
            <Text style={styles.leaderboardRow}>{reputationSummary.levelTag}</Text>
            <Text style={styles.leaderboardRow}>Top {reputationSummary.topPercent}% learners</Text>
          </>
        )}
      </View>

      <Text style={styles.sectionHeader}>AI Resume Builder</Text>
      <View style={styles.resumeCard}>
        {!resumePreview?.markdown ? (
          <Text style={styles.empty}>Resume preview unavailable right now.</Text>
        ) : (
          <>
            <Text style={styles.resumeTitle}>Resume generated</Text>
            <Text style={styles.resumeMeta}>File: {resumePreview.export?.fileName || "orin_resume.md"}</Text>
            <Text style={styles.resumeSnippet} numberOfLines={5}>
              {resumePreview.markdown}
            </Text>
          </>
        )}
      </View>
      </>
      ) : null}

      </>
      ) : null}

      {FEATURE_FLAGS.networking && activeSection === "network" ? (
        <>
          <Text style={styles.sectionHeader}>Network Activity Feed</Text>
          <View style={styles.feedWrap}>
            {networkFeed.length === 0 ? (
              <Text style={styles.empty}>No network activity yet.</Text>
            ) : (
              networkFeed.map((post) => (
                <View key={post._id} style={styles.feedCard}>
                  <TouchableOpacity
                    onPress={() =>
                      post.authorId?._id ? router.push(`/public-profile/${post.authorId._id}` as never) : undefined
                    }
                    disabled={!post.authorId?._id}
                  >
                    <Text style={styles.feedAuthor}>{post.authorId?.name || "ORIN User"}</Text>
                  </TouchableOpacity>
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
              ))
            )}
          </View>
        </>
      ) : null}

      {FEATURE_FLAGS.dailyEngagement && activeSection === "network" ? (
        <>
          <Text style={styles.sectionHeader}>Daily Career Dashboard</Text>
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
                        {task.completed ? "Done: " : "- "}
                        {task.title} (+{task.xp} XP)
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

      {FEATURE_FLAGS.smartSuggestions && activeSection === "network" ? (
        <>
          <Text style={styles.sectionHeader}>People You May Know</Text>
          <View style={styles.suggestionWrap}>
            {suggestions.length === 0 ? (
              <Text style={styles.empty}>No suggestions available right now.</Text>
            ) : (
              suggestions.map((item, index) => (
                <View key={`${item.id}-${index}`} style={styles.suggestionCard}>
                  <Text style={styles.suggestionName}>{item.name}</Text>
                  <Text style={styles.suggestionReason}>{item.reason}</Text>
                  <View style={styles.suggestionActions}>
                    <Text style={styles.suggestionAction}>Connect</Text>
                    <Text style={styles.suggestionAction}>Follow</Text>
                  </View>
                </View>
              ))
            )}
          </View>
        </>
      ) : null}

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#1F7A4C" />
        </View>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {!isLoading && activeSection === "sessions" ? (
        <>
          <Text style={styles.sectionHeader}>Session History & Notes</Text>
          <View style={styles.historyWrap}>
            {sessionHistory.length === 0 ? (
              <Text style={styles.empty}>No completed sessions yet.</Text>
            ) : (
              sessionHistory.slice(0, 6).map((item) => (
                <View key={item.sessionId} style={styles.historyCard}>
                  <Text style={styles.historyTitle}>{item.mentorName}</Text>
                  <Text style={styles.historyMeta}>
                    {item.date} {item.time}
                  </Text>
                  <Text style={styles.historyMeta}>Notes: {item.notes?.trim() ? item.notes : "No notes yet."}</Text>
                  <View style={styles.historyActions}>
                    <TouchableOpacity style={styles.historyBtn} onPress={() => addQuickSessionNote(item.sessionId)}>
                      <Text style={styles.historyBtnText}>Add Note</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.historyBtn, styles.historyBtnPrimary]}
                      onPress={() => addQuickReview(item.sessionId)}
                    >
                      <Text style={[styles.historyBtnText, styles.historyBtnTextPrimary]}>Rate Mentor</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>

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
  searchResultList: { marginBottom: 10, gap: 6 },
  searchResultCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E4E7EC",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  searchResultTitle: { color: "#1E2B24", fontWeight: "700" },
  searchResultSubtitle: { marginTop: 2, color: "#667085", fontSize: 12 },
  searchAskAiBtn: {
    marginBottom: 10,
    alignSelf: "flex-start",
    backgroundColor: "#EEF4FF",
    borderWidth: 1,
    borderColor: "#D6E4FF",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7
  },
  searchAskAiBtnText: { color: "#1849A9", fontWeight: "700", fontSize: 12 },
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
  sectionNavRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  sectionChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#D0D5DD",
    backgroundColor: "#fff"
  },
  sectionChipActive: { borderColor: "#1F7A4C", backgroundColor: "#E8F5EE" },
  sectionChipText: { color: "#475467", fontWeight: "700", fontSize: 12 },
  sectionChipTextActive: { color: "#1F7A4C" },
  groupTitle: {
    marginTop: 8,
    marginBottom: 2,
    color: "#0F172A",
    fontWeight: "900",
    fontSize: 17
  },
  groupNote: {
    marginBottom: 8,
    color: "#667085",
    fontSize: 12,
    fontWeight: "500"
  },
  sectionHeader: { fontSize: 16, fontWeight: "800", color: "#1E2B24", marginBottom: 10 },
  newsTabRow: { paddingBottom: 4, gap: 8, marginBottom: 8 },
  newsTabChip: {
    borderWidth: 1,
    borderColor: "#D0D5DD",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#fff"
  },
  newsTabChipActive: { borderColor: "#1F7A4C", backgroundColor: "#E8F5EE" },
  newsTabText: { color: "#475467", fontWeight: "700", fontSize: 12 },
  newsTabTextActive: { color: "#1F7A4C" },
  newsRow: { paddingBottom: 6, gap: 10, marginBottom: 10 },
  newsLoaderWrap: {
    width: 240,
    height: 150,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E4E7EC",
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    gap: 8
  },
  newsCard: {
    width: 260,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E4E7EC",
    backgroundColor: "#FFFFFF",
    padding: 10
  },
  newsImage: { width: "100%", height: 132, borderRadius: 10, backgroundColor: "#EAECF0" },
  newsTitle: { marginTop: 8, color: "#13251E", fontWeight: "800", lineHeight: 19 },
  newsDesc: { marginTop: 5, color: "#667085", lineHeight: 17 },
  newsMetaRow: { marginTop: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  newsSource: { flex: 1, color: "#475467", fontWeight: "700", fontSize: 12 },
  newsReadMore: { color: "#175CD3", fontWeight: "800", fontSize: 12 },
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
  matchWrap: { gap: 9, marginBottom: 10 },
  matchCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D5E3FF",
    borderRadius: 12,
    padding: 12
  },
  matchName: { color: "#1E2B24", fontSize: 16, fontWeight: "800" },
  matchMeta: { marginTop: 3, color: "#667085" },
  matchScore: { marginTop: 6, color: "#165DFF", fontWeight: "800" },
  matchActions: { flexDirection: "row", gap: 8, marginTop: 10 },
  matchBtn: {
    borderRadius: 9,
    borderWidth: 1,
    borderColor: "#165DFF",
    paddingVertical: 8,
    paddingHorizontal: 12
  },
  matchBtnPrimary: { backgroundColor: "#165DFF" },
  matchBtnText: { color: "#165DFF", fontWeight: "700", fontSize: 12 },
  matchBtnTextPrimary: { color: "#FFFFFF" },
  historyWrap: { gap: 9, marginBottom: 10 },
  historyCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D8E4DE",
    borderRadius: 12,
    padding: 11
  },
  historyTitle: { color: "#1E2B24", fontWeight: "800" },
  historyMeta: { marginTop: 4, color: "#667085" },
  historyActions: { flexDirection: "row", gap: 8, marginTop: 8 },
  historyBtn: {
    borderWidth: 1,
    borderColor: "#1F7A4C",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7
  },
  historyBtnPrimary: { backgroundColor: "#1F7A4C" },
  historyBtnText: { color: "#1F7A4C", fontWeight: "700", fontSize: 12 },
  historyBtnTextPrimary: { color: "#FFFFFF" },
  roadmapCard: {
    backgroundColor: "#F4F8FF",
    borderWidth: 1,
    borderColor: "#D6E4FF",
    borderRadius: 12,
    padding: 12,
    marginBottom: 10
  },
  roadmapGoal: { color: "#1849A9", fontWeight: "800", marginBottom: 8 },
  roadmapStep: { color: "#344054", marginBottom: 4, fontWeight: "600" },
  opportunityWrap: { gap: 9, marginBottom: 10 },
  opportunityCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    padding: 11
  },
  opportunityTitle: { color: "#1E2B24", fontWeight: "800" },
  opportunityMeta: { marginTop: 3, color: "#667085" },
  leaderboardCard: {
    backgroundColor: "#FFF8F1",
    borderWidth: 1,
    borderColor: "#F9DBAF",
    borderRadius: 12,
    padding: 11,
    marginBottom: 10
  },
  leaderboardTitle: { color: "#B54708", fontWeight: "800", marginBottom: 6 },
  leaderboardRow: { color: "#7A2E0E", marginBottom: 3, fontWeight: "600" },
  liveWrap: { gap: 9, marginBottom: 10 },
  liveCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D5E9DB",
    borderRadius: 12,
    padding: 11
  },
  liveTitle: { color: "#1E2B24", fontWeight: "800" },
  liveMeta: { marginTop: 3, color: "#667085" },
  resumeCard: {
    backgroundColor: "#F8F5FF",
    borderWidth: 1,
    borderColor: "#DDD2FE",
    borderRadius: 12,
    padding: 11,
    marginBottom: 10
  },
  resumeTitle: { color: "#5925DC", fontWeight: "800" },
  resumeMeta: { marginTop: 4, color: "#6941C6" },
  resumeSnippet: { marginTop: 6, color: "#344054", lineHeight: 18 },
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
  dailyTaskRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6, gap: 8 },
  dailyTaskButton: { backgroundColor: "#175CD3", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  dailyTaskButtonDone: { backgroundColor: "#12B76A" },
  dailyTaskButtonText: { color: "#fff", fontWeight: "700", fontSize: 12 },
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



