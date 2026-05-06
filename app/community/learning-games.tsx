import React from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useLearner } from "@/context/LearnerContext";
import { isKidStage } from "@/lib/learnerExperience";
import { useAppTheme } from "@/context/ThemeContext";

type GameCard = {
  title: string;
  subtitle: string;
  emoji: string;
  icon: keyof typeof Ionicons.glyphMap;
  reward: string;
  path?: string;
  colors: [string, string];
};

const kidGames: GameCard[] = [
  {
    title: "Quiz Battle",
    subtitle: "Play a quick quiz and beat your best score.",
    emoji: "🏆",
    icon: "trophy",
    reward: "+20 stars",
    path: "/ai/kids-learning-games",
    colors: ["#0F9F6E", "#063B2C"]
  },
  {
    title: "Speed Math",
    subtitle: "Solve fast. Score high. Keep your streak.",
    emoji: "⏱️",
    icon: "calculator",
    reward: "+15 stars",
    path: "/ai/reading-and-numbers?subject=Math",
    colors: ["#2563EB", "#172554"]
  },
  {
    title: "Memory Match",
    subtitle: "Match pairs and train your memory.",
    emoji: "🧠",
    icon: "albums",
    reward: "+10 stars",
    colors: ["#7C3AED", "#2E1065"]
  },
  {
    title: "Word Builder",
    subtitle: "Make words and grow vocabulary.",
    emoji: "🔤",
    icon: "text",
    reward: "+12 stars",
    path: "/ai/reading-and-numbers?subject=English",
    colors: ["#EA580C", "#431407"]
  },
  {
    title: "Daily Challenge",
    subtitle: "Complete today&apos;s mission and claim rewards.",
    emoji: "🎁",
    icon: "gift",
    reward: "streak bonus",
    path: "/student-dashboard?section=overview&openQuiz=1",
    colors: ["#DB2777", "#500724"]
  },
  {
    title: "Streak Game",
    subtitle: "Login daily and keep the fire alive.",
    emoji: "🔥",
    icon: "flame",
    reward: "+10 bonus",
    path: "/student-dashboard?section=overview",
    colors: ["#DC2626", "#450A0A"]
  }
];

const highSchoolGames: GameCard[] = [
  {
    title: "Quiz Battle",
    subtitle: "Subject battle for class rank and XP.",
    emoji: "⚔️",
    icon: "trophy",
    reward: "+50 XP",
    path: "/community/highschool-quiz-battle",
    colors: ["#0F766E", "#0F172A"]
  },
  {
    title: "Speed Math Challenge",
    subtitle: "Aptitude, mental math, and timed practice.",
    emoji: "⏱️",
    icon: "calculator",
    reward: "+25 XP",
    path: "/ai/reading-and-numbers?subject=Math",
    colors: ["#1D4ED8", "#111827"]
  },
  {
    title: "Memory Match",
    subtitle: "Formula, vocabulary, and concept matching.",
    emoji: "🧩",
    icon: "albums",
    reward: "+20 XP",
    colors: ["#6D28D9", "#111827"]
  },
  {
    title: "Word Builder",
    subtitle: "English vocabulary and grammar speed round.",
    emoji: "📚",
    icon: "text",
    reward: "+20 XP",
    path: "/ai/highschool-study-assistant",
    colors: ["#B45309", "#111827"]
  },
  {
    title: "Daily Challenge",
    subtitle: "Complete daily quiz, build streak, climb board.",
    emoji: "🎯",
    icon: "flash",
    reward: "streak XP",
    path: "/student-dashboard?section=overview&openQuiz=1",
    colors: ["#BE123C", "#111827"]
  },
  {
    title: "Tournament Mode",
    subtitle: "Class vs class and school weekly cups.",
    emoji: "🏅",
    icon: "podium",
    reward: "badge + certificate",
    path: "/community/highschool-school-challenges",
    colors: ["#CA8A04", "#111827"]
  }
];

