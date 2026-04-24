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
import { getAppErrorMessage, handleAppError } from "@/lib/appError";
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
  meetingProvider?: "manual" | "jitsi";
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
  scope?: "global" | "institution" | "class";
  institutionName?: string;
  className?: string;
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
  meetingProvider?: "manual" | "jitsi";
  meetingLink?: string;
  maxParticipants?: number;
  participantCount?: number;
  seatsLeft?: number;
  approvalStatus?: "pending" | "approved" | "rejected";
  adminReviewNote?: string;
  mentor?: { id?: string | null; name?: string };
};
type InstitutionRoadmapItem = {
  id: string;
  title: string;
  description?: string;
  domain?: string;
  className?: string;
  status?: string;
  weeks: Array<{ id: string; title: string; tasks?: string[] }>;
};
type InstitutionRoadmapSubmissionItem = {
  id: string;
  roadmapId?: string;
  roadmapTitle: string;
  weekId: string;
  weekTitle: string;
  status: "submitted" | "accepted" | "rejected";
  proofText?: string;
  proofLink?: string;
  proofImageUrl?: string;
  submittedAt?: string;
  student?: {
    id?: string | null;
    name?: string;
    email?: string;
  };
  mentorReview?: {
    reviewedAt?: string | null;
    notes?: string;
    xpAwarded?: number;
    certificateId?: string | null;
  };
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
  meetingProvider?: "manual" | "jitsi";
  meetingLink?: string;
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

type SprintPayoutEnrollment = {
  _id: string;
  amount: number;
  platformFeeAmount?: number;
  mentorPayoutAmount?: number;
  paymentStatus?: "pending" | "paid" | "failed" | "cancelled";
  payoutStatus?: "not_ready" | "pending" | "paid" | "issue_reported";
  mentorPayoutConfirmationStatus?: "not_ready" | "pending" | "confirmed" | "issue_reported";
  payoutPaidAt?: string | null;
  payoutReference?: string;
  payoutNote?: string;
  mentorPayoutIssueNote?: string;
  canMentorConfirmPayout?: boolean;
  sprintId?: {
    _id?: string;
    title?: string;
    startDate?: string;
    endDate?: string;
    posterImageUrl?: string;
  };
  studentId?: {
    name?: string;
    email?: string;
  };
};

type MentorLiveSessionBookingRecord = {
  _id: string;
  amount?: number;
  currency?: string;
  createdAt?: string;
  studentId?: { _id: string; name: string; email: string };
  liveSessionId?: {
    _id: string;
    title?: string;
    startsAt?: string;
    sessionMode?: "free" | "paid";
    price?: number;
    currency?: string;
  };
};

type MentorSprintEnrollmentRecord = {
  _id: string;
  amount?: number;
  currency?: string;
  createdAt?: string;
  studentId?: { _id: string; name: string; email: string };
  sprintId?: {
    _id: string;
    title?: string;
    startDate?: string;
    endDate?: string;
    sessionMode?: "free" | "paid";
    price?: number;
    currency?: string;
  };
};

type MentorSprintPayoutResponse = {
  summary: {
    totalEnrollments: number;
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
  enrollments: SprintPayoutEnrollment[];
};

type CertificationItem = {
  id: string;
  title: string;
  level?: string;
};

type ManagedKnowledgeResource = {
  id: string;
  title: string;
  domain?: string;
  scope?: "global" | "institution" | "class";
  institutionName?: string;
  className?: string;
  approvalStatus?: string;
};

type KnowledgeResourceSubmissionItem = {
  id: string;
  resourceId?: string | null;
  resourceTitle: string;
  resourceDomain?: string;
  scope?: "global" | "institution" | "class";
  institutionName?: string;
  className?: string;
  status: "submitted" | "reviewed" | "accepted" | "rejected";
  proofText?: string;
  proofLink?: string;
  proofFiles?: string[];
  submittedAt?: string;
  student?: {
    id?: string | null;
    name?: string;
    email?: string;
  };
  mentorReview?: {
    reviewedAt?: string | null;
    notes?: string;
    xpAwarded?: number;
    certificateId?: string | null;
  };
};

type MentorCertificateTemplateItem = {
  id: string;
  title: string;
  templateKey: string;
  certificateType?: string;
  xpReward?: number;
  scope?: "global" | "institution" | "class";
  institutionName?: string;
  className?: string;
  isActive?: boolean;
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
type ProgramTabId = "live" | "sprint";

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

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value.filter((item) => item != null) as T[] : [];
}

export default function MentorDashboard() {
  const router = useRouter();
  const params = useLocalSearchParams<{ section?: string; growth?: string }>();
  const { user, logout } = useAuth();
  const { colors, isDark } = useAppTheme();
  const scrollViewRef = useRef<ScrollView | null>(null);
  const [activeSection, setActiveSection] = useState<SectionId>("overview");
  const [mentorGrowthSection, setMentorGrowthSection] = useState<MentorGrowthSectionId>("reputation");
  const [programTab, setProgramTab] = useState<ProgramTabId>("live");
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
  const [liveSessionLinks, setLiveSessionLinks] = useState<Record<string, string>>({});
  const [sprintMeetingLinks, setSprintMeetingLinks] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [verifiedMentors, setVerifiedMentors] = useState<VerifiedMentor[]>([]);
  const [challenges, setChallenges] = useState<ChallengeItem[]>([]);
  const [mentorResources, setMentorResources] = useState<ManagedKnowledgeResource[]>([]);
  const [mentorCertificateTemplates, setMentorCertificateTemplates] = useState<MentorCertificateTemplateItem[]>([]);
  const [mentorGroups, setMentorGroups] = useState<MentorGroupItem[]>([]);
  const [institutionRoadmaps, setInstitutionRoadmaps] = useState<InstitutionRoadmapItem[]>([]);
  const [reputationSummary, setReputationSummary] = useState<ReputationSummary | null>(null);
  const [liveSessions, setLiveSessions] = useState<LiveSessionItem[]>([]);
  const [sprints, setSprints] = useState<SprintItem[]>([]);
  const [paidLiveBookings, setPaidLiveBookings] = useState<MentorLiveSessionBookingRecord[]>([]);
  const [paidSprintEnrollments, setPaidSprintEnrollments] = useState<MentorSprintEnrollmentRecord[]>([]);
  const [certifications, setCertifications] = useState<CertificationItem[]>([]);
  const [institutionRoadmapTitle, setInstitutionRoadmapTitle] = useState("");
  const [institutionRoadmapDomain, setInstitutionRoadmapDomain] = useState("");
  const [institutionRoadmapClassName, setInstitutionRoadmapClassName] = useState("");
  const [institutionRoadmapDescription, setInstitutionRoadmapDescription] = useState("");
  const [institutionRoadmapWeekOne, setInstitutionRoadmapWeekOne] = useState("");
  const [institutionRoadmapWeekTwo, setInstitutionRoadmapWeekTwo] = useState("");
  const [institutionRoadmapWeekThree, setInstitutionRoadmapWeekThree] = useState("");
  const [creatingInstitutionRoadmap, setCreatingInstitutionRoadmap] = useState(false);
  const [resourceScope, setResourceScope] = useState<"global" | "institution" | "class">("institution");
  const [resourceTitle, setResourceTitle] = useState("");
  const [resourceDomain, setResourceDomain] = useState("");
  const [resourceClassName, setResourceClassName] = useState("");
  const [resourceDescription, setResourceDescription] = useState("");
  const [resourceUrl, setResourceUrl] = useState("");
  const [resourceDocumentUrl, setResourceDocumentUrl] = useState("");
  const [resourceBannerImageUrl, setResourceBannerImageUrl] = useState("");
  const [submittingResource, setSubmittingResource] = useState(false);
  const [challengeScope, setChallengeScope] = useState<"global" | "institution" | "class">("institution");
  const [challengeTitle, setChallengeTitle] = useState("");
  const [challengeDomain, setChallengeDomain] = useState("");
  const [challengeClassName, setChallengeClassName] = useState("");
  const [challengeDescription, setChallengeDescription] = useState("");
  const [challengeDeadline, setChallengeDeadline] = useState(nextDates(14)[0]);
  const [challengeBannerImageUrl, setChallengeBannerImageUrl] = useState("");
  const [challengeParticipantLimit, setChallengeParticipantLimit] = useState("100");
  const [challengeProofInstructions, setChallengeProofInstructions] = useState("");
  const [submittingChallenge, setSubmittingChallenge] = useState(false);
  const [templateScope, setTemplateScope] = useState<"global" | "institution" | "class">("institution");
  const [templateTitle, setTemplateTitle] = useState("");
  const [templateClassName, setTemplateClassName] = useState("");
  const [templateType, setTemplateType] = useState("manual");
  const [templateXpReward, setTemplateXpReward] = useState("0");
  const [templateDescription, setTemplateDescription] = useState("");
  const [submittingTemplate, setSubmittingTemplate] = useState(false);
  const [institutionRoadmapSubmissions, setInstitutionRoadmapSubmissions] = useState<InstitutionRoadmapSubmissionItem[]>([]);
  const [institutionReviewDrafts, setInstitutionReviewDrafts] = useState<Record<string, { xpAwarded: string; notes: string; issueCertificate: boolean }>>({});
  const [reviewingInstitutionSubmissionId, setReviewingInstitutionSubmissionId] = useState<string | null>(null);
  const [resourceSubmissions, setResourceSubmissions] = useState<KnowledgeResourceSubmissionItem[]>([]);
  const [resourceReviewDrafts, setResourceReviewDrafts] = useState<Record<string, { xpAwarded: string; notes: string; issueCertificate: boolean }>>({});
  const [reviewingResourceSubmissionId, setReviewingResourceSubmissionId] = useState<string | null>(null);
  const [mentorNews, setMentorNews] = useState<NewsArticle[]>([]);
  const [mentorNewsLoading, setMentorNewsLoading] = useState(false);
  const [liveTitle, setLiveTitle] = useState("");
  const [liveTopic, setLiveTopic] = useState("");
  const [liveDescription, setLiveDescription] = useState("");
  const [liveSessionDate, setLiveSessionDate] = useState(nextDates(14)[0]);
  const [liveSessionTime, setLiveSessionTime] = useState("18:00");
  const [livePosterImageUrl, setLivePosterImageUrl] = useState("");
  const [liveMeetingProvider, setLiveMeetingProvider] = useState<"manual" | "jitsi">("manual");
  const [liveMeetingLink, setLiveMeetingLink] = useState("");
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
  const [sprintMeetingProvider, setSprintMeetingProvider] = useState<"manual" | "jitsi">("manual");
  const [sprintMeetingLink, setSprintMeetingLink] = useState("");
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
  const [mentorSprintPayoutSummary, setMentorSprintPayoutSummary] = useState<MentorSprintPayoutResponse["summary"] | null>(null);
  const [mentorSprintPayouts, setMentorSprintPayouts] = useState<SprintPayoutEnrollment[]>([]);
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

  const createInstitutionRoadmap = useCallback(async () => {
    const weeks = [institutionRoadmapWeekOne, institutionRoadmapWeekTwo, institutionRoadmapWeekThree]
      .map((title, index) => ({
        id: `week-${index + 1}`,
        title: String(title || "").trim(),
        tasks: [`Complete ${String(title || `week ${index + 1}`).trim()} tasks`, "Submit proof to mentor", "Review linked resources"]
      }))
      .filter((item) => item.title);

    if (!institutionRoadmapTitle.trim() || !weeks.length) {
      notify("Add a roadmap title and at least one week.");
      return;
    }

    try {
      setCreatingInstitutionRoadmap(true);
      await api.post("/api/network/institution-roadmaps", {
        title: institutionRoadmapTitle.trim(),
        description: institutionRoadmapDescription.trim(),
        domain: institutionRoadmapDomain.trim(),
        className: institutionRoadmapClassName.trim(),
        weeks
      });
      setInstitutionRoadmapTitle("");
      setInstitutionRoadmapDescription("");
      setInstitutionRoadmapDomain("");
      setInstitutionRoadmapClassName("");
      setInstitutionRoadmapWeekOne("");
      setInstitutionRoadmapWeekTwo("");
      setInstitutionRoadmapWeekThree("");
      notify("Institution roadmap created.");
      await fetchDashboard(true);
    } catch (e: any) {
      handleAppError(e, { fallbackMessage: "Unable to create institution roadmap right now." });
    } finally {
      setCreatingInstitutionRoadmap(false);
    }
  }, [
    fetchDashboard,
    institutionRoadmapClassName,
    institutionRoadmapDescription,
    institutionRoadmapDomain,
    institutionRoadmapTitle,
    institutionRoadmapWeekOne,
    institutionRoadmapWeekThree,
    institutionRoadmapWeekTwo
  ]);

  const submitMentorResource = useCallback(async () => {
    if (!resourceTitle.trim()) {
      notify("Add a resource title first.");
      return;
    }
    try {
      setSubmittingResource(true);
      await api.post("/api/network/knowledge-library/submit", {
        title: resourceTitle.trim(),
        domain: resourceDomain.trim(),
        className: resourceScope === "class" ? resourceClassName.trim() : "",
        description: resourceDescription.trim(),
        url: resourceUrl.trim(),
        documentUrl: resourceDocumentUrl.trim(),
        bannerImageUrl: resourceBannerImageUrl.trim(),
        scope: resourceScope,
        type: "other"
      });
      setResourceTitle("");
      setResourceDomain("");
      setResourceClassName("");
      setResourceDescription("");
      setResourceUrl("");
      setResourceDocumentUrl("");
      setResourceBannerImageUrl("");
      notify("Resource submitted for review.");
      await fetchDashboard(true);
    } catch (e: any) {
      handleAppError(e, { fallbackMessage: "Unable to submit mentor resource right now." });
    } finally {
      setSubmittingResource(false);
    }
  }, [fetchDashboard, resourceBannerImageUrl, resourceClassName, resourceDescription, resourceDocumentUrl, resourceDomain, resourceScope, resourceTitle, resourceUrl]);

  const submitMentorChallenge = useCallback(async () => {
    if (!challengeTitle.trim() || !challengeDeadline) {
      notify("Add a competition title and deadline.");
      return;
    }
    try {
      setSubmittingChallenge(true);
      await api.post("/api/network/challenges/submit", {
        title: challengeTitle.trim(),
        domain: challengeDomain.trim(),
        className: challengeScope === "class" ? challengeClassName.trim() : "",
        description: challengeDescription.trim(),
        deadline: challengeDeadline,
        bannerImageUrl: challengeBannerImageUrl.trim(),
        participantLimit: Number(challengeParticipantLimit || 0),
        proofInstructions: challengeProofInstructions.trim(),
        scope: challengeScope
      });
      setChallengeTitle("");
      setChallengeDomain("");
      setChallengeClassName("");
      setChallengeDescription("");
      setChallengeBannerImageUrl("");
      setChallengeParticipantLimit("100");
      setChallengeProofInstructions("");
      notify("Competition submitted for review.");
      await fetchDashboard(true);
    } catch (e: any) {
      handleAppError(e, { fallbackMessage: "Unable to submit competition right now." });
    } finally {
      setSubmittingChallenge(false);
    }
  }, [challengeBannerImageUrl, challengeClassName, challengeDeadline, challengeDescription, challengeDomain, challengeParticipantLimit, challengeProofInstructions, challengeScope, challengeTitle, fetchDashboard]);

  const saveMentorCertificateTemplate = useCallback(async () => {
    if (!templateTitle.trim()) {
      notify("Add a certificate template title.");
      return;
    }
    try {
      setSubmittingTemplate(true);
      await api.post("/api/network/certificate-templates/mentor", {
        title: templateTitle.trim(),
        className: templateScope === "class" ? templateClassName.trim() : "",
        description: templateDescription.trim(),
        xpReward: Number(templateXpReward || 0),
        certificateType: templateType,
        scope: templateScope
      });
      setTemplateTitle("");
      setTemplateClassName("");
      setTemplateDescription("");
      setTemplateXpReward("0");
      setTemplateType("manual");
      notify("Certificate template saved.");
      await fetchDashboard(true);
    } catch (e: any) {
      handleAppError(e, { fallbackMessage: "Unable to save certificate template right now." });
    } finally {
      setSubmittingTemplate(false);
    }
  }, [fetchDashboard, templateClassName, templateDescription, templateScope, templateTitle, templateType, templateXpReward]);

  const uploadMentorResourceBanner = useCallback(async () => {
    try {
      const url = await pickAndUploadPostImage();
      if (!url) return;
      setResourceBannerImageUrl(url);
    } catch (e: any) {
      handleAppError(e, { fallbackMessage: "Unable to upload resource banner." });
    }
  }, []);

  const uploadMentorResourceDocument = useCallback(async () => {
    try {
      const uploaded = await pickAndUploadProgramDocument();
      if (!uploaded?.url) return;
      setResourceDocumentUrl(uploaded.url);
    } catch (e: any) {
      handleAppError(e, { fallbackMessage: "Unable to upload resource document." });
    }
  }, []);

  const uploadMentorChallengeBanner = useCallback(async () => {
    try {
      const url = await pickAndUploadPostImage();
      if (!url) return;
      setChallengeBannerImageUrl(url);
    } catch (e: any) {
      handleAppError(e, { fallbackMessage: "Unable to upload competition banner." });
    }
  }, []);

  const updateInstitutionReviewDraft = useCallback((submissionId: string, patch: Partial<{ xpAwarded: string; notes: string; issueCertificate: boolean }>) => {
    setInstitutionReviewDrafts((prev) => ({
      ...prev,
      [submissionId]: {
        xpAwarded: prev[submissionId]?.xpAwarded || "",
        notes: prev[submissionId]?.notes || "",
        issueCertificate: prev[submissionId]?.issueCertificate || false,
        ...patch
      }
    }));
  }, []);

  const reviewInstitutionSubmission = useCallback(async (submissionId: string, status: "accepted" | "rejected") => {
    const draft = institutionReviewDrafts[submissionId] || { xpAwarded: "", notes: "", issueCertificate: false };
    try {
      setReviewingInstitutionSubmissionId(submissionId);
      await api.patch(`/api/network/institution-roadmaps/submissions/${encodeURIComponent(submissionId)}/review`, {
        status,
        xpAwarded: status === "accepted" ? Number(draft.xpAwarded || 0) : 0,
        notes: draft.notes,
        issueCertificate: status === "accepted" ? draft.issueCertificate : false
      });
      notify(status === "accepted" ? "Submission approved." : "Submission sent back for rework.");
      await fetchDashboard(true);
    } catch (e: any) {
      handleAppError(e, { fallbackMessage: "Unable to review institution roadmap submission right now." });
    } finally {
      setReviewingInstitutionSubmissionId(null);
    }
  }, [fetchDashboard, institutionReviewDrafts]);

  const updateResourceReviewDraft = useCallback((submissionId: string, patch: Partial<{ xpAwarded: string; notes: string; issueCertificate: boolean }>) => {
    setResourceReviewDrafts((prev) => ({
      ...prev,
      [submissionId]: {
        xpAwarded: prev[submissionId]?.xpAwarded || "",
        notes: prev[submissionId]?.notes || "",
        issueCertificate: prev[submissionId]?.issueCertificate || false,
        ...patch
      }
    }));
  }, []);

  const reviewResourceSubmission = useCallback(async (submissionId: string, status: "accepted" | "rejected") => {
    const draft = resourceReviewDrafts[submissionId] || { xpAwarded: "", notes: "", issueCertificate: false };
    try {
      setReviewingResourceSubmissionId(submissionId);
      await api.patch(`/api/network/knowledge-library/submissions/${encodeURIComponent(submissionId)}/review`, {
        status,
        xpAwarded: status === "accepted" ? Number(draft.xpAwarded || 0) : 0,
        notes: draft.notes,
        issueCertificate: status === "accepted" ? draft.issueCertificate : false
      });
      notify(status === "accepted" ? "Resource work approved." : "Resource work sent back for updates.");
      await fetchDashboard(true);
    } catch (e: any) {
      handleAppError(e, { fallbackMessage: "Unable to review resource submission right now." });
    } finally {
      setReviewingResourceSubmissionId(null);
    }
  }, [fetchDashboard, resourceReviewDrafts]);

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
        sprintPayoutRes,
        verifiedRes,
        challengeRes,
        resourceRes,
        resourceSubmissionRes,
        certificateTemplateRes,
        groupRes,
        institutionRoadmapsRes,
        institutionRoadmapSubmissionsRes,
        reputationRes,
        liveSessionRes,
        sprintRes,
        certificationsRes,
        livePaidRes,
        sprintPaidRes
      ] = await Promise.allSettled([
        api.get<Booking[]>("/api/bookings/mentor"),
        api.get<Session[]>("/api/sessions/mentor/me"),
        api.get<{ profile?: MentorProfilePayload }>("/api/profiles/mentor/me"),
        api.get<MentorPayoutResponse>("/api/sessions/mentor/payouts"),
        api.get<MentorSprintPayoutResponse>("/api/network/sprints/mentor/payouts"),
        api.get<VerifiedMentor[]>("/api/network/verified-mentors"),
        api.get<ChallengeItem[]>("/api/network/challenges"),
        api.get<ManagedKnowledgeResource[]>("/api/network/knowledge-library/mine"),
        api.get<KnowledgeResourceSubmissionItem[]>("/api/network/knowledge-library/submissions/mentor"),
        api.get<MentorCertificateTemplateItem[]>("/api/network/certificate-templates/mentor"),
        api.get<MentorGroupItem[]>("/api/network/mentor-groups"),
        api.get<{ roadmaps: InstitutionRoadmapItem[] }>("/api/network/institution-roadmaps"),
        api.get<InstitutionRoadmapSubmissionItem[]>("/api/network/institution-roadmaps/submissions/mentor"),
        api.get<ReputationSummary>("/api/network/reputation-summary"),
        api.get<LiveSessionItem[]>("/api/network/live-sessions"),
        api.get<SprintItem[]>("/api/network/sprints"),
        api.get<CertificationItem[]>("/api/network/certifications"),
        api.get<MentorLiveSessionBookingRecord[]>("/api/network/live-sessions/bookings/mentor"),
        api.get<MentorSprintEnrollmentRecord[]>("/api/network/sprints/enrollments/mentor")
      ]);

      if (bookingRes.status !== "fulfilled" || sessionRes.status !== "fulfilled" || profileRes.status !== "fulfilled") {
        throw new Error("Failed to load required mentor dashboard data");
      }

      let adminMessages: AdminChatMessage[] = [];
      try {
        const chatRes = await api.get<{ messages: AdminChatMessage[] }>("/api/chat/messages/admin");
        adminMessages = asArray<AdminChatMessage>(chatRes.data.messages);
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
        setAvailabilitySlots(asArray<AvailabilitySlot>(availabilityRes.data.weeklySlots));
        setDateSpecificSlots(asArray<AvailabilitySlot>(availabilityRes.data.dateSlots));
        setBlockedDateList(
          asArray<{ blockedDate?: string }>(availabilityRes.data.blockedDates)
            .map((item) => item?.blockedDate || "")
            .filter(Boolean)
        );
      }

      setBookings(asArray<Booking>(bookingRes.value.data));
      setSessions(asArray<Session>(sessionRes.value.data));
      setMessages(adminMessages);
      setSessionPrice(String(Number(profileRes.value.data?.profile?.sessionPrice || 0) || 499));
      setMentorTitle(profileRes.value.data?.profile?.title || "");
      setPayoutUpiId(profileRes.value.data?.profile?.payoutUpiId || "");
      setPayoutQrCodeUrl(profileRes.value.data?.profile?.payoutQrCodeUrl || "");
      setPayoutPhoneNumber(profileRes.value.data?.profile?.payoutPhoneNumber || profileRes.value.data?.profile?.phoneNumber || "");
      setMentorProfileSummary(profileRes.value.data?.profile || null);
      setMentorPayoutSummary(payoutRes.status === "fulfilled" ? payoutRes.value.data?.summary || null : null);
      setMentorPayoutSessions(payoutRes.status === "fulfilled" ? asArray<MentorPayoutSessionRecord>(payoutRes.value.data?.sessions) : []);
      setMentorSprintPayoutSummary(sprintPayoutRes.status === "fulfilled" ? sprintPayoutRes.value.data?.summary || null : null);
      setMentorSprintPayouts(sprintPayoutRes.status === "fulfilled" ? asArray<MentorSprintEnrollmentRecord>(sprintPayoutRes.value.data?.enrollments) : []);
      setVerifiedMentors(verifiedRes.status === "fulfilled" ? asArray<VerifiedMentor>(verifiedRes.value.data) : []);
      setChallenges(challengeRes.status === "fulfilled" ? asArray<ChallengeItem>(challengeRes.value.data) : []);
      setMentorResources(resourceRes.status === "fulfilled" ? asArray<ManagedKnowledgeResource>(resourceRes.value.data) : []);
      setResourceSubmissions(resourceSubmissionRes.status === "fulfilled" ? asArray<KnowledgeResourceSubmissionItem>(resourceSubmissionRes.value.data) : []);
      setMentorCertificateTemplates(certificateTemplateRes.status === "fulfilled" ? asArray<MentorCertificateTemplateItem>(certificateTemplateRes.value.data) : []);
      setMentorGroups(groupRes.status === "fulfilled" ? asArray<MentorGroupItem>(groupRes.value.data) : []);
      setInstitutionRoadmaps(institutionRoadmapsRes.status === "fulfilled" ? asArray<InstitutionRoadmapItem>(institutionRoadmapsRes.value.data?.roadmaps) : []);
      setInstitutionRoadmapSubmissions(institutionRoadmapSubmissionsRes.status === "fulfilled" ? asArray<InstitutionRoadmapSubmissionItem>(institutionRoadmapSubmissionsRes.value.data) : []);
      setReputationSummary(reputationRes.status === "fulfilled" ? reputationRes.value.data || null : null);
      setLiveSessions(liveSessionRes.status === "fulfilled" ? asArray<LiveSessionItem>(liveSessionRes.value.data) : []);
      setSprints(sprintRes.status === "fulfilled" ? asArray<SprintItem>(sprintRes.value.data) : []);
      setCertifications(certificationsRes.status === "fulfilled" ? asArray<CertificationItem>(certificationsRes.value.data) : []);
      setPaidLiveBookings(livePaidRes.status === "fulfilled" ? asArray<MentorLiveSessionBookingRecord>(livePaidRes.value.data) : []);
      setPaidSprintEnrollments(sprintPaidRes.status === "fulfilled" ? asArray<MentorSprintEnrollmentRecord>(sprintPaidRes.value.data) : []);
    } catch (e: any) {
      setError(getAppErrorMessage(e, "Failed to load mentor dashboard."));
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
    () => bookings.filter((booking) => booking?.status === "pending"),
    [bookings]
  );

  const upcomingSessions = useMemo(
    () =>
      sessions.filter((session) => {
        if (!session) return false;
        const fallbackStart = session.date && session.time ? new Date(`${session.date}T${session.time}:00.000Z`).getTime() : NaN;
        const startValue = session.scheduledStart ? new Date(session.scheduledStart).getTime() : fallbackStart;
        return Number.isFinite(startValue) && startValue >= Date.now() && session.sessionStatus !== "completed";
      }),
    [sessions]
  );

  const completedSessions = useMemo(
    () => sessions.filter((session) => session && (session.sessionStatus === "completed" || session.status === "completed")),
    [sessions]
  );

  const studentsMentoredCount = useMemo(() => {
    const ids = new Set(
      sessions
        .map((session) => session?.studentId?.email || session?.studentId?.name || "")
        .filter(Boolean)
    );
    return ids.size;
  }, [sessions]);

  const confirmedPaidSessions = useMemo(
    () =>
      sessions.filter(
        (session) =>
          session &&
          session.sessionStatus === "confirmed" &&
          (session.paymentStatus === "paid" || session.paymentStatus === "verified")
      ),
    [sessions]
  );

  const filteredConfirmedPaidSessions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return confirmedPaidSessions;
    return confirmedPaidSessions.filter((session) => {
      const studentName = (session?.studentId?.name || "").toLowerCase();
      const studentEmail = (session?.studentId?.email || "").toLowerCase();
      const date = (session?.date || "").toLowerCase();
      const time = (session?.time || "").toLowerCase();
      const paymentStatus = (session?.paymentStatus || "").toLowerCase();
      const sessionStatus = (session?.sessionStatus || "").toLowerCase();
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
      const studentName = (booking?.student?.name || "").toLowerCase();
      const studentEmail = (booking?.student?.email || "").toLowerCase();
      const scheduledAt = new Date(booking?.scheduledAt || "").toLocaleString().toLowerCase();
      const status = (booking?.status || "").toLowerCase();
      const notes = (booking?.notes || "").toLowerCase();
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
    return messages.filter((msg) => String(msg?.text || "").toLowerCase().includes(query));
  }, [messages, searchQuery]);

  const pendingLiveApprovals = useMemo(
    () => liveSessions.filter((item) => item?.approvalStatus === "pending").length,
    [liveSessions]
  );

  const approvedLiveSessionsCount = useMemo(
    () => liveSessions.filter((item) => item?.approvalStatus === "approved").length,
    [liveSessions]
  );

  const pendingSprintApprovals = useMemo(
    () => sprints.filter((item) => item?.approvalStatus === "pending").length,
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

  const themedCardStyle = useMemo(
    () => ({ backgroundColor: colors.surface, borderColor: colors.border }),
    [colors.border, colors.surface]
  );
  const themedInputStyle = {
    backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF",
    borderColor: colors.border,
    color: colors.text
  };
  const themedChipStyle = useMemo(
    () => ({ borderColor: colors.border, backgroundColor: colors.surfaceAlt }),
    [colors.border, colors.surfaceAlt]
  );
  const themedChipActiveStyle = useMemo(
    () => ({ borderColor: colors.accent, backgroundColor: colors.accentSoft }),
    [colors.accent, colors.accentSoft]
  );

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
      const message = handleAppError(e, { fallbackMessage: "Failed to add availability slot." });
      setError(message);
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
      const message = handleAppError(e, { fallbackMessage: "Failed to block date." });
      setError(message);
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
      const message = handleAppError(e, { fallbackMessage: "Failed to save mentor profile." });
      setError(message);
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
      const message = handleAppError(e, { fallbackMessage: "Failed to upload payout QR." });
      setError(message);
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
      const message = handleAppError(e, { fallbackMessage: "Failed to update booking status." });
      setError(message);
    }
  }

  async function saveMeetingLink(sessionId: string) {
    try {
      const meetingLink = (meetingLinks[sessionId] || "").trim();
      if (!meetingLink) {
        setError("Meeting link is required.");
        return;
      }
      await api.patch(`/api/sessions/${sessionId}/meeting-link`, {
        meetingProvider: "manual",
        meetingLink
      });
      notify("Meeting link updated.");
      await fetchDashboard(true);
    } catch (e: any) {
      const message = handleAppError(e, { fallbackMessage: "Failed to update meeting link." });
      setError(message);
    }
  }

  async function generateSessionJitsiLink(sessionId: string) {
    try {
      setError(null);
      await api.patch(`/api/sessions/${sessionId}/meeting-link`, {
        meetingProvider: "jitsi"
      });
      notify("Jitsi link generated.");
      await fetchDashboard(true);
    } catch (e: any) {
      const message = handleAppError(e, { fallbackMessage: "Failed to generate Jitsi link." });
      setError(message);
    }
  }

  async function saveLiveSessionLink(liveSessionId: string, provider: "manual" | "jitsi" = "manual") {
    try {
      const meetingLink = provider === "manual" ? (liveSessionLinks[liveSessionId] || "").trim() : "";
      await api.patch(`/api/network/live-sessions/${liveSessionId}/meeting-link`, {
        meetingProvider: provider,
        meetingLink
      });
      notify(provider === "jitsi" ? "Live session Jitsi link generated." : meetingLink ? "Live session link saved." : "Live session link cleared.");
      await fetchDashboard(true);
    } catch (e: any) {
      const message = handleAppError(e, { fallbackMessage: "Failed to update live session link." });
      setError(message);
    }
  }

  async function saveSprintMeetingLink(sprintId: string, provider: "manual" | "jitsi" = "manual") {
    try {
      const meetingLink = provider === "manual" ? (sprintMeetingLinks[sprintId] || "").trim() : "";
      await api.patch(`/api/network/sprints/${sprintId}/meeting-link`, {
        meetingProvider: provider,
        meetingLink
      });
      notify(provider === "jitsi" ? "Sprint Jitsi link generated." : meetingLink ? "Sprint link saved." : "Sprint link cleared.");
      await fetchDashboard(true);
    } catch (e: any) {
      const message = handleAppError(e, { fallbackMessage: "Failed to update sprint link." });
      setError(message);
    }
  }

  async function markSessionCompleted(sessionId: string) {
    try {
      setError(null);
      await api.patch(`/api/sessions/${sessionId}/complete`);
      notify("Session marked as completed.");
      await fetchDashboard(true);
    } catch (e: any) {
      const message = handleAppError(e, { fallbackMessage: "Failed to mark session completed." });
      setError(message);
    }
  }

  async function confirmPayoutReceived(sessionId: string) {
    try {
      setError(null);
      await api.patch(`/api/sessions/${sessionId}/payout/confirm`);
      notify("Payout confirmed.");
      await fetchDashboard(true);
    } catch (e: any) {
      const message = handleAppError(e, { fallbackMessage: "Failed to confirm payout." });
      setError(message);
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
      const message = handleAppError(e, { fallbackMessage: "Failed to report payout issue." });
      setError(message);
    }
  }

  async function confirmSprintPayoutReceived(enrollmentId: string) {
    try {
      setError(null);
      await api.patch(`/api/network/sprints/enrollments/${enrollmentId}/payout/confirm`);
      notify("Sprint payout confirmed.");
      await fetchDashboard(true);
    } catch (e: any) {
      const message = handleAppError(e, { fallbackMessage: "Failed to confirm sprint payout." });
      setError(message);
    }
  }

  async function reportSprintPayoutIssue(enrollmentId: string) {
    try {
      setError(null);
      const note = "Sprint payout not received or needs admin review";
      await api.patch(`/api/network/sprints/enrollments/${enrollmentId}/payout/report-issue`, { issueNote: note });
      notify("Sprint payout issue reported to admin.");
      await fetchDashboard(true);
    } catch (e: any) {
      const message = handleAppError(e, { fallbackMessage: "Failed to report sprint payout issue." });
      setError(message);
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
      const message = handleAppError(e, { fallbackMessage: "Failed to send message to admin." });
      setError(message);
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
        meetingProvider: liveMeetingProvider,
        meetingLink: liveMeetingProvider === "manual" ? liveMeetingLink.trim() : "",
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
      setLiveMeetingProvider("manual");
      setLiveMeetingLink("");
      setLiveSessionMode("free");
      setLiveSessionPrice("499");
      setLiveSessionCapacity("50");
      setLiveSessionDuration("60");
      notify("Live session submitted for admin approval.");
      await fetchDashboard(true);
    } catch (e: any) {
      const message = handleAppError(e, { fallbackMessage: "Failed to create live session." });
      setError(message);
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
      const message = handleAppError(e, { fallbackMessage: "Failed to upload poster." });
      setError(message);
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
      const message = handleAppError(e, { fallbackMessage: "Failed to upload sprint poster." });
      setError(message);
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
      const message = handleAppError(e, { fallbackMessage: "Failed to upload curriculum." });
      setError(message);
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
        meetingProvider: sprintMeetingProvider,
        meetingLink: sprintMeetingProvider === "manual" ? sprintMeetingLink.trim() : "",
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
      setSprintMeetingProvider("manual");
      setSprintMeetingLink("");
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
      const message = handleAppError(e, { fallbackMessage: "Failed to create sprint." });
      setError(message);
    } finally {
      setCreatingSprint(false);
    }
  }

  if (user?.role !== "mentor") {
    return (
      <View style={styles.centered}>
        <Text style={[styles.error, { color: colors.danger }]}>Access denied for current role.</Text>
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
          <Text style={[styles.searchMeta, { color: colors.textMuted }]}>
            {totalSearchMatches > 0
              ? `Search results: ${totalSearchMatches} match${totalSearchMatches > 1 ? "es" : ""}`
              : "No results for your search"}
          </Text>
          {totalSearchMatches > 0 ? <Text style={[styles.searchMetaDetail, { color: colors.textMuted }]}>Matched in: {searchBreakdown}</Text> : null}
        </>
      ) : null}

      <View style={styles.heroBanner}>
        <Text style={[styles.heroEyebrow, { color: colors.accent }]}>Mentor Workspace</Text>
        <Text style={[styles.heroTitle, { color: colors.text }]}>Run Your Mentor Journey From One Place</Text>
        <Text style={[styles.heroSubTitle, { color: colors.textMuted }]}>
          Create sessions, review bookings, manage pricing, publish live events, and stay updated without hunting through the app.
        </Text>
      </View>

      <View style={styles.journeySummaryRow}>
        <View style={styles.journeySummaryChip}>
          <Text style={[styles.journeySummaryValue, { color: colors.accent }]}>{pendingRequests.length}</Text>
          <Text style={[styles.journeySummaryLabel, { color: colors.textMuted }]}>Requests</Text>
        </View>
        <View style={styles.journeySummaryChip}>
          <Text style={[styles.journeySummaryValue, { color: colors.accent }]}>{upcomingSessions.length}</Text>
          <Text style={[styles.journeySummaryLabel, { color: colors.textMuted }]}>Upcoming</Text>
        </View>
        <View style={styles.journeySummaryChip}>
          <Text style={[styles.journeySummaryValue, { color: colors.accent }]}>{pendingLiveApprovals}</Text>
          <Text style={[styles.journeySummaryLabel, { color: colors.textMuted }]}>Live Pending</Text>
        </View>
        <View style={styles.journeySummaryChip}>
          <Text style={[styles.journeySummaryValue, { color: colors.accent }]}>{availableSlotCount}</Text>
          <Text style={[styles.journeySummaryLabel, { color: colors.textMuted }]}>Open Slots</Text>
        </View>
      </View>

      <Text style={[styles.sectionHeader, { color: colors.text }]}>Quick Actions</Text>
      <View style={styles.quickGrid}>
        {mentorServices.map((item) => (
          <TouchableOpacity key={item.key} style={[styles.quickTile, { borderColor: item.border }]} onPress={() => { item.onPress(); if (item.key !== "chat" && item.key !== "news") { setTimeout(() => revealPanel(), 80); } }}>
            <View style={[styles.iconBadge, { backgroundColor: item.bg }]}>
              <Ionicons name={item.icon} size={18} color={item.tint} />
            </View>
            <Text style={[styles.quickTileTitle, { color: colors.text }]}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={[styles.sectionHeader, { color: colors.text }]}>Mentor Operations</Text>
      <View style={styles.focusStack}>
        <TouchableOpacity style={styles.focusCard} onPress={() => openSection("requests")}>
          <Text style={[styles.focusCardTitle, { color: colors.text }]}>Booking Requests</Text>
          <Text style={[styles.meta, { color: colors.textMuted }]}>
            {pendingRequests.length > 0
              ? `${pendingRequests.length} student request${pendingRequests.length > 1 ? "s" : ""} waiting for your approval`
              : "No pending booking requests right now."}
          </Text>
          <Text style={[styles.focusCardAccent, { color: colors.accent }]}>Open request approvals</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.focusCard} onPress={() => openSection("sessions")}>
          <Text style={[styles.focusCardTitle, { color: colors.text }]}>Upcoming Sessions</Text>
          <Text style={[styles.meta, { color: colors.textMuted }]}>
            {upcomingSessions.length > 0
              ? `${upcomingSessions.length} upcoming paid/confirmed session${upcomingSessions.length > 1 ? "s" : ""}`
              : "No upcoming sessions yet."}
          </Text>
          <Text style={[styles.focusCardAccent, { color: colors.accent }]}>Review sessions and meeting links</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.focusCard} onPress={() => openSection("availability")}>
          <Text style={[styles.focusCardTitle, { color: colors.text }]}>Availability & Timing</Text>
          <Text style={[styles.meta, { color: colors.textMuted }]}>
            Weekly slots: {availabilitySlots.length} | Date slots: {dateSpecificSlots.length} | Blocked dates: {blockedDateList.length}
          </Text>
          <Text style={[styles.focusCardAccent, { color: colors.accent }]}>Open availability controls</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.focusCard} onPress={() => openSection("pricing")}>
          <Text style={[styles.focusCardTitle, { color: colors.text }]}>Pricing & Profile</Text>
          <Text style={[styles.meta, { color: colors.textMuted }]}>
            Title: {mentorTitle || mentorProfileSummary?.title || "Not set"} | Fee: INR {sessionPrice}
          </Text>
          <Text style={[styles.focusCardAccent, { color: colors.accent }]}>Update mentor title and pricing</Text>
        </TouchableOpacity>
      </View>

      <Text style={[styles.sectionHeader, { color: colors.text }]}>Mentor Stats</Text>
      <View style={styles.metricsRow}>
        <View style={styles.metricCard}>
          <Text style={[styles.metricValue, { color: colors.accent }]}>{studentsMentoredCount}</Text>
          <Text style={[styles.metricLabel, { color: colors.textMuted }]}>Students Mentored</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={[styles.metricValue, { color: colors.accent }]}>{Math.max(completedSessions.length, Number(mentorProfileSummary?.totalSessionsConducted || 0))}</Text>
          <Text style={[styles.metricLabel, { color: colors.textMuted }]}>Sessions Completed</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={[styles.metricValue, { color: colors.accent }]}>{Number(mentorProfileSummary?.rating || 0).toFixed(1)}</Text>
          <Text style={[styles.metricLabel, { color: colors.textMuted }]}>Rating</Text>
        </View>
      </View>

      {mentorPayoutSummary ? (
        <>
          <Text style={[styles.sectionHeader, { color: colors.text }]}>Earnings & Payouts</Text>
          <View style={styles.metricsRow}>
            <View style={styles.metricCard}>
              <Text style={[styles.metricValue, { color: colors.accent }]}>INR {Math.round(mentorPayoutSummary.mentorEarnings || 0)}</Text>
              <Text style={[styles.metricLabel, { color: colors.textMuted }]}>Your Share</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={[styles.metricValue, { color: colors.accent }]}>INR {Math.round(mentorPayoutSummary.pendingPayoutAmount || 0)}</Text>
              <Text style={[styles.metricLabel, { color: colors.textMuted }]}>Pending Payouts</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={[styles.metricValue, { color: colors.accent }]}>INR {Math.round(mentorPayoutSummary.confirmedReceivedAmount || 0)}</Text>
              <Text style={[styles.metricLabel, { color: colors.textMuted }]}>Confirmed Received</Text>
            </View>
          </View>
        </>
      ) : null}

      <Text style={[styles.sectionHeader, { color: colors.text }]}>My Programs</Text>
      <View style={styles.focusStack}>
        <TouchableOpacity
          style={styles.focusCard}
          onPress={() => {
            setProgramTab("live");
            openSection("growth", "live");
          }}
        >
          <Text style={[styles.focusCardTitle, { color: colors.text }]}>Manage Programs Pipeline</Text>
          <Text style={[styles.meta, { color: colors.textMuted }]}>
            Lives approved: {approvedLiveSessionsCount} | Sprint approvals: {pendingSprintApprovals} | Total programs: {liveSessions.length + sprints.length}
          </Text>
          <Text style={[styles.focusCardAccent, { color: colors.accent }]}>Create, price, schedule, and monitor live sessions plus cohort sprints</Text>
        </TouchableOpacity>
        {liveSessions.slice(0, 2).map((item) => (
          <TouchableOpacity
            key={item.id}
            style={styles.focusCard}
            onPress={() => {
              setProgramTab("live");
              openSection("growth", "live");
            }}
          >
            <Text style={[styles.focusCardTitle, { color: colors.text }]}>{item.title}</Text>
            <Text style={[styles.meta, { color: colors.textMuted }]}>
              {new Date(item.startsAt).toLocaleString()} | {item.sessionMode === "paid" ? `INR ${item.price || 0}` : "Free"}
            </Text>
            <Text style={[styles.meta, { color: colors.textMuted }]}>
              Seats: {item.participantCount || 0}/{item.maxParticipants || 50} | Status: {item.approvalStatus || "pending"}
            </Text>
            <Text style={[styles.focusCardAccent, { color: colors.accent }]}>Open live session controls</Text>
          </TouchableOpacity>
        ))}
        {sprints.slice(0, 2).map((item) => (
          <TouchableOpacity
            key={item.id}
            style={styles.focusCard}
            onPress={() => {
              setProgramTab("sprint");
              openSection("growth", "live");
            }}
          >
            <Text style={[styles.focusCardTitle, { color: colors.text }]}>{item.title}</Text>
            <Text style={[styles.meta, { color: colors.textMuted }]}>
              {new Date(item.startDate).toLocaleDateString()} - {new Date(item.endDate).toLocaleDateString()} | {item.sessionMode === "paid" ? `INR ${item.price || 0}` : "Free"}
            </Text>
            <Text style={[styles.meta, { color: colors.textMuted }]}>
              Seats: {item.participantCount || 0}/{item.maxParticipants || 20} | Status: {item.approvalStatus || "pending"}
            </Text>
            <Text style={[styles.focusCardAccent, { color: colors.accent }]}>Open sprint controls</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={[styles.sectionHeader, { color: colors.text }]}>Mentor News & Updates</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.newsRow}>
        {mentorNewsLoading && mentorNews.length === 0 ? (
          <View style={styles.newsStateCard}>
            <Text style={[styles.meta, { color: colors.textMuted }]}>Loading mentor updates...</Text>
          </View>
        ) : mentorNews.length === 0 ? (
          <View style={styles.newsStateCard}>
            <Text style={[styles.meta, { color: colors.textMuted }]}>No mentor news available right now.</Text>
          </View>
        ) : (
          mentorNews.map((item, index) => (
            <TouchableOpacity
              key={`${item.url || item.title}-${index}`}
              style={styles.newsCard}
              onPress={() => router.push("/news-updates" as never)}
            >
              <Text style={[styles.newsTag, { color: colors.text }]}>Mentor Update</Text>
              <Text style={[styles.newsTitle, { color: colors.text }]} numberOfLines={3}>{item.title}</Text>
              <Text style={[styles.newsDesc, { color: colors.textMuted }]} numberOfLines={3}>
                {item.description || "Tap to open the full News & Updates section."}
              </Text>
              <Text style={[styles.newsSource, { color: colors.textMuted }]}>{item.source || "ORIN News"}</Text>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      <Text style={[styles.sectionHeader, { color: colors.text }]}>Mentor Guidance</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.featuredRow}>
        <TouchableOpacity style={[styles.featureCard, styles.featureCardOne]} onPress={() => openSection("availability")}>
          <Text style={[styles.featurePill, { color: colors.text }]}>Plan</Text>
          <Text style={[styles.featureTitle, { color: colors.text }]}>Weekly Slot Planning</Text>
          <Text style={[styles.featureCopy, { color: colors.textMuted }]}>Publish only the timings you want students to book.</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.featureCard, styles.featureCardTwo]} onPress={() => openSection("pricing")}>
          <Text style={[styles.featurePill, { color: colors.text }]}>Earn</Text>
          <Text style={[styles.featureTitle, { color: colors.text }]}>Smart Pricing Control</Text>
          <Text style={[styles.featureCopy, { color: colors.textMuted }]}>Set your profile title and session fee with full flexibility.</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.featureCard, styles.featureCardThree]} onPress={() => openSection("sessions")}>
          <Text style={[styles.featurePill, { color: colors.text }]}>Deliver</Text>
          <Text style={[styles.featureTitle, { color: colors.text }]}>Meet Link Workflow</Text>
          <Text style={[styles.featureCopy, { color: colors.textMuted }]}>Attach session links at the right time and keep delivery clean.</Text>
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

      {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}

      {!isLoading && activeSection === "overview" ? (
        <View style={[styles.panel, styles.panelOverview]}>
          <Text style={[styles.panelTitle, styles.panelTitleOverview]}>Overview</Text>
          <View style={styles.metricsRow}>
            <View style={styles.metricCard}>
              <Text style={[styles.metricValue, { color: colors.accent }]}>{pendingRequests.length}</Text>
              <Text style={[styles.metricLabel, { color: colors.textMuted }]}>Pending Requests</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={[styles.metricValue, { color: colors.accent }]}>{confirmedPaidSessions.length}</Text>
              <Text style={[styles.metricLabel, { color: colors.textMuted }]}>Confirmed Sessions</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={[styles.metricValue, { color: colors.accent }]}>{messages.length}</Text>
              <Text style={[styles.metricLabel, { color: colors.textMuted }]}>Admin Messages</Text>
            </View>
          </View>
          <Text style={[styles.meta, { color: colors.textMuted }]}>Use sections above to update price, timings and session actions quickly.</Text>
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
          <Text style={[styles.metaStrong, { color: colors.text }]}>Mentor Verification & Reputation</Text>
          <View style={styles.metricsRow}>
            <View style={styles.metricCard}>
              <Text style={[styles.metricValue, { color: colors.accent }]}>{verifiedMentors.some((item) => item.mentorId === user.id && item.verifiedBadge) ? "Yes" : "No"}</Text>
              <Text style={[styles.metricLabel, { color: colors.textMuted }]}>Verified Badge</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={[styles.metricValue, { color: colors.accent }]}>{Math.round(reputationSummary?.score || 0)}</Text>
              <Text style={[styles.metricLabel, { color: colors.textMuted }]}>Reputation Score</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={[styles.metricValue, { color: colors.accent }]}>Top {reputationSummary?.topPercent ?? "-"}</Text>
              <Text style={[styles.metricLabel, { color: colors.textMuted }]}>Percentile</Text>
            </View>
          </View>
            </>
          ) : null}

          {mentorGrowthSection === "live" ? (
            <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sectionNavRow}>
            {[
              { id: "live", label: "Live Sessions" },
              { id: "sprint", label: "Sprints" }
            ].map((item) => {
              const active = programTab === item.id;
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.sectionChip, active && styles.sectionChipActive]}
                  onPress={() => setProgramTab(item.id as ProgramTabId)}
                >
                  <Text style={[styles.sectionChipText, active && styles.sectionChipTextActive]}>{item.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {programTab === "live" ? (
            <>
          <View style={styles.card}>
            <Text style={[styles.title, { color: colors.text }]}>Create Live Mentor Session</Text>
            <Text style={[styles.formFieldLabel, { color: colors.text }]}>Session Title</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. AI Career Roadmap Live Session"
              placeholderTextColor="#98A2B3"
              value={liveTitle}
              onChangeText={setLiveTitle}
            />
            <Text style={[styles.formFieldLabel, { color: colors.text }]}>Topic</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Machine Learning for Beginners"
              placeholderTextColor="#98A2B3"
              value={liveTopic}
              onChangeText={setLiveTopic}
            />
            <Text style={[styles.formFieldLabel, { color: colors.text }]}>Description</Text>
            <TextInput
              style={[styles.input, styles.textAreaInput]}
              placeholder="Tell students what this live session will cover and who should join."
              placeholderTextColor="#98A2B3"
              value={liveDescription}
              onChangeText={setLiveDescription}
              multiline
            />
            <Text style={[styles.formFieldLabel, { color: colors.text }]}>Session Poster</Text>
            <Text style={[styles.formFieldHint, { color: colors.textMuted }]}>
              Add a banner or poster so students understand the session topic before they book.
            </Text>
            <TouchableOpacity style={styles.secondaryButton} onPress={uploadLiveSessionPoster} disabled={uploadingLivePoster}>
              <Text style={[styles.secondaryButtonText, { color: colors.text }]}>
                {uploadingLivePoster ? "Uploading Poster..." : livePosterImageUrl ? "Change Poster" : "Upload Session Poster"}
              </Text>
            </TouchableOpacity>
            {livePosterImageUrl ? <Image source={{ uri: livePosterImageUrl }} style={styles.livePosterPreview} /> : null}
            <Text style={[styles.formFieldLabel, { color: colors.text }]}>Select Date</Text>
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
            <Text style={[styles.formFieldLabel, { color: colors.text }]}>Select Time</Text>
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
            <Text style={[styles.formFieldHint, { color: colors.textMuted }]}>
              Live session starts on {toDateLabel(liveSessionDate)} at {toMeridiemTime(liveSessionTime)}.
            </Text>
            <Text style={[styles.formFieldLabel, { color: colors.text }]}>Session Type</Text>
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
                <Text style={[styles.formFieldLabel, { color: colors.text }]}>Session Price (INR)</Text>
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
            <Text style={[styles.formFieldLabel, { color: colors.text }]}>Maximum Participants</Text>
            <TextInput
              style={styles.input}
              placeholder="50"
              placeholderTextColor="#98A2B3"
              value={liveSessionCapacity}
              onChangeText={setLiveSessionCapacity}
              keyboardType="numeric"
            />
            <Text style={[styles.formFieldLabel, { color: colors.text }]}>Duration (minutes)</Text>
            <TextInput
              style={styles.input}
              placeholder="60"
              placeholderTextColor="#98A2B3"
              value={liveSessionDuration}
              onChangeText={setLiveSessionDuration}
              keyboardType="numeric"
            />
            <Text style={[styles.formFieldLabel, { color: colors.text }]}>Meeting Setup</Text>
            <View style={styles.rowWrap}>
              {(["manual", "jitsi"] as const).map((provider) => {
                const active = liveMeetingProvider === provider;
                return (
                  <TouchableOpacity
                    key={`live-provider-${provider}`}
                    style={[styles.dayChip, active && styles.dayChipActive]}
                    onPress={() => setLiveMeetingProvider(provider)}
                  >
                    <Text style={[styles.dayChipText, active && styles.dayChipTextActive]}>
                      {provider === "manual" ? "Manual Link" : "Generate Jitsi"}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {liveMeetingProvider === "manual" ? (
              <TextInput
                style={styles.input}
                placeholder="https://meet.google.com/... or Zoom link"
                placeholderTextColor="#98A2B3"
                value={liveMeetingLink}
                onChangeText={setLiveMeetingLink}
                autoCapitalize="none"
              />
            ) : (
              <Text style={[styles.formFieldHint, { color: colors.textMuted }]}>ORIN will create a Jitsi room when this live session is created.</Text>
            )}
            <TouchableOpacity style={styles.primaryButton} onPress={createMentorLiveSession} disabled={creatingLiveSession}>
              <Text style={styles.primaryButtonText}>{creatingLiveSession ? "Creating..." : "Create Live Session"}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.card}>
            <Text style={[styles.title, { color: colors.text }]}>Upcoming Live Sessions</Text>
            {liveSessions.length === 0 ? (
              <Text style={[styles.empty, { color: colors.textMuted }]}>No live sessions scheduled.</Text>
            ) : (
              liveSessions.slice(0, 5).map((item) => (
                <View key={item.id} style={styles.liveSessionCard}>
                  {item.posterImageUrl ? <Image source={{ uri: item.posterImageUrl }} style={styles.liveSessionImage} /> : null}
                  <Text style={[styles.liveSessionTitle, { color: colors.text }]}>{item.title}</Text>
                  <Text style={[styles.meta, { color: colors.textMuted }]}>{item.topic || "Live mentor session"}</Text>
                  {item.description ? <Text style={[styles.meta, { color: colors.textMuted }]}>{item.description}</Text> : null}
                  <Text style={[styles.meta, { color: colors.textMuted }]}>Date: {new Date(item.startsAt).toLocaleString()}</Text>
                  <Text style={[styles.meta, { color: colors.textMuted }]}>
                    Type: {item.sessionMode === "paid" ? `Paid | INR ${item.price || 0}` : "Free"} | Seats: {item.participantCount || 0}/{item.maxParticipants || 50}
                  </Text>
                  <Text style={[styles.meta, { color: colors.textMuted }]}>Interested learners: {item.interestedCount || 0}</Text>
                  <Text style={[styles.meta, { color: colors.textMuted }]}>Approval: {item.approvalStatus || "pending"}</Text>
                  <Text style={[styles.meta, { color: colors.textMuted }]}>
                    Meeting: {item.meetingProvider === "jitsi" ? "Jitsi" : "Manual"} | {item.meetingLink ? "Added by mentor" : "Not added yet"}
                  </Text>
                  {item.adminReviewNote ? <Text style={[styles.meta, { color: colors.textMuted }]}>Admin note: {item.adminReviewNote}</Text> : null}
                  <TextInput
                    style={styles.input}
                    placeholder="Add or update live session link"
                    placeholderTextColor="#98A2B3"
                    value={liveSessionLinks[item.id] ?? (item.meetingProvider === "manual" ? item.meetingLink ?? "" : "")}
                    onChangeText={(value) => setLiveSessionLinks((prev) => ({ ...prev, [item.id]: value }))}
                    autoCapitalize="none"
                  />
                  <View style={styles.rowWrap}>
                    <TouchableOpacity style={styles.actionBtn} onPress={() => saveLiveSessionLink(item.id, "manual")}>
                      <Text style={styles.actionText}>{(liveSessionLinks[item.id] ?? item.meetingLink ?? "").trim() ? "Save Manual Link" : "Clear Link"}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionBtn} onPress={() => saveLiveSessionLink(item.id, "jitsi")}>
                      <Text style={styles.actionText}>Generate Jitsi</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>
          <View style={styles.card}>
            <Text style={[styles.title, { color: colors.text }]}>Paid Live Session Bookings</Text>
            {paidLiveBookings.length === 0 ? (
              <Text style={[styles.empty, { color: colors.textMuted }]}>No paid live-session bookings yet.</Text>
            ) : (
              paidLiveBookings.map((booking) => (
                <View key={booking._id} style={styles.liveSessionCard}>
                  <Text style={[styles.liveSessionTitle, { color: colors.text }]}>{booking.studentId?.name || "Student"}</Text>
                  <Text style={[styles.meta, { color: colors.textMuted }]}>{booking.studentId?.email || "student@orin"}</Text>
                  <Text style={[styles.meta, { color: colors.textMuted }]}>
                    Session: {booking.liveSessionId?.title || "Live session"}
                  </Text>
                  {booking.liveSessionId?.startsAt ? (
                    <Text style={[styles.meta, { color: colors.textMuted }]}>
                      Starts: {new Date(booking.liveSessionId.startsAt).toLocaleString()}
                    </Text>
                  ) : null}
                  <Text style={[styles.meta, { color: colors.textMuted }]}>
                    Paid: INR {booking.amount || booking.liveSessionId?.price || 0}
                  </Text>
                </View>
              ))
            )}
          </View>
            </>
          ) : null}

          {programTab === "sprint" ? (
            <>
          <View style={styles.card}>
            <Text style={[styles.title, { color: colors.text }]}>Create Sprint Program</Text>
            <Text style={[styles.formFieldLabel, { color: colors.text }]}>Sprint Title</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. AI Engineer Career Sprint"
              placeholderTextColor="#98A2B3"
              value={sprintTitle}
              onChangeText={setSprintTitle}
            />
            <Text style={[styles.formFieldLabel, { color: colors.text }]}>Domain</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. AI, Web Development, Data Science"
              placeholderTextColor="#98A2B3"
              value={sprintDomain}
              onChangeText={setSprintDomain}
            />
            <Text style={[styles.formFieldLabel, { color: colors.text }]}>Description</Text>
            <TextInput
              style={[styles.input, styles.textAreaInput]}
              placeholder="Explain what students will achieve, who this sprint is for, and how the cohort will run."
              placeholderTextColor="#98A2B3"
              value={sprintDescription}
              onChangeText={setSprintDescription}
              multiline
            />
            <Text style={[styles.formFieldLabel, { color: colors.text }]}>Sprint Poster</Text>
            <Text style={[styles.formFieldHint, { color: colors.textMuted }]}>Poster is mandatory. This is the main visual students will trust first.</Text>
            <TouchableOpacity style={styles.secondaryButton} onPress={uploadSprintPoster} disabled={uploadingSprintPoster}>
              <Text style={[styles.secondaryButtonText, { color: colors.text }]}>
                {uploadingSprintPoster ? "Uploading Poster..." : sprintPosterImageUrl ? "Change Sprint Poster" : "Upload Sprint Poster"}
              </Text>
            </TouchableOpacity>
            {sprintPosterImageUrl ? <Image source={{ uri: sprintPosterImageUrl }} style={styles.livePosterPreview} /> : null}

            <Text style={[styles.formFieldLabel, { color: colors.text }]}>Curriculum Document (Optional PDF/DOC)</Text>
            <Text style={[styles.formFieldHint, { color: colors.textMuted }]}>Upload full syllabus or brochure so students can review the sprint before joining.</Text>
            <TouchableOpacity style={styles.secondaryButton} onPress={uploadSprintDocument} disabled={uploadingSprintDocument}>
              <Text style={[styles.secondaryButtonText, { color: colors.text }]}>
                {uploadingSprintDocument ? "Uploading Curriculum..." : sprintDocumentUrl ? "Replace Curriculum Document" : "Upload Curriculum Document"}
              </Text>
            </TouchableOpacity>
            {sprintDocumentUrl ? <Text style={[styles.formFieldHint, { color: colors.textMuted }]}>Curriculum uploaded and ready for review.</Text> : null}

            <Text style={[styles.formFieldLabel, { color: colors.text }]}>Sprint Start Date</Text>
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

            <Text style={[styles.formFieldLabel, { color: colors.text }]}>Sprint End Date</Text>
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

            <Text style={[styles.formFieldLabel, { color: colors.text }]}>Program Type</Text>
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
                <Text style={[styles.formFieldLabel, { color: colors.text }]}>Sprint Price (INR)</Text>
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
            <Text style={[styles.formFieldLabel, { color: colors.text }]}>Minimum Participants</Text>
            <TextInput
              style={styles.input}
              placeholder="5"
              placeholderTextColor="#98A2B3"
              value={sprintMinParticipants}
              onChangeText={setSprintMinParticipants}
              keyboardType="numeric"
            />
            <Text style={[styles.formFieldLabel, { color: colors.text }]}>Maximum Participants</Text>
            <TextInput
              style={styles.input}
              placeholder="20"
              placeholderTextColor="#98A2B3"
              value={sprintMaxParticipants}
              onChangeText={setSprintMaxParticipants}
              keyboardType="numeric"
            />
            <Text style={[styles.formFieldLabel, { color: colors.text }]}>Duration (Weeks)</Text>
            <TextInput
              style={styles.input}
              placeholder="4"
              placeholderTextColor="#98A2B3"
              value={sprintWeeks}
              onChangeText={setSprintWeeks}
              keyboardType="numeric"
            />
            <Text style={[styles.formFieldLabel, { color: colors.text }]}>Number of Live Sessions</Text>
            <TextInput
              style={styles.input}
              placeholder="4"
              placeholderTextColor="#98A2B3"
              value={sprintLiveSessionsCount}
              onChangeText={setSprintLiveSessionsCount}
              keyboardType="numeric"
            />
            <Text style={[styles.formFieldLabel, { color: colors.text }]}>Sprint Meeting Setup</Text>
            <View style={styles.rowWrap}>
              {(["manual", "jitsi"] as const).map((provider) => {
                const active = sprintMeetingProvider === provider;
                return (
                  <TouchableOpacity
                    key={`sprint-provider-${provider}`}
                    style={[styles.dayChip, active && styles.dayChipActive]}
                    onPress={() => setSprintMeetingProvider(provider)}
                  >
                    <Text style={[styles.dayChipText, active && styles.dayChipTextActive]}>
                      {provider === "manual" ? "Manual Link" : "Generate Jitsi"}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {sprintMeetingProvider === "manual" ? (
              <TextInput
                style={styles.input}
                placeholder="Mentor will use this main sprint join link"
                placeholderTextColor="#98A2B3"
                value={sprintMeetingLink}
                onChangeText={setSprintMeetingLink}
                autoCapitalize="none"
              />
            ) : (
              <Text style={[styles.formFieldHint, { color: colors.textMuted }]}>ORIN will create a Jitsi room when this sprint is created.</Text>
            )}
            <Text style={[styles.formFieldLabel, { color: colors.text }]}>Weekly Plan</Text>
            <TextInput
              style={[styles.input, styles.textAreaInput]}
              placeholder={"Week 1: Foundations\nWeek 2: Project setup\nWeek 3: Feedback\nWeek 4: Demo"}
              placeholderTextColor="#98A2B3"
              value={sprintWeeklyPlan}
              onChangeText={setSprintWeeklyPlan}
              multiline
            />
            <Text style={[styles.formFieldLabel, { color: colors.text }]}>Outcomes</Text>
            <TextInput
              style={styles.input}
              placeholder="Portfolio project, Mentor feedback, Sprint certificate"
              placeholderTextColor="#98A2B3"
              value={sprintOutcomes}
              onChangeText={setSprintOutcomes}
            />
            <Text style={[styles.formFieldLabel, { color: colors.text }]}>Tools Used</Text>
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
            <Text style={[styles.title, { color: colors.text }]}>My Sprint Programs</Text>
            {sprints.length === 0 ? (
              <Text style={[styles.empty, { color: colors.textMuted }]}>No sprint programs submitted yet.</Text>
            ) : (
              sprints.slice(0, 5).map((item) => (
                <View key={item.id} style={styles.liveSessionCard}>
                  {item.posterImageUrl ? <Image source={{ uri: item.posterImageUrl }} style={styles.liveSessionImage} /> : null}
                  <Text style={[styles.liveSessionTitle, { color: colors.text }]}>{item.title}</Text>
                  <Text style={[styles.meta, { color: colors.textMuted }]}>{item.domain || "Sprint Program"}</Text>
                  {item.description ? <Text style={[styles.meta, { color: colors.textMuted }]}>{item.description}</Text> : null}
                  <Text style={[styles.meta, { color: colors.textMuted }]}>
                    {new Date(item.startDate).toLocaleDateString()} - {new Date(item.endDate).toLocaleDateString()} | {item.durationWeeks || 1} weeks
                  </Text>
                  <Text style={[styles.meta, { color: colors.textMuted }]}>
                    Type: {item.sessionMode === "paid" ? `Paid | INR ${item.price || 0}` : "Free"} | Seats: {item.participantCount || 0}/{item.maxParticipants || 20}
                  </Text>
                  <Text style={[styles.meta, { color: colors.textMuted }]}>Approval: {item.approvalStatus || "pending"}</Text>
                  <Text style={[styles.meta, { color: colors.textMuted }]}>
                    Meeting: {item.meetingProvider === "jitsi" ? "Jitsi" : "Manual"} | {item.meetingLink ? "Added by mentor" : "Not added yet"}
                  </Text>
                  {item.curriculumDocumentUrl ? <Text style={[styles.meta, { color: colors.textMuted }]}>Curriculum uploaded</Text> : <Text style={[styles.meta, { color: colors.textMuted }]}>Curriculum optional</Text>}
                  {item.adminReviewNote ? <Text style={[styles.meta, { color: colors.textMuted }]}>Admin note: {item.adminReviewNote}</Text> : null}
                  <TextInput
                    style={styles.input}
                    placeholder="Add or update sprint link"
                    placeholderTextColor="#98A2B3"
                    value={sprintMeetingLinks[item.id] ?? (item.meetingProvider === "manual" ? item.meetingLink ?? "" : "")}
                    onChangeText={(value) => setSprintMeetingLinks((prev) => ({ ...prev, [item.id]: value }))}
                    autoCapitalize="none"
                  />
                  <View style={styles.rowWrap}>
                    <TouchableOpacity style={styles.actionBtn} onPress={() => saveSprintMeetingLink(item.id, "manual")}>
                      <Text style={styles.actionText}>{(sprintMeetingLinks[item.id] ?? item.meetingLink ?? "").trim() ? "Save Manual Link" : "Clear Link"}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionBtn} onPress={() => saveSprintMeetingLink(item.id, "jitsi")}>
                      <Text style={styles.actionText}>Generate Jitsi</Text>
                    </TouchableOpacity>
                  </View>
                  <TouchableOpacity style={styles.actionBtn} onPress={() => router.push(`/sprints/${item.id}` as never)}>
                    <Text style={styles.actionText}>Open Detail</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>

          <View style={styles.card}>
            <Text style={[styles.title, { color: colors.text }]}>Paid Sprint Enrollments</Text>
            {paidSprintEnrollments.length === 0 ? (
              <Text style={[styles.empty, { color: colors.textMuted }]}>No paid sprint enrollments yet.</Text>
            ) : (
              paidSprintEnrollments.map((enrollment) => (
                <View key={enrollment._id} style={styles.liveSessionCard}>
                  <Text style={[styles.liveSessionTitle, { color: colors.text }]}>{enrollment.studentId?.name || "Student"}</Text>
                  <Text style={[styles.meta, { color: colors.textMuted }]}>{enrollment.studentId?.email || "student@orin"}</Text>
                  <Text style={[styles.meta, { color: colors.textMuted }]}>
                    Sprint: {enrollment.sprintId?.title || "Sprint"}
                  </Text>
                  {enrollment.sprintId?.startDate ? (
                    <Text style={[styles.meta, { color: colors.textMuted }]}>
                      Starts: {new Date(enrollment.sprintId.startDate).toLocaleDateString()}
                    </Text>
                  ) : null}
                  <Text style={[styles.meta, { color: colors.textMuted }]}>
                    Paid: INR {enrollment.amount || enrollment.sprintId?.price || 0}
                  </Text>
                </View>
              ))
            )}
          </View>

          <View style={styles.card}>
            <Text style={[styles.title, { color: colors.text }]}>Sprint Earnings & Payouts</Text>
            {mentorSprintPayoutSummary ? (
              <>
                <Text style={[styles.meta, { color: colors.textMuted }]}>Lifetime gross: INR {mentorSprintPayoutSummary.lifetimeGross}</Text>
                <Text style={[styles.meta, { color: colors.textMuted }]}>Your sprint share: INR {mentorSprintPayoutSummary.mentorEarnings}</Text>
                <Text style={[styles.meta, { color: colors.textMuted }]}>Pending sprint payouts: INR {mentorSprintPayoutSummary.pendingPayoutAmount}</Text>
                <Text style={[styles.meta, { color: colors.textMuted }]}>
                  Payout setup: {mentorSprintPayoutSummary.payoutSetupComplete ? "Complete" : "Incomplete"}
                </Text>
              </>
            ) : (
              <Text style={[styles.empty, { color: colors.textMuted }]}>No paid sprint enrollments yet.</Text>
            )}
            {mentorSprintPayouts.slice(0, 5).map((item) => (
              <View key={item._id} style={styles.liveSessionCard}>
                <Text style={[styles.liveSessionTitle, { color: colors.text }]}>{item.sprintId?.title || "Sprint"}</Text>
                <Text style={[styles.meta, { color: colors.textMuted }]}>
                  Student: {item.studentId?.name || "Student"} | Gross: INR {item.amount || 0}
                </Text>
                <Text style={[styles.meta, { color: colors.textMuted }]}>
                  ORIN fee: INR {item.platformFeeAmount || 0} | Your share: INR {item.mentorPayoutAmount || 0}
                </Text>
                <Text style={[styles.meta, { color: colors.textMuted }]}>
                  Payout: {item.payoutStatus || "not_ready"} | Mentor confirmation: {item.mentorPayoutConfirmationStatus || "not_ready"}
                </Text>
                {item.payoutReference ? <Text style={[styles.meta, { color: colors.textMuted }]}>Reference: {item.payoutReference}</Text> : null}
                {item.payoutNote ? <Text style={[styles.meta, { color: colors.textMuted }]}>Admin note: {item.payoutNote}</Text> : null}
                {item.mentorPayoutIssueNote ? <Text style={[styles.meta, { color: colors.textMuted }]}>Issue: {item.mentorPayoutIssueNote}</Text> : null}
                {item.canMentorConfirmPayout ? (
                  <View style={styles.inlineActions}>
                    <TouchableOpacity style={styles.actionBtn} onPress={() => confirmSprintPayoutReceived(item._id)}>
                      <Text style={styles.actionText}>Confirm Received</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionBtn} onPress={() => reportSprintPayoutIssue(item._id)}>
                      <Text style={styles.actionText}>Report Issue</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
              </View>
            ))}
          </View>
            </>
          ) : null}

          <View style={styles.card}>
            <Text style={[styles.title, { color: colors.text }]}>Program Guidance</Text>
            {mentorBanners.map((banner) => (
              <View key={banner.key} style={[styles.inlineBanner, { backgroundColor: banner.bg, borderColor: banner.border }]}>
                <Text style={[styles.bannerTag, { color: colors.text }]}>{banner.tag}</Text>
                <Text style={[styles.bannerTitle, { color: colors.text }]}>{banner.title}</Text>
                <Text style={[styles.bannerCopy, { color: colors.textMuted }]}>{banner.copy}</Text>
              </View>
            ))}
          </View>
            </>
          ) : null}

          {mentorGrowthSection === "community" ? (
            <>
          <View style={[styles.card, themedCardStyle]}>
            <Text style={[styles.title, { color: colors.text }]}>Institution Resources</Text>
            <TextInput style={[styles.input, themedInputStyle]} placeholder="Resource title" placeholderTextColor={colors.textMuted} value={resourceTitle} onChangeText={setResourceTitle} />
            <TextInput style={[styles.input, themedInputStyle]} placeholder="Domain (optional)" placeholderTextColor={colors.textMuted} value={resourceDomain} onChangeText={setResourceDomain} />
            <View style={styles.chipRow}>
              {(["institution", "class", "global"] as const).map((scope) => {
                const active = resourceScope === scope;
                return (
                  <TouchableOpacity key={`resource-scope-${scope}`} style={[styles.dayChip, themedChipStyle, active && themedChipActiveStyle]} onPress={() => setResourceScope(scope)}>
                    <Text style={[styles.dayChipText, { color: active ? colors.accent : colors.text }, active && styles.dayChipTextActive]}>
                      {scope === "institution" ? "My Institution" : scope === "class" ? "Specific Class" : "Global"}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {resourceScope === "class" ? (
              <TextInput style={[styles.input, themedInputStyle]} placeholder="Class / Section" placeholderTextColor={colors.textMuted} value={resourceClassName} onChangeText={setResourceClassName} />
            ) : null}
            <TextInput style={[styles.input, styles.textAreaInput, themedInputStyle]} placeholder="Short description" placeholderTextColor={colors.textMuted} value={resourceDescription} onChangeText={setResourceDescription} multiline />
            <TextInput style={[styles.input, themedInputStyle]} placeholder="External link (optional)" placeholderTextColor={colors.textMuted} value={resourceUrl} onChangeText={setResourceUrl} autoCapitalize="none" />
            <View style={styles.actions}>
              <TouchableOpacity style={styles.actionBtn} onPress={uploadMentorResourceBanner}>
                <Text style={styles.actionText}>{resourceBannerImageUrl ? "Change Banner" : "Upload Banner"}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionBtn} onPress={uploadMentorResourceDocument}>
                <Text style={styles.actionText}>{resourceDocumentUrl ? "Replace Document" : "Upload Document"}</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.actionBtn} onPress={submitMentorResource} disabled={submittingResource}>
              <Text style={styles.actionText}>{submittingResource ? "Submitting..." : "Submit Resource"}</Text>
            </TouchableOpacity>
            {mentorResources.length === 0 ? (
              <Text style={[styles.empty, { color: colors.textMuted }]}>No mentor resources submitted yet.</Text>
            ) : (
              mentorResources.slice(0, 5).map((item) => (
                <Text key={item.id} style={[styles.meta, { color: colors.textMuted }]}>
                  {item.title} | {item.scope || "global"}{item.className ? ` | ${item.className}` : ""} | {item.approvalStatus || "pending"}
                </Text>
              ))
            )}
          </View>

          <View style={[styles.card, themedCardStyle]}>
            <Text style={[styles.title, { color: colors.text }]}>Resource Reviews</Text>
            {resourceSubmissions.length === 0 ? (
              <Text style={[styles.empty, { color: colors.textMuted }]}>No student resource submissions yet.</Text>
            ) : (
              resourceSubmissions.slice(0, 8).map((item) => {
                const reviewDraft = resourceReviewDrafts[item.id] || {
                  xpAwarded: String(item.mentorReview?.xpAwarded || ""),
                  notes: item.mentorReview?.notes || "",
                  issueCertificate: Boolean(item.mentorReview?.certificateId)
                };
                return (
                  <View key={item.id} style={[styles.liveSessionCard, themedCardStyle]}>
                    <Text style={[styles.liveSessionTitle, { color: colors.text }]}>{item.resourceTitle}</Text>
                    <Text style={[styles.meta, { color: colors.textMuted }]}>
                      {item.student?.name || "Student"} {item.student?.email ? `| ${item.student.email}` : ""}
                    </Text>
                    <Text style={[styles.meta, { color: colors.textMuted }]}>
                      {(item.scope || "global").toUpperCase()}{item.className ? ` | ${item.className}` : ""}{item.resourceDomain ? ` | ${item.resourceDomain}` : ""}
                    </Text>
                    <Text style={[styles.meta, { color: colors.textMuted }]}>Status: {item.status}</Text>
                    {item.proofText ? <Text style={[styles.meta, { color: colors.textMuted }]}>Proof: {item.proofText}</Text> : null}
                    {item.proofLink ? <Text style={[styles.meta, { color: colors.textMuted }]}>Link: {item.proofLink}</Text> : null}
                    {(item.proofFiles || []).length ? (
                      <Text style={[styles.meta, { color: colors.textMuted }]}>Files: {(item.proofFiles || []).length}</Text>
                    ) : null}
                    <TextInput
                      style={[styles.input, themedInputStyle]}
                      placeholder="XP to award"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="numeric"
                      value={reviewDraft.xpAwarded}
                      onChangeText={(value) => updateResourceReviewDraft(item.id, { xpAwarded: value })}
                    />
                    <TextInput
                      style={[styles.input, themedInputStyle]}
                      placeholder="Mentor review note"
                      placeholderTextColor={colors.textMuted}
                      value={reviewDraft.notes}
                      onChangeText={(value) => updateResourceReviewDraft(item.id, { notes: value })}
                      multiline
                    />
                    <TouchableOpacity
                      style={[styles.dayChip, themedChipStyle, reviewDraft.issueCertificate && themedChipActiveStyle]}
                      onPress={() => updateResourceReviewDraft(item.id, { issueCertificate: !reviewDraft.issueCertificate })}
                    >
                      <Text style={[styles.dayChipText, { color: reviewDraft.issueCertificate ? colors.accent : colors.text }]}>
                        {reviewDraft.issueCertificate ? "Certificate: Yes" : "Issue Certificate"}
                      </Text>
                    </TouchableOpacity>
                    <View style={styles.actions}>
                      <TouchableOpacity
                        style={[styles.actionButton, styles.approveButton]}
                        onPress={() => reviewResourceSubmission(item.id, "accepted")}
                        disabled={reviewingResourceSubmissionId === item.id}
                      >
                        <Text style={styles.actionText}>{reviewingResourceSubmissionId === item.id ? "Saving..." : "Approve + XP"}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.actionButton, styles.rejectButton]}
                        onPress={() => reviewResourceSubmission(item.id, "rejected")}
                        disabled={reviewingResourceSubmissionId === item.id}
                      >
                        <Text style={styles.actionText}>Reject</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}
          </View>

          <View style={[styles.card, themedCardStyle]}>
            <Text style={[styles.title, { color: colors.text }]}>Community Challenges</Text>
            <TextInput style={[styles.input, themedInputStyle]} placeholder="Competition title" placeholderTextColor={colors.textMuted} value={challengeTitle} onChangeText={setChallengeTitle} />
            <TextInput style={[styles.input, themedInputStyle]} placeholder="Domain (optional)" placeholderTextColor={colors.textMuted} value={challengeDomain} onChangeText={setChallengeDomain} />
            <View style={styles.chipRow}>
              {(["institution", "class", "global"] as const).map((scope) => {
                const active = challengeScope === scope;
                return (
                  <TouchableOpacity key={`challenge-scope-${scope}`} style={[styles.dayChip, themedChipStyle, active && themedChipActiveStyle]} onPress={() => setChallengeScope(scope)}>
                    <Text style={[styles.dayChipText, { color: active ? colors.accent : colors.text }, active && styles.dayChipTextActive]}>
                      {scope === "institution" ? "My Institution" : scope === "class" ? "Specific Class" : "Global"}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {challengeScope === "class" ? (
              <TextInput style={[styles.input, themedInputStyle]} placeholder="Class / Section" placeholderTextColor={colors.textMuted} value={challengeClassName} onChangeText={setChallengeClassName} />
            ) : null}
            <TextInput style={[styles.input, styles.textAreaInput, themedInputStyle]} placeholder="Competition description" placeholderTextColor={colors.textMuted} value={challengeDescription} onChangeText={setChallengeDescription} multiline />
            <TextInput style={[styles.input, themedInputStyle]} placeholder="Deadline (YYYY-MM-DD)" placeholderTextColor={colors.textMuted} value={challengeDeadline} onChangeText={setChallengeDeadline} />
            <TextInput style={[styles.input, themedInputStyle]} placeholder="Participant limit" placeholderTextColor={colors.textMuted} value={challengeParticipantLimit} onChangeText={setChallengeParticipantLimit} keyboardType="numeric" />
            <TextInput style={[styles.input, styles.textAreaInput, themedInputStyle]} placeholder="Proof instructions" placeholderTextColor={colors.textMuted} value={challengeProofInstructions} onChangeText={setChallengeProofInstructions} multiline />
            <TouchableOpacity style={styles.actionBtn} onPress={uploadMentorChallengeBanner}>
              <Text style={styles.actionText}>{challengeBannerImageUrl ? "Change Banner" : "Upload Banner"}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} onPress={submitMentorChallenge} disabled={submittingChallenge}>
              <Text style={styles.actionText}>{submittingChallenge ? "Submitting..." : "Submit Competition"}</Text>
            </TouchableOpacity>
            {challenges.length === 0 ? (
              <Text style={[styles.empty, { color: colors.textMuted }]}>No active challenges.</Text>
            ) : (
              challenges.slice(0, 5).map((item) => (
                <Text key={item.id} style={[styles.meta, { color: colors.textMuted }]}>
                  {item.title} | {item.scope || "global"}{item.className ? ` | ${item.className}` : ""} | {item.participantsCount || 0} participants
                </Text>
              ))
            )}
          </View>

          <View style={[styles.card, themedCardStyle]}>
            <Text style={[styles.title, { color: colors.text }]}>Mentor Groups</Text>
            {mentorGroups.length === 0 ? (
              <Text style={[styles.empty, { color: colors.textMuted }]}>No mentor groups available.</Text>
            ) : (
              mentorGroups
                .filter((group) => String(group.mentor?.id || "") === String(user.id))
                .slice(0, 5)
                .map((group) => (
                  <Text key={group.id} style={[styles.meta, { color: colors.textMuted }]}>
                    {group.name} | {group.membersCount || 0} students | {group.schedule || "Weekly"}
                  </Text>
                ))
            )}
          </View>

          <View style={[styles.card, themedCardStyle]}>
            <Text style={[styles.title, { color: colors.text }]}>Institution Roadmaps</Text>
            <TextInput style={[styles.input, themedInputStyle]} placeholder="Roadmap title" placeholderTextColor={colors.textMuted} value={institutionRoadmapTitle} onChangeText={setInstitutionRoadmapTitle} />
            <TextInput style={[styles.input, themedInputStyle]} placeholder="Domain (optional)" placeholderTextColor={colors.textMuted} value={institutionRoadmapDomain} onChangeText={setInstitutionRoadmapDomain} />
            <TextInput style={[styles.input, themedInputStyle]} placeholder="Class (optional: Class 10 / CSE-A)" placeholderTextColor={colors.textMuted} value={institutionRoadmapClassName} onChangeText={setInstitutionRoadmapClassName} />
            <TextInput style={[styles.input, themedInputStyle]} placeholder="Roadmap description" placeholderTextColor={colors.textMuted} value={institutionRoadmapDescription} onChangeText={setInstitutionRoadmapDescription} multiline />
            <TextInput style={[styles.input, themedInputStyle]} placeholder="Week 1 title" placeholderTextColor={colors.textMuted} value={institutionRoadmapWeekOne} onChangeText={setInstitutionRoadmapWeekOne} />
            <TextInput style={[styles.input, themedInputStyle]} placeholder="Week 2 title" placeholderTextColor={colors.textMuted} value={institutionRoadmapWeekTwo} onChangeText={setInstitutionRoadmapWeekTwo} />
            <TextInput style={[styles.input, themedInputStyle]} placeholder="Week 3 title" placeholderTextColor={colors.textMuted} value={institutionRoadmapWeekThree} onChangeText={setInstitutionRoadmapWeekThree} />
            <TouchableOpacity style={styles.actionBtn} onPress={createInstitutionRoadmap} disabled={creatingInstitutionRoadmap}>
              <Text style={styles.actionText}>{creatingInstitutionRoadmap ? "Creating..." : "Create Institution Roadmap"}</Text>
            </TouchableOpacity>
            {institutionRoadmaps.length === 0 ? (
              <Text style={[styles.empty, { color: colors.textMuted }]}>No institution roadmaps created yet.</Text>
            ) : (
              institutionRoadmaps.slice(0, 5).map((item) => (
                <Text key={item.id} style={[styles.meta, { color: colors.textMuted }]}>
                  {item.title} | {item.className ? `${item.className} | ` : ""}{item.weeks.length} weeks | {item.status || "published"}
                </Text>
              ))
            )}
          </View>

          <View style={[styles.card, themedCardStyle]}>
            <Text style={[styles.title, { color: colors.text }]}>Institution Roadmap Reviews</Text>
            {institutionRoadmapSubmissions.length === 0 ? (
              <Text style={[styles.empty, { color: colors.textMuted }]}>No student submissions yet.</Text>
            ) : (
              institutionRoadmapSubmissions.slice(0, 8).map((item) => {
                const reviewDraft = institutionReviewDrafts[item.id] || {
                  xpAwarded: String(item.mentorReview?.xpAwarded || ""),
                  notes: item.mentorReview?.notes || "",
                  issueCertificate: Boolean(item.mentorReview?.certificateId)
                };
                return (
                  <View key={item.id} style={[styles.liveSessionCard, themedCardStyle]}>
                    <Text style={[styles.liveSessionTitle, { color: colors.text }]}>{item.roadmapTitle}</Text>
                    <Text style={[styles.meta, { color: colors.textMuted }]}>
                      {item.weekTitle} | {item.student?.name || "Student"} {item.student?.email ? `| ${item.student.email}` : ""}
                    </Text>
                    <Text style={[styles.meta, { color: colors.textMuted }]}>Status: {item.status}</Text>
                    {item.proofText ? <Text style={[styles.meta, { color: colors.textMuted }]}>Proof: {item.proofText}</Text> : null}
                    {item.proofLink ? <Text style={[styles.meta, { color: colors.textMuted }]}>Link: {item.proofLink}</Text> : null}
                    {item.proofImageUrl ? <Image source={{ uri: item.proofImageUrl }} style={styles.livePosterPreview} /> : null}
                    <TextInput
                      style={[styles.input, themedInputStyle]}
                      placeholder="XP to award"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="numeric"
                      value={reviewDraft.xpAwarded}
                      onChangeText={(value) => updateInstitutionReviewDraft(item.id, { xpAwarded: value })}
                    />
                    <TextInput
                      style={[styles.input, themedInputStyle]}
                      placeholder="Mentor review note"
                      placeholderTextColor={colors.textMuted}
                      value={reviewDraft.notes}
                      onChangeText={(value) => updateInstitutionReviewDraft(item.id, { notes: value })}
                      multiline
                    />
                    <TouchableOpacity
                      style={[styles.dayChip, themedChipStyle, reviewDraft.issueCertificate && themedChipActiveStyle]}
                      onPress={() => updateInstitutionReviewDraft(item.id, { issueCertificate: !reviewDraft.issueCertificate })}
                    >
                      <Text style={[styles.dayChipText, { color: reviewDraft.issueCertificate ? colors.accent : colors.text }, reviewDraft.issueCertificate && styles.dayChipTextActive]}>
                        {reviewDraft.issueCertificate ? "Certificate: Yes" : "Issue Certificate"}
                      </Text>
                    </TouchableOpacity>
                    <View style={styles.actions}>
                      <TouchableOpacity
                        style={[styles.actionButton, styles.approveButton]}
                        onPress={() => reviewInstitutionSubmission(item.id, "accepted")}
                        disabled={reviewingInstitutionSubmissionId === item.id}
                      >
                        <Text style={styles.actionText}>{reviewingInstitutionSubmissionId === item.id ? "Saving..." : "Approve + XP"}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.actionButton, styles.rejectButton]}
                        onPress={() => reviewInstitutionSubmission(item.id, "rejected")}
                        disabled={reviewingInstitutionSubmissionId === item.id}
                      >
                        <Text style={styles.actionText}>Reject</Text>
                      </TouchableOpacity>
                    </View>
                    {item.mentorReview?.reviewedAt ? (
                      <Text style={[styles.meta, { color: colors.textMuted }]}>
                        Reviewed: {new Date(item.mentorReview.reviewedAt).toLocaleString("en-IN")}
                      </Text>
                    ) : null}
                  </View>
                );
              })
            )}
          </View>

          <View style={[styles.card, themedCardStyle]}>
            <Text style={[styles.title, { color: colors.text }]}>ORIN Certifications</Text>
            <TextInput style={[styles.input, themedInputStyle]} placeholder="Template title" placeholderTextColor={colors.textMuted} value={templateTitle} onChangeText={setTemplateTitle} />
            <View style={styles.chipRow}>
              {(["institution", "class", "global"] as const).map((scope) => {
                const active = templateScope === scope;
                return (
                  <TouchableOpacity key={`template-scope-${scope}`} style={[styles.dayChip, themedChipStyle, active && themedChipActiveStyle]} onPress={() => setTemplateScope(scope)}>
                    <Text style={[styles.dayChipText, { color: active ? colors.accent : colors.text }, active && styles.dayChipTextActive]}>
                      {scope === "institution" ? "My Institution" : scope === "class" ? "Specific Class" : "Global"}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {templateScope === "class" ? (
              <TextInput style={[styles.input, themedInputStyle]} placeholder="Class / Section" placeholderTextColor={colors.textMuted} value={templateClassName} onChangeText={setTemplateClassName} />
            ) : null}
            <TextInput style={[styles.input, themedInputStyle]} placeholder="Certificate type (manual, roadmap, challenge)" placeholderTextColor={colors.textMuted} value={templateType} onChangeText={setTemplateType} />
            <TextInput style={[styles.input, themedInputStyle]} placeholder="XP reward" placeholderTextColor={colors.textMuted} value={templateXpReward} onChangeText={setTemplateXpReward} keyboardType="numeric" />
            <TextInput style={[styles.input, styles.textAreaInput, themedInputStyle]} placeholder="Template description" placeholderTextColor={colors.textMuted} value={templateDescription} onChangeText={setTemplateDescription} multiline />
            <TouchableOpacity style={styles.actionBtn} onPress={saveMentorCertificateTemplate} disabled={submittingTemplate}>
              <Text style={styles.actionText}>{submittingTemplate ? "Saving..." : "Save Certificate Template"}</Text>
            </TouchableOpacity>
            {certifications.length === 0 ? (
              <Text style={[styles.empty, { color: colors.textMuted }]}>No certifications listed yet.</Text>
            ) : (
              certifications.slice(0, 5).map((item) => (
                <Text key={item.id} style={[styles.meta, { color: colors.textMuted }]}>
                  {item.title} ({item.level || "Level"})
                </Text>
              ))
            )}
            {mentorCertificateTemplates.length ? (
              mentorCertificateTemplates.slice(0, 5).map((item) => (
                <Text key={item.id} style={[styles.meta, { color: colors.textMuted }]}>
                  Template: {item.title} | {item.scope || "global"}{item.className ? ` | ${item.className}` : ""} | {item.certificateType || "manual"}
                </Text>
              ))
            ) : (
              <Text style={[styles.empty, { color: colors.textMuted }]}>No mentor certificate templates yet.</Text>
            )}
          </View>
            </>
          ) : null}
        </View>
      ) : null}

      {!isLoading && activeSection === "pricing" ? (
        <View style={[styles.panel, styles.panelPricing]}>
          <Text style={[styles.panelTitle, styles.panelTitlePricing]}>Profile, Pricing & Payouts</Text>
          <Text style={[styles.meta, { color: colors.textMuted }]}>Set your mentor title, session fee, and payout details so ORIN can pay you smoothly.</Text>
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
          <Text style={[styles.formFieldLabel, { color: colors.text }]}>Payout QR Code</Text>
          <Text style={[styles.formFieldHint, { color: colors.textMuted }]}>Upload a QR if you want ORIN admin to have a quick manual payout option.</Text>
          {payoutQrCodeUrl ? <Image source={{ uri: payoutQrCodeUrl }} style={styles.livePosterPreview} /> : null}
          <TouchableOpacity style={styles.primaryButton} onPress={uploadPayoutQrCode} disabled={uploadingPayoutQr}>
            <Text style={styles.primaryButtonText}>{uploadingPayoutQr ? "Uploading..." : payoutQrCodeUrl ? "Change Payout QR" : "Upload Payout QR"}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.primaryButton} onPress={saveMentorProfilePricing} disabled={savingProfile}>
            <Text style={styles.primaryButtonText}>{savingProfile ? "Saving..." : "Save Profile & Price"}</Text>
          </TouchableOpacity>

          {mentorPayoutSummary ? (
            <View style={styles.card}>
              <Text style={[styles.title, { color: colors.text }]}>Earnings Summary</Text>
              <Text style={[styles.meta, { color: colors.textMuted }]}>Gross paid by students: INR {mentorPayoutSummary.lifetimeGross}</Text>
              <Text style={[styles.meta, { color: colors.textMuted }]}>ORIN platform share: INR {mentorPayoutSummary.platformFees}</Text>
              <Text style={[styles.meta, { color: colors.textMuted }]}>Your total share: INR {mentorPayoutSummary.mentorEarnings}</Text>
              <Text style={[styles.meta, { color: colors.textMuted }]}>Pending payout amount: INR {mentorPayoutSummary.pendingPayoutAmount}</Text>
              <Text style={[styles.meta, { color: colors.textMuted }]}>Paid out by ORIN: INR {mentorPayoutSummary.paidOutAmount}</Text>
              <Text style={[styles.meta, { color: colors.textMuted }]}>
                Payout setup: {mentorPayoutSummary.payoutSetupComplete ? "Complete" : "Incomplete"}
              </Text>
            </View>
          ) : null}

          <View style={styles.card}>
            <Text style={[styles.title, { color: colors.text }]}>Recent Payout Activity</Text>
            {mentorPayoutSessions.length === 0 ? (
              <Text style={[styles.empty, { color: colors.textMuted }]}>No paid sessions tracked yet.</Text>
            ) : (
              mentorPayoutSessions.slice(0, 5).map((session) => (
                <View key={`payout-${session._id}`} style={styles.liveSessionCard}>
                  <Text style={[styles.liveSessionTitle, { color: colors.text }]}>{session.studentId?.name || "Student"}</Text>
                  <Text style={[styles.meta, { color: colors.textMuted }]}>
                    {session.date} {session.time} | Student paid INR {session.amount}
                  </Text>
                  <Text style={[styles.meta, { color: colors.textMuted }]}>
                    ORIN: INR {session.platformFeeAmount || 0} | You: INR {session.mentorPayoutAmount || 0}
                  </Text>
                  <Text style={[styles.meta, { color: colors.textMuted }]}>
                    Payout: {session.payoutStatus || "not_ready"} | Mentor confirmation: {session.mentorPayoutConfirmationStatus || "not_ready"}
                  </Text>
                  {session.payoutReference ? <Text style={[styles.meta, { color: colors.textMuted }]}>Reference: {session.payoutReference}</Text> : null}
                  {session.payoutNote ? <Text style={[styles.meta, { color: colors.textMuted }]}>Admin note: {session.payoutNote}</Text> : null}
                  {session.mentorPayoutIssueNote ? <Text style={[styles.meta, { color: colors.textMuted }]}>Issue: {session.mentorPayoutIssueNote}</Text> : null}
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
          <Text style={[styles.meta, { color: colors.textMuted }]}>Set recurring weekly slots or exact date-time slots for the next 14 days.</Text>

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
                  {isBlocked ? <Text style={[styles.dateChipBlockedText, { color: colors.danger }]}>Blocked</Text> : null}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <Text style={[styles.meta, { color: colors.textMuted }]}>
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
            <Text style={[styles.secondaryButtonText, { color: colors.text }]}>{blockingDate ? "Blocking..." : "Block Selected Date"}</Text>
          </TouchableOpacity>

          {availabilitySlots.length === 0 ? (
            <Text style={[styles.empty, { color: colors.textMuted }]}>No weekly availability slots set yet.</Text>
          ) : (
            <>
              <Text style={[styles.metaStrong, { color: colors.text }]}>Weekly Slots</Text>
              {availabilitySlots.map((slot) => (
                <Text key={slot._id} style={styles.meta}>
                  {slot.day}: {toTimeRangeLabel(slot.startTime, slot.endTime)} ({slot.sessionDurationMinutes} min)
                </Text>
              ))}
            </>
          )}
          {dateSpecificSlots.length > 0 ? (
            <>
              <Text style={[styles.metaStrong, { color: colors.text }]}>Date-Specific Slots</Text>
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
            <Text style={[styles.empty, { color: colors.textMuted }]}>No confirmed sessions yet.</Text>
          ) : (
            filteredConfirmedPaidSessions.map((session) => (
              <View key={session._id} style={[styles.card, styles.cardSessions]}>
                <Text style={[styles.title, { color: colors.text }]}>{session.studentId?.name || "Student"}</Text>
                <Text style={[styles.meta, { color: colors.textMuted }]}>
                  {session.date} {session.time} | INR {session.amount}
                </Text>
                <Text style={[styles.status, { color: colors.accent }]}>
                  Payment: {session.paymentStatus} | Session: {session.sessionStatus}
                </Text>
                {!canSetMeetingLink(session) ? (
                  <Text style={[styles.meta, { color: colors.textMuted }]}>Meeting link can be added only in last 5 minutes before start time.</Text>
                ) : null}
                <Text style={[styles.meta, { color: colors.textMuted }]}>
                  Meeting provider: {session.meetingProvider === "jitsi" ? "Jitsi" : "Manual link"}
                </Text>
                <TextInput
                  style={styles.input}
                  placeholder="https://meet.google.com/..."
                  value={meetingLinks[session._id] ?? (session.meetingProvider === "manual" ? session.meetingLink ?? "" : "")}
                  onChangeText={(value) => setMeetingLinks((prev) => ({ ...prev, [session._id]: value }))}
                />
                <View style={styles.rowWrap}>
                  <TouchableOpacity
                    style={[styles.primaryButton, !canSetMeetingLink(session) && styles.disabledButton]}
                    onPress={() => saveMeetingLink(session._id)}
                    disabled={!canSetMeetingLink(session)}
                  >
                    <Text style={styles.primaryButtonText}>Save Manual Link</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.secondaryButton, !canSetMeetingLink(session) && styles.disabledButton]}
                    onPress={() => generateSessionJitsiLink(session._id)}
                    disabled={!canSetMeetingLink(session)}
                  >
                    <Text style={[styles.secondaryButtonText, { color: colors.text }]}>Generate Jitsi</Text>
                  </TouchableOpacity>
                </View>
                {canMarkSessionCompleted(session) ? (
                  <TouchableOpacity style={styles.primaryButton} onPress={() => markSessionCompleted(session._id)}>
                    <Text style={styles.primaryButtonText}>Mark Session Completed</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ))
          )}

          <View style={styles.card}>
            <Text style={[styles.title, { color: colors.text }]}>Completed Sessions & Payout Readiness</Text>
            {mentorPayoutSessions.filter((item) => item.sessionStatus === "completed" || item.status === "completed").length === 0 ? (
              <Text style={[styles.empty, { color: colors.textMuted }]}>No completed paid sessions yet.</Text>
            ) : (
              mentorPayoutSessions
                .filter((item) => item.sessionStatus === "completed" || item.status === "completed")
                .slice(0, 5)
                .map((session) => (
                  <View key={`completed-${session._id}`} style={styles.liveSessionCard}>
                    <Text style={[styles.liveSessionTitle, { color: colors.text }]}>{session.studentId?.name || "Student"}</Text>
                    <Text style={[styles.meta, { color: colors.textMuted }]}>
                      {session.date} {session.time} | Your earning INR {session.mentorPayoutAmount || 0}
                    </Text>
                    <Text style={[styles.meta, { color: colors.textMuted }]}>
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
            <Text style={[styles.empty, { color: colors.textMuted }]}>No booking requests yet.</Text>
          ) : (
            filteredBookings.map((booking) => (
              <View key={booking._id} style={[styles.card, styles.cardRequests]}>
                <Text style={[styles.title, { color: colors.text }]}>{booking.student?.name || "Student"}</Text>
                <Text style={[styles.meta, { color: colors.textMuted }]}>{booking.student?.email}</Text>
                <Text style={[styles.meta, { color: colors.textMuted }]}>{new Date(booking.scheduledAt).toLocaleString()}</Text>
                <Text style={[styles.status, { color: colors.accent }]}>Status: {booking.status}</Text>
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
            <Text style={[styles.empty, { color: colors.textMuted }]}>No admin messages yet.</Text>
          ) : (
            filteredMessages.slice(0, 20).map((msg) => (
              <View key={msg._id} style={[styles.card, styles.cardAdminChat]}>
                <Text style={[styles.metaStrong, { color: colors.text }]}>{msg.sender === user?.id ? "You" : "Admin"}</Text>
                <Text style={[styles.meta, { color: colors.textMuted }]}>{msg.text}</Text>
                <Text style={[styles.meta, { color: colors.textMuted }]}>{new Date(msg.createdAt).toLocaleString()}</Text>
              </View>
            ))
          )}
        </View>
      ) : null}

      <TouchableOpacity style={styles.logout} onPress={logout}>
        <Text style={[styles.logoutText, { color: colors.danger }]}>Logout</Text>
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
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6, marginBottom: 4 },
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
  inlineActions: { flexDirection: "row", gap: 10, marginTop: 10, flexWrap: "wrap" },
  actionBtn: {
    borderRadius: 10,
    backgroundColor: "#1F7A4C",
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center"
  },
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

