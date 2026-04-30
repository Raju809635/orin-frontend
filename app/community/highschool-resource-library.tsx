import React, { useCallback, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { api } from "@/lib/api";
import { getAppErrorMessage } from "@/lib/appError";
import { EmptyState, StageCommunityScaffold, StageListCard, StageSection, StageStatRow } from "@/components/community/stage-community-data-ui";

type ResourceItem = { id: string; title: string; domain?: string; type?: string; description?: string; mentor?: { name?: string } | null };
type LibraryResponse = { institutionResources?: ResourceItem[]; roadmapResources?: ResourceItem[]; domainResources?: ResourceItem[] };
type InstitutionRoadmapItem = { id: string; title: string; domain?: string; className?: string; mentor?: { name?: string } | null; weeks?: { id: string }[] };

export default function HighSchoolResourceLibraryScreen() {
  const router = useRouter();
  const [institutionItems, setInstitutionItems] = useState<ResourceItem[]>([]);
  const [domainItems, setDomainItems] = useState<ResourceItem[]>([]);
  const [roadmaps, setRoadmaps] = useState<InstitutionRoadmapItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    try {
      if (refresh) setRefreshing(true); else setLoading(true);
      setError(null);
      const [libraryRes, roadmapRes] = await Promise.allSettled([
        api.get<LibraryResponse>("/api/network/knowledge-library"),
        api.get<{ roadmaps: InstitutionRoadmapItem[] }>("/api/network/institution-roadmaps")
      ]);
      setInstitutionItems(libraryRes.status === "fulfilled" ? libraryRes.value.data?.institutionResources || [] : []);
      setDomainItems(libraryRes.status === "fulfilled" ? libraryRes.value.data?.domainResources || [] : []);
      setRoadmaps(roadmapRes.status === "fulfilled" ? roadmapRes.value.data?.roadmaps || [] : []);
    } catch (e) {
      setError(getAppErrorMessage(e, "Failed to load resource library."));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <StageCommunityScaffold
      title="Resource Library"
      subtitle="Use the existing knowledge library and roadmap areas through school-first entry points."
      loading={loading}
      error={error}
      refreshing={refreshing}
      onRefresh={() => load(true)}
    >
      <StageStatRow items={[
        { label: "Institution", value: String(institutionItems.length) },
        { label: "Roadmaps", value: String(roadmaps.length) }
      ]} />
      <StageSection title="Knowledge Library" icon="library" actionLabel="Open full" onAction={() => router.push("/community/knowledge-library" as never)}>
        {institutionItems.length ? institutionItems.slice(0, 5).map((item) => (
          <StageListCard
            key={item.id}
            title={item.title}
            meta={`${item.domain || "School"} · ${item.type || "Resource"}`}
            note={item.description || `Uploaded by ${item.mentor?.name || "Mentor"}`}
            tone="highschool"
          />
        )) : domainItems.length ? domainItems.slice(0, 5).map((item) => (
          <StageListCard
            key={item.id}
            title={item.title}
            meta={`${item.domain || "Study"} · ${item.type || "Guide"}`}
            note={item.description}
            tone="highschool"
          />
        )) : <EmptyState label="No library resources yet." />}
      </StageSection>
      <StageSection title="Institution Activities" icon="map" actionLabel="Open full" onAction={() => router.push("/ai/career-roadmap?section=institution" as never)}>
        {roadmaps.length ? roadmaps.slice(0, 4).map((item) => (
          <StageListCard
            key={item.id}
            title={item.title}
            meta={`${item.domain || "Study"} · ${item.weeks?.length || 0} weeks`}
            note={`Mentor: ${item.mentor?.name || "Guide"}${item.className ? ` · Class ${item.className}` : ""}`}
            tone="highschool"
          />
        )) : <EmptyState label="No institution activities yet." />}
      </StageSection>
    </StageCommunityScaffold>
  );
}
