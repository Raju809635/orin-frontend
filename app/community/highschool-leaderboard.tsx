import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useMemo, useState } from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { api } from "@/lib/api";
import { getAppErrorMessage } from "@/lib/appError";
import { useAuth } from "@/context/AuthContext";
import { useAppTheme } from "@/context/ThemeContext";
import {
  AcademicEmpty,
  CommunitySection,
  HighSchoolCommunityShell,
  ProgressBar,
  StatusBadge
} from "@/components/community/highschool-ui";

type BoardEntry = { rank: number; userId?: string | null; name: string; score: number; profilePhotoUrl?: string };
type LeaderboardResponse = {
  collegeTop?: BoardEntry[];
  stateTop?: BoardEntry[];
  globalTop?: BoardEntry[];
  collegeName?: string;
  stateName?: string;
  me?: { collegeRank?: number | null; stateRank?: number | null; globalRank?: number | null; score?: number };
};
type ScopeKey = "school" | "state" | "global";

const TABS: { key: ScopeKey; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: "school", label: "School", icon: "school-outline" },
  { key: "state", label: "State", icon: "map-outline" },
  { key: "global", label: "Global", icon: "earth-outline" }
];

const PODIUM_META = [
  { rank: 2, bg: "#F4F6F8", accent: "#98A2B3", minHeight: 170 },
  { rank: 1, bg: "#FFF7D6", accent: "#F59E0B", minHeight: 198 },
  { rank: 3, bg: "#FBEAE4", accent: "#B45309", minHeight: 160 }
];

function initial(name?: string) {
  return String(name || "U").trim().charAt(0).toUpperCase() || "U";
}

