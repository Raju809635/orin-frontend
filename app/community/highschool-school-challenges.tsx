import React, { useCallback, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { api } from "@/lib/api";
import { getAppErrorMessage } from "@/lib/appError";
import { EmptyState, StageCommunityScaffold, StageListCard, StageSection, StageStatRow } from "@/components/community/stage-community-data-ui";

type ChallengeItem = { id: string; title: string; domain?: string; participantsCount?: number; deadline?: string; mentor?: { name?: string } | null; isActive?: boolean };
type LeaderboardResponse = { collegeTop?: { rank: number; name: string; score: number }[] };

export default function HighSchoolSchoolChallengesScreen() {
  const router = useRouter();
  const [items, setItems] = useState<ChallengeItem[]>([]);
  const [leaders, setLeaders] = useState<{ rank: number; name: string; score: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    try {
      if (refresh) setRefreshing(true); else setLoading(true);
      setError(null);
      const [challengeRes, boardRes] = await Promise.allSettled([
        api.get<ChallengeItem[]>("/api/network/challenges"),
        api.get<LeaderboardResponse>("/api/network/leaderboard")
      ]);
      setItems((challengeRes.status === "fulfilled" ? challengeRes.value.data || [] : []).filter((item) => item.isActive !== false));
      setLeaders(boardRes.status === "fulfilled" ? boardRes.value.data?.collegeTop || [] : []);
    } catch (e) {
      setError(getAppErrorMessage(e, "Failed to load school challenges."));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <StageCommunityScaffold
      title="School Challenges"
      subtitle="Academic and institution challenges continue using the current ORIN challenge system, but with study-oriented entry points."
      loading={loading}
      error={error}
      refreshing={refreshing}
      onRefresh={() => load(true)}
    >
      <StageStatRow items={[
        { label: "Active", value: String(items.length) },
        { label: "Top ranks", value: String(leaders.length) }
      ]} />
      <StageSection title="Quiz Battle & Study Games" icon="game-controller" actionLabel="Play now" onAction={() => router.push("/community/learning-games" as never)}>
        <StageListCard
          title="Quiz Battle, Speed Math, Tournament Mode"
          meta="Practice subjects, earn XP, and climb the school leaderboard"
          note="Use games for fast revision, formula practice, vocabulary, and daily streaks."
          tone="highschool"
        />
      </StageSection>
      <StageSection title="Challenge Board" icon="trophy" actionLabel="Open full" onAction={() => router.push("/community/challenges" as never)}>
        {items.length ? items.slice(0, 6).map((item) => (
          <StageListCard
            key={item.id}
            title={item.title}
            meta={`${item.domain || "School"} · ${item.participantsCount || 0} joined`}
            note={`Mentor: ${item.mentor?.name || "Guide"}${item.deadline ? ` · ${new Date(item.deadline).toLocaleDateString("en-IN")}` : ""}`}
            tone="highschool"
          />
        )) : <EmptyState label="No school challenges yet." />}
      </StageSection>
      <StageSection title="Leaderboard Snapshot" icon="podium" actionLabel="Open full" onAction={() => router.push("/community/leaderboard" as never)}>
        {leaders.length ? leaders.slice(0, 4).map((entry) => (
          <StageListCard key={`${entry.rank}-${entry.name}`} title={`#${entry.rank} ${entry.name}`} meta={`${entry.score} points`} tone="highschool" />
        )) : <EmptyState label="No leaderboard data yet." />}
      </StageSection>
    </StageCommunityScaffold>
  );
}
