import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import {
  ActionButton,
  CommunityHero,
  CommunitySection,
  ProgressBar,
  StatPill,
  StatusBadge
} from "@/components/community/ui";

type TrackItem = {
  id: string;
  title: string;
  level?: string;
  domain?: string;
  description?: string;
  requirements?: string[];
};

type EarnedCert = {
  id: string;
  certificateId?: string;
  title: string;
  level?: string;
  domain?: string;
  issuedAt?: string | null;
  source?: string;
  issuedBy?: string;
  type?: string;
  status?: string;
  qrCodeUrl?: string;
  verificationUrl?: string;
  certificateUrl?: string;
  metadata?: {
    domain?: string;
    level?: string;
    score?: number;
    goal?: string;
    totalSteps?: number;
    completedSteps?: number;
    challengeTitle?: string;
  };
};

type MyRequest = {
  id: string;
  status: string;
  note?: string;
  track?: { id?: string; title?: string; level?: string; domain?: string };
};

type SelectedCertificate = {
  id: string;
  certificateId?: string;
  title: string;
  level?: string;
  domain?: string;
  issuedAt?: string | null;
  source?: string;
  issuedBy?: string;
  type?: string;
  status?: string;
  qrCodeUrl?: string;
  verificationUrl?: string;
  certificateUrl?: string;
  metadata?: EarnedCert["metadata"];
};

