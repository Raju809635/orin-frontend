import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { useAppTheme } from "@/context/ThemeContext";

const EXPLORER_PATHS = [
  {
    title: "Study Planner",
    description: "Turn subjects, revision goals, and current strengths into a study path.",
    path: "/ai/study-planner",
    icon: "calendar"
  },
  {
    title: "Subject Gap Analyzer",
    description: "Compare what you already know with what your next academic goal needs.",
    path: "/ai/skill-gap",
    icon: "analytics"
  },
  {
    title: "Project Ideas",
    description: "Generate practical school-friendly ideas for projects, portfolios, and exhibitions.",
    path: "/ai/project-ideas",
    icon: "bulb"
  },
  {
    title: "Teacher & Mentor Support",
    description: "Open ORIN assistant for guidance on streams, habits, study doubts, and next steps.",
    path: "/ai/assistant",
    icon: "chatbubbles"
  }
] as const;

export default function CareerExplorerScreen() {
  const router = useRouter();
  const { colors, isDark } = useAppTheme();

  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.text }]}>Career Explorer</Text>
      <Text style={[styles.subtitle, { color: colors.textMuted }]}>
        Open guided academic tools for subjects, projects, study planning, and future direction without the full after-12 career stack.
      </Text>

      <View style={styles.sectionCardWrap}>
        {EXPLORER_PATHS.map((item) => (
          <TouchableOpacity
            key={item.title}
            style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => router.push(item.path as never)}
          >
            <View style={[styles.iconWrap, { backgroundColor: isDark ? "rgba(56,189,248,0.16)" : "#E0F2FE" }]}>
              <Ionicons name={item.icon} size={20} color="#0284C7" />
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
  sectionCardWrap: { gap: 12 },
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
