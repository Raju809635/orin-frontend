import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Alert, Image, Modal, Pressable, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { api } from "@/lib/api";
import { getAppErrorMessage } from "@/lib/appError";
import { useAppTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import DateField from "@/components/profile/date-field";
import { pickAndUploadPostImage } from "@/utils/postMediaUpload";
import {
  AcademicCard,
  AcademicEmpty,
  ActionButton,
  CommunitySection,
  HighSchoolCommunityShell,
  StatusBadge
} from "@/components/community/highschool-ui";

type OpportunityItem = {
  _id: string;
  title: string;
  company?: string;
  role?: string;
  type?: string;
  category?: string;
  duration?: string;
  description?: string;
  bannerImageUrl?: string;
  isActive?: boolean;
  recommendationReason?: string;
  applicationUrl?: string;
  url?: string;
  deadline?: string;
  location?: string;
};

type CompetitionItem = {
  _id: string;
  title: string;
  subject: string;
  chapter?: string;
  description?: string;
  bannerImageUrl?: string;
  scopeType: "institution_only" | "multi_institution" | "open_highschool";
  registrationStartAt?: string | null;
  registrationDeadline: string;
  level1At: string;
  level1EndAt?: string | null;
  level2At?: string | null;
  level2EndAt?: string | null;
  status: "registration_not_started" | "registration_open" | "registration_closed" | "level1_live" | "level1_closed" | "level2_ready" | "level2_live" | "completed" | string;
  storedStatus?: string;
  qualificationTopN?: number;
  level1QuestionCount?: number;
  level1TimeModeSec?: number;
  level1Questions?: CompetitionQuestion[];
  institutionName?: string;
  createdBy?: string | { _id?: string };
  myRegistration?: {
    status?: string;
    qualifiedForLevel2?: boolean;
    level2BatchIndex?: number;
  } | null;
  myLevel1Attempt?: {
    score: number;
    correctCount: number;
    percentage: number;
    grade?: string;
    submittedAt?: string | null;
    totalTimeMs?: number;
    averageResponseMs?: number;
    review?: Level1ReviewRow[];
  } | null;
  myLevel1Rank?: {
    overall: number;
    score: number;
    percentage: number;
    correctCount: number;
  } | null;
  createdAt?: string;
};

type CompetitionQuestion = {
  id?: string;
  text: string;
  options: string[];
  correctOption?: string;
  explanation?: string;
  durationSec?: number;
};

type Level1ReviewRow = {
  questionId: string;
  questionText?: string;
  selectedOption: string;
  correctOption?: string;
  isCorrect: boolean;
  responseMs: number;
  explanation?: string;
};

type CompetitionManagerTab = "registration" | "level1" | "level2" | "reports";
type StudentCompetitionTab = "info" | "level1" | "level2";

type CompetitionReports = {
  qualificationFunnel?: {
    registered: number;
    level1Attempted: number;
    level2Qualified: number;
    winners: number;
  };
  overallLeaderboard?: {
    rank: number;
    studentId: string;
    studentName: string;
    institutionName?: string;
    className?: string;
    score: number;
    percentage: number;
  }[];
  institutionLeaderboard?: {
    rank: number;
    institutionName: string;
    participants: number;
    totalScore: number;
    avgScore: number;
    topStudent?: string;
  }[];
};

type InstitutionSearchResult = {
  id?: string;
  name: string;
  institutionType?: string;
  district?: string;
  state?: string;
  source?: string;
};

type FilterKey = "all" | "workshop" | "olympiad" | "bootcamp" | "scholarship" | "event";
const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "workshop", label: "Workshops" },
  { key: "olympiad", label: "Olympiad Prep" },
  { key: "bootcamp", label: "Bootcamps" },
  { key: "scholarship", label: "Scholarships" },
  { key: "event", label: "School Events" }
];
const CLASS_OPTIONS = Array.from({ length: 12 }, (_, index) => String(index + 1));
const SECTION_OPTIONS = ["A", "B", "C", "D", "E", "F"];
const TOP_N_OPTIONS = [1, 2, 3, 4, 5, 10, 20, 30, 50, 100];
const QUESTION_COUNT_OPTIONS = [10, 15, 20, 25, 30];
const SUBJECT_OPTIONS = ["Mathematics", "Science", "Biology", "Physics", "Chemistry", "Social Science", "English", "Telugu", "Hindi"];
const HOUR_OPTIONS = Array.from({ length: 12 }, (_, index) => index + 1);
const MINUTE_OPTIONS = [0, 15, 30, 45];
const DEFAULT_QUESTION_OPTIONS = ["Option A", "Option B", "Option C", "Option D"];

function academicBucket(item: OpportunityItem): FilterKey {
  const text = `${item.title} ${item.type} ${item.category} ${item.role} ${item.description}`.toLowerCase();
  if (text.includes("scholar")) return "scholarship";
  if (text.includes("olympiad") || text.includes("exam")) return "olympiad";
  if (text.includes("bootcamp") || text.includes("camp")) return "bootcamp";
  if (text.includes("event") || text.includes("school")) return "event";
  return "workshop";
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function dateAfter(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parseTimeSlot(value: string) {
  const [rawHour, rawMinute] = value.split(":").map((item) => Number(item || 0));
  const period: "AM" | "PM" = rawHour >= 12 ? "PM" : "AM";
  const hour = rawHour % 12 || 12;
  const minute = Number.isFinite(rawMinute) ? rawMinute : 0;
  return { hour, minute, period };
}

function toTimeSlot(hour: number, minute: number, period: "AM" | "PM") {
  const normalizedHour = period === "PM" ? (hour === 12 ? 12 : hour + 12) : hour === 12 ? 0 : hour;
  return `${pad(normalizedHour)}:${pad(minute)}`;
}

function formatDisplayTime(value: string) {
  const parsed = parseTimeSlot(value);
  return `${pad(parsed.hour)}:${pad(parsed.minute)} ${parsed.period}`;
}

function blankCompetitionQuestion(index: number, durationSec: number): CompetitionQuestion {
  return {
    id: `L1-${index + 1}`,
    text: "",
    options: [...DEFAULT_QUESTION_OPTIONS],
    correctOption: "Option A",
    explanation: "",
    durationSec
  };
}

function splitIsoToLocalFields(value?: string | null) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) {
    return { date: dateAfter(1), time: "10:00" };
  }
  return {
    date: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    time: `${pad(date.getHours())}:${pad(date.getMinutes())}`
  };
}

function hasStarted(value?: string | null) {
  if (!value) return false;
  const time = new Date(value).getTime();
  return Number.isFinite(time) && Date.now() >= time;
}

function hasEnded(value?: string | null) {
  if (!value) return false;
  const time = new Date(value).getTime();
  return Number.isFinite(time) && Date.now() > time;
}

function formatDateTime(value?: string | null) {
  if (!value) return "Will be announced";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Will be announced" : date.toLocaleString("en-IN");
}

function formatWindow(start?: string | null, end?: string | null) {
  if (!start && !end) return "Will be announced";
  if (!start) return `Until ${formatDateTime(end)}`;
  if (!end) return `Starts ${formatDateTime(start)}`;
  return `${formatDateTime(start)} - ${formatDateTime(end)}`;
}

type TimeFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  colors: { text: string; textMuted: string; border: string; surface: string; surfaceAlt: string };
};

