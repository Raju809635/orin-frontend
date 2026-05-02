import React from "react";
import {
  InfoCard,
  ManagementScreen,
  ManagementScope,
  MetricCard,
  MetricGrid,
  SectionTitle,
  useInstitutionManagement
} from "@/components/institution-management/ManagementScaffold";

type OverviewResponse = {
  scope: ManagementScope;
  summary: {
    students: number;
    classes: number;
    roadmaps: number;
    resources: number;
    challenges: number;
    pendingReviews: number;
  };
};

export default function TeacherAssignScreen() {
  const { data, loading, refreshing, error, reload } = useInstitutionManagement<OverviewResponse>("overview");
  const summary = data?.summary || { students: 0, classes: 0, roadmaps: 0, resources: 0, challenges: 0, pendingReviews: 0 };

  return (
    <ManagementScreen
      eyebrow="Class Teacher"
      title="Assign"
      subtitle="Create class resources, activities, roadmaps, challenges, and announcements from the existing ORIN tools."
      loading={loading}
      refreshing={refreshing}
      error={error}
      onRefresh={reload}
    >
      <MetricGrid>
        <MetricCard label="Students" value={summary.students} icon="people" />
        <MetricCard label="Classes" value={summary.classes} icon="albums" />
        <MetricCard label="Roadmaps" value={summary.roadmaps} icon="map" />
        <MetricCard label="Pending Reviews" value={summary.pendingReviews} icon="checkmark-done" />
      </MetricGrid>

      <SectionTitle title="Create For Your Class" subtitle="These shortcuts reuse the current creation systems with institution/class scope." />
      <InfoCard title="Assign Class Resource" subtitle="Upload worksheets, links, PDFs, videos, and activity notes." icon="library" to="/community/knowledge-library" />
      <InfoCard title="Create Activity Roadmap" subtitle="Build weekly class tasks and proof-based activities." icon="map" to="/ai/career-roadmap?section=institution" />
      <InfoCard title="Create Class Challenge" subtitle="Run quiz, project, speaking, or activity competitions." icon="trophy" to="/community/challenges" />
      <InfoCard title="Post Class Announcement" subtitle="Share motivation, reminders, and highlights in institution posts." icon="megaphone" to="/network?section=institution" />
    </ManagementScreen>
  );
}
