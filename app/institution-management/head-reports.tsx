import React from "react";
import {
  EmptyState,
  InfoCard,
  ManagementScreen,
  ManagementScope,
  MetricCard,
  MetricGrid,
  SectionTitle,
  useInstitutionManagement
} from "@/components/institution-management/ManagementScaffold";

type ReportsResponse = {
  scope: ManagementScope;
  summary: {
    students: number;
    teachers: number;
    roadmaps: number;
    resources: number;
    challenges: number;
    certificates: number;
  };
  classBreakdown: { className: string; studentCount: number }[];
};

export default function HeadReportsScreen() {
  const { data, loading, refreshing, error, reload } = useInstitutionManagement<ReportsResponse>("reports");
  const summary = data?.summary || { students: 0, teachers: 0, roadmaps: 0, resources: 0, challenges: 0, certificates: 0 };
  const classes = data?.classBreakdown || [];

  return (
    <ManagementScreen
      eyebrow="Organisation Head"
      title="Reports"
      subtitle="School overview, class participation, learning content, competitions, and recognition metrics."
      loading={loading}
      refreshing={refreshing}
      error={error}
      onRefresh={reload}
    >
      <MetricGrid>
        <MetricCard label="Students" value={summary.students} icon="people" />
        <MetricCard label="Teachers" value={summary.teachers} icon="school" />
        <MetricCard label="Roadmaps" value={summary.roadmaps} icon="map" />
        <MetricCard label="Certificates" value={summary.certificates} icon="ribbon" />
      </MetricGrid>

      <SectionTitle title="Class Analytics" subtitle="Class-wise count for the current institution." />
      {classes.length ? (
        classes.map((item) => (
          <InfoCard
            key={item.className}
            title={`Class ${item.className}`}
            subtitle={`${item.studentCount} student${item.studentCount === 1 ? "" : "s"}`}
            meta="Next slice can add active rate, quiz completion, challenge participation, and improvement graphs."
            icon="bar-chart"
          />
        ))
      ) : (
        <EmptyState title="No class data yet" subtitle="Students will appear after they select this institution and class." />
      )}
    </ManagementScreen>
  );
}
