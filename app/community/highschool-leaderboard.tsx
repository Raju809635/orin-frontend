import React, { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { api } from "@/lib/api";
import { getAppErrorMessage } from "@/lib/appError";
import { EmptyState, StageCommunityScaffold, StageListCard, StageSection, StageStatRow } from "@/components/community/stage-community-data-ui";

type LeaderboardResponse = { collegeTop?: { rank: number; name: string; score: number }[]; collegeName?: string };

export default function HighSchoolLeaderboardScreen() {
  const [leaders, setLeaders] = useState<{ rank: number; name: string; score: number }[]>([]);
  const [schoolName, setSchoolName] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    try {
      if (refresh) setRefreshing(true); else setLoading(true);
      setError(null);
      const { data } = await api.get<LeaderboardResponse>("/api/network/leaderboard");
      setLeaders(data?.collegeTop || []);
      setSchoolName(data?.collegeName || "Your School");
    } catch (e) {
      setError(getAppErrorMessage(e, "Unable to load school leaderboard."));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <StageCommunityScaffold title="School Leaderboard" subtitle="Friendly class and school ranking based on activity, XP, and challenges." loading={loading} error={error} refreshing={refreshing} onRefresh={() => load(true)}>
      <StageStatRow items={[{ label: "School", value: schoolName || "School" }, { label: "Ranks", value: String(leaders.length) }]} />
      <StageSection title="Top Students" icon="podium">
        {leaders.length ? leaders.slice(0, 5).map((entry) => <StageListCard key={`${entry.rank}-${entry.name}`} title={`#${entry.rank} ${entry.name}`} meta={`${entry.score} points`} tone="highschool" />) : <EmptyState label="No school ranks yet." />}
      </StageSection>
    </StageCommunityScaffold>
  );
}
