import React, { useCallback, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { api } from "@/lib/api";
import { getAppErrorMessage } from "@/lib/appError";
import { EmptyState, StageCommunityScaffold, StageListCard, StageSection, StageStatRow } from "@/components/community/stage-community-data-ui";

type OpportunityItem = {
  _id: string;
  title: string;
  company?: string;
  role?: string;
  type?: string;
  category?: string;
  duration?: string;
  description?: string;
  isActive?: boolean;
  recommendationReason?: string;
};

export default function HighSchoolProgramsScreen() {
  const router = useRouter();
  const [programs, setPrograms] = useState<OpportunityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    try {
      if (refresh) setRefreshing(true); else setLoading(true);
      setError(null);
      const { data } = await api.get<OpportunityItem[]>("/api/network/opportunities");
      setPrograms((data || []).filter((item) => item.isActive !== false));
    } catch (e) {
      setError(getAppErrorMessage(e, "Failed to load school programs."));
      setPrograms([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <StageCommunityScaffold
      eyebrow="High School Community"
      title="Programs & Opportunities"
      subtitle="School-friendly workshops, camps, and guided opportunities from the ORIN network."
      loading={loading}
      error={error}
      refreshing={refreshing}
      onRefresh={() => load(true)}
    >
      <StageStatRow items={[
        { label: "Programs", value: String(programs.length) },
        { label: "Type", value: "School" }
      ]} />
      <StageSection title="Available Programs" icon="briefcase" actionLabel="Open full" onAction={() => router.push("/community/opportunities" as never)}>
        {programs.length ? programs.slice(0, 6).map((item) => (
          <StageListCard
            key={item._id || item.title}
            title={item.title}
            meta={`${item.category || item.type || "Program"}${item.duration ? ` | ${item.duration}` : ""}`}
            note={item.recommendationReason || item.description || `${item.company || "ORIN"}${item.role ? ` | ${item.role}` : ""}`}
            tone="highschool"
            onPress={() => router.push("/community/opportunities" as never)}
          />
        )) : <EmptyState label="No school programs are live right now." />}
      </StageSection>
    </StageCommunityScaffold>
  );
}
