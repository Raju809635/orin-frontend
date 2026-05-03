import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/lib/api";
import { getAppErrorMessage, handleAppError } from "@/lib/appError";
import { pickAndUploadPostImage } from "@/utils/postMediaUpload";
import { useAuth } from "@/context/AuthContext";
import { useAppTheme } from "@/context/ThemeContext";
import {
  ActionButton,
  CommunityHero,
  CommunitySection,
  ProgressBar,
  StatPill,
  StatusBadge
} from "@/components/community/ui";
import ClassSectionSelector from "@/components/ClassSectionSelector";

type ChallengeItem = {
  id: string;
  title: string;
  domain?: string;
  mentor?: { id?: string | null; name?: string } | null;
  scope?: "global" | "institution" | "class";
  className?: string;
  description?: string;
  bannerImageUrl?: string;
  proofInstructions?: string;
  participantLimit?: number;
  submissionStatus?: "not_submitted" | "submitted" | "reviewed" | "accepted" | "rejected";
  awardedRank?: number;
  awardedXp?: number;
  participantsCount?: number;
  deadline: string;
  isActive?: boolean;
  approvalStatus?: "approved" | "pending" | "rejected";
  recommended?: boolean;
  recommendationReason?: string;
  challengeState?: string;
  xpHint?: number;
};
type LeaderboardResponse = { globalTop?: { rank: number; name: string; score: number }[] };

const STORAGE_KEY = "community-challenge-progress-v1";
const DEFAULT_TASKS = [
  { id: "upload-project", label: "Upload project", xp: 30 },
  { id: "submit-link", label: "Submit link", xp: 20 }
];

