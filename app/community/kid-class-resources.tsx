import React, { useCallback, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { api } from "@/lib/api";
import { getAppErrorMessage } from "@/lib/appError";
import { EmptyState, StageCommunityScaffold, StageListCard, StageSection, StageStatRow } from "@/components/community/stage-community-data-ui";

type ResourceItem = { id: string; title: string; domain?: string; type?: string; description?: string; mentor?: { name?: string } | null };
type LibraryResponse = { institutionResources?: ResourceItem[]; roadmapResources?: ResourceItem[] };

export default function KidClassResourcesScreen() {
  const router = useRouter();
  const [institutionItems, setInstitutionItems] = useState<ResourceItem[]>([]);
  const [roadmapItems, setRoadmapItems] = useState<ResourceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    try {
      if (refresh) setRefreshing(true); else setLoading(true);
      setError(null);
      const res = await api.get<LibraryResponse>("/api/network/knowledge-library");
      setInstitutionItems(res.data?.institutionResources || []);
      setRoadmapItems(res.data?.roadmapResources || []);
    } catch (e) {
      setError(getAppErrorMessage(e, "Failed to load class resources."));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <StageCommunityScaffold
      title="Class Resources"
      subtitle="Open classroom resources and institution material through the existing knowledge library."
      loading={loading}
      error={error}
      refreshing={refreshing}
      onRefresh={() => load(true)}
    >
      <StageStatRow items={[
        { label: "School resources", value: String(institutionItems.length) },
        { label: "Roadmap picks", value: String(roadmapItems.length) }
      ]} />
      <StageSection title="Class Resource Library" icon="library" actionLabel="Open full" onAction={() => router.push("/community/knowledge-library?section=institution" as never)}>
        {institutionItems.length ? institutionItems.slice(0, 5).map((item) => (
          <StageListCard
            key={item.id}
            title={item.title}
            meta={`${item.domain || "School"} · ${item.type || "Resource"}`}
            note={item.description || `Uploaded by ${item.mentor?.name || "Teacher"}`}
            tone="kid"
          />
        )) : <EmptyState label="No class resources yet." />}
      </StageSection>
      <StageSection title="Creative Support" icon="color-wand" actionLabel="Open full" onAction={() => router.push("/ai/creative-corner" as never)}>
        <StageListCard
          title="Creative Corner"
          meta="Story, drawing, and class expression"
          note="Open ORIN creative tools for school-friendly activities."
          tone="kid"
        />
      </StageSection>
    </StageCommunityScaffold>
  );
}
