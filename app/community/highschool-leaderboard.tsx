import React, { useCallback, useMemo, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { api } from "@/lib/api";
import { getAppErrorMessage } from "@/lib/appError";
import { EmptyState, StageCommunityScaffold, StageListCard, StageSection, StageStatRow } from "@/components/community/stage-community-data-ui";
import { useAppTheme } from "@/context/ThemeContext";

type BoardEntry = { rank: number; name: string; score: number };
type LeaderboardResponse = {
  collegeTop?: BoardEntry[];
  stateTop?: BoardEntry[];
  globalTop?: BoardEntry[];
  collegeName?: string;
  stateName?: string;
  me?: { collegeRank?: number | null; stateRank?: number | null; globalRank?: number | null; score?: number };
};

type ScopeKey = "school" | "state" | "global";

export default function HighSchoolLeaderboardScreen() {
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

  const scopedEntries = useMemo(() => {
    if (scope === "state") return data?.stateTop || [];
    if (scope === "global") return data?.globalTop || [];
    return data?.collegeTop || [];
  }, [data?.collegeTop, data?.globalTop, data?.stateTop, scope]);

  const scopeTitle = scope === "school" ? data?.collegeName || "Your School" : scope === "state" ? data?.stateName || "Your State" : "Global";
  const myRank = scope === "school" ? data?.me?.collegeRank : scope === "state" ? data?.me?.stateRank : data?.me?.globalRank;
  const podium = scopedEntries.slice(0, 3);
  const podiumSlots = [podium[1], podium[0], podium[2]];

  return (
    <StageCommunityScaffold
      eyebrow="High School Community"
      title="School Leaderboard"
      subtitle="Track your School, State, and Global academic ranking using quiz, streak, and challenge performance."
      loading={loading}
      error={error}
      refreshing={refreshing}
      onRefresh={() => load(true)}
    >
      <StageStatRow
        items={[
          { label: "Scope", value: scopeTitle },
          { label: "Your rank", value: myRank ? `#${myRank}` : "-" },
          { label: "Score", value: String(data?.me?.score || 0) }
        ]}
      />

      <View style={styles.scopeRow}>
        {[
          { id: "school", label: "School" },
          { id: "state", label: "State" },
          { id: "global", label: "Global" }
        ].map((item) => {
          const active = scope === item.id;
          return (
            <TouchableOpacity
              key={item.id}
              style={[
                styles.scopeChip,
                { borderColor: active ? colors.accent : colors.border, backgroundColor: active ? colors.accentSoft : colors.surfaceAlt }
              ]}
              onPress={() => setScope(item.id as ScopeKey)}
            >
              <Text style={[styles.scopeText, { color: active ? colors.accent : colors.textMuted }]}>{item.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <StageSection title={`${scopeTitle} Top Students`} icon="podium">
        <View style={styles.podiumRow}>
          {podiumSlots.map((entry, idx) => (
            <View
              key={`podium-${idx}-${entry?.name || "empty"}`}
              style={[
                styles.podiumCard,
                { borderColor: colors.border, backgroundColor: colors.surfaceAlt },
                idx === 1 ? styles.podiumCenter : null
              ]}
            >
              <Text style={[styles.podiumRank, { color: idx === 1 ? "#D4A017" : colors.textMuted }]}>{entry ? `#${entry.rank}` : "-"}</Text>
              <Text style={[styles.podiumName, { color: colors.text }]} numberOfLines={1}>
                {entry?.name || "—"}
              </Text>
              <Text style={[styles.podiumScore, { color: colors.textMuted }]}>{entry ? `${entry.score} pts` : ""}</Text>
            </View>
          ))}
        </View>
        {scopedEntries.length ? (
          scopedEntries.slice(0, 15).map((entry) => (
            <StageListCard
              key={`${scope}-${entry.rank}-${entry.name}`}
              title={`#${entry.rank} ${entry.name}`}
              meta={`${entry.score} academic points`}
              tone="highschool"
            />
          ))
        ) : (
          <EmptyState label="No ranking data yet for this scope." />
        )}
      </StageSection>
    </StageCommunityScaffold>
  );
}

const styles = StyleSheet.create({
  scopeRow: { flexDirection: "row", gap: 8 },
  scopeChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  scopeText: { fontWeight: "900", fontSize: 12 },
  podiumRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
  podiumCard: { flex: 1, borderWidth: 1, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 8, alignItems: "center" },
  podiumCenter: { transform: [{ scale: 1.05 }] },
  podiumRank: { fontWeight: "900", fontSize: 14 },
  podiumName: { fontWeight: "800", fontSize: 12, marginTop: 4 },
  podiumScore: { fontWeight: "700", fontSize: 11, marginTop: 2 }
});
