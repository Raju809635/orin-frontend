import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useFocusEffect } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { api } from "@/lib/api";
import { getAppErrorMessage, handleAppError } from "@/lib/appError";
import { useAppTheme } from "@/context/ThemeContext";

type ActivityWeek = {
  id: string;
  title: string;
  description?: string;
  tasks?: string[];
  xpReward?: number;
  submission?: {
    id: string;
    status: "submitted" | "accepted" | "rejected";
    mentorReview?: {
      notes?: string;
      xpAwarded?: number;
      certificateId?: string | null;
    };
  } | null;
};

type Roadmap = {
  id: string;
  title: string;
  description?: string;
  className?: string;
  mentor?: { name?: string };
  weeks: ActivityWeek[];
};

export default function KidsLearningActivitiesScreen() {
  const { colors } = useAppTheme();
  const [roadmaps, setRoadmaps] = useState<Roadmap[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [proofTextByKey, setProofTextByKey] = useState<Record<string, string>>({});
  const [proofLinkByKey, setProofLinkByKey] = useState<Record<string, string>>({});
  const [proofImageByKey, setProofImageByKey] = useState<Record<string, string>>({});
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [submittingKey, setSubmittingKey] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    try {
      if (!refresh) setLoading(true);
      setError(null);
      const { data } = await api.get<{ roadmaps: Roadmap[] }>("/api/network/institution-roadmaps");
      setRoadmaps(data?.roadmaps || []);
    } catch (e) {
      setError(getAppErrorMessage(e, "Unable to load today's activities."));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const todayActivities = useMemo(
    () => roadmaps.flatMap((roadmap) => roadmap.weeks.map((week, index) => ({ roadmap, week, index }))).slice(0, 4),
    [roadmaps]
  );

  async function uploadProof(key: string) {
    try {
      setUploadingKey(key);
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) return;
      const picked = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8
      });
      if (picked.canceled || !picked.assets?.[0]?.uri) return;
      const asset = picked.assets[0];
      const formData = new FormData();
      formData.append("file", {
        uri: asset.uri,
        name: asset.fileName || `kid-activity-${Date.now()}.jpg`,
        type: asset.mimeType || "image/jpeg"
      } as any);
      formData.append("folder", "student-proofs");
      const { data } = await api.post<{ url?: string }>("/api/uploads/image", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      if (data?.url) {
        setProofImageByKey((prev) => ({ ...prev, [key]: data.url }));
      }
    } catch (e) {
      handleAppError(e, { fallbackMessage: "Unable to upload activity proof right now." });
    } finally {
      setUploadingKey(null);
    }
  }

  async function submitProof(roadmapId: string, weekId: string, key: string) {
    try {
      setSubmittingKey(key);
      await api.post(`/api/network/institution-roadmaps/${encodeURIComponent(roadmapId)}/weeks/${encodeURIComponent(weekId)}/submissions`, {
        proofText: proofTextByKey[key] || "",
        proofLink: proofLinkByKey[key] || "",
        proofImageUrl: proofImageByKey[key] || ""
      });
      await load(true);
    } catch (e) {
      handleAppError(e, { fallbackMessage: "Unable to submit activity proof right now." });
    } finally {
      setSubmittingKey(null);
    }
  }

  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.text }]}>Today&apos;s Activity</Text>
      <Text style={[styles.subtitle, { color: colors.textMuted }]}>
        Open one activity, do it, submit a small proof, and collect stars from your teacher.
      </Text>
      {loading ? <ActivityIndicator color={colors.accent} style={{ marginVertical: 16 }} /> : null}
      {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}

      {todayActivities.map(({ roadmap, week, index }) => {
        const key = `${roadmap.id}::${week.id}`;
        return (
          <View key={key} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.badge, { color: colors.accent }]}>Activity {index + 1}</Text>
            <Text style={[styles.cardTitle, { color: colors.text }]}>{week.title}</Text>
            <Text style={[styles.cardMeta, { color: colors.textMuted }]}>
              {roadmap.title} {roadmap.mentor?.name ? `· Teacher ${roadmap.mentor.name}` : ""} {roadmap.className ? `· Class ${roadmap.className}` : ""}
            </Text>
            {week.description ? <Text style={[styles.cardBody, { color: colors.textMuted }]}>{week.description}</Text> : null}
            {(week.tasks || []).length ? (
              <View style={styles.taskWrap}>
                {(week.tasks || []).slice(0, 3).map((task) => (
                  <Text key={task} style={[styles.taskText, { color: colors.text }]}>• {task}</Text>
                ))}
              </View>
            ) : null}
            <TextInput
              style={[styles.input, { backgroundColor: colors.surfaceAlt, borderColor: colors.border, color: colors.text }]}
              placeholder="Tell your teacher what you did"
              placeholderTextColor={colors.textMuted}
              value={proofTextByKey[key] || ""}
              onChangeText={(value) => setProofTextByKey((prev) => ({ ...prev, [key]: value }))}
            />
            <TextInput
              style={[styles.input, { backgroundColor: colors.surfaceAlt, borderColor: colors.border, color: colors.text }]}
              placeholder="Optional proof link"
              placeholderTextColor={colors.textMuted}
              value={proofLinkByKey[key] || ""}
              onChangeText={(value) => setProofLinkByKey((prev) => ({ ...prev, [key]: value }))}
            />
            <View style={styles.actionRow}>
              <TouchableOpacity style={[styles.secondaryBtn, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]} onPress={() => uploadProof(key)}>
                <Text style={[styles.secondaryText, { color: colors.text }]}>{uploadingKey === key ? "Uploading..." : "Upload Image"}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: colors.accent }]} onPress={() => submitProof(roadmap.id, week.id, key)}>
                <Text style={[styles.primaryText, { color: colors.accentText }]}>{submittingKey === key ? "Submitting..." : "Submit"}</Text>
              </TouchableOpacity>
            </View>
            {proofImageByKey[key] ? <Text style={[styles.cardMeta, { color: colors.textMuted }]}>Image added for this activity.</Text> : null}
            {week.submission ? (
              <View style={[styles.reviewCard, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
                <Text style={[styles.reviewTitle, { color: colors.text }]}>Teacher Review</Text>
                <Text style={[styles.cardMeta, { color: colors.textMuted }]}>Status: {week.submission.status}</Text>
                {week.submission.mentorReview?.xpAwarded ? <Text style={[styles.cardMeta, { color: colors.textMuted }]}>Stars earned: {week.submission.mentorReview.xpAwarded}</Text> : null}
                {week.submission.mentorReview?.notes ? <Text style={[styles.cardMeta, { color: colors.textMuted }]}>Note: {week.submission.mentorReview.notes}</Text> : null}
              </View>
            ) : null}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 20, paddingBottom: 120, gap: 14 },
  title: { fontSize: 30, fontWeight: "900", marginBottom: 6 },
  subtitle: { fontSize: 15, lineHeight: 22 },
  error: { fontWeight: "700" },
  card: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 10 },
  badge: { fontWeight: "900" },
  cardTitle: { fontSize: 20, fontWeight: "900" },
  cardMeta: { fontSize: 13, lineHeight: 19 },
  cardBody: { lineHeight: 21 },
  taskWrap: { gap: 6 },
  taskText: { fontWeight: "700", lineHeight: 20 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  actionRow: { flexDirection: "row", gap: 10 },
  secondaryBtn: { flex: 1, minHeight: 44, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  primaryBtn: { flex: 1, minHeight: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  secondaryText: { fontWeight: "800" },
  primaryText: { fontWeight: "900" },
  reviewCard: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 4 },
  reviewTitle: { fontWeight: "900" }
});