export default function CommunityChallengesPage() {
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const proofLinksInputRef = useRef<TextInput | null>(null);
  const [items, setItems] = useState<ChallengeItem[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardResponse | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [progressMap, setProgressMap] = useState<Record<string, Record<string, boolean>>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitForm, setSubmitForm] = useState({
    title: "",
    domain: "",
    className: "",
    scope: "institution" as "global" | "institution" | "class",
    description: "",
    deadline: "",
    bannerImageUrl: "",
    participantLimit: "",
    proofInstructions: ""
  });
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [joining, setJoining] = useState(false);
  const [proofNote, setProofNote] = useState("");
  const [proofLinks, setProofLinks] = useState("");
  const [proofFiles, setProofFiles] = useState<string[]>([]);
  const [uploadingProofFile, setUploadingProofFile] = useState(false);
  const [submittingProof, setSubmittingProof] = useState(false);

  const load = useCallback(async (refresh = false) => {
    try {
      if (refresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      const [chRes, lbRes] = await Promise.allSettled([
        api.get<ChallengeItem[]>("/api/network/challenges"),
        api.get<LeaderboardResponse>("/api/network/leaderboard")
      ]);
      const nextItems = chRes.status === "fulfilled" ? chRes.value.data || [] : [];
      setItems(nextItems);
      setSelectedId((prev) => prev || nextItems[0]?.id || "");
      setLeaderboard(lbRes.status === "fulfilled" ? lbRes.value.data || null : null);
    } catch (e: any) {
      setError(getAppErrorMessage(e, "Failed to load challenges."));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((value) => {
        if (value) setProgressMap(JSON.parse(value));
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(progressMap)).catch(() => undefined);
  }, [progressMap]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const activeChallenges = items.filter((item) => item.isActive !== false);
  const mentorChallenges = useMemo(
    () => items.filter((item) => String(item.mentor?.id || "") === String(user?.id || "")),
    [items, user?.id]
  );
  const selected = items.find((item) => item.id === selectedId) || activeChallenges[0] || items[0] || null;
  const selectedTasks = selected ? progressMap[selected.id] || {} : {};
  const completedTasks = DEFAULT_TASKS.filter((task) => selectedTasks[task.id]).length;
  const completion = selected ? Math.round((completedTasks / DEFAULT_TASKS.length) * 100) : 0;
  const topChallenge = activeChallenges[0];
  const topNames = (leaderboard?.globalTop || []).slice(0, 3).map((entry) => entry.name);

  function setSelectedTaskProgress(taskId: string, done: boolean) {
    if (!selected?.id) return;
    setProgressMap((prev) => ({
      ...prev,
      [selected.id]: {
        ...(prev[selected.id] || {}),
        [taskId]: done
      }
    }));
  }

  async function participate() {
    if (!selected?.id || user?.role !== "student" || !/^[a-fA-F0-9]{24}$/.test(String(selected.id || ""))) return;
    try {
      setJoining(true);
      await api.post(`/api/network/challenges/${selected.id}/join`, {});
      Alert.alert("Joined", "You are now in the challenge. Complete the tasks below to keep momentum.");
      await load(true);
    } catch (e: any) {
      handleAppError(e, { mode: "alert", title: "Failed", fallbackMessage: "Unable to join challenge." });
    } finally {
      setJoining(false);
    }
  }

  async function submitProof() {
    if (!selected?.id || user?.role !== "student" || !/^[a-fA-F0-9]{24}$/.test(String(selected.id || ""))) return;
    if (!proofNote.trim() && !proofLinks.trim() && !proofFiles.length) {
      Alert.alert("Proof required", "Add a short note, link, or upload a proof file.");
      return;
    }
    try {
      setSubmittingProof(true);
      const links = proofLinks
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
      await api.post(`/api/network/challenges/${selected.id}/submissions`, {
        proofNote: proofNote.trim(),
        proofLinks: links,
        proofFiles
      });
      setSelectedTaskProgress("upload-project", proofFiles.length > 0);
      setSelectedTaskProgress("submit-link", links.length > 0);
      setProofNote("");
      setProofLinks("");
      setProofFiles([]);
      Alert.alert("Submitted", "Your proof has been submitted for mentor review.");
      await load(true);
    } catch (e: any) {
      handleAppError(e, { mode: "alert", title: "Failed", fallbackMessage: "Unable to submit proof." });
    } finally {
      setSubmittingProof(false);
    }
  }

  async function uploadBanner() {
    try {
      setUploadingBanner(true);
      const url = await pickAndUploadPostImage();
      if (!url) return;
      setSubmitForm((prev) => ({ ...prev, bannerImageUrl: url }));
    } catch (e: any) {
      handleAppError(e, { mode: "alert", title: "Upload failed", fallbackMessage: "Unable to upload banner." });
    } finally {
      setUploadingBanner(false);
    }
  }

  async function uploadProofFile() {
    try {
      setUploadingProofFile(true);
      const url = await pickAndUploadPostImage();
      if (!url) return;
      setProofFiles((prev) => {
        const next = [...prev, url].slice(0, 4);
        setSelectedTaskProgress("upload-project", next.length > 0);
        return next;
      });
    } catch (e: any) {
      handleAppError(e, { mode: "alert", title: "Upload failed", fallbackMessage: "Unable to upload proof image." });
    } finally {
      setUploadingProofFile(false);
    }
  }

  async function handleTaskAction(taskId: string) {
    if (user?.role !== "student") {
      Alert.alert("Student proof only", "Proof uploads are available only for students in the challenge flow.");
      return;
    }
    if (taskId === "upload-project") {
      await uploadProofFile();
      return;
    }
    if (taskId === "submit-link") {
      requestAnimationFrame(() => {
        proofLinksInputRef.current?.focus();
      });
    }
  }


  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[styles.page, { backgroundColor: colors.background }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
    >
      <CommunityHero
        eyebrow="Challenges"
        title="🔥 Active Challenges"
        subtitle="Make challenges competitive, urgent, and easy to act on. The goal is to move users from reading to joining."
        stats={[
          { icon: "flame", label: "Live Now", value: String(activeChallenges.length) },
          { icon: "people", label: "Participants", value: String(activeChallenges.reduce((sum, item) => sum + (item.participantsCount || 0), 0)) },
          { icon: "trophy", label: "Top 3", value: topNames.length ? topNames.join(", ") : "Open" }
        ]}
        colors={["#F97316", "#FB7185", "#EF4444"]}
      />

      <CommunitySection
        title="Challenge Spotlight"
        subtitle="Urgency, participants, and visible reward cues make this section feel alive."
        icon="flash"
      >
        {topChallenge ? (
          <View style={styles.heroChallengeCard}>
            <View style={styles.challengeHead}>
              <View style={styles.challengeIconWrap}>
                <Ionicons name="trophy" size={24} color="#FFFFFF" />
              </View>
              <View style={styles.challengeHeadBody}>
                <Text style={styles.challengeTitle}>{topChallenge.title}</Text>
                <Text style={styles.challengeMeta}>{topChallenge.domain || "General"} • {formatTimeLeft(topChallenge.deadline)}</Text>
              </View>
            </View>
            <View style={styles.tagRow}>
              <StatusBadge label="Trending" tone="warning" />
              <StatusBadge label={`${topChallenge.participantsCount || 0} participants`} tone="primary" />
              <StatusBadge label={`+${topChallenge.xpHint || 50} XP`} tone="success" />
            </View>
            <Text style={styles.challengeDescription}>
              {topChallenge.description || "A guided challenge designed to push project execution, submissions, and visible profile growth."}
            </Text>
            {topChallenge.recommendationReason ? <Text style={styles.reasonText}>{topChallenge.recommendationReason}</Text> : null}
            <ActionButton label="Join Challenge" icon="rocket" onPress={() => setSelectedId(topChallenge.id)} />
          </View>
        ) : (
          <Text style={styles.emptyText}>No active challenge yet.</Text>
        )}
      </CommunitySection>

      <CommunitySection
        title="Available Challenges"
        subtitle="Every card shows urgency, participation, and a clear join action."
        icon="grid"
      >
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {loading ? <ActivityIndicator size="large" color="#1F7A4C" /> : null}
        {!loading && !items.length ? <Text style={styles.emptyText}>No challenges published yet.</Text> : null}
        {items.map((item, index) => (
          <TouchableOpacity
            key={item.id}
            activeOpacity={0.95}
            style={[styles.challengeCard, selectedId === item.id && styles.challengeCardActive]}
            onPress={() => setSelectedId(item.id)}
          >
            <View style={styles.challengeCardTop}>
              <View style={styles.challengeLabelWrap}>
                <Ionicons name={index === 0 ? "flame" : "extension-puzzle"} size={18} color="#F97316" />
              </View>
              <View style={styles.challengeCardBody}>
                <View style={styles.inlineRow}>
                  <Text style={styles.cardTitle}>{item.title}</Text>
                  {index === 0 ? <StatusBadge label="Trending" tone="warning" /> : null}
                  {item.recommended ? <StatusBadge label="For You" tone="primary" /> : null}
                </View>
                <Text style={styles.cardMeta}>{item.domain || "General"} • {formatTimeLeft(item.deadline)}</Text>
                {item.mentor?.name ? <Text style={styles.cardMeta}>By {item.mentor.name}</Text> : null}
              </View>
            </View>
            <Text numberOfLines={2} style={styles.challengeDescription}>
              {item.description || "A competitive ORIN challenge built to drive action, visibility, and measurable progress."}
            </Text>
            {item.recommendationReason ? <Text style={styles.reasonText}>{item.recommendationReason}</Text> : null}
            <View style={styles.pillRow}>
              <StatPill icon="people" label={`${item.participantsCount || 0} joined`} tone="#FFF7ED" />
              <StatPill icon="flash" label={`+${item.xpHint || 50} XP reward`} tone="#ECFDF3" />
              {item.challengeState ? <StatPill icon="trail-sign" label={item.challengeState} tone="#EEF2FF" /> : null}
              {user?.role === "mentor" && item.approvalStatus && item.approvalStatus !== "approved" ? (
                <StatusBadge label={`Status: ${item.approvalStatus}`} tone="warning" />
              ) : null}
            </View>
            <ProgressBar progress={Math.max(12, Math.min(100, daysRemaining(item.deadline) * 10))} tone="#F97316" />
            <ActionButton label="Join Challenge" icon="arrow-forward" onPress={() => setSelectedId(item.id)} />
          </TouchableOpacity>
        ))}
      </CommunitySection>

      {selected ? (
        <CommunitySection
          title="Challenge Detail"
          subtitle="A progress-based task flow makes this feel like a mission instead of a simple description."
          icon="checkmark-done-circle"
        >
          <View style={styles.detailCard}>
            <View style={styles.inlineRow}>
              <View style={styles.challengeLabelWrap}>
                <Ionicons name="rocket" size={20} color="#F97316" />
              </View>
              <View style={styles.detailHead}>
                <Text style={styles.detailTitle}>{selected.title}</Text>
                <Text style={styles.cardMeta}>{selected.domain || "General"} • {formatTimeLeft(selected.deadline)}</Text>
                {selected.mentor?.name ? <Text style={styles.cardMeta}>By {selected.mentor.name}</Text> : null}
              </View>
            </View>
            {selected.bannerImageUrl ? (
              <Image source={{ uri: selected.bannerImageUrl }} style={styles.detailBanner} />
            ) : null}
            <Text style={styles.challengeDescription}>
              {selected.description || "Complete the steps below to turn this challenge into a visible proof of work and XP gain."}
            </Text>
            {selected.recommendationReason ? <Text style={styles.reasonText}>{selected.recommendationReason}</Text> : null}

            {selected.proofInstructions ? (
              <View style={styles.detailPanel}>
                <Text style={styles.requirementTitle}>Proof Instructions</Text>
                <Text style={styles.challengeDescription}>{selected.proofInstructions}</Text>
              </View>
            ) : null}

            <View style={styles.detailPanel}>
              <View style={styles.inlineBetween}>
                <Text style={styles.requirementTitle}>Progress</Text>
                <Text style={styles.progressValue}>{completion}%</Text>
              </View>
              <ProgressBar progress={completion} tone="#F97316" />
              <View style={styles.pillRow}>
                <StatPill icon="flame" label={`Streak +${completedTasks}`} tone="#FFF7ED" />
                <StatPill icon="trophy" label={`${completedTasks * 25} XP momentum`} tone="#ECFDF3" />
              </View>
            </View>

            <View style={styles.taskList}>
              {DEFAULT_TASKS.map((task) => {
                const done = !!selectedTasks[task.id];
                return (
                  <TouchableOpacity
                    key={`${selected.id}-${task.id}`}
                    style={[styles.taskItem, done && styles.taskItemDone]}
                    activeOpacity={0.92}
                    onPress={() => !done && handleTaskAction(task.id)}
                  >
                    <View style={[styles.taskCheckbox, done && styles.taskCheckboxDone]}>
                      {done ? <Ionicons name="checkmark" size={16} color="#FFFFFF" /> : null}
                    </View>
                    <View style={styles.taskBody}>
                      <Text style={[styles.taskTitle, done && styles.taskTitleDone]}>{task.label}</Text>
                      <Text style={styles.taskMeta}>Complete this step to push the challenge forward.</Text>
                    </View>
                    <Text style={styles.taskXp}>+{task.xp} XP</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {user?.role === "student" ? (
              <View style={styles.detailActionStack}>
                <ActionButton
                  label={joining ? "Joining..." : "Join Challenge"}
                  icon="rocket"
                  onPress={participate}
                  disabled={joining || !/^[a-fA-F0-9]{24}$/.test(String(selected.id || ""))}
                />
                <View style={styles.proofCard}>
                  <Text style={styles.requirementTitle}>Submit Proof</Text>
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    placeholder="Short proof note (what you built, what you learned)"
                    value={proofNote}
                    onChangeText={setProofNote}
                    multiline
                  />
                  <TextInput
                    ref={proofLinksInputRef}
                    style={styles.input}
                    placeholder="Links (GitHub, Drive, Demo) — comma separated"
                    value={proofLinks}
                    onChangeText={(text) => {
                      setProofLinks(text);
                      const hasLinks = text
                        .split(",")
                        .map((item) => item.trim())
                        .filter(Boolean).length > 0;
                      setSelectedTaskProgress("submit-link", hasLinks);
                    }}
                    autoCapitalize="none"
                  />
                  <View style={styles.uploadRow}>
                    <TouchableOpacity style={styles.uploadBtn} onPress={uploadProofFile} disabled={uploadingProofFile}>
                      <Text style={styles.uploadBtnText}>{uploadingProofFile ? "Uploading..." : "Upload Proof Image"}</Text>
                    </TouchableOpacity>
                    {proofFiles.length ? (
                      <View style={styles.proofThumbRow}>
                        {proofFiles.map((uri, index) => (
                          <View key={`${selected.id}-proof-${index}`} style={styles.proofThumbWrap}>
                            <Image source={{ uri }} style={styles.proofThumb} />
                            <TouchableOpacity
                              style={styles.proofRemove}
                              onPress={() =>
                                setProofFiles((prev) => {
                                  const next = prev.filter((_, i) => i !== index);
                                  setSelectedTaskProgress("upload-project", next.length > 0);
                                  return next;
                                })
                              }
                            >
                              <Ionicons name="close" size={14} color="#FFFFFF" />
                            </TouchableOpacity>
                          </View>
                        ))}
                      </View>
                    ) : null}
                  </View>
                  <ActionButton
                    label={submittingProof ? "Submitting..." : "Submit Proof"}
                    icon="cloud-upload"
                    variant="secondary"
                    onPress={submitProof}
                    disabled={submittingProof || !/^[a-fA-F0-9]{24}$/.test(String(selected.id || ""))}
                  />
                  {selected.submissionStatus && selected.submissionStatus !== "not_submitted" ? (
                    <View style={styles.statusRow}>
                      <StatusBadge
                        label={`Status: ${selected.submissionStatus}`}
                        tone={selected.submissionStatus === "accepted" ? "success" : selected.submissionStatus === "rejected" ? "danger" : "primary"}
                      />
                      {selected.awardedRank ? <StatusBadge label={`Rank #${selected.awardedRank}`} tone="warning" /> : null}
                      {selected.awardedXp ? <StatusBadge label={`+${selected.awardedXp} XP`} tone="success" /> : null}
                    </View>
                  ) : null}
                </View>
              </View>
            ) : (
              <StatusBadge label="Mentors can design and submit challenge ideas below" tone="primary" />
            )}
          </View>
        </CommunitySection>
      ) : null}

      <CommunitySection
        title="Leaderboard Snapshot"
        subtitle="A quick ranking preview adds competitive energy without stealing focus from the challenge itself."
        icon="podium"
      >
        {(leaderboard?.globalTop || []).slice(0, 5).map((entry, index) => (
          <View key={`${entry.rank}-${entry.name}`} style={[styles.rankRow, index === 0 && styles.rankRowTop]}>
            <Text style={styles.rankText}>#{entry.rank}</Text>
            <Text style={styles.rankName}>{entry.name}</Text>
            <Text style={styles.rankScore}>{entry.score} XP</Text>
          </View>
        ))}
        {!(leaderboard?.globalTop || []).length ? <Text style={styles.emptyText}>Leaderboard data will appear here after challenge activity starts.</Text> : null}
      </CommunitySection>

      {user?.role === "mentor" ? (
        <CommunitySection
          title="Create Competitions"
          subtitle="Create global, institution, or class competitions here instead of using the mentor dashboard as a full editor."
          icon="add-circle"
        >
          <View style={styles.tagRow}>
            {(["institution", "class", "global"] as const).map((scope) => {
              const active = submitForm.scope === scope;
              return (
                <TouchableOpacity
                  key={`challenge-scope-${scope}`}
                  style={[styles.dayChip, active && styles.dayChipActive]}
                  onPress={() => setSubmitForm((prev) => ({ ...prev, scope, className: scope === "class" ? prev.className : "" }))}
                >
                  <Text style={[styles.dayChipText, active && styles.dayChipTextActive]}>
                    {scope === "institution" ? "My Institution" : scope === "class" ? "Specific Class" : "Global"}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <TextInput style={styles.input} placeholder="Challenge title" value={submitForm.title} onChangeText={(text) => setSubmitForm((prev) => ({ ...prev, title: text }))} />
          <TextInput style={styles.input} placeholder="Domain (optional)" value={submitForm.domain} onChangeText={(text) => setSubmitForm((prev) => ({ ...prev, domain: text }))} />
          {submitForm.scope === "class" ? (
            <ClassSectionSelector value={submitForm.className} onChange={(className) => setSubmitForm((prev) => ({ ...prev, className }))} />
          ) : null}
          <View style={styles.uploadRow}>
            <TouchableOpacity style={styles.uploadBtn} onPress={uploadBanner} disabled={uploadingBanner}>
              <Text style={styles.uploadBtnText}>{uploadingBanner ? "Uploading..." : submitForm.bannerImageUrl ? "Change Banner" : "Upload Banner"}</Text>
            </TouchableOpacity>
            {submitForm.bannerImageUrl ? <Image source={{ uri: submitForm.bannerImageUrl }} style={styles.bannerPreview} /> : null}
          </View>
          <TextInput style={[styles.input, styles.textArea]} placeholder="Description" value={submitForm.description} onChangeText={(text) => setSubmitForm((prev) => ({ ...prev, description: text }))} multiline />
          <TextInput style={styles.input} placeholder="Participant limit (optional)" value={submitForm.participantLimit} onChangeText={(text) => setSubmitForm((prev) => ({ ...prev, participantLimit: text }))} keyboardType="number-pad" />
          <TextInput style={[styles.input, styles.textArea]} placeholder="Proof instructions (what students must submit)" value={submitForm.proofInstructions} onChangeText={(text) => setSubmitForm((prev) => ({ ...prev, proofInstructions: text }))} multiline />
          <TextInput style={styles.input} placeholder="Deadline (YYYY-MM-DD HH:mm)" value={submitForm.deadline} onChangeText={(text) => setSubmitForm((prev) => ({ ...prev, deadline: text }))} />
          <ActionButton
            label={submitting ? "Submitting..." : "Submit for Review"}
            icon="send"
            disabled={submitting}
            onPress={async () => {
              try {
                if (!submitForm.title.trim()) {
                  Alert.alert("Title required", "Please enter a challenge title.");
                  return;
                }
                if (!submitForm.deadline.trim()) {
                  Alert.alert("Deadline required", "Please enter a deadline like 2026-03-25 18:30");
                  return;
                }
                setSubmitting(true);
                await api.post("/api/network/challenges/submit", {
                  title: submitForm.title.trim(),
                  domain: submitForm.domain.trim(),
                  className: submitForm.scope === "class" ? submitForm.className.trim() : "",
                  scope: submitForm.scope,
                  description: submitForm.description.trim(),
                  deadline: submitForm.deadline.trim().replace(" ", "T"),
                  bannerImageUrl: submitForm.bannerImageUrl.trim(),
                  participantLimit: submitForm.participantLimit.trim(),
                  proofInstructions: submitForm.proofInstructions.trim()
                });
                Alert.alert("Submitted", "Challenge idea sent to admin for review.");
                setSubmitForm({ title: "", domain: "", className: "", scope: "institution", description: "", deadline: "", bannerImageUrl: "", participantLimit: "", proofInstructions: "" });
                await load(true);
              } catch (e: any) {
                handleAppError(e, { mode: "alert", title: "Failed", fallbackMessage: "Unable to submit challenge." });
              } finally {
                setSubmitting(false);
              }
            }}
          />
          {mentorChallenges.length ? mentorChallenges.slice(0, 6).map((item) => (
            <View key={item.id} style={styles.challengeCard}>
              <Text style={styles.challengeTitle}>{item.title}</Text>
              <Text style={styles.challengeDescription}>
                {(item.scope || "global").toUpperCase()}{item.className ? ` · ${item.className}` : ""}{item.domain ? ` · ${item.domain}` : ""}
              </Text>
              <Text style={styles.challengeMeta}>Status: {item.approvalStatus || "pending"} · {item.participantsCount || 0} participants</Text>
            </View>
          )) : (
            <Text style={styles.emptyText}>No mentor competitions created yet.</Text>
          )}
        </CommunitySection>
      ) : null}
    </ScrollView>
  );
}

function daysRemaining(deadline: string) {
  const due = new Date(deadline);
  const now = new Date();
  if (Number.isNaN(due.getTime())) return 0;
  return Math.max(0, Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
}

function formatTimeLeft(deadline: string) {
  const days = daysRemaining(deadline);
  if (!days) return "Closing soon";
  if (days === 1) return "1 day left";
  return `${days} days left`;
}

const styles = StyleSheet.create({
  page: { padding: 16, backgroundColor: "#F4F7FB", gap: 14 },
  error: { color: "#B42318", fontWeight: "700" },
  emptyText: { color: "#667085", lineHeight: 20 },
  dayChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#D0D5DD",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  dayChipActive: { borderColor: "#F97316", backgroundColor: "#FFF7ED" },
  dayChipText: { color: "#667085", fontWeight: "700" },
  dayChipTextActive: { color: "#F97316" },
  heroChallengeCard: {
    borderRadius: 18,
    padding: 14,
    backgroundColor: "#FFF7ED",
    borderWidth: 1,
    borderColor: "#F9DBAF",
    gap: 12
  },
  challengeHead: { flexDirection: "row", gap: 12 },
  challengeIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: "#F97316",
    alignItems: "center",
    justifyContent: "center"
  },
  challengeHeadBody: { flex: 1, gap: 4 },
  challengeTitle: { color: "#101828", fontWeight: "800", fontSize: 18 },
  challengeMeta: { color: "#B54708", fontWeight: "700" },
  challengeDescription: { color: "#475467", lineHeight: 20 },
  reasonText: { color: "#B54708", fontWeight: "700", lineHeight: 18 },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  challengeCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E4E7EC",
    backgroundColor: "#FFFFFF",
    padding: 14,
    gap: 12
  },
  challengeCardActive: { borderColor: "#F97316", shadowColor: "#F97316", shadowOpacity: 0.08, shadowRadius: 12, elevation: 2 },
  challengeCardTop: { flexDirection: "row", gap: 12 },
  challengeLabelWrap: {
    width: 50,
    height: 50,
    borderRadius: 16,
    backgroundColor: "#FFF7ED",
    alignItems: "center",
    justifyContent: "center"
  },
  challengeCardBody: { flex: 1, gap: 4 },
  inlineRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  inlineBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardTitle: { flex: 1, color: "#101828", fontWeight: "800", fontSize: 16 },
  cardMeta: { color: "#667085", fontWeight: "600" },
  pillRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  detailCard: {
    borderRadius: 18,
    padding: 14,
    backgroundColor: "#FFFBF7",
    borderWidth: 1,
    borderColor: "#F9DBAF",
    gap: 12
  },
  detailBanner: {
    width: "100%",
    height: 180,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#F9DBAF"
  },
  detailHead: { flex: 1, gap: 4 },
  detailTitle: { color: "#101828", fontWeight: "800", fontSize: 18 },
  detailPanel: {
    borderRadius: 16,
    padding: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E4E7EC",
    gap: 10
  },
  detailActionStack: { gap: 10 },
  proofCard: {
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E4E7EC",
    backgroundColor: "#FFFFFF",
    gap: 10
  },
  statusRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  requirementTitle: { color: "#101828", fontWeight: "800" },
  progressValue: { color: "#F97316", fontWeight: "800" },
  taskList: { gap: 10 },
  taskItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E4E7EC",
    backgroundColor: "#FFFFFF",
    padding: 12
  },
  taskItemDone: { borderColor: "#ABEFC6", backgroundColor: "#ECFDF3" },
  taskCheckbox: {
    width: 28,
    height: 28,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#D0D5DD",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center"
  },
  taskCheckboxDone: { backgroundColor: "#1F7A4C", borderColor: "#1F7A4C" },
  taskBody: { flex: 1, gap: 2 },
  taskTitle: { color: "#101828", fontWeight: "700" },
  taskTitleDone: { color: "#027A48" },
  taskMeta: { color: "#667085", fontSize: 12 },
  taskXp: { color: "#F97316", fontWeight: "800", fontSize: 12 },
  uploadRow: { gap: 8 },
  uploadBtn: {
    borderWidth: 1,
    borderColor: "#F97316",
    backgroundColor: "#FFF7ED",
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center"
  },
  uploadBtnText: { color: "#B54708", fontWeight: "800" },
  bannerPreview: { width: "100%", height: 140, borderRadius: 14, borderWidth: 1, borderColor: "#F9DBAF" },
  proofThumbRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  proofThumbWrap: { width: 78, height: 78 },
  proofThumb: { width: "100%", height: "100%", borderRadius: 12, borderWidth: 1, borderColor: "#F9DBAF" },
  proofRemove: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#B42318",
    alignItems: "center",
    justifyContent: "center"
  },
  rankRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 14,
    padding: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E4E7EC"
  },
  rankRowTop: { backgroundColor: "#FFF7ED", borderColor: "#F9DBAF" },
  rankText: { width: 34, color: "#F97316", fontWeight: "800" },
  rankName: { flex: 1, color: "#101828", fontWeight: "700" },
  rankScore: { color: "#475467", fontWeight: "700" },
  input: {
    borderWidth: 1,
    borderColor: "#D0D5DD",
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 11
  },
  textArea: { minHeight: 92, textAlignVertical: "top" }
});
