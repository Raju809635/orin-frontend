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

type ReviewItem = {
  id: string;
  type: "roadmap" | "resource" | "challenge";
  title: string;
  className?: string;
  studentName: string;
  status: string;
  routeHint?: string;
};

type ReviewsResponse = {
  scope: ManagementScope;
  reviews: ReviewItem[];
};

export default function TeacherReviewsScreen() {
  const { data, loading, refreshing, error, reload } = useInstitutionManagement<ReviewsResponse>("reviews");
  const reviews = data?.reviews || [];
  const pending = reviews.filter((item) => ["submitted", "pending"].includes(String(item.status || "").toLowerCase()));

  return (
    <ManagementScreen
      eyebrow="Class Teacher"
      title="Reviews"
      subtitle="Review student proofs for class roadmaps, resources, and challenges. Give marks, XP, and feedback from the linked tool."
      loading={loading}
      refreshing={refreshing}
      error={error}
      onRefresh={reload}
    >
      <MetricGrid>
        <MetricCard label="Pending" value={pending.length} icon="time" />
        <MetricCard label="All Reviews" value={reviews.length} icon="documents" />
        <MetricCard label="Roadmaps" value={reviews.filter((item) => item.type === "roadmap").length} icon="map" />
        <MetricCard label="Challenges" value={reviews.filter((item) => item.type === "challenge").length} icon="trophy" />
      </MetricGrid>

      <SectionTitle title="Review Queue" subtitle="The queue is scoped to your institution and assigned classes." />
      {reviews.length ? (
        reviews.slice(0, 30).map((item) => (
          <InfoCard
            key={`${item.type}-${item.id}`}
            title={item.title}
            subtitle={`${item.studentName} | ${item.className ? `Class ${item.className}` : "Institution"} | ${item.status}`}
            meta={`Type: ${item.type}. Open the linked module to approve, reject, award XP, or add feedback.`}
            icon={item.type === "challenge" ? "trophy" : item.type === "resource" ? "library" : "map"}
            to={item.routeHint || "/mentor-dashboard?section=reviews"}
          />
        ))
      ) : (
        <EmptyState title="No reviews yet" subtitle="Student submissions from your assigned classes will appear here." />
      )}
    </ManagementScreen>
  );
}
