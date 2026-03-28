import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { useAppTheme } from "@/context/ThemeContext";
import { notify } from "@/utils/notify";
import { pickAndUploadPostImage } from "@/utils/postMediaUpload";
import { pickAndUploadProgramDocument } from "@/utils/programDocumentUpload";
import GlobalHeader from "@/components/global-header";

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
  platformFeeAmount?: number;
  mentorPayoutAmount?: number;
  status?: string;
  paymentStatus: "pending" | "waiting_verification" | "verified" | "rejected" | "paid";
  sessionStatus: "booked" | "confirmed" | "completed";
  payoutStatus?: "not_ready" | "pending" | "paid" | "issue_reported";
  mentorPayoutConfirmationStatus?: "not_ready" | "pending" | "confirmed" | "issue_reported";
  payoutPaidAt?: string | null;
  payoutReference?: string;
  payoutNote?: string;
  mentorPayoutIssueNote?: string;
  canMentorConfirmPayout?: boolean;
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
  phoneNumber?: string;
  payoutUpiId?: string;
  payoutQrCodeUrl?: string;
  payoutPhoneNumber?: string;
  rating?: number;
  experienceYears?: number;
  specializations?: string[];
  totalSessionsConducted?: number;
  verifiedBadge?: boolean;
};

type MentorPayoutResponse = {
  summary: {
    totalSessions: number;
    lifetimeGross: number;
    platformFees: number;
    mentorEarnings: number;
    pendingPayoutAmount: number;
    paidOutAmount: number;
    confirmedReceivedAmount: number;
    issueAmount: number;
    payoutSetupComplete: boolean;
  };
  payoutSetup?: {
    upiId?: string;
    qrCodeUrl?: string;
    phoneNumber?: string;
  };
  sessions: Session[];
};

type VerifiedMentor = {
  mentorId: string;
  name: string;
  rating?: number;
  verifiedBadge?: boolean;
  title?: string;
};

type ChallengeItem = {
  id: string;
  title: string;
  domain?: string;
  deadline: string;
  participantsCount?: number;
};

type MentorGroupItem = {
  id: string;
  name: string;
  domain?: string;
  schedule?: string;
  membersCount?: number;
  mentor?: { id?: string | null; name?: string };
};

type ReputationSummary = {
  score: number;
  levelTag: string;
  topPercent: number;
};

type LiveSessionItem = {
  id: string;
  title: string;
  topic?: string;
  description?: string;
  startsAt: string;
  endsAt?: string | null;
  durationMinutes?: number;
  posterImageUrl?: string;
  interestedCount?: number;
  isInterested?: boolean;
  sessionMode?: "free" | "paid";
  price?: number;
  currency?: string;
  maxParticipants?: number;
  participantCount?: number;
  seatsLeft?: number;
  approvalStatus?: "pending" | "approved" | "rejected";
  adminReviewNote?: string;
  mentor?: { id?: string | null; name?: string };
};

type SprintScheduleItem = {
  label?: string;
  startsAt?: string | null;
  durationMinutes?: number;
};

type SprintItem = {
  id: string;
  title: string;
  domain?: string;
  description?: string;
  posterImageUrl?: string;
  curriculumDocumentUrl?: string;
  curriculumFileType?: string;
  startDate: string;
  endDate: string;
  durationWeeks?: number;
  totalLiveSessions?: number;
  sessionSchedule?: SprintScheduleItem[];
  weeklyPlan?: string[];
  outcomes?: string[];
  tools?: string[];
  sessionMode?: "free" | "paid";
  price?: number;
  currency?: string;
  minParticipants?: number;
  maxParticipants?: number;
  participantCount?: number;
  seatsLeft?: number;
  approvalStatus?: "pending" | "approved" | "rejected";
  adminReviewNote?: string;
};

type CertificationItem = {
  id: string;
  title: string;
  level?: string;
};

type NewsArticle = {
  title: string;
  description?: string;
  source?: string;
  imageUrl?: string;
  url?: string;
};

type SectionId = "overview" | "growth" | "pricing" | "availability" | "sessions" | "requests" | "adminChat";
type MentorGrowthSectionId = "reputation" | "live" | "community";

const sectionOrder: { id: SectionId; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "growth", label: "Growth & Community" },
  { id: "pricing", label: "Profile & Pricing" },
  { id: "availability", label: "Availability" },
  { id: "sessions", label: "Sessions" },
  { id: "requests", label: "Booking Requests" },
  { id: "adminChat", label: "Admin Chat" }
];

