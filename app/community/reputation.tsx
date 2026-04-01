import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/lib/api";
import { useAppTheme } from "@/context/ThemeContext";

type ReputationSummary = {
  score: number;
  levelTag: string;
  topPercent: number;
  breakdown?: Record<string, number>;
};

type DailyDashboard = {
  streakDays?: number;
  xp?: number;
  levelTag?: string;
  reputationScore?: number;
};

type LevelMeta = {
  label: string;
  icon: string;
  minXp: number;
  nextXp: number | null;
};

const LEVELS: LevelMeta[] = [
  { label: "Starter", icon: "seedling", minXp: 0, nextXp: 100 },
  { label: "Explorer", icon: "compass", minXp: 100, nextXp: 250 },
  { label: "Builder", icon: "construct", minXp: 250, nextXp: 500 },
  { label: "Pro", icon: "flash", minXp: 500, nextXp: 900 },
  { label: "Elite", icon: "trophy", minXp: 900, nextXp: 1400 },
  { label: "Legend", icon: "diamond", minXp: 1400, nextXp: null }
];

function resolveLevel(xp: number, fallback?: string) {
  const normalized = Math.max(0, Number(xp || 0));
  const derived =
    [...LEVELS].reverse().find((item) => normalized >= item.minXp) || LEVELS[0];

  if (!fallback) return derived;
  const match = LEVELS.find((item) => item.label.toLowerCase() === String(fallback).toLowerCase());
  return match || derived;
}

function prettyLabel(key: string) {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim();
}

