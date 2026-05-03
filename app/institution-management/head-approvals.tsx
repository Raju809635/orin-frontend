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

type ApprovalItem = {
  id: string;
  type: "teacher" | "resource" | "challenge";
  title: string;
  status: string;
  detail?: string;
};

type ApprovalsResponse = {
  scope: ManagementScope;
  approvals: ApprovalItem[];
};

export default function HeadApprovalsScreen() {
  const { data, loading, refreshing, error, reload } = useInstitutionManagement<ApprovalsResponse>("approvals");
  const approvals = data?.approvals || [];

  return (
    <ManagementScreen
      eyebrow="Organisation Head"
      title="Approvals"
      subtitle="School-side approval visibility for teachers, institution resources, and challenges. Final admin approval remains protected."
      loading={loading}
      refreshing={refreshing}
      error={error}
      onRefresh={reload}
    >
      <MetricGrid>
        <MetricCard label="Pending Items" value={approvals.length} icon="time" />
        <MetricCard label="Teachers" value={approvals.filter((item) => item.type === "teacher").length} icon="school" />
        <MetricCard label="Resources" value={approvals.filter((item) => item.type === "resource").length} icon="library" />
        <MetricCard label="Challenges" value={approvals.filter((item) => item.type === "challenge").length} icon="trophy" />
      </MetricGrid>

      <SectionTitle title="Approval Queue" subtitle="This is the institution management queue; admin/security gates are not bypassed." />
      {approvals.length ? (
        approvals.map((item) => (
          <InfoCard
            key={`${item.type}-${item.id}`}
            title={item.title}
            subtitle={`${item.type} | ${item.status}`}
            meta={item.detail || "Institution item waiting for review."}
            icon={item.type === "teacher" ? "school" : item.type === "resource" ? "library" : "trophy"}
          />
        ))
      ) : (
        <EmptyState title="No pending approvals" subtitle="Teacher, resource, and challenge approvals will appear here when they need attention." />
      )}

      <SectionTitle title="Head Control Tools" subtitle="School monitoring, teacher quality, class reports, and certificate control start here." />
      <InfoCard
        title="Teacher Performance"
        subtitle="Compare teacher activity, assigned classes, created content, pending reviews, and student completion rate."
        meta="Use teacher reports to find who needs support and which classes are moving well."
        icon="people"
        to="/institution-management/head-teachers"
      />
      <InfoCard
        title="Class-Wise Reports"
        subtitle="Track class participation, quiz activity, roadmap completion, challenge submissions, and top students."
        meta="Class reports help compare sections like Class 8 A, 8 B, and 9 A inside the same school."
        icon="stats-chart"
        to="/institution-management/head-reports"
      />
      <InfoCard
        title="Content Approval Control"
        subtitle="Review school resources, class challenges, roadmap programs, certificate templates, and teacher requests."
        meta="Final admin/security approval remains protected; this is school-side visibility and control."
        icon="shield-checkmark"
      />
      <InfoCard
        title="Certificate & Reward Issuing"
        subtitle="Issue recognition for school toppers, class champions, competition winners, most improved, and perfect score students."
        meta="Uses the existing certificate templates and school reward categories."
        icon="ribbon"
        to="/community/certifications"
      />
    </ManagementScreen>
  );
}
