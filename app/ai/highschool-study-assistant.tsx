import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { api } from "@/lib/api";
import { getAppErrorMessage } from "@/lib/appError";
import { useAppTheme } from "@/context/ThemeContext";
import { useLearner } from "@/context/LearnerContext";

type AnswerStyle = "simple" | "steps" | "exam";
type Tab = "home" | "ask" | "answer" | "subject" | "practice" | "progress";

type AssistantResult = {
  title: string;
  subject: string;
  answerStyle: AnswerStyle;
  summary: string;
  simpleAnswer: string;
  stepByStep: string[];
  examAnswer: string;
  keyPoints: string[];
  notes: { title: string; body: string }[];
  practiceQuestions: { id: string; question: string; options: string[]; correct: string; explanation: string }[];
  dashboardTools: string[];
  progress: {
    questions: number;
    accuracy: number;
    streakDays: number;
    strongTopics: string[];
    weakTopics: string[];
  };
};

const ANSWER_STYLES: { id: AnswerStyle; title: string; subtitle: string; icon: keyof typeof Ionicons.glyphMap; color: string }[] = [
  { id: "simple", title: "Explain Simple", subtitle: "Easy language, short explanation", icon: "sparkles", color: "#16A34A" },
  { id: "steps", title: "Step-by-Step", subtitle: "Detailed steps with explanation", icon: "list", color: "#0EA5E9" },
  { id: "exam", title: "Exam Answer", subtitle: "Points for marks and revision", icon: "document-text", color: "#7C3AED" }
];

const SUBJECTS = ["Biology", "Mathematics", "Physics", "Chemistry", "English", "Science", "Social Science"];

function fallbackResult(): AssistantResult {
  return {
    title: "Photosynthesis",
    subject: "Biology",
    answerStyle: "simple",
    summary: "Photosynthesis is the process by which green plants make food using sunlight, carbon dioxide, and water.",
    simpleAnswer: "Plants use sunlight, water, and carbon dioxide to make food. This food is called glucose, and oxygen is released.",
    stepByStep: ["Leaves take in sunlight.", "Roots absorb water.", "Leaves take in carbon dioxide.", "Chlorophyll traps sunlight.", "Plants make glucose.", "Oxygen is released."],
    examAnswer: "Photosynthesis is the process in which green plants prepare their own food using carbon dioxide and water in the presence of sunlight and chlorophyll. Glucose is formed and oxygen is released.",
    keyPoints: ["Needs sunlight, water, and carbon dioxide.", "Chlorophyll captures sunlight.", "Glucose is plant food.", "Oxygen is released."],
    notes: [
      { title: "Short Notes", body: "Formula: carbon dioxide + water + sunlight gives glucose + oxygen." },
      { title: "Mind Map", body: "Sunlight -> chlorophyll -> glucose -> oxygen release." },
      { title: "Diagram", body: "Draw leaf with arrows for sunlight, carbon dioxide, water, glucose, and oxygen." }
    ],
    practiceQuestions: [
      { id: "q1", question: "Which gas is released during photosynthesis?", options: ["Oxygen", "Carbon dioxide", "Nitrogen", "Hydrogen"], correct: "Oxygen", explanation: "Oxygen is released as a by-product." },
      { id: "q2", question: "Which pigment captures sunlight?", options: ["Chlorophyll", "Hemoglobin", "Melanin", "Keratin"], correct: "Chlorophyll", explanation: "Chlorophyll is the green pigment in leaves." }
    ],
    dashboardTools: ["Short Notes", "Mind Maps", "Practice Questions", "Important Diagrams", "Previous Year Questions"],
    progress: { questions: 120, accuracy: 85, streakDays: 7, strongTopics: ["Photosynthesis", "Cell Structure"], weakTopics: ["Plant Hormones", "Respiration in Plants"] }
  };
}