export default function CommunityReputationPage() {
  const { colors } = useAppTheme();
  const [data, setData] = useState<ReputationSummary | null>(null);
  const [daily, setDaily] = useState<DailyDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    try {
      if (refresh) setRefreshing(true);
      else setLoading(true);

      setError(null);
      const [reputationRes, dailyRes] = await Promise.allSettled([
        api.get<ReputationSummary>("/api/network/reputation-summary"),
        api.get<DailyDashboard>("/api/network/daily-dashboard")
      ]);

      setData(reputationRes.status === "fulfilled" ? reputationRes.value.data || null : null);
      setDaily(dailyRes.status === "fulfilled" ? dailyRes.value.data || null : null);

      if (reputationRes.status === "rejected" && dailyRes.status === "rejected") {
        throw reputationRes.reason || dailyRes.reason;
      }
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to load XP details.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const xp = Math.max(0, Number(daily?.xp ?? data?.score ?? 0));
  const streakDays = Math.max(0, Number(daily?.streakDays || 0));
  const level = useMemo(() => resolveLevel(xp, daily?.levelTag || data?.levelTag), [xp, daily?.levelTag, data?.levelTag]);
  const nextXp = level.nextXp;
  const progress = nextXp
    ? Math.min(1, Math.max(0, (xp - level.minXp) / Math.max(1, nextXp - level.minXp)))
    : 1;
  const xpToNext = nextXp ? Math.max(0, nextXp - xp) : 0;
  const todayProgress = Math.min(100, Math.max(0, streakDays > 0 ? 40 + streakDays * 8 : 20));
  const breakdownEntries = Object.entries(data?.breakdown || {}).filter(([, value]) => Number(value) > 0);

  const badgeList = useMemo(() => {
    const badges: string[] = [];
    if (xp >= 10) badges.push("First Step");
    if (streakDays >= 3) badges.push("3 Day Streak");
    if (streakDays >= 7) badges.push("7 Day Streak");
    if (xp >= 250) badges.push("Builder");
    if (xp >= 500) badges.push("Pro Circle");
    if (xp >= 900) badges.push("Elite Performer");
    return badges.length ? badges : ["Starter Badge"];
  }, [streakDays, xp]);

  return (
    <ScrollView
      contentContainerStyle={[styles.page, { backgroundColor: colors.background }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
      showsVerticalScrollIndicator={false}
    >
      <Text style={[styles.pageTitle, { color: colors.text }]}>Reputation & Ranking</Text>
      <Text style={[styles.pageSub, { color: colors.textMuted }]}>Turn your daily ORIN activity into XP, levels, streaks, and visible progress.</Text>

      <View style={styles.heroCard}>
        <View style={styles.heroTop}>
          <View>
            <Text style={styles.heroEyebrow}>XP</Text>
            <Text style={styles.heroValue}>{xp}</Text>
            <Text style={styles.heroMeta}>Top {data?.topPercent ?? "-"}% on ORIN</Text>
          </View>
          <View style={styles.levelPill}>
            <Ionicons name={level.icon as any} size={16} color="#FFFFFF" />
            <Text style={styles.levelPillText}>{level.label}</Text>
          </View>
        </View>

        <Text style={styles.levelText}>
          {level.label}
          {nextXp ? ` | Next level at ${nextXp} XP` : " | Max tier reached"}
        </Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </View>
        <Text style={styles.progressMeta}>
          {nextXp ? `${xpToNext} XP needed for the next rank` : "You have reached the current top rank"}
        </Text>
      </View>

      <View style={styles.row}>
        <View style={[styles.statCard, styles.rowCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={styles.statLabel}>Streak</Text>
          <Text style={styles.statValue}>{streakDays} days</Text>
          <Text style={styles.statHint}>Come back daily to keep momentum.</Text>
        </View>
        <View style={[styles.statCard, styles.rowCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={styles.statLabel}>Today</Text>
          <Text style={styles.statValue}>{todayProgress}%</Text>
          <Text style={styles.statHint}>Complete one more action to push your XP.</Text>
        </View>
      </View>

      <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.sectionHeader}>
          <Ionicons name="flash" size={16} color="#1F7A4C" />
          <Text style={[styles.sectionTitle, { color: colors.text }]}>How to Earn XP</Text>
        </View>
        <View style={styles.earnList}>
          <Text style={[styles.earnItem, { color: colors.text }]}>Post updates -> +10 XP</Text>
          <Text style={[styles.earnItem, { color: colors.text }]}>Add a project -> +30 XP</Text>
          <Text style={[styles.earnItem, { color: colors.text }]}>Help in your circle -> +20 XP</Text>
          <Text style={[styles.earnItem, { color: colors.text }]}>Daily login / quiz streak -> +5 XP and bonus streak rewards</Text>
        </View>
      </View>

      <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.sectionHeader}>
          <Ionicons name="stats-chart" size={16} color="#1F7A4C" />
          <Text style={[styles.sectionTitle, { color: colors.text }]}>XP Impact</Text>
        </View>
        {loading ? <ActivityIndicator size="large" color="#1F7A4C" /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {!loading && breakdownEntries.length === 0 ? (
          <Text style={[styles.meta, { color: colors.textMuted }]}>Start posting, learning, and contributing to build your XP breakdown.</Text>
        ) : null}
        {breakdownEntries.map(([key, value]) => {
          const xpValue = Number(value) * 10;
          return (
            <View key={key} style={styles.impactRow}>
              <Text style={[styles.impactLabel, { color: colors.text }]}>{prettyLabel(key)}</Text>
              <Text style={styles.impactValue}>
                {value} actions (+{xpValue} XP)
              </Text>
            </View>
          );
        })}
      </View>

      <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.sectionHeader}>
          <Ionicons name="ribbon" size={16} color="#1F7A4C" />
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Badges</Text>
        </View>
        <View style={styles.badgeWrap}>
          {badgeList.map((badge) => (
            <View key={badge} style={[styles.badgeChip, { backgroundColor: colors.accentSoft, borderColor: colors.border }]}>
              <Text style={[styles.badgeText, { color: colors.accent }]}>{badge}</Text>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    padding: 16,
    backgroundColor: "#F3F6FB",
    gap: 12
  },
  pageTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: "#11261E"
  },
  pageSub: {
    color: "#667085",
    lineHeight: 22
  },
  heroCard: {
    backgroundColor: "#0F7B45",
    borderRadius: 18,
    padding: 16,
    gap: 10
  },
  heroTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12
  },
  heroEyebrow: {
    color: "#D1FADF",
    fontWeight: "800",
    fontSize: 13
  },
  heroValue: {
    marginTop: 4,
    color: "#FFFFFF",
    fontSize: 34,
    fontWeight: "900"
  },
  heroMeta: {
    marginTop: 4,
    color: "#E4F5EA",
    fontWeight: "600"
  },
  levelPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.18)",
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  levelPillText: {
    color: "#FFFFFF",
    fontWeight: "800"
  },
  levelText: {
    color: "#FFFFFF",
    fontWeight: "700"
  },
  progressTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.22)",
    overflow: "hidden"
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#FFD166"
  },
  progressMeta: {
    color: "#EAF6EF",
    fontWeight: "700"
  },
  row: {
    flexDirection: "row",
    gap: 10
  },
  rowCard: {
    flex: 1
  },
  statCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E4E7EC",
    padding: 14
  },
  statLabel: {
    color: "#667085",
    fontWeight: "700"
  },
  statValue: {
    marginTop: 8,
    color: "#11261E",
    fontSize: 24,
    fontWeight: "900"
  },
  statHint: {
    marginTop: 6,
    color: "#667085",
    lineHeight: 20
  },
  section: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E4E7EC",
    padding: 14,
    gap: 10
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  sectionTitle: {
    fontWeight: "800",
    color: "#1E2B24"
  },
  earnList: {
    gap: 8
  },
  earnItem: {
    color: "#344054",
    fontWeight: "700"
  },
  impactRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12
  },
  impactLabel: {
    color: "#344054",
    fontWeight: "700",
    flex: 1
  },
  impactValue: {
    color: "#0F7B45",
    fontWeight: "800"
  },
  badgeWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  badgeChip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#EEF8F2",
    borderWidth: 1,
    borderColor: "#CFE8D6"
  },
  badgeText: {
    color: "#14532D",
    fontWeight: "800"
  },
  meta: {
    color: "#667085"
  },
  error: {
    color: "#B42318"
  }
});
