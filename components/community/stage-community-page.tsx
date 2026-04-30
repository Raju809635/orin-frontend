import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { useAppTheme } from "@/context/ThemeContext";

type CommunityCard = {
  title: string;
  description: string;
  path: string;
  icon: keyof typeof Ionicons.glyphMap;
};

type StageCommunityPageProps = {
  title: string;
  subtitle: string;
  tone: "kid" | "highschool";
  cards: CommunityCard[];
};

export default function StageCommunityPage({ title, subtitle, tone, cards }: StageCommunityPageProps) {
  const router = useRouter();
  const { colors, isDark } = useAppTheme();

  const accent = tone === "kid" ? "#16A34A" : "#2563EB";
  const background = tone === "kid"
    ? isDark ? "rgba(34,197,94,0.16)" : "#DCFCE7"
    : isDark ? "rgba(59,130,246,0.16)" : "#DBEAFE";

  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.subtitle, { color: colors.textMuted }]}>{subtitle}</Text>

      <View style={styles.cardStack}>
        {cards.map((card) => (
          <TouchableOpacity
            key={card.title}
            style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => router.push(card.path as never)}
          >
            <View style={[styles.iconWrap, { backgroundColor: background }]}>
              <Ionicons name={card.icon} size={20} color={accent} />
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
