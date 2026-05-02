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

type Teacher = {
  id: string;
  name: string;
  email?: string;
  approvalStatus?: string;
  mentorOrgRole?: string;
  assignedClasses?: string[];
  title?: string;
};

type TeachersResponse = {
  scope: ManagementScope;
  teachers: Teacher[];
};

export default function HeadTeachersScreen() {
  const { data, loading, refreshing, error, reload } = useInstitutionManagement<TeachersResponse>("teachers");
  const teachers = data?.teachers || [];

  return (
    <ManagementScreen
      eyebrow="Organisation Head"
      title="Teachers"
      subtitle={`Manage teachers, assigned classes, and approval status for ${data?.scope?.institutionName || "your institution"}.`}
      loading={loading}
      refreshing={refreshing}
      error={error}
      onRefresh={reload}
    >
      <MetricGrid>
        <MetricCard label="Teachers" value={teachers.length} icon="people" />
        <MetricCard label="Approved" value={teachers.filter((item) => item.approvalStatus === "approved").length} icon="checkmark-circle" />
        <MetricCard label="Pending" value={teachers.filter((item) => item.approvalStatus === "pending").length} icon="time" />
        <MetricCard label="Classes Covered" value={new Set(teachers.flatMap((item) => item.assignedClasses || [])).size} icon="albums" />
      </MetricGrid>

      <SectionTitle title="Teacher Directory" subtitle="Teacher approval remains admin-controlled in this phase; this view gives the school-side picture." />
      {teachers.length ? (
        teachers.map((teacher) => (
          <InfoCard
            key={teacher.id}
            title={teacher.name}
            subtitle={`${teacher.title || teacher.mentorOrgRole || "Teacher"} | ${teacher.approvalStatus || "pending"}`}
            meta={`Classes: ${(teacher.assignedClasses || []).join(", ") || "Not assigned"}${teacher.email ? ` | ${teacher.email}` : ""}`}
            icon="school"
          />
        ))
      ) : (
        <EmptyState title="No teachers connected" subtitle="Teachers who select this institution during mentor onboarding will appear here." />
      )}
    </ManagementScreen>
  );
}
