import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { api } from "@/lib/api";
import { getAppErrorMessage } from "@/lib/appError";
import { useAppTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";

type SectionKey = "overview" | "community" | "mentorship" | "reviews";

type AnyRow = Record<string, any>;
type GroupRow = AnyRow & { id?: string; _id?: string; name?: string; membersCount?: number; joinRequests?: any[]; pendingRequests?: any[] };
type SubmissionRow = AnyRow & {
  id?: string;
  _id?: string;
  title?: string;
  roadmapTitle?: string;
  resourceTitle?: string;
  challengeTitle?: string;
  studentName?: string;
  status?: string;
  proofText?: string;
  mentorReview?: { xpAwarded?: number; certificateId?: string | null; notes?: string };
  student?: { name?: string; email?: string };
};

function asArray<T = AnyRow>(value: any): T[] {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.roadmaps)) return value.roadmaps;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.data)) return value.data;
  return [];
}

function rowId(item: AnyRow, index = 0) {
  return String(item?.id || item?._id || item?.student?.id || item?.studentId || `${item?.reviewType || "row"}-${index}`);
}

function statusLabel(value?: string) {
  const clean = String(value || "pending").toLowerCase();
  if (clean === "accepted" || clean === "approved") return "Approved";
  if (clean === "rejected") return "Needs Rework";
  if (clean === "reviewed") return "Reviewed";
  if (clean === "pending") return "Pending";
  if (clean === "submitted") return "Submitted";
  return clean.replace(/_/g, " ");
}

function studentLabel(item: SubmissionRow) {
  return item.student?.name || item.studentName || item.user?.name || item.name || "Student";
}

function titleLabel(item: SubmissionRow) {
  return item.roadmapTitle || item.resourceTitle || item.challengeTitle || item.title || item.name || "Submitted work";
}

