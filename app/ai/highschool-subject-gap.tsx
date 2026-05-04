import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { ActivityIndicator, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useAppTheme } from "@/context/ThemeContext";
import { useLearner } from "@/context/LearnerContext";
import { getAppErrorMessage } from "@/lib/appError";
import { api } from "@/lib/api";

type SubjectName = "Mathematics" | "Science" | "English";

type GapQuestion = {
  id: string;
  subject: SubjectName;
  topic: string;
  question: string;
  options: string[];
  correct: string;
  explanation: string;
};

type AnswerMap = Record<string, string>;

type ScoreRow = {
  key: string;
  label: string;
  subject?: SubjectName;
  correct: number;
  total: number;
  percent: number;
};

type FocusPlan = {
  title: string;
  topics: string[];
  description: string;
  dailyPractice?: string;
  improvementTarget?: string;
  steps?: string[];
};

type GapReport = {
  overallScore: number;
  completedQuestions: number;
  totalCorrect: number;
  subjectRows: ScoreRow[];
  topicRows: ScoreRow[];
  weakRows: ScoreRow[];
  averageRows: ScoreRow[];
  strengthRows: ScoreRow[];
  focusRows: ScoreRow[];
  praise: string;
  focusPlan: FocusPlan;
};

type StudyTask = {
  id: string;
  type: string;
  title: string;
  duration: string;
  completed: boolean;
};

type StudyWeek = {
  week: string;
  title: string;
  status: "active" | "locked" | "completed";
  progress: number;
  focus: string;
  tasks: StudyTask[];
};

type StudyPlan = {
  title: string;
  subject: SubjectName;
  topic: string;
  summary: string;
  overallProgress: number;
  weeks: StudyWeek[];
  dailyTasks: StudyTask[];
  adaptiveRules: string[];
};

const SUBJECT_META: Record<SubjectName, { icon: keyof typeof Ionicons.glyphMap; color: string; bg: string }> = {
  Mathematics: { icon: "calculator", color: "#0EA5E9", bg: "#E0F2FE" },
  Science: { icon: "flask", color: "#7C3AED", bg: "#F3E8FF" },
  English: { icon: "book", color: "#F59E0B", bg: "#FEF3C7" }
};

const SUBJECT_TOPICS: Record<SubjectName, string[]> = {
  Mathematics: ["Fractions", "Algebra", "Geometry", "Numbers"],
  Science: ["Electricity", "Plants", "Forces", "Life Processes"],
  English: ["Grammar", "Reading", "Vocabulary", "Writing Skills"]
};

const FALLBACK_QUESTIONS: GapQuestion[] = [
  {
    id: "math-fractions-1",
    subject: "Mathematics",
    topic: "Fractions",
    question: "What is 1/2 + 1/4?",
    options: ["2/6", "3/4", "1/8", "1/6"],
    correct: "3/4",
    explanation: "Convert 1/2 to 2/4, then add 2/4 + 1/4 = 3/4."
  },
  {
    id: "math-fractions-2",
    subject: "Mathematics",
    topic: "Fractions",
    question: "Which fraction is equal to 0.5?",
    options: ["1/5", "1/2", "2/5", "5/1"],
    correct: "1/2",
    explanation: "0.5 means half, so it is equal to 1/2."
  },
  {
    id: "math-algebra-1",
    subject: "Mathematics",
    topic: "Algebra",
    question: "If x + 7 = 12, what is x?",
    options: ["3", "4", "5", "6"],
    correct: "5",
    explanation: "Subtract 7 from both sides: x = 12 - 7 = 5."
  },
  {
    id: "math-algebra-2",
    subject: "Mathematics",
    topic: "Algebra",
    question: "Simplify: 3a + 2a",
    options: ["5a", "6a", "a", "5"],
    correct: "5a",
    explanation: "Like terms can be added: 3a + 2a = 5a."
  },
  {
    id: "math-geometry-1",
    subject: "Mathematics",
    topic: "Geometry",
    question: "How many degrees are in a right angle?",
    options: ["45", "60", "90", "180"],
    correct: "90",
    explanation: "A right angle measures exactly 90 degrees."
  },
  {
    id: "science-electricity-1",
    subject: "Science",
    topic: "Electricity",
    question: "Which material is a good conductor of electricity?",
    options: ["Rubber", "Plastic", "Copper", "Wood"],
    correct: "Copper",
    explanation: "Copper lets electric current pass through it easily."
  },
  {
    id: "science-electricity-2",
    subject: "Science",
    topic: "Electricity",
    question: "What does a switch do in a circuit?",
    options: ["Stores charge", "Opens or closes the circuit", "Makes water", "Changes color"],
    correct: "Opens or closes the circuit",
    explanation: "A switch controls whether current can flow through the circuit."
  },
  {
    id: "science-plants-1",
    subject: "Science",
    topic: "Plants",
    question: "Which part of a plant absorbs water from soil?",
    options: ["Leaf", "Root", "Flower", "Fruit"],
    correct: "Root",
    explanation: "Roots absorb water and minerals from the soil."
  },
  {
    id: "science-forces-1",
    subject: "Science",
    topic: "Forces",
    question: "A push or pull on an object is called a...",
    options: ["Force", "Light", "Sound", "Heat"],
    correct: "Force",
    explanation: "Force is a push or pull that can change motion."
  },
  {
    id: "science-forces-2",
    subject: "Science",
    topic: "Forces",
    question: "Which force pulls objects toward Earth?",
    options: ["Friction", "Gravity", "Magnetism", "Pressure"],
    correct: "Gravity",
    explanation: "Gravity pulls objects toward the Earth."
  },
  {
    id: "english-grammar-1",
    subject: "English",
    topic: "Grammar",
    question: "Choose the correct sentence.",
    options: ["She go to school.", "She goes to school.", "She going school.", "She gone school."],
    correct: "She goes to school.",
    explanation: "For he/she/it in simple present tense, we usually add s or es to the verb."
  },
  {
    id: "english-grammar-2",
    subject: "English",
    topic: "Grammar",
    question: "Which word is an adjective?",
    options: ["Run", "Beautiful", "Quickly", "Table"],
    correct: "Beautiful",
    explanation: "An adjective describes a noun. Beautiful describes a person or thing."
  },
  {
    id: "english-reading-1",
    subject: "English",
    topic: "Reading",
    question: "What is the main idea of a paragraph?",
    options: ["A small spelling mistake", "The central point", "Only the last word", "A punctuation mark"],
    correct: "The central point",
    explanation: "The main idea is the central point the paragraph is about."
  },
  {
    id: "english-vocabulary-1",
    subject: "English",
    topic: "Vocabulary",
    question: "Which word means the opposite of 'brave'?",
    options: ["Fearful", "Strong", "Happy", "Fast"],
    correct: "Fearful",
    explanation: "Fearful is close to the opposite of brave."
  },
  {
    id: "english-vocabulary-2",
    subject: "English",
    topic: "Vocabulary",
    question: "What does 'improve' mean?",
    options: ["Make worse", "Make better", "Forget", "Stop"],
    correct: "Make better",
    explanation: "To improve means to make something better."
  }
];

