import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { useAppTheme } from "@/context/ThemeContext";

const SKILL_AREAS = [
  {
    title: "Reading Practice",
    description: "Use simple reading comprehension and vocabulary games with school-friendly prompts.",
    subject: "English",
    icon: "book"
  },
  {
    title: "Number Sense",
    description: "Practice counting, patterns, and arithmetic basics through quick learning rounds.",
    subject: "Algebra",
    icon: "calculator"
  },
  {
    title: "World Facts",
    description: "Open simple geography and history practice for memory-building and class revision.",
    subject: "Geography",
    icon: "earth"
  }
] as const;

export default function ReadingAndNumbersScreen() {
  const router = useRouter();
  const { colors, isDark } = useAppTheme();

  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.text }]}>Reading & Numbers</Text>
      <Text style={[styles.subtitle, { color: colors.textMuted }]}>
        Pick a simple skill area, then jump into guided practice with the ORIN learning game flow.
      </Text>

      <View style={styles.cardStack}>
        {SKILL_AREAS.map((item) => (
          <TouchableOpacity
            key={item.title}
            style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() =>
              router.push({
                pathname: "/ai/kids-learning-games",
                params: { subject: item.subject }
              } as never)
            }
          >
            <View style={[styles.iconWrap, { backgroundColor: isDark ? "rgba(250,204,21,0.18)" : "#FEF3C7" }]}>
              <Ionicons name={item.icon} size={20} color="#D97706" />
            </View>
            <View style={styles.textWrap}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>{item.title}</Text>
              <Text style={[styles.cardMeta, { color: colors.textMuted }]}>{item.description}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 20, paddingBottom: 120 },
  title: { fontSize: 30, fontWeight: "900", marginBottom: 6 },
  subtitle: { fontSize: 15, lineHeight: 22, marginBottom: 18 },
  cardStack: { gap: 12 },
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center"
  },
  textWrap: { flex: 1, gap: 4 },
  cardTitle: { fontSize: 16, fontWeight: "900" },
  cardMeta: { fontSize: 13, lineHeight: 19 }
});