const mentorGrowthSections: { id: MentorGrowthSectionId; label: string }[] = [
  { id: "reputation", label: "Reputation" },
  { id: "live", label: "Programs" },
  { id: "community", label: "Community" }
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

function toMeridiemTime(timeStr: string) {
  const [hourRaw, minuteRaw] = String(timeStr || "").split(":");
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return timeStr;
  const normalizedHour = ((hour % 24) + 24) % 24;
  const meridiem = normalizedHour >= 12 ? "PM" : "AM";
  const displayHour = normalizedHour % 12 === 0 ? 12 : normalizedHour % 12;
  return `${displayHour}:${String(minute).padStart(2, "0")} ${meridiem}`;
}

function toTimeRangeLabel(startTime: string, endTime: string) {
  return `${toMeridiemTime(startTime)} - ${toMeridiemTime(endTime)}`;
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
  const params = useLocalSearchParams<{ section?: string; growth?: string }>();
  const { user, logout } = useAuth();
  const { colors } = useAppTheme();
  const scrollViewRef = useRef<ScrollView | null>(null);
  const [activeSection, setActiveSection] = useState<SectionId>("overview");
  const [mentorGrowthSection, setMentorGrowthSection] = useState<MentorGrowthSectionId>("reputation");
  const [panelAnchorY, setPanelAnchorY] = useState(0);
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
  const [payoutUpiId, setPayoutUpiId] = useState("");
  const [payoutQrCodeUrl, setPayoutQrCodeUrl] = useState("");
  const [payoutPhoneNumber, setPayoutPhoneNumber] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [chatMessage, setChatMessage] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [meetingLinks, setMeetingLinks] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profilePhotoUrl, setProfilePhotoUrl] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [verifiedMentors, setVerifiedMentors] = useState<VerifiedMentor[]>([]);
  const [challenges, setChallenges] = useState<ChallengeItem[]>([]);
  const [mentorGroups, setMentorGroups] = useState<MentorGroupItem[]>([]);
  const [reputationSummary, setReputationSummary] = useState<ReputationSummary | null>(null);
  const [liveSessions, setLiveSessions] = useState<LiveSessionItem[]>([]);
  const [sprints, setSprints] = useState<SprintItem[]>([]);
  const [certifications, setCertifications] = useState<CertificationItem[]>([]);
  const [mentorNews, setMentorNews] = useState<NewsArticle[]>([]);
  const [mentorNewsLoading, setMentorNewsLoading] = useState(false);
  const [liveTitle, setLiveTitle] = useState("");
  const [liveTopic, setLiveTopic] = useState("");
  const [liveDescription, setLiveDescription] = useState("");
  const [liveSessionDate, setLiveSessionDate] = useState(nextDates(14)[0]);
  const [liveSessionTime, setLiveSessionTime] = useState("18:00");
  const [livePosterImageUrl, setLivePosterImageUrl] = useState("");
  const [liveSessionMode, setLiveSessionMode] = useState<"free" | "paid">("free");
  const [liveSessionPrice, setLiveSessionPrice] = useState("499");
  const [liveSessionCapacity, setLiveSessionCapacity] = useState("50");
  const [liveSessionDuration, setLiveSessionDuration] = useState("60");
  const [uploadingLivePoster, setUploadingLivePoster] = useState(false);
  const [uploadingPayoutQr, setUploadingPayoutQr] = useState(false);
  const [creatingLiveSession, setCreatingLiveSession] = useState(false);
  const [sprintTitle, setSprintTitle] = useState("");
  const [sprintDomain, setSprintDomain] = useState("");
  const [sprintDescription, setSprintDescription] = useState("");
  const [sprintStartDate, setSprintStartDate] = useState(nextDates(14)[0]);
  const [sprintEndDate, setSprintEndDate] = useState(nextDates(14)[Math.min(13, nextDates(14).length - 1)]);
  const [sprintPosterImageUrl, setSprintPosterImageUrl] = useState("");
  const [sprintDocumentUrl, setSprintDocumentUrl] = useState("");
  const [sprintDocumentType, setSprintDocumentType] = useState("pdf");
  const [sprintMode, setSprintMode] = useState<"free" | "paid">("paid");
  const [sprintPrice, setSprintPrice] = useState("1999");
  const [sprintMinParticipants, setSprintMinParticipants] = useState("5");
  const [sprintMaxParticipants, setSprintMaxParticipants] = useState("20");
  const [sprintWeeks, setSprintWeeks] = useState("4");
  const [sprintLiveSessionsCount, setSprintLiveSessionsCount] = useState("4");
  const [sprintWeeklyPlan, setSprintWeeklyPlan] = useState("Week 1: Foundations\nWeek 2: Build\nWeek 3: Feedback\nWeek 4: Demo");
  const [sprintOutcomes, setSprintOutcomes] = useState("Portfolio project, Interview-ready sprint experience, Mentor feedback");
  const [sprintTools, setSprintTools] = useState("Zoom, GitHub, Figma, Python");
  const [uploadingSprintPoster, setUploadingSprintPoster] = useState(false);
  const [uploadingSprintDocument, setUploadingSprintDocument] = useState(false);
  const [creatingSprint, setCreatingSprint] = useState(false);
  const [mentorProfileSummary, setMentorProfileSummary] = useState<MentorProfilePayload | null>(null);
  const [mentorPayoutSummary, setMentorPayoutSummary] = useState<MentorPayoutResponse["summary"] | null>(null);
  const [mentorPayoutSessions, setMentorPayoutSessions] = useState<Session[]>([]);
  const calendarDateOptions = useMemo(() => nextDates(14), []);
  const liveSessionTimeOptions = useMemo(
    () => [
      "09:00",
      "10:00",
      "11:00",
      "12:00",
      "13:00",
      "14:00",
      "15:00",
      "16:00",
      "17:00",
      "18:00",
      "19:00",
      "20:00"
    ],
    []
  );
  const mentorServices = [
    {
      key: "live",
      label: "Programs",
      icon: "radio",
      tint: "#7C3AED",
      bg: "#F0E9FF",
      border: "#E1D5FF",
      onPress: () => {
        setActiveSection("growth");
        setMentorGrowthSection("live");
      }
    },
    {
      key: "requests",
      label: "Booking Requests",
      icon: "mail-open",
      tint: "#165DFF",
      bg: "#EAF2FF",
      border: "#D7E6FF",
      onPress: () => setActiveSection("requests")
    },
    {
      key: "availability",
      label: "Availability",
      icon: "calendar",
      tint: "#067647",
      bg: "#EAFBF2",
      border: "#CCF1DA",
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
      key: "pricing",
      label: "Pricing",
      icon: "cash",
      tint: "#B54708",
      bg: "#FFF4E8",
      border: "#F8DFC2",
      onPress: () => setActiveSection("pricing")
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
      key: "news",
      label: "News & Updates",
      icon: "newspaper",
      tint: "#344054",
      bg: "#F3F4F6",
      border: "#E5E7EB",
      onPress: () => router.push("/news-updates" as never)
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

  useEffect(() => {
    const section = String(params.section || "");
    if (section === "requests" || section === "sessions" || section === "pricing" || section === "availability" || section === "adminChat" || section === "overview" || section === "growth") {
      setActiveSection(section);
    }
    const growth = String(params.growth || "");
    if (section === "growth" && (growth === "reputation" || growth === "live" || growth === "community")) {
      setMentorGrowthSection(growth as MentorGrowthSectionId);
    }
  }, [params.section, params.growth]);
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
  const fetchDashboard = useCallback(async (refresh = false) => {
    try {
      if (refresh) setIsRefreshing(true);
      else setIsLoading(true);

      setError(null);
      const [
        bookingRes,
        sessionRes,
        profileRes,
        payoutRes,
        verifiedRes,
        challengeRes,
        groupRes,
        reputationRes,
        liveSessionRes,
        sprintRes,
        certificationsRes
      ] = await Promise.allSettled([
        api.get<Booking[]>("/api/bookings/mentor"),
        api.get<Session[]>("/api/sessions/mentor/me"),
        api.get<{ profile?: MentorProfilePayload }>("/api/profiles/mentor/me"),
        api.get<MentorPayoutResponse>("/api/sessions/mentor/payouts"),
        api.get<VerifiedMentor[]>("/api/network/verified-mentors"),
        api.get<ChallengeItem[]>("/api/network/challenges"),
        api.get<MentorGroupItem[]>("/api/network/mentor-groups"),
        api.get<ReputationSummary>("/api/network/reputation-summary"),
        api.get<LiveSessionItem[]>("/api/network/live-sessions"),
        api.get<SprintItem[]>("/api/network/sprints"),
        api.get<CertificationItem[]>("/api/network/certifications")
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
      setPayoutUpiId(profileRes.value.data?.profile?.payoutUpiId || "");
      setPayoutQrCodeUrl(profileRes.value.data?.profile?.payoutQrCodeUrl || "");
      setPayoutPhoneNumber(profileRes.value.data?.profile?.payoutPhoneNumber || profileRes.value.data?.profile?.phoneNumber || "");
      setMentorProfileSummary(profileRes.value.data?.profile || null);
      setMentorPayoutSummary(payoutRes.status === "fulfilled" ? payoutRes.value.data?.summary || null : null);
      setMentorPayoutSessions(payoutRes.status === "fulfilled" ? payoutRes.value.data?.sessions || [] : []);
      setVerifiedMentors(verifiedRes.status === "fulfilled" ? verifiedRes.value.data || [] : []);
      setChallenges(challengeRes.status === "fulfilled" ? challengeRes.value.data || [] : []);
      setMentorGroups(groupRes.status === "fulfilled" ? groupRes.value.data || [] : []);
      setReputationSummary(reputationRes.status === "fulfilled" ? reputationRes.value.data || null : null);
      setLiveSessions(liveSessionRes.status === "fulfilled" ? liveSessionRes.value.data || [] : []);
      setSprints(sprintRes.status === "fulfilled" ? sprintRes.value.data || [] : []);
      setCertifications(certificationsRes.status === "fulfilled" ? certificationsRes.value.data || [] : []);
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to load mentor dashboard.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [user?.id]);

  const fetchMentorNews = useCallback(async (refresh = false) => {
    try {
      setMentorNewsLoading(true);
      const response = await api.get<{
        categories?: Record<string, { articles?: NewsArticle[] }>;
      }>("/api/news?limit=6&language=en");
      const categories = response.data?.categories || {};
      const orderedArticles = [
        ...(categories.tech?.articles || []),
        ...(categories.edtech?.articles || []),
        ...(categories.opportunities?.articles || [])
      ]
        .filter((item) => item?.title)
        .slice(0, 6);
      setMentorNews(orderedArticles);
    } catch {
      setMentorNews([]);
    } finally {
      setMentorNewsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchDashboard();
      fetchMentorNews();
    }, [fetchDashboard, fetchMentorNews])
  );

  const pendingRequests = useMemo(
    () => bookings.filter((booking) => booking.status === "pending"),
    [bookings]
  );

  const upcomingSessions = useMemo(
    () =>
      sessions.filter((session) => {
        const fallbackStart = session.date && session.time ? new Date(`${session.date}T${session.time}:00.000Z`).getTime() : NaN;
        const startValue = session.scheduledStart ? new Date(session.scheduledStart).getTime() : fallbackStart;
        return Number.isFinite(startValue) && startValue >= Date.now() && session.sessionStatus !== "completed";
      }),
    [sessions]
  );

  const completedSessions = useMemo(
    () => sessions.filter((session) => session.sessionStatus === "completed" || session.status === "completed"),
    [sessions]
  );

  const studentsMentoredCount = useMemo(() => {
    const ids = new Set(
      sessions
        .map((session) => session.studentId?.email || session.studentId?.name || "")
        .filter(Boolean)
    );
    return ids.size;
  }, [sessions]);

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

  const pendingLiveApprovals = useMemo(
    () => liveSessions.filter((item) => item.approvalStatus === "pending").length,
    [liveSessions]
  );

  const approvedLiveSessionsCount = useMemo(
    () => liveSessions.filter((item) => item.approvalStatus === "approved").length,
    [liveSessions]
  );

  const pendingSprintApprovals = useMemo(
    () => sprints.filter((item) => item.approvalStatus === "pending").length,
    [sprints]
  );

  const approvedSprintsCount = useMemo(
    () => sprints.filter((item) => item.approvalStatus === "approved").length,
    [sprints]
  );

  const availableSlotCount = useMemo(
    () => availabilitySlots.length + dateSpecificSlots.length,
    [availabilitySlots.length, dateSpecificSlots.length]
  );

  const normalizedQuery = searchQuery.trim();
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

  const revealPanel = useCallback(() => {
    requestAnimationFrame(() => {
      scrollViewRef.current?.scrollTo({ y: Math.max(panelAnchorY - 8, 0), animated: true });
    });
  }, [panelAnchorY]);

  const openSection = useCallback(
    (section: SectionId, growthSection?: MentorGrowthSectionId) => {
      setActiveSection(section);
      if (growthSection) setMentorGrowthSection(growthSection);
      setTimeout(() => revealPanel(), 80);
    },
    [revealPanel]
  );
  const handleRefresh = useCallback(async () => {
    await Promise.all([fetchDashboard(true), fetchMentorNews(true)]);
  }, [fetchDashboard, fetchMentorNews]);

  function canSetMeetingLink(session: Session) {
    const start = session.scheduledStart ? new Date(session.scheduledStart).getTime() : NaN;
    if (!Number.isFinite(start)) return true;
    return Date.now() >= start - 5 * 60 * 1000;
  }

  function canMarkSessionCompleted(session: Session) {
    const start = session.scheduledStart ? new Date(session.scheduledStart).getTime() : NaN;
    const hasStarted = !Number.isFinite(start) || Date.now() >= start;
    const isPaid = session.paymentStatus === "paid" || session.paymentStatus === "verified";
    return hasStarted && isPaid && session.sessionStatus === "confirmed" && session.status === "confirmed";
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
        sessionPrice: parsedPrice,
        payoutUpiId: payoutUpiId.trim(),
        payoutQrCodeUrl: payoutQrCodeUrl.trim(),
        payoutPhoneNumber: payoutPhoneNumber.trim()
      });
      notify("Profile & pricing updated.");
      await fetchDashboard(true);
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to save mentor profile.");
    } finally {
      setSavingProfile(false);
    }
  }

  async function uploadPayoutQrCode() {
    try {
      setUploadingPayoutQr(true);
      setError(null);
      const uploadedUrl = await pickAndUploadPostImage();
      if (!uploadedUrl) return;
      setPayoutQrCodeUrl(uploadedUrl);
      notify("Payout QR uploaded.");
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || "Failed to upload payout QR.");
    } finally {
      setUploadingPayoutQr(false);
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

  async function markSessionCompleted(sessionId: string) {
    try {
      setError(null);
      await api.patch(`/api/sessions/${sessionId}/complete`);
      notify("Session marked as completed.");
      await fetchDashboard(true);
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to mark session completed.");
    }
  }

  async function confirmPayoutReceived(sessionId: string) {
    try {
      setError(null);
      await api.patch(`/api/sessions/${sessionId}/payout/confirm`);
      notify("Payout confirmed.");
      await fetchDashboard(true);
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to confirm payout.");
    }
  }

  async function reportPayoutIssue(sessionId: string) {
    try {
      setError(null);
      const note = "Payout not received or needs admin review";
      await api.patch(`/api/sessions/${sessionId}/payout/report-issue`, { issueNote: note });
      notify("Payout issue reported to admin.");
      await fetchDashboard(true);
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to report payout issue.");
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

  async function createMentorLiveSession() {
    const title = liveTitle.trim();
    const topic = liveTopic.trim();
    const description = liveDescription.trim();

    if (!title || !liveSessionDate || !liveSessionTime) {
      setError("Live session title and start time are required.");
      return;
    }
    const parsed = new Date(`${liveSessionDate}T${liveSessionTime}:00`);
    if (Number.isNaN(parsed.getTime())) {
      setError("Please select a valid date and time.");
      return;
    }

    try {
      setCreatingLiveSession(true);
      setError(null);
      await api.post("/api/network/live-sessions", {
        title,
        topic,
        description,
        posterImageUrl: livePosterImageUrl.trim(),
        startsAt: parsed.toISOString(),
        durationMinutes: Number(liveSessionDuration || 60),
        sessionMode: liveSessionMode,
        price: liveSessionMode === "paid" ? Number(liveSessionPrice || 0) : 0,
        maxParticipants: Number(liveSessionCapacity || 50)
      });
      setLiveTitle("");
      setLiveTopic("");
      setLiveDescription("");
      setLiveSessionDate(nextDates(14)[0]);
      setLiveSessionTime("18:00");
      setLivePosterImageUrl("");
      setLiveSessionMode("free");
      setLiveSessionPrice("499");
      setLiveSessionCapacity("50");
      setLiveSessionDuration("60");
      notify("Live session submitted for admin approval.");
      await fetchDashboard(true);
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to create live session.");
    } finally {
      setCreatingLiveSession(false);
    }
  }

  async function uploadLiveSessionPoster() {
    try {
      setUploadingLivePoster(true);
      setError(null);
      const uploadedUrl = await pickAndUploadPostImage();
      if (!uploadedUrl) return;
      setLivePosterImageUrl(uploadedUrl);
      notify("Poster uploaded.");
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || "Failed to upload poster.");
    } finally {
      setUploadingLivePoster(false);
    }
  }

  async function uploadSprintPoster() {
    try {
      setUploadingSprintPoster(true);
      setError(null);
      const uploadedUrl = await pickAndUploadPostImage();
      if (!uploadedUrl) return;
      setSprintPosterImageUrl(uploadedUrl);
      notify("Sprint poster uploaded.");
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || "Failed to upload sprint poster.");
    } finally {
      setUploadingSprintPoster(false);
    }
  }

  async function uploadSprintDocument() {
    try {
      setUploadingSprintDocument(true);
      setError(null);
      const uploaded = await pickAndUploadProgramDocument();
      if (!uploaded) return;
      setSprintDocumentUrl(uploaded.url);
      setSprintDocumentType(
        uploaded.mimeType?.includes("pdf")
          ? "pdf"
          : uploaded.mimeType?.includes("wordprocessingml")
            ? "docx"
            : "doc"
      );
      notify("Sprint curriculum uploaded.");
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || "Failed to upload curriculum.");
    } finally {
      setUploadingSprintDocument(false);
    }
  }

  async function createMentorSprint() {
    const title = sprintTitle.trim();
    const domain = sprintDomain.trim();
    const description = sprintDescription.trim();
    const weeklyPlan = sprintWeeklyPlan
      .split(/\r?\n/)
      .map((item) => item.trim())
      .filter(Boolean);

    if (!title || !domain || !description || !sprintPosterImageUrl.trim()) {
      setError("Sprint title, domain, description, and poster are required.");
      return;
    }

    try {
      setCreatingSprint(true);
      setError(null);
      await api.post("/api/network/sprints", {
        title,
        domain,
        description,
        posterImageUrl: sprintPosterImageUrl.trim(),
        curriculumDocumentUrl: sprintDocumentUrl.trim(),
        curriculumFileType: sprintDocumentType,
        startDate: new Date(`${sprintStartDate}T00:00:00`).toISOString(),
        endDate: new Date(`${sprintEndDate}T23:59:59`).toISOString(),
        durationWeeks: Number(sprintWeeks || 1),
        totalLiveSessions: Number(sprintLiveSessionsCount || 1),
        weeklyPlan,
        outcomes: sprintOutcomes.split(",").map((item) => item.trim()).filter(Boolean),
        tools: sprintTools.split(",").map((item) => item.trim()).filter(Boolean),
        sessionMode: sprintMode,
        price: sprintMode === "paid" ? Number(sprintPrice || 0) : 0,
        minParticipants: Number(sprintMinParticipants || 1),
        maxParticipants: Number(sprintMaxParticipants || 20)
      });
      setSprintTitle("");
      setSprintDomain("");
      setSprintDescription("");
      setSprintStartDate(nextDates(14)[0]);
      setSprintEndDate(nextDates(14)[Math.min(13, nextDates(14).length - 1)]);
      setSprintPosterImageUrl("");
      setSprintDocumentUrl("");
      setSprintDocumentType("pdf");
      setSprintMode("paid");
      setSprintPrice("1999");
      setSprintMinParticipants("5");
      setSprintMaxParticipants("20");
      setSprintWeeks("4");
      setSprintLiveSessionsCount("4");
      setSprintWeeklyPlan("Week 1: Foundations\nWeek 2: Build\nWeek 3: Feedback\nWeek 4: Demo");
      setSprintOutcomes("Portfolio project, Interview-ready sprint experience, Mentor feedback");
      setSprintTools("Zoom, GitHub, Figma, Python");
      notify("Sprint submitted for admin approval.");
      await fetchDashboard(true);
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to create sprint.");
    } finally {
      setCreatingSprint(false);
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
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GlobalHeader
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        onSubmitSearch={() => null}
        searchPlaceholder="Search students, sessions or chat"
      />
    <ScrollView
      ref={scrollViewRef}
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[styles.container, { backgroundColor: colors.background }]}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}
    >
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
        <Text style={styles.heroTitle}>Run Your Mentor Journey From One Place</Text>
        <Text style={styles.heroSubTitle}>
          Create sessions, review bookings, manage pricing, publish live events, and stay updated without hunting through the app.
        </Text>
      </View>

      <View style={styles.journeySummaryRow}>
        <View style={styles.journeySummaryChip}>
          <Text style={styles.journeySummaryValue}>{pendingRequests.length}</Text>
          <Text style={styles.journeySummaryLabel}>Requests</Text>
        </View>
        <View style={styles.journeySummaryChip}>
          <Text style={styles.journeySummaryValue}>{upcomingSessions.length}</Text>
          <Text style={styles.journeySummaryLabel}>Upcoming</Text>
        </View>
        <View style={styles.journeySummaryChip}>
          <Text style={styles.journeySummaryValue}>{pendingLiveApprovals}</Text>
          <Text style={styles.journeySummaryLabel}>Live Pending</Text>
        </View>
        <View style={styles.journeySummaryChip}>
          <Text style={styles.journeySummaryValue}>{availableSlotCount}</Text>
          <Text style={styles.journeySummaryLabel}>Open Slots</Text>
        </View>
      </View>

      <Text style={styles.sectionHeader}>Quick Actions</Text>
      <View style={styles.quickGrid}>
        {mentorServices.map((item) => (
          <TouchableOpacity key={item.key} style={[styles.quickTile, { borderColor: item.border }]} onPress={() => { item.onPress(); if (item.key !== "chat" && item.key !== "news") { setTimeout(() => revealPanel(), 80); } }}>
            <View style={[styles.iconBadge, { backgroundColor: item.bg }]}>
              <Ionicons name={item.icon} size={18} color={item.tint} />
            </View>
            <Text style={styles.quickTileTitle}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.sectionHeader}>Mentor Operations</Text>
      <View style={styles.focusStack}>
        <TouchableOpacity style={styles.focusCard} onPress={() => openSection("requests")}>
          <Text style={styles.focusCardTitle}>Booking Requests</Text>
          <Text style={styles.meta}>
            {pendingRequests.length > 0
              ? `${pendingRequests.length} student request${pendingRequests.length > 1 ? "s" : ""} waiting for your approval`
              : "No pending booking requests right now."}
          </Text>
          <Text style={styles.focusCardAccent}>Open request approvals</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.focusCard} onPress={() => openSection("sessions")}>
          <Text style={styles.focusCardTitle}>Upcoming Sessions</Text>
          <Text style={styles.meta}>
            {upcomingSessions.length > 0
              ? `${upcomingSessions.length} upcoming paid/confirmed session${upcomingSessions.length > 1 ? "s" : ""}`
              : "No upcoming sessions yet."}
          </Text>
          <Text style={styles.focusCardAccent}>Review sessions and meeting links</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.focusCard} onPress={() => openSection("availability")}>
          <Text style={styles.focusCardTitle}>Availability & Timing</Text>
          <Text style={styles.meta}>
            Weekly slots: {availabilitySlots.length} | Date slots: {dateSpecificSlots.length} | Blocked dates: {blockedDateList.length}
          </Text>
          <Text style={styles.focusCardAccent}>Open availability controls</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.focusCard} onPress={() => openSection("pricing")}>
          <Text style={styles.focusCardTitle}>Pricing & Profile</Text>
          <Text style={styles.meta}>
            Title: {mentorTitle || mentorProfileSummary?.title || "Not set"} | Fee: INR {sessionPrice}
          </Text>
          <Text style={styles.focusCardAccent}>Update mentor title and pricing</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionHeader}>Mentor Stats</Text>
      <View style={styles.metricsRow}>
        <View style={styles.metricCard}>
          <Text style={styles.metricValue}>{studentsMentoredCount}</Text>
          <Text style={styles.metricLabel}>Students Mentored</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricValue}>{Math.max(completedSessions.length, Number(mentorProfileSummary?.totalSessionsConducted || 0))}</Text>
          <Text style={styles.metricLabel}>Sessions Completed</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricValue}>{Number(mentorProfileSummary?.rating || 0).toFixed(1)}</Text>
          <Text style={styles.metricLabel}>Rating</Text>
        </View>
      </View>

      {mentorPayoutSummary ? (
        <>
          <Text style={styles.sectionHeader}>Earnings & Payouts</Text>
          <View style={styles.metricsRow}>
            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>INR {Math.round(mentorPayoutSummary.mentorEarnings || 0)}</Text>
              <Text style={styles.metricLabel}>Your Share</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>INR {Math.round(mentorPayoutSummary.pendingPayoutAmount || 0)}</Text>
              <Text style={styles.metricLabel}>Pending Payouts</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>INR {Math.round(mentorPayoutSummary.confirmedReceivedAmount || 0)}</Text>
              <Text style={styles.metricLabel}>Confirmed Received</Text>
            </View>
          </View>
        </>
      ) : null}

      <Text style={styles.sectionHeader}>My Programs</Text>
      <View style={styles.focusStack}>
        <TouchableOpacity
          style={styles.focusCard}
          onPress={() => openSection("growth", "live")}
        >
          <Text style={styles.focusCardTitle}>Manage Programs Pipeline</Text>
          <Text style={styles.meta}>
            Lives approved: {approvedLiveSessionsCount} | Sprint approvals: {pendingSprintApprovals} | Total programs: {liveSessions.length + sprints.length}
          </Text>
          <Text style={styles.focusCardAccent}>Create, price, schedule, and monitor live sessions plus cohort sprints</Text>
        </TouchableOpacity>
        {liveSessions.slice(0, 2).map((item) => (
          <TouchableOpacity
            key={item.id}
            style={styles.focusCard}
            onPress={() => openSection("growth", "live")}
          >
            <Text style={styles.focusCardTitle}>{item.title}</Text>
            <Text style={styles.meta}>
              {new Date(item.startsAt).toLocaleString()} | {item.sessionMode === "paid" ? `INR ${item.price || 0}` : "Free"}
            </Text>
            <Text style={styles.meta}>
              Seats: {item.participantCount || 0}/{item.maxParticipants || 50} | Status: {item.approvalStatus || "pending"}
            </Text>
            <Text style={styles.focusCardAccent}>Open live session controls</Text>
          </TouchableOpacity>
        ))}
        {sprints.slice(0, 2).map((item) => (
          <TouchableOpacity
            key={item.id}
            style={styles.focusCard}
            onPress={() => openSection("growth", "live")}
          >
            <Text style={styles.focusCardTitle}>{item.title}</Text>
            <Text style={styles.meta}>
              {new Date(item.startDate).toLocaleDateString()} - {new Date(item.endDate).toLocaleDateString()} | {item.sessionMode === "paid" ? `INR ${item.price || 0}` : "Free"}
            </Text>
            <Text style={styles.meta}>
              Seats: {item.participantCount || 0}/{item.maxParticipants || 20} | Status: {item.approvalStatus || "pending"}
            </Text>
            <Text style={styles.focusCardAccent}>Open sprint controls</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.sectionHeader}>Mentor News & Updates</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.newsRow}>
        {mentorNewsLoading && mentorNews.length === 0 ? (
          <View style={styles.newsStateCard}>
            <Text style={styles.meta}>Loading mentor updates...</Text>
          </View>
        ) : mentorNews.length === 0 ? (
          <View style={styles.newsStateCard}>
            <Text style={styles.meta}>No mentor news available right now.</Text>
          </View>
        ) : (
          mentorNews.map((item, index) => (
            <TouchableOpacity
              key={`${item.url || item.title}-${index}`}
              style={styles.newsCard}
              onPress={() => router.push("/news-updates" as never)}
            >
              <Text style={styles.newsTag}>Mentor Update</Text>
              <Text style={styles.newsTitle} numberOfLines={3}>{item.title}</Text>
              <Text style={styles.newsDesc} numberOfLines={3}>
                {item.description || "Tap to open the full News & Updates section."}
              </Text>
              <Text style={styles.newsSource}>{item.source || "ORIN News"}</Text>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      <Text style={styles.sectionHeader}>Mentor Guidance</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.featuredRow}>
        <TouchableOpacity style={[styles.featureCard, styles.featureCardOne]} onPress={() => openSection("availability")}>
          <Text style={styles.featurePill}>Plan</Text>
          <Text style={styles.featureTitle}>Weekly Slot Planning</Text>
          <Text style={styles.featureCopy}>Publish only the timings you want students to book.</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.featureCard, styles.featureCardTwo]} onPress={() => openSection("pricing")}>
          <Text style={styles.featurePill}>Earn</Text>
          <Text style={styles.featureTitle}>Smart Pricing Control</Text>
          <Text style={styles.featureCopy}>Set your profile title and session fee with full flexibility.</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.featureCard, styles.featureCardThree]} onPress={() => openSection("sessions")}>
          <Text style={styles.featurePill}>Deliver</Text>
          <Text style={styles.featureTitle}>Meet Link Workflow</Text>
          <Text style={styles.featureCopy}>Attach session links at the right time and keep delivery clean.</Text>
        </TouchableOpacity>
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.sectionNav} onLayout={(event) => setPanelAnchorY(event.nativeEvent.layout.y)}>
        <View style={styles.sectionNavRow}>
          {sectionOrder.map((section) => {
            const active = activeSection === section.id;
            return (
              <TouchableOpacity
                key={section.id}
                style={[styles.sectionChip, active && styles.sectionChipActive]}
                onPress={() => openSection(section.id)}
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

      {!isLoading && activeSection === "growth" ? (
        <View style={[styles.panel, styles.panelGrowth]}>
          <Text style={[styles.panelTitle, styles.panelTitleGrowth]}>Growth & Community</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sectionNavRow}>
            {mentorGrowthSections.map((item) => {
              const active = mentorGrowthSection === item.id;
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.sectionChip, active && styles.sectionChipActive]}
                  onPress={() => setMentorGrowthSection(item.id)}
                >
                  <Text style={[styles.sectionChipText, active && styles.sectionChipTextActive]}>{item.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {mentorGrowthSection === "reputation" ? (
            <>
          <Text style={styles.metaStrong}>Mentor Verification & Reputation</Text>
          <View style={styles.metricsRow}>
            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>{verifiedMentors.some((item) => item.mentorId === user.id && item.verifiedBadge) ? "Yes" : "No"}</Text>
              <Text style={styles.metricLabel}>Verified Badge</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>{Math.round(reputationSummary?.score || 0)}</Text>
              <Text style={styles.metricLabel}>Reputation Score</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>Top {reputationSummary?.topPercent ?? "-"}</Text>
              <Text style={styles.metricLabel}>Percentile</Text>
            </View>
          </View>
            </>
          ) : null}

          {mentorGrowthSection === "live" ? (
            <>
          <View style={styles.card}>
            <Text style={styles.title}>Create Live Mentor Session</Text>
            <Text style={styles.formFieldLabel}>Session Title</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. AI Career Roadmap Live Session"
              placeholderTextColor="#98A2B3"
              value={liveTitle}
              onChangeText={setLiveTitle}
            />
            <Text style={styles.formFieldLabel}>Topic</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Machine Learning for Beginners"
              placeholderTextColor="#98A2B3"
              value={liveTopic}
              onChangeText={setLiveTopic}
            />
            <Text style={styles.formFieldLabel}>Description</Text>
            <TextInput
              style={[styles.input, styles.textAreaInput]}
              placeholder="Tell students what this live session will cover and who should join."
              placeholderTextColor="#98A2B3"
              value={liveDescription}
              onChangeText={setLiveDescription}
              multiline
            />
            <Text style={styles.formFieldLabel}>Session Poster</Text>
            <Text style={styles.formFieldHint}>
              Add a banner or poster so students understand the session topic before they book.
            </Text>
            <TouchableOpacity style={styles.secondaryButton} onPress={uploadLiveSessionPoster} disabled={uploadingLivePoster}>
              <Text style={styles.secondaryButtonText}>
                {uploadingLivePoster ? "Uploading Poster..." : livePosterImageUrl ? "Change Poster" : "Upload Session Poster"}
              </Text>
            </TouchableOpacity>
            {livePosterImageUrl ? <Image source={{ uri: livePosterImageUrl }} style={styles.livePosterPreview} /> : null}
            <Text style={styles.formFieldLabel}>Select Date</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dateStrip}>
              {calendarDateOptions.map((date) => {
                const active = liveSessionDate === date;
                return (
                  <TouchableOpacity
                    key={`live-${date}`}
                    style={[styles.dateChip, active && styles.dateChipActive]}
                    onPress={() => setLiveSessionDate(date)}
                  >
                    <Text style={[styles.dateChipText, active && styles.dateChipTextActive]}>{toDateLabel(date)}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <Text style={styles.formFieldLabel}>Select Time</Text>
            <View style={styles.rowWrap}>
              {liveSessionTimeOptions.map((time) => {
                const active = liveSessionTime === time;
                return (
                  <TouchableOpacity
                    key={`live-time-${time}`}
                    style={[styles.dayChip, active && styles.dayChipActive]}
                    onPress={() => setLiveSessionTime(time)}
                  >
                    <Text style={[styles.dayChipText, active && styles.dayChipTextActive]}>{toMeridiemTime(time)}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={styles.formFieldHint}>
              Live session starts on {toDateLabel(liveSessionDate)} at {toMeridiemTime(liveSessionTime)}.
            </Text>
            <Text style={styles.formFieldLabel}>Session Type</Text>
            <View style={styles.rowWrap}>
              {(["free", "paid"] as const).map((mode) => {
                const active = liveSessionMode === mode;
                return (
                  <TouchableOpacity
                    key={`live-mode-${mode}`}
                    style={[styles.dayChip, active && styles.dayChipActive]}
                    onPress={() => setLiveSessionMode(mode)}
                  >
                    <Text style={[styles.dayChipText, active && styles.dayChipTextActive]}>
                      {mode === "paid" ? "Paid Session" : "Free Session"}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {liveSessionMode === "paid" ? (
              <>
                <Text style={styles.formFieldLabel}>Session Price (INR)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="499"
                  placeholderTextColor="#98A2B3"
                  value={liveSessionPrice}
                  onChangeText={setLiveSessionPrice}
                  keyboardType="numeric"
                />
              </>
            ) : null}
            <Text style={styles.formFieldLabel}>Maximum Participants</Text>
            <TextInput
              style={styles.input}
              placeholder="50"
              placeholderTextColor="#98A2B3"
              value={liveSessionCapacity}
              onChangeText={setLiveSessionCapacity}
              keyboardType="numeric"
            />
            <Text style={styles.formFieldLabel}>Duration (minutes)</Text>
            <TextInput
              style={styles.input}
              placeholder="60"
              placeholderTextColor="#98A2B3"
              value={liveSessionDuration}
              onChangeText={setLiveSessionDuration}
              keyboardType="numeric"
            />
            <TouchableOpacity style={styles.primaryButton} onPress={createMentorLiveSession} disabled={creatingLiveSession}>
              <Text style={styles.primaryButtonText}>{creatingLiveSession ? "Creating..." : "Create Live Session"}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.card}>
            <Text style={styles.title}>Upcoming Live Sessions</Text>
            {liveSessions.length === 0 ? (
              <Text style={styles.empty}>No live sessions scheduled.</Text>
            ) : (
              liveSessions.slice(0, 5).map((item) => (
                <View key={item.id} style={styles.liveSessionCard}>
                  {item.posterImageUrl ? <Image source={{ uri: item.posterImageUrl }} style={styles.liveSessionImage} /> : null}
                  <Text style={styles.liveSessionTitle}>{item.title}</Text>
                  <Text style={styles.meta}>{item.topic || "Live mentor session"}</Text>
                  {item.description ? <Text style={styles.meta}>{item.description}</Text> : null}
                  <Text style={styles.meta}>Date: {new Date(item.startsAt).toLocaleString()}</Text>
                  <Text style={styles.meta}>
                    Type: {item.sessionMode === "paid" ? `Paid | INR ${item.price || 0}` : "Free"} | Seats: {item.participantCount || 0}/{item.maxParticipants || 50}
                  </Text>
                  <Text style={styles.meta}>Interested learners: {item.interestedCount || 0}</Text>
                  <Text style={styles.meta}>Approval: {item.approvalStatus || "pending"}</Text>
                  {item.adminReviewNote ? <Text style={styles.meta}>Admin note: {item.adminReviewNote}</Text> : null}
                </View>
              ))
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.title}>Create Sprint Program</Text>
            <Text style={styles.formFieldLabel}>Sprint Title</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. AI Engineer Career Sprint"
              placeholderTextColor="#98A2B3"
              value={sprintTitle}
              onChangeText={setSprintTitle}
            />
            <Text style={styles.formFieldLabel}>Domain</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. AI, Web Development, Data Science"
              placeholderTextColor="#98A2B3"
              value={sprintDomain}
              onChangeText={setSprintDomain}
            />
            <Text style={styles.formFieldLabel}>Description</Text>
            <TextInput
              style={[styles.input, styles.textAreaInput]}
              placeholder="Explain what students will achieve, who this sprint is for, and how the cohort will run."
              placeholderTextColor="#98A2B3"
              value={sprintDescription}
              onChangeText={setSprintDescription}
              multiline
            />
            <Text style={styles.formFieldLabel}>Sprint Poster</Text>
            <Text style={styles.formFieldHint}>Poster is mandatory. This is the main visual students will trust first.</Text>
            <TouchableOpacity style={styles.secondaryButton} onPress={uploadSprintPoster} disabled={uploadingSprintPoster}>
              <Text style={styles.secondaryButtonText}>
                {uploadingSprintPoster ? "Uploading Poster..." : sprintPosterImageUrl ? "Change Sprint Poster" : "Upload Sprint Poster"}
              </Text>
            </TouchableOpacity>
            {sprintPosterImageUrl ? <Image source={{ uri: sprintPosterImageUrl }} style={styles.livePosterPreview} /> : null}

            <Text style={styles.formFieldLabel}>Curriculum Document (Optional PDF/DOC)</Text>
            <Text style={styles.formFieldHint}>Upload full syllabus or brochure so students can review the sprint before joining.</Text>
            <TouchableOpacity style={styles.secondaryButton} onPress={uploadSprintDocument} disabled={uploadingSprintDocument}>
              <Text style={styles.secondaryButtonText}>
                {uploadingSprintDocument ? "Uploading Curriculum..." : sprintDocumentUrl ? "Replace Curriculum Document" : "Upload Curriculum Document"}
              </Text>
            </TouchableOpacity>
            {sprintDocumentUrl ? <Text style={styles.formFieldHint}>Curriculum uploaded and ready for review.</Text> : null}

            <Text style={styles.formFieldLabel}>Sprint Start Date</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dateStrip}>
              {calendarDateOptions.map((date) => {
                const active = sprintStartDate === date;
                return (
                  <TouchableOpacity
                    key={`sprint-start-${date}`}
                    style={[styles.dateChip, active && styles.dateChipActive]}
                    onPress={() => setSprintStartDate(date)}
                  >
                    <Text style={[styles.dateChipText, active && styles.dateChipTextActive]}>{toDateLabel(date)}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <Text style={styles.formFieldLabel}>Sprint End Date</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dateStrip}>
              {calendarDateOptions.map((date) => {
                const active = sprintEndDate === date;
                return (
                  <TouchableOpacity
                    key={`sprint-end-${date}`}
                    style={[styles.dateChip, active && styles.dateChipActive]}
                    onPress={() => setSprintEndDate(date)}
                  >
                    <Text style={[styles.dateChipText, active && styles.dateChipTextActive]}>{toDateLabel(date)}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <Text style={styles.formFieldLabel}>Program Type</Text>
            <View style={styles.rowWrap}>
              {(["free", "paid"] as const).map((mode) => {
                const active = sprintMode === mode;
                return (
                  <TouchableOpacity
                    key={`sprint-mode-${mode}`}
                    style={[styles.dayChip, active && styles.dayChipActive]}
                    onPress={() => setSprintMode(mode)}
                  >
                    <Text style={[styles.dayChipText, active && styles.dayChipTextActive]}>
                      {mode === "paid" ? "Paid Sprint" : "Free Sprint"}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {sprintMode === "paid" ? (
              <>
                <Text style={styles.formFieldLabel}>Sprint Price (INR)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="1999"
                  placeholderTextColor="#98A2B3"
                  value={sprintPrice}
                  onChangeText={setSprintPrice}
                  keyboardType="numeric"
                />
              </>
            ) : null}
            <Text style={styles.formFieldLabel}>Minimum Participants</Text>
            <TextInput
              style={styles.input}
              placeholder="5"
              placeholderTextColor="#98A2B3"
              value={sprintMinParticipants}
              onChangeText={setSprintMinParticipants}
              keyboardType="numeric"
            />
            <Text style={styles.formFieldLabel}>Maximum Participants</Text>
            <TextInput
              style={styles.input}
              placeholder="20"
              placeholderTextColor="#98A2B3"
              value={sprintMaxParticipants}
              onChangeText={setSprintMaxParticipants}
              keyboardType="numeric"
            />
            <Text style={styles.formFieldLabel}>Duration (Weeks)</Text>
            <TextInput
              style={styles.input}
              placeholder="4"
              placeholderTextColor="#98A2B3"
              value={sprintWeeks}
              onChangeText={setSprintWeeks}
              keyboardType="numeric"
            />
            <Text style={styles.formFieldLabel}>Number of Live Sessions</Text>
            <TextInput
              style={styles.input}
              placeholder="4"
              placeholderTextColor="#98A2B3"
              value={sprintLiveSessionsCount}
              onChangeText={setSprintLiveSessionsCount}
              keyboardType="numeric"
            />
            <Text style={styles.formFieldLabel}>Weekly Plan</Text>
            <TextInput
              style={[styles.input, styles.textAreaInput]}
              placeholder={"Week 1: Foundations\nWeek 2: Project setup\nWeek 3: Feedback\nWeek 4: Demo"}
              placeholderTextColor="#98A2B3"
              value={sprintWeeklyPlan}
              onChangeText={setSprintWeeklyPlan}
              multiline
            />
            <Text style={styles.formFieldLabel}>Outcomes</Text>
            <TextInput
              style={styles.input}
              placeholder="Portfolio project, Mentor feedback, Sprint certificate"
              placeholderTextColor="#98A2B3"
              value={sprintOutcomes}
              onChangeText={setSprintOutcomes}
            />
            <Text style={styles.formFieldLabel}>Tools Used</Text>
            <TextInput
              style={styles.input}
              placeholder="Zoom, GitHub, Figma, Python"
              placeholderTextColor="#98A2B3"
              value={sprintTools}
              onChangeText={setSprintTools}
            />
            <TouchableOpacity style={styles.primaryButton} onPress={createMentorSprint} disabled={creatingSprint}>
              <Text style={styles.primaryButtonText}>{creatingSprint ? "Creating..." : "Create Sprint Program"}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.card}>
            <Text style={styles.title}>My Sprint Programs</Text>
            {sprints.length === 0 ? (
              <Text style={styles.empty}>No sprint programs submitted yet.</Text>
            ) : (
              sprints.slice(0, 5).map((item) => (
                <View key={item.id} style={styles.liveSessionCard}>
                  {item.posterImageUrl ? <Image source={{ uri: item.posterImageUrl }} style={styles.liveSessionImage} /> : null}
                  <Text style={styles.liveSessionTitle}>{item.title}</Text>
                  <Text style={styles.meta}>{item.domain || "Sprint Program"}</Text>
                  {item.description ? <Text style={styles.meta}>{item.description}</Text> : null}
                  <Text style={styles.meta}>
                    {new Date(item.startDate).toLocaleDateString()} - {new Date(item.endDate).toLocaleDateString()} | {item.durationWeeks || 1} weeks
                  </Text>
                  <Text style={styles.meta}>
                    Type: {item.sessionMode === "paid" ? `Paid | INR ${item.price || 0}` : "Free"} | Seats: {item.participantCount || 0}/{item.maxParticipants || 20}
                  </Text>
                  <Text style={styles.meta}>Approval: {item.approvalStatus || "pending"}</Text>
                  {item.curriculumDocumentUrl ? <Text style={styles.meta}>Curriculum uploaded</Text> : <Text style={styles.meta}>Curriculum optional</Text>}
                  {item.adminReviewNote ? <Text style={styles.meta}>Admin note: {item.adminReviewNote}</Text> : null}
                </View>
              ))
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.title}>Program Guidance</Text>
            {mentorBanners.map((banner) => (
              <View key={banner.key} style={[styles.inlineBanner, { backgroundColor: banner.bg, borderColor: banner.border }]}>
                <Text style={styles.bannerTag}>{banner.tag}</Text>
                <Text style={styles.bannerTitle}>{banner.title}</Text>
                <Text style={styles.bannerCopy}>{banner.copy}</Text>
              </View>
            ))}
          </View>
            </>
          ) : null}

          {mentorGrowthSection === "community" ? (
            <>
          <View style={styles.card}>
            <Text style={styles.title}>Community Challenges</Text>
            {challenges.length === 0 ? (
              <Text style={styles.empty}>No active challenges.</Text>
            ) : (
              challenges.slice(0, 5).map((item) => (
                <Text key={item.id} style={styles.meta}>
                  {item.title} | {item.participantsCount || 0} participants
                </Text>
              ))
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.title}>Mentor Groups</Text>
            {mentorGroups.length === 0 ? (
              <Text style={styles.empty}>No mentor groups available.</Text>
            ) : (
              mentorGroups
                .filter((group) => String(group.mentor?.id || "") === String(user.id))
                .slice(0, 5)
                .map((group) => (
                  <Text key={group.id} style={styles.meta}>
                    {group.name} | {group.membersCount || 0} students | {group.schedule || "Weekly"}
                  </Text>
                ))
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.title}>ORIN Certifications</Text>
            {certifications.length === 0 ? (
              <Text style={styles.empty}>No certifications listed yet.</Text>
            ) : (
              certifications.slice(0, 5).map((item) => (
                <Text key={item.id} style={styles.meta}>
                  {item.title} ({item.level || "Level"})
                </Text>
              ))
            )}
          </View>
            </>
          ) : null}
        </View>
      ) : null}

      {!isLoading && activeSection === "pricing" ? (
        <View style={[styles.panel, styles.panelPricing]}>
          <Text style={[styles.panelTitle, styles.panelTitlePricing]}>Profile, Pricing & Payouts</Text>
          <Text style={styles.meta}>Set your mentor title, session fee, and payout details so ORIN can pay you smoothly.</Text>
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
          <TextInput
            style={styles.input}
            placeholder="UPI ID for payouts"
            value={payoutUpiId}
            onChangeText={setPayoutUpiId}
          />
          <TextInput
            style={styles.input}
            placeholder="Phone number for payout reference"
            value={payoutPhoneNumber}
            onChangeText={setPayoutPhoneNumber}
            keyboardType="phone-pad"
          />
          <Text style={styles.formFieldLabel}>Payout QR Code</Text>
          <Text style={styles.formFieldHint}>Upload a QR if you want ORIN admin to have a quick manual payout option.</Text>
          {payoutQrCodeUrl ? <Image source={{ uri: payoutQrCodeUrl }} style={styles.livePosterPreview} /> : null}
          <TouchableOpacity style={styles.primaryButton} onPress={uploadPayoutQrCode} disabled={uploadingPayoutQr}>
            <Text style={styles.primaryButtonText}>{uploadingPayoutQr ? "Uploading..." : payoutQrCodeUrl ? "Change Payout QR" : "Upload Payout QR"}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.primaryButton} onPress={saveMentorProfilePricing} disabled={savingProfile}>
            <Text style={styles.primaryButtonText}>{savingProfile ? "Saving..." : "Save Profile & Price"}</Text>
          </TouchableOpacity>

          {mentorPayoutSummary ? (
            <View style={styles.card}>
              <Text style={styles.title}>Earnings Summary</Text>
              <Text style={styles.meta}>Gross paid by students: INR {mentorPayoutSummary.lifetimeGross}</Text>
              <Text style={styles.meta}>ORIN platform share: INR {mentorPayoutSummary.platformFees}</Text>
              <Text style={styles.meta}>Your total share: INR {mentorPayoutSummary.mentorEarnings}</Text>
              <Text style={styles.meta}>Pending payout amount: INR {mentorPayoutSummary.pendingPayoutAmount}</Text>
              <Text style={styles.meta}>Paid out by ORIN: INR {mentorPayoutSummary.paidOutAmount}</Text>
              <Text style={styles.meta}>
                Payout setup: {mentorPayoutSummary.payoutSetupComplete ? "Complete" : "Incomplete"}
              </Text>
            </View>
          ) : null}

          <View style={styles.card}>
            <Text style={styles.title}>Recent Payout Activity</Text>
            {mentorPayoutSessions.length === 0 ? (
              <Text style={styles.empty}>No paid sessions tracked yet.</Text>
            ) : (
              mentorPayoutSessions.slice(0, 5).map((session) => (
                <View key={`payout-${session._id}`} style={styles.liveSessionCard}>
                  <Text style={styles.liveSessionTitle}>{session.studentId?.name || "Student"}</Text>
                  <Text style={styles.meta}>
                    {session.date} {session.time} | Student paid INR {session.amount}
                  </Text>
                  <Text style={styles.meta}>
                    ORIN: INR {session.platformFeeAmount || 0} | You: INR {session.mentorPayoutAmount || 0}
                  </Text>
                  <Text style={styles.meta}>
                    Payout: {session.payoutStatus || "not_ready"} | Mentor confirmation: {session.mentorPayoutConfirmationStatus || "not_ready"}
                  </Text>
                  {session.payoutReference ? <Text style={styles.meta}>Reference: {session.payoutReference}</Text> : null}
                  {session.payoutNote ? <Text style={styles.meta}>Admin note: {session.payoutNote}</Text> : null}
                  {session.mentorPayoutIssueNote ? <Text style={styles.meta}>Issue: {session.mentorPayoutIssueNote}</Text> : null}
                  {session.canMentorConfirmPayout ? (
                    <View style={styles.actions}>
                      <TouchableOpacity style={[styles.actionButton, styles.approveButton]} onPress={() => confirmPayoutReceived(session._id)}>
                        <Text style={styles.actionText}>Confirm Received</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.actionButton, styles.rejectButton]} onPress={() => reportPayoutIssue(session._id)}>
                        <Text style={styles.actionText}>Report Issue</Text>
                      </TouchableOpacity>
                    </View>
                  ) : null}
                </View>
              ))
            )}
          </View>
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
                  {slot.day}: {toTimeRangeLabel(slot.startTime, slot.endTime)} ({slot.sessionDurationMinutes} min)
                </Text>
              ))}
            </>
          )}
          {dateSpecificSlots.length > 0 ? (
            <>
              <Text style={styles.metaStrong}>Date-Specific Slots</Text>
              {dateSpecificSlots.map((slot) => (
                <Text key={slot._id} style={styles.meta}>
                  {slot.specificDate} ({slot.day}): {toTimeRangeLabel(slot.startTime, slot.endTime)} ({slot.sessionDurationMinutes} min)
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
                {canMarkSessionCompleted(session) ? (
                  <TouchableOpacity style={styles.primaryButton} onPress={() => markSessionCompleted(session._id)}>
                    <Text style={styles.primaryButtonText}>Mark Session Completed</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ))
          )}

          <View style={styles.card}>
            <Text style={styles.title}>Completed Sessions & Payout Readiness</Text>
            {mentorPayoutSessions.filter((item) => item.sessionStatus === "completed" || item.status === "completed").length === 0 ? (
              <Text style={styles.empty}>No completed paid sessions yet.</Text>
            ) : (
              mentorPayoutSessions
                .filter((item) => item.sessionStatus === "completed" || item.status === "completed")
                .slice(0, 5)
                .map((session) => (
                  <View key={`completed-${session._id}`} style={styles.liveSessionCard}>
                    <Text style={styles.liveSessionTitle}>{session.studentId?.name || "Student"}</Text>
                    <Text style={styles.meta}>
                      {session.date} {session.time} | Your earning INR {session.mentorPayoutAmount || 0}
                    </Text>
                    <Text style={styles.meta}>
                      Payout: {session.payoutStatus || "not_ready"} | Mentor confirmation: {session.mentorPayoutConfirmationStatus || "not_ready"}
                    </Text>
                  </View>
                ))
            )}
          </View>
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
    </View>
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
  journeySummaryRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 14 },
  journeySummaryChip: {
    minWidth: "22%",
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D8E4DE",
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12
  },
  journeySummaryValue: { color: "#1F7A4C", fontWeight: "800", fontSize: 20 },
  journeySummaryLabel: { marginTop: 3, color: "#667085", fontWeight: "700", fontSize: 12 },
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
  inlineBanner: {
    marginTop: 10,
    borderWidth: 1,
    borderRadius: 14,
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
  newsRow: { gap: 10, marginBottom: 10, paddingBottom: 4 },
  newsStateCard: {
    width: 240,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D8E4DE",
    borderRadius: 16,
    padding: 14
  },
  newsCard: {
    width: 260,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D8E4DE",
    borderRadius: 16,
    padding: 14
  },
  newsTag: {
    alignSelf: "flex-start",
    backgroundColor: "#F5F3FF",
    color: "#5925DC",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    overflow: "hidden",
    fontSize: 11,
    fontWeight: "800",
    marginBottom: 8
  },
  newsTitle: { color: "#13251E", fontWeight: "800", fontSize: 16, lineHeight: 21 },
  newsDesc: { marginTop: 6, color: "#53635C", lineHeight: 18, fontWeight: "500" },
  newsSource: { marginTop: 10, color: "#667085", fontWeight: "700", fontSize: 12 },
  focusStack: { gap: 10, marginBottom: 10 },
  focusCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D8E4DE",
    borderRadius: 14,
    padding: 12
  },
  focusCardTitle: { color: "#1E2B24", fontWeight: "800", fontSize: 15 },
  focusCardAccent: { marginTop: 6, color: "#1F7A4C", fontWeight: "700", fontSize: 12 },
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
  panelGrowth: { backgroundColor: "#F8F5FF", borderColor: "#DDD2FE" },
  panelPricing: { backgroundColor: "#FFF7ED", borderColor: "#F7D8B3" },
  panelAvailability: { backgroundColor: "#ECFDF3", borderColor: "#CBECD9" },
  panelSessions: { backgroundColor: "#EEF4FF", borderColor: "#D4E2FF" },
  panelRequests: { backgroundColor: "#FDF2FA", borderColor: "#F7D0E8" },
  panelAdminChat: { backgroundColor: "#F5F3FF", borderColor: "#DED8FF" },
  panelTitle: { fontSize: 18, fontWeight: "800", color: "#1E2B24", marginBottom: 8 },
  panelTitleOverview: { color: "#175CD3" },
  panelTitleGrowth: { color: "#5925DC" },
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
  formFieldLabel: {
    color: "#344054",
    fontWeight: "700",
    marginTop: 4,
    marginBottom: 6
  },
  formFieldHint: {
    color: "#667085",
    fontSize: 12,
    lineHeight: 18,
    marginTop: -2,
    marginBottom: 8
  },
  textAreaInput: {
    minHeight: 92,
    textAlignVertical: "top"
  },
  livePosterPreview: {
    width: "100%",
    height: 180,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#DDE6E1",
    backgroundColor: "#F8FAFC"
  },
  liveSessionCard: {
    borderWidth: 1,
    borderColor: "#DDE6E1",
    borderRadius: 12,
    backgroundColor: "#FCFFFD",
    padding: 12,
    marginTop: 10,
    gap: 4
  },
  liveSessionImage: {
    width: "100%",
    height: 170,
    borderRadius: 10,
    marginBottom: 6,
    backgroundColor: "#F8FAFC"
  },
  liveSessionTitle: { color: "#1E2B24", fontWeight: "800", fontSize: 15 },
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

