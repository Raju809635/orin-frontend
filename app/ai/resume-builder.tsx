import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Platform, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/lib/api";
import { notify } from "@/utils/notify";
import { saveAiItem } from "@/utils/aiSaves";
import { escapeHtml, markdownToPlainText } from "@/utils/textFormat";

type ResumeResponse = { markdown?: string; export?: { fileName?: string } };

export default function AiResumeBuilderPage() {
  const [data, setData] = useState<ResumeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    try {
      if (refresh) setRefreshing(true); else setLoading(true);
      setError(null);
      const res = await api.get<ResumeResponse>("/api/network/resume/generate");
      setData(res.data || null);
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to load resume builder.");
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const fileName = useMemo(() => {
    const raw = data?.export?.fileName || "orin_resume.md";
    const safe = raw.replace(/[^\w.\-]+/g, "_");
    return safe.toLowerCase().endsWith(".md") || safe.toLowerCase().endsWith(".txt") ? safe : `${safe}.md`;
  }, [data?.export?.fileName]);

  const plainText = useMemo(() => markdownToPlainText(data?.markdown || ""), [data?.markdown]);

  const download = useCallback(async () => {
    if (!data?.markdown) {
      notify("Generate resume first.");
      return;
    }

    let FileSystem: any;
    let Sharing: any;
    try {
      FileSystem = await import("expo-file-system");
      Sharing = await import("expo-sharing");
    } catch {
      Alert.alert("Update required", "Resume download requires latest app build. Please install updated APK.");
      return;
    }

    if (!FileSystem?.writeAsStringAsync || !FileSystem?.cacheDirectory) {
      notify("File system is not available on this device.");
      return;
    }

    const targetPath = `${FileSystem.cacheDirectory}${fileName}`;
    await FileSystem.writeAsStringAsync(targetPath, plainText, {
      encoding: FileSystem.EncodingType.UTF8
    });

    if (Sharing?.isAvailableAsync) {
      const available = await Sharing.isAvailableAsync();
      if (available && Sharing.shareAsync) {
        await Sharing.shareAsync(targetPath, {
          dialogTitle: "Share resume file",
          mimeType: "text/plain"
        });
        return;
      }
    }

    notify(`Saved to cache: ${fileName}`);
  }, [data?.markdown, fileName, plainText]);

  const downloadPdf = useCallback(async () => {
    if (!plainText) {
      notify("Generate resume first.");
      return;
    }

    // Web: download a real PDF file (no print dialog).
    if (Platform.OS === "web") {
      try {
        const res = await api.get("/api/network/resume/pdf", {
          responseType: "blob",
          timeout: 30000
        } as any);

        const blob: Blob = (res as any).data;
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "orin_resume.pdf";
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
        return;
      } catch (e: any) {
        notify(e?.response?.data?.message || "Failed to download PDF.");
        return;
      }
    }

    let Print: any;
    let Sharing: any;
    try {
      Print = await import("expo-print");
      Sharing = await import("expo-sharing");
    } catch {
      Alert.alert("Update required", "PDF export requires latest app build. Please install updated APK.");
      return;
    }

    if (!Print?.printToFileAsync) {
      notify("PDF export is not available on this device.");
      return;
    }

    const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body { font-family: Arial, sans-serif; padding: 24px; color: #111827; }
    h1 { font-size: 20px; margin: 0 0 12px 0; }
    .meta { color: #6B7280; font-size: 12px; margin-bottom: 16px; }
    pre { white-space: pre-wrap; font-size: 12px; line-height: 1.5; }
  </style>
</head>
<body>
  <h1>ORIN Resume</h1>
  <div class="meta">Generated from your ORIN profile</div>
  <pre>${escapeHtml(plainText)}</pre>
</body>
</html>`;

    const result = await Print.printToFileAsync({ html });
    const uri = result?.uri;
    if (!uri) {
      notify("Failed to generate PDF.");
      return;
    }

    if (Sharing?.isAvailableAsync) {
      const available = await Sharing.isAvailableAsync();
      if (available && Sharing.shareAsync) {
        await Sharing.shareAsync(uri, { dialogTitle: "Share resume PDF", mimeType: "application/pdf" });
        return;
      }
    }
    notify("PDF created.");
  }, [plainText]);

  const save = useCallback(async () => {
    if (!plainText) {
      notify("Generate resume first.");
      return;
    }
    await saveAiItem({
      type: "resume",
      title: "AI Resume (text)",
      payload: { text: plainText }
    });
    notify("Saved to Saved AI.");
  }, [plainText]);

  return (
    <ScrollView contentContainerStyle={styles.page} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}>
      <Text style={styles.pageTitle}>AI Resume Builder</Text>
      <Text style={styles.pageSub}>Generate and preview resume content from your ORIN profile data.</Text>

      <View style={styles.section}><View style={styles.sectionHeader}><Ionicons name="document-text" size={16} color="#1F7A4C" /><Text style={styles.sectionTitle}>Overview</Text></View><Text style={styles.meta}>The builder compiles skills, projects, and achievements into resume format.</Text></View>

      <View style={styles.section}><View style={styles.sectionHeader}><Ionicons name="person" size={16} color="#1F7A4C" /><Text style={styles.sectionTitle}>Main Feature</Text></View><Text style={styles.meta}>Profile Data: fetched from your account</Text><Text style={styles.meta}>Skills: auto-collected</Text><Text style={styles.meta}>Projects: auto-collected</Text><TouchableOpacity style={styles.primaryBtn} onPress={() => load(true)}><Text style={styles.primaryBtnText}>Generate Resume</Text></TouchableOpacity></View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}><Ionicons name="eye" size={16} color="#1F7A4C" /><Text style={styles.sectionTitle}>Resume Preview</Text></View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {loading ? <ActivityIndicator size="large" color="#1F7A4C" /> : null}
        {!loading && !data?.markdown ? <Text style={styles.meta}>Resume preview unavailable.</Text> : null}
        {plainText ? <View style={styles.previewCard}><Text style={styles.meta}>{plainText}</Text></View> : null}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="download" size={16} color="#1F7A4C" />
          <Text style={styles.sectionTitle}>Actions</Text>
        </View>
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.primaryBtn} onPress={downloadPdf}>
            <Text style={styles.primaryBtnText}>Download PDF</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryBtn} onPress={download}>
            <Text style={styles.secondaryBtnText}>Download Text</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryBtn} onPress={save}>
            <Text style={styles.secondaryBtnText}>Save</Text>
          </TouchableOpacity>
        </View>
      </View>
      <View style={styles.section}><View style={styles.sectionHeader}><Ionicons name="help-circle" size={16} color="#1F7A4C" /><Text style={styles.sectionTitle}>Tips</Text></View><Text style={styles.meta}>Keep projects quantified with outcomes for stronger resume impact.</Text></View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, backgroundColor: "#F3F6FB", gap: 10 },
  pageTitle: { fontSize: 26, fontWeight: "800", color: "#11261E" },
  pageSub: { color: "#667085" },
  section: { backgroundColor: "#FFFFFF", borderRadius: 14, borderWidth: 1, borderColor: "#E4E7EC", padding: 12, gap: 8 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  sectionTitle: { fontWeight: "800", color: "#1E2B24" },
  previewCard: { backgroundColor: "#FEF3F2", borderColor: "#F7C1BB", borderWidth: 1, borderRadius: 12, padding: 10 },
  meta: { color: "#667085", lineHeight: 20 },
  error: { color: "#B42318" },
  primaryBtn: { alignSelf: "flex-start", backgroundColor: "#1F7A4C", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9 },
  primaryBtnText: { color: "#fff", fontWeight: "700" },
  actionRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, alignItems: "center" },
  secondaryBtn: { borderWidth: 1, borderColor: "#1F7A4C", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9 },
  secondaryBtnText: { color: "#1F7A4C", fontWeight: "800" }
});
