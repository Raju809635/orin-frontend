import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
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
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { api } from "@/lib/api";
import { getAppErrorMessage, handleAppError } from "@/lib/appError";
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
type MentorCertificateTemplateItem = {
  id: string;
  title: string;
  templateKey: string;
  certificateType?: string;
  xpReward?: number;
  scope?: "global" | "institution" | "class";
  institutionName?: string;
  className?: string;
  isActive?: boolean;
};

export default function CommunityCertificationsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const [tracks, setTracks] = useState<TrackItem[]>([]);
  const [earned, setEarned] = useState<EarnedCert[]>([]);
  const [requests, setRequests] = useState<MyRequest[]>([]);
  const [mentorTemplates, setMentorTemplates] = useState<MentorCertificateTemplateItem[]>([]);
  const [selected, setSelected] = useState<SelectedCertificate | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requestNoteById, setRequestNoteById] = useState<Record<string, string>>({});
  const [submittingId, setSubmittingId] = useState("");
  const [templateScope, setTemplateScope] = useState<"global" | "institution" | "class">("institution");
  const [templateTitle, setTemplateTitle] = useState("");
  const [templateClassName, setTemplateClassName] = useState("");
  const [templateType, setTemplateType] = useState("manual");
  const [templateXpReward, setTemplateXpReward] = useState("0");
  const [templateDescription, setTemplateDescription] = useState("");
  const [savingTemplate, setSavingTemplate] = useState(false);

  const load = useCallback(async (refresh = false) => {
    try {
      if (refresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      const [tracksRes, earnedRes, reqRes, templateRes] = await Promise.allSettled([
        api.get<TrackItem[]>("/api/network/certification-tracks"),
        api.get<EarnedCert[]>("/api/network/certifications"),
        api.get<MyRequest[]>("/api/network/certification-requests/me"),
        user?.role === "mentor" ? api.get<MentorCertificateTemplateItem[]>("/api/network/certificate-templates/mentor") : Promise.resolve({ data: [] as MentorCertificateTemplateItem[] })
      ]);

      const nextTracks = tracksRes.status === "fulfilled" ? tracksRes.value.data || [] : [];
      const nextEarned = earnedRes.status === "fulfilled" ? earnedRes.value.data || [] : [];
      const nextRequests = reqRes.status === "fulfilled" ? reqRes.value.data || [] : [];
      const nextTemplates = templateRes.status === "fulfilled" ? templateRes.value.data || [] : [];

      setTracks(nextTracks);
      setEarned(nextEarned);
      setRequests(nextRequests);
      setMentorTemplates(nextTemplates);
      setSelected((prev) => {
        const currentId = prev?.id || prev?.certificateId;
        const matched = currentId
          ? nextEarned.find((item) => item.id === currentId || item.certificateId === currentId)
          : null;
        return matched ? mapEarned(matched) : nextEarned[0] ? mapEarned(nextEarned[0]) : null;
      });
    } catch (e: any) {
      setError(getAppErrorMessage(e, "Failed to load certifications."));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.role]);

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
    try {
      const html = buildCertificateHtml({
        recipientName: user?.name || "ORIN User",
        title: item.title,
        certificateId: item.certificateId || item.id,
        issuedBy: item.issuedBy || "ORIN",
        issuedAt: formatDate(item.issuedAt),
        domain: item.domain || item.metadata?.domain || "ORIN",
        level: item.level || item.metadata?.level || "Verified",
        verificationUrl: item.verificationUrl || ""
      });
      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: "application/pdf",
          dialogTitle: `${item.title} certificate`
        });
      } else {
        Alert.alert("Certificate ready", "PDF generated successfully.");
      }
    } catch {
      Alert.alert("Unable to generate", "The certificate PDF could not be created right now.");
    }
  }

  async function handleVerify(item: SelectedCertificate) {
    const certKey = item.certificateId || item.id;
    if (!certKey) return;
    router.push(`/verify/${encodeURIComponent(certKey)}` as never);
  }

  return (
    <ScrollView
      contentContainerStyle={[styles.page, { backgroundColor: colors.background }]}
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
        {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
        {loading ? <ActivityIndicator size="large" color="#1F7A4C" /> : null}
        {!loading && !earned.length ? <Text style={[styles.emptyText, { color: colors.textMuted }]}>No certificates earned yet. Join a challenge or complete a verified track to unlock your first one.</Text> : null}
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
                  {(item.source || "").toLowerCase().includes("admin") || (item.type || "").toLowerCase().includes("admin") ? (
                    <StatusBadge label="Admin Issued" tone="primary" />
                  ) : null}
                  <Text style={[styles.cardMeta, { color: colors.textMuted }]}>{mapped.domain || "ORIN Track"} - {formatDate(mapped.issuedAt)}</Text>
                  <Text style={[styles.cardMetaSmall, { color: colors.textMuted }]}>Certificate ID: {mapped.certificateId || mapped.id}</Text>
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
          <View style={[styles.previewCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.previewHeader}>
              <View style={styles.previewBadgeWrap}>
                <Ionicons name="shield-checkmark" size={22} color="#FFFFFF" />
              </View>
              <View style={styles.previewHeaderBody}>
                <Text style={[styles.previewTitle, { color: colors.text }]}>{selected.title}</Text>
                <Text style={[styles.previewMeta, { color: colors.textMuted }]}>{selected.domain || "ORIN"} - {selected.level || "Verified"}</Text>
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
                <Text style={[styles.previewMeta, { color: colors.textMuted }]}>Completion date: {formatDate(selected.issuedAt)}</Text>
                <Text style={[styles.previewMeta, { color: colors.textMuted }]}>Certificate ID: {selected.certificateId || selected.id}</Text>
                <Text style={[styles.previewMeta, { color: colors.textMuted }]}>Issued by: {selected.issuedBy || "ORIN"}</Text>
                {selected.verificationUrl ? <Text style={[styles.previewMetaSmall, { color: colors.textMuted }]}>{selected.verificationUrl}</Text> : null}
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
        {!loading && !tracks.length ? <Text style={[styles.emptyText, { color: colors.textMuted }]}>No certification tracks published yet.</Text> : null}
        {tracks.map((item) => (
          <View key={item.id} style={[styles.trackCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.cardHeaderRow}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>{item.title}</Text>
              <StatusBadge label={item.level || "Beginner"} tone="primary" />
            </View>
            <Text style={[styles.cardMeta, { color: colors.textMuted }]}>{item.domain || "General"} - {(item.requirements || []).length} requirements</Text>
            {item.description ? <Text style={[styles.cardDescription, { color: colors.textMuted }]}>{item.description}</Text> : null}
            <View style={styles.pillRow}>
              {(item.requirements || []).slice(0, 3).map((req) => (
                <StatPill key={`${item.id}-${req}`} icon="checkmark-circle" label={req} tone="#ECFDF3" />
              ))}
            </View>
            {user?.role === "student" ? (
              <>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.surfaceAlt, borderColor: colors.border, color: colors.text }]}
                  placeholder="Add a note for verification (optional)" placeholderTextColor={colors.textMuted}
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
                      handleAppError(e, { mode: "alert", title: "Failed", fallbackMessage: "Unable to request certification." });
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

      {user?.role === "mentor" ? (
        <CommunitySection
          title="Mentor Certificate Templates"
          subtitle="Keep institution and class certificate templates in the existing certifications area instead of the mentor dashboard."
          icon="ribbon"
        >
          <View style={styles.pillRow}>
            {(["institution", "class", "global"] as const).map((scope) => {
              const active = templateScope === scope;
              return (
                <TouchableOpacity
                  key={`template-scope-${scope}`}
                  style={[styles.scopeChip, { borderColor: active ? "#6D63FF" : colors.border, backgroundColor: active ? "#EEF2FF" : colors.surfaceAlt }]}
                  onPress={() => {
                    setTemplateScope(scope);
                    if (scope !== "class") setTemplateClassName("");
                  }}
                >
                  <Text style={[styles.scopeChipText, { color: active ? "#6D63FF" : colors.textMuted }]}>
                    {scope === "institution" ? "My Institution" : scope === "class" ? "Specific Class" : "Global"}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <TextInput
            style={[styles.input, { backgroundColor: colors.surfaceAlt, borderColor: colors.border, color: colors.text }]}
            placeholder="Template title"
            placeholderTextColor={colors.textMuted}
            value={templateTitle}
            onChangeText={setTemplateTitle}
          />
          {templateScope === "class" ? (
            <ClassSectionSelector value={templateClassName} onChange={setTemplateClassName} />
          ) : null}
          <TextInput
            style={[styles.input, { backgroundColor: colors.surfaceAlt, borderColor: colors.border, color: colors.text }]}
            placeholder="Certificate type (manual, roadmap, challenge)"
            placeholderTextColor={colors.textMuted}
            value={templateType}
            onChangeText={setTemplateType}
          />
          <TextInput
            style={[styles.input, { backgroundColor: colors.surfaceAlt, borderColor: colors.border, color: colors.text }]}
            placeholder="XP reward"
            placeholderTextColor={colors.textMuted}
            keyboardType="numeric"
            value={templateXpReward}
            onChangeText={setTemplateXpReward}
          />
          <TextInput
            style={[styles.input, styles.textArea, { backgroundColor: colors.surfaceAlt, borderColor: colors.border, color: colors.text }]}
            placeholder="Template description"
            placeholderTextColor={colors.textMuted}
            value={templateDescription}
            onChangeText={setTemplateDescription}
            multiline
          />
          <ActionButton
            label={savingTemplate ? "Saving..." : "Save Template"}
            icon="save"
            disabled={savingTemplate}
            onPress={async () => {
              try {
                if (!templateTitle.trim()) {
                  Alert.alert("Title required", "Please add a template title.");
                  return;
                }
                setSavingTemplate(true);
                await api.post("/api/network/certificate-templates/mentor", {
                  title: templateTitle.trim(),
                  className: templateScope === "class" ? templateClassName.trim() : "",
                  description: templateDescription.trim(),
                  xpReward: Number(templateXpReward || 0),
                  certificateType: templateType.trim() || "manual",
                  scope: templateScope
                });
                Alert.alert("Saved", "Certificate template saved.");
                setTemplateTitle("");
                setTemplateClassName("");
                setTemplateType("manual");
                setTemplateXpReward("0");
                setTemplateDescription("");
                await load(true);
              } catch (e: any) {
                handleAppError(e, { mode: "alert", title: "Failed", fallbackMessage: "Unable to save certificate template." });
              } finally {
                setSavingTemplate(false);
              }
            }}
          />
          {!mentorTemplates.length ? <Text style={[styles.emptyText, { color: colors.textMuted }]}>No mentor certificate templates yet.</Text> : null}
          {mentorTemplates.slice(0, 8).map((item) => (
            <View key={item.id} style={[styles.trackCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.cardHeaderRow}>
                <Text style={[styles.cardTitle, { color: colors.text }]}>{item.title}</Text>
                <StatusBadge label={item.certificateType || "manual"} tone="primary" />
              </View>
              <Text style={[styles.cardMeta, { color: colors.textMuted }]}>
                {(item.scope || "global").toUpperCase()}{item.className ? ` · ${item.className}` : ""} · {item.xpReward || 0} XP
              </Text>
            </View>
          ))}
        </CommunitySection>
      ) : null}

      <CommunitySection
        title="Request Status"
        subtitle="Simple status tags keep the workflow easy to understand."
        icon="time"
      >
        {!loading && !requests.length ? <Text style={[styles.emptyText, { color: colors.textMuted }]}>No certificate requests yet.</Text> : null}
        {requests.map((request) => (
          <View key={request.id} style={[styles.requestCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardTitle}>{request.track?.title || "Certification request"}</Text>
              <StatusBadge label={request.status} tone={requestStatusTone(request.status)} />
            </View>
            <Text style={[styles.cardMeta, { color: colors.textMuted }]}>{request.track?.domain || "ORIN"} - {request.track?.level || "Track review"}</Text>
            {request.note ? <Text style={[styles.cardDescription, { color: colors.textMuted }]}>{request.note}</Text> : null}
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

function buildCertificateHtml({
  recipientName,
  title,
  certificateId,
  issuedBy,
  issuedAt,
  domain,
  level,
  verificationUrl
}: {
  recipientName: string;
  title: string;
  certificateId: string;
  issuedBy: string;
  issuedAt: string;
  domain: string;
  level: string;
  verificationUrl: string;
}) {
  return `
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body { font-family: Helvetica, Arial, sans-serif; margin: 0; padding: 32px; color: #12261d; background: #f6fbf8; }
          .shell { border: 8px solid #0e6a42; border-radius: 24px; background: white; padding: 36px; box-shadow: 0 10px 30px rgba(16,24,40,0.08); }
          .brand { text-align: center; color: #0e6a42; font-weight: 800; letter-spacing: 2px; font-size: 14px; text-transform: uppercase; }
          h1 { text-align: center; margin: 18px 0 6px; font-size: 34px; color: #101828; }
          .subtitle { text-align: center; color: #667085; font-size: 15px; margin-bottom: 28px; }
          .recipient { text-align: center; font-size: 36px; font-weight: 800; color: #0e6a42; margin: 10px 0 18px; }
          .course { text-align: center; font-size: 22px; font-weight: 700; color: #101828; margin-bottom: 28px; }
          .meta-grid { display: table; width: 100%; margin-top: 18px; }
          .meta-row { display: table-row; }
          .meta-item { display: table-cell; width: 33.3%; padding: 12px 8px; text-align: center; }
          .label { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #667085; margin-bottom: 6px; }
          .value { font-size: 16px; font-weight: 700; color: #101828; }
          .footer { margin-top: 34px; padding-top: 20px; border-top: 1px solid #e4e7ec; text-align: center; color: #667085; font-size: 12px; line-height: 1.6; }
          .seal { margin: 28px auto 0; width: 94px; height: 94px; border-radius: 47px; background: linear-gradient(135deg, #0e6a42, #63d297); color: white; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 16px; text-align: center; }
        </style>
      </head>
      <body>
        <div class="shell">
          <div class="brand">ORIN Certificate of Achievement</div>
          <h1>Certificate of Completion</h1>
          <div class="subtitle">This certifies that</div>
          <div class="recipient">${escapeHtml(recipientName)}</div>
          <div class="subtitle">has successfully completed</div>
          <div class="course">${escapeHtml(title)}</div>
          <div class="meta-grid">
            <div class="meta-row">
              <div class="meta-item"><div class="label">Domain</div><div class="value">${escapeHtml(domain)}</div></div>
              <div class="meta-item"><div class="label">Level</div><div class="value">${escapeHtml(level)}</div></div>
              <div class="meta-item"><div class="label">Issued On</div><div class="value">${escapeHtml(issuedAt)}</div></div>
            </div>
          </div>
          <div class="seal">Verified<br/>ORIN</div>
          <div class="footer">
            Certificate ID: ${escapeHtml(certificateId)}<br/>
            Issued by ${escapeHtml(issuedBy)}<br/>
            ${verificationUrl ? `Verify at: ${escapeHtml(verificationUrl)}` : ""}
          </div>
        </div>
      </body>
    </html>
  `;
}

function escapeHtml(value: string) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
const styles = StyleSheet.create({
  page: { padding: 16, backgroundColor: "#F4F7FB", gap: 14 },
  progressHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  progressValue: { color: "#101828", fontSize: 16, fontWeight: "800" },
  pillRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  emptyText: { color: "#667085", lineHeight: 20 },
  error: { color: "#B42318", fontWeight: "700" },
  scopeChip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  scopeChipText: { fontWeight: "700" },
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
  },
  textArea: { minHeight: 96, textAlignVertical: "top" }
});

