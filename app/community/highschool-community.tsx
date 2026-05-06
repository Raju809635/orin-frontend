import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { useRouter } from "expo-router";
import { StageCommunityScaffold, StageListCard, StageSection, StageStatRow } from "@/components/community/stage-community-data-ui";

const MODULES: { title: string; meta: string; note: string; path: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { title: "Study Groups", meta: "Class and subject groups", note: "School feed, guided groups, and academic discussion.", path: "/community/highschool-study-groups", icon: "people" },
  { title: "School Challenges", meta: "Quiz, competition, practice", note: "Challenge board plus subject-gap quiz entry.", path: "/community/highschool-school-challenges", icon: "trophy" },
  { title: "Achievements", meta: "Certificates and badges", note: "Recognition, XP, and certificate snapshots.", path: "/community/highschool-achievements", icon: "ribbon" },
  { title: "Programs & Opportunities", meta: "Workshops and programs", note: "Student-safe opportunities from ORIN network.", path: "/community/highschool-programs", icon: "briefcase" },
  { title: "School Leaderboard", meta: "Healthy ranking", note: "Class/school progress without open social noise.", path: "/community/highschool-leaderboard", icon: "podium" },
  { title: "Resource Library", meta: "Academic dataset + resources", note: "CBSE Class 10 demo syllabus, resources, and roadmaps.", path: "/community/highschool-resource-library", icon: "library" },
  { title: "School Progress", meta: "Weekly improvement", note: "Dashboard, skill radar, XP, and academic momentum.", path: "/community/highschool-progress", icon: "stats-chart" }
];

export default function HighSchoolCommunityScreen() {
  const router = useRouter();
  return (
    <StageCommunityScaffold
      eyebrow="High School Community"
      title="Academic Community"
      subtitle="A school-first community layer for groups, challenges, resources, recognition, and progress."
      loading={false}
      refreshing={false}
      onRefresh={() => null}
    >
      <StageStatRow items={[
        { label: "Modules", value: String(MODULES.length) },
        { label: "Mode", value: "School" },
        { label: "Social", value: "Guided" }
      ]} />
      <StageSection title="Open a module" icon="grid">
        {MODULES.map((module) => (
          <StageListCard
            key={module.title}
            title={module.title}
            meta={module.meta}
            note={module.note}
            tone="highschool"
            onPress={() => router.push(module.path as never)}
          />
        ))}
      </StageSection>
    </StageCommunityScaffold>
  );
}
