import React, { useCallback, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { api } from "@/lib/api";
import { getAppErrorMessage } from "@/lib/appError";
import { EmptyState, StageCommunityScaffold, StageListCard, StageSection, StageStatRow } from "@/components/community/stage-community-data-ui";

type ChallengeItem = { id: string; title: string; domain?: string; deadline?: string; participantsCount?: number; submissionStatus?: string; mentor?: { name?: string } | null; isActive?: boolean };

export default function KidFunChallengesScreen() {
  const router = useRouter();
  const [items, setItems] = useState<ChallengeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    try {
      if (refresh) setRefreshing(true); else setLoading(true);
      setError(null);
      const res = await api.get<ChallengeItem[]>("/api/network/challenges");
      setItems((res.data || []).filter((item) => item.isActive !== false));
    } catch (e) {
      setError(getAppErrorMessage(e, "Failed to load fun challenges."));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <StageCommunityScaffold
      title="Fun Challenges"
      subtitle="Short, school-friendly challenge spaces powered by the working ORIN challenge system."
      loading={loading}
      error={error}
      refreshing={refreshing}
      onRefresh={() => load(true)}
    >
      <StageStatRow items={[
        { label: "Active", value: String(items.length) },
        { label: "Submitted", value: String(items.filter((item) => item.submissionStatus === "submitted" || item.submissionStatus === "reviewed").length) }
      ]} />
      <StageSection title="Learning Games" icon="game-controller" actionLabel="Play now" onAction={() => router.push("/community/learning-games" as never)}>
        <StageListCard
          title="Quiz Battle, Speed Math, Memory Match"
          meta="Play games, collect stars, and keep your streak alive"
          note="Correct answers, fast play, and daily streaks help you climb the Star Board."
          tone="kid"
        />
      </StageSection>
      <StageSection title="Challenge Board" icon="trophy" actionLabel="Open full" onAction={() => router.push("/community/challenges" as never)}>
        {items.length ? items.slice(0, 6).map((item) => (
          <StageListCard
            key={item.id}
            title={item.title}
            meta={`${item.domain || "School"} · ${item.participantsCount || 0} joined`}
            note={`Mentor: ${item.mentor?.name || "Teacher"}${item.deadline ? ` · Deadline: ${new Date(item.deadline).toLocaleDateString("en-IN")}` : ""}`}
            tone="kid"
          />
        )) : <EmptyState label="No fun challenges yet." />}
      </StageSection>
      <StageSection title="Teacher Activities" icon="map" actionLabel="Open full" onAction={() => router.push("/ai/career-roadmap?section=institution" as never)}>
        <StageListCard
          title="Open learning activities"
          meta="Journey activities"
          note="Use the institution roadmap area for mentor-guided school activities."
          tone="kid"
        />
      </StageSection>
    </StageCommunityScaffold>
  );
}
