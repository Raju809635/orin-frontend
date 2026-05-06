import React, { useCallback, useMemo, useState } from "react";
import { Linking, ScrollView, StyleSheet, Text, TouchableOpacity } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { api } from "@/lib/api";
import { getAppErrorMessage } from "@/lib/appError";
import { useAppTheme } from "@/context/ThemeContext";
import { EmptyState, StageCommunityScaffold, StageListCard, StageSection, StageStatRow } from "@/components/community/stage-community-data-ui";

type ResourceItem = {
  _id?: string;
  id?: string;
  title: string;
  domain?: string;
  type?: string;
  description?: string;
  mentor?: { name?: string } | null;
  documentUrl?: string;
  url?: string;
};
type LibraryResponse = { institutionResources?: ResourceItem[]; roadmapResources?: ResourceItem[]; domainResources?: ResourceItem[] };
type InstitutionRoadmapItem = { _id?: string; id?: string; title: string; domain?: string; className?: string; mentor?: { name?: string } | null; weeks?: { id: string }[] };
type AcademicSubjectSummary = { key: string; subject: string; verificationStatus?: string; chapterCount?: number };
type AcademicSubjectResponse = {
  subject?: {
    metadata?: { subject?: string; verification_status?: string };
    chapters?: {
      chapter_no?: number;
      chapter_name?: string;
      unit?: string;
      topics?: { topic_name?: string; subtopics?: string[] }[];
    }[];
  };
};

const DEMO_BOARD = "CBSE";
const DEMO_CLASS = 10;

export default function HighSchoolResourceLibraryScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const [institutionItems, setInstitutionItems] = useState<ResourceItem[]>([]);
  const [domainItems, setDomainItems] = useState<ResourceItem[]>([]);
  const [roadmaps, setRoadmaps] = useState<InstitutionRoadmapItem[]>([]);
  const [subjects, setSubjects] = useState<AcademicSubjectSummary[]>([]);
  const [selectedSubjectKey, setSelectedSubjectKey] = useState("mathematics");
  const [academicSubject, setAcademicSubject] = useState<AcademicSubjectResponse["subject"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isPdfResource = useCallback((item: ResourceItem) => {
    const documentUrl = String(item.documentUrl || "").toLowerCase().trim();
    const externalUrl = String(item.url || "").toLowerCase().trim();
    return documentUrl.endsWith(".pdf") || externalUrl.endsWith(".pdf") || documentUrl.includes(".pdf?") || externalUrl.includes(".pdf?");
  }, []);

  const pdfResources = useMemo(
    () => [...institutionItems, ...domainItems].filter(isPdfResource),
    [domainItems, institutionItems, isPdfResource]
  );

  const selectedSubject = useMemo(
    () => subjects.find((item) => item.key === selectedSubjectKey) || subjects[0],
    [selectedSubjectKey, subjects]
  );

  const openPdf = useCallback((item: ResourceItem) => {
    const rawUrl = String(item.documentUrl || item.url || "").trim();
    if (!rawUrl) {
      setError("PDF URL is missing for this resource.");
      return;
    }
    const normalized = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
    Linking.openURL(normalized).catch(() => {
      setError("Unable to open PDF document.");
    });
  }, []);

  const load = useCallback(async (refresh = false) => {
    try {
      if (refresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      const [libraryRes, roadmapRes, subjectsRes] = await Promise.allSettled([
        api.get<LibraryResponse>("/api/network/knowledge-library"),
        api.get<{ roadmaps: InstitutionRoadmapItem[] }>("/api/network/institution-roadmaps"),
        api.get<{ subjects: AcademicSubjectSummary[] }>(`/api/academics/${DEMO_BOARD}/class/${DEMO_CLASS}/subjects`)
      ]);

      setInstitutionItems(libraryRes.status === "fulfilled" ? libraryRes.value.data?.institutionResources || [] : []);
      setDomainItems(libraryRes.status === "fulfilled" ? libraryRes.value.data?.domainResources || [] : []);
      setRoadmaps(roadmapRes.status === "fulfilled" ? roadmapRes.value.data?.roadmaps || [] : []);

      const nextSubjects = subjectsRes.status === "fulfilled" ? subjectsRes.value.data?.subjects || [] : [];
      setSubjects(nextSubjects);
      const nextSelectedKey = nextSubjects.find((item) => item.key === selectedSubjectKey)?.key || nextSubjects[0]?.key || selectedSubjectKey;
      setSelectedSubjectKey(nextSelectedKey);

      if (nextSelectedKey) {
        const subjectRes = await api.get<AcademicSubjectResponse>(`/api/academics/${DEMO_BOARD}/class/${DEMO_CLASS}/subject/${nextSelectedKey}`);
        setAcademicSubject(subjectRes.data?.subject || (subjectRes.data as any) || null);
      } else {
        setAcademicSubject(null);
      }
    } catch (e) {
      setError(getAppErrorMessage(e, "Failed to load resource library."));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedSubjectKey]);

  const loadSubject = useCallback(async (subjectKey: string) => {
    try {
      setSelectedSubjectKey(subjectKey);
      const subjectRes = await api.get<AcademicSubjectResponse>(`/api/academics/${DEMO_BOARD}/class/${DEMO_CLASS}/subject/${subjectKey}`);
      setAcademicSubject(subjectRes.data?.subject || (subjectRes.data as any) || null);
    } catch (e) {
      setError(getAppErrorMessage(e, "Failed to load academic subject."));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const chapters = academicSubject?.chapters || [];

  return (
    <StageCommunityScaffold
      eyebrow={`${DEMO_BOARD} Class ${DEMO_CLASS} Demo`}
      title="Resource Library"
      subtitle="Same ORIN community quality, but school-academic resources only. PDFs open directly from this page."
      loading={loading}
      error={error}
      refreshing={refreshing}
      onRefresh={() => load(true)}
    >
      <StageStatRow
        items={[
          { label: "Subjects", value: String(subjects.length) },
          { label: "Chapters", value: String(chapters.length) },
          { label: "PDFs", value: String(pdfResources.length) }
        ]}
      />

      <StageSection title="Academic Source Browser" icon="library">
        {subjects.length ? (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.subjectRow}>
              {subjects.map((subject) => {
                const active = subject.key === selectedSubjectKey;
                return (
                  <TouchableOpacity
                    key={subject.key}
                    style={[
                      styles.subjectChip,
                      { borderColor: active ? colors.accent : colors.border, backgroundColor: active ? colors.accentSoft : colors.surfaceAlt }
                    ]}
                    onPress={() => loadSubject(subject.key)}
                  >
                    <Text style={[styles.subjectText, { color: active ? colors.accent : colors.textMuted }]}>{subject.subject}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <StageListCard
              title={selectedSubject?.subject || academicSubject?.metadata?.subject || "Selected subject"}
              meta={`${chapters.length} chapters | ${academicSubject?.metadata?.verification_status || selectedSubject?.verificationStatus || "dataset"}`}
              note="Pick a chapter to jump into Study Roadmap context."
              tone="highschool"
            />
            {chapters.slice(0, 6).map((chapter) => (
              <StageListCard
                key={`${chapter.chapter_no}-${chapter.chapter_name}`}
                title={`${chapter.chapter_no || ""}. ${chapter.chapter_name || "Chapter"}`}
                meta={`${chapter.unit || "Syllabus"} | ${chapter.topics?.length || 0} topics`}
                note={(chapter.topics || [])
                  .slice(0, 3)
                  .map((topic) => topic.topic_name)
                  .filter(Boolean)
                  .join(", ")}
                tone="highschool"
                onPress={() =>
                  router.push(
                    `/ai/highschool-study-roadmap?subject=${encodeURIComponent(selectedSubject?.subject || "")}&chapter=${encodeURIComponent(
                      chapter.chapter_name || ""
                    )}` as never
                  )
                }
              />
            ))}
          </>
        ) : (
          <EmptyState label="Academic dataset is not connected yet." />
        )}
      </StageSection>

      <StageSection title="Teacher & Institution Resources (PDF Only)" icon="document-text" actionLabel="Open full" onAction={() => router.push("/community/knowledge-library" as never)}>
        {pdfResources.length ? (
          pdfResources.slice(0, 8).map((item) => (
            <StageListCard
              key={item._id || item.id || item.title}
              title={item.title}
              meta={`${item.domain || "School"} | ${item.type || "Resource"} | PDF`}
              note={item.description || `Uploaded by ${item.mentor?.name || "Mentor"} · Tap to open PDF`}
              tone="highschool"
              onPress={() => openPdf(item)}
            />
          ))
        ) : (
          <EmptyState label="No PDF resources yet. Upload document PDFs in Knowledge Library." />
        )}
      </StageSection>

      <StageSection title="Institution Roadmaps" icon="map" actionLabel="Open full" onAction={() => router.push("/ai/career-roadmap?section=institution" as never)}>
        {roadmaps.length ? (
          roadmaps.slice(0, 4).map((item) => (
            <StageListCard
              key={item._id || item.id || item.title}
              title={item.title}
              meta={`${item.domain || "Study"} | ${item.weeks?.length || 0} weeks`}
              note={`Mentor: ${item.mentor?.name || "Guide"}${item.className ? ` | Class ${item.className}` : ""}`}
              tone="highschool"
            />
          ))
        ) : (
          <EmptyState label="No institution roadmaps yet." />
        )}
      </StageSection>
    </StageCommunityScaffold>
  );
}

const styles = StyleSheet.create({
  subjectRow: { gap: 8, paddingBottom: 2 },
  subjectChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  subjectText: { fontWeight: "900", fontSize: 13 }
});

