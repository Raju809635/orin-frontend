import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
  duration?: string;
  applicationUrl?: string;
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

const FILTERS = ["All", "Remote", "Paid", "Recommended"] as const;
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
  const [submitForm, setSubmitForm] = useState({
    title: "",
    company: "",
    role: "",
    duration: "",
    applicationUrl: "",
    description: ""
  });

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
      setError(e?.response?.data?.message || "Failed to load opportunities.");
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

  const filtered = useMemo(() => {
    if (filter === "All") return items;
    if (filter === "Recommended") return items.filter((item) => item.recommended).slice(0, 5);
    return items.filter((item) => {
      const haystack = `${item.title} ${item.role || ""} ${item.type || ""} ${item.description || ""}`.toLowerCase();
      return haystack.includes(filter.toLowerCase());
    });
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
        eyebrow="Internships"
        title="💼 Opportunities for You"
        subtitle="Make internships feel real and worth acting on. Save the best ones, review details, and apply with one clear next step."
        stats={[
          { icon: "briefcase", label: "Open Roles", value: String(items.length) },
          { icon: "sparkles", label: "Recommended", value: String(recommendedCount) },
          { icon: "cash", label: "Paid", value: String(paidCount) }
        ]}
        colors={["#4457FF", "#5867FF", "#7E74FF"]}
      />

      <CommunitySection
        title="Readiness Check"
        subtitle="Internships unlock when your roadmap and projects show enough momentum. This keeps recommendations realistic."
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
        title="Internship Listings"
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
                <StatusBadge label={item.type || "Internship"} tone="primary" />
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
                    if (item.applicationUrl) Linking.openURL(item.applicationUrl);
                    else Alert.alert("Application Link Missing", "This opportunity does not have an external application link yet.");
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
            <View style={styles.tagRow}>
              <StatusBadge label={isPaid(selected) ? "Paid" : "Unpaid / Flexible"} tone={isPaid(selected) ? "success" : "warning"} />
              <StatusBadge label={selected.duration || "Flexible duration"} tone="neutral" />
              <StatusBadge label={selected.type || "Internship"} tone="primary" />
              {selected.recommended ? <StatusBadge label="Recommended for You" tone="primary" /> : null}
            </View>
            <Text style={styles.detailText}>
              {selected.description || "This opportunity is available for students looking to build experience, strengthen their profile, and convert learning into practical growth."}
            </Text>
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
                  if (selected.applicationUrl) Linking.openURL(selected.applicationUrl);
                  else Alert.alert("Application Link Missing", "This opportunity does not have an external application link yet.");
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
          subtitle="Mentors can share real opportunities without changing the existing approval flow."
          icon="add-circle"
        >
          <TextInput style={styles.input} placeholder="Title" value={submitForm.title} onChangeText={(text) => setSubmitForm((prev) => ({ ...prev, title: text }))} />
          <TextInput style={styles.input} placeholder="Company (optional)" value={submitForm.company} onChangeText={(text) => setSubmitForm((prev) => ({ ...prev, company: text }))} />
          <TextInput style={styles.input} placeholder="Role (optional)" value={submitForm.role} onChangeText={(text) => setSubmitForm((prev) => ({ ...prev, role: text }))} />
          <TextInput style={styles.input} placeholder="Duration (optional)" value={submitForm.duration} onChangeText={(text) => setSubmitForm((prev) => ({ ...prev, duration: text }))} />
          <TextInput style={styles.input} placeholder="Application URL (optional)" value={submitForm.applicationUrl} onChangeText={(text) => setSubmitForm((prev) => ({ ...prev, applicationUrl: text }))} />
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
                  type: "internship"
                });
                Alert.alert("Submitted", "Opportunity sent to admin for review.");
                setSubmitForm({ title: "", company: "", role: "", duration: "", applicationUrl: "", description: "" });
                await load(true);
              } catch (e: any) {
                Alert.alert("Failed", e?.response?.data?.message || "Unable to submit opportunity.");
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

function isPaid(item: OpportunityItem) {
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
  requirementTitle: { color: "#B54708", fontWeight: "800" },
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
