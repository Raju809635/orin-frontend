import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useMemo, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { api } from "@/lib/api";
import { getAppErrorMessage } from "@/lib/appError";
import {
  AcademicCard,
  AcademicMetricRow,
  CommunitySection,
  HighSchoolCommunityShell
} from "@/components/community/highschool-ui";

type Counts = {
  groups: number;
  challenges: number;
  certificates: number;
  programs: number;
  resources: number;
  rankers: number;
};

const MODULES: {
  title: string;
  meta: string;
  note: string;
  path: string;
  icon: keyof typeof Ionicons.glyphMap;
  countKey: keyof Counts;
  badge: string;
}[] = [
  {
    title: "Study Groups",
    meta: "Mentor groups and academic chats",
    note: "Join real teacher/mentor groups like Class 10 Exam Strategy or Mathematics Revision.",
    path: "/community/highschool-study-groups",
    icon: "people",
    countKey: "groups",
    badge: "Groups"
  },
  {
    title: "School Challenges",
    meta: "Challenges, proof and XP",
    note: "Academic competitions stay here. Quiz Battle is a separate live room CTA inside this page.",
    path: "/community/highschool-school-challenges",
    icon: "trophy",
    countKey: "challenges",
    badge: "Challenges"
  },
  {
    title: "Achievements",
    meta: "Certificates and badges",
    note: "Academic recognition from certificates, leaderboard position, streaks and school milestones.",
    path: "/community/highschool-achievements",
    icon: "ribbon",
    countKey: "certificates",
    badge: "Awards"
  },
  {
    title: "School Programs",
    meta: "Workshops and student-safe programs",
    note: "Workshops, olympiad prep, bootcamps, scholarships and academic opportunities only.",
    path: "/community/highschool-programs",
    icon: "briefcase",
    countKey: "programs",
    badge: "Programs"
  },
  {
    title: "School Leaderboard",
    meta: "School, State and Global ranks",
    note: "After-12 style podium and rank list, adapted to academic points and healthy progress.",
    path: "/community/highschool-leaderboard",
    icon: "podium",
    countKey: "rankers",
    badge: "Ranks"
  },
  {
    title: "Resource Library",
    meta: "PDF resources and syllabus browser",
    note: "PDF-first teacher resources plus CBSE Class 10 academic dataset for demo.",
    path: "/community/highschool-resource-library",
    icon: "library",
    countKey: "resources",
    badge: "PDFs"
  },
  {
    title: "School Progress",
    meta: "Academic reputation and improvement",
    note: "Your school rank, XP, subject radar, quiz streak and next academic action.",
    path: "/community/highschool-progress",
    icon: "stats-chart",
    countKey: "rankers",
    badge: "Progress"
  }
];

export default function HighSchoolCommunityScreen() {
  const router = useRouter();
  const [counts, setCounts] = useState<Counts>({ groups: 0, challenges: 0, certificates: 0, programs: 0, resources: 0, rankers: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isPdf = useCallback((item: any) => {
    const url = String(item?.documentUrl || item?.url || item?.fileUrl || "").toLowerCase();
    return url.includes(".pdf");
  }, []);

  const load = useCallback(async (refresh = false) => {
    try {
      if (refresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      const [groupsRes, challengesRes, certsRes, programsRes, resourcesRes, boardRes] = await Promise.allSettled([
        api.get<any[]>("/api/network/mentor-groups"),
        api.get<any[]>("/api/network/challenges"),
        api.get<any[]>("/api/network/certifications"),
        api.get<any[]>("/api/network/opportunities"),
        api.get<any>("/api/network/knowledge-library"),
        api.get<any>("/api/network/leaderboard")
      ]);
      const resourcePayload = resourcesRes.status === "fulfilled" ? resourcesRes.value.data || {} : {};
      const resources = [
        ...(resourcePayload.institutionResources || []),
        ...(resourcePayload.domainResources || []),
        ...(resourcePayload.roadmapResources || [])
      ];
      setCounts({
        groups: groupsRes.status === "fulfilled" ? (groupsRes.value.data || []).length : 0,
        challenges: challengesRes.status === "fulfilled" ? (challengesRes.value.data || []).filter((item) => item?.isActive !== false).length : 0,
        certificates: certsRes.status === "fulfilled" ? (certsRes.value.data || []).length : 0,
        programs: programsRes.status === "fulfilled" ? (programsRes.value.data || []).filter((item) => item?.isActive !== false).length : 0,
        resources: resources.filter(isPdf).length,
        rankers: boardRes.status === "fulfilled" ? (boardRes.value.data?.collegeTop || []).length : 0
      });
    } catch (e) {
      setError(getAppErrorMessage(e, "Unable to load high school community."));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isPdf]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const stats = useMemo(
    () => [
      { icon: "people" as const, label: "Groups", value: String(counts.groups) },
      { icon: "trophy" as const, label: "Challenges", value: String(counts.challenges) },
      { icon: "document-text" as const, label: "PDFs", value: String(counts.resources) }
    ],
    [counts]
  );

  return (
    <HighSchoolCommunityShell
      title="Academic Community"
      subtitle="School-safe community powered by real ORIN groups, challenges, certificates, opportunities, PDFs and leaderboard data."
      stats={stats}
      loading={loading}
      error={error}
      refreshing={refreshing}
      onRefresh={() => load(true)}
    >
      <CommunitySection title="Today’s Academic Network" subtitle="Real counts from backend data. Empty modules show honest empty states." icon="grid">
        <AcademicMetricRow
          items={[
            { icon: "shield-checkmark", label: "School-safe" },
            { icon: "book", label: "Academic style" },
            { icon: "analytics", label: "Real data only" }
          ]}
        />
        {MODULES.map((module) => (
          <AcademicCard
            key={module.path}
            icon={module.icon}
            title={module.title}
            meta={`${counts[module.countKey]} ${module.badge.toLowerCase()} available`}
            note={module.note}
            badge={module.badge}
            badgeTone={counts[module.countKey] ? "success" : "neutral"}
            actionLabel="Open"
            onPress={() => router.push(module.path as never)}
          />
        ))}
      </CommunitySection>
    </HighSchoolCommunityShell>
  );
}
