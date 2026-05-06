import * as WebBrowser from "expo-web-browser";
import React, { useCallback, useMemo, useState } from "react";
import { Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { api } from "@/lib/api";
import { getAppErrorMessage } from "@/lib/appError";
import { useAppTheme } from "@/context/ThemeContext";
import {
  AcademicCard,
  AcademicEmpty,
  ActionButton,
  CommunitySection,
  HighSchoolCommunityShell,
  StatusBadge
} from "@/components/community/highschool-ui";

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
  fileUrl?: string;
  supportingDocuments?: string[];
};
type LibraryResponse = { institutionResources?: ResourceItem[]; roadmapResources?: ResourceItem[]; domainResources?: ResourceItem[] };
type AcademicSubjectSummary = { key: string; subject: string; verificationStatus?: string; chapterCount?: number };
type AcademicSubjectResponse = {
  subject?: {
    metadata?: { subject?: string; verification_status?: string };
    chapters?: { chapter_no?: number; chapter_name?: string; unit?: string; topics?: { topic_name?: string; subtopics?: string[] }[] }[];
  };
};

const DEMO_BOARD = "CBSE";
const DEMO_CLASS = 10;

function firstPdfUrl(item: ResourceItem) {
  const candidates = [item.documentUrl, item.url, item.fileUrl, ...(item.supportingDocuments || [])]
    .map((value) => String(value || "").trim())
    .filter(Boolean);
  return candidates.find((value) => /\.pdf(\?|#|$)/i.test(value) || value.toLowerCase().includes("pdf"));
}

function normalizeUrl(rawUrl?: string) {
  const value = String(rawUrl || "").trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith("/")) return `${String(api.defaults.baseURL || "").replace(/\/$/, "")}${value}`;
  return `https://${value}`;
}

export default function HighSchoolResourceLibraryScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const [resources, setResources] = useState<ResourceItem[]>([]);
  const [subjects, setSubjects] = useState<AcademicSubjectSummary[]>([]);
  const [selectedSubjectKey, setSelectedSubjectKey] = useState("mathematics");
  const [academicSubject, setAcademicSubject] = useState<AcademicSubjectResponse["subject"] | null>(null);
  const [selectedResource, setSelectedResource] = useState<ResourceItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pdfResources = useMemo(() => resources.filter((item) => Boolean(firstPdfUrl(item))), [resources]);
  const selectedSubject = useMemo(() => subjects.find((item) => item.key === selectedSubjectKey) || subjects[0], [selectedSubjectKey, subjects]);
  const chapters = academicSubject?.chapters || [];

  const openPdf = useCallback(async (item: ResourceItem) => {
    const url = normalizeUrl(firstPdfUrl(item));
    if (!url) {
      setError("This resource does not include a valid PDF URL.");
      return;
    }
    try {
      await WebBrowser.openBrowserAsync(url);
    } catch {
      try {
        await Linking.openURL(url);
      } catch {
        setError("Unable to open this PDF. Please check the uploaded document URL.");
      }
    }
  }, []);

  const loadSubject = useCallback(async (subjectKey: string) => {
    try {
      setSelectedSubjectKey(subjectKey);
      const subjectRes = await api.get<AcademicSubjectResponse>(`/api/academics/${DEMO_BOARD}/class/${DEMO_CLASS}/subject/${subjectKey}`);
      setAcademicSubject(subjectRes.data?.subject || (subjectRes.data as any) || null);
    } catch (e) {
      setError(getAppErrorMessage(e, "Failed to load academic subject."));
    }
  }, []);

  const load = useCallback(async (refresh = false) => {
    try {
      if (refresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      const [libraryRes, subjectsRes] = await Promise.allSettled([
        api.get<LibraryResponse>("/api/network/knowledge-library"),
        api.get<{ subjects: AcademicSubjectSummary[] }>(`/api/academics/${DEMO_BOARD}/class/${DEMO_CLASS}/subjects`)
      ]);
      const library = libraryRes.status === "fulfilled" ? libraryRes.value.data || {} : {};
      setResources([...(library.institutionResources || []), ...(library.domainResources || []), ...(library.roadmapResources || [])]);
      const nextSubjects = subjectsRes.status === "fulfilled" ? subjectsRes.value.data?.subjects || [] : [];
      setSubjects(nextSubjects);
      const nextKey = nextSubjects.find((item) => item.key === selectedSubjectKey)?.key || nextSubjects[0]?.key || selectedSubjectKey;
      if (nextKey) await loadSubject(nextKey);
    } catch (e) {
      setError(getAppErrorMessage(e, "Failed to load resource library."));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [loadSubject, selectedSubjectKey]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return (
    <HighSchoolCommunityShell
      eyebrow={`${DEMO_BOARD} Class ${DEMO_CLASS}`}
      title="Resource Library"
      subtitle="PDF-first school resources plus syllabus browsing. No random links are shown here."
      stats={[
        { icon: "book", label: "Subjects", value: String(subjects.length) },
        { icon: "library", label: "Chapters", value: String(chapters.length) },
        { icon: "document-text", label: "PDFs", value: String(pdfResources.length) }
      ]}
      loading={loading}
      error={error}
      refreshing={refreshing}
      onRefresh={() => load(true)}
    >
      <CommunitySection title="Academic Source Browser" subtitle="Use syllabus context for roadmap, practice and assistant prompts." icon="library">
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
                      { borderColor: active ? "#16A34A" : colors.border, backgroundColor: active ? "#ECFDF3" : colors.surfaceAlt }
                    ]}
                    onPress={() => loadSubject(subject.key)}
                  >
                    <Text style={[styles.subjectText, { color: active ? "#15803D" : colors.textMuted }]}>{subject.subject}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <View style={styles.badgeRow}>
              <StatusBadge label={selectedSubject?.subject || "Selected subject"} tone="success" />
              <StatusBadge label={academicSubject?.metadata?.verification_status || selectedSubject?.verificationStatus || "dataset"} tone="primary" />
            </View>
            {chapters.slice(0, 8).map((chapter) => (
              <AcademicCard
                key={`${chapter.chapter_no}-${chapter.chapter_name}`}
                icon="book-outline"
                title={`${chapter.chapter_no || ""}. ${chapter.chapter_name || "Chapter"}`}
                meta={`${chapter.unit || "Syllabus"} · ${chapter.topics?.length || 0} topics`}
                note={(chapter.topics || []).slice(0, 3).map((topic) => topic.topic_name).filter(Boolean).join(", ") || "Open this chapter in academic roadmap."}
                badge="Roadmap"
                actionLabel="Use in Roadmap"
                secondaryLabel="Practice Topic"
                onPress={() =>
                  router.push(
                    `/ai/highschool-study-roadmap?subject=${encodeURIComponent(selectedSubject?.subject || "")}&chapter=${encodeURIComponent(chapter.chapter_name || "")}` as never
                  )
                }
                onSecondaryPress={() => router.push(`/ai/highschool-subject-gap?subject=${encodeURIComponent(selectedSubject?.subject || "")}` as never)}
              />
            ))}
          </>
        ) : (
          <AcademicEmpty label="Academic dataset is not connected yet." />
        )}
      </CommunitySection>

      <CommunitySection title="Teacher PDFs" subtitle="Only resources with valid PDF URLs appear here." icon="document-text">
        {pdfResources.length ? (
          pdfResources.slice(0, 12).map((item) => (
            <AcademicCard
              key={item._id || item.id || item.title}
              icon="document-attach-outline"
              title={item.title}
              meta={`${item.domain || "School"} · ${item.type || "Resource"} · PDF`}
              note={item.description || `Uploaded by ${item.mentor?.name || "Mentor"}`}
              badge="PDF"
              badgeTone="success"
              actionLabel="Open PDF"
              secondaryLabel="Details"
              onPress={() => openPdf(item)}
              onSecondaryPress={() => setSelectedResource(item)}
            />
          ))
        ) : (
          <AcademicEmpty label="No PDF resources uploaded yet. High school Resource Library hides non-PDF links by design." />
        )}
      </CommunitySection>

      {selectedResource ? (
        <CommunitySection title="Resource Detail" subtitle="After-12 knowledge detail style, academic actions." icon="reader">
          <AcademicCard
            icon="document-text"
            title={selectedResource.title}
            meta={`${selectedResource.domain || "School"} · ${selectedResource.type || "Resource"}`}
            note={selectedResource.description || `Uploaded by ${selectedResource.mentor?.name || "Mentor"}`}
            badge="PDF"
            badgeTone="success"
          />
          <View style={styles.actions}>
            <ActionButton label="Open PDF" icon="open-outline" onPress={() => openPdf(selectedResource)} />
            <ActionButton label="Use in Roadmap" icon="map-outline" variant="secondary" onPress={() => router.push("/ai/highschool-study-roadmap" as never)} />
            <ActionButton label="Practice Topic" icon="fitness-outline" variant="ghost" onPress={() => router.push("/ai/highschool-subject-gap" as never)} />
          </View>
        </CommunitySection>
      ) : null}
    </HighSchoolCommunityShell>
  );
}

const styles = StyleSheet.create({
  subjectRow: { gap: 8, paddingBottom: 2 },
  subjectChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  subjectText: { fontWeight: "900", fontSize: 13 },
  badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  actions: { gap: 10 }
});