function percent(correct: number, total: number) {
  if (!total) return 0;
  return Math.round((correct / total) * 100);
}

function scoreQuestions(questions: GapQuestion[], answers: AnswerMap) {
  const bySubject = new Map<SubjectName, { correct: number; total: number }>();
  const byTopic = new Map<string, { subject: SubjectName; correct: number; total: number }>();

  questions.forEach((question) => {
    const isCorrect = answers[question.id] === question.correct;
    const subjectScore = bySubject.get(question.subject) || { correct: 0, total: 0 };
    subjectScore.total += 1;
    if (isCorrect) subjectScore.correct += 1;
    bySubject.set(question.subject, subjectScore);

    const topicKey = `${question.subject}:${question.topic}`;
    const topicScore = byTopic.get(topicKey) || { subject: question.subject, correct: 0, total: 0 };
    topicScore.total += 1;
    if (isCorrect) topicScore.correct += 1;
    byTopic.set(topicKey, topicScore);
  });

  const subjectRows: ScoreRow[] = Array.from(bySubject.entries()).map(([subject, row]) => ({
    key: subject,
    label: subject,
    correct: row.correct,
    total: row.total,
    percent: percent(row.correct, row.total)
  }));

  const topicRows: ScoreRow[] = Array.from(byTopic.entries()).map(([key, row]) => ({
    key,
    label: key.split(":")[1],
    subject: row.subject,
    correct: row.correct,
    total: row.total,
    percent: percent(row.correct, row.total)
  }));

  return { subjectRows, topicRows };
}

function praiseForScore(score: number) {
  if (score >= 85) return "Excellent work. Keep it up.";
  if (score >= 70) return "Great effort. You are on track.";
  if (score >= 55) return "Good start. Your focus plan will help.";
  return "Good attempt. Let us strengthen the basics.";
}

function buildLocalReport(questions: GapQuestion[], answers: AnswerMap): GapReport {
  const totalCorrect = questions.reduce((sum, question) => sum + (answers[question.id] === question.correct ? 1 : 0), 0);
  const overallScore = percent(totalCorrect, questions.length);
  const { subjectRows, topicRows } = scoreQuestions(questions, answers);
  const weakRows = topicRows.filter((row) => row.percent < 60).sort((a, b) => a.percent - b.percent);
  const strengthRows = topicRows.filter((row) => row.percent >= 80).sort((a, b) => b.percent - a.percent);
  const averageRows = topicRows.filter((row) => row.percent >= 60 && row.percent < 80).sort((a, b) => a.percent - b.percent);
  const focusRows = weakRows.length ? weakRows.slice(0, 2) : averageRows.slice(0, 2);
  const focusLabel = focusRows.map((item) => item.label).join(" and ") || "your next weak topic";

  return {
    overallScore,
    completedQuestions: questions.length,
    totalCorrect,
    subjectRows,
    topicRows,
    weakRows,
    averageRows,
    strengthRows,
    focusRows,
    praise: praiseForScore(overallScore),
    focusPlan: {
      title: "Your Focus Plan",
      topics: focusRows.map((item) => item.label),
      description: `Focus on ${focusLabel} this week. Practice 5-10 questions daily and aim to improve by 10%.`,
      dailyPractice: "Practice 5-10 short questions daily.",
      improvementTarget: "Improve by 10% in the next report.",
      steps: ["Revise the concept for 15 minutes.", "Attempt one short practice quiz.", "Review every wrong answer."]
    }
  };
}

function barColor(value: number) {
  if (value < 60) return "#EF4444";
  if (value < 80) return "#F59E0B";
  return "#12B76A";
}

function buildLocalStudyPlan(subject: SubjectName, topic: string): StudyPlan {
  const topics = [topic, "Previous Basics", "Practice Questions", "Mistake Review", "Final Revision"];
  const weeks = topics.map((item, index) => ({
    week: `Week ${index + 1}`,
    title: item,
    status: index === 0 ? "active" as const : "locked" as const,
    progress: index === 0 ? 25 : 0,
    focus: index === 0 ? "Build basics, practice, and take a quick diagnostic quiz." : "Unlocks after the previous topic improves.",
    tasks: [
      { id: `w${index}-read`, type: "Read", title: `Read: ${item}`, duration: "15 min", completed: index === 0 },
      { id: `w${index}-practice`, type: "Practice", title: "Practice: 10 Questions", duration: "15 min", completed: false },
      { id: `w${index}-quiz`, type: "Quiz", title: "Quick Quiz", duration: "10 min", completed: false }
    ]
  }));
  return {
    title: `${subject} Smart Plan`,
    subject,
    topic,
    summary: `Start with ${topic}, complete short daily tasks, then let ORIN update your next focus from quiz performance.`,
    overallProgress: 25,
    weeks,
    dailyTasks: weeks[0].tasks,
    adaptiveRules: ["Low score repeats basics.", "Medium score adds mixed practice.", "High score unlocks the next topic."]
  };
}

