import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  BackHandler,
  Image,
  Linking,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  Animated,
  View
} from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/lib/api";
import { getAppErrorMessage, handleAppError } from "@/lib/appError";
import { useAuth } from "@/context/AuthContext";
import { useLearner } from "@/context/LearnerContext";
import { isKidStage } from "@/lib/learnerExperience";
import { useAppTheme } from "@/context/ThemeContext";
import { notify } from "@/utils/notify";
import { submitManualPaymentWithPicker } from "@/utils/manualPaymentUpload";
import { FEATURE_FLAGS } from "@/constants/featureFlags";
import { getStoredNewsLanguage, NewsLanguageCode } from "@/utils/newsLanguage";
import { markdownToPlainText } from "@/utils/textFormat";
import GlobalHeader from "@/components/global-header";

let RazorpayCheckout: any = null;
if (Platform.OS !== "web") {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    RazorpayCheckout = require("react-native-razorpay").default;
  } catch {
    RazorpayCheckout = null;
  }
}

const DASHBOARD_STALE_MS = 2 * 60 * 1000;
const NEWS_STALE_MS = 5 * 60 * 1000;
const SECTION_STALE_MS = 2 * 60 * 1000;
const QUIZ_DOMAIN_OPTIONS = [
  "Academic",
  "Competitive Exams",
  "Professional Courses",
  "Career & Placements",
  "Technology & AI",
  "Startups & Entrepreneurship",
  "Finance & Investing",
  "Creative & Design",
  "Personal Development"
];

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

