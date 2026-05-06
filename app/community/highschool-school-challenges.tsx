import React, { useCallback, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { api } from "@/lib/api";
import { getAppErrorMessage } from "@/lib/appError";
import { EmptyState, StageCommunityScaffold, StageListCard, StageSection, StageStatRow } from "@/components/community/stage-community-data-ui";

type ChallengeItem = { _id?: string; id?: string; title: string; domain?: string; participantsCount?: number; deadline?: string; mentor?: { name?: string } | null; isActive?: boolean };
type LeaderboardResponse = { collegeTop?: { rank: number; name: string; score: number }[] };
type AcademicSubjectSummary = { key: string; subject: string; chapterCount?: number };

export default function HighSchoolSchoolChallengesScreen() {
  const router = useRouter();
  const [items, setItems] = useState<ChallengeItem[]>([]);
  const [leaders, setLeaders] = useState<{ rank: number; name: string; score: number }[]>([]);
  const [subjects, setSubjects] = useState<AcademicSubjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    try {
      if (refresh) setRefreshing(true); else setLoading(true);
      setError(null);
      const [challengeRes, boardRes, subjectRes] = await Promise.allSettled([
        api.get<ChallengeItem[]>("/api/network/challenges"),
        api.get<LeaderboardResponse>("/api/network/leaderboard"),
        api.get<{ subjects: AcademicSubjectSummary[] }>("/api/academics/CBSE/class/10/subjects")
      ]);
      setItems((challengeRes.status === "fulfilled" ? challengeRes.value.data || [] : []).filter((item) => item.isActive !== false));
      setLeaders(boardRes.status === "fulfilled" ? boardRes.value.data?.collegeTop || [] : []);
      setSubjects(subjectRes.status === "fulfilled" ? subjectRes.value.data?.subjects || [] : []);
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
      eyebrow="High School Community"
      title="School Challenges"
      subtitle="Academic challenges, quiz battles, and institution competitions connected to real subject areas."
      loading={loading}
      error={error}
      refreshing={refreshing}
      onRefresh={() => load(true)}
    >
      <StageStatRow items={[
        { label: "Active", value: String(items.length) },
        { label: "Subjects", value: String(subjects.length) },
        { label: "Ranks", value: String(leaders.length) }
      ]} />
      <StageSection title="Subject Practice Entry" icon="game-controller" actionLabel="Start quiz" onAction={() => router.push("/ai/highschool-subject-gap" as never)}>
        {subjects.length ? subjects.slice(0, 5).map((subject) => (
          <StageListCard
            key={subject.key}
            title={subject.subject}
            meta={`${subject.chapterCount || 0} chapters | CBSE Class 10 demo`}
            note="Start with subject/topic quiz, then ORIN detects your weak areas."
            tone="highschool"
            onPress={() => router.push(`/ai/highschool-subject-gap?subject=${encodeURIComponent(subject.subject)}` as never)}
          />
        )) : <EmptyState label="Academic subjects are not connected yet." />}
      </StageSection>
      <StageSection title="Challenge Board" icon="trophy" actionLabel="Open full" onAction={() => router.push("/community/challenges" as never)}>
        {items.length ? items.slice(0, 6).map((item) => (
          <StageListCard
            key={item._id || item.id || item.title}
            title={item.title}
            meta={`${item.domain || "School"} | ${item.participantsCount || 0} joined`}
            note={`Mentor: ${item.mentor?.name || "Guide"}${item.deadline ? ` | ${new Date(item.deadline).toLocaleDateString("en-IN")}` : ""}`}
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
