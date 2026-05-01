import React from "react";
import { useRouter } from "expo-router";
import { EmptyState, StageCommunityScaffold, StageListCard, StageSection, StageStatRow } from "@/components/community/stage-community-data-ui";

const PROGRAMS = [
  { title: "School Workshop", meta: "Teacher-led · Limited seats", note: "Join school workshops and guided academic programs." },
  { title: "Science Camp", meta: "Weekend program", note: "Hands-on activities for experiments and teamwork." },
  { title: "Future Path Session", meta: "Guidance session", note: "Explore streams and school-safe opportunities." }
];

export default function HighSchoolProgramsScreen() {
  const router = useRouter();
  return (
    <StageCommunityScaffold title="Programs & Opportunities" subtitle="School-friendly workshops, camps, and guided opportunities." loading={false} refreshing={false} onRefresh={() => null}>
      <StageStatRow items={[{ label: "Programs", value: String(PROGRAMS.length) }, { label: "Type", value: "School" }]} />
      <StageSection title="Available Programs" icon="briefcase" actionLabel="Open full" onAction={() => router.push("/community/opportunities" as never)}>
        {PROGRAMS.length ? PROGRAMS.map((item) => <StageListCard key={item.title} title={item.title} meta={item.meta} note={item.note} tone="highschool" />) : <EmptyState label="No programs yet." />}
      </StageSection>
    </StageCommunityScaffold>
  );
}

