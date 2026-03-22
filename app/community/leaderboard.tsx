import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

type LeaderboardEntry = {
  rank: number;
  userId?: string | null;
  name: string;
  score: number;
  profilePhotoUrl?: string;
};

type LeaderboardResponse = {
  dateKey?: string;
  collegeName?: string;
  collegeTop: LeaderboardEntry[];
  globalTop?: LeaderboardEntry[];
  me?: {
    score?: number;
    collegeRank?: number | null;
    globalRank?: number | null;
  };
};

type LeaderboardTab = "college" | "state" | "global";

const TAB_CONFIG: { key: LeaderboardTab; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: "college", label: "College", icon: "school-outline" },
  { key: "state", label: "State", icon: "map-outline" },
  { key: "global", label: "Global", icon: "earth-outline" }
];

const PODIUM_META = [
  { slot: 2, emoji: "🥈", bg: "#F4F6F8", accent: "#98A2B3", height: 118 },
  { slot: 1, emoji: "🥇", bg: "#FFF7D6", accent: "#F59E0B", height: 146 },
  { slot: 3, emoji: "🥉", bg: "#FBEAE4", accent: "#B45309", height: 104 }
];

function getInitial(name?: string) {
  return String(name || "U").trim().charAt(0).toUpperCase() || "U";
}

