import React, { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { api } from "@/lib/api";
import { getAppErrorMessage } from "@/lib/appError";
import { EmptyState, StageCommunityScaffold, StageListCard, StageSection, StageStatRow } from "@/components/community/stage-community-data-ui";

type ReputationSummary = { score?: number; levelTag?: string; topPercent?: number };
type Dashboard = { streakDays?: number; xp?: number };

export default function HighSchoolProgressScreen() {
  const [reputation, setReputation] = useState<ReputationSummary | null>(null);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    try {
      if (refresh) setRefreshing(true); else setLoading(true);
      setError(null);
      const [repRes, dashRes] = await Promise.allSettled([
        api.get<ReputationSummary>("/api/network/reputation-summary"),
        api.get<Dashboard>("/api/network/daily-dashboard")
      ]);
      setReputation(repRes.status === "fulfilled" ? repRes.value.data || null : null);
      setDashboard(dashRes.status === "fulfilled" ? dashRes.value.data || null : null);
    } catch (e) {
      setError(getAppErrorMessage(e, "Unable to load school progress."));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <StageCommunityScaffold title="School Progress" subtitle="Track weekly stats, progress, and improvement momentum." loading={loading} error={error} refreshing={refreshing} onRefresh={() => load(true)}>
      <StageStatRow items={[{ label: "Score", value: String(reputation?.score || 0) }, { label: "Streak", value: String(dashboard?.streakDays || 0) }, { label: "XP", value: String(dashboard?.xp || 0) }]} />
      <StageSection title="Progress Snapshot" icon="stats-chart">
        {reputation ? (
          <>
            <StageListCard title={`Level ${reputation.levelTag || "Starter"}`} meta={`Top ${reputation.topPercent || 0}%`} note="Weekly school progress is trending through your current activity." tone="highschool" />
            <StageListCard title="Improve this week" meta="Target +10%" note="Complete roadmap tasks, challenges, and group sessions for better progress." tone="highschool" />
          </>
        ) : (
          <EmptyState label="No school progress yet." />
        )}
      </StageSection>
    </StageCommunityScaffold>
  );
}