export default function GlobalTeacherDashboard() {
  const router = useRouter();
  const params = useLocalSearchParams<{ section?: string }>();
  const { user } = useAuth();
  const { colors, isDark } = useAppTheme();
  const selected = String(params.section || "overview") as SectionKey;
  const activeSection: SectionKey = SECTIONS.some((item) => item.key === selected) ? selected : "overview";

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [posts, setPosts] = useState<AnyRow[]>([]);
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [roadmaps, setRoadmaps] = useState<AnyRow[]>([]);
  const [roadmapSubmissions, setRoadmapSubmissions] = useState<SubmissionRow[]>([]);
  const [resourceSubmissions, setResourceSubmissions] = useState<SubmissionRow[]>([]);
  const [challenges, setChallenges] = useState<AnyRow[]>([]);
  const [programs, setPrograms] = useState<AnyRow[]>([]);
  const [liveSessions, setLiveSessions] = useState<AnyRow[]>([]);
  const [opportunities, setOpportunities] = useState<AnyRow[]>([]);
  const [certificates, setCertificates] = useState<AnyRow[]>([]);
  const [templates, setTemplates] = useState<AnyRow[]>([]);
  const [leaderboard, setLeaderboard] = useState<AnyRow | null>(null);

  const load = useCallback(async (refresh = false) => {
    try {
      if (refresh) setRefreshing(true);
      else setLoading(true);
      setError("");

      const [
        postsRes,
        groupsRes,
        roadmapsRes,
        roadmapSubmissionsRes,
        resourceSubmissionsRes,
        challengesRes,
        programsRes,
        liveSessionsRes,
        opportunitiesRes,
        certificatesRes,
        templatesRes,
        leaderboardRes
      ] = await Promise.allSettled([
        api.get("/api/network/feed/institution"),
        api.get("/api/network/mentor-groups"),
        api.get("/api/network/institution-roadmaps"),
        api.get("/api/network/institution-roadmaps/submissions/mentor"),
        api.get("/api/network/knowledge-library/submissions/mentor"),
        api.get("/api/network/challenges"),
        api.get("/api/network/sprints"),
        api.get("/api/network/live-sessions"),
        api.get("/api/network/opportunities"),
        api.get("/api/network/certifications"),
        api.get("/api/network/certificate-templates/mentor"),
        api.get("/api/network/leaderboard")
      ]);

      setPosts(postsRes.status === "fulfilled" ? asArray(postsRes.value.data) : []);
      setGroups(groupsRes.status === "fulfilled" ? asArray<GroupRow>(groupsRes.value.data) : []);
      setRoadmaps(roadmapsRes.status === "fulfilled" ? asArray(roadmapsRes.value.data) : []);
      setRoadmapSubmissions(roadmapSubmissionsRes.status === "fulfilled" ? asArray<SubmissionRow>(roadmapSubmissionsRes.value.data) : []);
      setResourceSubmissions(resourceSubmissionsRes.status === "fulfilled" ? asArray<SubmissionRow>(resourceSubmissionsRes.value.data) : []);
      setChallenges(challengesRes.status === "fulfilled" ? asArray(challengesRes.value.data) : []);
      setPrograms(programsRes.status === "fulfilled" ? asArray(programsRes.value.data) : []);
      setLiveSessions(liveSessionsRes.status === "fulfilled" ? asArray(liveSessionsRes.value.data) : []);
      setOpportunities(opportunitiesRes.status === "fulfilled" ? asArray(opportunitiesRes.value.data) : []);
      setCertificates(certificatesRes.status === "fulfilled" ? asArray(certificatesRes.value.data) : []);
      setTemplates(templatesRes.status === "fulfilled" ? asArray(templatesRes.value.data) : []);
      setLeaderboard(leaderboardRes.status === "fulfilled" ? leaderboardRes.value.data || null : null);
    } catch (err) {
      setError(getAppErrorMessage(err, "Unable to load Global Teacher dashboard."));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const reviews = useMemo(
    () => [
      ...roadmapSubmissions.map((item) => ({ ...item, reviewType: "Roadmap" })),
      ...resourceSubmissions.map((item) => ({ ...item, reviewType: "Resource" }))
    ],
    [resourceSubmissions, roadmapSubmissions]
  );

  const pendingReviews = useMemo(
    () => reviews.filter((item) => ["submitted", "pending"].includes(String(item.status || "").toLowerCase())),
    [reviews]
  );

  const xpAwarded = useMemo(
    () => reviews.reduce((sum, item) => sum + Number(item.mentorReview?.xpAwarded || 0), 0),
    [reviews]
  );

  const schools = useMemo(() => {
    const labels = new Set<string>();
    [...roadmaps, ...groups, ...programs, ...opportunities, ...reviews].forEach((item) => {
      const name = String(item.institutionName || item.schoolName || item.institution || "").trim();
      if (name) labels.add(name);
    });
    return Array.from(labels);
  }, [groups, opportunities, programs, reviews, roadmaps]);

  const classes = useMemo(() => {
    const labels = new Set<string>();
    [...roadmaps, ...groups, ...programs, ...reviews].forEach((item) => {
      const name = String(item.className || item.classLevel || item.class || "").trim();
      if (name) labels.add(name);
    });
    return Array.from(labels);
  }, [groups, programs, reviews, roadmaps]);

  const participants = useMemo(() => {
    const map = new Map<string, { name: string; xp: number; pending: number; accepted: number }>();
    reviews.forEach((item) => {
      const name = studentLabel(item);
      const current = map.get(name) || { name, xp: 0, pending: 0, accepted: 0 };
      current.xp += Number(item.mentorReview?.xpAwarded || 0);
      if (String(item.status || "").toLowerCase() === "accepted") current.accepted += 1;
      if (["submitted", "pending"].includes(String(item.status || "").toLowerCase())) current.pending += 1;
      map.set(name, current);
    });
    return Array.from(map.values()).sort((a, b) => b.xp - a.xp || b.accepted - a.accepted).slice(0, 12);
  }, [reviews]);

  function go(section: SectionKey) {
    router.replace(`/global-teacher-dashboard?section=${section}` as never);
  }

  function open(path: string) {
    router.push(path as never);
  }

  const communityActions = [
    { title: "Study Groups", meta: `${groups.length} groups. Create groups, manage requests, and open group chat.`, icon: "people" as const, action: "Open groups", path: "/community/highschool-study-groups" },
    { title: "Roadmaps", meta: `${roadmaps.length} teacher roadmaps. Create missions and review proofs.`, icon: "map" as const, action: "Create roadmap", path: "/ai/career-roadmap?section=institution" },
    { title: "Resources", meta: `${resourceSubmissions.length} resource proofs waiting or reviewed.`, icon: "library" as const, action: "Manage resources", path: "/community/knowledge-library" },
    { title: "Challenges", meta: `${challenges.length} challenges and competitions.`, icon: "trophy" as const, action: "Create challenge", path: "/community/challenges" },
    { title: "Programs", meta: `${programs.length} programs, workshops, sprints, or bootcamps.`, icon: "calendar" as const, action: "Create program", path: "/community/highschool-programs" },
    { title: "Opportunities", meta: `${opportunities.length} academic opportunities visible.`, icon: "briefcase" as const, action: "Submit opportunity", path: "/community/opportunities" },
    { title: "Certificates", meta: `${templates.length} templates, ${certificates.length} issued records visible.`, icon: "ribbon" as const, action: "Manage certificates", path: "/community/certifications" },
    { title: "AI Handling", meta: "Teacher AI tools for study roadmaps, lesson planning, quizzes, feedback, and strategy.", icon: "sparkles" as const, action: "Open AI tools", path: "/ai-hub" }
  ];

  const mentorshipActions = [
    { title: "Live Sessions", meta: `${liveSessions.length} live sessions. Manage teaching, links, and interest.`, icon: "videocam" as const, action: "Open sessions", path: "/mentorship" },
    { title: "Sprints", meta: `${programs.length} sprint/program records. Track enrollments and delivery.`, icon: "rocket" as const, action: "Open sprints", path: "/mentorship" },
    { title: "Meeting & Availability", meta: "Set live teaching availability, session pricing, payout setup, and profile readiness.", icon: "time" as const, action: "Open controls", path: "/mentor-dashboard?section=availability" },
    { title: "Mentor Profile", meta: "Keep teacher identity, institution, subjects, classes, and public profile current.", icon: "person-circle" as const, action: "Open profile", path: "/mentor-profile" }
  ];

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
    >
      <View style={[styles.hero, { backgroundColor: isDark ? "#102A24" : "#EAF7EF", borderColor: colors.border }]}>
        <Text style={[styles.eyebrow, { color: colors.accent }]}>Global Teacher Dashboard</Text>
        <Text style={[styles.title, { color: colors.text }]}>Control teaching, community, reviews, XP, and certificates</Text>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>
          {user?.name ? `${user.name}, ` : ""}use this as the teacher home for created academic work, real mentorship delivery, and student review control.
        </Text>
      </View>

      {error ? <Notice text={error} /> : null}
      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.accent} />
          <Text style={[styles.meta, { color: colors.textMuted }]}>Loading teacher controls...</Text>
        </View>
      ) : null}

      {!loading && activeSection === "overview" ? (
        <>
          <MetricGrid>
            <Metric label="Posts" value={posts.length} icon="newspaper" />
            <Metric label="Created Items" value={groups.length + roadmaps.length + challenges.length + programs.length + opportunities.length} icon="grid" />
            <Metric label="Pending Reviews" value={pendingReviews.length} icon="time" />
            <Metric label="XP Awarded" value={xpAwarded} icon="flash" />
            <Metric label="Certificates" value={certificates.length + reviews.filter((item) => item.mentorReview?.certificateId).length} icon="ribbon" />
            <Metric label="Schools / Classes" value={`${schools.length}/${classes.length}`} icon="business" />
          </MetricGrid>
          <Section title="Today's Work" subtitle="Shortcuts that do real teacher work, not generic home routing.">
            <Action title="Create Community Work" meta="Groups, roadmaps, resources, challenges, programs, opportunities, certificates, and teacher AI tools." icon="add-circle" action="Open Community" onPress={() => go("community")} />
            <Action title="Review and Award XP" meta={`${pendingReviews.length} pending proof items. Approve, reject, give feedback, award XP, and issue certificates from review tools.`} icon="checkmark-done" action="Open Reviews" onPress={() => go("reviews")} />
            <Action title="Run Mentorship" meta="Open live sessions, sprints, meeting links, availability, and real teaching operations." icon="school" action="Open Mentorship" onPress={() => go("mentorship")} />
            <Action title="Post Announcement" meta="Open the teacher feed for class, school, or global academic announcements." icon="megaphone" action="Open Posts" onPress={() => open("/network?section=institution")} />
          </Section>
        </>
      ) : null}

      {!loading && activeSection === "community" ? (
        <Section title="Community / AI Handling" subtitle="Study Groups stay here. Programs stay here. This is the created academic control area.">
          {communityActions.map((item) => (
            <Action key={item.title} {...item} onPress={() => open(item.path)} />
          ))}
        </Section>
      ) : null}

      {!loading && activeSection === "mentorship" ? (
        <Section title="Real Mentorship" subtitle="Live delivery, sessions, sprints, meetings, availability, and mentor operations.">
          {mentorshipActions.map((item) => (
            <Action key={item.title} {...item} onPress={() => open(item.path)} />
          ))}
        </Section>
      ) : null}

      {!loading && activeSection === "reviews" ? (
        <>
          <MetricGrid>
            <Metric label="Review Queue" value={reviews.length} icon="documents" />
            <Metric label="Pending" value={pendingReviews.length} icon="time" />
            <Metric label="Participants" value={participants.length} icon="people" />
            <Metric label="Schools" value={schools.length} icon="business" />
            <Metric label="Classes" value={classes.length} icon="albums" />
            <Metric label="XP Awarded" value={xpAwarded} icon="flash" />
          </MetricGrid>

          <Section title="Review Control Room" subtitle="Approve proof, reject for rework, add feedback, award XP, add scores, rank students, and issue certificates from linked review tools.">
            <Action title="Roadmap Proof Reviews" meta={`${roadmapSubmissions.length} roadmap submissions. Includes XP, feedback, and certificate toggle.`} icon="map" action="Award XP" onPress={() => open("/ai/career-roadmap?section=institution")} />
            <Action title="Resource Proof Reviews" meta={`${resourceSubmissions.length} resource submissions. Includes XP, feedback, and certificate toggle.`} icon="library" action="Review proofs" onPress={() => open("/community/knowledge-library")} />
            <Action title="Challenge Rankings" meta={`${challenges.length} challenges. Review challenge submissions, rank participants, and award XP where available.`} icon="trophy" action="Rank students" onPress={() => open("/community/challenges")} />
            <Action title="Certificate Issuing" meta={`${templates.length} templates. Certificates are issued from accepted proof review flows.`} icon="ribbon" action="Issue certificate" onPress={() => open("/community/certifications")} />
            <Action title="School & Class Ranking" meta={`Schools: ${schools.length || "not tagged yet"} | Classes: ${classes.length || "not tagged yet"}. Use leaderboard and review data for scoring.`} icon="podium" action="Open rankings" onPress={() => open("/community/highschool-leaderboard")} />
          </Section>

          <Section title="Latest Review Items" subtitle="Fast visibility before opening the detailed review module.">
            {reviews.slice(0, 12).map((item, index) => (
              <Action
                key={`${item.reviewType}-${rowId(item, index)}`}
                title={`${item.reviewType}: ${titleLabel(item)}`}
                meta={`${studentLabel(item)} | ${statusLabel(item.status)} | XP ${Number(item.mentorReview?.xpAwarded || 0)}${item.mentorReview?.certificateId ? " | Certificate issued" : ""}`}
                icon={item.reviewType === "Roadmap" ? "map" : "library"}
                action={String(item.status || "").toLowerCase() === "accepted" ? "Reviewed" : "Review"}
                onPress={() => open(item.reviewType === "Roadmap" ? "/ai/career-roadmap?section=institution" : "/community/knowledge-library")}
              />
            ))}
            {!reviews.length ? <Empty text="No submitted work is waiting yet. Created roadmaps, resources, and challenges will appear here after students submit proof." /> : null}
          </Section>

          <Section title="Participants, Schools, Classes" subtitle="All-school view from available teacher-created activity and review records.">
            {participants.map((item, index) => (
              <Action key={item.name} title={`${index + 1}. ${item.name}`} meta={`XP ${item.xp} | Accepted ${item.accepted} | Pending ${item.pending}`} icon="person" action="Open student work" onPress={() => open("/community/highschool-progress")} />
            ))}
            {schools.length ? <ListLine label="Schools" value={schools.slice(0, 8).join(", ")} /> : null}
            {classes.length ? <ListLine label="Classes" value={classes.slice(0, 8).join(", ")} /> : null}
            {leaderboard?.globalTop?.length ? <ListLine label="Leaderboard" value={`${leaderboard.globalTop[0]?.name || "Top learner"} leads with ${leaderboard.globalTop[0]?.score || 0} points`} /> : null}
          </Section>
        </>
      ) : null}
    </ScrollView>
  );
}