function TimeField({ label, value, onChange, colors }: TimeFieldProps) {
  const parsed = parseTimeSlot(value);
  const [open, setOpen] = useState(false);
  const [hour, setHour] = useState(parsed.hour);
  const [minute, setMinute] = useState(parsed.minute);
  const [period, setPeriod] = useState<"AM" | "PM">(parsed.period);

  function openPicker() {
    const current = parseTimeSlot(value);
    setHour(current.hour);
    setMinute(current.minute);
    setPeriod(current.period);
    setOpen(true);
  }

  function apply() {
    onChange(toTimeSlot(hour, minute, period));
    setOpen(false);
  }

  return (
    <>
      <Text style={[styles.inlineLabel, { color: colors.textMuted }]}>{label}</Text>
      <TouchableOpacity style={[styles.timeField, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }]} onPress={openPicker}>
        <Text style={[styles.timeFieldText, { color: colors.text }]}>{formatDisplayTime(value)}</Text>
        <Text style={[styles.timeFieldMeta, { color: colors.textMuted }]}>Change</Text>
      </TouchableOpacity>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setOpen(false)}>
          <Pressable style={[styles.timeModal, { backgroundColor: colors.surface }]} onPress={(event) => event.stopPropagation()}>
            <Text style={[styles.timeModalTitle, { color: colors.text }]}>{label}</Text>
            <Text style={[styles.inlineLabel, { color: colors.textMuted }]}>Hour</Text>
            <View style={styles.filterRow}>
              {HOUR_OPTIONS.map((item) => {
                const active = hour === item;
                return (
                  <TouchableOpacity
                    key={`hour-${item}`}
                    style={[styles.filterChip, { borderColor: active ? "#16A34A" : colors.border, backgroundColor: active ? "#ECFDF3" : colors.surfaceAlt }]}
                    onPress={() => setHour(item)}
                  >
                    <Text style={[styles.filterText, { color: active ? "#15803D" : colors.textMuted }]}>{item}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={[styles.inlineLabel, { color: colors.textMuted }]}>Minute</Text>
            <View style={styles.filterRow}>
              {MINUTE_OPTIONS.map((item) => {
                const active = minute === item;
                return (
                  <TouchableOpacity
                    key={`minute-${item}`}
                    style={[styles.filterChip, { borderColor: active ? "#16A34A" : colors.border, backgroundColor: active ? "#ECFDF3" : colors.surfaceAlt }]}
                    onPress={() => setMinute(item)}
                  >
                    <Text style={[styles.filterText, { color: active ? "#15803D" : colors.textMuted }]}>{pad(item)}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={[styles.inlineLabel, { color: colors.textMuted }]}>AM / PM</Text>
            <View style={styles.filterRow}>
              {(["AM", "PM"] as const).map((item) => {
                const active = period === item;
                return (
                  <TouchableOpacity
                    key={item}
                    style={[styles.filterChip, { borderColor: active ? "#16A34A" : colors.border, backgroundColor: active ? "#ECFDF3" : colors.surfaceAlt }]}
                    onPress={() => setPeriod(item)}
                  >
                    <Text style={[styles.filterText, { color: active ? "#15803D" : colors.textMuted }]}>{item}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalButton, { borderColor: colors.border }]} onPress={() => setOpen(false)}>
                <Text style={[styles.modalButtonText, { color: colors.textMuted }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalButton, styles.modalButtonPrimary]} onPress={apply}>
                <Text style={[styles.modalButtonText, { color: "#FFFFFF" }]}>Set time</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

export default function HighSchoolProgramsScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const { user } = useAuth();
  const mentorOrgRole = String(user?.mentorOrgRole || "");
  const isInstitutionTeacher = user?.role === "mentor" && (mentorOrgRole === "institution_teacher" || mentorOrgRole === "global_teacher" || mentorOrgRole === "teacher");
  const [programs, setPrograms] = useState<OpportunityItem[]>([]);
  const [competitions, setCompetitions] = useState<CompetitionItem[]>([]);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [selected, setSelected] = useState<OpportunityItem | null>(null);
  const [selectedCompetition, setSelectedCompetition] = useState<CompetitionItem | null>(null);
  const [studentCompetitionTab, setStudentCompetitionTab] = useState<StudentCompetitionTab>("info");
  const [level1Answers, setLevel1Answers] = useState<Record<string, { selectedOption: string; responseMs: number }>>({});
  const [level1QuizStarted, setLevel1QuizStarted] = useState(false);
  const [level1CurrentIndex, setLevel1CurrentIndex] = useState(0);
  const [level1QuestionStartedAtMs, setLevel1QuestionStartedAtMs] = useState(0);
  const [level1TimeLeftSec, setLevel1TimeLeftSec] = useState(0);
  const [submittingLevel1, setSubmittingLevel1] = useState(false);
  const [openingLevel2, setOpeningLevel2] = useState(false);
  const [showChampionshipForm, setShowChampionshipForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [managerCompetition, setManagerCompetition] = useState<CompetitionItem | null>(null);
  const [managerTab, setManagerTab] = useState<CompetitionManagerTab>("registration");
  const [questionEditorCompetition, setQuestionEditorCompetition] = useState<CompetitionItem | null>(null);
  const [questionDrafts, setQuestionDrafts] = useState<CompetitionQuestion[]>([]);
  const [savingQuestions, setSavingQuestions] = useState(false);
  const [level2QuestionDrafts, setLevel2QuestionDrafts] = useState<CompetitionQuestion[]>([]);
  const [savingLevel2, setSavingLevel2] = useState(false);
  const [reports, setReports] = useState<CompetitionReports | null>(null);
  const [loadingReports, setLoadingReports] = useState(false);
  const [savingCompetitionMeta, setSavingCompetitionMeta] = useState(false);
  const [generatingQuestionDraft, setGeneratingQuestionDraft] = useState(false);
  const [aiDraftClassLevel, setAiDraftClassLevel] = useState("10");
  const [aiDraftSubject, setAiDraftSubject] = useState("Mathematics");
  const [aiDraftTopic, setAiDraftTopic] = useState("");
  const [scopeType, setScopeType] = useState<"institution_only" | "multi_institution" | "open_highschool">("institution_only");
  const [selectedInstitutionName, setSelectedInstitutionName] = useState("");
  const [institutionQuery, setInstitutionQuery] = useState("");
  const [institutionResults, setInstitutionResults] = useState<InstitutionSearchResult[]>([]);
  const [searchingInstitutions, setSearchingInstitutions] = useState(false);
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("Mathematics");
  const [chapter, setChapter] = useState("");
  const [description, setDescription] = useState("");
  const [bannerImageUrl, setBannerImageUrl] = useState("");
  const [allowedInstitutions, setAllowedInstitutions] = useState<string[]>([]);
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [selectedSections, setSelectedSections] = useState<string[]>([]);
  const [registrationStartDate, setRegistrationStartDate] = useState(dateAfter(0));
  const [registrationStartTimeSlot, setRegistrationStartTimeSlot] = useState("09:00");
  const [registrationDate, setRegistrationDate] = useState(dateAfter(7));
  const [registrationTimeSlot, setRegistrationTimeSlot] = useState("17:00");
  const [level1Date, setLevel1Date] = useState(dateAfter(10));
  const [level1TimeSlot, setLevel1TimeSlot] = useState("10:00");
  const [level1EndDate, setLevel1EndDate] = useState(dateAfter(10));
  const [level1EndTimeSlot, setLevel1EndTimeSlot] = useState("11:00");
  const [level2Date, setLevel2Date] = useState(dateAfter(12));
  const [level2TimeSlot, setLevel2TimeSlot] = useState("10:00");
  const [level2EndDate, setLevel2EndDate] = useState(dateAfter(12));
  const [level2EndTimeSlot, setLevel2EndTimeSlot] = useState("11:00");
  const [qualificationTopN, setQualificationTopN] = useState(20);
  const [level1QuestionCount, setLevel1QuestionCount] = useState(15);
  const [level1TimeModeSec, setLevel1TimeModeSec] = useState<10 | 30>(30);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    try {
      if (refresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      const [competitionRes, opportunityRes] = await Promise.all([
        api.get<{ competitions: CompetitionItem[] }>("/api/network/highschool-competitions"),
        api.get<OpportunityItem[]>("/api/network/opportunities")
      ]);
      const competitionItems = competitionRes.data?.competitions || [];
      setCompetitions(competitionItems);
      setSelectedCompetition((prev) => prev ? competitionItems.find((item) => item._id === prev._id) || prev : prev);
      setManagerCompetition((prev) => prev ? competitionItems.find((item) => item._id === prev._id) || prev : prev);
      setQuestionEditorCompetition((prev) => prev ? competitionItems.find((item) => item._id === prev._id) || prev : prev);
      setPrograms((opportunityRes.data || []).filter((item) => item.isActive !== false));
    } catch (e) {
      setError(getAppErrorMessage(e, "Failed to load school programs."));
      setPrograms([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const visible = useMemo(() => programs.filter((item) => filter === "all" || academicBucket(item) === filter), [filter, programs]);
  const institutionChoices = useMemo(() => {
    const set = new Set<string>();
    if (user?.institutionName) set.add(user.institutionName);
    competitions.forEach((item) => {
      if (item.institutionName) set.add(item.institutionName);
    });
    return [...set].filter(Boolean);
  }, [competitions, user?.institutionName]);

  async function searchInstitutions(query: string) {
    setInstitutionQuery(query);
    const clean = query.trim();
    if (clean.length < 2) {
      setInstitutionResults([]);
      return;
    }
    try {
      setSearchingInstitutions(true);
      const authSearch = await api.get("/api/auth/institutions/search", {
        params: { q: clean, limit: 10 }
      });
      const authResults = Array.isArray(authSearch.data?.results) ? authSearch.data.results : [];
      if (authResults.length) {
        setInstitutionResults(authResults.slice(0, 10));
        return;
      }

      const profileSearch = await api.get<InstitutionSearchResult[]>("/api/profiles/institutions/search", {
        params: { q: clean }
      });
      setInstitutionResults((profileSearch.data || []).slice(0, 10));
    } catch {
      setInstitutionResults([]);
    } finally {
      setSearchingInstitutions(false);
    }
  }

  function selectInstitution(name: string) {
    const clean = name.trim();
    if (!clean) return;
    if (scopeType === "multi_institution") {
      setAllowedInstitutions((prev) => (prev.includes(clean) ? prev : [...prev, clean]));
    } else {
      setSelectedInstitutionName(clean);
    }
    setInstitutionQuery(clean);
    setInstitutionResults([]);
  }

  function removeAllowedInstitution(name: string) {
    setAllowedInstitutions((prev) => prev.filter((item) => item !== name));
  }

  const classLevelFilter = useMemo(() => {
    if (!selectedClasses.length) return [];
    if (!selectedSections.length) return selectedClasses;
    return selectedClasses.flatMap((className) => selectedSections.map((section) => `${className} ${section}`));
  }, [selectedClasses, selectedSections]);

  async function loadCompetitionReports(competitionId: string) {
    try {
      setLoadingReports(true);
      const res = await api.get<CompetitionReports>(`/api/network/highschool-competitions/${competitionId}/reports`);
      setReports(res.data || null);
    } catch (e) {
      setError(getAppErrorMessage(e, "Unable to load championship reports."));
      setReports(null);
    } finally {
      setLoadingReports(false);
    }
  }

  function openCompetitionManager(item: CompetitionItem, tab: CompetitionManagerTab = "registration") {
    setManagerCompetition(item);
    setManagerTab(tab);
    setQuestionEditorCompetition(item);
    setReports(null);
    setAiDraftClassLevel("10");
    setAiDraftSubject(item.subject || "Mathematics");
    setAiDraftTopic(item.chapter || "");
    const registrationStartFields = splitIsoToLocalFields(item.registrationStartAt || item.createdAt || undefined);
    const registrationFields = splitIsoToLocalFields(item.registrationDeadline);
    const level1Fields = splitIsoToLocalFields(item.level1At);
    const level1EndFields = splitIsoToLocalFields(item.level1EndAt || item.level2At || undefined);
    const level2Fields = splitIsoToLocalFields(item.level2At || undefined);
    const level2EndFields = splitIsoToLocalFields(item.level2EndAt || undefined);
    setRegistrationStartDate(registrationStartFields.date);
    setRegistrationStartTimeSlot(registrationStartFields.time);
    setRegistrationDate(registrationFields.date);
    setRegistrationTimeSlot(registrationFields.time);
    setLevel1Date(level1Fields.date);
    setLevel1TimeSlot(level1Fields.time);
    setLevel1EndDate(level1EndFields.date);
    setLevel1EndTimeSlot(level1EndFields.time);
    setLevel2Date(level2Fields.date);
    setLevel2TimeSlot(level2Fields.time);
    setLevel2EndDate(level2EndFields.date);
    setLevel2EndTimeSlot(level2EndFields.time);
    setQualificationTopN(Math.max(1, Number(item.qualificationTopN || 20)));
    setLevel1QuestionCount(Math.max(5, Number(item.level1QuestionCount || 15)));
    setLevel1TimeModeSec([10, 30].includes(Number(item.level1TimeModeSec)) ? Number(item.level1TimeModeSec) as 10 | 30 : 30);
    setQuestionDrafts([]);
    setLevel2QuestionDrafts(Array.from({ length: 15 }, (_, index) => blankCompetitionQuestion(index, 30)));
    openQuestionEditor(item);
    if (tab === "reports") {
      loadCompetitionReports(item._id);
    }
  }

  function openStudentCompetition(item: CompetitionItem, tab: StudentCompetitionTab = "info") {
    setSelected(null);
    setSelectedCompetition(item);
    setStudentCompetitionTab(tab);
    setLevel1Answers({});
    setLevel1StartedAtMs(Date.now());
  }

  function closeStudentCompetition() {
    setSelectedCompetition(null);
    setLevel1Answers({});
    setLevel1QuizStarted(false);
    setLevel1CurrentIndex(0);
    setLevel1QuestionStartedAtMs(0);
    setLevel1TimeLeftSec(0);
  }

  function selectLevel1Answer(question: CompetitionQuestion, index: number, selectedOption: string) {
    const key = question.id || `L1-${index + 1}`;
    const base = level1QuestionStartedAtMs || Date.now();
    setLevel1Answers((prev) => ({
      ...prev,
      [key]: {
        selectedOption,
        responseMs: Math.max(500, Date.now() - base)
      }
    }));
  }

  function startLevel1Quiz() {
    const firstQuestion = selectedCompetition?.level1Questions?.[0];
    const duration = Number(firstQuestion?.durationSec || selectedCompetition?.level1TimeModeSec || 30);
    setLevel1Answers({});
    setLevel1CurrentIndex(0);
    setLevel1QuestionStartedAtMs(Date.now());
    setLevel1TimeLeftSec(duration);
    setLevel1QuizStarted(true);
  }

  const saveCurrentLevel1Answer = useCallback((forceOption?: string) => {
    const questions = selectedCompetition?.level1Questions || [];
    const question = questions[level1CurrentIndex];
    if (!question) return;
    const key = question.id || `L1-${level1CurrentIndex + 1}`;
    const duration = Number(question.durationSec || selectedCompetition?.level1TimeModeSec || 30);
    const elapsed = level1QuestionStartedAtMs ? Date.now() - level1QuestionStartedAtMs : duration * 1000;
    setLevel1Answers((prev) => ({
      ...prev,
      [key]: {
        selectedOption: forceOption ?? prev[key]?.selectedOption ?? "",
        responseMs: Math.max(500, Math.min(duration * 1000, elapsed))
      }
    }));
  }, [level1CurrentIndex, level1QuestionStartedAtMs, selectedCompetition]);

  function goToNextLevel1Question() {
    const questions = selectedCompetition?.level1Questions || [];
    saveCurrentLevel1Answer();
    if (level1CurrentIndex >= questions.length - 1) return;
    const nextIndex = level1CurrentIndex + 1;
    const nextQuestion = questions[nextIndex];
    setLevel1CurrentIndex(nextIndex);
    setLevel1QuestionStartedAtMs(Date.now());
    setLevel1TimeLeftSec(Number(nextQuestion?.durationSec || selectedCompetition?.level1TimeModeSec || 30));
  }

  useEffect(() => {
    if (!level1QuizStarted || selectedCompetition?.myLevel1Attempt || submittingLevel1) return;
    const questions = selectedCompetition?.level1Questions || [];
    if (!questions.length) return;
    const currentQuestion = questions[level1CurrentIndex];
    const duration = Number(currentQuestion?.durationSec || selectedCompetition?.level1TimeModeSec || 30);
    const timer = setInterval(() => {
      const elapsedSec = Math.floor((Date.now() - (level1QuestionStartedAtMs || Date.now())) / 1000);
      const remaining = Math.max(0, duration - elapsedSec);
      setLevel1TimeLeftSec(remaining);
      if (remaining <= 0) {
        clearInterval(timer);
        saveCurrentLevel1Answer("");
        if (level1CurrentIndex >= questions.length - 1) {
          setTimeout(() => submitLevel1Attempt(), 100);
        } else {
          const nextIndex = level1CurrentIndex + 1;
          const nextQuestion = questions[nextIndex];
          setLevel1CurrentIndex(nextIndex);
          setLevel1QuestionStartedAtMs(Date.now());
          setLevel1TimeLeftSec(Number(nextQuestion?.durationSec || selectedCompetition?.level1TimeModeSec || 30));
        }
      }
    }, 250);
    return () => clearInterval(timer);
  // submitLevel1Attempt intentionally stays outside the dependency list to avoid resetting the active timer on every render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level1CurrentIndex, level1QuestionStartedAtMs, level1QuizStarted, saveCurrentLevel1Answer, selectedCompetition, submittingLevel1]);

  async function submitLevel1Attempt() {
    if (!selectedCompetition) return;
    const questions = selectedCompetition.level1Questions || [];
    if (!questions.length) {
      Alert.alert("Level 1", "Questions are not ready yet.");
      return;
    }
    const currentKey = questions[level1CurrentIndex]?.id || `L1-${level1CurrentIndex + 1}`;
    const currentDuration = Number(questions[level1CurrentIndex]?.durationSec || selectedCompetition.level1TimeModeSec || 30);
    const currentElapsed = level1QuestionStartedAtMs ? Date.now() - level1QuestionStartedAtMs : currentDuration * 1000;
    const mergedAnswers = level1QuizStarted && questions[level1CurrentIndex]
      ? {
          ...level1Answers,
          [currentKey]: {
            selectedOption: level1Answers[currentKey]?.selectedOption || "",
            responseMs: Math.max(500, Math.min(currentDuration * 1000, currentElapsed))
          }
        }
      : level1Answers;
    if (level1QuizStarted) setLevel1Answers(mergedAnswers);
    const missing = questions.some((question, index) => !mergedAnswers[question.id || `L1-${index + 1}`]?.selectedOption);
    if (missing && !level1QuizStarted) {
      Alert.alert("Complete Level 1", "Answer every question before submitting.");
      return;
    }
    try {
      setSubmittingLevel1(true);
      const answers = questions.map((question, index) => {
        const key = question.id || `L1-${index + 1}`;
        return mergedAnswers[key] || { selectedOption: "", responseMs: Number(question.durationSec || selectedCompetition.level1TimeModeSec || 30) * 1000 };
      });
      const { data } = await api.post(`/api/network/highschool-competitions/${selectedCompetition._id}/level1/submit`, { answers });
      Alert.alert("Level 1 submitted", `Score ${data?.score || 0}. ${data?.percentage || 0}%`);
      await load(true);
      setSelectedCompetition((prev) => prev ? {
        ...prev,
        myLevel1Attempt: {
          score: Number(data?.score || 0),
          correctCount: Number(data?.correctCount || 0),
          percentage: Number(data?.percentage || 0),
          grade: String(data?.grade || ""),
          submittedAt: new Date().toISOString(),
          totalTimeMs: Number(data?.totalTimeMs || 0),
          averageResponseMs: Number(data?.averageResponseMs || 0),
          review: Array.isArray(data?.review) ? data.review : []
        },
        myLevel1Rank: data?.rank
          ? {
              overall: Number(data.rank),
              score: Number(data?.score || 0),
              percentage: Number(data?.percentage || 0),
              correctCount: Number(data?.correctCount || 0)
            }
          : prev.myLevel1Rank || null
      } : prev);
      setLevel1QuizStarted(false);
    } catch (e) {
      setError(getAppErrorMessage(e, "Unable to submit Level 1 right now."));
    } finally {
      setSubmittingLevel1(false);
    }
  }

  async function openLevel2Batch() {
    if (!selectedCompetition?.myRegistration?.qualifiedForLevel2) {
      Alert.alert("Level 2", "You are not qualified for Level 2 yet.");
      return;
    }
    const batchIndex = Number(selectedCompetition.myRegistration.level2BatchIndex ?? -1);
    if (batchIndex < 0) {
      Alert.alert("Level 2", "Your Level 2 batch is not created yet.");
      return;
    }
    try {
      setOpeningLevel2(true);
      await api.post(`/api/network/highschool-competitions/${selectedCompetition._id}/level2/batches/${batchIndex}/join`, {});
      Alert.alert("Level 2 ready", `You joined Batch ${batchIndex + 1}. Live quiz screen will open here when the round starts.`);
    } catch (e) {
      setError(getAppErrorMessage(e, "Unable to open Level 2 right now."));
    } finally {
      setOpeningLevel2(false);
    }
  }

  async function saveCompetitionSchedule() {
    if (!managerCompetition?._id) return;
    try {
      setSavingCompetitionMeta(true);
      setError(null);
      const res = await api.patch<{ competition: CompetitionItem }>(`/api/network/highschool-competitions/${managerCompetition._id}`, {
        registrationStartAt: toIso(registrationStartDate, registrationStartTimeSlot),
        registrationDeadline: toIso(registrationDate, registrationTimeSlot),
        level1At: toIso(level1Date, level1TimeSlot),
        level1EndAt: toIso(level1EndDate, level1EndTimeSlot),
        level2At: toIso(level2Date, level2TimeSlot),
        level2EndAt: toIso(level2EndDate, level2EndTimeSlot),
        qualificationTopN,
        level1QuestionCount,
        level1TimeModeSec
      });
      const updated = res.data?.competition || managerCompetition;
      setManagerCompetition(updated);
      setQuestionEditorCompetition(updated);
      setSelectedCompetition((prev) => (prev?._id === updated._id ? updated : prev));
      setCompetitions((prev) => prev.map((item) => (item._id === updated._id ? updated : item)));
      Alert.alert("Saved", "Championship schedule and settings updated.");
      await load(true);
    } catch (e) {
      const message = getAppErrorMessage(e, "Unable to update championship schedule.");
      setError(message);
      Alert.alert("Schedule not saved", message);
    } finally {
      setSavingCompetitionMeta(false);
    }
  }

  async function generateQuestionDraft(level: "L1" | "L2") {
    const target = managerCompetition || questionEditorCompetition;
    if (!target) return;
    try {
      setGeneratingQuestionDraft(true);
      setError(null);
      const questionCount = level === "L1" ? Math.max(5, Number(target.level1QuestionCount || level1QuestionCount || 15)) : 15;
      const durationSec = level === "L1" ? Number(target.level1TimeModeSec || level1TimeModeSec || 30) : 30;
      const res = await api.post<{ questions: CompetitionQuestion[] }>("/api/network/highschool-competitions/question-draft", {
        subject: aiDraftSubject || target.subject || subject,
        topic: aiDraftTopic || target.chapter || chapter,
        classLevel: aiDraftClassLevel || "10",
        level,
        questionCount,
        durationSec
      });
      const generated = Array.isArray(res.data?.questions) ? res.data.questions : [];
      const fillCount = level === "L1" ? questionCount : 15;
      const filled = Array.from({ length: fillCount }, (_, index) => {
        const row = generated[index];
        if (!row) return blankCompetitionQuestion(index, durationSec);
        return {
          id: row.id || `${level}-${index + 1}`,
          text: row.text || "",
          options: Array.isArray(row.options) && row.options.length >= 4 ? row.options.slice(0, 4) : [...DEFAULT_QUESTION_OPTIONS],
          correctOption: row.correctOption || (Array.isArray(row.options) ? row.options[0] : "Option A"),
          explanation: row.explanation || "",
          durationSec: Number(row.durationSec || durationSec)
        };
      });
      if (level === "L1") setQuestionDrafts(filled);
      else setLevel2QuestionDrafts(filled);
      Alert.alert("AI draft ready", `${level} questions are generated. Review and edit before saving.`);
    } catch (e) {
      setError(getAppErrorMessage(e, "Unable to generate AI question draft."));
    } finally {
      setGeneratingQuestionDraft(false);
    }
  }

  async function saveLevel2QuestionsAndCreateBatches() {
    if (!managerCompetition?._id) return;
    const sanitized = level2QuestionDrafts.map((item, index) => ({
      id: item.id || `L2-${index + 1}`,
      text: item.text.trim(),
      options: item.options.map((opt) => opt.trim()).filter(Boolean),
      correctOption: item.correctOption.trim(),
      explanation: item.explanation?.trim() || "",
      durationSec: 30
    }));
    const invalid = sanitized.find((item) => !item.text || item.options.length < 4 || !item.options.some((opt) => opt === item.correctOption));
    if (invalid) {
      Alert.alert("Complete all questions", "Each Level 2 question needs text, 4 options, and one correct answer.");
      return;
    }
    try {
      setSavingLevel2(true);
      setError(null);
      await api.post(`/api/network/highschool-competitions/${managerCompetition._id}/level2/batches`, {
        questionSets: [{ questions: sanitized }]
      });
      Alert.alert("Level 2 ready", "Level 2 batches were created with the saved question set.");
      await load(true);
      await loadCompetitionReports(managerCompetition._id);
    } catch (e) {
      setError(getAppErrorMessage(e, "Unable to create Level 2 batches."));
    } finally {
      setSavingLevel2(false);
    }
  }

  function openQuestionEditor(item: CompetitionItem) {
    const expectedCount = Math.max(5, Number(item.level1QuestionCount || 15));
    const durationSec = Number(item.level1TimeModeSec || 30);
    const existing = Array.isArray(item.level1Questions) ? item.level1Questions.slice(0, expectedCount) : [];
    const drafts: CompetitionQuestion[] = Array.from({ length: expectedCount }, (_, index) => {
      const row = existing[index];
      if (!row) return blankCompetitionQuestion(index, durationSec);
      const normalizedOptions = Array.isArray(row.options) && row.options.length >= 4
        ? row.options.slice(0, 4)
        : [...DEFAULT_QUESTION_OPTIONS];
      return {
        id: row.id || `L1-${index + 1}`,
        text: row.text || "",
        options: normalizedOptions,
        correctOption: row.correctOption || normalizedOptions[0] || "Option A",
        explanation: row.explanation || "",
        durationSec: Number(row.durationSec || durationSec)
      };
    });
    setQuestionEditorCompetition(item);
    setQuestionDrafts(drafts);
  }

  function updateQuestionText(index: number, value: string) {
    setQuestionDrafts((prev) => prev.map((item, itemIndex) => (itemIndex === index ? { ...item, text: value } : item)));
  }

  function updateQuestionOption(questionIndex: number, optionIndex: number, value: string) {
    setQuestionDrafts((prev) =>
      prev.map((item, itemIndex) => {
        if (itemIndex !== questionIndex) return item;
        const nextOptions = item.options.map((opt, idx) => (idx === optionIndex ? value : opt));
        const previousCorrect = item.correctOption;
        const nextCorrect =
          item.options[optionIndex] === previousCorrect
            ? value
            : nextOptions.find((opt) => opt === previousCorrect) || previousCorrect;
        return { ...item, options: nextOptions, correctOption: nextCorrect };
      })
    );
  }

  function updateQuestionCorrectOption(questionIndex: number, optionIndex: number) {
    setQuestionDrafts((prev) =>
      prev.map((item, itemIndex) => (itemIndex === questionIndex ? { ...item, correctOption: item.options[optionIndex] || "" } : item))
    );
  }

  function updateQuestionExplanation(index: number, value: string) {
    setQuestionDrafts((prev) => prev.map((item, itemIndex) => (itemIndex === index ? { ...item, explanation: value } : item)));
  }

  async function saveLevel1Questions() {
    if (!questionEditorCompetition?._id) return;
    const sanitized = questionDrafts.map((item, index) => ({
      id: item.id || `L1-${index + 1}`,
      text: item.text.trim(),
      options: item.options.map((opt) => opt.trim()).filter(Boolean),
      correctOption: item.correctOption.trim(),
      explanation: item.explanation?.trim() || "",
      durationSec: Number(item.durationSec || questionEditorCompetition.level1TimeModeSec || 30)
    }));
    const invalid = sanitized.find(
      (item) =>
        !item.text ||
        item.options.length < 4 ||
        !item.correctOption ||
        !item.options.some((opt) => opt === item.correctOption)
    );
    if (invalid) {
      Alert.alert("Complete all questions", "Each Level 1 question needs text, 4 options, and one correct option.");
      return;
    }
    try {
      setSavingQuestions(true);
      setError(null);
      await api.patch(`/api/network/highschool-competitions/${questionEditorCompetition._id}/level1/questions`, {
        questions: sanitized
      });
      Alert.alert("Saved", "Level 1 questions are ready for students.");
      setQuestionEditorCompetition(null);
      setQuestionDrafts([]);
      await load(true);
    } catch (e) {
      setError(getAppErrorMessage(e, "Unable to save Level 1 questions."));
    } finally {
      setSavingQuestions(false);
    }
  }

  function toIso(dateValue: string, timeSlot: string) {
    const [h, m] = timeSlot.split(":").map((item) => Number(item || 0));
    const [year, month, day] = dateValue.split("-").map((item) => Number(item || 0));
    const date = year && month && day ? new Date(year, month - 1, day) : new Date();
    date.setHours(h, m, 0, 0);
    return date.toISOString();
  }

  async function pickBannerImage() {
    try {
      setUploadingBanner(true);
      const url = await pickAndUploadPostImage();
      if (url) {
        setBannerImageUrl(url);
      } else {
        Alert.alert("Banner not selected", "Choose a JPG or PNG banner sized 1600 x 600 px for the cleanest student view.");
      }
    } catch (e) {
      setError(getAppErrorMessage(e, "Unable to upload event banner."));
    } finally {
      setUploadingBanner(false);
    }
  }

  async function createCompetition() {
    if (!isInstitutionTeacher) return;
    if (!title.trim() || !subject.trim()) {
      Alert.alert("Required fields", "Please fill title and subject.");
      return;
    }
    if (scopeType === "multi_institution" && allowedInstitutions.length < 2) {
      Alert.alert("Select schools", "For Inter-School mode, select at least 2 institutions.");
      return;
    }
    if (scopeType === "institution_only" && !selectedInstitutionName.trim()) {
      Alert.alert("Select institution", "Pick the institution for this competition.");
      return;
    }
    try {
      setCreating(true);
      setError(null);
      await api.post("/api/network/highschool-competitions", {
        title: title.trim(),
        subject: subject.trim(),
        chapter: chapter.trim(),
        description: description.trim(),
        bannerImageUrl: bannerImageUrl.trim(),
        scopeType,
        selectedInstitutionName: scopeType === "institution_only" ? selectedInstitutionName.trim() : "",
        allowedInstitutions: scopeType === "multi_institution" ? allowedInstitutions : [],
        classLevelFilter,
        registrationStartAt: toIso(registrationStartDate, registrationStartTimeSlot),
        registrationDeadline: toIso(registrationDate, registrationTimeSlot),
        level1At: toIso(level1Date, level1TimeSlot),
        level1EndAt: toIso(level1EndDate, level1EndTimeSlot),
        level2At: toIso(level2Date, level2TimeSlot),
        level2EndAt: toIso(level2EndDate, level2EndTimeSlot),
        qualificationTopN: Math.max(1, Number(qualificationTopN || 20)),
        level1QuestionCount: Math.max(5, Number(level1QuestionCount || 15)),
        level1TimeModeSec
      });
      Alert.alert("Created", "Championship program created.");
      setTitle("");
      setChapter("");
      setDescription("");
      setAllowedInstitutions([]);
      setSelectedInstitutionName("");
      setInstitutionQuery("");
      setInstitutionResults([]);
      setSelectedClasses([]);
      setSelectedSections([]);
      setBannerImageUrl("");
      setShowChampionshipForm(false);
      await load(true);
    } catch (e) {
      setError(getAppErrorMessage(e, "Unable to create championship program."));
    } finally {
      setCreating(false);
    }
  }

  function isCompetitionOwner(item: CompetitionItem) {
    const createdBy = typeof item.createdBy === "object" ? item.createdBy?._id : item.createdBy;
    const currentUser = user as { _id?: string; id?: string } | null;
    const currentUserId = String(currentUser?._id || currentUser?.id || "");
    return Boolean(currentUserId && String(createdBy || "") === currentUserId);
  }

  function confirmDeleteCompetition(item: CompetitionItem) {
    Alert.alert(
      "Delete championship?",
      `This will permanently delete "${item.title}" for everyone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              setError(null);
              await api.delete(`/api/network/highschool-competitions/${item._id}`);
              await load(true);
            } catch (e) {
              setError(getAppErrorMessage(e, "Unable to delete championship."));
            }
          }
        }
      ]
    );
  }

  return (
    <HighSchoolCommunityShell
      title="School Programs"
      subtitle="After-12 opportunities engine, filtered and presented for academic-safe workshops, scholarships, bootcamps and school events."
      stats={[
        { icon: "briefcase", label: "Programs", value: String(competitions.length || programs.length) },
        { icon: "filter", label: "Filter", value: FILTERS.find((item) => item.key === filter)?.label || "All" },
        { icon: "school", label: "Mode", value: "Academic" }
      ]}
      loading={loading}
      error={error}
      refreshing={refreshing}
      onRefresh={() => load(true)}
    >
      {isInstitutionTeacher && !showChampionshipForm ? (
        <CommunitySection title="Create" subtitle="Teacher-only creation starts from one clear action." icon="add-circle">
          <AcademicCard
            icon="trophy-outline"
            title="Create Championship"
            meta="Level-1 and Level-2 school competition"
            note="Choose schools, classes, registration date, round dates, scoring rules, and event banner inside the creation flow."
            badge="Teacher"
            badgeTone="success"
            actionLabel="Create Championship"
            onPress={() => setShowChampionshipForm(true)}
          />
        </CommunitySection>
      ) : null}

      {isInstitutionTeacher && showChampionshipForm ? (
        <CommunitySection title="Create Championship Program" subtitle="Teacher-only panel to create Level-1 and Level-2 school competitions." icon="add-circle">
          <TouchableOpacity style={[styles.backButton, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }]} onPress={() => setShowChampionshipForm(false)}>
            <Text style={[styles.backButtonText, { color: colors.textMuted }]}>Back to Create</Text>
          </TouchableOpacity>
          <TextInput
            style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}
            placeholder="Program title (e.g., Maths Championship 2026)"
            placeholderTextColor={colors.textMuted}
            value={title}
            onChangeText={setTitle}
          />
          <Text style={[styles.scopeHeading, { color: colors.text }]}>Subject</Text>
          <View style={styles.filterRow}>
            {SUBJECT_OPTIONS.map((item) => {
              const active = subject === item;
              return (
                <TouchableOpacity
                  key={item}
                  onPress={() => setSubject(item)}
                  style={[styles.filterChip, { borderColor: active ? "#16A34A" : colors.border, backgroundColor: active ? "#ECFDF3" : colors.surfaceAlt }]}
                >
                  <Text style={[styles.filterText, { color: active ? "#15803D" : colors.textMuted }]}>{item}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <TextInput
            style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}
            placeholder="Chapter / topic scope (optional)"
            placeholderTextColor={colors.textMuted}
            value={chapter}
            onChangeText={setChapter}
          />
          <TextInput
            style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}
            placeholder="Description (optional)"
            placeholderTextColor={colors.textMuted}
            value={description}
            onChangeText={setDescription}
          />
          <TouchableOpacity style={[styles.bannerPicker, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }]} onPress={pickBannerImage}>
            <Text style={[styles.bannerPickerText, { color: colors.text }]}>Select Event Banner</Text>
            <Text style={[styles.bannerPickerMeta, { color: colors.textMuted }]}>
              {uploadingBanner ? "Uploading banner..." : bannerImageUrl ? "Uploaded. Tap to change image." : "Recommended: JPG/PNG, 1600 x 600 px, keep title/logo centered"}
            </Text>
          </TouchableOpacity>
          {bannerImageUrl ? (
            <View style={[styles.bannerPreviewFrame, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
              <Image source={{ uri: bannerImageUrl }} style={styles.bannerPreview} resizeMode="contain" />
            </View>
          ) : null}

          <Text style={[styles.scopeHeading, { color: colors.text }]}>Competition Audience</Text>
          <View style={styles.filterRow}>
            {[
              { key: "institution_only", label: "Specific Institution" },
              { key: "open_highschool", label: "Global Schools" },
              { key: "multi_institution", label: "Inter-School (Selected)" }
            ].map((item) => {
              const active = scopeType === item.key;
              return (
                <TouchableOpacity
                  key={item.key}
                  onPress={() => setScopeType(item.key as "institution_only" | "multi_institution" | "open_highschool")}
                  style={[styles.filterChip, { borderColor: active ? "#16A34A" : colors.border, backgroundColor: active ? "#ECFDF3" : colors.surfaceAlt }]}
                >
                  <Text style={[styles.filterText, { color: active ? "#15803D" : colors.textMuted }]}>{item.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={[styles.scopeNote, { color: colors.textMuted }]}>
            {scopeType === "institution_only"
              ? "Only students from the selected institution can register."
              : scopeType === "open_highschool"
                ? "Any high-school student across institutions can register."
                : "Only students from the schools you list below can register."}
          </Text>

          {scopeType !== "open_highschool" ? (
            <View style={styles.institutionBox}>
              <TextInput
                style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}
                placeholder={scopeType === "institution_only" ? "Search and select institution" : "Search school and add to Inter-School list"}
                placeholderTextColor={colors.textMuted}
                value={institutionQuery}
                onChangeText={searchInstitutions}
              />
              {searchingInstitutions ? <Text style={[styles.scopeNote, { color: colors.textMuted }]}>Searching schools...</Text> : null}
              {institutionResults.length ? (
                <View style={[styles.searchResults, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                  {institutionResults.map((item) => (
                    <TouchableOpacity key={`${item.name}-${item.district || ""}`} style={[styles.searchResultRow, { borderBottomColor: colors.border }]} onPress={() => selectInstitution(item.name)}>
                      <Text style={[styles.searchResultName, { color: colors.text }]}>{item.name}</Text>
                      <Text style={[styles.searchResultMeta, { color: colors.textMuted }]}>
                        {[item.institutionType, item.district, item.state].filter(Boolean).join(" | ") || "School"}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : null}

              {scopeType === "institution_only" && selectedInstitutionName ? (
                <View style={styles.filterRow}>
                  <TouchableOpacity style={[styles.filterChip, { borderColor: "#16A34A", backgroundColor: "#ECFDF3" }]} onPress={() => setSelectedInstitutionName("")}>
                    <Text style={[styles.filterText, { color: "#15803D" }]}>Selected: {selectedInstitutionName}</Text>
                  </TouchableOpacity>
                </View>
              ) : null}

              {scopeType === "multi_institution" ? (
                <>
                  {institutionChoices.length ? (
                    <>
                      <Text style={[styles.inlineLabel, { color: colors.textMuted }]}>Quick picks from existing listed schools</Text>
                      <View style={styles.filterRow}>
                        {institutionChoices.map((item) => {
                          const active = allowedInstitutions.includes(item);
                          return (
                            <TouchableOpacity
                              key={item}
                              onPress={() => (active ? removeAllowedInstitution(item) : selectInstitution(item))}
                              style={[styles.filterChip, { borderColor: active ? "#16A34A" : colors.border, backgroundColor: active ? "#ECFDF3" : colors.surfaceAlt }]}
                            >
                              <Text style={[styles.filterText, { color: active ? "#15803D" : colors.textMuted }]}>{item}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </>
                  ) : null}
                  <Text style={[styles.inlineLabel, { color: colors.textMuted }]}>Selected schools ({allowedInstitutions.length})</Text>
                  <View style={styles.filterRow}>
                    {allowedInstitutions.map((item) => (
                      <TouchableOpacity key={item} style={[styles.filterChip, { borderColor: "#16A34A", backgroundColor: "#ECFDF3" }]} onPress={() => removeAllowedInstitution(item)}>
                        <Text style={[styles.filterText, { color: "#15803D" }]}>{item} x</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              ) : null}
            </View>
          ) : null}

          <Text style={[styles.scopeHeading, { color: colors.text }]}>Class Selection (Optional)</Text>
          <Text style={[styles.inlineLabel, { color: colors.textMuted }]}>Classes</Text>
          <View style={styles.filterRow}>
            {CLASS_OPTIONS.map((item) => {
              const active = selectedClasses.includes(item);
              return (
                <TouchableOpacity
                  key={item}
                  onPress={() =>
                    setSelectedClasses((prev) => (active ? prev.filter((x) => x !== item) : [...prev, item]))
                  }
                  style={[styles.filterChip, { borderColor: active ? "#16A34A" : colors.border, backgroundColor: active ? "#ECFDF3" : colors.surfaceAlt }]}
                >
                  <Text style={[styles.filterText, { color: active ? "#15803D" : colors.textMuted }]}>{item}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={[styles.inlineLabel, { color: colors.textMuted }]}>Sections</Text>
          <View style={styles.filterRow}>
            {SECTION_OPTIONS.map((item) => {
              const active = selectedSections.includes(item);
              return (
                <TouchableOpacity
                  key={item}
                  onPress={() => setSelectedSections((prev) => (active ? prev.filter((x) => x !== item) : [...prev, item]))}
                  style={[styles.filterChip, { borderColor: active ? "#16A34A" : colors.border, backgroundColor: active ? "#ECFDF3" : colors.surfaceAlt }]}
                >
                  <Text style={[styles.filterText, { color: active ? "#15803D" : colors.textMuted }]}>{item}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {classLevelFilter.length ? (
            <Text style={[styles.scopeNote, { color: colors.textMuted }]}>Selected: {classLevelFilter.join(", ")}</Text>
          ) : null}

          <Text style={[styles.scopeHeading, { color: colors.text }]}>Registration Window</Text>
          <View style={styles.row}>
            <View style={styles.inlineSelect}>
              <DateField label="Start date" value={registrationStartDate} onChange={setRegistrationStartDate} />
            </View>
            <View style={styles.inlineSelect}>
              <TimeField label="Start time" value={registrationStartTimeSlot} onChange={setRegistrationStartTimeSlot} colors={colors} />
            </View>
          </View>
          <View style={styles.row}>
            <View style={styles.inlineSelect}>
              <DateField label="End date" value={registrationDate} onChange={setRegistrationDate} />
            </View>
            <View style={styles.inlineSelect}>
              <TimeField label="End time" value={registrationTimeSlot} onChange={setRegistrationTimeSlot} colors={colors} />
            </View>
          </View>

          <Text style={[styles.scopeHeading, { color: colors.text }]}>Level 1 Window</Text>
          <View style={styles.row}>
            <View style={styles.inlineSelect}>
              <DateField label="Start date" value={level1Date} onChange={setLevel1Date} />
            </View>
            <View style={styles.inlineSelect}>
              <TimeField label="Start time" value={level1TimeSlot} onChange={setLevel1TimeSlot} colors={colors} />
            </View>
          </View>
          <View style={styles.row}>
            <View style={styles.inlineSelect}>
              <DateField label="End date" value={level1EndDate} onChange={setLevel1EndDate} />
            </View>
            <View style={styles.inlineSelect}>
              <TimeField label="End time" value={level1EndTimeSlot} onChange={setLevel1EndTimeSlot} colors={colors} />
            </View>
          </View>

          <Text style={[styles.scopeHeading, { color: colors.text }]}>Level 2 Window</Text>
          <View style={styles.row}>
            <View style={styles.inlineSelect}>
              <DateField label="Start date" value={level2Date} onChange={setLevel2Date} />
            </View>
            <View style={styles.inlineSelect}>
              <TimeField label="Start time" value={level2TimeSlot} onChange={setLevel2TimeSlot} colors={colors} />
            </View>
          </View>
          <View style={styles.row}>
            <View style={styles.inlineSelect}>
              <DateField label="End date" value={level2EndDate} onChange={setLevel2EndDate} />
            </View>
            <View style={styles.inlineSelect}>
              <TimeField label="End time" value={level2EndTimeSlot} onChange={setLevel2EndTimeSlot} colors={colors} />
            </View>
          </View>

          <View style={styles.row}>
            <View style={styles.halfInput}>
              <Text style={[styles.inlineLabel, { color: colors.textMuted }]}>Top N qualify</Text>
              <View style={styles.filterRow}>
                {TOP_N_OPTIONS.map((item) => {
                  const active = qualificationTopN === item;
                  return (
                    <TouchableOpacity
                      key={`topn-${item}`}
                      onPress={() => setQualificationTopN(item)}
                      style={[styles.filterChip, { borderColor: active ? "#16A34A" : colors.border, backgroundColor: active ? "#ECFDF3" : colors.surfaceAlt }]}
                    >
                      <Text style={[styles.filterText, { color: active ? "#15803D" : colors.textMuted }]}>{item}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
            <View style={styles.halfInput}>
              <Text style={[styles.inlineLabel, { color: colors.textMuted }]}>L1 question count</Text>
              <View style={styles.filterRow}>
                {QUESTION_COUNT_OPTIONS.map((item) => {
                  const active = level1QuestionCount === item;
                  return (
                    <TouchableOpacity
                      key={`qcount-${item}`}
                      onPress={() => setLevel1QuestionCount(item)}
                      style={[styles.filterChip, { borderColor: active ? "#16A34A" : colors.border, backgroundColor: active ? "#ECFDF3" : colors.surfaceAlt }]}
                    >
                      <Text style={[styles.filterText, { color: active ? "#15803D" : colors.textMuted }]}>{item}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </View>

          <View style={styles.filterRow}>
            {[10, 30].map((item) => {
              const active = level1TimeModeSec === item;
              return (
                <TouchableOpacity
                  key={item}
                  onPress={() => setLevel1TimeModeSec(item as 10 | 30)}
                  style={[styles.filterChip, { borderColor: active ? "#16A34A" : colors.border, backgroundColor: active ? "#ECFDF3" : colors.surfaceAlt }]}
                >
                  <Text style={[styles.filterText, { color: active ? "#15803D" : colors.textMuted }]}>{item}s mode</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <ActionButton label={creating ? "Creating..." : "Create Championship"} icon="sparkles-outline" onPress={createCompetition} />
          <Text style={[styles.helpTitle, { color: colors.text }]}>How this works</Text>
          <Text style={[styles.helpText, { color: colors.textMuted }]}>
            Top N qualify is the maximum number of Level-1 students who move to Level 2. Example: if Top N = 3 and 4 students participate, only the best 3 qualify. If Top N = 5 and only 4 students participate, all 4 can qualify.
          </Text>
          <Text style={[styles.helpText, { color: colors.textMuted }]}>
            Quiz questions are added right after program creation in the next teacher step: Level-1 question set and Level-2 batch question sets (15 each), with manual + AI assist.
          </Text>
        </CommunitySection>
      ) : null}

      <CommunitySection title="Program Filters" subtitle="Challenges do not appear here. They stay in Challenges." icon="options">
        <View style={styles.filterRow}>
          {FILTERS.map((item) => {
            const active = filter === item.key;
            return (
              <TouchableOpacity
                key={item.key}
                onPress={() => setFilter(item.key)}
                style={[styles.filterChip, { borderColor: active ? "#16A34A" : colors.border, backgroundColor: active ? "#ECFDF3" : colors.surfaceAlt }]}
              >
                <Text style={[styles.filterText, { color: active ? "#15803D" : colors.textMuted }]}>{item.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </CommunitySection>

      <CommunitySection title="Championship Programs" subtitle="Cross-institution events with registration, Level-1 qualification, and live Level-2 rounds." icon="trophy">
        {competitions.length ? (
          competitions.map((item) => {
            const scopeLabel =
              item.scopeType === "open_highschool"
                ? "Open High School"
                : item.scopeType === "multi_institution"
                  ? "Multi Institution"
                  : "Institution Only";
            const statusLabel = item.myRegistration?.qualifiedForLevel2
              ? "Qualified L2"
              : item.myRegistration?.status === "registered"
                ? "Registered"
                : item.status === "registration_not_started"
                  ? "Registration Soon"
                  : item.status === "registration_open"
                  ? "Open"
                  : item.status === "registration_closed"
                    ? "Registration Closed"
                    : item.status === "level1_live"
                      ? "Level 1 Live"
                      : item.status === "level2_ready"
                        ? "Level 2 Ready"
                  : item.status.replace(/_/g, " ");
            const canRegister = item.status === "registration_open" && !item.myRegistration;
            const ownedByMe = isCompetitionOwner(item);
            return (
              <View key={item._id} style={[styles.competitionCardWrap, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
                {item.bannerImageUrl ? (
                  <Image source={{ uri: item.bannerImageUrl }} style={styles.competitionBanner} resizeMode="contain" />
                ) : (
                  <View style={[styles.competitionBannerPlaceholder, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <Text style={[styles.competitionBannerPlaceholderText, { color: colors.textMuted }]}>{item.subject} Championship</Text>
                  </View>
                )}
                <AcademicCard
                icon="trophy-outline"
                title={item.title}
                meta={`${item.subject}${item.chapter ? ` · ${item.chapter}` : ""} · ${scopeLabel}`}
                note={`Registration ${formatWindow(item.registrationStartAt, item.registrationDeadline)} · L1 ${formatWindow(item.level1At, item.level1EndAt)}${item.level2At ? ` · L2 ${formatWindow(item.level2At, item.level2EndAt)}` : ""}`}
                badge={statusLabel}
                badgeTone={item.myRegistration?.qualifiedForLevel2 ? "success" : "primary"}
                actionLabel={
                  ownedByMe
                    ? "Manage Championship"
                    : item.myRegistration
                      ? "Open Full Event"
                      : canRegister
                        ? "Register"
                        : "Open Full Event"
                }
                secondaryLabel={ownedByMe ? "Delete" : undefined}
                onPress={async () => {
                  if (ownedByMe) {
                    openCompetitionManager(item, "registration");
                    return;
                  }
                  if (item.myRegistration || !canRegister) {
                    openStudentCompetition(item, "info");
                    return;
                  }
                  try {
                    await api.post(`/api/network/highschool-competitions/${item._id}/register`, {});
                    await load(true);
                  } catch (e) {
                    setError(getAppErrorMessage(e, "Unable to register right now."));
                  }
                }}
                onSecondaryPress={ownedByMe ? () => confirmDeleteCompetition(item) : undefined}
                />
              </View>
            );
          })
        ) : (
          <AcademicEmpty label="No championship programs are live right now." />
        )}
      </CommunitySection>

      {selectedCompetition ? (
        <CommunitySection
          title={`Full Event - ${selectedCompetition.title}`}
          subtitle="Event info, Level 1 attempt/status, and Level 2 qualification in one place."
          icon="reader"
        >
          <TouchableOpacity
            style={[styles.backButton, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}
            onPress={closeStudentCompetition}
          >
            <Text style={[styles.backButtonText, { color: colors.textMuted }]}>Close Event</Text>
          </TouchableOpacity>
          <View style={styles.filterRow}>
            {([
              ["info", "Event Info"],
              ["level1", "Level 1"],
              ["level2", "Level 2"]
            ] as const).map(([key, label]) => {
              const active = studentCompetitionTab === key;
              return (
                <TouchableOpacity
                  key={`student-event-${key}`}
                  onPress={() => {
                    setStudentCompetitionTab(key);
                    if (key === "level1") setLevel1StartedAtMs(Date.now());
                  }}
                  style={[styles.filterChip, { borderColor: active ? "#16A34A" : colors.border, backgroundColor: active ? "#ECFDF3" : colors.surfaceAlt }]}
                >
                  <Text style={[styles.filterText, { color: active ? "#15803D" : colors.textMuted }]}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {studentCompetitionTab === "info" ? (
            <>
              {selectedCompetition.bannerImageUrl ? <Image source={{ uri: selectedCompetition.bannerImageUrl }} style={styles.detailBanner} resizeMode="contain" /> : null}
              <View style={styles.detailHead}>
                <Text style={[styles.detailTitle, { color: colors.text }]}>{selectedCompetition.title}</Text>
                <StatusBadge label={selectedCompetition.myRegistration ? "Registered" : selectedCompetition.status.replace(/_/g, " ")} tone="success" />
              </View>
              <Text style={[styles.detailMeta, { color: colors.textMuted }]}>
                {[selectedCompetition.subject, selectedCompetition.chapter, selectedCompetition.scopeType === "open_highschool" ? "Global Schools" : selectedCompetition.institutionName].filter(Boolean).join(" · ")}
              </Text>
              <Text style={[styles.detailText, { color: colors.textMuted }]}>
                {selectedCompetition.description || "This championship has registration, Level 1 qualification, and Level 2 finalist rounds."}
              </Text>
              <View style={styles.eventMilestoneGrid}>
                <AcademicCard icon="calendar-outline" title="Registration" meta={formatWindow(selectedCompetition.registrationStartAt, selectedCompetition.registrationDeadline)} note={selectedCompetition.myRegistration ? "You are registered. Latest schedule updates appear here." : "Register during this window."} />
                <AcademicCard icon="create-outline" title="Level 1" meta={formatWindow(selectedCompetition.level1At, selectedCompetition.level1EndAt)} note={hasEnded(selectedCompetition.level1EndAt) ? "Level 1 window is closed." : hasStarted(selectedCompetition.level1At) ? "Level 1 is open now." : "Attempt unlocks at the start time."} />
                <AcademicCard icon="flash-outline" title="Level 2" meta={formatWindow(selectedCompetition.level2At, selectedCompetition.level2EndAt)} note={selectedCompetition.myRegistration?.qualifiedForLevel2 ? "You qualified for Level 2." : "Top scorers qualify after Level 1."} />
              </View>
            </>
          ) : null}

          {studentCompetitionTab === "level1" ? (
            <>
              {!selectedCompetition.myRegistration ? (
                <AcademicEmpty label="Register first to attempt Level 1." />
              ) : !hasStarted(selectedCompetition.level1At) ? (
                <AcademicCard icon="time-outline" title="Level 1 Not Started" meta={formatWindow(selectedCompetition.level1At, selectedCompetition.level1EndAt)} note="Come back at the start time to attempt the quiz." />
              ) : selectedCompetition.myLevel1Attempt ? (
                <>
                  <View style={styles.eventMilestoneGrid}>
                    <AcademicCard icon="trophy-outline" title="Your Score" meta={String(selectedCompetition.myLevel1Attempt.score)} note={`${selectedCompetition.myLevel1Attempt.percentage}% · Grade ${selectedCompetition.myLevel1Attempt.grade || "-"}`} />
                    <AcademicCard icon="podium-outline" title="Your Rank" meta={selectedCompetition.myLevel1Rank?.overall ? `#${selectedCompetition.myLevel1Rank.overall}` : "Pending"} note={selectedCompetition.myRegistration?.qualifiedForLevel2 ? "Qualified for Level 2" : "Qualification updates after teacher finalizes Level 1."} />
                    <AcademicCard icon="checkmark-circle-outline" title="Correct" meta={String(selectedCompetition.myLevel1Attempt.correctCount)} note={`Submitted ${selectedCompetition.myLevel1Attempt.submittedAt ? new Date(selectedCompetition.myLevel1Attempt.submittedAt).toLocaleString("en-IN") : ""}`} />
                    <AcademicCard icon="speedometer-outline" title="Avg Time" meta={`${Math.round(Number(selectedCompetition.myLevel1Attempt.averageResponseMs || 0) / 1000)}s`} note="Lower time helps when scores tie." />
                  </View>
                  <View style={[styles.quizInstructionBox, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}>
                    <Text style={[styles.quizInstructionTitle, { color: colors.text }]}>Quiz Analytics</Text>
                    <Text style={[styles.quizInstructionText, { color: colors.textMuted }]}>Accuracy: {selectedCompetition.myLevel1Attempt.percentage}%</Text>
                    <Text style={[styles.quizInstructionText, { color: colors.textMuted }]}>Total time: {Math.round(Number(selectedCompetition.myLevel1Attempt.totalTimeMs || 0) / 1000)} seconds</Text>
                    <Text style={[styles.quizInstructionText, { color: colors.textMuted }]}>Speed note: faster correct answers add more points.</Text>
                  </View>
                  {(selectedCompetition.myLevel1Attempt.review || []).length ? (
                    <View style={styles.reviewList}>
                      <Text style={[styles.scopeHeading, { color: colors.text }]}>Answer Review</Text>
                      {(selectedCompetition.myLevel1Attempt.review || []).map((row, index) => (
                        <View key={`${row.questionId}-${index}`} style={[styles.reviewCard, { borderColor: row.isCorrect ? "#16A34A" : "#EF4444", backgroundColor: colors.surfaceAlt }]}>
                          <Text style={[styles.reviewTitle, { color: colors.text }]}>Q{index + 1}. {row.questionText || row.questionId}</Text>
                          <Text style={[styles.reviewText, { color: row.isCorrect ? "#15803D" : "#DC2626" }]}>
                            {row.isCorrect ? "Correct" : "Wrong"} - Your answer: {row.selectedOption || "Not answered"} - {Math.round(Number(row.responseMs || 0) / 1000)}s
                          </Text>
                          {!row.isCorrect ? <Text style={[styles.reviewText, { color: colors.textMuted }]}>Correct answer: {row.correctOption || "-"}</Text> : null}
                          {row.explanation ? <Text style={[styles.reviewText, { color: colors.textMuted }]}>{row.explanation}</Text> : null}
                        </View>
                      ))}
                    </View>
                  ) : null}
                </>
              ) : hasEnded(selectedCompetition.level1EndAt) ? (
                <AcademicCard icon="lock-closed-outline" title="Level 1 Closed" meta={formatWindow(selectedCompetition.level1At, selectedCompetition.level1EndAt)} note="The attempt window is over. Your result appears here if you submitted." />
              ) : !(selectedCompetition.level1Questions || []).length ? (
                <AcademicCard icon="help-circle-outline" title="Questions Not Ready" meta="Teacher setup pending" note="Level 1 questions will appear after the teacher saves them." />
              ) : !level1QuizStarted ? (
                <>
                  <AcademicCard
                    icon="information-circle-outline"
                    title="Level 1 Instructions"
                    meta={`${selectedCompetition.level1Questions?.length || 0} questions · ${selectedCompetition.level1TimeModeSec || 30}s each`}
                    note="Questions appear one by one. Faster correct answers get more score. Once time is over, ORIN moves to the next question automatically."
                  />
                  <View style={[styles.quizInstructionBox, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}>
                    <Text style={[styles.quizInstructionTitle, { color: colors.text }]}>Before you start</Text>
                    <Text style={[styles.quizInstructionText, { color: colors.textMuted }]}>- Keep your screen open until the quiz ends.</Text>
                    <Text style={[styles.quizInstructionText, { color: colors.textMuted }]}>- Tap an option, then Save & Next.</Text>
                    <Text style={[styles.quizInstructionText, { color: colors.textMuted }]}>- Unanswered questions count as wrong after timeout.</Text>
                    <Text style={[styles.quizInstructionText, { color: colors.textMuted }]}>- Your rank uses score first, then speed.</Text>
                  </View>
                  <ActionButton label="Start Level 1 Quiz" icon="play-circle-outline" onPress={startLevel1Quiz} />
                </>
              ) : (
                <>
                  {(() => {
                    const questions = selectedCompetition.level1Questions || [];
                    const question = questions[level1CurrentIndex];
                    const key = question?.id || `L1-${level1CurrentIndex + 1}`;
                    const picked = level1Answers[key]?.selectedOption || "";
                    const duration = Number(question?.durationSec || selectedCompetition.level1TimeModeSec || 30);
                    const progress = duration ? Math.max(0, Math.min(100, (level1TimeLeftSec / duration) * 100)) : 0;
                    if (!question) return null;
                    return (
                      <View style={[styles.questionCard, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}>
                        <View style={styles.quizTopRow}>
                          <Text style={[styles.questionTitle, { color: colors.text }]}>Question {level1CurrentIndex + 1} of {questions.length}</Text>
                          <View style={[styles.timerPill, { backgroundColor: level1TimeLeftSec <= 5 ? "#FEE2E2" : "#ECFDF3" }]}>
                            <Ionicons name="timer-outline" size={16} color={level1TimeLeftSec <= 5 ? "#DC2626" : "#15803D"} />
                            <Text style={[styles.timerText, { color: level1TimeLeftSec <= 5 ? "#DC2626" : "#15803D" }]}>{level1TimeLeftSec}s</Text>
                          </View>
                        </View>
                        <View style={styles.quizTimerTrack}>
                          <View style={[styles.quizTimerFill, { width: `${progress}%`, backgroundColor: level1TimeLeftSec <= 5 ? "#EF4444" : "#16A34A" }]} />
                        </View>
                        <Text style={[styles.quizQuestionText, { color: colors.text }]}>Q{level1CurrentIndex + 1}. {question.text}</Text>
                        {question.options.map((option) => {
                          const active = picked === option;
                          return (
                            <TouchableOpacity
                              key={`${key}-${option}`}
                              style={[styles.studentOption, { borderColor: active ? "#16A34A" : colors.border, backgroundColor: active ? "#ECFDF3" : colors.surface }]}
                              onPress={() => selectLevel1Answer(question, index, option)}
                            >
                              <Text style={[styles.studentOptionText, { color: active ? "#15803D" : colors.text }]}>{option}</Text>
                            </TouchableOpacity>
                          );
                        })}
                        <View style={styles.quizNavRow}>
                          <ActionButton
                            label={level1CurrentIndex >= questions.length - 1 ? "Save Answer" : "Save & Next"}
                            icon="arrow-forward-circle-outline"
                            onPress={goToNextLevel1Question}
                            variant="secondary"
                          />
                          {level1CurrentIndex >= questions.length - 1 ? (
                            <ActionButton label={submittingLevel1 ? "Submitting..." : "Submit Quiz"} icon="send-outline" onPress={submitLevel1Attempt} />
                          ) : null}
                        </View>
                      </View>
                    );
                  })()}
                </>
              )}
            </>
          ) : null}

          {studentCompetitionTab === "level2" ? (
            <>
              {!selectedCompetition.myRegistration ? (
                <AcademicEmpty label="Register and complete Level 1 first." />
              ) : !selectedCompetition.myLevel1Attempt ? (
                <AcademicCard icon="lock-closed-outline" title="Level 2 Locked" meta="Finish Level 1 first" note="Your Level 2 status appears after Level 1 results are finalized." />
              ) : !selectedCompetition.myRegistration.qualifiedForLevel2 ? (
                <AcademicCard icon="hourglass-outline" title="Qualification Pending" meta={selectedCompetition.myLevel1Rank?.overall ? `Current rank #${selectedCompetition.myLevel1Rank.overall}` : "Rank pending"} note="If you are inside Top N after finalization, Level 2 will unlock here." />
              ) : !hasStarted(selectedCompetition.level2At) ? (
                <AcademicCard icon="time-outline" title="Level 2 Not Started" meta={formatWindow(selectedCompetition.level2At, selectedCompetition.level2EndAt)} note="You qualified. Come back when Level 2 starts." />
              ) : hasEnded(selectedCompetition.level2EndAt) ? (
                <AcademicCard icon="lock-closed-outline" title="Level 2 Closed" meta={formatWindow(selectedCompetition.level2At, selectedCompetition.level2EndAt)} note="The Level 2 window is over." />
              ) : (
                <>
                  <AcademicCard icon="medal-outline" title="Level 2 Ready" meta={`Batch ${(selectedCompetition.myRegistration.level2BatchIndex ?? 0) + 1}`} note="Join your assigned live batch round." />
                  <ActionButton label={openingLevel2 ? "Opening..." : "Open Level 2 Batch"} icon="rocket-outline" onPress={openLevel2Batch} />
                </>
              )}
            </>
          ) : null}
        </CommunitySection>
      ) : null}

      {isInstitutionTeacher && managerCompetition ? (
        <CommunitySection
          title={`Manage Championship - ${managerCompetition.title}`}
          subtitle="Teacher control centre for dates, Level 1, Level 2, participation, and winners."
          icon="settings-outline"
        >
          <View style={styles.filterRow}>
            {([
              ["registration", "Registration"],
              ["level1", "Level 1"],
              ["level2", "Level 2"],
              ["reports", "Reports"]
            ] as const).map(([key, label]) => {
              const active = managerTab === key;
              return (
                <TouchableOpacity
                  key={key}
                  onPress={() => {
                    setManagerTab(key);
                    if (key === "reports") loadCompetitionReports(managerCompetition._id);
                  }}
                  style={[styles.filterChip, { borderColor: active ? "#16A34A" : colors.border, backgroundColor: active ? "#ECFDF3" : colors.surfaceAlt }]}
                >
                  <Text style={[styles.filterText, { color: active ? "#15803D" : colors.textMuted }]}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <TouchableOpacity
            style={[styles.backButton, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}
            onPress={() => {
              setManagerCompetition(null);
              setQuestionEditorCompetition(null);
              setQuestionDrafts([]);
              setLevel2QuestionDrafts([]);
              setReports(null);
            }}
          >
            <Text style={[styles.backButtonText, { color: colors.textMuted }]}>Close Manager</Text>
          </TouchableOpacity>

          {managerTab === "registration" ? (
            <>
              <Text style={[styles.scopeHeading, { color: colors.text }]}>Registration Window</Text>
              <View style={styles.row}>
                <View style={styles.inlineSelect}>
                  <DateField label="Start date" value={registrationStartDate} onChange={setRegistrationStartDate} />
                </View>
                <View style={styles.inlineSelect}>
                  <TimeField label="Start time" value={registrationStartTimeSlot} onChange={setRegistrationStartTimeSlot} colors={colors} />
                </View>
              </View>
              <View style={styles.row}>
                <View style={styles.inlineSelect}>
                  <DateField label="End date" value={registrationDate} onChange={setRegistrationDate} />
                </View>
                <View style={styles.inlineSelect}>
                  <TimeField label="End time" value={registrationTimeSlot} onChange={setRegistrationTimeSlot} colors={colors} />
                </View>
              </View>
              <Text style={[styles.scopeHeading, { color: colors.text }]}>Level 1 Window</Text>
              <View style={styles.row}>
                <View style={styles.inlineSelect}>
                  <DateField label="Start date" value={level1Date} onChange={setLevel1Date} />
                </View>
                <View style={styles.inlineSelect}>
                  <TimeField label="Start time" value={level1TimeSlot} onChange={setLevel1TimeSlot} colors={colors} />
                </View>
              </View>
              <View style={styles.row}>
                <View style={styles.inlineSelect}>
                  <DateField label="End date" value={level1EndDate} onChange={setLevel1EndDate} />
                </View>
                <View style={styles.inlineSelect}>
                  <TimeField label="End time" value={level1EndTimeSlot} onChange={setLevel1EndTimeSlot} colors={colors} />
                </View>
              </View>
              <Text style={[styles.scopeHeading, { color: colors.text }]}>Level 2 Window</Text>
              <View style={styles.row}>
                <View style={styles.inlineSelect}>
                  <DateField label="Start date" value={level2Date} onChange={setLevel2Date} />
                </View>
                <View style={styles.inlineSelect}>
                  <TimeField label="Start time" value={level2TimeSlot} onChange={setLevel2TimeSlot} colors={colors} />
                </View>
              </View>
              <View style={styles.row}>
                <View style={styles.inlineSelect}>
                  <DateField label="End date" value={level2EndDate} onChange={setLevel2EndDate} />
                </View>
                <View style={styles.inlineSelect}>
                  <TimeField label="End time" value={level2EndTimeSlot} onChange={setLevel2EndTimeSlot} colors={colors} />
                </View>
              </View>
              <Text style={[styles.inlineLabel, { color: colors.textMuted }]}>Top N qualify</Text>
              <View style={styles.filterRow}>
                {TOP_N_OPTIONS.map((item) => {
                  const active = qualificationTopN === item;
                  return (
                    <TouchableOpacity key={`manage-topn-${item}`} onPress={() => setQualificationTopN(item)} style={[styles.filterChip, { borderColor: active ? "#16A34A" : colors.border, backgroundColor: active ? "#ECFDF3" : colors.surfaceAlt }]}>
                      <Text style={[styles.filterText, { color: active ? "#15803D" : colors.textMuted }]}>{item}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <ActionButton label={savingCompetitionMeta ? "Saving..." : "Save Event Schedule"} icon="save-outline" onPress={saveCompetitionSchedule} />
            </>
          ) : null}

          {managerTab === "level1" ? (
            <>
              <Text style={[styles.inlineLabel, { color: colors.textMuted }]}>AI Draft Context</Text>
              <View style={styles.filterRow}>
                {CLASS_OPTIONS.map((item) => {
                  const active = aiDraftClassLevel === item;
                  return (
                    <TouchableOpacity key={`draft-class-${item}`} onPress={() => setAiDraftClassLevel(item)} style={[styles.filterChip, { borderColor: active ? "#16A34A" : colors.border, backgroundColor: active ? "#ECFDF3" : colors.surfaceAlt }]}>
                      <Text style={[styles.filterText, { color: active ? "#15803D" : colors.textMuted }]}>{item}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <View style={styles.filterRow}>
                {SUBJECT_OPTIONS.map((item) => {
                  const active = aiDraftSubject === item;
                  return (
                    <TouchableOpacity key={`draft-subject-${item}`} onPress={() => setAiDraftSubject(item)} style={[styles.filterChip, { borderColor: active ? "#16A34A" : colors.border, backgroundColor: active ? "#ECFDF3" : colors.surfaceAlt }]}>
                      <Text style={[styles.filterText, { color: active ? "#15803D" : colors.textMuted }]}>{item}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <TextInput
                style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}
                placeholder="Topic / chapter for AI draft"
                placeholderTextColor={colors.textMuted}
                value={aiDraftTopic}
                onChangeText={setAiDraftTopic}
              />
              <ActionButton label={generatingQuestionDraft ? "Generating..." : "AI Draft Level 1 Questions"} icon="sparkles-outline" onPress={() => generateQuestionDraft("L1")} />
              <Text style={[styles.helpText, { color: colors.textMuted }]}>AI drafts questions from subject, topic, and class context. Review them before saving.</Text>
            </>
          ) : null}

          {managerTab === "level2" ? (
            <>
              <Text style={[styles.inlineLabel, { color: colors.textMuted }]}>AI Draft Context</Text>
              <View style={styles.filterRow}>
                {CLASS_OPTIONS.map((item) => {
                  const active = aiDraftClassLevel === item;
                  return (
                    <TouchableOpacity key={`draft-l2-class-${item}`} onPress={() => setAiDraftClassLevel(item)} style={[styles.filterChip, { borderColor: active ? "#16A34A" : colors.border, backgroundColor: active ? "#ECFDF3" : colors.surfaceAlt }]}>
                      <Text style={[styles.filterText, { color: active ? "#15803D" : colors.textMuted }]}>{item}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <View style={styles.filterRow}>
                {SUBJECT_OPTIONS.map((item) => {
                  const active = aiDraftSubject === item;
                  return (
                    <TouchableOpacity key={`draft-l2-subject-${item}`} onPress={() => setAiDraftSubject(item)} style={[styles.filterChip, { borderColor: active ? "#16A34A" : colors.border, backgroundColor: active ? "#ECFDF3" : colors.surfaceAlt }]}>
                      <Text style={[styles.filterText, { color: active ? "#15803D" : colors.textMuted }]}>{item}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <TextInput
                style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}
                placeholder="Topic / chapter for AI draft"
                placeholderTextColor={colors.textMuted}
                value={aiDraftTopic}
                onChangeText={setAiDraftTopic}
              />
              <ActionButton label={generatingQuestionDraft ? "Generating..." : "AI Draft Level 2 Questions"} icon="sparkles-outline" onPress={() => generateQuestionDraft("L2")} />
              <Text style={[styles.helpText, { color: colors.textMuted }]}>Create the live Level 2 question set here. Saving creates the Level 2 batches for qualified students.</Text>
            </>
          ) : null}

          {managerTab === "reports" ? (
            <>
              {loadingReports ? <Text style={[styles.helpText, { color: colors.textMuted }]}>Loading reports...</Text> : null}
              {reports?.qualificationFunnel ? (
                <View style={styles.filterRow}>
                  <AcademicCard icon="people-outline" title="Registered" meta={String(reports.qualificationFunnel.registered || 0)} />
                  <AcademicCard icon="create-outline" title="L1 Attempted" meta={String(reports.qualificationFunnel.level1Attempted || 0)} />
                  <AcademicCard icon="medal-outline" title="Qualified L2" meta={String(reports.qualificationFunnel.level2Qualified || 0)} />
                  <AcademicCard icon="trophy-outline" title="Winners" meta={String(reports.qualificationFunnel.winners || 0)} />
                </View>
              ) : null}
              {(reports?.overallLeaderboard || []).slice(0, 10).map((row) => (
                <AcademicCard key={`${row.studentId}-${row.rank}`} icon="podium-outline" title={`#${row.rank} ${row.studentName}`} meta={`${row.institutionName || "School"}${row.className ? ` · ${row.className}` : ""}`} note={`Score ${row.score} · ${row.percentage}%`} />
              ))}
            </>
          ) : null}
        </CommunitySection>
      ) : null}

      {isInstitutionTeacher && managerTab === "level1" && questionEditorCompetition ? (
        <CommunitySection
          title={`Level 1 Questions - ${questionEditorCompetition.title}`}
          subtitle={`Create ${questionEditorCompetition.level1QuestionCount || 15} timed questions. Students will answer this exact set in Level 1.`}
          icon="help-circle"
        >
          <TouchableOpacity
            style={[styles.backButton, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}
            onPress={() => {
              setQuestionEditorCompetition(null);
              setQuestionDrafts([]);
            }}
          >
            <Text style={[styles.backButtonText, { color: colors.textMuted }]}>Close Editor</Text>
          </TouchableOpacity>
          <Text style={[styles.helpText, { color: colors.textMuted }]}>
            Time mode: {questionEditorCompetition.level1TimeModeSec || 30}s per question. Add all questions before Level 1 goes live.
          </Text>
          {questionDrafts.map((item, index) => (
            <View key={item.id || `draft-${index}`} style={[styles.questionCard, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}>
              <Text style={[styles.questionTitle, { color: colors.text }]}>Question {index + 1}</Text>
              <TextInput
                style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
                placeholder="Enter the question"
                placeholderTextColor={colors.textMuted}
                value={item.text}
                onChangeText={(value) => updateQuestionText(index, value)}
                multiline
              />
              {item.options.map((option, optionIndex) => {
                const active = item.correctOption === option;
                return (
                  <View key={`${item.id || index}-option-${optionIndex}`} style={styles.optionRow}>
                    <TouchableOpacity
                      style={[styles.correctChip, { borderColor: active ? "#16A34A" : colors.border, backgroundColor: active ? "#ECFDF3" : colors.surface }]}
                      onPress={() => updateQuestionCorrectOption(index, optionIndex)}
                    >
                      <Text style={[styles.correctChipText, { color: active ? "#15803D" : colors.textMuted }]}>
                        {active ? "Correct" : `Option ${String.fromCharCode(65 + optionIndex)}`}
                      </Text>
                    </TouchableOpacity>
                    <TextInput
                      style={[styles.input, styles.optionInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
                      placeholder={`Option ${String.fromCharCode(65 + optionIndex)}`}
                      placeholderTextColor={colors.textMuted}
                      value={option}
                      onChangeText={(value) => updateQuestionOption(index, optionIndex, value)}
                    />
                  </View>
                );
              })}
              <TextInput
                style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
                placeholder="Explanation for review (optional)"
                placeholderTextColor={colors.textMuted}
                value={item.explanation || ""}
                onChangeText={(value) => updateQuestionExplanation(index, value)}
                multiline
              />
            </View>
          ))}
          <ActionButton label={savingQuestions ? "Saving..." : "Save Level 1 Questions"} icon="save-outline" onPress={saveLevel1Questions} />
        </CommunitySection>
      ) : null}

      {isInstitutionTeacher && managerTab === "level2" && managerCompetition ? (
        <CommunitySection
          title={`Level 2 Questions - ${managerCompetition.title}`}
          subtitle="Qualified students will receive these questions in their live batch round."
          icon="flash-outline"
        >
          {level2QuestionDrafts.map((item, index) => (
            <View key={item.id || `level2-${index}`} style={[styles.questionCard, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}>
              <Text style={[styles.questionTitle, { color: colors.text }]}>L2 Question {index + 1}</Text>
              <TextInput
                style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
                placeholder="Enter the Level 2 question"
                placeholderTextColor={colors.textMuted}
                value={item.text}
                onChangeText={(value) => setLevel2QuestionDrafts((prev) => prev.map((row, rowIndex) => rowIndex === index ? { ...row, text: value } : row))}
                multiline
              />
              {item.options.map((option, optionIndex) => {
                const active = item.correctOption === option;
                return (
                  <View key={`${item.id || index}-l2-option-${optionIndex}`} style={styles.optionRow}>
                    <TouchableOpacity
                      style={[styles.correctChip, { borderColor: active ? "#16A34A" : colors.border, backgroundColor: active ? "#ECFDF3" : colors.surface }]}
                      onPress={() => setLevel2QuestionDrafts((prev) => prev.map((row, rowIndex) => rowIndex === index ? { ...row, correctOption: row.options[optionIndex] || "" } : row))}
                    >
                      <Text style={[styles.correctChipText, { color: active ? "#15803D" : colors.textMuted }]}>{active ? "Correct" : `Option ${String.fromCharCode(65 + optionIndex)}`}</Text>
                    </TouchableOpacity>
                    <TextInput
                      style={[styles.input, styles.optionInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
                      placeholder={`Option ${String.fromCharCode(65 + optionIndex)}`}
                      placeholderTextColor={colors.textMuted}
                      value={option}
                      onChangeText={(value) => setLevel2QuestionDrafts((prev) => prev.map((row, rowIndex) => rowIndex === index ? { ...row, options: row.options.map((opt, optIndex) => optIndex === optionIndex ? value : opt) } : row))}
                    />
                  </View>
                );
              })}
            </View>
          ))}
          <ActionButton label={savingLevel2 ? "Creating Level 2..." : "Save Level 2 Questions and Create Batches"} icon="rocket-outline" onPress={saveLevel2QuestionsAndCreateBatches} />
        </CommunitySection>
      ) : null}

      <CommunitySection title="Available Academic Programs" subtitle="Real records from Opportunities API, academically labelled." icon="briefcase">
        {visible.length ? (
          visible.map((item) => {
            const bucket = academicBucket(item);
            return (
              <AcademicCard
                key={item._id || item.title}
                icon={bucket === "scholarship" ? "school-outline" : bucket === "olympiad" ? "medal-outline" : "calendar-outline"}
                title={item.title}
                meta={`${item.category || item.type || FILTERS.find((filterItem) => filterItem.key === bucket)?.label || "Program"}${item.duration ? ` · ${item.duration}` : ""}`}
                note={item.recommendationReason || item.description || `${item.company || "ORIN"}${item.location ? ` · ${item.location}` : ""}`}
                badge={bucket === "all" ? "Program" : FILTERS.find((filterItem) => filterItem.key === bucket)?.label || "Program"}
                badgeTone={bucket === "scholarship" ? "success" : "primary"}
                actionLabel="View Details"
                secondaryLabel={item.applicationUrl || item.url ? "Open Link" : undefined}
                onPress={() => setSelected(item)}
                onSecondaryPress={() => router.push("/community/opportunities" as never)}
              />
            );
          })
        ) : (
          <AcademicEmpty label="No academic programs are live for this filter right now." />
        )}
      </CommunitySection>

      {selected ? (
        <CommunitySection title="Program Detail" subtitle="Use the full after-12 opportunities workflow when application data exists." icon="reader">
          <View style={styles.detailHead}>
            <Text style={[styles.detailTitle, { color: colors.text }]}>{selected.title}</Text>
            <StatusBadge label={FILTERS.find((item) => item.key === academicBucket(selected))?.label || "Program"} tone="success" />
          </View>
          {selected.bannerImageUrl ? <Image source={{ uri: selected.bannerImageUrl }} style={styles.detailBanner} resizeMode="cover" /> : null}
          <Text style={[styles.detailMeta, { color: colors.textMuted }]}>
            {[selected.company, selected.role, selected.duration, selected.deadline ? `Deadline ${new Date(selected.deadline).toLocaleDateString("en-IN")}` : ""]
              .filter(Boolean)
              .join(" · ")}
          </Text>
          <Text style={[styles.detailText, { color: colors.textMuted }]}>{selected.description || selected.recommendationReason || "Program details will appear here when the backend provides them."}</Text>
          <ActionButton label="Open Full Opportunities" icon="open-outline" onPress={() => router.push("/community/opportunities" as never)} />
        </CommunitySection>
      ) : null}
    </HighSchoolCommunityShell>
  );
}

const styles = StyleSheet.create({
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  row: { flexDirection: "row", gap: 10 },
  halfInput: { flex: 1 },
  filterRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  institutionBox: { gap: 8 },
  searchResults: { borderWidth: 1, borderRadius: 12, overflow: "hidden" },
  searchResultRow: { paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1 },
  searchResultName: { fontWeight: "900" },
  searchResultMeta: { marginTop: 2, fontSize: 12, fontWeight: "700" },
  scopeHeading: { fontWeight: "900", fontSize: 14 },
  inlineLabel: { fontWeight: "800", fontSize: 12 },
  inlineSelect: { flex: 1, minWidth: 220, gap: 8 },
  scopeNote: { fontWeight: "700", lineHeight: 19 },
  timeField: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  timeFieldText: { fontWeight: "900", fontSize: 15 },
  timeFieldMeta: { fontWeight: "800", fontSize: 12 },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(15, 23, 42, 0.42)", alignItems: "center", justifyContent: "center", padding: 20 },
  timeModal: { width: "100%", maxWidth: 420, borderRadius: 18, padding: 16, gap: 12 },
  timeModalTitle: { fontSize: 18, fontWeight: "900" },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 4 },
  modalButton: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  modalButtonPrimary: { borderColor: "#16A34A", backgroundColor: "#16A34A" },
  modalButtonText: { fontWeight: "900" },
  backButton: { alignSelf: "flex-start", borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  backButtonText: { fontWeight: "900", fontSize: 12 },
  bannerPicker: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11 },
  bannerPickerText: { fontWeight: "900" },
  bannerPickerMeta: { fontWeight: "700", marginTop: 2 },
  bannerPreviewFrame: { width: "100%", aspectRatio: 16 / 6, borderWidth: 1, borderRadius: 14, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  bannerPreview: { width: "100%", height: "100%" },
  competitionCardWrap: { borderWidth: 1, borderRadius: 18, padding: 8, gap: 8, overflow: "hidden" },
  competitionBanner: { width: "100%", aspectRatio: 16 / 6, borderRadius: 12 },
  competitionBannerPlaceholder: { width: "100%", aspectRatio: 16 / 6, borderWidth: 1, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  competitionBannerPlaceholderText: { fontWeight: "900" },
  questionCard: { borderWidth: 1, borderRadius: 16, padding: 12, gap: 10 },
  questionTitle: { fontWeight: "900", fontSize: 15 },
  quizTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  timerPill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7, flexDirection: "row", alignItems: "center", gap: 5 },
  timerText: { fontWeight: "900", fontSize: 13 },
  quizTimerTrack: { height: 9, borderRadius: 999, overflow: "hidden", backgroundColor: "#E5E7EB" },
  quizTimerFill: { height: "100%", borderRadius: 999 },
  quizQuestionText: { fontWeight: "900", fontSize: 16, lineHeight: 23 },
  quizNavRow: { gap: 8 },
  quizInstructionBox: { borderWidth: 1, borderRadius: 16, padding: 12, gap: 6 },
  quizInstructionTitle: { fontSize: 15, fontWeight: "900" },
  quizInstructionText: { fontSize: 13, fontWeight: "700", lineHeight: 19 },
  reviewList: { gap: 10 },
  reviewCard: { borderWidth: 1, borderRadius: 14, padding: 11, gap: 6 },
  reviewTitle: { fontWeight: "900", lineHeight: 20 },
  reviewText: { fontWeight: "700", lineHeight: 18 },
  optionRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  optionInput: { flex: 1 },
  correctChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 10, minWidth: 94, alignItems: "center" },
  correctChipText: { fontWeight: "900", fontSize: 12 },
  detailBanner: { width: "100%", aspectRatio: 16 / 6, borderRadius: 14, marginVertical: 4 },
  helpTitle: { fontWeight: "900", marginTop: 4 },
  helpText: { fontWeight: "700", lineHeight: 19 },
  filterChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  filterText: { fontWeight: "900", fontSize: 12 },
  detailHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  detailTitle: { flex: 1, fontSize: 20, fontWeight: "900" },
  detailMeta: { fontWeight: "800", lineHeight: 20 },
  detailText: { lineHeight: 21, fontWeight: "600" },
  eventMilestoneGrid: { gap: 10 },
  studentOption: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  studentOptionText: { fontWeight: "800", lineHeight: 18 }
});