export default function HighSchoolSubjectGapScreen() {
  const router = useRouter();
  const { colors, isDark } = useAppTheme();
  const { className } = useLearner();
  const [activeQuestions, setActiveQuestions] = useState<GapQuestion[]>(FALLBACK_QUESTIONS);
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showReport, setShowReport] = useState(false);
  const [infoVisible, setInfoVisible] = useState(false);
  const [practiceTopic, setPracticeTopic] = useState<string | null>(null);
  const [report, setReport] = useState<GapReport>(() => buildLocalReport(FALLBACK_QUESTIONS, {}));
  const [quizSource, setQuizSource] = useState<"ai" | "fallback">("fallback");
  const [loadingQuiz, setLoadingQuiz] = useState(false);
  const [loadingReport, setLoadingReport] = useState(false);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [quizStarted, setQuizStarted] = useState(false);
  const [planCreated, setPlanCreated] = useState(false);
  const [studyPlan, setStudyPlan] = useState<StudyPlan>(() => buildLocalStudyPlan("Mathematics", "Algebra"));
  const [selectedSubject, setSelectedSubject] = useState<SubjectName>("Mathematics");
  const [selectedTopic, setSelectedTopic] = useState("Algebra");
  const [studyGoal, setStudyGoal] = useState("Improve marks and complete weekly revision");
  const [currentLevel, setCurrentLevel] = useState("Basics");
  const [timePerDay, setTimePerDay] = useState("1-2 hours");

  const currentQuestion = activeQuestions[currentIndex];
  const progress = activeQuestions.length ? Math.round(((currentIndex + 1) / activeQuestions.length) * 100) : 0;
  const availableTopics = SUBJECT_TOPICS[selectedSubject] || [];

  const localReport = useMemo(() => buildLocalReport(activeQuestions, answers), [activeQuestions, answers]);
  const displayedReport = showReport ? report : localReport;
  const { overallScore, subjectRows, weakRows, strengthRows, averageRows } = displayedReport;

  async function createStudyPlan() {
    setLoadingPlan(true);
    setStatusMessage("");
    const fallbackPlan = buildLocalStudyPlan(selectedSubject, selectedTopic);
    try {
      const { data } = await api.post<{ source?: "ai" | "fallback"; plan?: StudyPlan }>("/api/ai/highschool/subject-gap/plan", {
        subject: selectedSubject,
        topic: selectedTopic,
        studyGoal,
        currentLevel,
        timePerDay,
        classLevel: className || "High School"
      });
      setStudyPlan(data?.plan || fallbackPlan);
      setPlanCreated(true);
      setStatusMessage(data?.source === "ai" ? "AI created your adaptive subject plan." : "Using a safe subject plan until AI is available.");
    } catch (error) {
      setStudyPlan(fallbackPlan);
      setPlanCreated(true);
      setStatusMessage(getAppErrorMessage(error, "AI plan is unavailable, so ORIN loaded a safe subject plan."));
    } finally {
      setLoadingPlan(false);
    }
  }

  async function loadQuiz(subject: SubjectName = selectedSubject, focusTopic: string | null = selectedTopic) {
    setLoadingQuiz(true);
    setStatusMessage("");
    setQuizStarted(true);
    try {
      const { data } = await api.post<{
        source?: "ai" | "fallback";
        quiz?: { questions?: GapQuestion[] };
      }>("/api/ai/highschool/subject-gap/quiz", {
        subjects: [subject],
        questionCount: focusTopic ? 5 : 9,
        classLevel: className || "High School",
        focusTopic: focusTopic || undefined
      });
      const nextQuestions = Array.isArray(data?.quiz?.questions) && data.quiz.questions.length ? data.quiz.questions : FALLBACK_QUESTIONS;
      setActiveQuestions(nextQuestions);
      setQuizSource(data?.source === "ai" ? "ai" : "fallback");
      setStatusMessage(data?.source === "ai" ? "AI created this quiz from high-school subject intelligence." : "Using safe offline questions until AI is available.");
    } catch (error) {
      const fallback = focusTopic
        ? FALLBACK_QUESTIONS.filter((question) => question.subject === subject && question.topic === focusTopic)
        : FALLBACK_QUESTIONS.filter((question) => question.subject === subject);
      setActiveQuestions(fallback.length ? fallback : FALLBACK_QUESTIONS);
      setQuizSource("fallback");
      setStatusMessage(getAppErrorMessage(error, "AI quiz is unavailable, so ORIN loaded safe offline questions."));
    } finally {
      setAnswers({});
      setCurrentIndex(0);
      setShowReport(false);
      setLoadingQuiz(false);
    }
  }

  async function buildAiReport() {
    setLoadingReport(true);
    setStatusMessage("");
    const fallbackReport = buildLocalReport(activeQuestions, answers);
    try {
      const { data } = await api.post<{ source?: "ai" | "fallback"; report?: GapReport }>("/api/ai/highschool/subject-gap/analyze", {
        questions: activeQuestions,
        answers
      });
      setReport(data?.report || fallbackReport);
      setStatusMessage(data?.source === "ai" ? "AI converted your real quiz data into a focus plan." : "Report is calculated from your real answers with safe local planning.");
    } catch (error) {
      setReport(fallbackReport);
      setStatusMessage(getAppErrorMessage(error, "Report is calculated locally from your real answers."));
    } finally {
      setLoadingReport(false);
      setShowReport(true);
    }
  }

  function selectAnswer(option: string) {
    if (!currentQuestion || answers[currentQuestion.id]) return;
    setAnswers((prev) => ({ ...prev, [currentQuestion.id]: option }));
  }

  async function nextQuestion() {
    if (currentIndex < activeQuestions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      return;
    }
    await buildAiReport();
  }

  function startPractice() {
    const nextTopic =
      displayedReport.focusRows[0]?.label ||
      displayedReport.weakRows[0]?.label ||
      displayedReport.topicRows[0]?.label ||
      null;
    if (!nextTopic) return;
    const nextSubject = (displayedReport.focusRows[0]?.subject || selectedSubject) as SubjectName;
    setSelectedSubject(nextSubject);
    setSelectedTopic(nextTopic);
    setPracticeTopic(nextTopic);
    loadQuiz(nextSubject, nextTopic);
  }

  function resetFullQuiz() {
    setPracticeTopic(null);
    setQuizStarted(false);
    setPlanCreated(false);
    setShowReport(false);
    setAnswers({});
    setCurrentIndex(0);
    setStatusMessage("");
  }

  const selected = currentQuestion ? answers[currentQuestion.id] : "";

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.topBar, { backgroundColor: colors.background }]}>
        <TouchableOpacity style={styles.topIconBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.topTitle, { color: colors.text }]}>Subject Gap Analyzer</Text>
        <TouchableOpacity style={styles.topIconBtn} onPress={() => setInfoVisible(true)}>
          <Ionicons name="information-circle-outline" size={25} color={colors.accent} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {statusMessage ? (
          <View style={[styles.aiNotice, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name={quizSource === "ai" ? "sparkles" : "shield-checkmark"} size={18} color={colors.accent} />
            <Text style={[styles.aiNoticeText, { color: colors.textMuted }]}>{statusMessage}</Text>
          </View>
        ) : null}

        {!quizStarted && !planCreated ? (
          <View style={[styles.setupCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.eyebrow, { color: colors.accent }]}>1. Plan Creation</Text>
            <Text style={[styles.heroTitle, { color: colors.text }]}>Create Study Plan</Text>
            <Text style={[styles.heroSubtitle, { color: colors.textMuted }]}>
              Select your subject, topic, goal, level, and study time. ORIN builds a smart weekly plan first.
            </Text>

            <Text style={[styles.setupLabel, { color: colors.text }]}>Subject</Text>
            <View style={styles.selectorGrid}>
              {(Object.keys(SUBJECT_TOPICS) as SubjectName[]).map((subject) => {
                const active = selectedSubject === subject;
                const meta = SUBJECT_META[subject];
                return (
                  <TouchableOpacity
                    key={subject}
                    style={[styles.selectorTile, { backgroundColor: active ? meta.bg : colors.surfaceAlt, borderColor: active ? meta.color : colors.border }]}
                    onPress={() => {
                      setSelectedSubject(subject);
                      setSelectedTopic(SUBJECT_TOPICS[subject][0]);
                      setStudyPlan(buildLocalStudyPlan(subject, SUBJECT_TOPICS[subject][0]));
                    }}
                  >
                    <Ionicons name={meta.icon} size={20} color={active ? meta.color : colors.textMuted} />
                    <Text style={[styles.selectorText, { color: active ? meta.color : colors.text }]}>{subject}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[styles.setupLabel, { color: colors.text }]}>Topic</Text>
            <View style={styles.topicWrap}>
              {availableTopics.map((topic) => {
                const active = selectedTopic === topic;
                return (
                  <TouchableOpacity
                    key={topic}
                    style={[styles.topicChip, { backgroundColor: active ? colors.accentSoft : colors.surfaceAlt, borderColor: active ? colors.accent : colors.border }]}
                    onPress={() => setSelectedTopic(topic)}
                  >
                    <Text style={[styles.topicChipText, { color: active ? colors.accent : colors.textMuted }]}>{topic}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[styles.setupLabel, { color: colors.text }]}>Study Goal</Text>
            <View style={styles.topicWrap}>
              {["Improve marks and complete weekly revision", "Prepare for unit test", "Fix weak basics"].map((goal) => {
                const active = studyGoal === goal;
                return (
                  <TouchableOpacity
                    key={goal}
                    style={[styles.topicChip, { backgroundColor: active ? colors.accentSoft : colors.surfaceAlt, borderColor: active ? colors.accent : colors.border }]}
                    onPress={() => setStudyGoal(goal)}
                  >
                    <Text style={[styles.topicChipText, { color: active ? colors.accent : colors.textMuted }]}>{goal}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[styles.setupLabel, { color: colors.text }]}>Current Level</Text>
            <View style={styles.segmentRow}>
              {["Basics", "Average", "Strong"].map((level) => {
                const active = currentLevel === level;
                return (
                  <TouchableOpacity
                    key={level}
                    style={[styles.segmentButton, { backgroundColor: active ? colors.accent : colors.surfaceAlt, borderColor: active ? colors.accent : colors.border }]}
                    onPress={() => setCurrentLevel(level)}
                  >
                    <Text style={[styles.segmentText, { color: active ? colors.accentText : colors.textMuted }]}>{level}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[styles.setupLabel, { color: colors.text }]}>Available Time per Day</Text>
            <View style={styles.segmentRow}>
              {["30-45 min", "1-2 hours", "2+ hours"].map((time) => {
                const active = timePerDay === time;
                return (
                  <TouchableOpacity
                    key={time}
                    style={[styles.segmentButton, { backgroundColor: active ? colors.accent : colors.surfaceAlt, borderColor: active ? colors.accent : colors.border }]}
                    onPress={() => setTimePerDay(time)}
                  >
                    <Text style={[styles.segmentText, { color: active ? colors.accentText : colors.textMuted }]}>{time}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity style={[styles.primaryButton, { backgroundColor: colors.accent }]} onPress={() => {
              setPracticeTopic(selectedTopic);
              createStudyPlan();
            }} disabled={loadingPlan}>
              {loadingPlan ? <ActivityIndicator color={colors.accentText} /> : <Ionicons name="sparkles" size={18} color={colors.accentText} />}
              <Text style={[styles.primaryButtonText, { color: colors.accentText }]}>{loadingPlan ? "Creating Smart Plan..." : "Create Study Plan"}</Text>
            </TouchableOpacity>
          </View>
        ) : !quizStarted && planCreated ? (
          <>
            <View style={[styles.quizHero, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.quizHeroTop}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.eyebrow, { color: colors.accent }]}>2. Smart Plan</Text>
                  <Text style={[styles.heroTitle, { color: colors.text }]}>{studyPlan.title}</Text>
                  <Text style={[styles.heroSubtitle, { color: colors.textMuted }]}>{studyPlan.summary}</Text>
                </View>
                <View style={[styles.progressRing, { borderColor: colors.accentSoft }]}>
                  <Text style={[styles.progressRingText, { color: colors.accent }]}>{studyPlan.overallProgress}%</Text>
                </View>
              </View>
              <View style={[styles.track, { backgroundColor: colors.surfaceAlt }]}>
                <View style={[styles.trackFill, { width: `${studyPlan.overallProgress}%`, backgroundColor: colors.accent }]} />
              </View>
            </View>

            <View style={[styles.reportCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <SectionHeader icon="calendar" title="Week View" color="#12B76A" />
              {studyPlan.weeks.map((week) => (
                <StudyWeekRow key={`${week.week}-${week.title}`} week={week} colors={colors} />
              ))}
            </View>

            <View style={[styles.reportCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <SectionHeader icon="checkbox" title="Daily Tasks" color="#0EA5E9" />
              {studyPlan.dailyTasks.map((task) => (
                <TaskRow key={task.id} task={task} colors={colors} />
              ))}
            </View>

            <TouchableOpacity style={[styles.primaryButton, { backgroundColor: colors.accent }]} onPress={() => {
              setPracticeTopic(selectedTopic);
              loadQuiz(selectedSubject, selectedTopic);
            }}>
              <Text style={[styles.primaryButtonText, { color: colors.accentText }]}>Start Quick Quiz</Text>
              <Ionicons name="arrow-forward" size={18} color={colors.accentText} />
            </TouchableOpacity>

            <TouchableOpacity style={[styles.secondaryButton, { borderColor: colors.border }]} onPress={() => setPlanCreated(false)}>
              <Text style={[styles.secondaryButtonText, { color: colors.text }]}>Edit Plan Setup</Text>
            </TouchableOpacity>
          </>
        ) : loadingQuiz ? (
          <View style={[styles.loadingCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <ActivityIndicator color={colors.accent} />
            <Text style={[styles.loadingTitle, { color: colors.text }]}>Building your AI quiz...</Text>
            <Text style={[styles.loadingText, { color: colors.textMuted }]}>ORIN is preparing subject and topic mapped questions for high school.</Text>
          </View>
        ) : !showReport && currentQuestion ? (
          <>
            <View style={[styles.quizHero, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.quizHeroTop}>
                <View>
                  <Text style={[styles.eyebrow, { color: colors.accent }]}>
                    {practiceTopic ? "Focused Practice" : quizSource === "ai" ? "AI Smart Quiz" : "Safe Practice Quiz"}
                  </Text>
                  <Text style={[styles.heroTitle, { color: colors.text }]}>Answer short subject questions</Text>
                  <Text style={[styles.heroSubtitle, { color: colors.textMuted }]}>
                    Each question is mapped to a subject and topic. ORIN calculates your gaps from real answers.
                  </Text>
                </View>
                <View style={[styles.progressRing, { borderColor: colors.accentSoft }]}>
                  <Text style={[styles.progressRingText, { color: colors.accent }]}>{progress}%</Text>
                </View>
              </View>
              <View style={[styles.track, { backgroundColor: colors.surfaceAlt }]}>
                <View style={[styles.trackFill, { width: `${progress}%`, backgroundColor: colors.accent }]} />
              </View>
            </View>

            <View style={[styles.questionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.questionMetaRow}>
                <Text style={[styles.questionMeta, { color: colors.accent }]}>Question {currentIndex + 1}/{activeQuestions.length}</Text>
                <Text style={[styles.questionChip, { color: colors.textMuted, borderColor: colors.border }]}>{currentQuestion.subject} - {currentQuestion.topic}</Text>
              </View>
              <Text style={[styles.questionText, { color: colors.text }]}>{currentQuestion.question}</Text>

              <View style={styles.optionWrap}>
                {currentQuestion.options.map((option) => {
                  const isSelected = selected === option;
                  const isCorrect = selected && option === currentQuestion.correct;
                  const isWrong = isSelected && option !== currentQuestion.correct;
                  return (
                    <TouchableOpacity
                      key={option}
                      activeOpacity={0.88}
                      style={[
                        styles.optionCard,
                        { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
                        isCorrect && styles.optionCorrect,
                        isWrong && styles.optionWrong
                      ]}
                      onPress={() => selectAnswer(option)}
                    >
                      <Text style={[styles.optionText, { color: colors.text }]}>{option}</Text>
                      {isCorrect ? <Ionicons name="checkmark-circle" size={19} color="#12B76A" /> : null}
                      {isWrong ? <Ionicons name="close-circle" size={19} color="#EF4444" /> : null}
                    </TouchableOpacity>
                  );
                })}
              </View>

              {selected ? (
                <View style={[styles.feedbackBox, { backgroundColor: selected === currentQuestion.correct ? "#ECFDF3" : "#FEF2F2" }]}>
                  <Text style={[styles.feedbackTitle, { color: selected === currentQuestion.correct ? "#027A48" : "#B42318" }]}>
                    {selected === currentQuestion.correct ? "Correct" : `Correct answer: ${currentQuestion.correct}`}
                  </Text>
                  <Text style={styles.feedbackText}>{currentQuestion.explanation}</Text>
                </View>
              ) : null}

              <TouchableOpacity
                disabled={!selected || loadingReport}
                style={[styles.primaryButton, { backgroundColor: selected ? colors.accent : colors.surfaceAlt }, (!selected || loadingReport) && styles.disabled]}
                onPress={nextQuestion}
              >
                {loadingReport ? <ActivityIndicator color={colors.accentText} /> : null}
                <Text style={[styles.primaryButtonText, { color: selected ? colors.accentText : colors.textMuted }]}>
                  {loadingReport ? "Analyzing..." : currentIndex === activeQuestions.length - 1 ? "Show Learning Report" : "Next Question"}
                </Text>
                <Ionicons name="arrow-forward" size={18} color={selected ? colors.accentText : colors.textMuted} />
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <>
            <View style={[styles.resultHero, { backgroundColor: isDark ? "rgba(18,183,106,0.12)" : "#F0FDF4", borderColor: colors.border }]}>
              <View style={[styles.medal, { backgroundColor: "#FEF3C7" }]}>
                <Ionicons name="medal" size={28} color="#F59E0B" />
              </View>
              <View style={styles.resultHeroCopy}>
                <Text style={[styles.resultHeroTitle, { color: colors.text }]}>{displayedReport.praise}</Text>
                <Text style={[styles.resultHeroMeta, { color: colors.textMuted }]}>You completed {displayedReport.completedQuestions} questions</Text>
              </View>
              <View style={[styles.scoreCircle, { borderColor: barColor(overallScore) }]}>
                <Text style={[styles.scoreValue, { color: colors.text }]}>{overallScore}%</Text>
                <Text style={[styles.scoreLabel, { color: colors.textMuted }]}>Overall</Text>
              </View>
            </View>

            <View style={[styles.reportCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <SectionHeader icon="stats-chart" title="Overall Performance by Subject" color="#12B76A" />
              {subjectRows.map((row) => {
                const meta = SUBJECT_META[row.label as SubjectName];
                return (
                  <ScoreBar
                    key={row.key}
                    label={row.label}
                    percentValue={row.percent}
                    helper={`${row.correct} / ${row.total} correct`}
                    icon={meta.icon}
                    iconColor={meta.color}
                    iconBg={meta.bg}
                  />
                );
              })}
            </View>

            <View style={[styles.reportCard, styles.weakCard, { borderColor: isDark ? "rgba(239,68,68,0.45)" : "#FECACA" }]}>
              <SectionHeader icon="trending-down" title="Weak Areas (Needs Improvement)" color="#EF4444" />
              {(weakRows.length ? weakRows : averageRows.slice(0, 2)).map((row) => (
                <ScoreBar
                  key={row.key}
                  label={row.label}
                  percentValue={row.percent}
                  helper={`${row.correct} / ${row.total} correct`}
                  icon={row.label === "Grammar" ? "text" : row.label === "Algebra" ? "close-circle" : "remove-circle"}
                  iconColor="#EF4444"
                  iconBg="#FEE2E2"
                />
              ))}
            </View>

            <View style={[styles.reportCard, styles.strongCard, { borderColor: isDark ? "rgba(18,183,106,0.45)" : "#BBF7D0" }]}>
              <SectionHeader icon="sparkles" title="Strengths (Keep it up)" color="#12B76A" />
              {(strengthRows.length ? strengthRows : subjectRows.filter((row) => row.percent >= 70)).map((row) => (
                <ScoreBar
                  key={row.key}
                  label={row.label}
                  percentValue={row.percent}
                  helper={`${row.correct} / ${row.total} correct`}
                  icon="checkmark-circle"
                  iconColor="#12B76A"
                  iconBg="#DCFCE7"
                />
              ))}
            </View>

            <View style={[styles.focusCard, { backgroundColor: isDark ? "rgba(124,58,237,0.14)" : "#F5F3FF", borderColor: isDark ? "rgba(167,139,250,0.45)" : "#DDD6FE" }]}>
              <View style={styles.focusTop}>
                <View style={[styles.focusIcon, { backgroundColor: "#FEE2E2" }]}>
                  <Ionicons name="locate" size={24} color="#EF4444" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.focusTitle, { color: colors.text }]}>{displayedReport.focusPlan.title || "Your Focus Plan"}</Text>
                  <Text style={[styles.focusText, { color: colors.textMuted }]}>{displayedReport.focusPlan.description}</Text>
                  {displayedReport.focusPlan.dailyPractice ? (
                    <Text style={[styles.focusMeta, { color: colors.textMuted }]}>{displayedReport.focusPlan.dailyPractice}</Text>
                  ) : null}
                </View>
                <Ionicons name="clipboard" size={36} color="#8B5CF6" />
              </View>
              <TouchableOpacity style={[styles.primaryButton, { backgroundColor: colors.accent }]} onPress={startPractice}>
                <Text style={[styles.primaryButtonText, { color: colors.accentText }]}>Start Practice Now</Text>
                <Ionicons name="arrow-forward" size={18} color={colors.accentText} />
              </TouchableOpacity>
              <TouchableOpacity style={[styles.secondaryButton, { borderColor: colors.border }]} onPress={resetFullQuiz}>
                <Text style={[styles.secondaryButtonText, { color: colors.text }]}>Choose Another Topic</Text>
              </TouchableOpacity>
            </View>

            <View style={[styles.reportCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <SectionHeader icon="git-branch" title="Adaptive Plan Update" color="#7C3AED" />
              <View style={[styles.adaptiveFocus, { backgroundColor: isDark ? "rgba(18,183,106,0.12)" : "#ECFDF3" }]}>
                <Text style={[styles.adaptiveLabel, { color: colors.textMuted }]}>New Focus</Text>
                <Text style={[styles.adaptiveTitle, { color: colors.text }]}>
                  {displayedReport.focusPlan.topics[0] || displayedReport.focusRows[0]?.label || selectedTopic}
                </Text>
                <Text style={[styles.adaptiveText, { color: colors.textMuted }]}>
                  Added to your plan because ORIN found it from your quiz performance.
                </Text>
              </View>
              {studyPlan.weeks.slice(0, 4).map((week, index) => (
                <StudyWeekRow
                  key={`adaptive-${week.week}-${week.title}`}
                  week={{
                    ...week,
                    status: index === 0 ? "completed" : index === 1 ? "active" : week.status,
                    title: index === 1 ? (displayedReport.focusPlan.topics[0] || week.title) : week.title
                  }}
                  colors={colors}
                />
              ))}
            </View>
          </>
        )}

        <View style={[styles.tipCard, { backgroundColor: isDark ? "rgba(245,158,11,0.12)" : "#FFFBEB", borderColor: "#FDE68A" }]}>
          <Ionicons name="bulb" size={22} color="#F59E0B" />
          <Text style={[styles.tipText, { color: colors.text }]}>
            Tip: Keep quizzes short, get instant feedback, and retake practice after every report to see improvement over time.
          </Text>
        </View>
      </ScrollView>

      <Modal visible={infoVisible} transparent animationType="slide" onRequestClose={() => setInfoVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.infoSheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.infoHeader}>
              <Text style={[styles.infoTitle, { color: colors.text }]}>How it Works</Text>
              <TouchableOpacity onPress={() => setInfoVisible(false)}>
                <Ionicons name="close" size={24} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            {[
              ["Take Quiz", "Attempt mapped questions from school subjects."],
              ["Analyze Performance", "ORIN calculates accuracy for every topic and subject."],
              ["Detect Weak Areas", "Topics below 60% are marked red for focus."],
              ["Show Report", "Green means strong, red means needs improvement."],
              ["Get Action Plan", "You get top focus topics and recommended practice."]
            ].map((item, index) => (
              <View key={item[0]} style={styles.infoStep}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>{index + 1}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.stepTitle, { color: colors.text }]}>{item[0]}</Text>
                  <Text style={[styles.stepBody, { color: colors.textMuted }]}>{item[1]}</Text>
                </View>
              </View>
            ))}
            <TouchableOpacity style={[styles.primaryButton, { backgroundColor: colors.accent }]} onPress={() => setInfoVisible(false)}>
              <Text style={[styles.primaryButtonText, { color: colors.accentText }]}>Got it</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function SectionHeader({ icon, title, color }: { icon: keyof typeof Ionicons.glyphMap; title: string; color: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Ionicons name={icon} size={18} color={color} />
      <Text style={[styles.sectionHeaderText, { color }]}>{title}</Text>
    </View>
  );
}

function ScoreBar({
  label,
  percentValue,
  helper,
  icon,
  iconColor,
  iconBg
}: {
  label: string;
  percentValue: number;
  helper: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  iconBg: string;
}) {
  return (
    <View style={styles.scoreRow}>
      <View style={[styles.scoreIcon, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={22} color={iconColor} />
      </View>
      <View style={styles.scoreMid}>
        <View style={styles.scoreTopLine}>
          <Text style={styles.scoreName}>{label}</Text>
          <Text style={[styles.scorePercent, { color: barColor(percentValue) }]}>{percentValue}%</Text>
        </View>
        <View style={styles.scoreTrack}>
          <View style={[styles.scoreFill, { width: `${Math.max(4, percentValue)}%`, backgroundColor: barColor(percentValue) }]} />
        </View>
        <Text style={styles.scoreHelper}>{helper}</Text>
      </View>
    </View>
  );
}

function StudyWeekRow({ week, colors }: { week: StudyWeek; colors: { text: string; textMuted: string; accent: string; surfaceAlt: string; border: string } }) {
  const statusColor = week.status === "completed" ? "#12B76A" : week.status === "active" ? "#0EA5E9" : "#98A2B3";
  return (
    <View style={[styles.weekRow, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}>
      <View style={styles.weekTop}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.weekLabel, { color: colors.textMuted }]}>{week.week}</Text>
          <Text style={[styles.weekTitle, { color: colors.text }]}>{week.title}</Text>
          <Text style={[styles.weekFocus, { color: colors.textMuted }]}>{week.focus}</Text>
        </View>
        <View style={[styles.statusPill, { backgroundColor: `${statusColor}22` }]}>
          <Text style={[styles.statusText, { color: statusColor }]}>{week.status}</Text>
        </View>
      </View>
      <View style={[styles.scoreTrack, { backgroundColor: "#E5E7EB" }]}>
        <View style={[styles.scoreFill, { width: `${Math.max(4, week.progress)}%`, backgroundColor: statusColor }]} />
      </View>
    </View>
  );
}

function TaskRow({ task, colors }: { task: StudyTask; colors: { text: string; textMuted: string; accent: string; surfaceAlt: string; border: string } }) {
  const icon = (task.type.toLowerCase().includes("quiz") ? "help-circle" : task.type.toLowerCase().includes("practice") ? "create" : "book") as keyof typeof Ionicons.glyphMap;
  return (
    <View style={[styles.taskRow, { borderColor: colors.border }]}>
      <View style={[styles.taskIcon, { backgroundColor: task.completed ? "#DCFCE7" : colors.surfaceAlt }]}>
        <Ionicons name={task.completed ? "checkmark-circle" : icon} size={18} color={task.completed ? "#12B76A" : colors.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.taskTitle, { color: colors.text }]}>{task.title}</Text>
        <Text style={[styles.taskMeta, { color: colors.textMuted }]}>{task.duration}</Text>
      </View>
      <Ionicons name={task.completed ? "checkmark-circle" : "ellipse-outline"} size={20} color={task.completed ? "#12B76A" : colors.textMuted} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: {
    minHeight: 58,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  topIconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  topTitle: { fontSize: 18, fontWeight: "900" },
  container: { padding: 16, paddingBottom: 118, gap: 14 },
  aiNotice: { borderWidth: 1, borderRadius: 18, padding: 12, flexDirection: "row", gap: 9, alignItems: "flex-start" },
  aiNoticeText: { flex: 1, fontSize: 12, lineHeight: 18, fontWeight: "800" },
  loadingCard: { borderWidth: 1, borderRadius: 24, padding: 24, alignItems: "center", gap: 10 },
  loadingTitle: { fontSize: 18, fontWeight: "900" },
  loadingText: { textAlign: "center", lineHeight: 20, fontWeight: "700" },
  setupCard: { borderWidth: 1, borderRadius: 26, padding: 17, gap: 14 },
  setupLabel: { fontSize: 14, fontWeight: "900", marginTop: 4 },
  selectorGrid: { flexDirection: "row", gap: 10 },
  selectorTile: { flex: 1, minHeight: 82, borderWidth: 1, borderRadius: 18, alignItems: "center", justifyContent: "center", gap: 7, padding: 10 },
  selectorText: { fontWeight: "900", fontSize: 12, textAlign: "center" },
  topicWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  topicChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  topicChipText: { fontWeight: "900" },
  segmentRow: { flexDirection: "row", gap: 8 },
  segmentButton: { flex: 1, minHeight: 42, borderWidth: 1, borderRadius: 999, alignItems: "center", justifyContent: "center", paddingHorizontal: 8 },
  segmentText: { fontWeight: "900", fontSize: 12, textAlign: "center" },
  quizHero: { borderWidth: 1, borderRadius: 26, padding: 17, gap: 14 },
  quizHeroTop: { flexDirection: "row", gap: 12, alignItems: "center", justifyContent: "space-between" },
  eyebrow: { fontSize: 11, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.8 },
  heroTitle: { fontSize: 24, lineHeight: 30, fontWeight: "900", marginTop: 4 },
  heroSubtitle: { fontSize: 14, lineHeight: 21, fontWeight: "600", marginTop: 5 },
  progressRing: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 8,
    alignItems: "center",
    justifyContent: "center"
  },
  progressRingText: { fontSize: 16, fontWeight: "900" },
  track: { height: 10, borderRadius: 999, overflow: "hidden" },
  trackFill: { height: "100%", borderRadius: 999 },
  questionCard: { borderWidth: 1, borderRadius: 24, padding: 16, gap: 14 },
  questionMetaRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  questionMeta: { fontWeight: "900" },
  questionChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, fontSize: 11, fontWeight: "800" },
  questionText: { fontSize: 20, lineHeight: 28, fontWeight: "900" },
  optionWrap: { gap: 10 },
  optionCard: { minHeight: 52, borderWidth: 1, borderRadius: 16, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  optionCorrect: { borderColor: "#12B76A", backgroundColor: "#ECFDF3" },
  optionWrong: { borderColor: "#EF4444", backgroundColor: "#FEF2F2" },
  optionText: { fontSize: 15, fontWeight: "800", flex: 1 },
  feedbackBox: { borderRadius: 16, padding: 12 },
  feedbackTitle: { fontWeight: "900", marginBottom: 4 },
  feedbackText: { color: "#475467", lineHeight: 19, fontWeight: "600" },
  primaryButton: { minHeight: 50, borderRadius: 999, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8, paddingHorizontal: 16 },
  primaryButtonText: { fontWeight: "900", fontSize: 15 },
  disabled: { opacity: 0.7 },
  resultHero: { borderWidth: 1, borderRadius: 24, padding: 16, flexDirection: "row", alignItems: "center", gap: 12 },
  medal: { width: 58, height: 58, borderRadius: 29, alignItems: "center", justifyContent: "center" },
  resultHeroCopy: { flex: 1 },
  resultHeroTitle: { fontSize: 17, fontWeight: "900", lineHeight: 22 },
  resultHeroMeta: { marginTop: 3, fontWeight: "700" },
  scoreCircle: { width: 78, height: 78, borderRadius: 39, borderWidth: 8, alignItems: "center", justifyContent: "center" },
  scoreValue: { fontSize: 18, fontWeight: "900" },
  scoreLabel: { fontSize: 10, fontWeight: "900" },
  reportCard: { borderWidth: 1, borderRadius: 22, padding: 15, gap: 14 },
  weakCard: { backgroundColor: "#FFF7F7" },
  strongCard: { backgroundColor: "#F6FEF9" },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 7 },
  sectionHeaderText: { fontSize: 16, fontWeight: "900" },
  scoreRow: { flexDirection: "row", gap: 12, alignItems: "center" },
  scoreIcon: { width: 46, height: 46, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  scoreMid: { flex: 1, gap: 5 },
  scoreTopLine: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  scoreName: { color: "#0F172A", fontWeight: "900", fontSize: 14 },
  scorePercent: { fontWeight: "900" },
  scoreTrack: { height: 9, borderRadius: 999, overflow: "hidden", backgroundColor: "#E5E7EB" },
  scoreFill: { height: "100%", borderRadius: 999 },
  scoreHelper: { color: "#667085", fontSize: 12, fontWeight: "700" },
  weekRow: { borderWidth: 1, borderRadius: 16, padding: 12, gap: 9 },
  weekTop: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  weekLabel: { fontSize: 11, fontWeight: "900" },
  weekTitle: { fontSize: 14, fontWeight: "900", marginTop: 2 },
  weekFocus: { fontSize: 12, lineHeight: 17, fontWeight: "700", marginTop: 3 },
  statusPill: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 5 },
  statusText: { fontSize: 10, fontWeight: "900", textTransform: "capitalize" },
  taskRow: { minHeight: 56, borderWidth: 1, borderRadius: 16, padding: 10, flexDirection: "row", alignItems: "center", gap: 10 },
  taskIcon: { width: 34, height: 34, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  taskTitle: { fontSize: 13, fontWeight: "900" },
  taskMeta: { fontSize: 11, fontWeight: "700", marginTop: 2 },
  focusCard: { borderWidth: 1, borderRadius: 24, padding: 16, gap: 14 },
  focusTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  focusIcon: { width: 44, height: 44, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  focusTitle: { fontSize: 17, fontWeight: "900" },
  focusText: { lineHeight: 20, fontWeight: "700", marginTop: 2 },
  focusMeta: { lineHeight: 19, fontWeight: "800", marginTop: 6, fontSize: 12 },
  secondaryButton: { minHeight: 46, borderRadius: 999, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  secondaryButtonText: { fontWeight: "900" },
  adaptiveFocus: { borderRadius: 18, padding: 13, gap: 4 },
  adaptiveLabel: { fontSize: 11, fontWeight: "900", textTransform: "uppercase" },
  adaptiveTitle: { fontSize: 17, fontWeight: "900" },
  adaptiveText: { fontWeight: "700", lineHeight: 19 },
  tipCard: { borderWidth: 1, borderRadius: 18, padding: 13, flexDirection: "row", gap: 10, alignItems: "flex-start" },
  tipText: { flex: 1, lineHeight: 20, fontWeight: "700" },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(15,23,42,0.45)", justifyContent: "flex-end" },
  infoSheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1, padding: 18, gap: 14 },
  infoHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  infoTitle: { fontSize: 24, fontWeight: "900" },
  infoStep: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  stepNumber: { width: 34, height: 34, borderRadius: 17, backgroundColor: "#12B76A", alignItems: "center", justifyContent: "center" },
  stepNumberText: { color: "#FFFFFF", fontWeight: "900" },
  stepTitle: { fontWeight: "900", fontSize: 15 },
  stepBody: { marginTop: 3, lineHeight: 19, fontWeight: "600" }
});
