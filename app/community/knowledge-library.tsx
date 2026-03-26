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
  FilterTabs,
  StatPill,
  StatusBadge
} from "@/components/community/ui";

type LibraryItem = {
  id: string;
  title: string;
  type: string;
  description?: string;
  domain?: string;
  url?: string;
  saves?: number;
  recommended?: boolean;
  recommendationReason?: string;
  tags?: string[];
};

const TABS = ["All", "Recommended", "Trending", "Saved"] as const;
const STORAGE_KEY = "community-library-saved-v1";
const CACHE_KEY = "community-library-cache-v2";

export default function CommunityLibraryPage() {
  const { user } = useAuth();
  const { colors, isDark } = useAppTheme();
  const [tab, setTab] = useState<(typeof TABS)[number]>("All");
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitForm, setSubmitForm] = useState({
    domain: "",
    type: "other",
    title: "",
    description: "",
    url: ""
  });

  const load = useCallback(async (refresh = false) => {
    try {
      if (refresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      const res = await api.get<LibraryItem[]>("/api/network/knowledge-library");
      const nextItems = res.data || [];
      setItems(nextItems);
      setSelectedId((prev) => prev || nextItems[0]?.id || "");
      AsyncStorage.setItem(CACHE_KEY, JSON.stringify(nextItems)).catch(() => undefined);
    } catch (e: any) {
      const cached = await AsyncStorage.getItem(CACHE_KEY).catch(() => null);
      if (cached) {
        const parsed = JSON.parse(cached) as LibraryItem[];
        setItems(parsed);
        setSelectedId((prev) => prev || parsed[0]?.id || "");
        setError("Showing last loaded library data.");
      } else {
        setError(e?.response?.data?.message || "Failed to load library.");
      }
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

  const selectedItem = items.find((item) => item.id === selectedId) || null;

  const derived = useMemo(() => {
    const recommended = items.filter((item, index) => {
      if (item.recommended) return true;
      const haystack = `${item.type} ${item.title} ${item.domain || ""}`.toLowerCase();
      if (user?.role === "mentor") return haystack.includes("career") || haystack.includes("guide") || index < 3;
      return haystack.includes("ai") || haystack.includes("roadmap") || index < 3;
    });
    const trending = [...items].sort((a, b) => (b.saves || 0) - (a.saves || 0));
    const savedOnly = items.filter((item) => saved[item.id]);
    return { recommended, trending, savedOnly };
  }, [items, saved, user?.role]);

  const filtered = useMemo(() => {
    if (tab === "All") return items;
    if (tab === "Recommended") return derived.recommended;
    if (tab === "Trending") return derived.trending;
    return derived.savedOnly;
  }, [derived.recommended, derived.savedOnly, derived.trending, items, tab]);

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[styles.page, { backgroundColor: colors.background }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
    >
      <CommunityHero
        eyebrow="Knowledge Library"
        title="Smart Learning Hub"
        subtitle="Discover guided resources, keep your best references saved, and move straight into roadmap or challenge actions."
        stats={[
          { icon: "library", label: "Resources", value: String(items.length) },
          { icon: "bookmark", label: "Saved", value: String(Object.values(saved).filter(Boolean).length) },
          { icon: "trending-up", label: "Trending", value: String(derived.trending.slice(0, 3).length) }
        ]}
        colors={["#4457FF", "#5D70FF", "#8A72FF"]}
      />

      <CommunitySection
        title="Discover"
        subtitle="Switch quickly between everything, recommended picks, trending material, and saved learning blocks."
        icon="compass"
      >
        <FilterTabs tabs={TABS.map((item) => ({ label: item, active: tab === item, onPress: () => setTab(item) }))} />
      </CommunitySection>

      <CommunitySection
        title="Learning Resources"
        subtitle="Each card points the learner toward the next action instead of behaving like a static list."
        icon="book"
      >
        {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
        {loading ? <ActivityIndicator size="large" color={colors.accent} /> : null}
        {!loading && !filtered.length ? <Text style={[styles.emptyText, { color: colors.textMuted }]}>Nothing in this tab yet. Save a resource or switch to another tab.</Text> : null}
        {filtered.map((item, index) => {
          const categoryColor = getCategoryTone(item);
          const isSelected = selectedId === item.id;
          return (
            <TouchableOpacity
              key={item.id}
              activeOpacity={0.95}
              style={[
                styles.resourceCard,
                { backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF", borderColor: colors.border },
                isSelected && [styles.resourceCardActive, { borderColor: colors.accent, backgroundColor: isDark ? colors.surface : "#F8FBFF" }]
              ]}
              onPress={() => setSelectedId(item.id)}
            >
              <View style={styles.cardTopRow}>
                <View style={[styles.resourceIconWrap, { backgroundColor: categoryColor.soft }]}>
                  <Ionicons name={iconForType(item.type)} size={20} color={categoryColor.main} />
                </View>
                <View style={styles.cardTopBody}>
                  <View style={styles.inlineRow}>
                    <Text style={[styles.cardTitle, { color: colors.text }]}>{item.title}</Text>
                    {tab === "Trending" || index < 2 ? <StatusBadge label="Trending" tone="warning" /> : null}
                  </View>
                  <Text numberOfLines={2} style={[styles.cardDescription, { color: colors.textMuted }]}>
                    {item.description || "A guided ORIN resource you can use in roadmap planning and practice."}
                  </Text>
                  {item.recommendationReason ? <Text style={[styles.reasonText, { color: colors.accent }]}>{item.recommendationReason}</Text> : null}
                </View>
              </View>

              <View style={styles.tagRow}>
                <StatusBadge label={item.domain || item.type || "General"} tone="primary" />
                <StatusBadge label={item.type || "Guide"} tone="neutral" />
                {item.title.toLowerCase().includes("beginner") ? <StatusBadge label="Beginner" tone="success" /> : null}
                {item.recommended ? <StatusBadge label="For You" tone="warning" /> : null}
                {(item.tags || []).slice(0, 2).map((tag) => (
                  <StatusBadge key={`${item.id}-${tag}`} label={tag} tone="neutral" />
                ))}
              </View>

              <View style={styles.pillRow}>
                <StatPill icon="bookmark" label={`${(item.saves || 0) + (saved[item.id] ? 1 : 0)} saves`} tone="#EEF2FF" />
                <StatPill icon="flash" label={tab === "Recommended" ? "Recommended for you" : "Ready to use"} tone="#ECFDF3" />
              </View>

              <View style={styles.actionRow}>
                <ActionButton
                  label={saved[item.id] ? "Saved" : "Save"}
                  icon={saved[item.id] ? "bookmark" : "bookmark-outline"}
                  variant="secondary"
                  onPress={() => setSaved((prev) => ({ ...prev, [item.id]: !prev[item.id] }))}
                  style={styles.flexAction}
                />
                <ActionButton label="Start Learning" icon="play" onPress={() => setSelectedId(item.id)} style={styles.flexAction} />
              </View>
            </TouchableOpacity>
          );
        })}
      </CommunitySection>

      {selectedItem ? (
        <CommunitySection
          title="Resource Details"
          subtitle="Make every library item lead into the next step instead of ending at a content card."
          icon="document-text"
        >
          <View style={[styles.detailCard, { backgroundColor: isDark ? colors.surfaceAlt : "#FBFBFF", borderColor: colors.border }]}>
            <View style={styles.inlineRow}>
              <View style={[styles.resourceIconWrap, { backgroundColor: getCategoryTone(selectedItem).soft }]}>
                <Ionicons name={iconForType(selectedItem.type)} size={22} color={getCategoryTone(selectedItem).main} />
              </View>
              <View style={styles.detailHead}>
                <Text style={[styles.detailTitle, { color: colors.text }]}>{selectedItem.title}</Text>
                <Text style={[styles.detailMeta, { color: colors.textMuted }]}>{selectedItem.domain || "ORIN Resource"} | {selectedItem.type || "Guide"}</Text>
              </View>
            </View>
            <Text style={[styles.detailText, { color: colors.text }]}>
              {selectedItem.description || "Use this item to strengthen your roadmap, practice a topic, or support an active challenge."}
            </Text>
            {selectedItem.recommendationReason ? <Text style={[styles.reasonText, { color: colors.accent }]}>{selectedItem.recommendationReason}</Text> : null}
            <View style={styles.pillRow}>
              <StatPill icon="git-network" label="Use in Roadmap" tone="#EEF2FF" />
              <StatPill icon="trophy" label="Practice Challenge" tone="#FFF7ED" />
            </View>
            <View style={styles.actionRow}>
              <ActionButton
                label={saved[selectedItem.id] ? "Saved" : "Save"}
                icon={saved[selectedItem.id] ? "bookmark" : "bookmark-outline"}
                variant="secondary"
                onPress={() => setSaved((prev) => ({ ...prev, [selectedItem.id]: !prev[selectedItem.id] }))}
                style={styles.flexAction}
              />
              <ActionButton
                label="Use in Roadmap"
                icon="trail-sign"
                onPress={() => Alert.alert("Roadmap Ready", "This resource is now framed as a roadmap support item in the UI. We can wire a deeper roadmap bridge next if you want.")}
                style={styles.flexAction}
              />
            </View>
            <ActionButton
              label="Practice Challenge"
              icon="rocket"
              variant="ghost"
              onPress={() => Alert.alert("Practice Challenge", "This CTA is ready. We can next connect it directly to the challenge flow if you want that bridge too.")}
            />
          </View>
        </CommunitySection>
      ) : null}

      {user?.role === "mentor" ? (
        <CommunitySection
          title="Contribute to the Library"
          subtitle="Mentors can submit stronger resources for admin approval without changing the existing review flow."
          icon="add-circle"
        >
          <TextInput style={[styles.input, { backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF", borderColor: colors.border, color: colors.text }]} placeholder="Domain (optional)" placeholderTextColor={colors.textMuted} value={submitForm.domain} onChangeText={(text) => setSubmitForm((prev) => ({ ...prev, domain: text }))} />
          <TextInput style={[styles.input, { backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF", borderColor: colors.border, color: colors.text }]} placeholder="Type (roadmap, interview_questions, coding_resource, career_guide, other)" placeholderTextColor={colors.textMuted} value={submitForm.type} onChangeText={(text) => setSubmitForm((prev) => ({ ...prev, type: text }))} />
          <TextInput style={[styles.input, { backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF", borderColor: colors.border, color: colors.text }]} placeholder="Title" placeholderTextColor={colors.textMuted} value={submitForm.title} onChangeText={(text) => setSubmitForm((prev) => ({ ...prev, title: text }))} />
          <TextInput style={[styles.input, styles.textArea, { backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF", borderColor: colors.border, color: colors.text }]} placeholder="Short description" placeholderTextColor={colors.textMuted} value={submitForm.description} onChangeText={(text) => setSubmitForm((prev) => ({ ...prev, description: text }))} multiline />
          <TextInput style={[styles.input, { backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF", borderColor: colors.border, color: colors.text }]} placeholder="URL (optional)" placeholderTextColor={colors.textMuted} value={submitForm.url} onChangeText={(text) => setSubmitForm((prev) => ({ ...prev, url: text }))} />
          <ActionButton
            label={submitting ? "Submitting..." : "Submit for Review"}
            icon="send"
            disabled={submitting}
            onPress={async () => {
              try {
                if (!submitForm.title.trim()) {
                  Alert.alert("Title required", "Please enter a title for the resource.");
                  return;
                }
                setSubmitting(true);
                await api.post("/api/network/knowledge-library/submit", {
                  domain: submitForm.domain.trim(),
                  type: submitForm.type.trim() || "other",
                  title: submitForm.title.trim(),
                  description: submitForm.description.trim(),
                  url: submitForm.url.trim()
                });
                Alert.alert("Submitted", "Resource sent to admin for review.");
                setSubmitForm({ domain: "", type: "other", title: "", description: "", url: "" });
              } catch (e: any) {
                Alert.alert("Failed", e?.response?.data?.message || "Unable to submit resource.");
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

function getCategoryTone(item: { type?: string; domain?: string; title?: string }) {
  const haystack = `${item.type || ""} ${item.domain || ""} ${item.title || ""}`.toLowerCase();
  if (haystack.includes("ai")) return { main: "#4457FF", soft: "#EEF2FF" };
  if (haystack.includes("web")) return { main: "#1F7A4C", soft: "#ECFDF3" };
  if (haystack.includes("career")) return { main: "#B54708", soft: "#FFF7ED" };
  if (haystack.includes("interview")) return { main: "#B42318", soft: "#FEF3F2" };
  return { main: "#7A5AF8", soft: "#F4F3FF" };
}

function iconForType(type?: string) {
  const haystack = (type || "").toLowerCase();
  if (haystack.includes("roadmap")) return "map";
  if (haystack.includes("interview")) return "chatbubble-ellipses";
  if (haystack.includes("career")) return "briefcase";
  if (haystack.includes("coding")) return "code-slash";
  return "document-text";
}

const styles = StyleSheet.create({
  page: { padding: 16, backgroundColor: "#F4F7FB", gap: 14 },
  error: { color: "#B42318", fontWeight: "700" },
  emptyText: { color: "#667085", lineHeight: 20 },
  resourceCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E4E7EC",
    backgroundColor: "#FFFFFF",
    padding: 14,
    gap: 12
  },
  resourceCardActive: { borderColor: "#7A5AF8", shadowColor: "#7A5AF8", shadowOpacity: 0.08, shadowRadius: 12, elevation: 2 },
  cardTopRow: { flexDirection: "row", gap: 12 },
  resourceIconWrap: {
    width: 50,
    height: 50,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center"
  },
  cardTopBody: { flex: 1, gap: 6 },
  inlineRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  cardTitle: { flex: 1, color: "#101828", fontWeight: "800", fontSize: 16 },
  cardDescription: { color: "#475467", lineHeight: 20 },
  reasonText: { color: "#4457FF", fontWeight: "700", lineHeight: 18 },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pillRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  actionRow: { flexDirection: "row", gap: 8 },
  flexAction: { flex: 1 },
  detailCard: {
    borderRadius: 18,
    padding: 14,
    backgroundColor: "#FBFBFF",
    borderWidth: 1,
    borderColor: "#E4E7EC",
    gap: 12
  },
  detailHead: { flex: 1, gap: 4 },
  detailTitle: { color: "#101828", fontWeight: "800", fontSize: 18 },
  detailMeta: { color: "#667085", fontWeight: "600" },
  detailText: { color: "#475467", lineHeight: 20 },
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
