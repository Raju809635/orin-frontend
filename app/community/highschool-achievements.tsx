import React, { useCallback, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { api } from "@/lib/api";
import { getAppErrorMessage } from "@/lib/appError";
import { EmptyState, StageCommunityScaffold, StageListCard, StageSection, StageStatRow } from "@/components/community/stage-community-data-ui";

type EarnedCert = {
  id: string;
  title: string;
  issuedAt?: string | null;
  level?: string;
  domain?: string;
};
type LeaderboardResponse = {
  collegeTop?: { rank: number; name: string; score: number }[];
  stateTop?: { rank: number; name: string; score: number }[];
};
type ReputationSummary = { score?: number; levelTag?: string; topPercent?: number };

export default function HighSchoolAchievementsScreen() {
  const router = useRouter();
  const [earned, setEarned] = useState<EarnedCert[]>([]);
  const [leaders, setLeaders] = useState<{ rank: number; name: string; score: number }[]>([]);
  const [stateLeaders, setStateLeaders] = useState<{ rank: number; name: string; score: number }[]>([]);
  const [reputation, setReputation] = useState<ReputationSummary | null>(null);
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
      setLeaders(boardRes.status === "fulfilled" ? boardRes.value.data?.collegeTop || [] : []);
      setStateLeaders(boardRes.status === "fulfilled" ? boardRes.value.data?.stateTop || [] : []);
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
    <StageCommunityScaffold
      eyebrow="High School Community"
      title="Achievements"
      subtitle="Academic achievements powered by your certificates, quiz score, and school ranking momentum."
      loading={loading}
      error={error}
      refreshing={refreshing}
      onRefresh={() => load(true)}
    >
      <StageStatRow
        items={[
          { label: "Certificates", value: String(earned.length) },
          { label: "School rankers", value: String(leaders.length) },
          { label: "State rankers", value: String(stateLeaders.length) },
          { label: "Top %", value: reputation?.topPercent != null ? `${reputation.topPercent}` : "-" }
        ]}
      />

      <StageSection title="Academic Certificates" icon="ribbon" actionLabel="Open full" onAction={() => router.push("/community/certifications" as never)}>
        {earned.length ? (
          earned.slice(0, 6).map((item) => (
            <StageListCard
              key={item.id}
              title={item.title}
              meta={`${item.level || "Verified"} · ${item.domain || "Academic"}`}
              note={item.issuedAt ? `Issued ${new Date(item.issuedAt).toLocaleDateString("en-IN")} · ORIN Academic Track` : "ORIN Academic Track"}
              tone="highschool"
            />
          ))
        ) : (
          <EmptyState label="No academic achievements yet." />
        )}
      </StageSection>

      <StageSection title="School Leaderboard Snapshot" icon="podium" actionLabel="Open full" onAction={() => router.push("/community/highschool-leaderboard" as never)}>
        {leaders.length ? (
          leaders.slice(0, 5).map((entry) => (
            <StageListCard key={`school-${entry.rank}-${entry.name}`} title={`#${entry.rank} ${entry.name}`} meta={`${entry.score} points`} tone="highschool" />
          ))
        ) : (
          <EmptyState label="No school ranking data yet." />
        )}
      </StageSection>
    </StageCommunityScaffold>
  );
}
