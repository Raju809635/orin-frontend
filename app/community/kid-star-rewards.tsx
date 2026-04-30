import React, { useCallback, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { api } from "@/lib/api";
import { getAppErrorMessage } from "@/lib/appError";
import { EmptyState, StageCommunityScaffold, StageListCard, StageSection, StageStatRow } from "@/components/community/stage-community-data-ui";

type EarnedCert = { id: string; title: string; issuedAt?: string | null; level?: string; domain?: string };
type LeaderboardEntry = { rank: number; name: string; score: number };
type LeaderboardResponse = { collegeTop?: LeaderboardEntry[] };

export default function KidStarRewardsScreen() {
  const router = useRouter();
  const [earned, setEarned] = useState<EarnedCert[]>([]);
  const [board, setBoard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    try {
      if (refresh) setRefreshing(true); else setLoading(true);
      setError(null);
      const [certRes, boardRes] = await Promise.allSettled([
        api.get<EarnedCert[]>("/api/network/certifications"),
        api.get<LeaderboardResponse>("/api/network/leaderboard")
      ]);
      setEarned(certRes.status === "fulfilled" ? certRes.value.data || [] : []);
      setBoard(boardRes.status === "fulfilled" ? boardRes.value.data?.collegeTop || [] : []);
    } catch (e) {
      setError(getAppErrorMessage(e, "Failed to load star rewards."));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <StageCommunityScaffold
      title="Star Rewards"
      subtitle="Recognition stays connected to the certification and leaderboard systems, but with simpler school language."
      loading={loading}
      error={error}
      refreshing={refreshing}
      onRefresh={() => load(true)}
    >
      <StageStatRow items={[
        { label: "Rewards", value: String(earned.length) },
        { label: "Star board", value: String(board.length) }
      ]} />
      <StageSection title="My Rewards" icon="ribbon" actionLabel="Open full" onAction={() => router.push("/community/certifications" as never)}>
        {earned.length ? earned.slice(0, 4).map((item) => (
          <StageListCard
            key={item.id}
            title={item.title}
            meta={`${item.level || "Reward"} · ${item.domain || "School"}`}
            note={item.issuedAt ? `Issued ${new Date(item.issuedAt).toLocaleDateString("en-IN")}` : "Ready to view"}
            tone="kid"
          />
        )) : <EmptyState label="No rewards earned yet." />}
      </StageSection>
      <StageSection title="School Star Board" icon="podium" actionLabel="Open full" onAction={() => router.push("/community/leaderboard" as never)}>
        {board.length ? board.slice(0, 5).map((entry) => (
          <StageListCard key={`${entry.rank}-${entry.name}`} title={`#${entry.rank} ${entry.name}`} meta={`${entry.score} points`} tone="kid" />
        )) : <EmptyState label="Star board is not ready yet." />}
      </StageSection>
    </StageCommunityScaffold>
  );
}
