import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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

type ChallengeItem = {
  id: string;
  title: string;
  domain?: string;
  description?: string;
  participantsCount?: number;
  deadline: string;
  isActive?: boolean;
  recommended?: boolean;
  recommendationReason?: string;
  challengeState?: string;
  xpHint?: number;
};
type LeaderboardResponse = { globalTop?: Array<{ rank: number; name: string; score: number }> };

const STORAGE_KEY = "community-challenge-progress-v1";
const DEFAULT_TASKS = [
  { id: "upload-project", label: "Upload project", xp: 30 },
  { id: "submit-link", label: "Submit link", xp: 20 }
];

export default function CommunityChallengesPage() {
  const { user } = useAuth();
  const { colors } = useAppTheme();
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
    description: "",
    deadline: ""
  });
  const [joining, setJoining] = useState(false);
  const [claimingCertificate, setClaimingCertificate] = useState(false);

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
      setError(e?.response?.data?.message || "Failed to load challenges.");
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
  const selected = items.find((item) => item.id === selectedId) || activeChallenges[0] || items[0] || null;
  const selectedTasks = selected ? progressMap[selected.id] || {} : {};
  const completedTasks = DEFAULT_TASKS.filter((task) => selectedTasks[task.id]).length;
  const completion = selected ? Math.round((completedTasks / DEFAULT_TASKS.length) * 100) : 0;
  const topChallenge = activeChallenges[0];
  const topNames = (leaderboard?.globalTop || []).slice(0, 3).map((entry) => entry.name);

  async function participate() {
    if (!selected?.id || user?.role !== "student" || !/^[a-fA-F0-9]{24}$/.test(String(selected.id || ""))) return;
    try {
      setJoining(true);
      await api.post(`/api/network/challenges/${selected.id}/join`, {});
      Alert.alert("Joined", "You are now in the challenge. Complete the tasks below to keep momentum.");
      await load(true);
    } catch (e: any) {
      Alert.alert("Failed", e?.response?.data?.message || "Unable to join challenge.");
    } finally {
      setJoining(false);
    }
  }

  function toggleTask(taskId: string) {
    if (!selected) return;
    setProgressMap((prev) => ({
      ...prev,
      [selected.id]: {
        ...(prev[selected.id] || {}),
        [taskId]: !(prev[selected.id] || {})[taskId]
      }
    }));
  }

  async function claimCertificate() {
    if (!selected?.id) return;
    if (completion < 100) {
      Alert.alert("Complete challenge", "Finish all checklist items before claiming a certificate.");
      return;
    }
    try {
      setClaimingCertificate(true);
      const res = await api.post("/api/network/certifications/generate", {
        type: "challenge",
        title: `${selected.title} Challenge Completion`,
        domain: selected.domain || "",
        level: "Completed",
        referenceId: selected.id,
        metadata: {
          domain: selected.domain || "",
          challengeTitle: selected.title,
          totalSteps: DEFAULT_TASKS.length,
          completedSteps: DEFAULT_TASKS.length
        }
      });
      Alert.alert(
        "Certificate Ready",
        res.data?.created
          ? "Your challenge certificate has been added to Certifications."
          : "This challenge certificate is already in your Certifications."
      );
    } catch (e: any) {
      Alert.alert("Unable to claim", e?.response?.data?.message || "Unable to claim certificate right now.");
    } finally {
      setClaimingCertificate(false);
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
              </View>
            </View>
            <Text style={styles.challengeDescription}>
              {selected.description || "Complete the steps below to turn this challenge into a visible proof of work and XP gain."}
            </Text>
            {selected.recommendationReason ? <Text style={styles.reasonText}>{selected.recommendationReason}</Text> : null}

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
                  <TouchableOpacity key={`${selected.id}-${task.id}`} style={[styles.taskItem, done && styles.taskItemDone]} activeOpacity={0.92} onPress={() => toggleTask(task.id)}>
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
                {completion === 100 ? (
                  <ActionButton
                    label={claimingCertificate ? "Claiming..." : "Claim Certificate"}
                    icon="ribbon"
                    variant="secondary"
                    onPress={claimCertificate}
                    disabled={claimingCertificate || !/^[a-fA-F0-9]{24}$/.test(String(selected.id || ""))}
                  />
                ) : null}
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
          title="Propose a Challenge"
          subtitle="Mentors can submit stronger challenge ideas while keeping the same admin review workflow."
          icon="add-circle"
        >
          <TextInput style={styles.input} placeholder="Challenge title" value={submitForm.title} onChangeText={(text) => setSubmitForm((prev) => ({ ...prev, title: text }))} />
          <TextInput style={styles.input} placeholder="Domain (optional)" value={submitForm.domain} onChangeText={(text) => setSubmitForm((prev) => ({ ...prev, domain: text }))} />
          <TextInput style={[styles.input, styles.textArea]} placeholder="Description" value={submitForm.description} onChangeText={(text) => setSubmitForm((prev) => ({ ...prev, description: text }))} multiline />
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
                  description: submitForm.description.trim(),
                  deadline: submitForm.deadline.trim().replace(" ", "T")
                });
                Alert.alert("Submitted", "Challenge idea sent to admin for review.");
                setSubmitForm({ title: "", domain: "", description: "", deadline: "" });
                await load(true);
              } catch (e: any) {
                Alert.alert("Failed", e?.response?.data?.message || "Unable to submit challenge.");
              } finally {
                setSubmitting(false);
              }
            }}
          />
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
