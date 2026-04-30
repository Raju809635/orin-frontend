import { Ionicons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAppTheme } from "@/context/ThemeContext";

type HighSchoolSectionId = "groups" | "challenges" | "resources" | "achievements";

const SECTION_OPTIONS: { id: HighSchoolSectionId; label: string }[] = [
  { id: "groups", label: "Study Groups" },
  { id: "challenges", label: "School Challenges" },
  { id: "resources", label: "Resource Library" },
  { id: "achievements", label: "Achievements" }
];

const SECTION_CONTENT: Record<
  HighSchoolSectionId,
  { title: string; note: string; cards: { title: string; description: string; path: string; icon: keyof typeof Ionicons.glyphMap }[] }
> = {
  groups: {
    title: "Study Groups",
    note: "Keep the same collaboration engine, but guide learners into school-focused groups and institution-first discussion.",
    cards: [
      {
        title: "Open Study Groups",
        description: "Use the collaboration area for school projects, subject groups, and guided discussions.",
        path: "/community/collaboration",
        icon: "people"
      },
      {
        title: "School Feed",
        description: "Open institution updates, announcements, and school-first participation.",
        path: "/network?section=institution",
        icon: "newspaper"
      }
    ]
  },
  challenges: {
    title: "School Challenges",
    note: "Academic and institution challenges continue using the current ORIN challenge system, but with study-oriented entry points.",
    cards: [
      {
        title: "Open Challenges",
        description: "View school competitions, institution tasks, and community challenge entries.",
        path: "/community/challenges",
        icon: "trophy"
      },
      {
        title: "Study Planner Link",
        description: "Pair challenges with a simpler study plan before you submit your work.",
        path: "/ai/study-planner",
        icon: "calendar"
      }
    ]
  },
  resources: {
    title: "Resource Library",
    note: "Use the existing knowledge library and roadmap areas through school-first wrappers.",
    cards: [
      {
        title: "Knowledge Library",
        description: "Open notes, guides, mentor uploads, and institution learning resources.",
        path: "/community/knowledge-library",
        icon: "library"
      },
      {
        title: "Institution Activities",
        description: "Open roadmap-based study activities and institution learning plans.",
        path: "/ai/career-roadmap?section=institution",
        icon: "map"
      }
    ]
  },
  achievements: {
    title: "Achievements",
    note: "Recognition, progress, and school standings stay connected to the existing leaderboard and certification systems.",
    cards: [
      {
        title: "Open Certifications",
        description: "View earned certificates, participation records, and mentor recognition.",
        path: "/community/certifications",
        icon: "ribbon"
      },
      {
        title: "Open Leaderboard",
        description: "Track school rank, institution performance, and active challenge standing.",
        path: "/community/leaderboard",
        icon: "podium"
      }
    ]
  }
};

export default function HighSchoolCommunityScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ section?: string }>();
  const { colors, isDark } = useAppTheme();

  const activeSection = useMemo<HighSchoolSectionId>(() => {
    const value = String(params.section || "").trim().toLowerCase();
    if (value === "challenges" || value === "resources" || value === "achievements") return value;
    return "groups";
  }, [params.section]);

  const content = SECTION_CONTENT[activeSection];

  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.text }]}>High School Community</Text>
      <Text style={[styles.subtitle, { color: colors.textMuted }]}>
        Open school-first community modules for study groups, challenges, resources, and achievements without losing the working ORIN flows underneath.
      </Text>

      <View style={styles.chipRow}>
        {SECTION_OPTIONS.map((item) => {
          const active = item.id === activeSection;
          return (
            <TouchableOpacity
              key={item.id}
              style={[
                styles.chip,
                {
                  borderColor: active ? colors.accent : colors.border,
                  backgroundColor: active ? colors.accentSoft : colors.surface
                }
              ]}
              onPress={() => router.replace(`/community/highschool-community?section=${item.id}` as never)}
            >
              <Text style={[styles.chipText, { color: active ? colors.accent : colors.textMuted }]}>{item.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={[styles.heroCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.heroTitle, { color: colors.text }]}>{content.title}</Text>
        <Text style={[styles.heroMeta, { color: colors.textMuted }]}>{content.note}</Text>
      </View>

      <View style={styles.cardStack}>
        {content.cards.map((card) => (
          <TouchableOpacity
            key={card.title}
            style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => router.push(card.path as never)}
          >
            <View style={[styles.iconWrap, { backgroundColor: isDark ? "rgba(59,130,246,0.16)" : "#DBEAFE" }]}>
              <Ionicons name={card.icon} size={20} color="#2563EB" />
            </View>
            <View style={styles.textWrap}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>{card.title}</Text>
              <Text style={[styles.cardMeta, { color: colors.textMuted }]}>{card.description}</Text>
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
  subtitle: { fontSize: 15, lineHeight: 22, marginBottom: 16 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  chipText: { fontWeight: "800" },
  heroCard: { borderWidth: 1, borderRadius: 16, padding: 16, marginBottom: 14 },
  heroTitle: { fontSize: 20, fontWeight: "900", marginBottom: 6 },
  heroMeta: { lineHeight: 20 },
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