export default function HighSchoolLeaderboardScreen() {
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [scope, setScope] = useState<ScopeKey>("school");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    try {
      if (refresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      const { data: response } = await api.get<LeaderboardResponse>("/api/network/leaderboard");
      setData(response || null);
    } catch (e) {
      setError(getAppErrorMessage(e, "Unable to load school leaderboard."));
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

  const entries = useMemo(() => {
    if (scope === "state") return data?.stateTop || [];
    if (scope === "global") return data?.globalTop || [];
    return data?.collegeTop || [];
  }, [data, scope]);

  const scopeTitle = scope === "school" ? data?.collegeName || "Your School" : scope === "state" ? data?.stateName || "Your State" : "Global";
  const myRank = scope === "school" ? data?.me?.collegeRank : scope === "state" ? data?.me?.stateRank : data?.me?.globalRank;
  const myEntry = useMemo(() => {
    const fromList = entries.find((item) => String(item.userId || "") === String(user?.id || ""));
    if (fromList) return fromList;
    if (myRank) return { rank: myRank, name: user?.name || "You", score: data?.me?.score || 0 };
    return null;
  }, [data?.me?.score, entries, myRank, user?.id, user?.name]);
  const nextTarget = myEntry ? entries.find((item) => item.rank === Math.max(1, myEntry.rank - 1)) || null : entries[0] || null;
  const xpGap = myEntry && nextTarget && nextTarget.rank < myEntry.rank ? Math.max(0, nextTarget.score - myEntry.score + 1) : null;
  const maxScore = Math.max(...entries.map((item) => Number(item.score || 0)), 1);

  return (
    <HighSchoolCommunityShell
      title="School Leaderboard"
      subtitle="After-12 leaderboard quality, reframed for academics: school, state and global ranks from quiz, streak, roadmap and challenge activity."
      stats={[
        { icon: "podium", label: "Scope", value: scopeTitle },
        { icon: "person", label: "Your rank", value: myRank ? `#${myRank}` : "-" },
        { icon: "flash", label: "Points", value: String(data?.me?.score || 0) }
      ]}
      loading={loading}
      error={error}
      refreshing={refreshing}
      onRefresh={() => load(true)}
    >
      <View style={styles.tabsRow}>
        {TABS.map((tab) => {
          const active = scope === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[
                styles.tabChip,
                { borderColor: colors.border, backgroundColor: colors.surface },
                active && { backgroundColor: "#16A34A", borderColor: "#16A34A" }
              ]}
              onPress={() => setScope(tab.key)}
            >
              <Ionicons name={tab.icon} size={15} color={active ? "#FFFFFF" : "#15803D"} />
              <Text style={[styles.tabText, { color: active ? "#FFFFFF" : "#15803D" }]}>{tab.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {entries.length ? (
        <>
          <CommunitySection title="Top 3 Podium" subtitle={`${scopeTitle} academic champions`} icon="podium">
            <View style={styles.podiumRow}>
              {PODIUM_META.map((slot) => {
                const entry = entries.find((item) => item.rank === slot.rank) || null;
                return (
                  <View
                    key={`podium-${slot.rank}`}
                    style={[styles.podiumCard, { backgroundColor: slot.bg, borderColor: slot.accent, minHeight: slot.minHeight }]}
                  >
                    <Ionicons name="medal-outline" size={24} color={slot.accent} />
                    {entry?.profilePhotoUrl ? (
                      <Image source={{ uri: entry.profilePhotoUrl }} style={styles.avatar} />
                    ) : (
                      <View style={[styles.avatar, styles.avatarFallback]}>
                        <Text style={styles.avatarText}>{initial(entry?.name)}</Text>
                      </View>
                    )}
                    <Text style={[styles.podiumRank, { color: slot.accent }]}>#{slot.rank}</Text>
                    <Text style={styles.podiumName} numberOfLines={1}>
                      {entry?.name || "Open"}
                    </Text>
                    <Text style={styles.podiumScore}>{entry?.score || 0} academic pts</Text>
                  </View>
                );
              })}
            </View>
          </CommunitySection>

          <CommunitySection title="Your Competitive Position" subtitle="Healthy academic progress, not pressure." icon="flash">
            {myEntry ? (
              <>
                <View style={styles.positionRow}>
                  <StatusBadge label={`Rank #${myEntry.rank}`} tone="success" />
                  <StatusBadge label={`${myEntry.score} points`} tone="primary" />
                </View>
                <Text style={[styles.positionTitle, { color: colors.text }]}>You are #{myEntry.rank} in {scopeTitle}</Text>
                <Text style={[styles.positionMeta, { color: colors.textMuted }]}>
                  {xpGap && nextTarget
                    ? `You need ${xpGap} more academic points to reach #${nextTarget.rank} (${nextTarget.name}).`
                    : "Keep completing quizzes, challenges and roadmap missions to move up."}
                </Text>
              </>
            ) : (
              <AcademicEmpty label="Your rank will appear after your first academic activity is counted." />
            )}
          </CommunitySection>

          <CommunitySection title="Full Rank List" subtitle="Score bars use the highest visible score as reference." icon="list">
            {entries.slice(0, 30).map((entry) => {
              const mine = String(entry.userId || "") === String(user?.id || "");
              return (
                <View
                  key={`${scope}-${entry.rank}-${entry.userId || entry.name}`}
                  style={[styles.rankRow, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }, mine && { borderColor: "#16A34A" }]}
                >
                  <View style={styles.rankLeft}>
                    <Text style={[styles.rankIndex, { color: mine ? "#15803D" : colors.textMuted }]}>#{entry.rank}</Text>
                    <View style={[styles.smallAvatar, styles.avatarFallback]}>
                      <Text style={styles.smallAvatarText}>{initial(entry.name)}</Text>
                    </View>
                    <View style={styles.rankText}>
                      <Text style={[styles.rankName, { color: colors.text }]} numberOfLines={1}>
                        {entry.name}{mine ? " · You" : ""}
                      </Text>
                      <ProgressBar progress={(entry.score / maxScore) * 100} tone={mine ? "#16A34A" : "#F59E0B"} />
                    </View>
                  </View>
                  <Text style={[styles.rankScore, { color: colors.textMuted }]}>{entry.score} pts</Text>
                </View>
              );
            })}
          </CommunitySection>
        </>
      ) : (
        <CommunitySection title="Leaderboard" icon="podium">
          <AcademicEmpty label="No ranking data yet for this scope." />
        </CommunitySection>
      )}
    </HighSchoolCommunityShell>
  );
}

const styles = StyleSheet.create({
  tabsRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  tabChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 999, borderWidth: 1 },
  tabText: { fontWeight: "900" },
  podiumRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 10 },
  podiumCard: { flex: 1, borderRadius: 18, borderWidth: 1, alignItems: "center", justifyContent: "flex-end", padding: 10, gap: 6 },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  avatarFallback: { backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#15803D", fontSize: 18, fontWeight: "900" },
  podiumRank: { fontSize: 18, fontWeight: "900" },
  podiumName: { color: "#111827", fontWeight: "900", textAlign: "center" },
  podiumScore: { color: "#475467", fontSize: 12, fontWeight: "800", textAlign: "center" },
  positionRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  positionTitle: { fontSize: 18, fontWeight: "900" },
  positionMeta: { lineHeight: 20, fontWeight: "700" },
  rankRow: { borderWidth: 1, borderRadius: 16, padding: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 },
  rankLeft: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  rankIndex: { width: 42, fontWeight: "900" },
  smallAvatar: { width: 34, height: 34, borderRadius: 17 },
  smallAvatarText: { color: "#15803D", fontWeight: "900" },
  rankText: { flex: 1, gap: 6 },
  rankName: { fontWeight: "900" },
  rankScore: { fontWeight: "900" }
});