export default function CommunityCertificationsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [tracks, setTracks] = useState<TrackItem[]>([]);
  const [earned, setEarned] = useState<EarnedCert[]>([]);
  const [requests, setRequests] = useState<MyRequest[]>([]);
  const [selected, setSelected] = useState<SelectedCertificate | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requestNoteById, setRequestNoteById] = useState<Record<string, string>>({});
  const [submittingId, setSubmittingId] = useState("");

  const load = useCallback(async (refresh = false) => {
    try {
      if (refresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      const [tracksRes, earnedRes, reqRes] = await Promise.allSettled([
        api.get<TrackItem[]>("/api/network/certification-tracks"),
        api.get<EarnedCert[]>("/api/network/certifications"),
        api.get<MyRequest[]>("/api/network/certification-requests/me")
      ]);

      const nextTracks = tracksRes.status === "fulfilled" ? tracksRes.value.data || [] : [];
      const nextEarned = earnedRes.status === "fulfilled" ? earnedRes.value.data || [] : [];
      const nextRequests = reqRes.status === "fulfilled" ? reqRes.value.data || [] : [];

      setTracks(nextTracks);
      setEarned(nextEarned);
      setRequests(nextRequests);
      setSelected((prev) => {
        const currentId = prev?.id || prev?.certificateId;
        const matched = currentId
          ? nextEarned.find((item) => item.id === currentId || item.certificateId === currentId)
          : null;
        return matched ? mapEarned(matched) : nextEarned[0] ? mapEarned(nextEarned[0]) : null;
      });
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to load certifications.");
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

  const completedCount = earned.length;
  const requestCount = requests.length;
  const topPerformerCount = earned.filter((item) => (item.level || "").toLowerCase().includes("advanced")).length;
  const completionRate = tracks.length ? Math.round((earned.length / tracks.length) * 100) : 0;

  const requestStatusTone = useMemo(
    () => (status: string) => {
      const normalized = status.toLowerCase();
      if (normalized.includes("approved")) return "success" as const;
      if (normalized.includes("rejected")) return "danger" as const;
      if (normalized.includes("pending")) return "warning" as const;
      return "neutral" as const;
    },
    []
  );

  async function shareCertificate(item: SelectedCertificate) {
    const verifyUrl = item.verificationUrl || item.certificateUrl || "";
    await Share.share({
      message: [
        item.title,
        `Certificate ID: ${item.certificateId || item.id}`,
        `Level: ${item.level || "Verified"}`,
        verifyUrl ? `Verify: ${verifyUrl}` : ""
      ]
        .filter(Boolean)
        .join("\n")
    });
  }

  async function handleDownload(item: SelectedCertificate) {
    const url = item.certificateUrl || item.verificationUrl || item.qrCodeUrl || "";
    if (!url) {
      Alert.alert("Not ready", "This certificate does not have a downloadable file yet.");
      return;
    }
    const supported = await Linking.canOpenURL(url);
    if (!supported) {
      Alert.alert("Unable to open", "This certificate link could not be opened on this device.");
      return;
    }
    await Linking.openURL(url);
  }

  async function handleVerify(item: SelectedCertificate) {
    const certKey = item.certificateId || item.id;
    if (!certKey) return;
    router.push(`/verify/${encodeURIComponent(certKey)}` as never);
  }

  return (
    <ScrollView
      contentContainerStyle={styles.page}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
    >
      <CommunityHero
        eyebrow="Certificates"
        title="Your Achievements"
        subtitle="Turn completed tracks into visible credibility. View, verify, share, and keep building your ORIN proof of work."
        stats={[
          { icon: "ribbon", label: "Certificates", value: String(completedCount) },
          { icon: "time", label: "Requests", value: String(requestCount) },
          { icon: "trophy", label: "Top Performer", value: String(topPerformerCount) }
        ]}
        colors={["#4B5DFF", "#6D63FF", "#8F6EFF"]}
      />

      <CommunitySection
        title="Achievement Progress"
        subtitle="Every completed certification strengthens your profile and unlocks stronger social proof."
        icon="stats-chart"
      >
        <View style={styles.progressHeader}>
          <Text style={styles.progressValue}>{completionRate}% complete</Text>
          <StatusBadge label={completionRate >= 75 ? "On Track" : "Keep Going"} tone={completionRate >= 75 ? "success" : "warning"} />
        </View>
        <ProgressBar progress={completionRate} tone="#6D63FF" />
        <View style={styles.pillRow}>
          <StatPill icon="medal" label={`${completedCount} earned`} tone="#EEF2FF" />
          <StatPill icon="hourglass" label={`${requestCount} pending review`} tone="#FFF7ED" />
        </View>
      </CommunitySection>

      <CommunitySection
        title="Earned Certificates"
        subtitle="Your completed certificates now feel like achievements instead of plain records."
        icon="sparkles"
      >
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {loading ? <ActivityIndicator size="large" color="#1F7A4C" /> : null}
        {!loading && !earned.length ? <Text style={styles.emptyText}>No certificates earned yet. Join a challenge or complete a verified track to unlock your first one.</Text> : null}
        {earned.map((item) => {
          const mapped = mapEarned(item);
          const isSelected = selected?.id === mapped.id;
          const badgeTone = (item.level || "").toLowerCase().includes("advanced") ? "warning" : "success";
          return (
            <TouchableOpacity
              key={mapped.id}
              activeOpacity={0.94}
              style={[styles.achievementCard, isSelected && styles.achievementCardActive]}
              onPress={() => setSelected(mapped)}
            >
              <View style={styles.achievementRow}>
                <View style={styles.thumbWrap}>
                  <Ionicons name="ribbon" size={24} color="#7A5AF8" />
                </View>
                <View style={styles.achievementBody}>
                  <View style={styles.cardHeaderRow}>
                    <Text style={styles.cardTitle}>{mapped.title}</Text>
                    <StatusBadge label={item.level?.toLowerCase().includes("advanced") ? "Top Performer" : (item.status || "Completed")} tone={badgeTone} />
                  </View>
                  <Text style={styles.cardMeta}>{mapped.domain || "ORIN Track"} � {formatDate(mapped.issuedAt)}</Text>
                  <Text style={styles.cardMetaSmall}>Certificate ID: {mapped.certificateId || mapped.id}</Text>
                </View>
              </View>
              <View style={styles.actionRow}>
                <ActionButton label="View" icon="eye-outline" variant="secondary" onPress={() => setSelected(mapped)} style={styles.flexAction} />
                <ActionButton label="Download" icon="download-outline" variant="ghost" onPress={() => handleDownload(mapped)} style={styles.flexAction} />
                <ActionButton label="Share" icon="share-social-outline" variant="ghost" onPress={() => shareCertificate(mapped)} style={styles.flexAction} />
              </View>
            </TouchableOpacity>
          );
        })}
      </CommunitySection>

      {selected ? (
        <CommunitySection
          title="Certificate View"
          subtitle="A premium preview with verification details, QR code, and share actions."
          icon="document-text"
        >
          <View style={styles.previewCard}>
            <View style={styles.previewHeader}>
              <View style={styles.previewBadgeWrap}>
                <Ionicons name="shield-checkmark" size={22} color="#FFFFFF" />
              </View>
              <View style={styles.previewHeaderBody}>
                <Text style={styles.previewTitle}>{selected.title}</Text>
                <Text style={styles.previewMeta}>{selected.domain || "ORIN"} � {selected.level || "Verified"}</Text>
              </View>
            </View>
            <View style={styles.qrRow}>
              {selected.qrCodeUrl ? (
                <Image source={{ uri: selected.qrCodeUrl }} style={styles.qrImage} resizeMode="cover" />
              ) : (
                <View style={styles.qrBox}>
                  {Array.from({ length: 16 }).map((_, index) => (
                    <View key={index} style={[styles.qrDot, index % 3 === 0 && styles.qrDotFilled]} />
                  ))}
                </View>
              )}
              <View style={styles.qrInfo}>
                <StatusBadge label={selected.status === "approved" ? "Verified" : (selected.status || "Ready")} tone={selected.status === "approved" ? "success" : "primary"} />
                <Text style={styles.previewMeta}>Completion date: {formatDate(selected.issuedAt)}</Text>
                <Text style={styles.previewMeta}>Certificate ID: {selected.certificateId || selected.id}</Text>
                <Text style={styles.previewMeta}>Issued by: {selected.issuedBy || "ORIN"}</Text>
                {selected.verificationUrl ? <Text style={styles.previewMetaSmall}>{selected.verificationUrl}</Text> : null}
              </View>
            </View>
            <View style={styles.actionRow}>
              <ActionButton label="Verify" icon="checkmark-circle-outline" variant="secondary" onPress={() => handleVerify(selected)} style={styles.flexAction} />
              <ActionButton label="Download" icon="download-outline" onPress={() => handleDownload(selected)} style={styles.flexAction} />
              <ActionButton label="Share" icon="share-social-outline" variant="ghost" onPress={() => shareCertificate(selected)} style={styles.flexAction} />
            </View>
          </View>
        </CommunitySection>
      ) : null}

      <CommunitySection
        title="Available Tracks"
        subtitle="Clear next steps keep this section useful even before a user earns a certificate."
        icon="list"
      >
        {!loading && !tracks.length ? <Text style={styles.emptyText}>No certification tracks published yet.</Text> : null}
        {tracks.map((item) => (
          <View key={item.id} style={styles.trackCard}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <StatusBadge label={item.level || "Beginner"} tone="primary" />
            </View>
            <Text style={styles.cardMeta}>{item.domain || "General"} � {(item.requirements || []).length} requirements</Text>
            {item.description ? <Text style={styles.cardDescription}>{item.description}</Text> : null}
            <View style={styles.pillRow}>
              {(item.requirements || []).slice(0, 3).map((req) => (
                <StatPill key={`${item.id}-${req}`} icon="checkmark-circle" label={req} tone="#ECFDF3" />
              ))}
            </View>
            {user?.role === "student" ? (
              <>
                <TextInput
                  style={styles.input}
                  placeholder="Add a note for verification (optional)"
                  value={requestNoteById[item.id] || ""}
                  onChangeText={(text) => setRequestNoteById((prev) => ({ ...prev, [item.id]: text }))}
                />
                <ActionButton
                  label={submittingId === item.id ? "Submitting..." : "Request Verification"}
                  icon="send"
                  disabled={submittingId === item.id}
                  onPress={async () => {
                    try {
                      setSubmittingId(item.id);
                      await api.post(`/api/network/certification-tracks/${item.id}/request`, {
                        note: (requestNoteById[item.id] || "").trim()
                      });
                      Alert.alert("Requested", "Your request has been sent to admin for review.");
                      await load(true);
                    } catch (e: any) {
                      Alert.alert("Failed", e?.response?.data?.message || "Unable to request certification.");
                    } finally {
                      setSubmittingId("");
                    }
                  }}
                />
              </>
            ) : null}
          </View>
        ))}
      </CommunitySection>

      <CommunitySection
        title="Request Status"
        subtitle="Simple status tags keep the workflow easy to understand."
        icon="time"
      >
        {!loading && !requests.length ? <Text style={styles.emptyText}>No certificate requests yet.</Text> : null}
        {requests.map((request) => (
          <View key={request.id} style={styles.requestCard}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardTitle}>{request.track?.title || "Certification request"}</Text>
              <StatusBadge label={request.status} tone={requestStatusTone(request.status)} />
            </View>
            <Text style={styles.cardMeta}>{request.track?.domain || "ORIN"} � {request.track?.level || "Track review"}</Text>
            {request.note ? <Text style={styles.cardDescription}>{request.note}</Text> : null}
          </View>
        ))}
      </CommunitySection>
    </ScrollView>
  );
}

function mapEarned(item: EarnedCert): SelectedCertificate {
  return {
    id: item.id,
    certificateId: item.certificateId || item.id,
    title: item.title,
    level: item.level || item.metadata?.level,
    domain: item.domain || item.metadata?.domain,
    issuedAt: item.issuedAt,
    source: item.source,
    issuedBy: item.issuedBy,
    type: item.type,
    status: item.status,
    qrCodeUrl: item.qrCodeUrl,
    verificationUrl: item.verificationUrl,
    certificateUrl: item.certificateUrl,
    metadata: item.metadata
  };
}

function formatDate(value?: string | null) {
  if (!value) return "Recently awarded";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}

const styles = StyleSheet.create({
  page: { padding: 16, backgroundColor: "#F4F7FB", gap: 14 },
  progressHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  progressValue: { color: "#101828", fontSize: 16, fontWeight: "800" },
  pillRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  emptyText: { color: "#667085", lineHeight: 20 },
  error: { color: "#B42318", fontWeight: "700" },
  achievementCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E4E7EC",
    backgroundColor: "#FFFFFF",
    padding: 14,
    gap: 12
  },
  achievementCardActive: { borderColor: "#7A5AF8", shadowColor: "#7A5AF8", shadowOpacity: 0.1, shadowRadius: 12, elevation: 3 },
  achievementRow: { flexDirection: "row", gap: 12 },
  thumbWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: "#F4F3FF",
    alignItems: "center",
    justifyContent: "center"
  },
  achievementBody: { flex: 1, gap: 4 },
  cardHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 10 },
  cardTitle: { flex: 1, color: "#101828", fontWeight: "800", fontSize: 16 },
  cardMeta: { color: "#667085", fontWeight: "600" },
  cardMetaSmall: { color: "#98A2B3", fontSize: 12, fontWeight: "600" },
  cardDescription: { color: "#475467", lineHeight: 20 },
  actionRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  flexAction: { flex: 1, minWidth: 96 },
  previewCard: {
    borderRadius: 20,
    padding: 16,
    backgroundColor: "#FEFCF8",
    borderWidth: 1,
    borderColor: "#F2E7D5",
    gap: 16
  },
  previewHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  previewBadgeWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: "#7A5AF8",
    alignItems: "center",
    justifyContent: "center"
  },
  previewHeaderBody: { flex: 1, gap: 4 },
  previewTitle: { color: "#101828", fontWeight: "800", fontSize: 18 },
  previewMeta: { color: "#475467", fontWeight: "600" },
  previewMetaSmall: { color: "#667085", lineHeight: 19 },
  qrRow: { flexDirection: "row", gap: 14 },
  qrBox: {
    width: 92,
    height: 92,
    borderRadius: 12,
    padding: 10,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D0D5DD",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4
  },
  qrImage: {
    width: 92,
    height: 92,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D0D5DD"
  },
  qrDot: { width: 14, height: 14, borderRadius: 3, backgroundColor: "#E4E7EC" },
  qrDotFilled: { backgroundColor: "#101828" },
  qrInfo: { flex: 1, gap: 8 },
  trackCard: {
    borderRadius: 18,
    padding: 14,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E4E7EC",
    gap: 10
  },
  requestCard: {
    borderRadius: 18,
    padding: 14,
    backgroundColor: "#FFFDF7",
    borderWidth: 1,
    borderColor: "#F2E7D5",
    gap: 8
  },
  input: {
    borderWidth: 1,
    borderColor: "#D0D5DD",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 11
  }
});
