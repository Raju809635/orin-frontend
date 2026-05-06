import React, { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { api } from "@/lib/api";
import { getAppErrorMessage } from "@/lib/appError";
import { useAppTheme } from "@/context/ThemeContext";
import {
  AcademicCard,
  AcademicEmpty,
  ActionButton,
  CommunitySection,
  HighSchoolCommunityShell,
  StatusBadge
} from "@/components/community/highschool-ui";

type EarnedCert = { id?: string; _id?: string; title: string; issuedAt?: string | null; level?: string; domain?: string; issuerName?: string; verificationCode?: string };
type LeaderboardResponse = {
  collegeTop?: { rank: number; name: string; score: number }[];
  stateTop?: { rank: number; name: string; score: number }[];
  me?: { collegeRank?: number | null; stateRank?: number | null; globalRank?: number | null; score?: number };
};
type ReputationSummary = { score?: number; levelTag?: string; topPercent?: number };

export default function HighSchoolAchievementsScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const [earned, setEarned] = useState<EarnedCert[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardResponse | null>(null);
  const [reputation, setReputation] = useState<ReputationSummary | null>(null);
  const [selected, setSelected] = useState<EarnedCert | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    try {
      if (refresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      const [certRes, boardRes, repRes] = await Promise.allSettled([
        api.get<EarnedCert[]>("/api/network/certifications"),
        api.get<LeaderboardResponse>("/api/network/leaderboard"),
        api.get<ReputationSummary>("/api/network/reputation-summary")
      ]);
      setEarned(certRes.status === "fulfilled" ? certRes.value.data || [] : []);
      setLeaderboard(boardRes.status === "fulfilled" ? boardRes.value.data || null : null);
      setReputation(repRes.status === "fulfilled" ? repRes.value.data || null : null);
    } catch (e) {
      setError(getAppErrorMessage(e, "Failed to load achievements."));
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

  return (
    <HighSchoolCommunityShell
      title="Academic Achievements"
      subtitle="After-12 certifications and ranking data, presented as school awards, badges and academic momentum."
      stats={[
        { icon: "ribbon", label: "Certificates", value: String(earned.length) },
        { icon: "podium", label: "School rank", value: leaderboard?.me?.collegeRank ? `#${leaderboard.me.collegeRank}` : "-" },
        { icon: "trending-up", label: "Top %", value: reputation?.topPercent != null ? `${reputation.topPercent}` : "-" }
      ]}
      loading={loading}
      error={error}
      refreshing={refreshing}
      onRefresh={() => load(true)}
    >
      <CommunitySection title="Recognition Snapshot" subtitle="Built from real certificates, XP and leaderboard state." icon="sparkles">
        <View style={styles.snapshotRow}>
          <View style={[styles.snapshotCard, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
            <Text style={styles.snapshotEmoji}>CERT</Text>
            <Text style={[styles.snapshotValue, { color: colors.text }]}>{earned.length}</Text>
            <Text style={[styles.snapshotLabel, { color: colors.textMuted }]}>Certificates</Text>
          </View>
          <View style={[styles.snapshotCard, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
            <Text style={styles.snapshotEmoji}>XP</Text>
            <Text style={[styles.snapshotValue, { color: colors.text }]}>{reputation?.score || leaderboard?.me?.score || 0}</Text>
            <Text style={[styles.snapshotLabel, { color: colors.textMuted }]}>Academic points</Text>
          </View>
          <View style={[styles.snapshotCard, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
            <Text style={styles.snapshotEmoji}>LVL</Text>
            <Text style={[styles.snapshotValue, { color: colors.text }]}>{reputation?.levelTag || "Starter"}</Text>
            <Text style={[styles.snapshotLabel, { color: colors.textMuted }]}>Level</Text>
          </View>
        </View>
      </CommunitySection>

      <CommunitySection title="Academic Certificates" subtitle="Tap a certificate for verification-style details." icon="ribbon">
        {earned.length ? (
          earned.slice(0, 10).map((item) => (
            <AcademicCard
              key={item.id || item._id || item.title}
              icon="ribbon-outline"
              title={item.title}
              meta={`${item.level || "Verified"} · ${item.domain || "Academic"}`}
              note={item.issuedAt ? `Issued ${new Date(item.issuedAt).toLocaleDateString("en-IN")} · ${item.issuerName || "ORIN"}` : `${item.issuerName || "ORIN"} academic recognition`}
              badge="Certificate"
              badgeTone="success"
              actionLabel="View"
              onPress={() => setSelected(item)}
            />
          ))
        ) : (
          <AcademicEmpty label="No academic achievements yet. Complete quizzes, challenges, or roadmaps." />
        )}
      </CommunitySection>

      <CommunitySection title="Rank & Badge Signals" subtitle="Academic achievement is more than certificates." icon="podium">
        <AcademicCard
          icon="school-outline"
          title="School Position"
          meta={`School rank ${leaderboard?.me?.collegeRank ? `#${leaderboard.me.collegeRank}` : "not available"}`}
          note={`State rank ${leaderboard?.me?.stateRank ? `#${leaderboard.me.stateRank}` : "-"} · Global rank ${leaderboard?.me?.globalRank ? `#${leaderboard.me.globalRank}` : "-"}`}
          badge="Rank"
          actionLabel="Open Leaderboard"
          onPress={() => router.push("/community/highschool-leaderboard" as never)}
        />
      </CommunitySection>

      {selected ? (
        <CommunitySection title="Certificate Detail" subtitle="Academic certificate view." icon="shield-checkmark">
          <View style={styles.detailHead}>
            <Text style={[styles.detailTitle, { color: colors.text }]}>{selected.title}</Text>
            <StatusBadge label={selected.level || "Verified"} tone="success" />
          </View>
          <Text style={[styles.detailMeta, { color: colors.textMuted }]}>
            {[selected.domain || "Academic", selected.issuerName || "ORIN", selected.issuedAt ? new Date(selected.issuedAt).toLocaleDateString("en-IN") : ""]
              .filter(Boolean)
              .join(" · ")}
          </Text>
          {selected.verificationCode ? <Text style={[styles.detailMeta, { color: colors.textMuted }]}>Verification: {selected.verificationCode}</Text> : null}
          <ActionButton label="Open Full Certificates" icon="open-outline" onPress={() => router.push("/community/certifications" as never)} />
        </CommunitySection>
      ) : null}
    </HighSchoolCommunityShell>
  );
}

const styles = StyleSheet.create({
  snapshotRow: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  snapshotCard: { flexGrow: 1, minWidth: 100, borderWidth: 1, borderRadius: 16, padding: 12, gap: 4 },
  snapshotEmoji: { fontSize: 22 },
  snapshotValue: { fontSize: 18, fontWeight: "900" },
  snapshotLabel: { fontSize: 12, fontWeight: "800" },
  detailHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  detailTitle: { flex: 1, fontSize: 20, fontWeight: "900" },
  detailMeta: { fontWeight: "800", lineHeight: 20 }
});