export default function HighSchoolStudyAssistantScreen() {
  const router = useRouter();
  const { colors, isDark } = useAppTheme();
  const { className } = useLearner();
  const [tab, setTab] = useState<Tab>("home");
  const [answerStyle, setAnswerStyle] = useState<AnswerStyle>("simple");
  const [question, setQuestion] = useState("Explain photosynthesis");
  const [subject, setSubject] = useState("Biology");
  const [result, setResult] = useState<AssistantResult>(fallbackResult);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [answerSource, setAnswerSource] = useState<"ai" | "fallback">("fallback");

  const currentPractice = result.practiceQuestions[0];
  const practiceSelected = currentPractice ? selectedAnswers[currentPractice.id] : "";
  const activeStyle = useMemo(() => ANSWER_STYLES.find((item) => item.id === answerStyle) || ANSWER_STYLES[0], [answerStyle]);

  async function ask() {
    if (!question.trim()) return;
    setLoading(true);
    setStatusMessage("");
    setTab("answer");
    try {
      const { data } = await api.post<{ source?: "ai" | "fallback"; result?: AssistantResult }>("/api/ai/highschool/study-assistant", {
        question,
        subject,
        answerStyle,
        classLevel: className || "High School"
      });
      setResult(data?.result || fallbackResult());
      setAnswerSource(data?.source === "ai" ? "ai" : "fallback");
      setSelectedAnswers({});
      setStatusMessage(data?.source === "ai" ? "AI explained your doubt with study tools and practice." : "ORIN loaded checked study help because the AI answer was unavailable or did not pass quality checks.");
    } catch (error) {
      setResult(fallbackResult());
      setAnswerSource("fallback");
      setSelectedAnswers({});
      setStatusMessage(getAppErrorMessage(error, "AI study help is unavailable, so ORIN loaded safe study help."));
    } finally {
      setLoading(false);
    }
  }

  const answerText = answerStyle === "exam" ? result.examAnswer : answerStyle === "steps" ? result.stepByStep.join("\n") : result.simpleAnswer;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.topBar, { backgroundColor: colors.background }]}>
        <TouchableOpacity style={styles.topIconBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.topTitle, { color: colors.text }]}>Study Assistant</Text>
        <TouchableOpacity style={styles.topIconBtn} onPress={() => setTab("home")}>
          <Ionicons name="home" size={21} color={colors.accent} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {statusMessage ? (
          <View style={[styles.aiNotice, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name="sparkles" size={18} color={colors.accent} />
            <Text style={[styles.aiNoticeText, { color: colors.textMuted }]}>{statusMessage}</Text>
          </View>
        ) : null}

        {tab === "home" ? (
          <>
            <View style={[styles.heroCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.brand, { color: colors.accent }]}>ORIN</Text>
              <Text style={[styles.heroTitle, { color: colors.text }]}>Your AI Learning Buddy</Text>
              <Text style={[styles.heroSubtitle, { color: colors.textMuted }]}>
                Ask doubts, choose an answer style, get notes, practice questions, and progress guidance.
              </Text>
              <TouchableOpacity style={[styles.primaryButton, { backgroundColor: colors.accent }]} onPress={() => setTab("ask")}>
                <Text style={[styles.primaryText, { color: colors.accentText }]}>Ask Your Doubt</Text>
                <Ionicons name="arrow-forward" size={18} color={colors.accentText} />
              </TouchableOpacity>
            </View>

            <View style={styles.quickGrid}>
              {[
                ["Smart Explanations", "bulb"],
                ["All Subjects", "book"],
                ["Step-by-Step", "git-branch"],
                ["Practice & Improve", "bar-chart"]
              ].map(([label, icon]) => (
                <TouchableOpacity key={label} style={[styles.quickTile, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => setTab(label === "Practice & Improve" ? "practice" : "ask")}>
                  <Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={22} color={colors.accent} />
                  <Text style={[styles.quickText, { color: colors.text }]}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <SectionHeader icon="albums" title="Continue Learning" color="#12B76A" />
              <TouchableOpacity style={[styles.continueCard, { backgroundColor: isDark ? "rgba(18,183,106,0.12)" : "#ECFDF3" }]} onPress={() => setTab("answer")}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.continueTitle, { color: colors.text }]}>{result.title}</Text>
                  <Text style={[styles.cardMeta, { color: colors.textMuted }]}>{result.subject} - {result.progress.accuracy}% complete</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.accent} />
              </TouchableOpacity>
            </View>
          </>
        ) : null}

        {tab === "ask" ? (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <SectionHeader icon="chatbox-ellipses" title="Ask Your Doubt" color="#12B76A" />
            <TextInput
              value={question}
              onChangeText={setQuestion}
              placeholder="Type your question here..."
              placeholderTextColor={colors.textMuted}
              style={[styles.input, styles.multi, { backgroundColor: colors.surfaceAlt, borderColor: colors.border, color: colors.text }]}
              multiline
            />
            <Text style={[styles.label, { color: colors.text }]}>Select Subject</Text>
            <View style={styles.chipWrap}>
              {SUBJECTS.map((item) => {
                const active = subject === item;
                return (
                  <TouchableOpacity key={item} style={[styles.chip, { backgroundColor: active ? colors.accentSoft : colors.surfaceAlt, borderColor: active ? colors.accent : colors.border }]} onPress={() => setSubject(item)}>
                    <Text style={[styles.chipText, { color: active ? colors.accent : colors.textMuted }]}>{item}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <SectionHeader icon="options" title="Choose Answer Style" color="#0EA5E9" />
            {ANSWER_STYLES.map((item) => {
              const active = answerStyle === item.id;
              return (
                <TouchableOpacity key={item.id} style={[styles.styleRow, { backgroundColor: active ? colors.accentSoft : colors.surfaceAlt, borderColor: active ? item.color : colors.border }]} onPress={() => setAnswerStyle(item.id)}>
                  <View style={[styles.styleIcon, { backgroundColor: `${item.color}22` }]}>
                    <Ionicons name={item.icon} size={18} color={item.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.styleTitle, { color: colors.text }]}>{item.title}</Text>
                    <Text style={[styles.cardMeta, { color: colors.textMuted }]}>{item.subtitle}</Text>
                  </View>
                  {active ? <Ionicons name="checkmark-circle" size={20} color={item.color} /> : null}
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity style={[styles.primaryButton, { backgroundColor: colors.accent }]} onPress={ask} disabled={loading}>
              {loading ? <ActivityIndicator color={colors.accentText} /> : <Text style={[styles.primaryText, { color: colors.accentText }]}>Get Help</Text>}
            </TouchableOpacity>
          </View>
        ) : null}

        {tab === "answer" ? (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <SectionHeader icon={activeStyle.icon} title="ORIN Answer" color={activeStyle.color} />
            {loading ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator color={colors.accent} />
                <Text style={[styles.cardMeta, { color: colors.textMuted }]}>ORIN is preparing your answer...</Text>
              </View>
            ) : (
              <>
                <Text style={[styles.answerMode, { color: activeStyle.color }]}>
                  {answerSource === "ai" ? activeStyle.title : `Checked Study Help - ${activeStyle.title}`}
                </Text>
                <Text style={[styles.answerTitle, { color: colors.text }]}>{result.title}</Text>
                {answerStyle === "steps" ? (
                  <View style={styles.stepList}>
                    {result.stepByStep.map((step, index) => (
                      <View key={`${step}-${index}`} style={styles.answerStep}>
                        <View style={[styles.stepNumber, { backgroundColor: activeStyle.color }]}>
                          <Text style={styles.stepNumberText}>{index + 1}</Text>
                        </View>
                        <Text style={[styles.answerText, { color: colors.text }]}>{step}</Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text style={[styles.answerText, { color: colors.text }]}>{answerText}</Text>
                )}
                <Text style={[styles.subHeader, { color: colors.text }]}>Key Points</Text>
                {result.keyPoints.map((point) => (
                  <View key={point} style={styles.pointRow}>
                    <View style={[styles.dot, { backgroundColor: activeStyle.color }]} />
                    <Text style={[styles.pointText, { color: colors.textMuted }]}>{point}</Text>
                  </View>
                ))}
                <View style={styles.actionRow}>
                  <TouchableOpacity style={[styles.actionButton, { borderColor: colors.border }]} onPress={() => setTab("subject")}>
                    <Ionicons name="book" size={16} color={colors.text} />
                    <Text style={[styles.actionText, { color: colors.text }]}>More Tools</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.actionButton, { borderColor: colors.border }]} onPress={() => setTab("practice")}>
                    <Ionicons name="help-circle" size={16} color={colors.text} />
                    <Text style={[styles.actionText, { color: colors.text }]}>Practice</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        ) : null}

        {tab === "subject" ? (
          <>
            <View style={[styles.heroCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.heroTitle, { color: colors.text }]}>{result.subject}</Text>
              <Text style={[styles.heroSubtitle, { color: colors.textMuted }]}>{result.title} - Chapter support tools</Text>
            </View>
            {result.notes.map((note) => (
              <View key={note.title} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <SectionHeader icon={note.title.toLowerCase().includes("map") ? "git-network" : note.title.toLowerCase().includes("diagram") ? "image" : "document-text"} title={note.title} color="#12B76A" />
                <Text style={[styles.answerText, { color: colors.textMuted }]}>{note.body}</Text>
              </View>
            ))}
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <SectionHeader icon="grid" title="Study Tools" color="#7C3AED" />
              <View style={styles.toolGrid}>
                {result.dashboardTools.map((tool) => (
                  <TouchableOpacity key={tool} style={[styles.toolTile, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]} onPress={() => setTab(tool.toLowerCase().includes("practice") ? "practice" : "answer")}>
                    <Ionicons name="apps" size={18} color={colors.accent} />
                    <Text style={[styles.toolText, { color: colors.text }]}>{tool}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </>
        ) : null}

        {tab === "practice" ? (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <SectionHeader icon="help-circle" title="Practice Questions" color="#12B76A" />
            {currentPractice ? (
              <>
                <Text style={[styles.cardMeta, { color: colors.textMuted }]}>Question 1/{result.practiceQuestions.length}</Text>
                <Text style={[styles.answerTitle, { color: colors.text }]}>{currentPractice.question}</Text>
                {currentPractice.options.map((option) => {
                  const selected = practiceSelected === option;
                  const correct = practiceSelected && option === currentPractice.correct;
                  const wrong = selected && option !== currentPractice.correct;
                  return (
                    <TouchableOpacity key={option} style={[styles.optionRow, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }, correct && styles.optionCorrect, wrong && styles.optionWrong]} onPress={() => setSelectedAnswers((prev) => ({ ...prev, [currentPractice.id]: option }))}>
                      <Text style={[styles.optionText, { color: colors.text }]}>{option}</Text>
                      {correct ? <Ionicons name="checkmark-circle" size={20} color="#12B76A" /> : null}
                      {wrong ? <Ionicons name="close-circle" size={20} color="#EF4444" /> : null}
                    </TouchableOpacity>
                  );
                })}
                {practiceSelected ? (
                  <Text style={[styles.answerText, { color: colors.textMuted }]}>{currentPractice.explanation}</Text>
                ) : null}
              </>
            ) : null}
          </View>
        ) : null}

        {tab === "progress" ? (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <SectionHeader icon="bar-chart" title="Your Progress" color="#F59E0B" />
            <View style={styles.metricGrid}>
              <Metric value={result.progress.questions} label="Questions" colors={colors} />
              <Metric value={result.progress.accuracy} label="Accuracy" suffix="%" colors={colors} />
              <Metric value={result.progress.streakDays} label="Streak" colors={colors} />
            </View>
            <TopicList title="Strong Topics" items={result.progress.strongTopics} color="#12B76A" colors={colors} />
            <TopicList title="Weak Topics" items={result.progress.weakTopics} color="#EF4444" colors={colors} />
          </View>
        ) : null}
      </ScrollView>

      <View style={[styles.bottomNav, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {[
          ["home", "home", "Home"],
          ["ask", "chatbox", "Ask"],
          ["answer", "sparkles", "Answer"],
          ["practice", "help-circle", "Practice"],
          ["progress", "person", "Profile"]
        ].map(([id, icon, label]) => {
          const active = tab === id;
          return (
            <TouchableOpacity key={id} style={styles.navItem} onPress={() => setTab(id as Tab)}>
              <Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={18} color={active ? colors.accent : colors.textMuted} />
              <Text style={[styles.navText, { color: active ? colors.accent : colors.textMuted }]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
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

function Metric({ value, label, suffix = "", colors }: { value: number; label: string; suffix?: string; colors: any }) {
  return (
    <View style={[styles.metricTile, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
      <Text style={[styles.metricValue, { color: colors.text }]}>{value}{suffix}</Text>
      <Text style={[styles.cardMeta, { color: colors.textMuted }]}>{label}</Text>
    </View>
  );
}

function TopicList({ title, items, color, colors }: { title: string; items: string[]; color: string; colors: any }) {
  return (
    <View style={styles.topicList}>
      <Text style={[styles.subHeader, { color: colors.text }]}>{title}</Text>
      {items.map((item) => (
        <View key={item} style={styles.pointRow}>
          <View style={[styles.dot, { backgroundColor: color }]} />
          <Text style={[styles.pointText, { color: colors.textMuted }]}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: { minHeight: 58, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  topIconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  topTitle: { fontSize: 18, fontWeight: "900" },
  container: { padding: 16, paddingBottom: 104, gap: 14 },
  aiNotice: { borderWidth: 1, borderRadius: 18, padding: 12, flexDirection: "row", gap: 9, alignItems: "flex-start" },
  aiNoticeText: { flex: 1, fontSize: 12, lineHeight: 18, fontWeight: "800" },
  heroCard: { borderWidth: 1, borderRadius: 26, padding: 18, gap: 12 },
  brand: { fontSize: 42, fontWeight: "900", letterSpacing: 0 },
  heroTitle: { fontSize: 24, lineHeight: 30, fontWeight: "900" },
  heroSubtitle: { fontSize: 14, lineHeight: 21, fontWeight: "700" },
  primaryButton: { minHeight: 50, borderRadius: 999, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8, paddingHorizontal: 16 },
  primaryText: { fontWeight: "900", fontSize: 15 },
  quickGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  quickTile: { width: "48%", minHeight: 88, borderWidth: 1, borderRadius: 18, padding: 12, alignItems: "center", justifyContent: "center", gap: 8 },
  quickText: { fontWeight: "900", textAlign: "center" },
  card: { borderWidth: 1, borderRadius: 22, padding: 15, gap: 13 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 7 },
  sectionHeaderText: { fontSize: 16, fontWeight: "900" },
  continueCard: { borderRadius: 18, padding: 13, flexDirection: "row", alignItems: "center", gap: 10 },
  continueTitle: { fontSize: 15, fontWeight: "900" },
  cardMeta: { lineHeight: 18, fontWeight: "700", fontSize: 12 },
  input: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 11, fontSize: 15, lineHeight: 21 },
  multi: { minHeight: 110, textAlignVertical: "top" },
  label: { fontSize: 14, fontWeight: "900" },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  chipText: { fontWeight: "900" },
  styleRow: { borderWidth: 1, borderRadius: 16, padding: 12, flexDirection: "row", alignItems: "center", gap: 11 },
  styleIcon: { width: 38, height: 38, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  styleTitle: { fontWeight: "900", fontSize: 14 },
  loadingBox: { alignItems: "center", gap: 10, padding: 20 },
  answerMode: { fontWeight: "900", fontSize: 12, textTransform: "uppercase" },
  answerTitle: { fontSize: 18, fontWeight: "900", lineHeight: 24 },
  answerText: { fontSize: 14, lineHeight: 22, fontWeight: "700" },
  stepList: { gap: 10 },
  answerStep: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  stepNumber: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  stepNumberText: { color: "#FFFFFF", fontWeight: "900", fontSize: 12 },
  subHeader: { fontSize: 15, fontWeight: "900", marginTop: 4 },
  pointRow: { flexDirection: "row", gap: 9, alignItems: "flex-start" },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 7 },
  pointText: { flex: 1, fontWeight: "700", lineHeight: 20 },
  actionRow: { flexDirection: "row", gap: 10 },
  actionButton: { flex: 1, minHeight: 44, borderWidth: 1, borderRadius: 14, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 7 },
  actionText: { fontWeight: "900", fontSize: 12 },
  toolGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  toolTile: { width: "48%", minHeight: 74, borderWidth: 1, borderRadius: 16, padding: 10, gap: 7, justifyContent: "center" },
  toolText: { fontWeight: "900", fontSize: 12 },
  optionRow: { minHeight: 50, borderWidth: 1, borderRadius: 15, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  optionCorrect: { borderColor: "#12B76A", backgroundColor: "#ECFDF3" },
  optionWrong: { borderColor: "#EF4444", backgroundColor: "#FEF2F2" },
  optionText: { fontWeight: "800", flex: 1 },
  metricGrid: { flexDirection: "row", gap: 10 },
  metricTile: { flex: 1, borderWidth: 1, borderRadius: 16, padding: 12, alignItems: "center" },
  metricValue: { fontSize: 20, fontWeight: "900" },
  topicList: { gap: 8 },
  bottomNav: { position: "absolute", left: 12, right: 12, bottom: 12, minHeight: 64, borderWidth: 1, borderRadius: 24, flexDirection: "row", alignItems: "center", justifyContent: "space-around", paddingHorizontal: 8 },
  navItem: { flex: 1, alignItems: "center", justifyContent: "center", gap: 3 },
  navText: { fontSize: 10, fontWeight: "900" }
});
