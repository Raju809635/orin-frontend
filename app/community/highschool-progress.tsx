import React, { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { api } from "@/lib/api";
import { getAppErrorMessage } from "@/lib/appError";
import { EmptyState, StageCommunityScaffold, StageListCard, StageProgressBar, StageSection, StageStatRow } from "@/components/community/stage-community-data-ui";

type ReputationSummary = { score?: number; levelTag?: string; topPercent?: number };
type Dashboard = {
  streakDays?: number;
  xp?: number;
  dailyQuiz?: { completedToday?: boolean; attemptsLeft?: number; domain?: string };
  skillRadar?: { domain?: string; skills?: { name: string; score: number }[] };
  careerIntelligence?: { strength?: string; needsImprovement?: string[]; recommendedNextStep?: string } | null;
};
type AcademicSubjectSummary = { key: string; subject: string; chapterCount?: number };
type LeaderboardResponse = {
  collegeName?: string;
  stateName?: string;
  me?: { collegeRank?: number | null; stateRank?: number | null; globalRank?: number | null; score?: number };
};

export default function HighSchoolProgressScreen() {
  const [reputation, setReputation] = useState<ReputationSummary | null>(null);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardResponse | null>(null);
  const [subjects, setSubjects] = useState<AcademicSubjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    try {
      if (refresh) setRefreshing(true); else setLoading(true);
      setError(null);
      const [repRes, dashRes, subjectRes, boardRes] = await Promise.allSettled([
        api.get<ReputationSummary>("/api/network/reputation-summary"),
        api.get<Dashboard>("/api/network/daily-dashboard"),
        api.get<{ subjects: AcademicSubjectSummary[] }>("/api/academics/CBSE/class/10/subjects"),
        api.get<LeaderboardResponse>("/api/network/leaderboard")
      ]);
      setReputation(repRes.status === "fulfilled" ? repRes.value.data || null : null);
      setDashboard(dashRes.status === "fulfilled" ? dashRes.value.data || null : null);
      setSubjects(subjectRes.status === "fulfilled" ? subjectRes.value.data?.subjects || [] : []);
      setLeaderboard(boardRes.status === "fulfilled" ? boardRes.value.data || null : null);
    } catch (e) {
      setError(getAppErrorMessage(e, "Unable to load school progress."));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const skills = dashboard?.skillRadar?.skills || [];

  return (
    <StageCommunityScaffold
      eyebrow="High School Community"
      title="School Progress"
      subtitle="Weekly progress, quiz signals, subject radar, and improvement momentum."
      loading={loading}
      error={error}
      refreshing={refreshing}
      onRefresh={() => load(true)}
    >
      <StageStatRow items={[
        { label: "Score", value: String(reputation?.score || 0) },
        { label: "Streak", value: String(dashboard?.streakDays || 0) },
        { label: "XP", value: String(dashboard?.xp || 0) },
        { label: "School rank", value: leaderboard?.me?.collegeRank ? `#${leaderboard.me.collegeRank}` : "-" }
      ]} />
      <StageSection title="Progress Snapshot" icon="stats-chart">
        {reputation || dashboard ? (
          <>
            <StageListCard title={`Level ${reputation?.levelTag || "Starter"}`} meta={`Top ${reputation?.topPercent || 0}%`} note="Your activity, quiz attempts, challenges, and submissions build this progress." tone="highschool" />
            <StageListCard title="This week focus" meta={dashboard?.careerIntelligence?.strength || dashboard?.dailyQuiz?.domain || "Academic consistency"} note={dashboard?.careerIntelligence?.recommendedNextStep || "Complete one quiz, one roadmap task, and one resource review this week."} tone="highschool" />
          </>
        ) : (
          <EmptyState label="No school progress yet." />
        )}
      </StageSection>
      <StageSection title="Subject Radar" icon="pulse">
        {skills.length ? skills.slice(0, 6).map((skill) => (
          <StageListCard key={skill.name} title={skill.name} meta={`${skill.score}/100`} tone="highschool" />
        )) : subjects.length ? subjects.slice(0, 5).map((subject) => (
          <StageListCard key={subject.key} title={subject.subject} meta={`${subject.chapterCount || 0} chapters`} note="Take subject quizzes to unlock score-based radar." tone="highschool" />
        )) : <EmptyState label="Take a quiz to unlock subject progress." />}
      </StageSection>
      <StageSection title="Rank Position" icon="podium">
        <StageListCard
          title={leaderboard?.collegeName || "Your School"}
          meta={`School rank: ${leaderboard?.me?.collegeRank ? `#${leaderboard.me.collegeRank}` : "-"}`}
          note="School leaderboard is based on academic quiz, streak, challenge, and roadmap activity."
          tone="highschool"
        />
        <StageListCard
          title={leaderboard?.stateName || "Your State"}
          meta={`State rank: ${leaderboard?.me?.stateRank ? `#${leaderboard.me.stateRank}` : "-"}`}
          note={`Global rank: ${leaderboard?.me?.globalRank ? `#${leaderboard.me.globalRank}` : "-"}`}
          tone="highschool"
        />
      </StageSection>
      {skills.length ? (
        <StageSection title="Improvement Bars" icon="trending-up">
          {skills.slice(0, 5).map((skill) => (
            <StageListCard key={`bar-${skill.name}`} title={skill.name} meta={`${skill.score}% complete`} tone="highschool" />
          ))}
          {skills.slice(0, 5).map((skill) => <StageProgressBar key={`progress-${skill.name}`} value={skill.score} />)}
        </StageSection>
      ) : null}
    </StageCommunityScaffold>
  );
}
