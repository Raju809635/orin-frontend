import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { api } from "@/lib/api";
import { handleAppError } from "@/lib/appError";
import { useAppTheme } from "@/context/ThemeContext";
import { notify } from "@/utils/notify";

type QuizQuestion = {
  id: string;
  question: string;
  options: string[];
  correct: string;
  difficulty: "easy" | "medium" | "hard";
  explanation?: string;
  skill?: string;
};

type QuizResponse = {
  completedToday?: boolean;
  message?: string;
  domain?: string;
  streak?: number;
  result?: {
    score?: number;
    totalQuestions?: number;
    xpEarned?: number;
    streak?: number;
  };
  quiz?: {
    questionPool?: QuizQuestion[];
  } | null;
};

type SubmitResponse = {
  result?: {
    score?: number;
    totalQuestions?: number;
    xpEarned?: number;
    streak?: number;
  };
};

const SUBJECTS = ["Algebra", "Physics", "Chemistry", "Biology", "Geography", "History"];

export default function KidsLearningGamesScreen() {
  const params = useLocalSearchParams<{ subject?: string }>();
  const { colors, isDark } = useAppTheme();
  const initialSubject = SUBJECTS.includes(String(params.subject || "")) ? String(params.subject) : "Algebra";
  const [subject, setSubject] = useState(initialSubject);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<Record<string, "correct" | "wrong">>({});
  const [result, setResult] = useState<SubmitResponse["result"] | QuizResponse["result"] | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  const answeredCount = useMemo(() => Object.keys(selected).length, [selected]);
  const canSubmit = questions.length === 5 && answeredCount === 5 && !result;

  async function startGame(nextSubject = subject) {
    try {
      setLoading(true);
      setSubject(nextSubject);
      setQuestions([]);
      setSelected({});
      setFeedback({});
      setResult(null);
      setMessage("");
      const { data } = await api.get<QuizResponse>("/api/network/daily-quiz", { params: { domain: nextSubject } });
      if (data.completedToday) {
        setResult(data.result || null);
        setMessage(data.message || "Today's practice is already completed.");
        return;
      }
      const pool = data.quiz?.questionPool || [];
      setQuestions(pool.slice(0, 5));
      if (pool.length < 5) setMessage("Practice questions are not ready yet. Try another subject.");
    } catch (error) {
      handleAppError(error, { fallbackMessage: "Unable to load learning game. Please try again." });
    } finally {
      setLoading(false);
    }
  }

  function chooseAnswer(question: QuizQuestion, option: string) {
    if (result || feedback[question.id]) return;
    const isCorrect = option === question.correct;
    setSelected((prev) => ({ ...prev, [question.id]: option }));
    setFeedback((prev) => ({ ...prev, [question.id]: isCorrect ? "correct" : "wrong" }));
  }

  async function submitGame() {
    try {
      setSubmitting(true);
      const answers = questions.map((question) => ({
        questionId: question.id,
        skill: question.skill || subject,
        difficulty: question.difficulty || "easy",
        selectedOption: selected[question.id],
        correctOption: question.correct,
        isCorrect: selected[question.id] === question.correct
      }));
      const { data } = await api.post<SubmitResponse>("/api/network/daily-quiz/submit", { domain: subject, answers });
      setResult(data.result || null);
      notify("Practice completed.");
    } catch (error) {
      handleAppError(error, { fallbackMessage: "Unable to submit practice. Please try again." });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.text }]}>Learning Games</Text>
      <Text style={[styles.subtitle, { color: colors.textMuted }]}>Practice one small subject game and earn XP for today.</Text>

      <View style={styles.subjectRow}>
        {SUBJECTS.map((item) => {
          const active = item === subject;
          return (
            <TouchableOpacity
              key={item}
              style={[styles.subjectChip, { borderColor: active ? colors.accent : colors.border, backgroundColor: active ? colors.accentSoft : colors.surface }]}
              onPress={() => startGame(item)}
            >
              <Text style={[styles.subjectText, { color: active ? colors.accent : colors.textMuted }]}>{item}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {!questions.length && !loading && !result ? (
        <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: colors.accent }]} onPress={() => startGame()}>
          <Ionicons name="play" size={18} color={colors.accentText} />
          <Text style={[styles.primaryText, { color: colors.accentText }]}>Start Practice</Text>
        </TouchableOpacity>
      ) : null}

      {loading ? <ActivityIndicator color={colors.accent} style={styles.loader} /> : null}
      {message ? <Text style={[styles.message, { color: colors.textMuted }]}>{message}</Text> : null}

      {questions.map((question, index) => {
        const answer = selected[question.id];
        return (
          <View key={question.id} style={[styles.questionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.questionMeta, { color: colors.accent }]}>Question {index + 1}/5</Text>
            <Text style={[styles.questionText, { color: colors.text }]}>{question.question}</Text>
            <View style={styles.optionWrap}>
              {question.options.map((option) => {
                const selectedOption = answer === option;
                const correctOption = option === question.correct;
                const borderColor = selectedOption ? (correctOption ? "#12B76A" : "#F04438") : colors.border;
                const backgroundColor = selectedOption
                  ? correctOption
                    ? isDark ? "rgba(18,183,106,0.18)" : "#ECFDF3"
                    : isDark ? "rgba(240,68,56,0.18)" : "#FEF3F2"
                  : colors.surfaceAlt;
                return (
                  <TouchableOpacity key={option} style={[styles.optionCard, { backgroundColor, borderColor }]} onPress={() => chooseAnswer(question, option)}>
                    <Text style={[styles.optionText, { color: colors.text }]}>{option}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {feedback[question.id] ? (
              <Text style={[styles.explain, { color: colors.textMuted }]}>
                {feedback[question.id] === "correct" ? "Correct." : `Correct answer: ${question.correct}.`} {question.explanation || ""}
              </Text>
            ) : null}
          </View>
        );
      })}

      {canSubmit ? (
        <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: colors.accent }]} onPress={submitGame} disabled={submitting}>
          {submitting ? <ActivityIndicator color={colors.accentText} /> : <Ionicons name="checkmark-circle" size={18} color={colors.accentText} />}
          <Text style={[styles.primaryText, { color: colors.accentText }]}>{submitting ? "Submitting..." : "Finish Game"}</Text>
        </TouchableOpacity>
      ) : null}

      {result ? (
        <View style={[styles.resultCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.resultTitle, { color: colors.text }]}>Practice Complete</Text>
          <Text style={[styles.resultMeta, { color: colors.textMuted }]}>Score: {result.score || 0}/{result.totalQuestions || 5}</Text>
          <Text style={[styles.resultMeta, { color: colors.textMuted }]}>XP Earned: +{result.xpEarned || 0}</Text>
          <Text style={[styles.resultMeta, { color: colors.textMuted }]}>Streak: {result.streak || 0} days</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 20, paddingBottom: 120 },
  title: { fontSize: 30, fontWeight: "900", marginBottom: 6 },
  subtitle: { fontSize: 15, lineHeight: 22, marginBottom: 16 },
  subjectRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  subjectChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  subjectText: { fontWeight: "800" },
  primaryBtn: { minHeight: 50, borderRadius: 14, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8, marginTop: 12 },
  primaryText: { fontWeight: "900", fontSize: 16 },
  loader: { marginVertical: 18 },
  message: { lineHeight: 20, marginBottom: 12 },
  questionCard: { borderWidth: 1, borderRadius: 16, padding: 14, marginBottom: 12 },
  questionMeta: { fontWeight: "900", marginBottom: 6 },
  questionText: { fontSize: 17, fontWeight: "800", lineHeight: 24, marginBottom: 12 },
  optionWrap: { gap: 8 },
  optionCard: { borderWidth: 1, borderRadius: 12, padding: 12 },
  optionText: { fontWeight: "800" },
  explain: { marginTop: 10, lineHeight: 19 },
  resultCard: { borderWidth: 1, borderRadius: 16, padding: 16, marginTop: 14 },
  resultTitle: { fontSize: 20, fontWeight: "900", marginBottom: 8 },
  resultMeta: { fontWeight: "700", marginTop: 4 }
});
