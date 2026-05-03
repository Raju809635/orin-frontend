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

      <SectionTitle title="Teacher Review Tools" subtitle="Daily correction, marks, XP, and recognition actions stay grouped here." />
      <InfoCard
        title="Marks & Feedback"
        subtitle="Approve, reject, request changes, add score, and award XP from the linked review module."
        meta="Use this after opening a roadmap, challenge, or resource submission from the queue."
        icon="create"
        to="/mentor-dashboard?section=reviews"
      />
      <InfoCard
        title="Certificate Recommendations"
        subtitle="Recommend certificates for completed roadmap work, competition winners, perfect scores, and improvement."
        meta="Certificate templates and issuing continue through the current certificate system."
        icon="ribbon"
        to="/community/certifications"
      />
      <InfoCard
        title="Class Activity Tracker"
        subtitle="Check active students, missing submissions, participation, streaks, and repeated pending work."
        meta="This starts the teacher-side tracking layer without changing student screens."
        icon="pulse"
        to="/institution-management/teacher-classes"
      />
      <InfoCard
        title="Student Detail Follow-up"
        subtitle="Open class lists first, then drill into student work history, progress, quiz activity, and notes as that view expands."
        meta="Useful for one-to-one correction and parent/admin discussion later."
        icon="person-circle"
        to="/institution-management/teacher-classes"
      />
    </ManagementScreen>
  );
}
