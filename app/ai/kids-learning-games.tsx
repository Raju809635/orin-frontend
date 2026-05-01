import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useAppTheme } from "@/context/ThemeContext";

type KidQuestion = {
  id: string;
  question: string;
  options: string[];
  correct: string;
  explanation: string;
};

type SubjectKey = "English" | "Math" | "Science" | "General Knowledge" | "Geography" | "History";

const SUBJECTS: SubjectKey[] = ["English", "Math", "Science", "General Knowledge", "Geography", "History"];

const QUESTION_BANK: Record<SubjectKey, KidQuestion[]> = {
  English: [
    { id: "eng-1", question: "Which word is a naming word?", options: ["Run", "Tree", "Blue", "Quickly"], correct: "Tree", explanation: "A naming word tells us the name of a person, place, animal, or thing." },
    { id: "eng-2", question: "Choose the correct plural form of 'book'.", options: ["Bookes", "Books", "Books'", "Book"], correct: "Books", explanation: "We usually add 's' to make many of something." },
    { id: "eng-3", question: "Which sentence starts with a capital letter correctly?", options: ["my dog is brown.", "my Dog is brown.", "My dog is brown.", "my dog Is brown."], correct: "My dog is brown.", explanation: "A sentence begins with a capital letter." },
    { id: "eng-4", question: "Which word rhymes with 'cat'?", options: ["Sun", "Hat", "Dog", "Pin"], correct: "Hat", explanation: "Cat and hat have the same ending sound." },
    { id: "eng-5", question: "Which punctuation mark comes at the end of a statement?", options: ["?", ".", "!", ","], correct: ".", explanation: "A full stop is used at the end of a statement." }
  ],
  Math: [
    { id: "math-1", question: "What is 7 + 5?", options: ["10", "11", "12", "13"], correct: "12", explanation: "7 plus 5 equals 12." },
    { id: "math-2", question: "What is 15 - 6?", options: ["7", "8", "9", "10"], correct: "9", explanation: "15 minus 6 equals 9." },
    { id: "math-3", question: "Which number is greater?", options: ["18", "21", "17", "19"], correct: "21", explanation: "21 is the largest number here." },
    { id: "math-4", question: "How many sides does a square have?", options: ["3", "4", "5", "6"], correct: "4", explanation: "A square has 4 equal sides." },
    { id: "math-5", question: "What is 4 x 3?", options: ["7", "10", "12", "14"], correct: "12", explanation: "4 groups of 3 make 12." }
  ],
  Science: [
    { id: "sci-1", question: "Which part of the plant makes food?", options: ["Root", "Leaf", "Stem", "Flower"], correct: "Leaf", explanation: "Leaves make food using sunlight." },
    { id: "sci-2", question: "What do we need to breathe?", options: ["Water", "Soil", "Air", "Sand"], correct: "Air", explanation: "We breathe air to live." },
    { id: "sci-3", question: "Which animal lays eggs?", options: ["Cow", "Hen", "Dog", "Cat"], correct: "Hen", explanation: "A hen lays eggs." },
    { id: "sci-4", question: "Which star gives us light during the day?", options: ["Moon", "Mars", "Sun", "Venus"], correct: "Sun", explanation: "The Sun gives us heat and light." },
    { id: "sci-5", question: "Which sense organ helps us hear?", options: ["Eye", "Nose", "Ear", "Tongue"], correct: "Ear", explanation: "We hear sounds with our ears." }
  ],
  "General Knowledge": [
    { id: "gk-1", question: "What is the name of our country?", options: ["India", "Japan", "Brazil", "Egypt"], correct: "India", explanation: "India is our country." },
    { id: "gk-2", question: "How many days are there in a week?", options: ["5", "6", "7", "8"], correct: "7", explanation: "A week has 7 days." },
    { id: "gk-3", question: "Which colour is the sky on a clear day?", options: ["Blue", "Green", "Pink", "Black"], correct: "Blue", explanation: "The sky usually looks blue on a clear day." },
    { id: "gk-4", question: "Which festival is known as the festival of lights?", options: ["Holi", "Diwali", "Pongal", "Eid"], correct: "Diwali", explanation: "Diwali is called the festival of lights." },
    { id: "gk-5", question: "Which bird is known for saying 'koo-koo'?", options: ["Crow", "Peacock", "Cuckoo", "Sparrow"], correct: "Cuckoo", explanation: "The cuckoo bird is famous for its call." }
  ],
  Geography: [
    { id: "geo-1", question: "What do we call a very large body of salt water?", options: ["River", "Lake", "Ocean", "Pond"], correct: "Ocean", explanation: "An ocean is a huge body of salt water." },
    { id: "geo-2", question: "Which landform is very high and rocky?", options: ["Mountain", "Valley", "Plain", "Beach"], correct: "Mountain", explanation: "Mountains are very high landforms." },
    { id: "geo-3", question: "Which season is usually the coldest?", options: ["Summer", "Rainy", "Winter", "Spring"], correct: "Winter", explanation: "Winter is generally the coldest season." },
    { id: "geo-4", question: "What do we use to find directions?", options: ["Compass", "Mirror", "Clock", "Bell"], correct: "Compass", explanation: "A compass helps us find north, south, east, and west." },
    { id: "geo-5", question: "Which one is a natural source of water?", options: ["Tap", "Bottle", "River", "Tank"], correct: "River", explanation: "A river is a natural water source." }
  ],
  History: [
    { id: "hist-1", question: "Who was known as the Father of the Nation in India?", options: ["Jawaharlal Nehru", "Mahatma Gandhi", "Subhas Chandra Bose", "Sardar Patel"], correct: "Mahatma Gandhi", explanation: "Mahatma Gandhi is known as the Father of the Nation." },
    { id: "hist-2", question: "What do we call things from long ago that teach us about the past?", options: ["Toys", "Artifacts", "Games", "Clouds"], correct: "Artifacts", explanation: "Artifacts help us learn about history." },
    { id: "hist-3", question: "Who was India's first Prime Minister?", options: ["Mahatma Gandhi", "Indira Gandhi", "Jawaharlal Nehru", "A.P.J. Abdul Kalam"], correct: "Jawaharlal Nehru", explanation: "Jawaharlal Nehru was India's first Prime Minister." },
    { id: "hist-4", question: "Which day do we celebrate as Independence Day in India?", options: ["January 26", "August 15", "October 2", "November 14"], correct: "August 15", explanation: "India celebrates Independence Day on August 15." },
    { id: "hist-5", question: "Who built many famous forts and had brave armies in Indian history?", options: ["Shivaji Maharaj", "Birbal", "Tenali Rama", "Kalidasa"], correct: "Shivaji Maharaj", explanation: "Shivaji Maharaj is remembered for bravery and forts." }
  ]
};

