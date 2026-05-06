import React, { useCallback, useState } from "react";
import { Alert, StyleSheet, Text, TextInput, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { api } from "@/lib/api";
import { getAppErrorMessage, handleAppError } from "@/lib/appError";
import { useAppTheme } from "@/context/ThemeContext";
import {
  AcademicCard,
  AcademicEmpty,
  ActionButton,
  CommunitySection,
  HighSchoolCommunityShell,
  StatusBadge
} from "@/components/community/highschool-ui";

type ChallengeItem = {
  _id?: string;
  id?: string;
  title: string;
  domain?: string;
  description?: string;
  participantsCount?: number;
  xpReward?: number;
  deadline?: string;
  mentor?: { name?: string } | null;
  joined?: boolean;
  isActive?: boolean;
  submissionStatus?: "not_submitted" | "submitted" | "reviewed" | "accepted" | "rejected";
  proofInstructions?: string;
};
type AcademicSubjectSummary = { key: string; subject: string; chapterCount?: number };

function challengeId(item: ChallengeItem) {
  return String(item._id || item.id || "");
}

export default function HighSchoolSchoolChallengesScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const [items, setItems] = useState<ChallengeItem[]>([]);
  const [subjects, setSubjects] = useState<AcademicSubjectSummary[]>([]);
  const [selected, setSelected] = useState<ChallengeItem | null>(null);
  const [proofNote, setProofNote] = useState("");
  const [proofLinks, setProofLinks] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    try {
      if (refresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      const [challengeRes, subjectRes] = await Promise.allSettled([
        api.get<ChallengeItem[]>("/api/network/challenges"),
        api.get<{ subjects: AcademicSubjectSummary[] }>("/api/academics/CBSE/class/10/subjects")
      ]);
      setItems((challengeRes.status === "fulfilled" ? challengeRes.value.data || [] : []).filter((item) => item.isActive !== false));
      setSubjects(subjectRes.status === "fulfilled" ? subjectRes.value.data?.subjects || [] : []);
    } catch (e) {
      setError(getAppErrorMessage(e, "Failed to load school challenges."));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function joinChallenge(item: ChallengeItem) {
    const id = challengeId(item);
    if (!id) return;
    try {
      setBusyId(id);
      await api.post(`/api/network/challenges/${id}/join`, {});
      await load(true);
      setSelected((prev) => (prev && challengeId(prev) === id ? { ...prev, joined: true } : prev));
    } catch (e) {
      handleAppError(e, { mode: "alert", title: "School Challenges", fallbackMessage: "Unable to join this challenge." });
    } finally {
      setBusyId(null);
    }
  }

  async function submitProof() {
    if (!selected) return;
    const id = challengeId(selected);
    if (!proofNote.trim() && !proofLinks.trim()) {
      Alert.alert("Proof required", "Add a short note or proof link before submitting.");
      return;
    }
    try {
      setBusyId(id);
      const links = proofLinks.split(/\n|,/).map((item) => item.trim()).filter(Boolean);
      await api.post(`/api/network/challenges/${id}/submissions`, { proofNote: proofNote.trim(), proofLinks: links, proofFiles: [] });
      setProofNote("");
      setProofLinks("");
      await load(true);
      setSelected((prev) => (prev ? { ...prev, submissionStatus: "submitted" } : prev));
      Alert.alert("Submitted", "Your challenge proof was sent for mentor review.");
    } catch (e) {
      handleAppError(e, { mode: "alert", title: "School Challenges", fallbackMessage: "Unable to submit proof." });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <HighSchoolCommunityShell
      title="School Challenges"
      subtitle="Real challenge data only. Quiz Battle is a separate live room, while school challenges keep join, proof, XP and mentor review."
      stats={[
        { icon: "trophy", label: "Active", value: String(items.length) },
        { icon: "book", label: "Subjects", value: String(subjects.length) },
        { icon: "flash", label: "Battle", value: "Live" }
      ]}
      loading={loading}
      error={error}
      refreshing={refreshing}
      onRefresh={() => load(true)}
    >
      <CommunitySection title="Quiz Battle" subtitle="Dedicated live quiz rooms. This never opens the challenge board by mistake." icon="flash">
        <AcademicCard
          icon="game-controller"
          title="Live Quiz Battle Rooms"
          meta="Create room · Join code · Fastest correct answer scores"
          note="Use this for real-time academic games with classmates."
          badge="Live"
          badgeTone="success"
          actionLabel="Open Quiz Battle"
          onPress={() => router.push("/community/highschool-quiz-battle" as never)}
        />
      </CommunitySection>

      <CommunitySection title="Subject Practice Entry" subtitle="Subject/topic quiz drives the gap analyzer." icon="fitness">
        {subjects.length ? (
          subjects.slice(0, 6).map((subject) => (
            <AcademicCard
              key={subject.key}
              icon="book-outline"
              title={subject.subject}
              meta={`${subject.chapterCount || 0} chapters · CBSE Class 10 demo`}
              note="Start with quiz, then ORIN calculates weak topics from your real answers."
              badge="Practice"
              actionLabel="Start Quiz"
              onPress={() => router.push(`/ai/highschool-subject-gap?subject=${encodeURIComponent(subject.subject)}` as never)}
            />
          ))
        ) : (
          <AcademicEmpty label="Academic subjects are not connected yet." />
        )}
      </CommunitySection>

      <CommunitySection title="Challenge Board" subtitle="Challenges only. Programs and opportunities are not mixed into this page." icon="trophy">
        {items.length ? (
          items.slice(0, 12).map((item) => {
            const id = challengeId(item);
            const joined = Boolean(item.joined);
            return (
              <AcademicCard
                key={id || item.title}
                icon="flag-outline"
                title={item.title}
                meta={`${item.domain || "Academic"} · ${item.participantsCount || 0} joined · ${item.xpReward || 0} XP`}
                note={item.description || `Mentor: ${item.mentor?.name || "Guide"}${item.deadline ? ` · Deadline ${new Date(item.deadline).toLocaleDateString("en-IN")}` : ""}`}
                badge={item.submissionStatus && item.submissionStatus !== "not_submitted" ? item.submissionStatus : joined ? "Joined" : "Open"}
                badgeTone={item.submissionStatus === "accepted" ? "success" : joined ? "primary" : "neutral"}
                actionLabel={joined ? "Submit Proof" : "Join Challenge"}
                secondaryLabel="Details"
                onPress={() => (joined ? setSelected(item) : joinChallenge(item))}
                onSecondaryPress={() => setSelected(item)}
                progress={item.participantsCount ? Math.min(100, item.participantsCount * 5) : undefined}
              />
            );
          })
        ) : (
          <AcademicEmpty label="No school challenges are active right now." />
        )}
      </CommunitySection>

      {selected ? (
        <CommunitySection title="Challenge Detail" subtitle="Submit proof to the mentor who owns this challenge." icon="reader">
          <View style={styles.detailHead}>
            <Text style={[styles.detailTitle, { color: colors.text }]}>{selected.title}</Text>
            <StatusBadge label={selected.joined ? "Joined" : "Not joined"} tone={selected.joined ? "success" : "neutral"} />
          </View>
          <Text style={[styles.detailText, { color: colors.textMuted }]}>{selected.proofInstructions || selected.description || "Complete the challenge and submit a short proof note or link."}</Text>
          {!selected.joined ? (
            <ActionButton label={busyId === challengeId(selected) ? "Joining..." : "Join Challenge"} icon="add-circle-outline" disabled={busyId === challengeId(selected)} onPress={() => joinChallenge(selected)} />
          ) : (
            <>
              <TextInput
                style={[styles.input, { borderColor: colors.border, backgroundColor: colors.surfaceAlt, color: colors.text }]}
                placeholder="Proof note: what you completed, learned, or built"
                placeholderTextColor={colors.textMuted}
                value={proofNote}
                onChangeText={setProofNote}
                multiline
              />
              <TextInput
                style={[styles.input, { borderColor: colors.border, backgroundColor: colors.surfaceAlt, color: colors.text }]}
                placeholder="Proof links, separated by comma or new line"
                placeholderTextColor={colors.textMuted}
                value={proofLinks}
                onChangeText={setProofLinks}
                multiline
              />
              <ActionButton label={busyId === challengeId(selected) ? "Submitting..." : "Submit Proof"} icon="cloud-upload-outline" disabled={busyId === challengeId(selected)} onPress={submitProof} />
            </>
          )}
        </CommunitySection>
      ) : null}
    </HighSchoolCommunityShell>
  );
}

const styles = StyleSheet.create({
  detailHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  detailTitle: { flex: 1, fontSize: 20, fontWeight: "900" },
  detailText: { lineHeight: 21, fontWeight: "700" },
  input: { minHeight: 74, borderWidth: 1, borderRadius: 14, padding: 12, fontWeight: "700", textAlignVertical: "top" }
});