export default function CommunityLeaderboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<LeaderboardTab>("college");

  const load = useCallback(async (refresh = false) => {
    try {
      if (refresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      const res = await api.get<LeaderboardResponse>("/api/network/leaderboard");
      setData(res.data || null);
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to load leaderboard.");
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

  const activeEntries = useMemo(() => {
    if (activeTab === "global") return data?.globalTop || [];
    if (activeTab === "state") return data?.globalTop || [];
    return data?.collegeTop || [];
  }, [activeTab, data?.collegeTop, data?.globalTop]);

  const activeTitle = useMemo(() => {
    if (activeTab === "college") return data?.collegeName ? `${data.collegeName} Leaderboard` : "College Leaderboard";
    if (activeTab === "state") return "State Leaderboard";
    return "Global Leaderboard";
  }, [activeTab, data?.collegeName]);

  const activeSubtitle = useMemo(() => {
    if (activeTab === "college") return "Compete with learners from your college and push toward the podium.";
    if (activeTab === "state") return "Regional competition view is using your broader global pool until state data is connected.";
    return "See where you stand against ORIN learners across the platform.";
  }, [activeTab]);

  const topThree = useMemo(
    () =>
      PODIUM_META.map((meta) => ({
        ...meta,
        entry: activeEntries.find((item) => item.rank === meta.slot) || null
      })),
    [activeEntries]
  );

  const myEntry = useMemo(() => {
    const fromList = activeEntries.find((item) => String(item.userId || "") === String(user?.id || ""));
    if (fromList) return fromList;
    if (activeTab === "college" && data?.me?.collegeRank) {
      return { rank: data.me.collegeRank, score: data.me.score || 0, name: user?.name || "You" };
    }
    if ((activeTab === "global" || activeTab === "state") && data?.me?.globalRank) {
      return { rank: data.me.globalRank, score: data.me.score || 0, name: user?.name || "You" };
    }
    return null;
  }, [activeEntries, activeTab, data?.me?.collegeRank, data?.me?.globalRank, data?.me?.score, user?.id, user?.name]);

  const nextTargetEntry = useMemo(() => {
    if (!myEntry) return activeEntries[0] || null;
    return activeEntries.find((item) => item.rank === Math.max(1, myEntry.rank - 1)) || null;
  }, [activeEntries, myEntry]);

  const xpGap = useMemo(() => {
    if (!myEntry || !nextTargetEntry || nextTargetEntry.rank >= myEntry.rank) return null;
    return Math.max(0, Number(nextTargetEntry.score || 0) - Number(myEntry.score || 0) + 1);
  }, [myEntry, nextTargetEntry]);

  const maxScore = Math.max(...activeEntries.map((item) => Number(item.score || 0)), 1);

  return (
    <ScrollView
      contentContainerStyle={styles.page}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.pageTitle}>{activeTitle}</Text>
      <Text style={styles.pageSub}>{activeSubtitle}</Text>

      <View style={styles.tabsRow}>
        {TAB_CONFIG.map((tab) => {
          const active = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tabChip, active && styles.tabChipActive]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Ionicons name={tab.icon} size={15} color={active ? "#FFFFFF" : "#1F7A4C"} />
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{tab.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading ? <ActivityIndicator size="large" color="#1F7A4C" /> : null}

      {!loading && activeEntries.length > 0 ? (
        <>
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="podium" size={16} color="#1F7A4C" />
              <Text style={styles.sectionTitle}>Top 3 Podium</Text>
            </View>

            <View style={styles.podiumRow}>
              {topThree.map((slot) => (
                <View
                  key={slot.slot}
                  style={[
                    styles.podiumCard,
                    { backgroundColor: slot.bg, borderColor: slot.accent, height: slot.height }
                  ]}
                >
                  <Text style={styles.podiumEmoji}>{slot.emoji}</Text>
                  {slot.entry?.profilePhotoUrl ? (
                    <Image source={{ uri: slot.entry.profilePhotoUrl }} style={styles.podiumAvatar} />
                  ) : (
                    <View style={[styles.podiumAvatar, styles.avatarFallback]}>
                      <Text style={styles.avatarText}>{getInitial(slot.entry?.name)}</Text>
                    </View>
                  )}
                  <Text style={styles.podiumRank}>#{slot.slot}</Text>
                  <Text style={styles.podiumName} numberOfLines={1}>
                    {slot.entry?.name || "Open"}
                  </Text>
                  <Text style={styles.podiumScore}>{slot.entry?.score ?? 0} XP</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="flash" size={16} color="#1F7A4C" />
              <Text style={styles.sectionTitle}>Your Competitive Position</Text>
            </View>
            {myEntry ? (
              <>
                <Text style={styles.myRankText}>
                  🔥 You are #{myEntry.rank} with {myEntry.score} XP
                </Text>
                <Text style={styles.gapText}>
                  {xpGap && nextTargetEntry
                    ? `🎯 You need ${xpGap} XP to reach #${nextTargetEntry.rank} (${nextTargetEntry.name})`
                    : "🏆 Keep building XP to push toward the top ranks"}
                </Text>
                <Text style={styles.percentText}>
                  {activeEntries.length > 0
                    ? `Top ${Math.max(1, Math.round((myEntry.rank / activeEntries.length) * 100))}% in this leaderboard`
                    : "Leaderboard ranking will appear here"}
                </Text>
              </>
            ) : (
              <Text style={styles.meta}>Your rank will appear after your leaderboard entry is generated.</Text>
            )}
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="list" size={16} color="#1F7A4C" />
              <Text style={styles.sectionTitle}>Full Rank List</Text>
            </View>
            {activeEntries.map((entry) => {
              const mine = String(entry.userId || "") === String(user?.id || "");
              const width = `${Math.max(12, Math.round((Number(entry.score || 0) / maxScore) * 100))}%`;
              return (
                <View key={`${activeTab}-${entry.rank}-${entry.userId || entry.name}`} style={[styles.rankRow, mine && styles.rankRowMine]}>
                  <View style={styles.rankLeft}>
                    <Text style={[styles.rankIndex, mine && styles.rankIndexMine]}>{entry.rank}.</Text>
                    {entry.profilePhotoUrl ? (
                      <Image source={{ uri: entry.profilePhotoUrl }} style={styles.rankAvatar} />
                    ) : (
                      <View style={[styles.rankAvatar, styles.avatarFallback]}>
                        <Text style={styles.rankAvatarText}>{getInitial(entry.name)}</Text>
                      </View>
                    )}
                    <View style={styles.rankTextWrap}>
                      <Text style={[styles.rankName, mine && styles.rankNameMine]} numberOfLines={1}>
                        {entry.name} {mine ? "🔥" : ""}
                      </Text>
                      <View style={styles.miniBarTrack}>
                        <View style={[styles.miniBarFill, { width }]} />
                      </View>
                    </View>
                  </View>
                  <Text style={[styles.rankScore, mine && styles.rankScoreMine]}>{entry.score} XP</Text>
                </View>
              );
            })}
          </View>
        </>
      ) : null}

      {!loading && activeEntries.length === 0 ? (
        <View style={styles.section}>
          <Text style={styles.meta}>Leaderboard unavailable right now.</Text>
        </View>
      ) : null}
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
    lineHeight: 21
  },
  tabsRow: {
    flexDirection: "row",
    gap: 8
  },
  tabChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#CFE8D6",
    backgroundColor: "#FFFFFF"
  },
  tabChipActive: {
    backgroundColor: "#1F7A4C",
    borderColor: "#1F7A4C"
  },
  tabText: {
    color: "#1F7A4C",
    fontWeight: "800"
  },
  tabTextActive: {
    color: "#FFFFFF"
  },
  section: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E4E7EC",
    padding: 14,
    gap: 12
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
  podiumRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 10
  },
  podiumCard: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
    paddingVertical: 12
  },
  podiumEmoji: {
    fontSize: 24
  },
  podiumAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    marginTop: 6
  },
  avatarFallback: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E8F5EE"
  },
  avatarText: {
    color: "#0B3D2E",
    fontWeight: "800",
    fontSize: 18
  },
  podiumRank: {
    marginTop: 8,
    color: "#344054",
    fontWeight: "900"
  },
  podiumName: {
    marginTop: 4,
    color: "#11261E",
    fontWeight: "800",
    textAlign: "center"
  },
  podiumScore: {
    marginTop: 2,
    color: "#667085",
    fontWeight: "700"
  },
  myRankText: {
    color: "#11261E",
    fontWeight: "900",
    fontSize: 18
  },
  gapText: {
    color: "#1F7A4C",
    fontWeight: "800"
  },
  percentText: {
    color: "#667085",
    fontWeight: "700"
  },
  rankRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E4E7EC",
    padding: 12
  },
  rankRowMine: {
    backgroundColor: "#EEF8F2",
    borderColor: "#9AD7AF"
  },
  rankLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1
  },
  rankIndex: {
    width: 28,
    color: "#667085",
    fontWeight: "800"
  },
  rankIndexMine: {
    color: "#1F7A4C"
  },
  rankAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20
  },
  rankAvatarText: {
    color: "#0B3D2E",
    fontWeight: "800"
  },
  rankTextWrap: {
    flex: 1,
    gap: 6
  },
  rankName: {
    color: "#11261E",
    fontWeight: "800"
  },
  rankNameMine: {
    color: "#14532D"
  },
  miniBarTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: "#E5E7EB",
    overflow: "hidden"
  },
  miniBarFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#1F7A4C"
  },
  rankScore: {
    color: "#475467",
    fontWeight: "900"
  },
  rankScoreMine: {
    color: "#1F7A4C"
  },
  meta: {
    color: "#667085"
  },
  error: {
    color: "#B42318"
  }
});