type RazorpayRetryOrderResponse = {
  mode: "razorpay";
  message: string;
  session: {
    _id: string;
  };
  order: {
    id: string;
    amount: number;
    currency: string;
  };
  razorpayKeyId?: string;
  paymentInstructions?: {
    amount: number;
    currency: string;
    dueAt?: string | null;
  };
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

type DailyQuizQuestion = {
  id: string;
  question: string;
  options: string[];
  correct: string;
  difficulty: "easy" | "medium" | "hard";
  explanation: string;
  skill: string;
};

type DailyQuizData = {
  totalQuestions: number;
  startDifficulty: "easy" | "medium" | "hard";
  questionPool: DailyQuizQuestion[];
};

type DailyQuizSummary = {
  score: number;
  totalQuestions: number;
  xpEarned: number;
  streak: number;
};

type SkillRadarData = {
  domain: string;
  skills: Array<{ name: string; score: number }>;
};

type CareerIntelligenceData = {
  strength: string;
  needsImprovement: string[];
  recommendedNextStep: string;
  mentorRecommendations?: Array<{ mentorId: string; name: string; matchScore: number }>;
  trendingOpportunity?: { title: string; company?: string; role?: string } | null;
};

type DailyQuizResponse = {
  completedToday: boolean;
  dateKey: string;
  domain: string;
  message?: string;
  streak?: number;
  result?: DailyQuizSummary | null;
  quiz?: DailyQuizData | null;
};

type DailyQuizSubmitResponse = {
  message?: string;
  result: DailyQuizSummary;
  skillRadar?: SkillRadarData;
  careerIntelligence?: CareerIntelligenceData;
};

type DailyDashboard = {
  tasks: DailyTask[];
  streakDays: number;
  xp: number;
  levelTag: string;
  reputationScore: number;
  dailyQuiz?: {
    completedToday: boolean;
    domain: string;
    attemptsLeft: number;
    message: string;
    result?: DailyQuizSummary | null;
  };
  skillRadar?: SkillRadarData;
  careerIntelligence?: CareerIntelligenceData | null;
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
type InstitutionRoadmapItem = {
  id: string;
  title: string;
  domain?: string;
  status?: string;
  weeks: Array<{ id: string; title: string }>;
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
  description?: string;
  startsAt: string;
  endsAt?: string | null;
  durationMinutes?: number;
  posterImageUrl?: string;
  interestedCount?: number;
  isInterested?: boolean;
  meetingLink?: string;
  sessionMode?: "free" | "paid";
  price?: number;
  currency?: string;
  maxParticipants?: number;
  participantCount?: number;
  seatsLeft?: number;
  approvalStatus?: "pending" | "approved" | "rejected";
  myBooking?: {
    id: string;
    paymentMode?: "free" | "razorpay";
    paymentStatus?: "pending" | "paid" | "failed" | "cancelled";
    bookingStatus?: "pending_payment" | "booked" | "cancelled";
    paymentDueAt?: string | null;
  } | null;
  mentor?: { id?: string; name?: string };
};

type LiveSessionOrderResponse = {
  mode: "free" | "razorpay";
  message: string;
  booking?: {
    _id: string;
    paymentMode?: "free" | "razorpay";
    paymentStatus?: "pending" | "paid";
    bookingStatus?: "pending_payment" | "booked";
  };
  order?: {
    id: string;
    amount: number;
    currency: string;
  } | null;
  razorpayKeyId?: string;
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
  sessionMode?: "free" | "paid";
  price?: number;
  currency?: string;
  minParticipants?: number;
  maxParticipants?: number;
  participantCount?: number;
  seatsLeft?: number;
  isSoldOut?: boolean;
  mentor?: { id?: string; name?: string };
  myEnrollment?: {
    id: string;
    paymentMode?: "free" | "razorpay";
    paymentStatus?: "pending" | "paid" | "failed" | "cancelled";
    enrollmentStatus?: "pending_payment" | "enrolled" | "cancelled";
    paymentDueAt?: string | null;
  } | null;
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
  mentor?: { id?: string | null; name?: string } | null;
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
  institutionName?: string;
  mentor?: { id?: string | null; name?: string } | null;
};

type KnowledgeLibraryResponse = {
  institutionName?: string;
  institutionResources?: LibraryItem[];
  roadmapResources?: LibraryItem[];
  domainResources?: LibraryItem[];
  items?: LibraryItem[];
};

type ReputationSummary = {
  score: number;
  levelTag: string;
  topPercent: number;
};
type StudentProfileLite = {
  institutionName?: string;
  collegeName?: string;
  className?: string;
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

const newsTabs: { key: NewsCategoryKey; label: string }[] = [
  { key: "tech", label: "Tech" },
  { key: "edtech", label: "EdTech" },
  { key: "exams", label: "Govt Exams" },
  { key: "scholarships", label: "Scholarships" },
  { key: "opportunities", label: "Opportunities" }
];

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

const REWARD_LEVELS = [
  { min: 0, label: "Starter", icon: "leaf", tone: "#22C55E" },
  { min: 100, label: "Bronze", icon: "medal", tone: "#B45309" },
  { min: 300, label: "Silver", icon: "shield-checkmark", tone: "#64748B" },
  { min: 700, label: "Gold", icon: "trophy", tone: "#D97706" },
  { min: 1200, label: "Diamond", icon: "diamond", tone: "#2563EB" },
  { min: 2000, label: "Champion", icon: "ribbon", tone: "#7C3AED" }
] as const;

function buildRewardSummary(dashboard: DailyDashboard | null, isKid: boolean, isHighSchool: boolean) {
  const score = Math.max(0, Number(dashboard?.reputationScore || 0));
  const todayXp = Math.max(0, Number(dashboard?.xp || dashboard?.dailyQuiz?.result?.xpEarned || 0));
  const streak = Math.max(0, Number(dashboard?.streakDays || dashboard?.dailyQuiz?.result?.streak || 0));
  const currentIndex = REWARD_LEVELS.reduce((best, level, index) => (score >= level.min ? index : best), 0);
  const current = REWARD_LEVELS[currentIndex];
  const next = REWARD_LEVELS[currentIndex + 1] || null;
  const levelBase = current.min;
  const nextTarget = next?.min || Math.max(current.min + 500, score + 1);
  const progress = Math.max(0.08, Math.min(1, (score - levelBase) / Math.max(1, nextTarget - levelBase)));
  const rank = dashboard?.leaderboard?.collegeRank || dashboard?.leaderboard?.globalRank || null;
  const pointsLabel = isKid ? "Stars" : "XP";
  const boardLabel = isKid ? "Star Board" : isHighSchool ? "School Board" : "Leaderboard";
  const completedQuiz = Boolean(dashboard?.dailyQuiz?.completedToday);
  const badges = [
    {
      label: isKid ? "Daily Star" : "Daily Learner",
      earned: completedQuiz,
      icon: "star",
      tone: "#F59E0B"
    },
    {
      label: `${Math.max(streak, 0)} Day Streak`,
      earned: streak >= 3,
      icon: "flame",
      tone: "#EF4444"
    },
    {
      label: current.label,
      earned: score >= current.min,
      icon: current.icon,
      tone: current.tone
    },
    {
      label: rank ? `${boardLabel} #${rank}` : boardLabel,
      earned: Boolean(rank && rank <= 10),
      icon: "podium",
      tone: "#6366F1"
    }
  ];

  return {
    score,
    todayXp,
    streak,
    current,
    next,
    progress,
    rank,
    pointsLabel,
    boardLabel,
    completedQuiz,
    badges
  };
}

export default function StudentDashboard() {
  const params = useLocalSearchParams<{ section?: string; openQuiz?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const { learnerStage } = useLearner();
  const { colors, isDark } = useAppTheme();
  const isKid = isKidStage(learnerStage);
  const isHighSchool = learnerStage === "highschool";
  const growthSubSections = useMemo<{ id: GrowthSubSectionId; label: string }[]>(
    () => [
      { id: "ai", label: isKid ? "Learning Tools" : isHighSchool ? "Study & Planning" : "AI & Planning" },
      { id: "community", label: isKid ? "School Life" : isHighSchool ? "School Community" : "Community" },
      { id: "resources", label: isKid ? "Resources & Creativity" : "Resources" }
    ],
    [isHighSchool, isKid]
  );
  const lastDashboardFetchAtRef = useRef(0);
  const lastNewsFetchAtRef = useRef(0);
  const sectionFetchAtRef = useRef<Record<string, number>>({});
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
  const rewardSummary = useMemo(
    () => buildRewardSummary(dailyDashboard, isKid, isHighSchool),
    [dailyDashboard, isHighSchool, isKid]
  );
  const [dailyQuiz, setDailyQuiz] = useState<DailyQuizResponse | null>(null);
  const [quizVisible, setQuizVisible] = useState(false);
  const [quizDomainPickerVisible, setQuizDomainPickerVisible] = useState(false);
  const [selectedQuizDomain, setSelectedQuizDomain] = useState("Technology & AI");
  const [quizQuestions, setQuizQuestions] = useState<DailyQuizQuestion[]>([]);
  const [quizIndex, setQuizIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [quizFeedback, setQuizFeedback] = useState<"correct" | "wrong" | null>(null);
  const [quizXp, setQuizXp] = useState(0);
  const [quizAnswers, setQuizAnswers] = useState<
    Array<{
      questionId: string;
      skill: string;
      difficulty: "easy" | "medium" | "hard";
      selectedOption: string;
      correctOption: string;
      isCorrect: boolean;
    }>
  >([]);
  const [quizResult, setQuizResult] = useState<DailyQuizSummary | null>(null);
  const [quizLoading, setQuizLoading] = useState(false);
  const [submittingQuiz, setSubmittingQuiz] = useState(false);
  const [quizMessage, setQuizMessage] = useState("");
  const [slideAnim] = useState(new Animated.Value(0));
  const [suggestions, setSuggestions] = useState<SmartSuggestion[]>([]);
  const [mentorMatches, setMentorMatches] = useState<MentorMatch[]>([]);
  const [sessionHistory, setSessionHistory] = useState<SessionHistoryItem[]>([]);
  const [roadmap, setRoadmap] = useState<CareerRoadmapResponse | null>(null);
  const [opportunities, setOpportunities] = useState<OpportunityItem[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardResponse | null>(null);
  const [institutionRoadmaps, setInstitutionRoadmaps] = useState<InstitutionRoadmapItem[]>([]);
  const [studentInstitutionName, setStudentInstitutionName] = useState("");
  const [studentClassName, setStudentClassName] = useState("");
  const [institutionExpanded, setInstitutionExpanded] = useState(false);
  const [liveSessions, setLiveSessions] = useState<LiveSessionItem[]>([]);
  const [sprints, setSprints] = useState<SprintItem[]>([]);
  const [togglingLiveInterestId, setTogglingLiveInterestId] = useState<string | null>(null);
  const [resumePreview, setResumePreview] = useState<ResumeResponse | null>(null);
  const [skillGap, setSkillGap] = useState<SkillGapResponse | null>(null);
  const [verifiedMentors, setVerifiedMentors] = useState<VerifiedMentor[]>([]);
  const [challenges, setChallenges] = useState<ChallengeItem[]>([]);
  const [certifications, setCertifications] = useState<CertificationItem[]>([]);
  const [mentorGroups, setMentorGroups] = useState<MentorGroupItem[]>([]);
  const [projectIdeas, setProjectIdeas] = useState<ProjectIdeasResponse | null>(null);
  const [knowledgeLibrary, setKnowledgeLibrary] = useState<LibraryItem[]>([]);
  const [institutionKnowledgeLibrary, setInstitutionKnowledgeLibrary] = useState<LibraryItem[]>([]);
  const [reputationSummary, setReputationSummary] = useState<ReputationSummary | null>(null);
  const [activeNewsTab, setActiveNewsTab] = useState<NewsCategoryKey>("tech");
  const [newsByCategory, setNewsByCategory] = useState<Record<NewsCategoryKey, NewsArticle[]>>({
    tech: [],
    edtech: [],
    exams: [],
    scholarships: [],
    opportunities: []
  });
  const institutionFeedLabel = isKid ? "School Feed" : "Institution Feed";
  const institutionLeaderboardLabel = isKid ? "Star Board" : "Institution Leaderboard";
  const institutionRoadmapsLabel = isKid ? "Activities" : "Institution Roadmaps";
  const institutionCertificatesLabel = isKid ? "Star Rewards" : "Institution Certificates";
  const institutionResourcesLabel = isKid ? "Class Resources" : "Institution Resources";
  const institutionCompetitionsLabel = isKid ? "Fun Challenges" : "Institution Competitions";
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

  const shouldSkipSectionFetch = useCallback((key: string, refresh = false, force = false) => {
    const now = Date.now();
    return !refresh && !force && now - (sectionFetchAtRef.current[key] || 0) < SECTION_STALE_MS;
  }, []);

  const markSectionFetched = useCallback((key: string) => {
    sectionFetchAtRef.current[key] = Date.now();
  }, []);

  const loadOverviewExtras = useCallback(async (refresh = false, force = false) => {
    const cacheKey = "overview";
    if (shouldSkipSectionFetch(cacheKey, refresh, force)) return;
    markSectionFetched(cacheKey);
    const [liveSessionsRes, sprintsRes] = await Promise.allSettled([
      api.get<LiveSessionItem[]>("/api/network/live-sessions"),
      api.get<SprintItem[]>("/api/network/sprints")
    ]);
    setLiveSessions(liveSessionsRes.status === "fulfilled" ? asArray<LiveSessionItem>(liveSessionsRes.value.data) : []);
    setSprints(sprintsRes.status === "fulfilled" ? asArray<SprintItem>(sprintsRes.value.data) : []);
  }, [markSectionFetched, shouldSkipSectionFetch]);

  const loadSessionsSection = useCallback(async (refresh = false, force = false) => {
    const cacheKey = "sessions";
    if (shouldSkipSectionFetch(cacheKey, refresh, force)) return;
    markSectionFetched(cacheKey);
    const [sessionHistoryRes] = await Promise.allSettled([
      api.get<SessionHistoryItem[]>("/api/network/session-history")
    ]);
    setSessionHistory(sessionHistoryRes.status === "fulfilled" ? asArray<SessionHistoryItem>(sessionHistoryRes.value.data) : []);
  }, [markSectionFetched, shouldSkipSectionFetch]);

  const loadNetworkSection = useCallback(async (refresh = false, force = false) => {
    const cacheKey = "network";
    if (shouldSkipSectionFetch(cacheKey, refresh, force)) return;
    markSectionFetched(cacheKey);
    const [feedRes, suggestionsRes] = await Promise.allSettled([
      FEATURE_FLAGS.networking ? api.get<NetworkPost[]>("/api/network/feed") : Promise.resolve({ data: [] as NetworkPost[] }),
      FEATURE_FLAGS.smartSuggestions
        ? api.get<SmartSuggestion[]>("/api/network/suggestions")
        : Promise.resolve({ data: [] as SmartSuggestion[] })
    ]);
    setNetworkFeed(feedRes.status === "fulfilled" ? asArray<NetworkPost>(feedRes.value.data) : []);
    setSuggestions(suggestionsRes.status === "fulfilled" ? asArray<SmartSuggestion>(suggestionsRes.value.data) : []);
  }, [markSectionFetched, shouldSkipSectionFetch]);

  const loadGrowthAiSection = useCallback(async (refresh = false, force = false) => {
    const cacheKey = "growth-ai";
    if (shouldSkipSectionFetch(cacheKey, refresh, force)) return;
    markSectionFetched(cacheKey);
    const [
      mentorMatchesRes,
      roadmapRes,
      opportunitiesRes,
      leaderboardRes,
      skillGapRes,
      verifiedMentorsRes,
      institutionRoadmapsRes,
      studentProfileRes
    ] = await Promise.allSettled([
      api.get<{ recommendations: MentorMatch[] }>("/api/network/mentor-matches"),
      api.get<CareerRoadmapResponse>("/api/network/career-roadmap"),
      api.get<OpportunityItem[]>("/api/network/opportunities"),
      api.get<LeaderboardResponse>("/api/network/leaderboard"),
      api.get<SkillGapResponse>("/api/network/skill-gap"),
      api.get<VerifiedMentor[]>("/api/network/verified-mentors"),
      api.get<{ roadmaps: InstitutionRoadmapItem[] }>("/api/network/institution-roadmaps"),
      api.get<{ profile?: StudentProfileLite }>("/api/profiles/student/me")
    ]);
    setMentorMatches(mentorMatchesRes.status === "fulfilled" ? mentorMatchesRes.value.data?.recommendations || [] : []);
    setRoadmap(roadmapRes.status === "fulfilled" ? roadmapRes.value.data || null : null);
    setOpportunities(opportunitiesRes.status === "fulfilled" ? asArray<OpportunityItem>(opportunitiesRes.value.data) : []);
    setLeaderboard(leaderboardRes.status === "fulfilled" ? leaderboardRes.value.data || null : null);
    setSkillGap(skillGapRes.status === "fulfilled" ? skillGapRes.value.data || null : null);
    setVerifiedMentors(verifiedMentorsRes.status === "fulfilled" ? asArray<VerifiedMentor>(verifiedMentorsRes.value.data) : []);
    setInstitutionRoadmaps(
      institutionRoadmapsRes.status === "fulfilled"
        ? asArray<InstitutionRoadmapItem>(institutionRoadmapsRes.value.data?.roadmaps)
        : []
    );
    setStudentInstitutionName(
      studentProfileRes.status === "fulfilled"
        ? String(studentProfileRes.value.data?.profile?.institutionName || studentProfileRes.value.data?.profile?.collegeName || "").trim()
        : ""
    );
    setStudentClassName(
      studentProfileRes.status === "fulfilled"
        ? String(studentProfileRes.value.data?.profile?.className || "").trim()
        : ""
    );
  }, [markSectionFetched, shouldSkipSectionFetch]);

  const loadGrowthCommunitySection = useCallback(async (refresh = false, force = false) => {
    const cacheKey = "growth-community";
    if (shouldSkipSectionFetch(cacheKey, refresh, force)) return;
    markSectionFetched(cacheKey);
    const [challengesRes, certificationsRes, mentorGroupsRes] = await Promise.allSettled([
      api.get<ChallengeItem[]>("/api/network/challenges"),
      api.get<CertificationItem[]>("/api/network/certifications"),
      api.get<MentorGroupItem[]>("/api/network/mentor-groups")
    ]);
    setChallenges(challengesRes.status === "fulfilled" ? asArray<ChallengeItem>(challengesRes.value.data) : []);
    setCertifications(certificationsRes.status === "fulfilled" ? asArray<CertificationItem>(certificationsRes.value.data) : []);
    setMentorGroups(mentorGroupsRes.status === "fulfilled" ? asArray<MentorGroupItem>(mentorGroupsRes.value.data) : []);
  }, [markSectionFetched, shouldSkipSectionFetch]);

  const loadGrowthResourcesSection = useCallback(async (refresh = false, force = false) => {
    const cacheKey = "growth-resources";
    if (shouldSkipSectionFetch(cacheKey, refresh, force)) return;
    markSectionFetched(cacheKey);
    const [resumeRes, projectIdeasRes, knowledgeLibraryRes, reputationSummaryRes] = await Promise.allSettled([
      api.get<ResumeResponse>("/api/network/resume/generate"),
      api.get<ProjectIdeasResponse>("/api/network/project-ideas"),
      api.get<KnowledgeLibraryResponse>("/api/network/knowledge-library"),
      api.get<ReputationSummary>("/api/network/reputation-summary")
    ]);
    setResumePreview(resumeRes.status === "fulfilled" ? resumeRes.value.data || null : null);
    setProjectIdeas(projectIdeasRes.status === "fulfilled" ? projectIdeasRes.value.data || null : null);
    setKnowledgeLibrary(
      knowledgeLibraryRes.status === "fulfilled"
        ? asArray<LibraryItem>(knowledgeLibraryRes.value.data?.items || knowledgeLibraryRes.value.data?.roadmapResources)
        : []
    );
    setInstitutionKnowledgeLibrary(
      knowledgeLibraryRes.status === "fulfilled"
        ? asArray<LibraryItem>(knowledgeLibraryRes.value.data?.institutionResources)
        : []
    );
    setReputationSummary(reputationSummaryRes.status === "fulfilled" ? reputationSummaryRes.value.data || null : null);
  }, [markSectionFetched, shouldSkipSectionFetch]);

  const fetchDashboard = useCallback(async (refresh = false, force = false) => {
    const now = Date.now();
    if (!refresh && !force && now - lastDashboardFetchAtRef.current < DASHBOARD_STALE_MS) {
      return;
    }

    try {
      if (refresh) setIsRefreshing(true);
      else setIsLoading(true);

      setError(null);
      const [
        bookingsRes,
        sessionsRes,
        profileRes,
        dailyRes
      ] = await Promise.allSettled([
        api.get<Booking[]>("/api/bookings/student"),
        api.get<Session[]>("/api/sessions/student/me"),
        api.get<{ profile?: { profilePhotoUrl?: string } }>("/api/profiles/student/me"),
        FEATURE_FLAGS.dailyEngagement
          ? api.get<DailyDashboard>("/api/network/daily-dashboard")
          : Promise.resolve({ data: null as DailyDashboard | null })
      ]);

      setBookings(bookingsRes.status === "fulfilled" ? asArray<Booking>(bookingsRes.value.data) : []);
      setSessions(sessionsRes.status === "fulfilled" ? asArray<Session>(sessionsRes.value.data) : []);
      setProfilePhotoUrl(profileRes.status === "fulfilled" ? profileRes.value.data?.profile?.profilePhotoUrl || "" : "");
      setDailyDashboard(dailyRes.status === "fulfilled" ? dailyRes.value.data || null : null);
      const hardFailures = [bookingsRes, sessionsRes].filter((item) => item.status !== "fulfilled").length;
      if (hardFailures > 0) {
        setError("Some dashboard sections could not load. Pull to refresh.");
      }
      lastDashboardFetchAtRef.current = now;

      if (activeSection === "overview") {
        void loadOverviewExtras(refresh, force);
      } else if (activeSection === "sessions") {
        void loadSessionsSection(refresh, force);
      } else if (activeSection === "network") {
        void loadNetworkSection(refresh, force);
      } else if (activeSection === "growth") {
        if (growthSubSection === "ai") void loadGrowthAiSection(refresh, force);
        if (growthSubSection === "community") void loadGrowthCommunitySection(refresh, force);
        if (growthSubSection === "resources") void loadGrowthResourcesSection(refresh, force);
      }
    } catch (e: any) {
      setError(getAppErrorMessage(e, "Failed to load dashboard data."));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [
    activeSection,
    growthSubSection,
    loadGrowthAiSection,
    loadGrowthCommunitySection,
    loadGrowthResourcesSection,
    loadNetworkSection,
    loadOverviewExtras,
    loadSessionsSection
  ]);

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
    async (refresh = false, force = false) => {
      const now = Date.now();
      if (!refresh && !force && now - lastNewsFetchAtRef.current < NEWS_STALE_MS) {
        return;
      }
      try {
        if (refresh) {
          setNewsLoading(true);
        }
        const response = await api.get<{
          categories: Record<NewsCategoryKey, { articles: NewsArticle[] }>;
        }>(`/api/news?limit=6&language=${newsLanguage}`);
        setNewsByCategory((prev) => ({
          ...prev,
          tech: response.data?.categories?.tech?.articles || [],
          edtech: response.data?.categories?.edtech?.articles || [],
          exams: response.data?.categories?.exams?.articles || [],
          scholarships: response.data?.categories?.scholarships?.articles || [],
          opportunities: response.data?.categories?.opportunities?.articles || []
        }));
        lastNewsFetchAtRef.current = now;
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
      fetchDashboard(false);
      fetchNews(false);
    }, [fetchDashboard, fetchNews])
  );

  const handleRefresh = useCallback(async () => {
    await fetchDashboard(true, true);
    if (activeSection === "overview") {
      await fetchNews(true, true);
    }
  }, [activeSection, fetchDashboard, fetchNews]);

  useEffect(() => {
    if (activeSection === "overview") {
      void loadOverviewExtras(false);
      return;
    }
    if (activeSection === "sessions") {
      void loadSessionsSection(false);
      return;
    }
    if (activeSection === "network") {
      void loadNetworkSection(false);
      return;
    }
    if (activeSection === "growth") {
      if (growthSubSection === "ai") void loadGrowthAiSection(false);
      if (growthSubSection === "community") void loadGrowthCommunitySection(false);
      if (growthSubSection === "resources") void loadGrowthResourcesSection(false);
    }
  }, [
    activeSection,
    growthSubSection,
    loadGrowthAiSection,
    loadGrowthCommunitySection,
    loadGrowthResourcesSection,
    loadNetworkSection,
    loadOverviewExtras,
    loadSessionsSection
  ]);

  useEffect(() => {
    const section = String(params.section || "");
    if (section === "overview" || section === "growth" || section === "sessions" || section === "network") {
      setActiveSection(section);
    }
  }, [params.section]);

  useEffect(() => {
    const openQuiz = String(params.openQuiz || "");
    if (openQuiz === "1") {
      setActiveSection("overview");
      openDailyQuiz();
      router.replace("/student-dashboard?section=overview" as never);
    }
  }, [params.openQuiz]);

  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        if (quizVisible) {
          setQuizVisible(false);
          return true;
        }
        if (activeSection === "growth" && growthSubSection !== "ai") {
          setGrowthSubSection("ai");
          return true;
        }
        if (activeSection !== "overview") {
          setActiveSection("overview");
          return true;
        }
        if (searchQuery.trim()) {
          setSearchQuery("");
          return true;
        }
        return false;
      };

      const subscription = BackHandler.addEventListener("hardwareBackPress", onBackPress);
      return () => subscription.remove();
    }, [quizVisible, activeSection, growthSubSection, searchQuery])
  );

  const pendingPaymentSessions = useMemo(
    () =>
      sessions.filter(
        (session) =>
          session.status !== "cancelled" &&
          session.sessionStatus === "booked" &&
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
      const message = handleAppError(e, { fallbackMessage: "Failed to submit payment proof." });
      setError(message);
    } finally {
      setSubmittingBySession((prev) => ({ ...prev, [session._id]: false }));
    }
  }

  async function retryRazorpayPayment(session: Session) {
    if (!RazorpayCheckout) {
      setError("Razorpay SDK unavailable. Build a dev/prod APK to use Razorpay.");
      return;
    }

    try {
      setSubmittingBySession((prev) => ({ ...prev, [session._id]: true }));
      setError(null);
      const { data } = await api.post<RazorpayRetryOrderResponse>(`/api/sessions/${session._id}/retry-order`);
      const paymentResult = await RazorpayCheckout.open({
        description: "ORIN Mentorship Session",
        image: "",
        currency: data.order?.currency || "INR",
        key: data.razorpayKeyId,
        amount: data.order?.amount || 0,
        name: "ORIN",
        order_id: data.order?.id,
        prefill: {
          email: user?.email || "",
          contact: "",
          name: user?.name || ""
        },
        theme: { color: "#1F7A4C" }
      });

      await api.post("/api/sessions/verify-payment", {
        sessionId: session._id,
        razorpay_order_id: paymentResult.razorpay_order_id,
        razorpay_payment_id: paymentResult.razorpay_payment_id,
        razorpay_signature: paymentResult.razorpay_signature
      });

      notify("Payment successful. Session confirmed.");
      await fetchDashboard(true, true);
    } catch (e: any) {
      const message = handleAppError(e, {
        mode: "alert",
        title: "Payment",
        fallbackMessage: "Payment not completed. You can try again from Pending Payments."
      });
      setError(message);
      await fetchDashboard(true, true);
    } finally {
      setSubmittingBySession((prev) => ({ ...prev, [session._id]: false }));
    }
  }

  function cancelPendingSession(session: Session) {
    Alert.alert(
      "Delete pending session?",
      "This will remove the unpaid pending session and release the slot so someone else can book it.",
      [
        { text: "Keep", style: "cancel" },
        {
          text: "Delete Session",
          style: "destructive",
          onPress: async () => {
            try {
              setSubmittingBySession((prev) => ({ ...prev, [session._id]: true }));
              setError(null);
              await api.patch(`/api/sessions/${session._id}/cancel`);
              notify("Pending session deleted. Slot released.");
              await fetchDashboard(true);
            } catch (e: any) {
              const message = handleAppError(e, { fallbackMessage: "Failed to delete pending session." });
              setError(message);
            } finally {
              setSubmittingBySession((prev) => ({ ...prev, [session._id]: false }));
            }
          }
        }
      ]
    );
  }

  function nextDifficulty(current: "easy" | "medium" | "hard", wasCorrect: boolean): "easy" | "medium" | "hard" {
    if (wasCorrect) {
      if (current === "easy") return "medium";
      if (current === "medium") return "hard";
      return "hard";
    }
    if (current === "hard") return "medium";
    if (current === "medium") return "easy";
    return "easy";
  }

  function pickQuestion(
    pool: DailyQuizQuestion[],
    usedIds: Set<string>,
    preferredDifficulty: "easy" | "medium" | "hard"
  ): DailyQuizQuestion | null {
    const candidates = pool.filter(
      (item) => item.difficulty === preferredDifficulty && !usedIds.has(String(item.id))
    );
    if (candidates.length) {
      return candidates[Math.floor(Math.random() * candidates.length)];
    }
    const any = pool.filter((item) => !usedIds.has(String(item.id)));
    if (!any.length) return null;
    return any[Math.floor(Math.random() * any.length)];
  }

  async function openDailyQuiz(domainOverride?: string) {
    try {
      setQuizLoading(true);
      setError(null);
      const domain = domainOverride || selectedQuizDomain || dailyDashboard?.dailyQuiz?.domain || "Technology & AI";
      const { data } = await api.get<DailyQuizResponse>("/api/network/daily-quiz", {
        params: { domain }
      });
      setDailyQuiz(data || null);
      if (data?.completedToday || !data?.quiz) {
        setQuizMessage(data?.message || "Today's quiz already completed.");
        notify(data?.message || "Today's quiz already completed.");
        await fetchDashboard(true);
        return;
      }

      const used = new Set<string>();
      const difficulty = data.quiz.startDifficulty || "medium";
      const generated: DailyQuizQuestion[] = [];
      for (let i = 0; i < 5; i += 1) {
        const question = pickQuestion(data.quiz.questionPool || [], used, difficulty);
        if (!question) break;
        generated.push(question);
        used.add(String(question.id));
      }
      if (generated.length < 5) {
        throw new Error("Daily quiz pool is incomplete.");
      }

      setQuizQuestions(generated);
      setQuizIndex(0);
      setSelectedOption(null);
      setQuizFeedback(null);
      setQuizXp(0);
      setQuizAnswers([]);
      setQuizResult(null);
      setQuizMessage("");
      slideAnim.setValue(0);
      setQuizVisible(true);
    } catch (e: any) {
      setError(getAppErrorMessage(e, "Failed to load daily quiz."));
    } finally {
      setQuizLoading(false);
    }
  }

  function openQuizDomainPicker() {
    setSelectedQuizDomain(dailyDashboard?.dailyQuiz?.domain || dailyQuiz?.domain || selectedQuizDomain || "Technology & AI");
    setQuizDomainPickerVisible(true);
  }

  async function startQuizFromSelectedDomain() {
    const domain = selectedQuizDomain || "Technology & AI";
    setQuizDomainPickerVisible(false);
    await openDailyQuiz(domain);
  }

  function submitAnswerAndNext() {
    const current = quizQuestions[quizIndex];
    if (!current || !selectedOption) return;
    const isCorrect = selectedOption === current.correct;
    const points = isCorrect ? 10 : 0;
    const feedbackText = isCorrect ? "Great job!" : "Keep going!";

    setQuizFeedback(isCorrect ? "correct" : "wrong");
    if (points > 0) {
      setQuizXp((prev) => prev + points);
      notify(`+${points} XP`);
    } else {
      notify(feedbackText);
    }

    const answerRow = {
      questionId: current.id,
      skill: current.skill,
      difficulty: current.difficulty,
      selectedOption,
      correctOption: current.correct,
      isCorrect
    };
    setQuizAnswers((prev) => [...prev, answerRow]);

    const remainingPool = quizQuestions.filter((item, idx) => idx > quizIndex);
    if (remainingPool.length > 0) {
      const desired = nextDifficulty(current.difficulty, isCorrect);
      const nextQuestion =
        remainingPool.find((item) => item.difficulty === desired) || remainingPool[0];
      if (nextQuestion && nextQuestion.id !== quizQuestions[quizIndex + 1]?.id) {
        setQuizQuestions((prev) => {
          const copy = [...prev];
          const foundIndex = copy.findIndex((item, idx) => idx > quizIndex && item.id === nextQuestion.id);
          if (foundIndex > -1) {
            const temp = copy[quizIndex + 1];
            copy[quizIndex + 1] = copy[foundIndex];
            copy[foundIndex] = temp;
          }
          return copy;
        });
      }
    }
  }

  function goNextQuestion() {
    if (quizIndex >= quizQuestions.length - 1) return;
    setSelectedOption(null);
    setQuizFeedback(null);
    Animated.sequence([
      Animated.timing(slideAnim, { toValue: 1, duration: 160, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 0, useNativeDriver: true })
    ]).start(() => setQuizIndex((prev) => prev + 1));
  }

  async function finishQuiz() {
    try {
      setSubmittingQuiz(true);
      setError(null);
      const payloadAnswers = quizAnswers.length === 5 ? quizAnswers : [];
      if (payloadAnswers.length !== 5) {
        throw new Error("Please complete all 5 questions.");
      }
      const { data } = await api.post<DailyQuizSubmitResponse>("/api/network/daily-quiz/submit", {
        domain: dailyQuiz?.domain || dailyDashboard?.dailyQuiz?.domain || "Technology & AI",
        answers: payloadAnswers
      });
      setQuizResult(data?.result || null);
      notify("Quiz completed.");
      await fetchDashboard(true);
    } catch (e: any) {
      const message = handleAppError(e, { fallbackMessage: "Failed to submit quiz." });
      setError(message);
    } finally {
      setSubmittingQuiz(false);
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
      const message = handleAppError(e, { fallbackMessage: "Failed to save session note." });
      setError(message);
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
      const message = handleAppError(e, { fallbackMessage: "Failed to submit review." });
      setError(message);
    }
  }

  async function joinChallenge(challengeId: string) {
    try {
      setError(null);
      await api.post(`/api/network/challenges/${challengeId}/join`);
      notify("Challenge joined.");
      await fetchDashboard(true);
    } catch (e: any) {
      const message = handleAppError(e, { fallbackMessage: "Failed to join challenge." });
      setError(message);
    }
  }

  async function joinGroup(groupId: string) {
    try {
      setError(null);
      await api.post(`/api/network/mentor-groups/${groupId}/join`);
      notify("Group joined.");
      await fetchDashboard(true);
    } catch (e: any) {
      const message = handleAppError(e, { fallbackMessage: "Failed to join group." });
      setError(message);
    }
  }

  async function toggleLiveSessionInterest(liveSessionId: string) {
    try {
      setTogglingLiveInterestId(liveSessionId);
      setError(null);
      const { data } = await api.post(`/api/network/live-sessions/${liveSessionId}/interest`);
      setLiveSessions((prev) =>
        prev.map((item) =>
          item.id === liveSessionId
            ? {
                ...item,
                interestedCount: data?.liveSession?.interestedCount ?? item.interestedCount ?? 0,
                isInterested: data?.liveSession?.isInterested ?? item.isInterested ?? false
              }
            : item
        )
      );
      notify(data?.message || "Interest updated.");
    } catch (e: any) {
      const message = handleAppError(e, { fallbackMessage: "Failed to update interest." });
      setError(message);
    } finally {
      setTogglingLiveInterestId(null);
    }
  }

  async function openLiveSessionBooking(item: LiveSessionItem) {
    try {
      setError(null);
      if (item.myBooking?.bookingStatus === "booked") {
        if (item.meetingLink) {
          await Linking.openURL(item.meetingLink);
        } else {
          Alert.alert("Booked", "Your live session booking is already confirmed.");
        }
        return;
      }

      if (item.myBooking?.bookingStatus === "pending_payment" && item.myBooking?.paymentMode === "razorpay") {
        await retryLiveSessionBooking(item);
        return;
      }

      const { data } = await api.post<LiveSessionOrderResponse>(`/api/network/live-sessions/${item.id}/book`);
      if (data.mode === "free") {
        notify("Live session booked.");
        await fetchDashboard(true);
        return;
      }

      if (!RazorpayCheckout) {
        Alert.alert("Unavailable", "Razorpay SDK is unavailable in this build.");
        return;
      }

      const bookingId = data.booking?._id;
      const paymentResult = await RazorpayCheckout.open({
        description: item.title || "ORIN Live Session",
        image: "",
        currency: data.order?.currency || "INR",
        key: data.razorpayKeyId,
        amount: data.order?.amount || 0,
        name: "ORIN",
        order_id: data.order?.id,
        theme: { color: "#1F7A4C" }
      });

      await api.post("/api/network/live-sessions/verify-payment", {
        bookingId,
        razorpay_order_id: paymentResult.razorpay_order_id,
        razorpay_payment_id: paymentResult.razorpay_payment_id,
        razorpay_signature: paymentResult.razorpay_signature
      });
      notify("Live session booked successfully.");
      await fetchDashboard(true);
    } catch (e: any) {
      const message = handleAppError(e, {
        mode: "alert",
        title: "Live session",
        fallbackMessage: "Payment failed. Please try again or use a different method."
      });
      setError(message);
      await fetchDashboard(true);
    }
  }

  async function retryLiveSessionBooking(item: LiveSessionItem) {
    if (!item.myBooking?.id) return;
    if (!RazorpayCheckout) {
      Alert.alert("Unavailable", "Razorpay SDK is unavailable in this build.");
      return;
    }

    try {
      const { data } = await api.post<LiveSessionOrderResponse>(`/api/network/live-sessions/bookings/${item.myBooking.id}/retry-order`);
      const paymentResult = await RazorpayCheckout.open({
        description: item.title || "ORIN Live Session",
        image: "",
        currency: data.order?.currency || "INR",
        key: data.razorpayKeyId,
        amount: data.order?.amount || 0,
        name: "ORIN",
        order_id: data.order?.id,
        theme: { color: "#1F7A4C" }
      });

      await api.post("/api/network/live-sessions/verify-payment", {
        bookingId: item.myBooking.id,
        razorpay_order_id: paymentResult.razorpay_order_id,
        razorpay_payment_id: paymentResult.razorpay_payment_id,
        razorpay_signature: paymentResult.razorpay_signature
      });
      notify("Live session booked successfully.");
      await fetchDashboard(true);
    } catch (e: any) {
      const message = handleAppError(e, {
        mode: "alert",
        title: "Live session",
        fallbackMessage: "Payment failed. Please try again or use a different method."
      });
      setError(message);
      await fetchDashboard(true);
    }
  }

  if (user?.role !== "student") {
    return (
      <View style={styles.centered}>
        <Text style={[styles.error, { color: colors.danger }]}>Access denied for current role.</Text>
      </View>
    );
  }

  const currentQuizQuestion = quizQuestions[quizIndex];
  const progressRatio = quizQuestions.length ? (quizIndex + 1) / quizQuestions.length : 0;
  const selectedAnswersCount = quizAnswers.length;
  const canFinalizeQuiz = selectedAnswersCount === 5 && !quizResult;
  const kidActivityCount = institutionRoadmaps.reduce((count, roadmap) => count + (roadmap.weeks?.length || 0), 0);
  const kidStarCount = certifications.length * 10 + challenges.filter((item) => item.isParticipating).length * 5;
  const firstName = String(user?.name || "Learner").trim().split(/\s+/)[0] || "Learner";
  const renderHighSchoolHero = () => (
    <View style={[styles.homeHero, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.homeHeroTop}>
        <View style={styles.homeHeroCopy}>
          <Text style={[styles.homeHeroEyebrow, { color: colors.accent }]}>Student Home</Text>
          <Text style={[styles.homeHeroTitle, { color: colors.text }]}>
            Hi {firstName}, keep your study streak moving
          </Text>
          <Text style={[styles.homeHeroSubtitle, { color: colors.textMuted }]}>
            Your roadmap, school progress, and guidance are ready for today&apos;s session.
          </Text>
        </View>
        <View style={[styles.homeHeroBadge, { backgroundColor: colors.accentSoft, borderColor: colors.accent }]}>
          <Ionicons name="flame" size={22} color={colors.accent} />
          <Text style={[styles.homeHeroBadgeText, { color: colors.accent }]}>{rewardSummary.current.label}</Text>
        </View>
      </View>

      <View style={styles.homeMetricRow}>
        <View style={[styles.homeMetricCard, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
          <Ionicons name="flash" size={18} color="#F59E0B" />
          <Text style={[styles.homeMetricValue, { color: colors.text }]}>{rewardSummary.todayXp}</Text>
          <Text style={[styles.homeMetricLabel, { color: colors.textMuted }]}>{rewardSummary.pointsLabel}</Text>
        </View>
        <View style={[styles.homeMetricCard, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
          <Ionicons name="flame" size={18} color="#EF4444" />
          <Text style={[styles.homeMetricValue, { color: colors.text }]}>{rewardSummary.streak}</Text>
          <Text style={[styles.homeMetricLabel, { color: colors.textMuted }]}>Day streak</Text>
        </View>
        <View style={[styles.homeMetricCard, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
          <Ionicons name="podium" size={18} color="#2563EB" />
          <Text style={[styles.homeMetricValue, { color: colors.text }]}>{rewardSummary.rank ? `#${rewardSummary.rank}` : "-"}</Text>
          <Text style={[styles.homeMetricLabel, { color: colors.textMuted }]}>{rewardSummary.boardLabel}</Text>
        </View>
      </View>

      <View style={styles.homeProgressWrap}>
        <View style={styles.homeProgressHeader}>
          <Text style={[styles.homeProgressTitle, { color: colors.text }]}>{rewardSummary.current.label} progress</Text>
          <Text style={[styles.homeProgressMeta, { color: colors.textMuted }]}>
            {rewardSummary.next ? `Next: ${rewardSummary.next.label}` : "Top tier"}
          </Text>
        </View>
        <View style={[styles.homeProgressTrack, { backgroundColor: colors.surfaceAlt }]}>
          <View style={[styles.homeProgressFill, { width: `${Math.round(rewardSummary.progress * 100)}%`, backgroundColor: colors.accent }]} />
        </View>
      </View>

      <View style={styles.homeHeroActions}>
        <TouchableOpacity style={[styles.homePrimaryAction, { backgroundColor: colors.accent }]} onPress={() => router.push("/ai/highschool-study-roadmap" as never)}>
          <Ionicons name="play" size={16} color={colors.accentText} />
          <Text style={[styles.homePrimaryActionText, { color: colors.accentText }]}>Weekly study plan</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.homeSecondaryAction, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }]} onPress={() => router.push("/community/highschool-progress" as never)}>
          <Ionicons name="stats-chart" size={16} color={colors.accent} />
          <Text style={[styles.homeSecondaryActionText, { color: colors.text }]}>Progress</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.homeSecondaryAction, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }]} onPress={() => router.push("/community/highschool-leaderboard" as never)}>
          <Ionicons name="trophy" size={16} color={colors.accent} />
          <Text style={[styles.homeSecondaryActionText, { color: colors.text }]}>Ranks</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
  const renderKidOverview = () => (
    <>
      <View style={[styles.institutionHubCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <TouchableOpacity activeOpacity={0.92} style={styles.institutionHubHeaderRow} onPress={() => setInstitutionExpanded((prev) => !prev)}>
          <View style={styles.institutionHubHeader}>
            <View style={[styles.institutionHubBadge, { backgroundColor: isDark ? "rgba(99,102,241,0.18)" : "#EEF2FF" }]}>
              <Text style={[styles.institutionHubBadgeText, { color: isDark ? "#C7D2FE" : "#1849A9" }]}>School</Text>
            </View>
            <Text style={[styles.institutionHubTitle, { color: colors.text }]}>My Institution</Text>
            <Text style={[styles.institutionHubMeta, { color: colors.textMuted }]}>
              {studentInstitutionName
                ? `${studentInstitutionName}${studentClassName ? ` - Class ${studentClassName}` : ""}`
                : "Join your school in profile to unlock school feed, activities, and class resources."}
            </Text>
          </View>
          <View style={[styles.institutionExpandBtn, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}>
            <Ionicons name={institutionExpanded ? "chevron-up" : "chevron-down"} size={18} color={colors.textMuted} />
          </View>
        </TouchableOpacity>
        {institutionExpanded ? (
          <View style={styles.institutionTileGrid}>
            <TouchableOpacity style={[styles.institutionTile, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]} onPress={() => router.push("/network?section=institution" as never)}>
              <Text style={[styles.institutionTileTitle, { color: isDark ? "#86EFAC" : "#163A2A" }]}>School Feed</Text>
              <Text style={[styles.institutionTileMeta, { color: colors.textMuted }]}>Teacher and school posts only</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.institutionTile, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]} onPress={() => router.push("/community/leaderboard" as never)}>
              <Text style={[styles.institutionTileTitle, { color: isDark ? "#93C5FD" : "#163A2A" }]}>Star Board</Text>
              <Text style={[styles.institutionTileMeta, { color: colors.textMuted }]}>
                {leaderboard?.collegeTop?.length ? `${leaderboard.collegeTop.length} star spot${leaderboard.collegeTop.length === 1 ? "" : "s"} visible` : "Friendly class stars and highlights"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.institutionTile, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]} onPress={() => router.push("/ai/kids-learning-activities" as never)}>
              <Text style={[styles.institutionTileTitle, { color: isDark ? "#FDE68A" : "#163A2A" }]}>Today&apos;s Activity</Text>
              <Text style={[styles.institutionTileMeta, { color: colors.textMuted }]}>
                {kidActivityCount ? `${kidActivityCount} teacher activit${kidActivityCount === 1 ? "y" : "ies"} ready` : "Open your school activity for today"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.institutionTile, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]} onPress={() => router.push("/community/knowledge-library?section=institution" as never)}>
              <Text style={[styles.institutionTileTitle, { color: isDark ? "#F0ABFC" : "#163A2A" }]}>Class Resources</Text>
              <Text style={[styles.institutionTileMeta, { color: colors.textMuted }]}>
                {institutionKnowledgeLibrary.length ? `${institutionKnowledgeLibrary.length} class resource${institutionKnowledgeLibrary.length === 1 ? "" : "s"} shared` : "Worksheets, images, and activities appear here"}
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>

      <Text style={[styles.groupTitle, { color: colors.text }]}>Today&apos;s Activity</Text>
      <Text style={[styles.groupNote, { color: colors.textMuted }]}>Open one teacher activity, finish it, and submit it for stars.</Text>
      <View style={styles.opportunityWrap}>
        <TouchableOpacity style={[styles.opportunityCard, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => router.push("/ai/kids-learning-activities" as never)}>
          <Text style={[styles.opportunityTitle, { color: colors.text }]}>Do Today&apos;s Activity</Text>
          <Text style={[styles.opportunityMeta, { color: colors.textMuted }]}>
            {kidActivityCount ? `${kidActivityCount} school activit${kidActivityCount === 1 ? "y" : "ies"} available now` : "Open your school activity and submit your work"}
          </Text>
          <Text style={[styles.opportunityMeta, { color: colors.textMuted }]}>Flow: Open -&gt; Do -&gt; Submit -&gt; Get Stars</Text>
        </TouchableOpacity>
      </View>

      <Text style={[styles.groupTitle, { color: colors.text }]}>Stars</Text>
      <Text style={[styles.groupNote, { color: colors.textMuted }]}>Collect stars from activities, fun challenges, and school rewards.</Text>
      <View style={styles.historyWrap}>
        <View style={[styles.historyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.historyTitle, { color: colors.text }]}>Star Rewards</Text>
          <Text style={[styles.historyMeta, { color: colors.textMuted }]}>
            {certifications.length ? `${certifications.length} reward${certifications.length === 1 ? "" : "s"} earned` : "Finish activities to unlock your first reward"}
          </Text>
          <Text style={[styles.historyMeta, { color: colors.textMuted }]}>Estimated stars: {kidStarCount}</Text>
        </View>
        <View style={[styles.historyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.historyTitle, { color: colors.text }]}>Fun Challenges</Text>
          <Text style={[styles.historyMeta, { color: colors.textMuted }]}>
            {challenges.length ? `${challenges.length} fun challenge${challenges.length === 1 ? "" : "s"} ready` : "Teacher challenges will appear here"}
          </Text>
          <TouchableOpacity onPress={() => router.push("/community/challenges" as never)}>
            <Text style={[styles.sectionHeaderLink, { color: colors.accent }]}>Open challenges</Text>
          </TouchableOpacity>
        </View>
      </View>
    </>
  );
  const renderHighSchoolOverview = () => (
    <>
      {renderHighSchoolHero()}
      <View style={[styles.institutionHubCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <TouchableOpacity activeOpacity={0.92} style={styles.institutionHubHeaderRow} onPress={() => setInstitutionExpanded((prev) => !prev)}>
          <View style={styles.institutionHubHeader}>
            <View style={[styles.institutionHubBadge, { backgroundColor: isDark ? "rgba(99,102,241,0.18)" : "#EEF2FF" }]}>
              <Text style={[styles.institutionHubBadgeText, { color: isDark ? "#C7D2FE" : "#1849A9" }]}>School</Text>
            </View>
            <Text style={[styles.institutionHubTitle, { color: colors.text }]}>My Institution</Text>
            <Text style={[styles.institutionHubMeta, { color: colors.textMuted }]}>
              {studentInstitutionName
                ? `${studentInstitutionName}${studentClassName ? ` - Class ${studentClassName}` : ""}`
                : "Add your school in profile to unlock roadmap, resources, and school progress."}
            </Text>
          </View>
          <View style={[styles.institutionExpandBtn, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}>
            <Ionicons name={institutionExpanded ? "chevron-up" : "chevron-down"} size={18} color={colors.textMuted} />
          </View>
        </TouchableOpacity>
        {institutionExpanded ? (
          <View style={styles.institutionTileGrid}>
            <TouchableOpacity style={[styles.institutionTile, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]} onPress={() => router.push("/network?section=institution" as never)}>
              <Text style={[styles.institutionTileTitle, { color: isDark ? "#86EFAC" : "#163A2A" }]}>School Feed</Text>
              <Text style={[styles.institutionTileMeta, { color: colors.textMuted }]}>Teacher and school posts first</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.institutionTile, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]} onPress={() => router.push("/ai/highschool-study-roadmap" as never)}>
              <Text style={[styles.institutionTileTitle, { color: isDark ? "#FDE68A" : "#163A2A" }]}>Study Roadmap</Text>
              <Text style={[styles.institutionTileMeta, { color: colors.textMuted }]}>
                {institutionRoadmaps.length ? `${institutionRoadmaps.length} roadmap${institutionRoadmaps.length === 1 ? "" : "s"} available` : "Open your weekly study roadmap"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.institutionTile, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]} onPress={() => router.push("/community/highschool-resource-library" as never)}>
              <Text style={[styles.institutionTileTitle, { color: isDark ? "#F0ABFC" : "#163A2A" }]}>Resource Library</Text>
              <Text style={[styles.institutionTileMeta, { color: colors.textMuted }]}>
                {institutionKnowledgeLibrary.length ? `${institutionKnowledgeLibrary.length} school resource${institutionKnowledgeLibrary.length === 1 ? "" : "s"} shared` : "Notes, PDFs, and videos appear here"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.institutionTile, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]} onPress={() => router.push("/community/highschool-school-challenges" as never)}>
              <Text style={[styles.institutionTileTitle, { color: isDark ? "#FDBA74" : "#163A2A" }]}>School Challenges</Text>
              <Text style={[styles.institutionTileMeta, { color: colors.textMuted }]}>
                {challenges.length ? `${challenges.length} challenge${challenges.length === 1 ? "" : "s"} active` : "Quizzes and competitions will appear here"}
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>

      <Text style={[styles.groupTitle, { color: colors.text }]}>Academic Roadmap</Text>
      <Text style={[styles.groupNote, { color: colors.textMuted }]}>Keep school goals, weekly tasks, and institution roadmap progress in one place.</Text>
      <View style={styles.opportunityWrap}>
        <TouchableOpacity style={[styles.opportunityCard, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => router.push("/ai/highschool-study-roadmap" as never)}>
          <Text style={[styles.opportunityTitle, { color: colors.text }]}>Open Study Roadmap</Text>
          <Text style={[styles.opportunityMeta, { color: colors.textMuted }]}>
            {roadmap?.steps?.length ? `${roadmap.steps.length} AI roadmap step${roadmap.steps.length === 1 ? "" : "s"} ready` : "Generate and follow your weekly study plan"}
          </Text>
          <Text style={[styles.opportunityMeta, { color: colors.textMuted }]}>
            {institutionRoadmaps.length ? `${institutionRoadmaps.length} institution roadmap${institutionRoadmaps.length === 1 ? "" : "s"} also available` : "Add school roadmap support from your institution"}
          </Text>
        </TouchableOpacity>
      </View>

      <Text style={[styles.groupTitle, { color: colors.text }]}>School Progress</Text>
      <Text style={[styles.groupNote, { color: colors.textMuted }]}>Track challenge activity, streaks, and school rank in a study-first way.</Text>
      <View style={styles.historyWrap}>
        <View style={[styles.historyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.historyTitle, { color: colors.text }]}>Progress Snapshot</Text>
          <Text style={[styles.historyMeta, { color: colors.textMuted }]}>
            {dailyDashboard ? `XP ${dailyDashboard.xp} - Streak ${dailyDashboard.streakDays} day${dailyDashboard.streakDays === 1 ? "" : "s"}` : "Daily study progress will appear here"}
          </Text>
          <Text style={[styles.historyMeta, { color: colors.textMuted }]}>
            {reputationSummary ? `School percentile: Top ${reputationSummary.topPercent}%` : "Finish quizzes and tasks to unlock ranking"}
          </Text>
        </View>
        <View style={[styles.historyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.historyTitle, { color: colors.text }]}>Teachers & Guidance</Text>
          <Text style={[styles.historyMeta, { color: colors.textMuted }]}>
            {verifiedMentors.length ? `${verifiedMentors.length} verified teachers or mentors available` : "Teacher guidance will appear here"}
          </Text>
          <TouchableOpacity onPress={() => router.push("/mentorship?section=interaction" as never)}>
            <Text style={[styles.sectionHeaderLink, { color: colors.accent }]}>Open guidance</Text>
          </TouchableOpacity>
        </View>
      </View>
    </>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
    <GlobalHeader
      searchValue={searchQuery}
      onSearchChange={setSearchQuery}
      onSubmitSearch={() => null}
      searchPlaceholder="Search mentors, dates or sessions"
    />
    <ScrollView
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
          {totalSearchMatches > 0 ? (
            <View style={styles.searchResultList}>
              {searchResultItems.map((item) => (
                <View key={item.id} style={styles.searchResultCard}>
                  <Text style={[styles.searchResultTitle, { color: colors.text }]}>{item.title}</Text>
                  <Text style={[styles.searchResultSubtitle, { color: colors.textMuted }]}>{item.subtitle}</Text>
                </View>
              ))}
            </View>
          ) : (
            <TouchableOpacity style={styles.searchAskAiBtn} onPress={() => router.push(`/ai-assistant?q=${encodeURIComponent(normalizedQuery)}` as never)}>
              <Text style={styles.searchAskAiBtnText}>Ask AI about &quot;{normalizedQuery}&quot;</Text>
            </TouchableOpacity>
          )}
        </>
      ) : null}

      {!isHighSchool ? (
      <View style={[styles.heroBanner, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.heroEyebrow, { color: colors.accent }]}>Student Space</Text>
        <Text style={[styles.heroTitle, { color: colors.text }]}>{isKid ? "Grow With Your School" : isHighSchool ? "Build Your School Journey" : "Unlock Your Mentorship Journey"}</Text>
        <Text style={[styles.heroSubTitle, { color: colors.textMuted }]}>
          {isKid
            ? "Follow school activities, collect stars, and learn with teacher guidance."
            : isHighSchool
              ? "Track school growth, resources, and guided study progress with ORIN."
              : "Explore mentors, track sessions, and grow faster with ORIN."}
        </Text>
      </View>
      ) : null}

      {activeSection !== "overview" ? (
        <TouchableOpacity style={styles.sectionBackButton} onPress={() => setActiveSection("overview")}>
          <Text style={[styles.sectionBackButtonText, { color: colors.accent }]}>Back to Dashboard Home</Text>
        </TouchableOpacity>
      ) : null}

      {activeSection === "overview" ? (
      isKid ? renderKidOverview() : isHighSchool ? renderHighSchoolOverview() : (
      <>
      <Text style={[styles.sectionHeader, { color: colors.text }]}>Career & Tech Updates</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.newsTabRow}>
        {newsTabs.map((tab) => {
          const active = activeNewsTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[
                styles.newsTabChip,
                { borderColor: colors.border, backgroundColor: colors.surface },
                active && styles.newsTabChipActive,
                active && { borderColor: colors.accent, backgroundColor: colors.accentSoft }
              ]}
              onPress={() => setActiveNewsTab(tab.key)}
            >
              <Text
                style={[
                  styles.newsTabText,
                  { color: colors.textMuted },
                  active && styles.newsTabTextActive,
                  active && { color: colors.accent }
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.newsRow}>
        {newsLoading && activeNewsArticles.length === 0 ? (
          <View style={styles.newsLoaderWrap}>
            <ActivityIndicator size="small" color="#1F7A4C" />
            <Text style={[styles.meta, { color: colors.textMuted }]}>Loading updates...</Text>
          </View>
        ) : activeNewsArticles.length === 0 ? (
          <View style={[styles.newsLoaderWrap, { borderColor: colors.border, backgroundColor: colors.surface }]}>
            <Text style={[styles.meta, { color: colors.textMuted }]}>No updates available right now.</Text>
          </View>
        ) : (
          activeNewsArticles.slice(0, 8).map((item, index) => (
            <View key={`${item.url}-${index}`} style={[styles.newsCard, { borderColor: colors.border, backgroundColor: colors.surface }]}>
              {item.imageUrl ? <Image source={{ uri: item.imageUrl }} style={styles.newsImage} resizeMode="cover" /> : null}
              <Text style={[styles.newsTitle, { color: colors.text }]} numberOfLines={3}>{item.title}</Text>
              <Text style={[styles.newsDesc, { color: colors.textMuted }]} numberOfLines={3}>{item.description || "Tap Read More for full details."}</Text>
              <View style={styles.newsMetaRow}>
                <Text style={[styles.newsSource, { color: colors.textMuted }]} numberOfLines={1}>{item.source || "News Source"}</Text>
                <TouchableOpacity onPress={() => item.url && Linking.openURL(item.url)}>
                  <Text style={[styles.newsReadMore, { color: colors.accent }]}>Read More</Text>
                </TouchableOpacity>

              </View>
            </View>
          ))
        )}
      </ScrollView>

      <Text style={[styles.sectionHeader, { color: colors.text }]}>Featured</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.featuredRow}>
        <TouchableOpacity style={[styles.featureCard, styles.featureCardOne, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => router.push("/domains")}>
          <Text style={[styles.featurePill, { backgroundColor: colors.surfaceAlt, color: colors.text }]}>Discover</Text>
          <Text style={[styles.featureTitle, { color: colors.text }]}>Top Mentor Domains</Text>
          <Text style={[styles.featureCopy, { color: colors.textMuted }]}>Browse all approved mentors by category and specialization.</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.featureCard, styles.featureCardTwo, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => router.push("/chat" as never)}>
          <Text style={[styles.featurePill, { backgroundColor: colors.surfaceAlt, color: colors.text }]}>Connect</Text>
          <Text style={[styles.featureTitle, { color: colors.text }]}>Session Conversations</Text>
          <Text style={[styles.featureCopy, { color: colors.textMuted }]}>Message confirmed mentors and prepare before live sessions.</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.featureCard, styles.featureCardThree, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => router.push("/ai-assistant" as never)}>
          <Text style={[styles.featurePill, { backgroundColor: colors.surfaceAlt, color: colors.text }]}>Boost</Text>
          <Text style={[styles.featureTitle, { color: colors.text }]}>AI Career Coach</Text>
          <Text style={[styles.featureCopy, { color: colors.textMuted }]}>Get study plans, interview prep ideas, and guidance instantly.</Text>
        </TouchableOpacity>
      </ScrollView>

      <Text style={[styles.sectionHeader, { color: colors.text }]}>Live Banners</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.bannerRow}>
        {studentBanners.map((banner) => (
          <View key={banner.key} style={[styles.bannerCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.bannerTag, { backgroundColor: colors.surfaceAlt, color: colors.text }]}>{banner.tag}</Text>
            <Text style={[styles.bannerTitle, { color: colors.text }]}>{banner.title}</Text>
            <Text style={[styles.bannerCopy, { color: colors.textMuted }]}>{banner.copy}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={[styles.institutionHubCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <TouchableOpacity activeOpacity={0.92} style={styles.institutionHubHeaderRow} onPress={() => setInstitutionExpanded((prev) => !prev)}>
          <View style={styles.institutionHubHeader}>
            <View style={[styles.institutionHubBadge, { backgroundColor: isDark ? "rgba(99,102,241,0.18)" : "#EEF2FF" }]}>
              <Text style={[styles.institutionHubBadgeText, { color: isDark ? "#C7D2FE" : "#1849A9" }]}>Institution</Text>
            </View>
            <Text style={[styles.institutionHubTitle, { color: colors.text }]}>My Institution</Text>
            <Text style={[styles.institutionHubMeta, { color: colors.textMuted }]}>
              {studentInstitutionName
                ? `${studentInstitutionName}${studentClassName ? ` - Class ${studentClassName}` : ""}`
                : isKid || isHighSchool
                  ? "Join your school in profile to unlock feed, activities, resources, and competitions."
                  : "Add your institution in profile to unlock school-specific feeds, resources, and roadmaps."}
            </Text>
          </View>
          <View style={[styles.institutionExpandBtn, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}>
            <Ionicons name={institutionExpanded ? "chevron-up" : "chevron-down"} size={18} color={colors.textMuted} />
          </View>
        </TouchableOpacity>
        {institutionExpanded ? (
          <View style={styles.institutionTileGrid}>
            <TouchableOpacity style={[styles.institutionTile, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]} onPress={() => router.push("/network?section=institution" as never)}>
              <Text style={[styles.institutionTileTitle, { color: isDark ? "#86EFAC" : "#163A2A" }]}>{institutionFeedLabel}</Text>
              <Text style={[styles.institutionTileMeta, { color: colors.textMuted }]}>{isKid ? "Teacher and school posts only" : "Posts only from your institution"}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.institutionTile, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]} onPress={() => router.push("/community/leaderboard" as never)}>
              <Text style={[styles.institutionTileTitle, { color: isDark ? "#93C5FD" : "#163A2A" }]}>{institutionLeaderboardLabel}</Text>
              <Text style={[styles.institutionTileMeta, { color: colors.textMuted }]}>
                {leaderboard?.collegeTop?.length
                  ? `${leaderboard.collegeTop.length} active ${isKid ? "star" : "rank"}${leaderboard.collegeTop.length === 1 ? "" : "s"} visible`
                  : isKid
                    ? "Track stars and class participation"
                    : "Track your institution rank"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.institutionTile, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]} onPress={() => router.push("/mentorship?section=interaction" as never)}>
              <Text style={[styles.institutionTileTitle, { color: isDark ? "#C4B5FD" : "#163A2A" }]}>Institution Mentors</Text>
              <Text style={[styles.institutionTileMeta, { color: colors.textMuted }]}>
                {verifiedMentors.length ? `${verifiedMentors.length} mentors in guidance pool` : isKid ? "Teacher list grows as school network expands" : "Mentor list grows as school network expands"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.institutionTile, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]} onPress={() => router.push("/ai/career-roadmap?section=institution" as never)}>
              <Text style={[styles.institutionTileTitle, { color: isDark ? "#FDE68A" : "#163A2A" }]}>{institutionRoadmapsLabel}</Text>
              <Text style={[styles.institutionTileMeta, { color: colors.textMuted }]}>
                {institutionRoadmaps.length
                  ? `${institutionRoadmaps.length} ${isKid ? "activity" : "roadmap"}${institutionRoadmaps.length === 1 ? "" : "s"} available`
                  : isKid
                    ? "Open mentor-guided school activities"
                    : "Open mentor-guided roadmaps"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.institutionTile, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]} onPress={() => router.push("/community/certifications" as never)}>
              <Text style={[styles.institutionTileTitle, { color: isDark ? "#F9A8D4" : "#163A2A" }]}>{institutionCertificatesLabel}</Text>
              <Text style={[styles.institutionTileMeta, { color: colors.textMuted }]}>
                {certifications.length
                  ? `${certifications.length} ${isKid ? "reward" : "certificate"}${certifications.length === 1 ? "" : "s"} earned`
                  : isKid
                    ? "See school rewards and recognition"
                    : "See institution-issued recognition"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.institutionTile, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]} onPress={() => router.push("/community/knowledge-library?section=institution" as never)}>
              <Text style={[styles.institutionTileTitle, { color: isDark ? "#F0ABFC" : "#163A2A" }]}>{institutionResourcesLabel}</Text>
              <Text style={[styles.institutionTileMeta, { color: colors.textMuted }]}>
                {institutionKnowledgeLibrary.length
                  ? `${institutionKnowledgeLibrary.length} resource${institutionKnowledgeLibrary.length === 1 ? "" : "s"} shared`
                  : isKid
                    ? "Class resources will appear here"
                    : "School resources will appear here"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.institutionTile, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]} onPress={() => router.push("/community/challenges" as never)}>
              <Text style={[styles.institutionTileTitle, { color: isDark ? "#FDBA74" : "#163A2A" }]}>{institutionCompetitionsLabel}</Text>
              <Text style={[styles.institutionTileMeta, { color: colors.textMuted }]}>
                {challenges.length
                  ? `${challenges.length} active ${isKid ? "challenge" : "competition"}${challenges.length === 1 ? "" : "s"}`
                  : isKid
                    ? "Fun school challenges will appear here"
                    : "School competitions will appear here"}
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>

      <View style={styles.sectionHeaderRow}>
        <Text style={[styles.sectionHeader, { color: colors.text }]}>
          {isKid ? "Teacher Sessions" : isHighSchool ? "Teacher & Mentor Sessions" : "Mentor Live Sessions"}
        </Text>
        <TouchableOpacity onPress={() => router.push("/mentorship?section=interaction" as never)}>
          <Text style={[styles.sectionHeaderLink, { color: colors.accent }]}>View all</Text>
        </TouchableOpacity>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.liveBannerRow}>
        {liveSessions.length === 0 ? (
          <View style={[styles.liveBannerEmpty, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.meta, { color: colors.textMuted }]}>No upcoming live sessions right now.</Text>
          </View>
        ) : (
          liveSessions.slice(0, 8).map((item) => (
            <View key={item.id} style={[styles.liveBannerCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {item.posterImageUrl ? (
                <Image source={{ uri: item.posterImageUrl }} style={styles.liveBannerImage} resizeMode="cover" />
              ) : (
                <View style={[styles.liveBannerImagePlaceholder, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
                  <Text style={[styles.liveBannerPlaceholderText, { color: colors.textMuted }]}>
                    {isKid ? "Teacher Session" : "Live Session"}
                  </Text>
                </View>
              )}
              <Text style={[styles.liveBannerTitle, { color: colors.text }]} numberOfLines={2}>{item.title}</Text>
              <Text style={[styles.liveBannerMeta, { color: colors.textMuted }]} numberOfLines={1}>
                {item.mentor?.name || (isKid ? "Teacher" : "Mentor")} | {new Date(item.startsAt).toLocaleString()}
              </Text>
              <Text style={[styles.liveBannerMeta, { color: colors.textMuted }]} numberOfLines={1}>
                {item.sessionMode === "paid" ? `INR ${item.price || 0}` : "Free"} | Seats left {item.seatsLeft ?? 0}
              </Text>
              <View style={styles.liveBannerFooter}>
                <Text style={[styles.liveBannerMeta, { color: colors.textMuted }]}>Interested: {item.interestedCount || 0}</Text>
                <TouchableOpacity
                  style={[
                    styles.liveBannerBtn,
                    { borderColor: colors.accent, backgroundColor: colors.accentSoft },
                    togglingLiveInterestId === item.id && styles.disabledButton
                  ]}
                  onPress={() => toggleLiveSessionInterest(item.id)}
                  disabled={togglingLiveInterestId === item.id}
                >
                  <Text style={[styles.liveBannerBtnText, { color: colors.accent }]}>
                    {togglingLiveInterestId === item.id
                      ? "..."
                      : item.isInterested
                        ? "Interested"
                        : "I'm in"}
                  </Text>
                </TouchableOpacity>

              </View>
              <TouchableOpacity
                style={[styles.liveBannerBtn, { borderColor: colors.accent, backgroundColor: colors.accentSoft }]}
                onPress={() => openLiveSessionBooking(item)}
              >
                <Text style={[styles.liveBannerBtnText, { color: colors.accent }]}>
                  {item.myBooking?.bookingStatus === "booked"
                    ? item.meetingLink
                      ? "Join Live"
                      : "Booked"
                    : item.myBooking?.bookingStatus === "pending_payment"
                      ? "Pay Now"
                      : item.sessionMode === "paid"
                        ? "Book & Pay"
                        : "Book Free"}
                </Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>

      <View style={styles.sectionHeaderRow}>
        <Text style={[styles.sectionHeader, { color: colors.text }]}>Sprint Programs</Text>
        <TouchableOpacity onPress={() => router.push("/mentorship?section=interaction" as never)}>
          <Text style={[styles.sectionHeaderLink, { color: colors.accent }]}>View all</Text>
        </TouchableOpacity>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.liveBannerRow}>
        {sprints.length === 0 ? (
          <View style={[styles.liveBannerEmpty, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.meta, { color: colors.textMuted }]}>No sprint programs open right now.</Text>
          </View>
        ) : (
          sprints.slice(0, 6).map((item) => (
            <View key={item.id} style={[styles.liveBannerCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {item.posterImageUrl ? (
                <Image source={{ uri: item.posterImageUrl }} style={styles.liveBannerImage} resizeMode="cover" />
              ) : (
                <View style={[styles.liveBannerImagePlaceholder, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
                  <Text style={[styles.liveBannerPlaceholderText, { color: colors.textMuted }]}>Sprint Program</Text>
                </View>
              )}
              <Text style={[styles.liveBannerTitle, { color: colors.text }]} numberOfLines={2}>{item.title}</Text>
              <Text style={[styles.liveBannerMeta, { color: colors.textMuted }]} numberOfLines={1}>
                {item.mentor?.name || "Mentor"} | {new Date(item.startDate).toLocaleDateString()} - {new Date(item.endDate).toLocaleDateString()}
              </Text>
              <Text style={[styles.liveBannerMeta, { color: colors.textMuted }]} numberOfLines={1}>
                {item.sessionMode === "paid" ? `INR ${item.price || 0}` : "Free"} | Seats left {item.seatsLeft ?? 0}
              </Text>
              <View style={styles.liveBannerFooter}>
                <Text style={[styles.liveBannerMeta, { color: colors.textMuted }]}>Weeks: {item.durationWeeks || 1}</Text>
                <Text style={[styles.liveBannerMeta, { color: colors.textMuted }]}>
                  {item.myEnrollment?.enrollmentStatus === "enrolled"
                    ? "Joined"
                    : item.myEnrollment?.enrollmentStatus === "pending_payment"
                      ? "Payment Pending"
                      : item.isSoldOut
                        ? "Sold Out"
                        : `${item.participantCount || 0}/${item.maxParticipants || 20}`}
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.liveBannerBtn, { borderColor: colors.accent, backgroundColor: colors.accentSoft }]}
                onPress={() => router.push(`/sprints/${item.id}` as never)}
              >
                <Text style={[styles.liveBannerBtnText, { color: colors.accent }]}>View Sprint</Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>

      {FEATURE_FLAGS.dailyEngagement ? (
        <>
        <Text style={[styles.sectionHeader, { color: colors.text }]}>
          {isKid ? "Learn. Compete. Win." : isHighSchool ? "Daily Growth Arena" : "Daily Career Quiz"}
        </Text>
          <View style={[styles.rewardHeroCard, { borderColor: isDark ? "#6D28D9" : "#DDD6FE" }]}>
            {!dailyDashboard ? (
              <Text style={styles.rewardHeroEmpty}>Daily rewards unavailable right now.</Text>
            ) : (
              <>
                <View style={styles.rewardHeroTop}>
                  <View style={styles.rewardHeroTitleBlock}>
                    <Text style={styles.rewardHeroEyebrow}>{isKid ? "Today&apos;s Mission" : "Growth Mission"}</Text>
                    <Text style={styles.rewardHeroTitle}>
                      {isKid ? "Collect stars and climb the Star Board" : "Build your streak and climb the leaderboard"}
                    </Text>
                    <Text style={styles.rewardHeroSubtitle}>
                      {dailyDashboard.dailyQuiz?.message || "Complete today's quiz to earn rewards."}
                    </Text>
                  </View>
                  <View style={[styles.rewardLevelBadge, { backgroundColor: rewardSummary.current.tone }]}>
                    <Ionicons name={rewardSummary.current.icon} size={22} color="#FFFFFF" />
                    <Text style={styles.rewardLevelBadgeText}>{rewardSummary.current.label}</Text>
                  </View>
                </View>

                <View style={styles.rewardStatsRow}>
                  <View style={styles.rewardStatCard}>
                    <Ionicons name="star" size={18} color="#FBBF24" />
                    <Text style={styles.rewardStatValue}>{rewardSummary.score}</Text>
                    <Text style={styles.rewardStatLabel}>{rewardSummary.pointsLabel}</Text>
                  </View>
                  <View style={styles.rewardStatCard}>
                    <Ionicons name="flame" size={18} color="#FB7185" />
                    <Text style={styles.rewardStatValue}>{rewardSummary.streak}</Text>
                    <Text style={styles.rewardStatLabel}>Streak</Text>
                  </View>
                  <View style={styles.rewardStatCard}>
                    <Ionicons name="trophy" size={18} color="#F59E0B" />
                    <Text style={styles.rewardStatValue}>{rewardSummary.rank ? `#${rewardSummary.rank}` : "-"}</Text>
                    <Text style={styles.rewardStatLabel}>{rewardSummary.boardLabel}</Text>
                  </View>
                  <View style={styles.rewardStatCard}>
                    <Ionicons name="flash" size={18} color="#38BDF8" />
                    <Text style={styles.rewardStatValue}>+{rewardSummary.todayXp}</Text>
                    <Text style={styles.rewardStatLabel}>Today</Text>
                  </View>
                </View>

                <View style={styles.rewardProgressWrap}>
                  <View style={styles.rewardProgressHeader}>
                    <Text style={styles.rewardProgressText}>{rewardSummary.current.label}</Text>
                    <Text style={styles.rewardProgressText}>
                      {rewardSummary.next ? `${rewardSummary.next.label} at ${rewardSummary.next.min}` : "Max level"}
                    </Text>
                  </View>
                  <View style={styles.rewardProgressTrack}>
                    <View style={[styles.rewardProgressFill, { width: `${Math.round(rewardSummary.progress * 100)}%` }]} />
                  </View>
                </View>

                <View style={styles.rewardBadgeRow}>
                  {rewardSummary.badges.map((badge) => (
                    <View
                      key={badge.label}
                      style={[
                        styles.rewardBadgeChip,
                        { borderColor: badge.earned ? badge.tone : "rgba(255,255,255,0.18)" },
                        !badge.earned && styles.rewardBadgeChipLocked
                      ]}
                    >
                      <Ionicons name={badge.earned ? badge.icon : "lock-closed"} size={15} color={badge.earned ? badge.tone : "#CBD5E1"} />
                      <Text style={styles.rewardBadgeText}>{badge.label}</Text>
                    </View>
                  ))}
                </View>

                {dailyDashboard.dailyQuiz?.result ? (
                  <View style={styles.rewardResultCard}>
                    <Text style={styles.rewardResultTitle}>Today&apos;s Quiz Completed</Text>
                    <Text style={styles.rewardResultMeta}>
                      Score: {dailyDashboard.dailyQuiz.result.score}/{dailyDashboard.dailyQuiz.result.totalQuestions}
                    </Text>
                    <Text style={styles.rewardResultMeta}>Reward Earned: +{dailyDashboard.dailyQuiz.result.xpEarned}</Text>
                    <Text style={styles.rewardResultMeta}>Streak: {dailyDashboard.dailyQuiz.result.streak} days</Text>
                  </View>
                ) : null}
                <View style={styles.rewardActionRow}>
                  <TouchableOpacity
                    style={[
                      styles.rewardPrimaryButton,
                      (dailyDashboard.dailyQuiz?.completedToday || quizLoading) && styles.rewardPrimaryButtonDone
                    ]}
                    onPress={openQuizDomainPicker}
                    disabled={Boolean(dailyDashboard.dailyQuiz?.completedToday) || quizLoading}
                  >
                    <Ionicons
                      name={dailyDashboard.dailyQuiz?.completedToday ? "checkmark-circle" : "game-controller"}
                      size={18}
                      color="#FFFFFF"
                    />
                    <Text style={styles.rewardPrimaryButtonText}>
                      {quizLoading
                        ? "Loading..."
                        : dailyDashboard.dailyQuiz?.completedToday
                          ? "Mission Complete"
                          : isKid
                            ? "Start Daily Quiz"
                            : "Start Quiz"}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.rewardSecondaryButton}
                    onPress={() => router.push("/community/leaderboard" as never)}
                  >
                    <Ionicons name="podium" size={18} color="#FDE68A" />
                    <Text style={styles.rewardSecondaryButtonText}>{rewardSummary.boardLabel}</Text>
                  </TouchableOpacity>
                </View>
                {quizMessage ? <Text style={styles.rewardHeroSubtitle}>{quizMessage}</Text> : null}
              </>
            )}
          </View>
        </>
      ) : null}

      <Text style={[styles.sectionHeader, { color: colors.text }]}>ORIN Collaborate</Text>
      <TouchableOpacity style={[styles.featureCard, styles.featureCardTwo, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => router.push("/collaborate" as never)}>
        <Text style={[styles.featurePill, { backgroundColor: colors.surfaceAlt, color: colors.text }]}>Community</Text>
        <Text style={[styles.featureTitle, { color: colors.text }]}>Collaborate with ORIN</Text>
        <Text style={[styles.featureCopy, { color: colors.textMuted }]}>Share ideas, partnerships, and initiatives with the ORIN team.</Text>
      </TouchableOpacity>
      </>
      )
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
      <Text style={[styles.groupTitle, { color: colors.text }]}>
        {isKid ? "Learning Guidance" : isHighSchool ? "Study Intelligence" : "AI Intelligence"}
      </Text>
      <Text style={[styles.groupNote, { color: colors.textMuted }]}>
        {isKid
          ? "Simple learning guidance, teacher support, and friendly school progress tools."
          : isHighSchool
            ? "Study guidance based on your goals, subjects, and school progress."
            : "Personalized AI guidance based on your goal, skills, and progress."}
      </Text>
      <Text style={[styles.sectionHeader, { color: colors.text }]}>
        {isKid ? "Teacher & Guide Matching" : isHighSchool ? "Career Explorer" : "AI Mentor Matching"}
      </Text>
      <View style={styles.matchWrap}>
        {mentorMatches.length === 0 ? (
          <Text style={[styles.empty, { color: colors.textMuted }]}>No mentor recommendations available right now.</Text>
        ) : (
          mentorMatches.slice(0, 5).map((item) => (
            <View key={item.mentorId} style={styles.matchCard}>
              <Text style={[styles.matchName, { color: colors.text }]}>{item.name}</Text>
              <Text style={[styles.matchMeta, { color: colors.textMuted }]}>
                {item.primaryCategory || "General"} {item.subCategory ? `> ${item.subCategory}` : ""}
              </Text>
              <Text style={[styles.matchMeta, { color: colors.textMuted }]}>
                Experience {item.experienceYears || 0} yrs | Rating {item.rating || 0}
              </Text>
              <Text style={[styles.matchScore, { color: colors.accent }]}>Match Score: {item.matchScore}%</Text>
              <View style={styles.matchActions}>
                <TouchableOpacity
                  style={styles.matchBtn}
                  onPress={() => router.push(`/mentor/${item.mentorId}` as never)}
                >
                  <Text style={styles.matchBtnText}>{isKid ? "View Guide" : "View Profile"}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.matchBtn, styles.matchBtnPrimary]}
                  onPress={() => router.push(`/mentor/${item.mentorId}` as never)}
                >
                  <Text style={[styles.matchBtnText, styles.matchBtnTextPrimary]}>{isKid ? "Open Guidance" : "Book Session"}</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </View>

      {!isKid ? (
        <>
          <Text style={[styles.sectionHeader, { color: colors.text }]}>{isHighSchool ? "Study Gap Analyzer" : "AI Skill Gap Analyzer"}</Text>
          <View style={styles.roadmapCard}>
            {!skillGap ? (
              <Text style={[styles.empty, { color: colors.textMuted }]}>Skill gap analysis unavailable right now.</Text>
            ) : (
              <>
                <Text style={[styles.roadmapGoal, { color: colors.accent }]}>Goal: {skillGap.goal}</Text>
                <Text style={[styles.historyMeta, { color: colors.textMuted }]}>Current Skills: {skillGap.currentSkills.join(", ") || "None yet"}</Text>
                <Text style={[styles.historyMeta, { color: colors.textMuted }]}>
                  Missing Skills: {skillGap.missingSkills.length ? skillGap.missingSkills.join(", ") : "No gaps detected"}
                </Text>
                <Text style={[styles.historyMeta, { color: colors.textMuted }]}>
                  Suggested Courses: {skillGap.suggestions?.courses?.slice(0, 3).join(", ") || "No suggestions"}
                </Text>
              </>
            )}
          </View>

          <Text style={[styles.sectionHeader, { color: colors.text }]}>{isHighSchool ? "Study Radar" : "Skill Radar"}</Text>
          <View style={styles.roadmapCard}>
            {!dailyDashboard?.skillRadar || (dailyDashboard.skillRadar.skills || []).length === 0 ? (
              <Text style={[styles.empty, { color: colors.textMuted }]}>Complete daily quiz to unlock your skill radar.</Text>
            ) : (
              <>
                <Text style={[styles.roadmapGoal, { color: colors.accent }]}>Domain: {dailyDashboard.skillRadar.domain}</Text>
                {(dailyDashboard.skillRadar.skills || []).map((item) => (
                  <View key={`${item.name}-${item.score}`} style={styles.radarRow}>
                    <Text style={[styles.historyMeta, { color: colors.textMuted }]}>{item.name}</Text>
                    <Text style={[styles.historyMeta, { color: colors.textMuted }]}>{item.score}/100</Text>
                  </View>
                ))}
              </>
            )}
          </View>

          <Text style={[styles.sectionHeader, { color: colors.text }]}>{isHighSchool ? "Study Intelligence" : "Career Intelligence"}</Text>
          <View style={styles.roadmapCard}>
            {!dailyDashboard?.careerIntelligence ? (
              <Text style={[styles.empty, { color: colors.textMuted }]}>Complete today&apos;s quiz to get personalized intelligence.</Text>
            ) : (
              <>
                <Text style={[styles.roadmapGoal, { color: colors.accent }]}>Strength: {dailyDashboard.careerIntelligence.strength}</Text>
                <Text style={[styles.historyMeta, { color: colors.textMuted }]}>
                  Needs Improvement: {(dailyDashboard.careerIntelligence.needsImprovement || []).join(", ") || "No major gaps"}
                </Text>
                <Text style={[styles.historyMeta, { color: colors.textMuted }]}>Next Step: {dailyDashboard.careerIntelligence.recommendedNextStep}</Text>
                {dailyDashboard.careerIntelligence.trendingOpportunity?.title ? (
                  <Text style={[styles.historyMeta, { color: colors.textMuted }]}>
                    Trending Opportunity: {dailyDashboard.careerIntelligence.trendingOpportunity.title}
                  </Text>
                ) : null}
                {(dailyDashboard.careerIntelligence.mentorRecommendations || []).length ? (
                  <Text style={[styles.historyMeta, { color: colors.textMuted }]}>
                    Recommended Mentors:{" "}
                    {dailyDashboard.careerIntelligence.mentorRecommendations?.map((item) => item.name).join(", ")}
                  </Text>
                ) : null}
              </>
            )}
          </View>
        </>
      ) : null}

      <Text style={[styles.groupTitle, { color: colors.text }]}>
        {isKid ? "Teacher Support" : "Trust & Mentor Quality"}
      </Text>
      <Text style={[styles.groupNote, { color: colors.textMuted }]}>
        {isKid
          ? "Trusted teachers and verified guides help students learn in a safe school environment."
          : "Verified mentors and transparent quality signals for safer mentorship."}
      </Text>
      <Text style={[styles.sectionHeader, { color: colors.text }]}>
        {isKid ? "Verified Teacher System" : "Verified Mentor System"}
      </Text>
      <View style={styles.matchWrap}>
        {verifiedMentors.length === 0 ? (
          <Text style={[styles.empty, { color: colors.textMuted }]}>No verified mentors available currently.</Text>
        ) : (
          verifiedMentors.slice(0, 4).map((item) => (
            <View key={item.mentorId} style={styles.matchCard}>
              <Text style={[styles.matchName, { color: colors.text }]}>
                {item.name} {item.verifiedBadge ? "(Verified)" : ""}
              </Text>
              <Text style={[styles.matchMeta, { color: colors.textMuted }]}>{item.title || (isKid ? "Teacher" : "Mentor")}</Text>
              <Text style={[styles.matchMeta, { color: colors.textMuted }]}>Rating: {item.rating || 0}</Text>
            </View>
          ))
        )}
      </View>

      <Text style={[styles.groupTitle, { color: colors.text }]}>
        {isKid ? "School Progress" : isHighSchool ? "Study Progress" : "Career Progress"}
      </Text>
      <Text style={[styles.groupNote, { color: colors.textMuted }]}>
        {isKid
          ? "Track school activities, teacher sessions, and simple progress milestones."
          : isHighSchool
            ? "Track study roadmaps, opportunities, and mentor sessions as you grow."
            : "Roadmaps, opportunities, and live sessions to accelerate your journey."}
      </Text>
      {!isKid ? (
        <>
          <Text style={[styles.sectionHeader, { color: colors.text }]}>{isHighSchool ? "Study Roadmap" : "AI Career Roadmap"}</Text>
          <View style={styles.roadmapCard}>
            {!roadmap ? (
              <Text style={[styles.empty, { color: colors.textMuted }]}>Roadmap unavailable right now.</Text>
            ) : (
              <>
                <Text style={[styles.roadmapGoal, { color: colors.accent }]}>Goal: {roadmap.goal}</Text>
                {roadmap.steps.map((step) => (
                  <Text key={`${step.stepNumber}-${step.title}`} style={styles.roadmapStep}>
                    Step {step.stepNumber}: {step.title}
                  </Text>
                ))}
              </>
            )}
          </View>

          <Text style={[styles.sectionHeader, { color: colors.text }]}>{isHighSchool ? "Programs & Opportunities" : "Internships & Opportunities"}</Text>
          <View style={styles.opportunityWrap}>
            {opportunities.length === 0 ? (
              <Text style={[styles.empty, { color: colors.textMuted }]}>No opportunities available right now.</Text>
            ) : (
              opportunities.slice(0, 5).map((item) => (
                <View key={item._id} style={styles.opportunityCard}>
                  <Text style={[styles.opportunityTitle, { color: colors.text }]}>{item.title}</Text>
                  <Text style={[styles.opportunityMeta, { color: colors.textMuted }]}>
                    {item.company || "ORIN Network"} | {item.role || item.type || "Opportunity"}
                  </Text>
                  <Text style={[styles.opportunityMeta, { color: colors.textMuted }]}>Duration: {item.duration || "Flexible"}</Text>
                </View>
              ))
            )}
          </View>
        </>
      ) : null}

      <Text style={[styles.sectionHeader, { color: colors.text }]}>
        {isKid ? "Star Board" : isHighSchool ? "Institution Leaderboard" : "College Leaderboard"}
      </Text>
      <View style={[styles.leaderboardCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {!leaderboard || leaderboard.collegeTop.length === 0 ? (
          <Text style={[styles.empty, { color: colors.textMuted }]}>Leaderboard will appear after enough activity.</Text>
        ) : (
          <>
            <Text style={[styles.leaderboardTitle, { color: colors.text }]}>
              {leaderboard.collegeName || (isKid || isHighSchool ? "Your Institution" : "Your College")}
            </Text>
            {leaderboard.collegeTop.slice(0, 5).map((entry) => (
              <Text key={`${entry.rank}-${entry.name}`} style={[styles.leaderboardRow, { color: colors.textMuted }]}>
                {entry.rank}. {entry.name} - {entry.score}
              </Text>
            ))}
          </>
        )}
      </View>

      <Text style={[styles.sectionHeader, { color: colors.text }]}>
        {isKid ? "Teacher Sessions" : isHighSchool ? "Teacher & Mentor Sessions" : "Mentor Live Sessions"}
      </Text>
      <View style={styles.liveWrap}>
        {liveSessions.length === 0 ? (
          <Text style={[styles.empty, { color: colors.textMuted }]}>No upcoming live sessions right now.</Text>
        ) : (
          liveSessions.slice(0, 5).map((item) => (
            <View key={item.id} style={[styles.liveCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {item.posterImageUrl ? <Image source={{ uri: item.posterImageUrl }} style={styles.liveImage} /> : null}
              <Text style={[styles.liveTitle, { color: colors.text }]}>{item.title}</Text>
              <Text style={[styles.liveMeta, { color: colors.textMuted }]}>
                {item.topic || (isKid ? "Teacher-led school session" : "Live mentoring session")}
              </Text>
              {item.description ? <Text style={[styles.liveMeta, { color: colors.textMuted }]}>{item.description}</Text> : null}
              <Text style={[styles.liveMeta, { color: colors.textMuted }]}>
                {isKid ? "Teacher" : "Mentor"}: {item.mentor?.name || (isKid ? "Teacher" : "Mentor")} | {new Date(item.startsAt).toLocaleString()}
              </Text>
              <Text style={[styles.liveBannerMeta, { color: colors.textMuted }]} numberOfLines={1}>
                {item.sessionMode === "paid" ? `INR ${item.price || 0}` : "Free"} | Seats left {item.seatsLeft ?? 0}
              </Text>
              <Text style={[styles.liveMeta, { color: colors.textMuted }]}>Interested: {item.interestedCount || 0}</Text>
              <TouchableOpacity
                style={[
                  styles.matchBtn,
                  { borderColor: colors.accent, backgroundColor: colors.surfaceAlt },
                  togglingLiveInterestId === item.id && styles.disabledButton
                ]}
                onPress={() => toggleLiveSessionInterest(item.id)}
                disabled={togglingLiveInterestId === item.id}
              >
                <Text style={[styles.matchBtnText, { color: colors.accent }]}>
                  {togglingLiveInterestId === item.id
                    ? "Updating..."
                    : item.isInterested
                      ? "Interested"
                      : "I'm Interested"}
                </Text>

              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.matchBtn, { borderColor: colors.accent, backgroundColor: colors.surfaceAlt }]}
                onPress={() => openLiveSessionBooking(item)}
              >
                <Text style={[styles.matchBtnText, { color: colors.accent }]}>
                  {item.myBooking?.bookingStatus === "booked"
                    ? item.meetingLink
                      ? "Join Live"
                      : "Booked"
                    : item.myBooking?.bookingStatus === "pending_payment"
                      ? "Pay Now"
                      : item.sessionMode === "paid"
                        ? "Book & Pay"
                        : "Book Free"}
                </Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </View>

      </>
      ) : null}

      {growthSubSection === "community" ? (
      <>
      <Text style={[styles.groupTitle, { color: colors.text }]}>{isKid ? "School Activities" : isHighSchool ? "School Community" : "Community & Collaboration"}</Text>
      <Text style={[styles.groupNote, { color: colors.textMuted }]}>{isKid ? "Join fun school challenges, collect rewards, and learn with groups." : "Learn together through challenges, certifications, and mentor-led groups."}</Text>
      <Text style={[styles.sectionHeader, { color: colors.text }]}>{isKid ? "Fun Challenges" : "Community Challenges"}</Text>
      <View style={styles.opportunityWrap}>
        {challenges.length === 0 ? (
          <Text style={[styles.empty, { color: colors.textMuted }]}>No active challenges right now.</Text>
        ) : (
          challenges.slice(0, 4).map((item) => (
            <View key={item.id} style={styles.opportunityCard}>
              <Text style={[styles.opportunityTitle, { color: colors.text }]}>{item.title}</Text>
              <Text style={[styles.opportunityMeta, { color: colors.textMuted }]}>
                {item.domain || "General"} | Participants: {item.participantsCount || 0}
              </Text>
              {item.mentor?.name ? (
                <Text style={[styles.opportunityMeta, { color: colors.textMuted }]}>By {item.mentor.name}</Text>
              ) : null}
              <Text style={[styles.opportunityMeta, { color: colors.textMuted }]}>Deadline: {new Date(item.deadline).toLocaleDateString()}</Text>
              <TouchableOpacity style={styles.matchBtn} onPress={() => joinChallenge(item.id)}>
                <Text style={styles.matchBtnText}>Join Challenge</Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </View>

      <Text style={[styles.sectionHeader, { color: colors.text }]}>{isKid ? "Star Rewards" : "ORIN Certification System"}</Text>
      <View style={styles.historyWrap}>
        {certifications.length === 0 ? (
          <Text style={[styles.empty, { color: colors.textMuted }]}>No certifications yet.</Text>
        ) : (
          certifications.slice(0, 5).map((item) => (
            <View key={item.id} style={styles.historyCard}>
              <Text style={[styles.historyTitle, { color: colors.text }]}>{item.title}</Text>
              <Text style={[styles.historyMeta, { color: colors.textMuted }]}>Level: {item.level || "Beginner"}</Text>
            </View>
          ))
        )}
      </View>

      <Text style={[styles.sectionHeader, { color: colors.text }]}>{isKid ? "Teacher Groups" : "Mentor Groups"}</Text>
      <View style={styles.opportunityWrap}>
        {mentorGroups.length === 0 ? (
          <Text style={[styles.empty, { color: colors.textMuted }]}>No mentor groups available.</Text>
        ) : (
          mentorGroups.slice(0, 4).map((item) => (
            <View key={item.id} style={styles.opportunityCard}>
              <Text style={[styles.opportunityTitle, { color: colors.text }]}>{item.name}</Text>
              <Text style={[styles.opportunityMeta, { color: colors.textMuted }]}>
                Mentor: {item.mentor?.name || "Mentor"} | Students: {item.membersCount || 0}
              </Text>
              <Text style={[styles.opportunityMeta, { color: colors.textMuted }]}>{item.schedule || "Weekly sessions"}</Text>
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
      <Text style={[styles.groupTitle, { color: colors.text }]}>{isKid ? "Resources & Creativity" : "Resources & Portfolio"}</Text>
      <Text style={[styles.groupNote, { color: colors.textMuted }]}>{isKid ? "Open class resources, creative tasks, and simple school learning support." : "Build projects, access knowledge, and generate your resume."}</Text>
      <Text style={[styles.sectionHeader, { color: colors.text }]}>{isKid ? "Creative Activity Ideas" : "AI Project Idea Generator"}</Text>
      {isKid ? (
        <TouchableOpacity style={styles.roadmapCard} onPress={() => router.push("/ai/creative-corner" as never)}>
          <Text style={[styles.roadmapGoal, { color: colors.accent }]}>Create drawing, story, craft, and class activity ideas.</Text>
          <Text style={[styles.historyMeta, { color: colors.textMuted }]}>Open Creative Corner</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.roadmapCard}>
          {!projectIdeas ? (
            <Text style={[styles.empty, { color: colors.textMuted }]}>Project ideas unavailable right now.</Text>
          ) : (
            <>
              <Text style={[styles.roadmapGoal, { color: colors.accent }]}>Goal: {projectIdeas.goal}</Text>
              {projectIdeas.ideas.slice(0, 5).map((idea, idx) => (
                <Text key={`${idea.title}-${idx}`} style={styles.roadmapStep}>
                  {idx + 1}. {idea.title}
                </Text>
              ))}
            </>
          )}
        </View>
      )}

      <Text style={[styles.sectionHeader, { color: colors.text }]}>{isKid ? "Class Resource Library" : "Knowledge Library"}</Text>
      <View style={styles.historyWrap}>
        {knowledgeLibrary.length === 0 ? (
          <Text style={[styles.empty, { color: colors.textMuted }]}>No resources available right now.</Text>
        ) : (
          knowledgeLibrary.slice(0, 6).map((item) => (
            <View key={item.id} style={styles.historyCard}>
              <Text style={[styles.historyTitle, { color: colors.text }]}>{item.title}</Text>
              <Text style={[styles.historyMeta, { color: colors.textMuted }]}>{item.type}</Text>
              {item.mentor?.name ? <Text style={[styles.historyMeta, { color: colors.textMuted }]}>Uploaded by {item.mentor.name}</Text> : null}
              <Text style={[styles.historyMeta, { color: colors.textMuted }]}>{item.description || ""}</Text>
            </View>
          ))
        )}
      </View>

      <Text style={[styles.sectionHeader, { color: colors.text }]}>{isKid ? "School Resource Library" : "Institution Resources"}</Text>
      <View style={styles.historyWrap}>
        {institutionKnowledgeLibrary.length === 0 ? (
          <Text style={[styles.empty, { color: colors.textMuted }]}>No institution resources available right now.</Text>
        ) : (
          institutionKnowledgeLibrary.slice(0, 6).map((item) => (
            <View key={`institution-${item.id}`} style={styles.historyCard}>
              <Text style={[styles.historyTitle, { color: colors.text }]}>{item.title}</Text>
              <Text style={[styles.historyMeta, { color: colors.textMuted }]}>{item.institutionName || studentInstitutionName || "Institution Resource"}</Text>
              {item.mentor?.name ? <Text style={[styles.historyMeta, { color: colors.textMuted }]}>Uploaded by {item.mentor.name}</Text> : null}
              <Text style={[styles.historyMeta, { color: colors.textMuted }]}>{item.description || ""}</Text>
            </View>
          ))
        )}
      </View>

      {!isKid ? (
        <>
          <Text style={[styles.groupTitle, { color: colors.text }]}>Reputation & Ranking</Text>
          <Text style={[styles.groupNote, { color: colors.textMuted }]}>Track your ORIN standing and percentile among learners.</Text>
          <Text style={[styles.sectionHeader, { color: colors.text }]}>ORIN Reputation Score</Text>
          <View style={styles.leaderboardCard}>
            {!reputationSummary ? (
              <Text style={[styles.empty, { color: colors.textMuted }]}>Reputation summary unavailable.</Text>
            ) : (
              <>
                <Text style={[styles.leaderboardTitle, { color: colors.text }]}>Reputation Score: {reputationSummary.score}</Text>
                <Text style={[styles.leaderboardRow, { color: colors.textMuted }]}>{reputationSummary.levelTag}</Text>
                <Text style={[styles.leaderboardRow, { color: colors.textMuted }]}>Top {reputationSummary.topPercent}% learners</Text>
              </>
            )}
          </View>

          <Text style={[styles.sectionHeader, { color: colors.text }]}>{isHighSchool ? "Study Portfolio" : "AI Resume Builder"}</Text>
          <View style={styles.resumeCard}>
            {!resumePreview?.markdown ? (
              <Text style={[styles.empty, { color: colors.textMuted }]}>Resume preview unavailable right now.</Text>
            ) : (
              <>
                <Text style={[styles.resumeTitle, { color: colors.text }]}>{isHighSchool ? "Portfolio generated" : "Resume generated"}</Text>
                <Text style={[styles.resumeMeta, { color: colors.textMuted }]}>File: {resumePreview.export?.fileName || "orin_resume.md"}</Text>
                <Text style={[styles.resumeSnippet, { color: colors.textMuted }]} numberOfLines={5}>
                  {markdownToPlainText(resumePreview.markdown)}
                </Text>
              </>
            )}
          </View>
        </>
      ) : null}
      </>
      ) : null}

      </>
      ) : null}

      {FEATURE_FLAGS.networking && activeSection === "network" ? (
        <>
          <Text style={[styles.sectionHeader, { color: colors.text }]}>Circle Activity</Text>
          <View style={styles.feedWrap}>
            {networkFeed.length === 0 ? (
              <Text style={[styles.empty, { color: colors.textMuted }]}>No network activity yet.</Text>
            ) : (
              networkFeed.map((post) => (
                <View key={post._id} style={styles.feedCard}>
                  <TouchableOpacity
                    onPress={() =>
                      post.authorId?._id ? router.push(`/public-profile/${post.authorId._id}` as never) : undefined
                    }
                    disabled={!post.authorId?._id}
                  >
                    <Text style={[styles.feedAuthor, { color: colors.text }]}>{post.authorId?.name || "ORIN User"}</Text>
                  </TouchableOpacity>
                  <Text style={[styles.feedLine, { color: colors.text }]}>{post.content}</Text>
                  <Text style={[styles.feedMeta, { color: colors.textMuted }]}>
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

      {FEATURE_FLAGS.smartSuggestions && activeSection === "network" ? (
        <>
          <Text style={[styles.sectionHeader, { color: colors.text }]}>Discover Circle</Text>
          <View style={styles.suggestionWrap}>
            {suggestions.length === 0 ? (
              <Text style={[styles.empty, { color: colors.textMuted }]}>No suggestions available right now.</Text>
            ) : (
              suggestions.map((item, index) => (
                <View key={`${item.id}-${index}`} style={styles.suggestionCard}>
                  <Text style={[styles.suggestionName, { color: colors.text }]}>{item.name}</Text>
                  <Text style={[styles.suggestionReason, { color: colors.textMuted }]}>{item.reason}</Text>
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

      {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}

      {!isLoading && activeSection === "sessions" ? (
        <>
          <Text style={[styles.sectionHeader, { color: colors.text }]}>Session History & Notes</Text>
          <View style={styles.historyWrap}>
            {sessionHistory.length === 0 ? (
              <Text style={[styles.empty, { color: colors.textMuted }]}>No completed sessions yet.</Text>
            ) : (
              sessionHistory.slice(0, 6).map((item) => (
                <View key={item.sessionId} style={styles.historyCard}>
                  <Text style={[styles.historyTitle, { color: colors.text }]}>{item.mentorName}</Text>
                  <Text style={[styles.historyMeta, { color: colors.textMuted }]}>
                    {item.date} {item.time}
                  </Text>
                  <Text style={[styles.historyMeta, { color: colors.textMuted }]}>Notes: {item.notes?.trim() ? item.notes : "No notes yet."}</Text>
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
              <Text style={[styles.empty, { color: colors.textMuted }]}>No pending payments.</Text>
            ) : (
              filteredPendingPaymentSessions.map((session) => {
                const instructions = session.paymentInstructions;
                const isSubmitting = Boolean(submittingBySession[session._id]);
                const isManualPayment = session.paymentMode === "manual";
                return (
                  <View key={session._id} style={[styles.card, styles.cardPending]}>
                    <Text style={[styles.title, { color: colors.text }]}>{session.mentorId?.name || "Mentor"}</Text>
                    <Text style={[styles.meta, { color: colors.textMuted }]}>
                      {session.date} {session.time} | {session.currency || "INR"} {session.amount}
                    </Text>
                    <Text style={[styles.statusWarning, { color: colors.warning }]}>Payment status: {session.paymentStatus}</Text>
                    {session.paymentRejectReason ? (
                      <Text style={[styles.error, { color: colors.danger }]}>Reason: {session.paymentRejectReason}</Text>
                    ) : null}
                    {isManualPayment ? (
                      <>
                        <Text style={[styles.meta, { color: colors.textMuted }]}>UPI ID: {instructions?.upiId || "Not configured"}</Text>
                        {instructions?.qrImageUrl ? (
                          <Image source={{ uri: instructions.qrImageUrl }} style={styles.qrImage} resizeMode="contain" />
                        ) : (
                          <Text style={[styles.meta, { color: colors.textMuted }]}>QR image not configured by admin.</Text>
                        )}
                        <Text style={[styles.meta, { color: colors.textMuted }]}>
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
                      </>
                    ) : (
                      <>
                        <Text style={[styles.meta, { color: colors.textMuted }]}>Secure Razorpay payment is still pending for this slot.</Text>
                        <Text style={[styles.meta, { color: colors.textMuted }]}>
                          Complete payment before:{" "}
                          {session.paymentDueAt ? new Date(session.paymentDueAt).toLocaleString() : "the payment window expires"}
                        </Text>
                      </>
                    )}
                    <View style={styles.paymentActionsRow}>
                      <TouchableOpacity
                        style={[styles.joinButton, styles.paymentPrimaryAction]}
                        onPress={() => (isManualPayment ? submitManualProof(session) : retryRazorpayPayment(session))}
                        disabled={isSubmitting}
                      >
                        <Text style={styles.joinButtonText}>
                          {isSubmitting
                            ? isManualPayment
                              ? "Submitting..."
                              : "Opening..."
                            : isManualPayment
                              ? "Upload Screenshot & Submit"
                              : "Pay Now"}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.cancelButton, isSubmitting && styles.disabledButton]}
                        onPress={() => cancelPendingSession(session)}
                        disabled={isSubmitting}
                      >
                        <Text style={styles.cancelButtonText}>Delete</Text>
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
              <Text style={[styles.empty, { color: colors.textMuted }]}>No sessions waiting for verification.</Text>
            ) : (
              filteredWaitingVerificationSessions.map((session) => (
                <View key={session._id} style={[styles.card, styles.cardWaiting]}>
                  <Text style={[styles.title, { color: colors.text }]}>{session.mentorId?.name || "Mentor"}</Text>
                  <Text style={[styles.meta, { color: colors.textMuted }]}>
                    {session.date} {session.time} | {session.currency || "INR"} {session.amount}
                  </Text>
                  <Text style={[styles.statusInfo, { color: colors.accent }]}>Payment submitted. Awaiting admin verification.</Text>
                </View>
              ))
            )}
          </View>

          <View style={styles.panel}>
            <Text style={[styles.panelTitle, styles.panelTitleConfirmed]}>Confirmed Sessions</Text>
            {filteredConfirmedSessions.length === 0 ? (
              <Text style={[styles.empty, { color: colors.textMuted }]}>No confirmed sessions yet.</Text>
            ) : (
              filteredConfirmedSessions.map((session) => (
                <View key={session._id} style={[styles.card, styles.cardConfirmed]}>
                  <Text style={[styles.title, { color: colors.text }]}>{session.mentorId?.name || "Mentor"}</Text>
                  <Text style={[styles.meta, { color: colors.textMuted }]}>
                    {session.date} {session.time} | Amount: {session.currency || "INR"} {session.amount}
                  </Text>
                  <Text style={[styles.status, { color: colors.accent }]}>Payment: {session.paymentStatus} | Session: {session.sessionStatus}</Text>
                  {session.meetingLink ? (
                    <TouchableOpacity style={styles.joinButton} onPress={() => Linking.openURL(session.meetingLink as string)}>
                      <Text style={styles.joinButtonText}>Join Session</Text>
                    </TouchableOpacity>
                  ) : (
                    <Text style={[styles.meta, { color: colors.textMuted }]}>Meeting link will appear after mentor updates.</Text>
                  )}
                </View>
              ))
            )}
          </View>

          <View style={styles.panel}>
            <Text style={[styles.panelTitle, styles.panelTitleLegacy]}>Legacy Booking Requests</Text>
            {filteredBookings.length === 0 ? (
              <Text style={[styles.empty, { color: colors.textMuted }]}>No booking requests yet.</Text>
            ) : (
              filteredBookings.map((item) => (
                <View key={item._id} style={[styles.card, styles.cardLegacy]}>
                  <Text style={[styles.title, { color: colors.text }]}>{item.mentor?.name || "Mentor"}</Text>
                  <Text style={[styles.meta, { color: colors.textMuted }]}>{item.mentor?.email}</Text>
                  <Text style={[styles.meta, { color: colors.textMuted }]}>{new Date(item.scheduledAt).toLocaleString()}</Text>
                  <Text style={[styles.status, { color: colors.accent }]}>Status: {item.status}</Text>
                </View>
              ))
            )}
          </View>
        </>
      ) : null}

      <TouchableOpacity style={styles.logout} onPress={logout}>
        <Text style={[styles.logoutText, { color: colors.danger }]}>Logout</Text>
      </TouchableOpacity>
    </ScrollView>
    <Modal visible={quizVisible} transparent={false} animationType="slide" onRequestClose={() => setQuizVisible(false)}>
      <View style={[styles.quizModalWrap, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 14 }]}>
        <View style={styles.quizTopBar}>
          <Text style={[styles.quizDomain, { color: colors.text }]}>{dailyQuiz?.domain || dailyDashboard?.dailyQuiz?.domain || "Career Quiz"}</Text>
          <TouchableOpacity onPress={() => setQuizVisible(false)} style={styles.quizCloseBtn}>
            <Ionicons name="close" size={18} color="#1E2B24" />
          </TouchableOpacity>
        </View>
        <Text style={[styles.quizMeta, { color: colors.textMuted }]}>Streak: {dailyDashboard?.streakDays || dailyQuiz?.streak || 0} days</Text>
        <Text style={[styles.quizMeta, { color: colors.textMuted }]}>XP: {quizXp}</Text>
        <View style={styles.quizProgressTrack}>
          <View style={[styles.quizProgressFill, { width: `${Math.max(6, progressRatio * 100)}%` }]} />
        </View>
        {quizResult ? (
          <View style={styles.quizResultScreen}>
            <Text style={styles.quizResultEmoji}>Great</Text>
            <Text style={[styles.quizResultTitle, { color: colors.text }]}>Quiz Completed</Text>
            <Text style={[styles.quizResultMeta, { color: colors.textMuted }]}>
              Score: {quizResult.score}/{quizResult.totalQuestions}
            </Text>
            <Text style={[styles.quizResultMeta, { color: colors.textMuted }]}>XP Earned: +{quizResult.xpEarned}</Text>
            <Text style={[styles.quizResultMeta, { color: colors.textMuted }]}>Streak: {quizResult.streak} days</Text>
            <TouchableOpacity style={styles.dailyTaskButton} onPress={() => setQuizVisible(false)}>
              <Text style={styles.dailyTaskButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        ) : currentQuizQuestion ? (
          <Animated.View
            style={[
              styles.quizQuestionCard,
              { transform: [{ translateX: slideAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -16] }) }] }
            ]}
          >
            <Text style={[styles.quizQuestionMeta, { color: colors.accent }]}>
              Question {quizIndex + 1}/5 | {currentQuizQuestion.difficulty.toUpperCase()}
            </Text>
            <Text style={[styles.quizQuestionText, { color: colors.text }]}>{currentQuizQuestion.question}</Text>
            <View style={styles.quizOptionsWrap}>
              {currentQuizQuestion.options.map((option) => {
                const isSelected = selectedOption === option;
                const showCorrect = quizFeedback && option === currentQuizQuestion.correct;
                const showWrong = quizFeedback === "wrong" && isSelected && option !== currentQuizQuestion.correct;
                return (
                  <Pressable
                    key={`${currentQuizQuestion.id}-${option}`}
                    style={[
                      styles.quizOptionCard,
                      isSelected && styles.quizOptionCardSelected,
                      showCorrect && styles.quizOptionCardCorrect,
                      showWrong && styles.quizOptionCardWrong
                    ]}
                    onPress={() => {
                      if (!quizFeedback) setSelectedOption(option);
                    }}
                  >
                    <Text style={[styles.quizOptionText, { color: colors.text }]}>{option}</Text>
                  </Pressable>
                );
              })}
            </View>
            {quizFeedback ? (
              <View style={styles.quizExplainWrap}>
                <Text style={quizFeedback === "correct" ? styles.quizFeedbackCorrect : styles.quizFeedbackWrong}>
                  {quizFeedback === "correct" ? "Correct +10 XP" : `Incorrect. Correct: ${currentQuizQuestion.correct}`}
                </Text>
                <Text style={[styles.quizExplainText, { color: colors.textMuted }]}>{currentQuizQuestion.explanation}</Text>
              </View>
            ) : null}
            {!quizFeedback ? (
              <TouchableOpacity
                style={[styles.dailyTaskButton, !selectedOption && styles.dailyTaskButtonDone]}
                disabled={!selectedOption}
                onPress={submitAnswerAndNext}
              >
                <Text style={styles.dailyTaskButtonText}>Check Answer</Text>
              </TouchableOpacity>
            ) : quizIndex < 4 ? (
              <TouchableOpacity style={styles.dailyTaskButton} onPress={goNextQuestion}>
                <Text style={styles.dailyTaskButtonText}>Next</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.dailyTaskButton, (submittingQuiz || !canFinalizeQuiz) && styles.dailyTaskButtonDone]}
                onPress={finishQuiz}
                disabled={submittingQuiz || !canFinalizeQuiz}
              >
                <Text style={styles.dailyTaskButtonText}>{submittingQuiz ? "Submitting..." : "Finish Quiz"}</Text>
              </TouchableOpacity>
            )}
          </Animated.View>
        ) : (
          <View style={styles.quizResultScreen}>
            <ActivityIndicator size="small" color="#1F7A4C" />
            <Text style={[styles.quizResultMeta, { color: colors.textMuted }]}>Preparing quiz...</Text>
          </View>
        )}
      </View>
    </Modal>
    <Modal
      visible={quizDomainPickerVisible}
      transparent
      animationType="fade"
      onRequestClose={() => setQuizDomainPickerVisible(false)}
    >
      <View style={styles.quizDomainModalBackdrop}>
        <View style={[styles.quizDomainModalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.quizDomainModalTitle, { color: colors.text }]}>Choose Quiz Domain</Text>
          <Text style={[styles.quizDomainModalSubtitle, { color: colors.textMuted }]}>
            Pick the domain for today&apos;s 5 quiz questions.
          </Text>
          <View style={styles.quizDomainChipWrap}>
            {QUIZ_DOMAIN_OPTIONS.map((domain) => {
              const active = selectedQuizDomain === domain;
              return (
                <TouchableOpacity
                  key={domain}
                  style={[
                    styles.quizDomainChip,
                    {
                      borderColor: active ? colors.accent : colors.border,
                      backgroundColor: active ? colors.accentSoft : colors.surface
                    }
                  ]}
                  onPress={() => setSelectedQuizDomain(domain)}
                >
                  <Text style={[styles.quizDomainChipText, { color: active ? colors.accent : colors.textMuted }]}>
                    {domain}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <View style={styles.quizDomainModalActions}>
            <TouchableOpacity
              style={[styles.quizDomainSecondaryButton, { borderColor: colors.border }]}
              onPress={() => setQuizDomainPickerVisible(false)}
            >
              <Text style={[styles.quizDomainSecondaryButtonText, { color: colors.textMuted }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.dailyTaskButton} onPress={startQuizFromSelectedDomain}>
              <Text style={styles.dailyTaskButtonText}>Start Quiz</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
    </View>
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
  homeHero: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    gap: 14,
    shadowColor: "#0F172A",
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2
  },
  homeHeroTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12
  },
  homeHeroCopy: { flex: 1, minWidth: 0 },
  homeHeroEyebrow: {
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0,
    marginBottom: 5
  },
  homeHeroTitle: {
    fontSize: 26,
    lineHeight: 31,
    fontWeight: "900"
  },
  homeHeroSubtitle: {
    marginTop: 7,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600"
  },
  homeHeroBadge: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 9,
    alignItems: "center",
    gap: 5,
    minWidth: 82
  },
  homeHeroBadgeText: {
    fontSize: 11,
    fontWeight: "900",
    textAlign: "center"
  },
  homeMetricRow: {
    flexDirection: "row",
    gap: 8
  },
  homeMetricCard: {
    flex: 1,
    minHeight: 76,
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    justifyContent: "space-between"
  },
  homeMetricValue: {
    fontSize: 20,
    fontWeight: "900"
  },
  homeMetricLabel: {
    fontSize: 11,
    fontWeight: "800"
  },
  homeProgressWrap: { gap: 8 },
  homeProgressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10
  },
  homeProgressTitle: { fontWeight: "900", fontSize: 13 },
  homeProgressMeta: { fontWeight: "700", fontSize: 12 },
  homeProgressTrack: {
    height: 9,
    borderRadius: 999,
    overflow: "hidden"
  },
  homeProgressFill: {
    height: "100%",
    borderRadius: 999
  },
  homeHeroActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  homePrimaryAction: {
    minHeight: 44,
    borderRadius: 12,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    flexGrow: 1
  },
  homePrimaryActionText: { fontWeight: "900" },
  homeSecondaryAction: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7
  },
  homeSecondaryActionText: { fontWeight: "900" },
  sectionNavRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  sectionBackButton: {
    marginBottom: 12,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: "#D0D5DD",
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  sectionBackButtonText: { color: "#1F7A4C", fontWeight: "700", fontSize: 12 },
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
  sectionHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  sectionHeaderLink: { color: "#1F7A4C", fontWeight: "800", fontSize: 12 },
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
  liveBannerRow: { paddingBottom: 6, gap: 10, marginBottom: 10 },
  liveBannerEmpty: {
    width: 240,
    height: 150,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E4E7EC",
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center"
  },
  liveBannerCard: {
    width: 260,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#D4E8D8",
    backgroundColor: "#FFFFFF",
    padding: 10
  },
  liveBannerImage: { width: "100%", height: 132, borderRadius: 10, backgroundColor: "#EAECF0" },
  liveBannerImagePlaceholder: {
    width: "100%",
    height: 132,
    borderRadius: 10,
    backgroundColor: "#F2F4F7",
    borderWidth: 1,
    borderColor: "#EAECF0",
    alignItems: "center",
    justifyContent: "center"
  },
  liveBannerPlaceholderText: { color: "#667085", fontWeight: "800" },
  liveBannerTitle: { marginTop: 8, color: "#13251E", fontWeight: "900", lineHeight: 19 },
  liveBannerMeta: { marginTop: 4, color: "#667085", fontWeight: "600", fontSize: 12 },
  liveBannerFooter: { marginTop: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  liveBannerBtn: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#1F7A4C",
    backgroundColor: "#E8F5EE"
  },
  liveBannerBtnText: { color: "#1F7A4C", fontWeight: "800", fontSize: 12 },
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
  institutionHubCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D6E4FF",
    borderRadius: 16,
    padding: 14,
    gap: 12,
    marginBottom: 12
  },
  institutionHubHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  institutionHubHeader: { gap: 4 },
  institutionHubBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "#EEF4FF"
  },
  institutionHubBadgeText: { fontWeight: "800", fontSize: 12 },
  institutionHubTitle: { fontWeight: "800", fontSize: 18 },
  institutionHubMeta: { fontWeight: "600" },
  institutionExpandBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  institutionTileGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  institutionTile: {
    width: "48%",
    minHeight: 96,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E4E7EC",
    borderRadius: 12,
    padding: 12,
    gap: 6
  },
  institutionTileTitle: { fontWeight: "800", fontSize: 14 },
  institutionTileMeta: { fontWeight: "600", fontSize: 12, lineHeight: 18 },
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
  liveImage: {
    width: "100%",
    height: 170,
    borderRadius: 12,
    marginBottom: 6,
    backgroundColor: "#F8FAFC"
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
  dailyResultCard: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#B2CCFF",
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    padding: 10
  },
  dailyResultTitle: { color: "#1849A9", fontWeight: "800", marginBottom: 4 },
  rewardHeroCard: {
    borderWidth: 1,
    borderRadius: 22,
    padding: 16,
    marginBottom: 12,
    backgroundColor: "#26115F",
    shadowColor: "#4C1D95",
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3
  },
  rewardHeroEmpty: { color: "#EDE9FE", fontWeight: "800" },
  rewardHeroTop: { flexDirection: "row", justifyContent: "space-between", gap: 12, alignItems: "flex-start" },
  rewardHeroTitleBlock: { flex: 1 },
  rewardHeroEyebrow: { color: "#FDE68A", fontSize: 12, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.8 },
  rewardHeroTitle: { color: "#FFFFFF", fontSize: 21, fontWeight: "900", lineHeight: 27, marginTop: 5 },
  rewardHeroSubtitle: { color: "#DDD6FE", fontSize: 13, fontWeight: "700", lineHeight: 19, marginTop: 6 },
  rewardLevelBadge: {
    minWidth: 76,
    borderRadius: 18,
    paddingHorizontal: 10,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    gap: 5
  },
  rewardLevelBadgeText: { color: "#FFFFFF", fontSize: 11, fontWeight: "900" },
  rewardStatsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 14 },
  rewardStatCard: {
    width: "48%",
    borderRadius: 16,
    padding: 11,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)"
  },
  rewardStatValue: { color: "#FFFFFF", fontSize: 18, fontWeight: "900", marginTop: 5 },
  rewardStatLabel: { color: "#C4B5FD", fontSize: 11, fontWeight: "800", marginTop: 2 },
  rewardProgressWrap: { marginTop: 14 },
  rewardProgressHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 7 },
  rewardProgressText: { color: "#FDE68A", fontSize: 12, fontWeight: "900" },
  rewardProgressTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.16)",
    overflow: "hidden"
  },
  rewardProgressFill: { height: "100%", borderRadius: 999, backgroundColor: "#FBBF24" },
  rewardBadgeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 14 },
  rewardBadgeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: "rgba(255,255,255,0.1)"
  },
  rewardBadgeChipLocked: { opacity: 0.72 },
  rewardBadgeText: { color: "#FFFFFF", fontSize: 11, fontWeight: "900" },
  rewardResultCard: {
    marginTop: 14,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    padding: 12
  },
  rewardResultTitle: { color: "#FFFFFF", fontWeight: "900", marginBottom: 5 },
  rewardResultMeta: { color: "#DDD6FE", fontWeight: "800", fontSize: 12, marginTop: 2 },
  rewardActionRow: { flexDirection: "row", gap: 10, marginTop: 14 },
  rewardPrimaryButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 14,
    backgroundColor: "#16A34A",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingHorizontal: 10
  },
  rewardPrimaryButtonDone: { backgroundColor: "#0F766E" },
  rewardPrimaryButtonText: { color: "#FFFFFF", fontWeight: "900", fontSize: 13 },
  rewardSecondaryButton: {
    minHeight: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(253,230,138,0.55)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 12
  },
  rewardSecondaryButtonText: { color: "#FDE68A", fontWeight: "900", fontSize: 12 },
  radarRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#EAECF0",
    paddingBottom: 5
  },
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
  logoutText: { color: "#7A271A", fontWeight: "700" },
  quizModalWrap: {
    flex: 1,
    backgroundColor: "#F3F8F6",
    paddingHorizontal: 16
  },
  quizTopBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10
  },
  quizDomain: {
    color: "#0F172A",
    fontSize: 18,
    fontWeight: "900"
  },
  quizCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: "#D0D5DD",
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center"
  },
  quizMeta: { color: "#475467", fontWeight: "700", marginBottom: 6 },
  quizProgressTrack: {
    width: "100%",
    height: 10,
    backgroundColor: "#E4E7EC",
    borderRadius: 999,
    overflow: "hidden",
    marginBottom: 12
  },
  quizProgressFill: {
    height: "100%",
    backgroundColor: "#12B76A",
    borderRadius: 999
  },
  quizQuestionCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D0D5DD",
    borderRadius: 14,
    padding: 14
  },
  quizQuestionMeta: { color: "#027A48", fontWeight: "800", marginBottom: 8 },
  quizQuestionText: { color: "#101828", fontWeight: "800", fontSize: 17, lineHeight: 24, marginBottom: 10 },
  quizOptionsWrap: { gap: 8 },
  quizOptionCard: {
    borderWidth: 1,
    borderColor: "#D0D5DD",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12
  },
  quizOptionCardSelected: { borderColor: "#2E90FA", backgroundColor: "#EFF8FF" },
  quizOptionCardCorrect: { borderColor: "#12B76A", backgroundColor: "#ECFDF3" },
  quizOptionCardWrong: { borderColor: "#F04438", backgroundColor: "#FEF3F2" },
  quizOptionText: { color: "#1E2B24", fontWeight: "700" },
  quizExplainWrap: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#E4E7EC",
    borderRadius: 10,
    backgroundColor: "#F9FAFB",
    padding: 10
  },
  quizFeedbackCorrect: { color: "#027A48", fontWeight: "800", marginBottom: 4 },
  quizFeedbackWrong: { color: "#B42318", fontWeight: "800", marginBottom: 4 },
  quizExplainText: { color: "#475467", lineHeight: 18 },
  quizDomainModalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.55)",
    justifyContent: "center",
    padding: 20
  },
  quizDomainModalCard: {
    borderWidth: 1,
    borderRadius: 22,
    padding: 18,
    gap: 14
  },
  quizDomainModalTitle: { fontSize: 22, fontWeight: "800" },
  quizDomainModalSubtitle: { fontSize: 14, lineHeight: 21, fontWeight: "500" },
  quizDomainChipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  quizDomainChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  quizDomainChipText: { fontSize: 14, fontWeight: "700" },
  quizDomainModalActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12
  },
  quizDomainSecondaryButton: {
    flex: 1,
    minHeight: 42,
    borderWidth: 1,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center"
  },
  quizDomainSecondaryButtonText: { fontSize: 14, fontWeight: "700" },
  quizResultScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8
  },
  quizResultEmoji: { color: "#175CD3", fontWeight: "900", fontSize: 24 },
  quizResultTitle: { color: "#0F172A", fontWeight: "900", fontSize: 22 },
  quizResultMeta: { color: "#475467", fontWeight: "700" }
});