export default function LearningGamesCommunityScreen() {
  const router = useRouter();
  const { colors, isDark } = useAppTheme();
  const { learnerStage } = useLearner();
  const isKid = isKidStage(learnerStage);
  const games = isKid ? kidGames : highSchoolGames;
  const title = isKid ? "Learning Games" : "Quiz Battle & Study Games";
  const subtitle = isKid
    ? "Play, learn, collect stars, and climb your school Star Board."
    : "Practice subjects, win XP, keep streaks, and climb the school leaderboard.";

  return (
    <ScrollView contentContainerStyle={[styles.page, { backgroundColor: colors.background }]} showsVerticalScrollIndicator={false}>
      <LinearGradient
        colors={isKid ? ["#072E22", "#0F9F6E"] : ["#0F172A", "#0F766E"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <Text style={styles.heroKicker}>ORIN - Learn. Compete. Grow.</Text>
        <Text style={styles.heroTitle}>{title}</Text>
        <Text style={styles.heroSub}>{subtitle}</Text>
        <View style={styles.rewardStrip}>
          <Text style={styles.rewardStripText}>{isKid ? "⭐ Correct +2" : "✅ Correct +5 XP"}</Text>
          <Text style={styles.rewardStripText}>{isKid ? "🔥 Streak +10" : "⚡ Fast +2 XP"}</Text>
          <Text style={styles.rewardStripText}>{isKid ? "🏆 Win +20" : "🏆 Win +50 XP"}</Text>
        </View>
      </LinearGradient>

      <View style={styles.grid}>
        {games.map((game) => (
          <TouchableOpacity
            key={game.title}
            activeOpacity={0.9}
            onPress={() => {
              if (game.path) router.push(game.path as never);
            }}
          >
            <LinearGradient
              colors={game.colors}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.gameCard, { borderColor: isDark ? "rgba(255,255,255,0.18)" : "rgba(15,118,110,0.2)" }]}
            >
              <Text style={styles.gameEmoji}>{game.emoji}</Text>
              <View style={styles.gameIcon}>
                <Ionicons name={game.icon} size={20} color="#FFFFFF" />
              </View>
              <Text style={styles.gameTitle}>{game.title}</Text>
              <Text style={styles.gameSub}>{game.subtitle}</Text>
              <View style={styles.gameFooter}>
                <Text style={styles.rewardText}>{game.reward}</Text>
                <Ionicons name={game.path ? "chevron-forward" : "lock-closed"} size={18} color="#FDE68A" />
              </View>
            </LinearGradient>
          </TouchableOpacity>
        ))}
      </View>

      <View style={[styles.noteCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.noteTitle, { color: colors.text }]}>How rewards work</Text>
        <Text style={[styles.noteText, { color: colors.textMuted }]}>
          {isKid
            ? "Play games, finish daily challenges, earn stars, unlock badges, and rise on the Star Board."
            : "Practice daily, earn XP, keep your streak alive, win battles, and climb the School Leaderboard."}
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flexGrow: 1, padding: 18, paddingBottom: 120, gap: 16 },
  hero: { borderRadius: 28, padding: 20, gap: 8, overflow: "hidden" },
  heroKicker: { color: "#BBF7D0", fontSize: 12, fontWeight: "900", letterSpacing: 0.7, textTransform: "uppercase" },
  heroTitle: { color: "#FFFFFF", fontSize: 30, fontWeight: "900", lineHeight: 36 },
  heroSub: { color: "#D1FAE5", fontSize: 14, fontWeight: "700", lineHeight: 21 },
  rewardStrip: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  rewardStripText: { color: "#052E16", backgroundColor: "#FDE68A", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, fontWeight: "900", fontSize: 12 },
  grid: { gap: 12 },
  gameCard: { minHeight: 158, borderRadius: 24, padding: 16, borderWidth: 1, overflow: "hidden" },
  gameEmoji: { position: "absolute", right: 16, top: 14, fontSize: 42, opacity: 0.95 },
  gameIcon: { width: 42, height: 42, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.16)", marginBottom: 12 },
  gameTitle: { color: "#FFFFFF", fontSize: 20, fontWeight: "900", maxWidth: "78%" },
  gameSub: { color: "#E0F2FE", fontSize: 13, fontWeight: "700", lineHeight: 19, marginTop: 5, maxWidth: "86%" },
  gameFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: "auto", paddingTop: 14 },
  rewardText: { color: "#FDE68A", fontWeight: "900", fontSize: 13 },
  noteCard: { borderWidth: 1, borderRadius: 18, padding: 14, gap: 6 },
  noteTitle: { fontWeight: "900", fontSize: 16 },
  noteText: { fontWeight: "700", lineHeight: 20 }
});
