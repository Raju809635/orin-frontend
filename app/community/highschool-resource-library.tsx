import * as WebBrowser from "expo-web-browser";
import React, { useCallback, useMemo, useState } from "react";
import { Linking, ScrollView, StyleSheet, Text, TouchableOpacity } from "react-native";
import { useFocusEffect } from "expo-router";
import { api } from "@/lib/api";
import { getAppErrorMessage } from "@/lib/appError";
import { useAppTheme } from "@/context/ThemeContext";
import { HighSchoolSideDrawer, type HighSchoolDrawerItem } from "@/components/community/highschool-side-drawer";
import {
  AcademicCard,
  AcademicEmpty,
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

type LibraryResponse = {
  institutionResources?: ResourceItem[];
  domainResources?: ResourceItem[];
};

type AcademicSubjectSummary = {
  key: string;
  name?: string;
  subject?: string;
  available?: boolean;
  verificationStatus?: string;
};

type AcademicSubjectResponse = {
  available?: boolean;
  message?: string;
  subject?: { metadata?: { subject?: string; verification_status?: string } };
};

type AcademicPdf = {
  id: string;
  title: string;
  fileName: string;
  subject: string;
  board: string;
  pdfUrl: string;
};

type AcademicPdfResponse = { pdfs?: AcademicPdf[] };
type ResourceView = "app" | "teacher";

const CLASS_OPTIONS = [6, 7, 8, 9, 10, 11, 12];
const BOARD_OPTIONS = ["SSC", "CBSE", "ICSE"];

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
  const { colors } = useAppTheme();
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [resourceView, setResourceView] = useState<ResourceView>("app");
  const [resources, setResources] = useState<ResourceItem[]>([]);
  const [subjects, setSubjects] = useState<AcademicSubjectSummary[]>([]);
  const [board, setBoard] = useState("SSC");
  const [classNumber, setClassNumber] = useState(10);
  const [selectedSubjectKey, setSelectedSubjectKey] = useState("mathematics");
  const [academicSubject, setAcademicSubject] = useState<AcademicSubjectResponse | null>(null);
  const [academicPdfs, setAcademicPdfs] = useState<AcademicPdf[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pdfResources = useMemo(() => resources.filter((item) => Boolean(firstPdfUrl(item))), [resources]);
  const selectedSubject = useMemo(
    () => subjects.find((item) => item.key === selectedSubjectKey) || subjects[0],
    [selectedSubjectKey, subjects]
  );
  const drawerItems = useMemo<HighSchoolDrawerItem[]>(
    () => [
      {
        key: "app-resources",
        label: "App Resources",
        meta: "ORIN textbook PDFs by board, class, subject and chapter dataset",
        icon: "book",
        badge: String(academicPdfs.length),
        onPress: () => setResourceView("app")
      },
      {
        key: "teacher-resources",
        label: "Teacher Resources",
        meta: "PDF resources uploaded by Global Teachers for high-school students",
        icon: "school",
        badge: String(pdfResources.length),
        onPress: () => setResourceView("teacher")
      }
    ],
    [academicPdfs.length, pdfResources.length]
  );

  const openPdfUrl = useCallback(async (rawUrl?: string) => {
    const url = normalizeUrl(rawUrl);
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
      const [subjectRes, pdfRes] = await Promise.all([
        api.get<AcademicSubjectResponse>(`/api/academics/${board}/class/${classNumber}/subject/${subjectKey}/topics`),
        api.get<AcademicPdfResponse>(`/api/academics/${board}/class/${classNumber}/subject/${subjectKey}/pdfs`)
      ]);
      setAcademicSubject(subjectRes.data || null);
      setAcademicPdfs(pdfRes.data?.pdfs || []);
    } catch (e) {
      setError(getAppErrorMessage(e, "Failed to load academic PDFs."));
    }
  }, [board, classNumber]);

  const load = useCallback(async (refresh = false) => {
    try {
      if (refresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      const [libraryRes, subjectsRes] = await Promise.allSettled([
        api.get<LibraryResponse>("/api/network/knowledge-library"),
        api.get<{ subjects: AcademicSubjectSummary[] }>(`/api/academics/${board}/class/${classNumber}/subjects`)
      ]);
      const library = libraryRes.status === "fulfilled" ? libraryRes.value.data || {} : {};
      setResources([...(library.institutionResources || []), ...(library.domainResources || [])]);

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
  }, [board, classNumber, loadSubject, selectedSubjectKey]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return (
    <>
    <HighSchoolCommunityShell
      eyebrow={`${board} • Class ${classNumber}`}
      title={resourceView === "teacher" ? "Teacher Resources" : "App Resources"}
      subtitle="Choose App Resources for ORIN textbook PDFs or Teacher Resources for Global Teacher uploads."
      stats={[
        { icon: "book", label: "Subjects", value: String(subjects.length) },
        { icon: "document-text", label: resourceView === "teacher" ? "Teacher PDFs" : "App PDFs", value: String(resourceView === "teacher" ? pdfResources.length : academicPdfs.length) }
      ]}
      loading={loading}
      error={error}
      refreshing={refreshing}
      onRefresh={() => load(true)}
    >
      <CommunitySection title="Resource Type" subtitle="This page has two resource libraries: app resources and teacher resources." icon="menu">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
          {[
            { key: "app" as const, label: "App Resources", count: academicPdfs.length },
            { key: "teacher" as const, label: "Teacher Resources", count: pdfResources.length }
          ].map((item) => {
            const active = resourceView === item.key;
            return (
              <TouchableOpacity
                key={item.key}
                style={[
                  styles.chip,
                  { borderColor: active ? "#16A34A" : colors.border, backgroundColor: active ? "#ECFDF3" : colors.surfaceAlt }
                ]}
                onPress={() => setResourceView(item.key)}
              >
                <Text style={[styles.chipText, { color: active ? "#15803D" : colors.textMuted }]}>{item.label} ({item.count})</Text>
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity style={[styles.chip, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }]} onPress={() => setDrawerVisible(true)}>
            <Text style={[styles.chipText, { color: colors.textMuted }]}>Open Drawer</Text>
          </TouchableOpacity>
        </ScrollView>
      </CommunitySection>

      {resourceView === "app" ? (
      <>
      <CommunitySection title="Academic PDF Browser" subtitle="Select a class and subject to show only connected textbook PDFs." icon="library">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
          {BOARD_OPTIONS.map((item) => {
            const active = item === board;
            return (
              <TouchableOpacity
                key={item}
                style={[
                  styles.chip,
                  { borderColor: active ? "#16A34A" : colors.border, backgroundColor: active ? "#ECFDF3" : colors.surfaceAlt }
                ]}
                onPress={() => {
                  setBoard(item);
                  setAcademicSubject(null);
                  setAcademicPdfs([]);
                }}
              >
                <Text style={[styles.chipText, { color: active ? "#15803D" : colors.textMuted }]}>{item}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
          {CLASS_OPTIONS.map((item) => {
            const active = item === classNumber;
            return (
              <TouchableOpacity
                key={item}
                style={[
                  styles.chip,
                  { borderColor: active ? "#16A34A" : colors.border, backgroundColor: active ? "#ECFDF3" : colors.surfaceAlt }
                ]}
                onPress={() => {
                  setClassNumber(item);
                  setAcademicSubject(null);
                  setAcademicPdfs([]);
                }}
              >
                <Text style={[styles.chipText, { color: active ? "#15803D" : colors.textMuted }]}>Class {item}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {subjects.length ? (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
              {subjects.map((subject) => {
                const active = subject.key === selectedSubjectKey;
                return (
                  <TouchableOpacity
                    key={subject.key}
                    style={[
                      styles.chip,
                      { borderColor: active ? "#16A34A" : colors.border, backgroundColor: active ? "#ECFDF3" : colors.surfaceAlt }
                    ]}
                    onPress={() => loadSubject(subject.key)}
                  >
                    <Text style={[styles.chipText, { color: active ? "#15803D" : colors.textMuted }]}>{subject.subject || subject.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <StatusBadge
              label={academicSubject?.available === false ? "PDF extraction pending" : selectedSubject?.subject || selectedSubject?.name || "Selected subject"}
              tone={academicSubject?.available === false ? "warning" : "success"}
            />
          </>
        ) : (
          <AcademicEmpty label="No academic subjects are connected for this class yet." />
        )}
      </CommunitySection>

      <CommunitySection title="Academic PDFs" subtitle="Textbook PDFs uploaded to Firebase Storage." icon="reader">
        {academicPdfs.length ? (
          academicPdfs.map((item) => (
            <AcademicCard
              key={item.id}
              icon="document-text-outline"
              title={item.title || item.fileName}
              meta={`${item.board} Class ${classNumber} - ${item.subject} - PDF`}
              note={item.fileName}
              badge="Real PDF"
              badgeTone="success"
              actionLabel="Open PDF"
              onPress={() => openPdfUrl(item.pdfUrl)}
            />
          ))
        ) : (
          <AcademicEmpty label="No PDFs found for this class and subject yet." />
        )}
      </CommunitySection>
      </>
      ) : null}

      {resourceView === "teacher" ? (
      <CommunitySection title="Teacher PDFs" subtitle="Only teacher resources with valid PDF URLs appear here." icon="document-text">
        {pdfResources.length ? (
          pdfResources.slice(0, 12).map((item) => (
            <AcademicCard
              key={item._id || item.id || item.title}
              icon="document-attach-outline"
              title={item.title}
              meta={`${item.domain || "School"} - ${item.type || "Resource"} - PDF`}
              note={item.description || `Uploaded by ${item.mentor?.name || "Mentor"}`}
              badge="PDF"
              badgeTone="success"
              actionLabel="Open PDF"
              onPress={() => openPdfUrl(firstPdfUrl(item))}
            />
          ))
        ) : (
          <AcademicEmpty label="No teacher PDF resources uploaded yet. Non-PDF links are hidden in this library." />
        )}
      </CommunitySection>
      ) : null}
    </HighSchoolCommunityShell>
    <HighSchoolSideDrawer
      visible={drawerVisible}
      title="Resources"
      subtitle="Choose app textbook PDFs or Global Teacher uploads"
      activeKey={resourceView === "teacher" ? "teacher-resources" : "app-resources"}
      items={drawerItems}
      onClose={() => setDrawerVisible(false)}
    />
    </>
  );
}

const styles = StyleSheet.create({
  row: { gap: 8, paddingBottom: 2 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 10 },
  chipText: { fontWeight: "900", fontSize: 13 }
});
