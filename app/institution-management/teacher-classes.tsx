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

type ClassRow = {
  className: string;
  studentCount: number;
  highSchoolCount: number;
  after12Count: number;
  students?: { name: string; email?: string; learnerStage?: string }[];
};

type ClassesResponse = {
  scope: ManagementScope;
  classes: ClassRow[];
};

export default function TeacherClassesScreen() {
  const { data, loading, refreshing, error, reload } = useInstitutionManagement<ClassesResponse>("classes");
  const classes = data?.classes || [];
  const totalStudents = classes.reduce((sum, item) => sum + Number(item.studentCount || 0), 0);

  return (
    <ManagementScreen
      eyebrow="Class Teacher"
      title="Classes"
      subtitle={`Manage assigned classes, students, activity health, and class-level guidance for ${data?.scope?.institutionName || "your institution"}.`}
      loading={loading}
      refreshing={refreshing}
      error={error}
      onRefresh={reload}
    >
      <MetricGrid>
        <MetricCard label="Assigned Classes" value={classes.length} icon="albums" />
        <MetricCard label="Students Visible" value={totalStudents} icon="people" />
        <MetricCard label="High School" value={classes.reduce((sum, item) => sum + Number(item.highSchoolCount || 0), 0)} icon="school" />
        <MetricCard label="After 12" value={classes.reduce((sum, item) => sum + Number(item.after12Count || 0), 0)} icon="rocket" />
      </MetricGrid>

      <SectionTitle title="Assigned Class Rooms" subtitle="Only classes connected to your mentor profile appear here." />
      {classes.length ? (
        classes.map((item) => (
          <InfoCard
            key={item.className}
            title={`Class ${item.className}`}
            subtitle={`${item.studentCount} student${item.studentCount === 1 ? "" : "s"} in this class`}
            meta={
              item.students?.length
                ? `Recent: ${item.students.map((student) => student.name).slice(0, 4).join(", ")}`
                : "Students will appear after they join this institution and class."
            }
            icon="people-circle"
          />
        ))
      ) : (
        <EmptyState title="No assigned classes yet" subtitle="Add assigned classes in mentor profile or ask the organisation head/admin to connect your classes." />
      )}
    </ManagementScreen>
  );
}
