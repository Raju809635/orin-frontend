import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
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
import { pickAndUploadProgramDocument } from "@/utils/programDocumentUpload";
import { useAuth } from "@/context/AuthContext";
import { useAppTheme } from "@/context/ThemeContext";
import {
  ActionButton,
  CommunityHero,
  CommunitySection,
  FilterTabs,
  ProgressBar,
  StatPill,
  StatusBadge
} from "@/components/community/ui";

type OpportunityItem = {
  _id: string;
  title: string;
  company?: string;
  role?: string;
  type?: string;
  category?: "workshop" | "internship" | "hackathon" | string;
  duration?: string;
  applicationUrl?: string;
  bannerImageUrl?: string;
  supportingDocuments?: string[];
  isPaid?: boolean;
  eventDate?: string;
  isActive?: boolean;
  description?: string;
  location?: string;
  recommended?: boolean;
  readinessUnlocked?: boolean;
  readinessScore?: number;
  roadmapProgress?: number;
  completedProjectCount?: number;
  recommendationReason?: string;
  readinessHint?: string;
};

const FILTERS = ["All", "Workshops", "Internships", "Hackathons", "Paid", "Recommended"] as const;
const STORAGE_KEY = "community-opportunity-saved-v1";

export default function CommunityOpportunitiesPage() {
  const { user } = useAuth();
  const { colors, isDark } = useAppTheme();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");
  const [items, setItems] = useState<OpportunityItem[]>([]);
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [submitForm, setSubmitForm] = useState({
    title: "",
    company: "",
    role: "",
    duration: "",
    applicationUrl: "",
    description: "",
    category: "internship",
    bannerImageUrl: "",
    eventDate: "",
    supportingDocuments: [] as string[],
    isPaid: false
  });
  const [docInput, setDocInput] = useState("");

  const load = useCallback(async (refresh = false) => {
    try {
      if (refresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      const res = await api.get<OpportunityItem[]>("/api/network/opportunities");
      const nextItems = res.data || [];
      setItems(nextItems);
      setSelectedId((prev) => prev || nextItems[0]?._id || "");
    } catch (e: any) {
      setError(getAppErrorMessage(e, "Failed to load opportunities."));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((value) => {
        if (value) setSaved(JSON.parse(value));
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(saved)).catch(() => undefined);
  }, [saved]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

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

  async function uploadDocument() {
    try {
      setUploadingDoc(true);
      const uploaded = await pickAndUploadProgramDocument();
      if (!uploaded?.url) return;
      setSubmitForm((prev) => ({ ...prev, supportingDocuments: [...prev.supportingDocuments, uploaded.url].slice(0, 4) }));
    } catch (e: any) {
      handleAppError(e, { mode: "alert", title: "Upload failed", fallbackMessage: "Unable to upload document." });
    } finally {
      setUploadingDoc(false);
    }
  }

  function addDocumentLink() {
    const normalized = normalizeLink(docInput);
    if (!normalized) {
      Alert.alert("Invalid link", "Paste a valid document URL.");
      return;
    }
    setSubmitForm((prev) => ({ ...prev, supportingDocuments: [...prev.supportingDocuments, normalized].slice(0, 4) }));
    setDocInput("");
  }

  const filtered = useMemo(() => {
    if (filter === "All") return items;
    if (filter === "Recommended") return items.filter((item) => item.recommended).slice(0, 5);
    if (filter === "Paid") return items.filter((item) => isPaid(item));
    const categoryMap: Record<string, string> = {
      Workshops: "workshop",
      Internships: "internship",
      Hackathons: "hackathon"
    };
    const target = categoryMap[filter] || "";
    return items.filter((item) => String(item.category || item.type || "").toLowerCase().includes(target));
  }, [filter, items]);

  const selected = items.find((item) => item._id === selectedId) || null;
  const recommendedCount = items.filter((item) => item.recommended).length;
  const paidCount = items.filter((item) => isPaid(item)).length;
  const readinessUnlocked = selected?.readinessUnlocked ?? items[0]?.readinessUnlocked ?? false;
  const readinessScore = selected?.readinessScore ?? items[0]?.readinessScore ?? 0;
  const readinessHint = selected?.readinessHint || items[0]?.readinessHint || "";

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[styles.page, { backgroundColor: colors.background }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
    >
      <CommunityHero
        eyebrow="Opportunities"
        title="💼 Opportunities for You"
        subtitle="Workshops, internships, and hackathons — save the best ones, review details, and apply with one clear next step."
        stats={[
          { icon: "briefcase", label: "Open Roles", value: String(items.length) },
          { icon: "sparkles", label: "Recommended", value: String(recommendedCount) },
          { icon: "cash", label: "Paid", value: String(paidCount) }
        ]}
        colors={["#4457FF", "#5867FF", "#7E74FF"]}
      />

      <CommunitySection
        title="Readiness Check"
        subtitle="Opportunities unlock when your roadmap and projects show enough momentum. This keeps recommendations realistic."
        icon="analytics"
      >
        <View style={[styles.readinessCard, readinessUnlocked ? styles.readinessCardReady : styles.readinessCardLocked]}>
          <View style={styles.inlineRow}>
            <StatusBadge
              label={readinessUnlocked ? "Internship Ready" : "Prepare First"}
              tone={readinessUnlocked ? "success" : "warning"}
            />
            <Text style={styles.readinessScore}>{readinessScore}% ready</Text>
          </View>
          <ProgressBar progress={Math.max(8, Math.min(100, readinessScore))} tone={readinessUnlocked ? "#12B76A" : "#F79009"} />
          <Text style={styles.readinessTitle}>
            {readinessUnlocked ? "You can start applying for role-fit opportunities now." : "You are still building toward internship readiness."}
          </Text>
          <Text style={styles.readinessText}>
            {readinessHint || "Complete roadmap steps and finish at least one meaningful project to unlock stronger opportunities."}
          </Text>
          <View style={styles.pillRow}>
            <StatPill icon="map" label={`${selected?.roadmapProgress ?? items[0]?.roadmapProgress ?? 0}% roadmap`} tone="#EEF2FF" />
            <StatPill
              icon="rocket"
              label={`${selected?.completedProjectCount ?? items[0]?.completedProjectCount ?? 0} project${(selected?.completedProjectCount ?? items[0]?.completedProjectCount ?? 0) === 1 ? "" : "s"}`}
              tone="#ECFDF3"
            />
          </View>
        </View>
      </CommunitySection>

      <CommunitySection
        title="Browse Opportunities"
        subtitle="Short filters keep the screen fast. The UI stays focused on action instead of long lists."
        icon="funnel"
      >
        <FilterTabs tabs={FILTERS.map((item) => ({ label: item, active: filter === item, onPress: () => setFilter(item) }))} />
      </CommunitySection>

      <CommunitySection
        title="Opportunity Listings"
        subtitle="Each card highlights role, company, fit, and the next action to take."
        icon="rocket"
      >
        {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
        {loading ? <ActivityIndicator size="large" color={colors.accent} /> : null}
        {!loading && !filtered.length ? <Text style={[styles.emptyText, { color: colors.textMuted }]}>No opportunities match this filter right now.</Text> : null}
        {filtered.map((item, index) => {
          const recommended = !!item.recommended;
          const canApply = item.readinessUnlocked !== false;
          return (
            <TouchableOpacity
              key={item._id}
              activeOpacity={0.95}
              style={[
                styles.jobCard,
                { backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF", borderColor: colors.border },
                selectedId === item._id && [styles.jobCardActive, { borderColor: colors.accent, backgroundColor: isDark ? colors.surface : "#F8FBFF" }]
              ]}
              onPress={() => setSelectedId(item._id)}
            >
              <View style={styles.cardTopRow}>
                <View style={styles.companyIcon}>
                  <Text style={styles.companyInitial}>{(item.company || "O").charAt(0).toUpperCase()}</Text>
                </View>
                <View style={styles.jobBody}>
                  <View style={styles.inlineRow}>
                    <Text style={[styles.jobTitle, { color: colors.text }]}>{item.role || item.title}</Text>
                    {recommended ? <StatusBadge label="Recommended" tone="primary" /> : null}
                    {!canApply ? <StatusBadge label="Prepare First" tone="warning" /> : null}
                  </View>
                  <Text style={styles.jobMeta}>{item.company || "ORIN Network"} • {item.location || deriveLocation(item)}</Text>
                </View>
              </View>

              <View style={styles.tagRow}>
                <StatusBadge label={isPaid(item) ? "Paid" : "Unpaid / Flexible"} tone={isPaid(item) ? "success" : "warning"} />
                <StatusBadge label={item.duration || "Flexible duration"} tone="neutral" />
                <StatusBadge label={(item.category || item.type || "Internship").toString()} tone="primary" />
              </View>

              <View style={styles.pillRow}>
                <StatPill icon="sparkles" label={recommended ? "High fit" : "Open match"} tone="#EEF2FF" />
                <StatPill icon="flash" label={saved[item._id] ? "Saved for later" : "Act this week"} tone="#FFF7ED" />
                <StatPill icon="analytics" label={`${item.readinessScore ?? 0}% ready`} tone="#ECFDF3" />
              </View>
              {item.recommendationReason ? <Text style={styles.reasonText}>{item.recommendationReason}</Text> : null}

              <View style={styles.actionRow}>
                <ActionButton
                  label={saved[item._id] ? "Saved" : "Save"}
                  icon={saved[item._id] ? "bookmark" : "bookmark-outline"}
                  variant="secondary"
                  onPress={() => setSaved((prev) => ({ ...prev, [item._id]: !prev[item._id] }))}
                  style={styles.flexAction}
                />
                <ActionButton
                  label={canApply ? "Apply" : "Prepare"}
                  icon="arrow-forward"
                  onPress={() => {
                    if (!canApply) {
                      Alert.alert("Keep building", item.readinessHint || "Complete your roadmap and finish a project before applying.");
                      return;
                    }
                    openExternalLink(item.applicationUrl, "Application Link Missing");
                  }}
                  style={styles.flexAction}
                />
              </View>
            </TouchableOpacity>
          );
        })}
      </CommunitySection>

      {selected ? (
        <CommunitySection
          title="Opportunity Details"
          subtitle="This detail panel makes internships feel valuable instead of buried inside a list."
          icon="document-lock"
        >
          <View style={styles.detailCard}>
            <View style={styles.inlineRow}>
              <View style={styles.companyIconLarge}>
                <Text style={styles.companyInitialLarge}>{(selected.company || "O").charAt(0).toUpperCase()}</Text>
              </View>
              <View style={styles.detailHead}>
                <Text style={styles.detailTitle}>{selected.role || selected.title}</Text>
                <Text style={styles.detailMeta}>{selected.company || "ORIN Network"} • {selected.location || deriveLocation(selected)}</Text>
              </View>
            </View>
            {selected.bannerImageUrl ? (
              <Image source={{ uri: selected.bannerImageUrl }} style={styles.detailBanner} />
            ) : null}
            <View style={styles.tagRow}>
              <StatusBadge label={isPaid(selected) ? "Paid" : "Unpaid / Flexible"} tone={isPaid(selected) ? "success" : "warning"} />
              <StatusBadge label={selected.duration || "Flexible duration"} tone="neutral" />
              <StatusBadge label={(selected.category || selected.type || "Internship").toString()} tone="primary" />
              {selected.recommended ? <StatusBadge label="Recommended for You" tone="primary" /> : null}
              {selected.eventDate ? <StatusBadge label={`Date: ${selected.eventDate}`} tone="neutral" /> : null}
            </View>
            <Text style={styles.detailText}>
              {selected.description || "This opportunity is available for students looking to build experience, strengthen their profile, and convert learning into practical growth."}
            </Text>
            {Array.isArray(selected.supportingDocuments) && selected.supportingDocuments.length > 0 ? (
              <View style={styles.docList}>
                <Text style={styles.docTitle}>Supporting documents</Text>
                {selected.supportingDocuments.map((doc, index) => (
                  <TouchableOpacity key={`${selected._id}-doc-${index}`} style={styles.docRow} onPress={() => openExternalLink(doc, "Document link missing")}>
                    <Ionicons name="document-text-outline" size={18} color="#175CD3" />
                    <Text style={styles.docText}>Open document {index + 1}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}
            {selected.recommendationReason ? <Text style={styles.reasonText}>{selected.recommendationReason}</Text> : null}
            <View style={styles.requirementCard}>
              <Text style={styles.requirementTitle}>What this role grows</Text>
              <ProgressBar progress={selected.applicationUrl ? 72 : 48} tone="#F79009" />
              <View style={styles.pillRow}>
                <StatPill icon="person" label="Profile growth" tone="#ECFDF3" />
                <StatPill icon="briefcase" label="Experience boost" tone="#EEF2FF" />
                <StatPill icon="trending-up" label="Better placement readiness" tone="#FFF7ED" />
              </View>
            </View>
            <View style={[styles.readinessCard, selected.readinessUnlocked !== false ? styles.readinessCardReady : styles.readinessCardLocked]}>
              <View style={styles.inlineRow}>
                <StatusBadge
                  label={selected.readinessUnlocked !== false ? "Ready to Apply" : "Preparation Needed"}
                  tone={selected.readinessUnlocked !== false ? "success" : "warning"}
                />
                <Text style={styles.readinessScore}>{selected.readinessScore ?? 0}% ready</Text>
              </View>
              <ProgressBar progress={Math.max(8, Math.min(100, selected.readinessScore ?? 0))} tone={selected.readinessUnlocked !== false ? "#12B76A" : "#F79009"} />
              <Text style={styles.readinessText}>
                {selected.readinessUnlocked !== false
                  ? "Your current roadmap progress and project proof suggest you can start applying."
                  : selected.readinessHint || "Finish roadmap steps and one project to unlock stronger internship matches."}
              </Text>
            </View>
            <View style={styles.actionRow}>
              <ActionButton
                label={saved[selected._id] ? "Saved" : "Save"}
                icon={saved[selected._id] ? "bookmark" : "bookmark-outline"}
                variant="secondary"
                onPress={() => setSaved((prev) => ({ ...prev, [selected._id]: !prev[selected._id] }))}
                style={styles.flexAction}
              />
              <ActionButton
                label={selected.readinessUnlocked !== false ? "Apply Now" : "Prepare First"}
                icon="send"
                onPress={() => {
                  if (selected.readinessUnlocked === false) {
                    Alert.alert("Not ready yet", selected.readinessHint || "Keep progressing through your roadmap and complete a project first.");
                    return;
                  }
                  openExternalLink(selected.applicationUrl, "Application Link Missing");
                }}
                style={styles.flexAction}
              />
            </View>
          </View>
        </CommunitySection>
      ) : null}

      {user?.role === "mentor" ? (
        <CommunitySection
          title="Submit an Opportunity"
          subtitle="Mentors can share real opportunities. Admin approval is required before publishing."
          icon="add-circle"
        >
          <Text style={styles.label}>Category</Text>
          <View style={styles.choiceRow}>
            {["internship", "workshop", "hackathon"].map((option) => {
              const active = submitForm.category === option;
              return (
                <TouchableOpacity
                  key={option}
                  style={[styles.choiceChip, active && styles.choiceChipActive]}
                  onPress={() => setSubmitForm((prev) => ({ ...prev, category: option }))}
                >
                  <Text style={[styles.choiceText, active && styles.choiceTextActive]}>
                    {option.charAt(0).toUpperCase() + option.slice(1)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.choiceRow}>
            <TouchableOpacity
              style={[styles.choiceChip, submitForm.isPaid && styles.choiceChipActive]}
              onPress={() => setSubmitForm((prev) => ({ ...prev, isPaid: !prev.isPaid }))}
            >
              <Text style={[styles.choiceText, submitForm.isPaid && styles.choiceTextActive]}>
                {submitForm.isPaid ? "Paid" : "Free"}
              </Text>
            </TouchableOpacity>
          </View>

          <TextInput style={styles.input} placeholder="Title" value={submitForm.title} onChangeText={(text) => setSubmitForm((prev) => ({ ...prev, title: text }))} />
          <TextInput style={styles.input} placeholder="Company (optional)" value={submitForm.company} onChangeText={(text) => setSubmitForm((prev) => ({ ...prev, company: text }))} />
          <TextInput style={styles.input} placeholder="Role (optional)" value={submitForm.role} onChangeText={(text) => setSubmitForm((prev) => ({ ...prev, role: text }))} />
          <TextInput style={styles.input} placeholder="Duration (optional)" value={submitForm.duration} onChangeText={(text) => setSubmitForm((prev) => ({ ...prev, duration: text }))} />
          <View style={styles.uploadRow}>
            <TouchableOpacity style={styles.uploadBtn} onPress={uploadBanner} disabled={uploadingBanner}>
              <Text style={styles.uploadBtnText}>{uploadingBanner ? "Uploading..." : submitForm.bannerImageUrl ? "Change Banner" : "Upload Banner"}</Text>
            </TouchableOpacity>
            {submitForm.bannerImageUrl ? <Image source={{ uri: submitForm.bannerImageUrl }} style={styles.bannerPreview} /> : null}
          </View>
          <TextInput style={styles.input} placeholder="Event date (YYYY-MM-DD) optional" value={submitForm.eventDate} onChangeText={(text) => setSubmitForm((prev) => ({ ...prev, eventDate: text }))} />
          <TextInput style={styles.input} placeholder="Application URL (optional)" value={submitForm.applicationUrl} onChangeText={(text) => setSubmitForm((prev) => ({ ...prev, applicationUrl: text }))} />
          <View style={styles.uploadRow}>
            <TouchableOpacity style={styles.uploadBtnAlt} onPress={uploadDocument} disabled={uploadingDoc}>
              <Text style={styles.uploadBtnText}>{uploadingDoc ? "Uploading..." : "Upload Supporting Document"}</Text>
            </TouchableOpacity>
            <View style={styles.linkRow}>
              <TextInput
                style={[styles.input, styles.linkInput]}
                placeholder="Or paste document link"
                value={docInput}
                onChangeText={setDocInput}
                autoCapitalize="none"
              />
              <TouchableOpacity style={styles.linkAddBtn} onPress={addDocumentLink}>
                <Ionicons name="add" size={18} color="#175CD3" />
              </TouchableOpacity>
            </View>
            {submitForm.supportingDocuments.length ? (
              <View style={styles.docList}>
                {submitForm.supportingDocuments.map((doc, index) => (
                  <TouchableOpacity
                    key={`doc-${index}`}
                    style={styles.docRow}
                    onPress={() => openExternalLink(doc, "Document link missing")}
                  >
                    <Ionicons name="document-text-outline" size={18} color="#175CD3" />
                    <Text style={styles.docText}>Document {index + 1}</Text>
                    <TouchableOpacity onPress={() => setSubmitForm((prev) => ({ ...prev, supportingDocuments: prev.supportingDocuments.filter((_, i) => i !== index) }))}>
                      <Ionicons name="close" size={16} color="#B42318" />
                    </TouchableOpacity>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}
          </View>
          <TextInput style={[styles.input, styles.textArea]} placeholder="Short description (optional)" value={submitForm.description} onChangeText={(text) => setSubmitForm((prev) => ({ ...prev, description: text }))} multiline />
          <ActionButton
            label={submitting ? "Submitting..." : "Submit for Review"}
            icon="send"
            disabled={submitting}
            onPress={async () => {
              try {
                if (!submitForm.title.trim()) {
                  Alert.alert("Title required", "Please enter an opportunity title.");
                  return;
                }
                setSubmitting(true);
                await api.post("/api/network/opportunities/submit", {
                  title: submitForm.title.trim(),
                  company: submitForm.company.trim(),
                  role: submitForm.role.trim(),
                  duration: submitForm.duration.trim(),
                  applicationUrl: submitForm.applicationUrl.trim(),
                  description: submitForm.description.trim(),
                  type: submitForm.category || "internship",
                  category: submitForm.category || "internship",
                  bannerImageUrl: submitForm.bannerImageUrl.trim(),
                  eventDate: submitForm.eventDate.trim(),
                  supportingDocuments: submitForm.supportingDocuments,
                  isPaid: submitForm.isPaid
                });
                Alert.alert("Submitted", "Opportunity sent to admin for review.");
                setSubmitForm({
                  title: "",
                  company: "",
                  role: "",
                  duration: "",
                  applicationUrl: "",
                  description: "",
                  category: "internship",
                  bannerImageUrl: "",
                  eventDate: "",
                  supportingDocuments: [],
                  isPaid: false
                });
                setDocInput("");
                await load(true);
              } catch (e: any) {
                handleAppError(e, { mode: "alert", title: "Failed", fallbackMessage: "Unable to submit opportunity." });
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

function normalizeLink(rawUrl: string) {
  const cleaned = String(rawUrl || "").trim().replace(/[),.;!?]+$/, "");
  if (!cleaned) return "";
  if (/^https?:\/\//i.test(cleaned)) return cleaned;
  return `https://${cleaned}`;
}

function openExternalLink(url?: string, missingTitle = "Link Missing") {
  const normalized = normalizeLink(url || "");
  if (!normalized) {
    Alert.alert(missingTitle, "This item does not have a valid link yet.");
    return;
  }
  Linking.openURL(normalized).catch(() => {
    Alert.alert("Unable to open link", normalized);
  });
}

function isPaid(item: OpportunityItem) {
  if (typeof item.isPaid === "boolean") return item.isPaid;
  const haystack = `${item.title} ${item.role || ""} ${item.type || ""} ${item.description || ""}`.toLowerCase();
  return haystack.includes("paid") || haystack.includes("stipend");
}

function deriveLocation(item: OpportunityItem) {
  const haystack = `${item.title} ${item.role || ""} ${item.type || ""}`.toLowerCase();
  return haystack.includes("remote") ? "Remote" : "Onsite / Hybrid";
}

const styles = StyleSheet.create({
  page: { padding: 16, backgroundColor: "#F4F7FB", gap: 14 },
  error: { color: "#B42318", fontWeight: "700" },
  emptyText: { color: "#667085", lineHeight: 20 },
  jobCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E4E7EC",
    backgroundColor: "#FFFFFF",
    padding: 14,
    gap: 12
  },
  jobCardActive: { borderColor: "#4457FF", shadowColor: "#4457FF", shadowOpacity: 0.08, shadowRadius: 12, elevation: 2 },
  cardTopRow: { flexDirection: "row", gap: 12 },
  companyIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: "#EEF2FF",
    alignItems: "center",
    justifyContent: "center"
  },
  companyInitial: { color: "#4457FF", fontWeight: "800", fontSize: 20 },
  companyInitialLarge: { color: "#4457FF", fontWeight: "800", fontSize: 26 },
  jobBody: { flex: 1, gap: 4 },
  inlineRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  jobTitle: { flex: 1, color: "#101828", fontWeight: "800", fontSize: 16 },
  jobMeta: { color: "#667085", fontWeight: "600" },
  reasonText: { color: "#475467", lineHeight: 20, fontWeight: "600" },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pillRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  actionRow: { flexDirection: "row", gap: 8 },
  flexAction: { flex: 1 },
  readinessCard: {
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    gap: 10
  },
  readinessCardReady: {
    backgroundColor: "#ECFDF3",
    borderColor: "#ABEFC6"
  },
  readinessCardLocked: {
    backgroundColor: "#FFF7ED",
    borderColor: "#F9DBAF"
  },
  readinessTitle: { color: "#101828", fontWeight: "800", fontSize: 16 },
  readinessScore: { color: "#344054", fontWeight: "800" },
  readinessText: { color: "#475467", lineHeight: 20 },
  detailCard: {
    borderRadius: 18,
    padding: 14,
    backgroundColor: "#FBFBFF",
    borderWidth: 1,
    borderColor: "#E4E7EC",
    gap: 12
  },
  companyIconLarge: {
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: "#EEF2FF",
    alignItems: "center",
    justifyContent: "center"
  },
  detailHead: { flex: 1, gap: 4 },
  detailTitle: { color: "#101828", fontWeight: "800", fontSize: 18 },
  detailMeta: { color: "#667085", fontWeight: "600" },
  detailText: { color: "#475467", lineHeight: 20 },
  requirementCard: {
    borderRadius: 16,
    padding: 12,
    backgroundColor: "#FFF7ED",
    borderWidth: 1,
    borderColor: "#F9DBAF",
    gap: 10
  },
  docList: { gap: 8 },
  docTitle: { color: "#475467", fontWeight: "700" },
  docRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  docText: { color: "#175CD3", fontWeight: "700" },
  requirementTitle: { color: "#B54708", fontWeight: "800" },
  label: { color: "#344054", fontWeight: "700" },
  choiceRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  choiceChip: {
    borderWidth: 1,
    borderColor: "#D0D5DD",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#FFFFFF"
  },
  choiceChipActive: {
    borderColor: "#4457FF",
    backgroundColor: "#EEF2FF"
  },
  choiceText: { color: "#475467", fontWeight: "700" },
  choiceTextActive: { color: "#4457FF", fontWeight: "800" },
  input: {
    borderWidth: 1,
    borderColor: "#D0D5DD",
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 11
  },
  uploadRow: { gap: 8 },
  uploadBtn: {
    borderWidth: 1,
    borderColor: "#4457FF",
    backgroundColor: "#EEF2FF",
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center"
  },
  uploadBtnAlt: {
    borderWidth: 1,
    borderColor: "#175CD3",
    backgroundColor: "#EFF8FF",
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center"
  },
  uploadBtnText: { color: "#344054", fontWeight: "800" },
  bannerPreview: { width: "100%", height: 140, borderRadius: 14, borderWidth: 1, borderColor: "#E4E7EC" },
  linkRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  linkInput: { flex: 1 },
  linkAddBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#D0D5DD",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF"
  },
  textArea: { minHeight: 92, textAlignVertical: "top" },
  detailBanner: {
    width: "100%",
    height: 180,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E4E7EC"
  }
});