function Notice({ text }: { text: string }) {
  const { colors } = useAppTheme();
  return (
    <View style={[styles.notice, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Ionicons name="alert-circle" size={18} color={colors.danger} />
      <Text style={[styles.metaStrong, { color: colors.text }]}>{text}</Text>
    </View>
  );
}

function MetricGrid({ children }: { children: React.ReactNode }) {
  return <View style={styles.metrics}>{children}</View>;
}

function Metric({ label, value, icon }: { label: string; value: string | number; icon: keyof typeof Ionicons.glyphMap }) {
  const { colors } = useAppTheme();
  return (
    <View style={[styles.metric, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={[styles.iconBubble, { backgroundColor: colors.accentSoft }]}>
        <Ionicons name={icon} size={18} color={colors.accent} />
      </View>
      <Text style={[styles.metricValue, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.meta, { color: colors.textMuted }]}>{label}</Text>
    </View>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.meta, { color: colors.textMuted }]}>{subtitle}</Text>
      <View style={styles.stack}>{children}</View>
    </View>
  );
}

function Action({
  title,
  meta,
  icon,
  action,
  onPress
}: {
  title: string;
  meta: string;
  icon: keyof typeof Ionicons.glyphMap;
  action: string;
  onPress: () => void;
}) {
  const { colors } = useAppTheme();
  return (
    <TouchableOpacity style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={onPress}>
      <View style={styles.cardHead}>
        <View style={[styles.iconBubble, { backgroundColor: colors.accentSoft }]}>
          <Ionicons name={icon} size={19} color={colors.accent} />
        </View>
        <View style={styles.cardText}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>{title}</Text>
          <Text style={[styles.meta, { color: colors.textMuted }]}>{meta}</Text>
        </View>
      </View>
      <View style={styles.actionRow}>
        <Text style={[styles.actionText, { color: colors.accent }]}>{action}</Text>
        <Ionicons name="chevron-forward" size={16} color={colors.accent} />
      </View>
    </TouchableOpacity>
  );
}

function Empty({ text }: { text: string }) {
  const { colors } = useAppTheme();
  return (
    <View style={[styles.empty, { borderColor: colors.border, backgroundColor: colors.surface }]}>
      <Text style={[styles.metaStrong, { color: colors.textMuted }]}>{text}</Text>
    </View>
  );
}

function ListLine({ label, value }: { label: string; value: string }) {
  const { colors } = useAppTheme();
  return (
    <View style={[styles.listLine, { borderColor: colors.border }]}>
      <Text style={[styles.metaStrong, { color: colors.text }]}>{label}</Text>
      <Text style={[styles.meta, { color: colors.textMuted }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 18, paddingBottom: 110, gap: 16 },
  hero: { borderWidth: 1, borderRadius: 24, padding: 20, gap: 7 },
  eyebrow: { fontSize: 12, fontWeight: "900", letterSpacing: 0.8, textTransform: "uppercase" },
  title: { fontSize: 26, lineHeight: 31, fontWeight: "900" },
  subtitle: { fontSize: 14, lineHeight: 21, fontWeight: "600" },
  loading: { padding: 30, alignItems: "center", gap: 8 },
  notice: { borderWidth: 1, borderRadius: 16, padding: 13, flexDirection: "row", gap: 8, alignItems: "center" },
  metrics: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  metric: { width: "48%", minWidth: 150, borderWidth: 1, borderRadius: 18, padding: 14, gap: 7 },
  iconBubble: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  metricValue: { fontSize: 23, fontWeight: "900" },
  meta: { fontSize: 13, lineHeight: 19 },
  metaStrong: { fontSize: 13, lineHeight: 19, fontWeight: "800" },
  section: { gap: 8 },
  sectionTitle: { fontSize: 20, fontWeight: "900" },
  stack: { gap: 10, marginTop: 4 },
  card: { borderWidth: 1, borderRadius: 18, padding: 15, gap: 12 },
  cardHead: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  cardText: { flex: 1, gap: 4 },
  cardTitle: { fontSize: 16, fontWeight: "900" },
  actionRow: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 4 },
  actionText: { fontSize: 13, fontWeight: "900" },
  empty: { borderWidth: 1, borderRadius: 16, padding: 14 },
  listLine: { borderWidth: 1, borderRadius: 16, padding: 13, gap: 4 }
});
