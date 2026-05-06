import React, { useCallback, useMemo, useState } from "react";
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
  ProgressBar,
  StatusBadge
} from "@/components/community/highschool-ui";

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
  const router = useRouter();
  const { colors } = useAppTheme();
  const [reputation, setReputation] = useState<ReputationSummary | null>(null);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardResponse | null>(null);
  const [subjects, setSubjects] = useState<AcademicSubjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    try {
      if (refresh) setRefreshing(true);
      else setLoading(true);
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

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const skills = useMemo(() => dashboard?.skillRadar?.skills || [], [dashboard?.skillRadar?.skills]);
  const weakSkills = useMemo(() => skills.filter((item) => item.score < 65), [skills]);
  const strongSkills = useMemo(() => skills.filter((item) => item.score >= 80), [skills]);

  return (
    <HighSchoolCommunityShell
      title="School Progress"
      subtitle="After-12 reputation/ranking quality, rewritten for academics: score, rank, subject radar, streak and next action."
      stats={[
        { icon: "flash", label: "Score", value: String(reputation?.score || leaderboard?.me?.score || 0) },
        { icon: "flame", label: "Streak", value: String(dashboard?.streakDays || 0) },
        { icon: "podium", label: "School rank", value: leaderboard?.me?.collegeRank ? `#${leaderboard.me.collegeRank}` : "-" }
      ]}
      loading={loading}
      error={error}
      refreshing={refreshing}
      onRefresh={() => load(true)}
    >
      <CommunitySection title="My Academic Position" subtitle="School, state and global ranking from the same leaderboard engine." icon="analytics">
        <View style={styles.rankGrid}>
          {[
            { label: "School", value: leaderboard?.me?.collegeRank ? `#${leaderboard.me.collegeRank}` : "-" },
            { label: "State", value: leaderboard?.me?.stateRank ? `#${leaderboard.me.stateRank}` : "-" },
            { label: "Global", value: leaderboard?.me?.globalRank ? `#${leaderboard.me.globalRank}` : "-" }
          ].map((item) => (
            <View key={item.label} style={[styles.rankCard, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
              <Text style={styles.rankIcon}>{item.label.toUpperCase()}</Text>
              <Text style={[styles.rankValue, { color: colors.text }]}>{item.value}</Text>
              <Text style={[styles.rankLabel, { color: colors.textMuted }]}>{item.label}</Text>
            </View>
          ))}
        </View>
        <AcademicCard
          icon="trending-up"
          title={reputation?.levelTag || "Academic Starter"}
          meta={`Top ${reputation?.topPercent || 0}% · ${dashboard?.xp || 0} XP`}
          note="Progress combines quizzes, roadmap missions, challenge submissions, streaks and community learning activity."
          badge="Progress"
          actionLabel="Open Leaderboard"
          onPress={() => router.push("/community/highschool-leaderboard" as never)}
        />
      </CommunitySection>

      <CommunitySection title="Subject Radar" subtitle="Real skill radar when available; otherwise syllabus subjects show as locked until quiz data exists." icon="pulse">
        {skills.length ? (
          skills.slice(0, 8).map((skill) => (
            <View key={skill.name} style={[styles.skillCard, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
              <View style={styles.skillTop}>
                <Text style={[styles.skillName, { color: colors.text }]}>{skill.name}</Text>
                <StatusBadge label={`${skill.score}%`} tone={skill.score >= 80 ? "success" : skill.score < 65 ? "danger" : "warning"} />
              </View>
              <ProgressBar progress={skill.score} tone={skill.score >= 80 ? "#16A34A" : skill.score < 65 ? "#EF4444" : "#F59E0B"} />
            </View>
          ))
        ) : subjects.length ? (
          subjects.slice(0, 6).map((subject) => (
            <AcademicCard
              key={subject.key}
              icon="book-outline"
              title={subject.subject}
              meta={`${subject.chapterCount || 0} chapters`}
              note="Take a subject quiz to unlock score-based radar for this subject."
              badge="Locked"
              onPress={() => router.push(`/ai/highschool-subject-gap?subject=${encodeURIComponent(subject.subject)}` as never)}
            />
          ))
        ) : (
          <AcademicEmpty label="Take a quiz to unlock subject progress." />
        )}
      </CommunitySection>

      <CommunitySection title="Strong / Weak Areas" subtitle="Next action is based on available dashboard intelligence." icon="compass">
        <AcademicCard
          icon="checkmark-circle-outline"
          title="Strong areas"
          meta={strongSkills.length ? strongSkills.map((item) => item.name).join(", ") : "Not enough quiz data yet"}
          note={dashboard?.careerIntelligence?.strength || "Complete quizzes to identify your academic strengths."}
          badge="Strong"
          badgeTone="success"
        />
        <AcademicCard
          icon="alert-circle-outline"
          title="Needs improvement"
          meta={weakSkills.length ? weakSkills.map((item) => item.name).join(", ") : "No weak areas detected yet"}
          note={dashboard?.careerIntelligence?.recommendedNextStep || "Start a subject gap quiz or complete one roadmap mission this week."}
          badge="Focus"
          badgeTone="warning"
          actionLabel="Start Gap Quiz"
          secondaryLabel="Study Roadmap"
          onPress={() => router.push("/ai/highschool-subject-gap" as never)}
          onSecondaryPress={() => router.push("/ai/highschool-study-roadmap" as never)}
        />
      </CommunitySection>

      <CommunitySection title="This Week’s Academic Action" subtitle="Small, concrete and measurable." icon="calendar">
        <AcademicCard
          icon="rocket-outline"
          title={dashboard?.dailyQuiz?.completedToday ? "Quiz completed today" : "Complete one academic quiz"}
          meta={`${dashboard?.dailyQuiz?.attemptsLeft ?? 0} attempts left · ${dashboard?.dailyQuiz?.domain || "Subject practice"}`}
          note="Then check Subject Gap Analyzer for weak topic detection and next practice plan."
          badge={dashboard?.dailyQuiz?.completedToday ? "Done" : "Pending"}
          badgeTone={dashboard?.dailyQuiz?.completedToday ? "success" : "warning"}
          actionLabel="Open Quiz"
          onPress={() => router.push("/ai/highschool-subject-gap" as never)}
        />
        <ActionButton label="Open Resource Library" icon="library-outline" variant="secondary" onPress={() => router.push("/community/highschool-resource-library" as never)} />
      </CommunitySection>
    </HighSchoolCommunityShell>
  );
}

const styles = StyleSheet.create({
  rankGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  rankCard: { flexGrow: 1, minWidth: 96, borderWidth: 1, borderRadius: 16, padding: 12, gap: 4 },
  rankIcon: { fontSize: 22 },
  rankValue: { fontSize: 20, fontWeight: "900" },
  rankLabel: { fontSize: 12, fontWeight: "800" },
  skillCard: { borderWidth: 1, borderRadius: 16, padding: 12, gap: 10 },
  skillTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 },
  skillName: { flex: 1, fontWeight: "900" }
});
