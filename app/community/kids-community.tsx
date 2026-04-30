import { Ionicons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAppTheme } from "@/context/ThemeContext";

type KidSectionId = "activities" | "rewards" | "resources" | "groups";

const SECTION_OPTIONS: { id: KidSectionId; label: string }[] = [
  { id: "activities", label: "Fun Challenges" },
  { id: "rewards", label: "Star Rewards" },
  { id: "resources", label: "Class Resources" },
  { id: "groups", label: "Group Activities" }
];

const SECTION_CONTENT: Record<
  KidSectionId,
  { title: string; note: string; cards: { title: string; description: string; path: string; icon: keyof typeof Ionicons.glyphMap }[] }
> = {
  activities: {
    title: "Fun Challenges",
    note: "Short, school-friendly challenge spaces powered by the existing ORIN challenge system.",
    cards: [
      {
        title: "Open School Challenges",
        description: "See institution and class-friendly challenge cards with simpler labels.",
        path: "/community/challenges",
        icon: "trophy"
      },
      {
        title: "Teacher Activities",
        description: "Open mentor-guided activities from the Journey roadmap area.",
        path: "/ai/career-roadmap?section=institution",
        icon: "map"
      }
    ]
  },
  rewards: {
    title: "Star Rewards",
    note: "Recognition stays connected to the existing certification system, but with simpler school language.",
    cards: [
      {
        title: "View My Rewards",
        description: "Open earned rewards, badges, and simple recognition items.",
        path: "/community/certifications",
        icon: "ribbon"
      },
      {
        title: "School Star Board",
        description: "See stars and class-friendly ranking through the leaderboard system.",
        path: "/community/leaderboard",
        icon: "podium"
      }
    ]
  },
  resources: {
    title: "Class Resources",
    note: "Open classroom resources and institution material through the existing knowledge library.",
    cards: [
      {
        title: "Class Resource Library",
        description: "Open simple school-friendly resources for reading, practice, and revision.",
        path: "/community/knowledge-library?section=institution",
        icon: "library"
      },
      {
        title: "Creative Support",
        description: "Use ORIN creative tools for story, drawing, and classroom expression tasks.",
        path: "/ai/creative-corner",
        icon: "color-wand"
      }
    ]
  },
  groups: {
    title: "Group Activities",
    note: "Safer group participation and school-first interaction without full open community complexity.",
    cards: [
      {
        title: "School Home Feed",
        description: "Open institution-only posts, updates, and teacher-friendly announcements.",
        path: "/network?section=institution",
        icon: "newspaper"
      },
      {
        title: "Teacher Groups",
        description: "Open the collaboration area for guided group participation and activity sharing.",
        path: "/community/collaboration",
        icon: "people"
      }
    ]
  }
};

export default function KidsCommunityScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ section?: string }>();
  const { colors, isDark } = useAppTheme();

  const activeSection = useMemo<KidSectionId>(() => {
    const value = String(params.section || "").trim().toLowerCase();
    if (value === "rewards" || value === "resources" || value === "groups") return value;
    return "activities";
  }, [params.section]);

  const content = SECTION_CONTENT[activeSection];

  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.text }]}>Kids Community</Text>
      <Text style={[styles.subtitle, { color: colors.textMuted }]}>
        Open school-safe community spaces built around activities, rewards, class resources, and teacher-guided participation.
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
              onPress={() => router.replace(`/community/kids-community?section=${item.id}` as never)}
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
            <View style={[styles.iconWrap, { backgroundColor: isDark ? "rgba(34,197,94,0.16)" : "#DCFCE7" }]}>
              <Ionicons name={card.icon} size={20} color="#16A34A" />
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
