import React, { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useAppTheme } from "@/context/ThemeContext";
import { speakKidText } from "@/lib/kidsSpeech";

type AlphabetCard = { letter: string; word: string };
type CountCard = { label: string; total: number };

const ALPHABET: AlphabetCard[] = [
  { letter: "A", word: "Apple" },
  { letter: "B", word: "Ball" },
  { letter: "C", word: "Cat" },
  { letter: "D", word: "Duck" },
  { letter: "E", word: "Elephant" },
  { letter: "F", word: "Flower" }
];

const NUMBERS = [
  { symbol: "1", label: "One" },
  { symbol: "2", label: "Two" },
  { symbol: "3", label: "Three" },
  { symbol: "4", label: "Four" },
  { symbol: "5", label: "Five" }
];

const COUNTING_SETS: CountCard[] = [
  { label: "Apples", total: 5 },
  { label: "Stars", total: 4 },
  { label: "Balls", total: 3 }
];

export default function ReadingAndNumbersScreen() {
  const { colors, isDark } = useAppTheme();
  const [countAnswer, setCountAnswer] = useState<Record<string, number>>({});

  const correctCount = useMemo(
    () => COUNTING_SETS.filter((item) => countAnswer[item.label] === item.total).length,
    [countAnswer]
  );

  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.text }]}>Reading & Numbers</Text>
      <Text style={[styles.subtitle, { color: colors.textMuted }]}>
        Tap to hear letters and numbers, then try simple counting games.
      </Text>

      <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Alphabet Sounds</Text>
        <View style={styles.grid}>
          {ALPHABET.map((item) => (
            <TouchableOpacity
              key={item.letter}
              style={[styles.tile, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}
              onPress={() => void speakKidText(`${item.letter} for ${item.word}`)}
            >
              <Text style={[styles.tileBig, { color: colors.accent }]}>{item.letter}</Text>
              <Text style={[styles.tileText, { color: colors.text }]}>{item.word}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Number Sounds</Text>
        <View style={styles.grid}>
          {NUMBERS.map((item) => (
            <TouchableOpacity
              key={item.symbol}
              style={[styles.tile, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}
              onPress={() => void speakKidText(`${item.symbol}. ${item.label}`)}
            >
              <Text style={[styles.tileBig, { color: isDark ? "#FACC15" : "#D97706" }]}>{item.symbol}</Text>
              <Text style={[styles.tileText, { color: colors.text }]}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Count the Objects</Text>
        {COUNTING_SETS.map((item) => (
          <View key={item.label} style={[styles.countCard, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
            <Text style={[styles.countTitle, { color: colors.text }]}>{item.label}</Text>
            <Text style={[styles.countMeta, { color: colors.textMuted }]}>How many do you see?</Text>
            <View style={styles.choiceRow}>
              {[1, 2, 3, 4, 5].map((option) => {
                const active = countAnswer[item.label] === option;
                return (
                  <TouchableOpacity
                    key={option}
                    style={[
                      styles.choiceChip,
                      { borderColor: active ? colors.accent : colors.border, backgroundColor: active ? colors.accentSoft : colors.surface }
                    ]}
                    onPress={() => setCountAnswer((prev) => ({ ...prev, [item.label]: option }))}
                  >
                    <Text style={[styles.choiceText, { color: active ? colors.accent : colors.textMuted }]}>{option}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {countAnswer[item.label] ? (
              <Text style={[styles.feedback, { color: countAnswer[item.label] === item.total ? "#12B76A" : colors.danger }]}>
                {countAnswer[item.label] === item.total ? "Correct!" : `Try again. The answer is ${item.total}.`}
              </Text>
            ) : null}
          </View>
        ))}
        <Text style={[styles.score, { color: colors.textMuted }]}>Correct sets: {correctCount}/{COUNTING_SETS.length}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 20, paddingBottom: 120, gap: 14 },
  title: { fontSize: 30, fontWeight: "900", marginBottom: 6 },
  subtitle: { fontSize: 15, lineHeight: 22 },
  sectionCard: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 12 },
  sectionTitle: { fontSize: 18, fontWeight: "900" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  tile: { width: "30%", minWidth: 94, borderWidth: 1, borderRadius: 14, padding: 12, alignItems: "center", gap: 4 },
  tileBig: { fontSize: 28, fontWeight: "900" },
  tileText: { fontWeight: "800" },
  countCard: { borderWidth: 1, borderRadius: 14, padding: 12, gap: 8 },
  countTitle: { fontWeight: "900" },
  countMeta: { fontSize: 13 },
  choiceRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  choiceChip: { borderWidth: 1, borderRadius: 999, minWidth: 40, paddingHorizontal: 12, paddingVertical: 8, alignItems: "center" },
  choiceText: { fontWeight: "900" },
  feedback: { fontWeight: "800" },
  score: { fontWeight: "700", marginTop: 4 }
});
