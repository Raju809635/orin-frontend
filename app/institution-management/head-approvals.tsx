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
    </ManagementScreen>
  );
}