function praiseForScore(score: number, total: number) {
  if (score === total) return "Amazing work! You got every answer right.";
  if (score >= total - 1) return "Great job! You are learning really well.";
  if (score >= Math.ceil(total / 2)) return "Nice try! A little more practice will make you even stronger.";
  return "Good effort! Keep practicing and you will improve every day.";
}

export default function KidsLearningGamesScreen() {
  const params = useLocalSearchParams<{ subject?: string }>();
  const { colors, isDark } = useAppTheme();
  const requestedSubject = String(params.subject || "").trim();
  const initialSubject = SUBJECTS.includes(requestedSubject as SubjectKey) ? (requestedSubject as SubjectKey) : "English";
  const [subject, setSubject] = useState<SubjectKey>(initialSubject);
  const [questions, setQuestions] = useState<KidQuestion[]>(QUESTION_BANK[initialSubject]);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<Record<string, "correct" | "wrong">>({});
  const [result, setResult] = useState<{ score: number; total: number; stars: number; message: string } | null>(null);

  const answeredCount = useMemo(() => Object.keys(selected).length, [selected]);
  const canFinish = questions.length > 0 && answeredCount === questions.length && !result;

  function startGame(nextSubject: SubjectKey) {
    setSubject(nextSubject);
    setQuestions(QUESTION_BANK[nextSubject]);
    setSelected({});
    setFeedback({});
    setResult(null);
  }

  function chooseAnswer(question: KidQuestion, option: string) {
    if (result || feedback[question.id]) return;
    const isCorrect = option === question.correct;
    setSelected((prev) => ({ ...prev, [question.id]: option }));
    setFeedback((prev) => ({ ...prev, [question.id]: isCorrect ? "correct" : "wrong" }));
  }

  function finishGame() {
    const score = questions.reduce((total, question) => total + (selected[question.id] === question.correct ? 1 : 0), 0);
    const total = questions.length;
    const stars = score === total ? 3 : score >= total - 1 ? 2 : score >= Math.ceil(total / 2) ? 1 : 0;
    setResult({
      score,
      total,
      stars,
      message: praiseForScore(score, total)
    });
  }

  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.text }]}>Learning Games</Text>
      <Text style={[styles.subtitle, { color: colors.textMuted }]}>Pick a school subject, answer 5 simple questions, and collect stars.</Text>

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
                {feedback[question.id] === "correct" ? "Correct." : `Correct answer: ${question.correct}.`} {question.explanation}
              </Text>
            ) : null}
          </View>
        );
      })}

      {canFinish ? (
        <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: colors.accent }]} onPress={finishGame}>
          <Ionicons name="checkmark-circle" size={18} color={colors.accentText} />
          <Text style={[styles.primaryText, { color: colors.accentText }]}>Finish Game</Text>
        </TouchableOpacity>
      ) : null}

      {result ? (
        <View style={[styles.resultCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.resultTitle, { color: colors.text }]}>Game Complete</Text>
          <Text style={[styles.resultMeta, { color: colors.textMuted }]}>Score: {result.score}/{result.total}</Text>
          <Text style={[styles.resultMeta, { color: colors.textMuted }]}>Stars Earned: {"★".repeat(result.stars) || "Keep trying!"}</Text>
          <Text style={[styles.resultMessage, { color: colors.text }]}>{result.message}</Text>
          <TouchableOpacity style={[styles.secondaryBtn, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }]} onPress={() => startGame(subject)}>
            <Text style={[styles.secondaryText, { color: colors.text }]}>Play Again</Text>
          </TouchableOpacity>
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
  questionCard: { borderWidth: 1, borderRadius: 16, padding: 14, marginBottom: 12 },
  questionMeta: { fontWeight: "900", marginBottom: 6 },
  questionText: { fontSize: 17, fontWeight: "800", lineHeight: 24, marginBottom: 12 },
  optionWrap: { gap: 8 },
  optionCard: { borderWidth: 1, borderRadius: 12, padding: 12 },
  optionText: { fontWeight: "800" },
  explain: { marginTop: 10, lineHeight: 19 },
  resultCard: { borderWidth: 1, borderRadius: 16, padding: 16, marginTop: 14 },
  resultTitle: { fontSize: 20, fontWeight: "900", marginBottom: 8 },
  resultMeta: { fontWeight: "700", marginTop: 4 },
  resultMessage: { marginTop: 10, lineHeight: 21, fontWeight: "700" },
  secondaryBtn: { marginTop: 14, borderWidth: 1, borderRadius: 12, alignItems: "center", justifyContent: "center", minHeight: 44 },
  secondaryText: { fontWeight: "800" }
});
