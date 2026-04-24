import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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
  bannerImageUrl?: string;
  documentUrl?: string;
  contributorRole?: "mentor" | "student" | "admin";
  mentor?: { id?: string | null; name?: string } | null;
  submission?: {
    id: string;
    status: "submitted" | "reviewed" | "accepted" | "rejected";
    proofText?: string;
    proofLink?: string;
    proofFiles?: string[];
    submittedAt?: string | null;
    mentorReview?: {
      reviewedAt?: string | null;
      notes?: string;
      xpAwarded?: number;
      certificateId?: string | null;
    };
  } | null;
  saves?: number;
  recommended?: boolean;
  recommendationReason?: string;
  tags?: string[];
};
type LibraryResponse = {
  journey?: {
    currentStep?: string;
    focusLabel?: string;
    personalizationReason?: string;
  };
  institutionName?: string;
  institutionResources?: LibraryItem[];
  roadmapResources?: LibraryItem[];
  domainResources?: LibraryItem[];
  items?: LibraryItem[];
};

const STORAGE_KEY = "community-library-saved-v1";
const CACHE_KEY = "community-library-cache-v2";
type LibraryDrawerSection = "roadmap" | "institution" | "domain" | "recommended" | "trending" | "saved" | "recent";

function getLibraryDrawerTone(section: LibraryDrawerSection, isDark: boolean) {
  if (section === "institution") {
    return {
      accent: "#7A5AF8",
      background: isDark ? "rgba(122,90,248,0.18)" : "#F4F3FF"
    };
  }

  if (section === "domain" || section === "trending") {
    return {
      accent: "#C98A00",
      background: isDark ? "rgba(201,138,0,0.18)" : "#FFF7ED"
    };
  }

  if (section === "saved") {
    return {
      accent: "#B42318",
      background: isDark ? "rgba(180,35,24,0.18)" : "#FEF3F2"
    };
  }

  if (section === "recent") {
    return {
      accent: "#0F766E",
      background: isDark ? "rgba(15,118,110,0.18)" : "#E6F5F2"
    };
  }

  return {
    accent: "#4457FF",
    background: isDark ? "rgba(68,87,255,0.18)" : "#EEF4FF"
  };
}

export default function CommunityLibraryPage() {
  const { user } = useAuth();
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ section?: string }>();
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [institutionItems, setInstitutionItems] = useState<LibraryItem[]>([]);
  const [institutionName, setInstitutionName] = useState("");
  const [roadmapItems, setRoadmapItems] = useState<LibraryItem[]>([]);
  const [domainItems, setDomainItems] = useState<LibraryItem[]>([]);
  const [journeyMeta, setJourneyMeta] = useState<LibraryResponse["journey"] | null>(null);
  const [selectedId, setSelectedId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [drawerSection, setDrawerSection] = useState<LibraryDrawerSection>("roadmap");
  const [recentItemIds, setRecentItemIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [proofText, setProofText] = useState("");
  const [proofLink, setProofLink] = useState("");
  const [proofFiles, setProofFiles] = useState<string[]>([]);
  const [uploadingProofFile, setUploadingProofFile] = useState(false);
  const [submittingProof, setSubmittingProof] = useState(false);
  const [submitForm, setSubmitForm] = useState({
    domain: "",
    type: "other",
    title: "",
    description: "",
    url: "",
    bannerImageUrl: "",
    documentUrl: ""
  });

  useEffect(() => {
    const requestedSection = String(params.section || "").trim().toLowerCase();
    if (requestedSection === "institution") {
      setDrawerSection("institution");
    } else if (requestedSection === "domain") {
      setDrawerSection("domain");
    } else if (requestedSection === "saved") {
      setDrawerSection("saved");
    } else if (requestedSection === "recent") {
      setDrawerSection("recent");
    } else if (requestedSection === "trending") {
      setDrawerSection("trending");
    } else if (requestedSection === "recommended") {
      setDrawerSection("recommended");
    } else if (requestedSection === "roadmap") {
      setDrawerSection("roadmap");
    }
  }, [params.section]);

  const load = useCallback(async (refresh = false) => {
    try {
      if (refresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      const res = await api.get<LibraryItem[] | LibraryResponse>("/api/network/knowledge-library");
      const payload = Array.isArray(res.data) ? { items: res.data } : (res.data || {});
      const nextInstitutionItems = payload.institutionResources || [];
      const nextRoadmapItems = payload.roadmapResources || payload.items || [];
      const nextDomainItems = payload.domainResources || payload.items || [];
      const nextItems = payload.items || nextRoadmapItems || [];
      setItems(nextItems);
      setInstitutionItems(nextInstitutionItems);
      setInstitutionName(String(payload.institutionName || "").trim());
      setRoadmapItems(nextRoadmapItems);
      setDomainItems(nextDomainItems);
      setJourneyMeta(payload.journey || null);
      setSelectedId((prev) => prev || nextInstitutionItems[0]?.id || nextRoadmapItems[0]?.id || nextDomainItems[0]?.id || nextItems[0]?.id || "");
      AsyncStorage.setItem(
        CACHE_KEY,
        JSON.stringify({
          items: nextItems,
          institutionName: String(payload.institutionName || "").trim(),
          institutionResources: nextInstitutionItems,
          roadmapResources: nextRoadmapItems,
          domainResources: nextDomainItems,
          journey: payload.journey || null
        })
      ).catch(() => undefined);
    } catch (e: any) {
      const cached = await AsyncStorage.getItem(CACHE_KEY).catch(() => null);
      if (cached) {
        const parsed = JSON.parse(cached) as LibraryResponse;
        const cachedInstitutionItems = parsed.institutionResources || [];
        const cachedRoadmapItems = parsed.roadmapResources || parsed.items || [];
        const cachedDomainItems = parsed.domainResources || parsed.items || [];
        const cachedItems = parsed.items || cachedRoadmapItems || [];
        setItems(cachedItems);
        setInstitutionItems(cachedInstitutionItems);
        setInstitutionName(String(parsed.institutionName || "").trim());
        setRoadmapItems(cachedRoadmapItems);
        setDomainItems(cachedDomainItems);
        setJourneyMeta(parsed.journey || null);
        setSelectedId((prev) => prev || cachedInstitutionItems[0]?.id || cachedRoadmapItems[0]?.id || cachedDomainItems[0]?.id || cachedItems[0]?.id || "");
        setError("Showing last loaded library data.");
      } else {
        setError(getAppErrorMessage(e, "Failed to load library."));
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
      setSubmitForm((prev) => ({ ...prev, documentUrl: uploaded.url }));
    } catch (e: any) {
      handleAppError(e, { mode: "alert", title: "Upload failed", fallbackMessage: "Unable to upload document." });
    } finally {
      setUploadingDoc(false);
    }
  }

  async function uploadProofFile() {
    try {
      setUploadingProofFile(true);
      const url = await pickAndUploadPostImage();
      if (!url) return;
      setProofFiles((prev) => [...prev, url].slice(0, 4));
    } catch (e: any) {
      handleAppError(e, { mode: "alert", title: "Upload failed", fallbackMessage: "Unable to upload proof file." });
    } finally {
      setUploadingProofFile(false);
    }
  }

  async function submitResourceProof() {
    if (!selectedItem?.id) return;
    if (!proofText.trim() && !proofLink.trim() && !proofFiles.length) {
      Alert.alert("Proof required", "Add a short note, link, or proof file.");
      return;
    }
    try {
      setSubmittingProof(true);
      await api.post(`/api/network/knowledge-library/${selectedItem.id}/submissions`, {
        proofText: proofText.trim(),
        proofLink: proofLink.trim(),
        proofFiles
      });
      setProofText("");
      setProofLink("");
      setProofFiles([]);
      Alert.alert("Submitted", "Your resource proof has been sent to the mentor for review.");
      await load(true);
    } catch (e: any) {
      handleAppError(e, { mode: "alert", title: "Failed", fallbackMessage: "Unable to submit resource proof." });
    } finally {
      setSubmittingProof(false);
    }
  }

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

  const recentItems = useMemo(
    () =>
      recentItemIds
        .map((id) => [...institutionItems, ...roadmapItems, ...domainItems, ...items].find((item) => item.id === id))
        .filter(Boolean) as LibraryItem[],
    [domainItems, institutionItems, items, recentItemIds, roadmapItems]
  );

  const visibleItems = useMemo(() => {
    if (drawerSection === "institution") return institutionItems;
    if (drawerSection === "domain") return domainItems;
    if (drawerSection === "recommended") return derived.recommended;
    if (drawerSection === "trending") return derived.trending;
    if (drawerSection === "saved") return derived.savedOnly;
    if (drawerSection === "recent") return recentItems;
    return roadmapItems.length ? roadmapItems : items;
  }, [derived.recommended, derived.savedOnly, derived.trending, domainItems, drawerSection, institutionItems, items, recentItems, roadmapItems]);

  const activeSectionTitle = useMemo(() => {
    if (drawerSection === "institution") return "Institution Resource Tracks";
    if (drawerSection === "domain") return "Domain Resource Tracks";
    if (drawerSection === "recommended") return "Recommended Resources";
    if (drawerSection === "trending") return "Trending Resources";
    if (drawerSection === "saved") return "Saved Resources";
    if (drawerSection === "recent") return "Recent Library Activity";
    return "Roadmap Resource Tracks";
  }, [drawerSection]);

  const activeSectionSubtitle = useMemo(() => {
    if (drawerSection === "institution") return institutionName ? `Resources shared by your institution: ${institutionName}` : "Institution-specific learning resources.";
    if (drawerSection === "domain") return "Explore resources by selected domain focus.";
    if (drawerSection === "recommended") return "The most relevant picks for the learner right now.";
    if (drawerSection === "trending") return "Popular items students are saving and opening.";
    if (drawerSection === "saved") return "Your bookmarked learning resources.";
    if (drawerSection === "recent") return "Return quickly to the resources you opened most recently.";
    return journeyMeta?.personalizationReason || "Resources selected for your current roadmap step.";
  }, [drawerSection, institutionName, journeyMeta?.personalizationReason]);

  const activeSectionEmptyState = useMemo(() => {
    if (drawerSection === "institution") return institutionName ? `No institution resources have been added for ${institutionName} yet.` : "Add your institution in profile to unlock institution resources.";
    if (drawerSection === "domain") return "No domain resources yet. Change the domain focus or refresh the library.";
    if (drawerSection === "recommended") return "No recommended resources right now. Try roadmap or domain view first.";
    if (drawerSection === "trending") return "Nothing is trending yet. Once more learners save resources, they will appear here.";
    if (drawerSection === "saved") return "You have not saved any resources yet.";
    if (drawerSection === "recent") return "Open a resource and it will appear here for quick access.";
    return "No roadmap resources available yet. Refresh to load a new roadmap-based set.";
  }, [drawerSection, institutionName]);
  const activeDrawerTone = useMemo(() => getLibraryDrawerTone(drawerSection, isDark), [drawerSection, isDark]);

  const selectedItem = visibleItems.find((item) => item.id === selectedId) || visibleItems[0] || null;

  useEffect(() => {
    if (!visibleItems.length) {
      setSelectedId("");
      return;
    }
    if (!visibleItems.some((item) => item.id === selectedId)) {
      setSelectedId(visibleItems[0]?.id || "");
    }
  }, [selectedId, visibleItems]);

  useEffect(() => {
    setProofText(selectedItem?.submission?.proofText || "");
    setProofLink(selectedItem?.submission?.proofLink || "");
    setProofFiles(selectedItem?.submission?.proofFiles || []);
  }, [selectedItem]);

  const drawerItems = (
    <View
      style={[
        styles.drawerPanel,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          paddingTop: Math.max(insets.top, 18),
          paddingBottom: Math.max(insets.bottom, 18)
        }
      ]}
    >
      <View style={styles.drawerHeader}>
        <View>
          <Text style={[styles.drawerTitle, { color: colors.text }]}>Knowledge Library</Text>
          <Text style={[styles.drawerSub, { color: colors.textMuted }]}>Roadmap, domain, saved, and recent learning tracks</Text>
        </View>
        <TouchableOpacity style={[styles.drawerCloseBtn, { borderColor: colors.border }]} onPress={() => setDrawerVisible(false)}>
          <Ionicons name="close" size={18} color={colors.text} />
        </TouchableOpacity>
      </View>

      <View style={styles.drawerSection}>
        <Text style={[styles.drawerSectionTitle, { color: colors.textMuted }]}>Browse</Text>
        {[
          { key: "roadmap", label: "Roadmap Based", meta: journeyMeta?.currentStep ? `Current step: ${journeyMeta.currentStep}` : "Resources for your active roadmap" },
          { key: "institution", label: "Institution Resources", meta: institutionItems.length ? `${institutionItems.length} resource${institutionItems.length === 1 ? "" : "s"} from ${institutionName || "your institution"}` : institutionName ? `Resources from ${institutionName}` : "Institution-specific resources" },
          { key: "domain", label: "Domain Based", meta: journeyMeta?.focusLabel || "Resources for your selected domain focus" },
          { key: "recommended", label: "Recommended", meta: derived.recommended.length ? `${derived.recommended.length} personalized picks` : "Smart picks for the learner" },
          { key: "trending", label: "Trending", meta: derived.trending.length ? `${derived.trending.slice(0, 6).length} top library items` : "Popular resources" },
          { key: "saved", label: "Saved", meta: derived.savedOnly.length ? `${derived.savedOnly.length} saved item${derived.savedOnly.length === 1 ? "" : "s"}` : "Your bookmarks" },
          { key: "recent", label: "Recent", meta: recentItems.length ? `${recentItems.length} recently opened resource${recentItems.length === 1 ? "" : "s"}` : "Recently opened resources" }
        ].map((item: { key: LibraryDrawerSection; label: string; meta: string }) => {
          const active = drawerSection === item.key;
          return (
            <TouchableOpacity
              key={item.key}
              style={[
                styles.drawerModeRow,
                { borderColor: colors.border, backgroundColor: colors.surfaceAlt },
                active && {
                  backgroundColor: getLibraryDrawerTone(item.key, isDark).background,
                  borderColor: getLibraryDrawerTone(item.key, isDark).accent
                }
              ]}
              onPress={() => {
                setDrawerSection(item.key);
                setDrawerVisible(false);
              }}
            >
              <Ionicons
                name={
                  item.key === "institution"
                    ? "school-outline"
                    : item.key === "domain"
                    ? "globe-outline"
                    : item.key === "recommended"
                      ? "sparkles-outline"
                      : item.key === "trending"
                        ? "trending-up-outline"
                        : item.key === "saved"
                          ? "bookmark-outline"
                          : item.key === "recent"
                            ? "time-outline"
                            : "map-outline"
                }
                size={16}
                color={active ? getLibraryDrawerTone(item.key, isDark).accent : colors.textMuted}
              />
              <View style={{ flex: 1 }}>
                <Text style={[styles.drawerModeTitle, { color: colors.text }]}>{item.label}</Text>
                <Text style={[styles.drawerModeMeta, { color: colors.textMuted }]}>{item.meta}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={[styles.drawerSection, styles.drawerHistorySection]}>
        <Text style={[styles.drawerSectionTitle, { color: colors.textMuted }]}>
          {drawerSection === "saved" ? "Saved resources" : drawerSection === "recent" ? "Recent resources" : "Quick picks"}
        </Text>
        <ScrollView showsVerticalScrollIndicator={false}>
          {visibleItems.length ? (
            visibleItems.slice(0, 10).map((item) => (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.historyRow,
                  { borderColor: colors.border, backgroundColor: colors.surfaceAlt },
                  selectedId === item.id && { borderColor: activeDrawerTone.accent, backgroundColor: activeDrawerTone.background }
                ]}
                onPress={() => {
                  setSelectedId(item.id);
                  setRecentItemIds((prev) => [item.id, ...prev.filter((id) => id !== item.id)].slice(0, 12));
                  setDrawerVisible(false);
                }}
              >
                <Text style={[styles.historyTitle, { color: colors.text }]} numberOfLines={1}>{item.title}</Text>
                <Text style={[styles.historyPreview, { color: colors.textMuted }]} numberOfLines={2}>
                  {item.recommendationReason || item.description || "Guided resource ready to open"}
                </Text>
                <Text style={[styles.historyMeta, { color: colors.textMuted }]}>
                  {item.domain || item.type || "General"}
                </Text>
              </TouchableOpacity>
            ))
          ) : (
            <View style={[styles.drawerEmptyCard, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}>
              <Text style={[styles.drawerEmptyTitle, { color: colors.text }]}>Nothing here yet</Text>
              <Text style={[styles.drawerEmptyText, { color: colors.textMuted }]}>{activeSectionEmptyState}</Text>
            </View>
          )}
        </ScrollView>
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 12 : 0}
    >
      <View style={[styles.headerBar, { backgroundColor: colors.background, borderBottomColor: colors.border, paddingTop: Math.max(insets.top, 12) }]}>
        <TouchableOpacity style={[styles.headerIconBtn, { borderColor: colors.border, backgroundColor: colors.surface }]} onPress={() => setDrawerVisible(true)}>
          <Ionicons name="menu" size={18} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>{activeSectionTitle}</Text>
          <Text style={[styles.headerSub, { color: colors.textMuted }]} numberOfLines={1}>{activeSectionSubtitle}</Text>
        </View>
        <TouchableOpacity style={[styles.headerIconBtn, { borderColor: colors.border, backgroundColor: colors.surface }]} onPress={() => load(true)}>
          <Ionicons name="refresh-outline" size={18} color={colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={[styles.page, { backgroundColor: colors.background, paddingBottom: Math.max(insets.bottom, 20) + 32 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
        keyboardShouldPersistTaps="handled"
      >
      <CommunityHero
        eyebrow="Knowledge Library"
        title="Smart Learning Hub"
        subtitle="Discover guided resources, keep your best references saved, and move straight into roadmap or challenge actions."
        stats={[
          { icon: "library", label: "Resources", value: String(visibleItems.length || items.length) },
          { icon: "bookmark", label: "Saved", value: String(Object.values(saved).filter(Boolean).length) },
          { icon: "trending-up", label: "Trending", value: String(derived.trending.slice(0, 3).length) }
        ]}
        colors={["#4457FF", "#5D70FF", "#8A72FF"]}
      />

      <CommunitySection
        title="Learning Resources"
        subtitle={activeSectionSubtitle}
        icon="book"
      >
        {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
        {loading ? <ActivityIndicator size="large" color={colors.accent} /> : null}
        {!loading && !visibleItems.length ? <Text style={[styles.emptyText, { color: colors.textMuted }]}>{activeSectionEmptyState}</Text> : null}
        {visibleItems.map((item, index) => {
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
              onPress={() => {
                setSelectedId(item.id);
                setRecentItemIds((prev) => [item.id, ...prev.filter((id) => id !== item.id)].slice(0, 12));
              }}
            >
              <View style={styles.cardTopRow}>
                <View style={[styles.resourceIconWrap, { backgroundColor: categoryColor.soft }]}>
                  <Ionicons name={iconForType(item.type)} size={20} color={categoryColor.main} />
                </View>
                <View style={styles.cardTopBody}>
                  <View style={styles.inlineRow}>
                    <Text style={[styles.cardTitle, { color: colors.text }]}>{item.title}</Text>
                    {drawerSection === "trending" || index < 2 ? <StatusBadge label="Trending" tone="warning" /> : null}
                  </View>
                <Text numberOfLines={2} style={[styles.cardDescription, { color: colors.textMuted }]}>
                  {item.description || "A guided ORIN resource you can use in roadmap planning and practice."}
                </Text>
                {item.mentor?.name ? (
                  <Text style={[styles.historyMeta, { color: colors.textMuted }]}>Uploaded by {item.mentor.name}</Text>
                ) : null}
                {item.recommendationReason ? <Text style={[styles.reasonText, { color: colors.accent }]}>{item.recommendationReason}</Text> : null}
              </View>
              </View>

              <View style={styles.tagRow}>
                <StatusBadge label={item.domain || item.type || "General"} tone="primary" />
                <StatusBadge label={item.type || "Guide"} tone="neutral" />
                {item.contributorRole ? <StatusBadge label={`${item.contributorRole} submitted`} tone="neutral" /> : null}
                {item.title.toLowerCase().includes("beginner") ? <StatusBadge label="Beginner" tone="success" /> : null}
                {item.recommended ? <StatusBadge label="For You" tone="warning" /> : null}
                {(item.tags || []).slice(0, 2).map((tag) => (
                  <StatusBadge key={`${item.id}-${tag}`} label={tag} tone="neutral" />
                ))}
              </View>

              <View style={styles.pillRow}>
                <StatPill icon="bookmark" label={`${(item.saves || 0) + (saved[item.id] ? 1 : 0)} saves`} tone="#EEF2FF" />
                <StatPill icon="flash" label={drawerSection === "recommended" ? "Recommended for you" : "Ready to use"} tone="#ECFDF3" />
              </View>

              <View style={styles.actionRow}>
                <ActionButton
                  label={saved[item.id] ? "Saved" : "Save"}
                  icon={saved[item.id] ? "bookmark" : "bookmark-outline"}
                  variant="secondary"
                  onPress={() => setSaved((prev) => ({ ...prev, [item.id]: !prev[item.id] }))}
                  style={styles.flexAction}
                />
                <ActionButton
                  label="Start Learning"
                  icon="play"
                  onPress={() => {
                    setSelectedId(item.id);
                    setRecentItemIds((prev) => [item.id, ...prev.filter((id) => id !== item.id)].slice(0, 12));
                  }}
                  style={styles.flexAction}
                />
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
            {selectedItem.bannerImageUrl ? (
              <Image source={{ uri: selectedItem.bannerImageUrl }} style={styles.detailBanner} />
            ) : null}
            <Text style={[styles.detailText, { color: colors.text }]}>
              {selectedItem.description || "Use this item to strengthen your roadmap, practice a topic, or support an active challenge."}
            </Text>
            {selectedItem.mentor?.name ? (
              <Text style={[styles.detailMeta, { color: colors.textMuted }]}>Uploaded by {selectedItem.mentor.name}</Text>
            ) : null}
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
              {selectedItem.url ? (
                <ActionButton
                  label="Open Resource"
                  icon="open-outline"
                  onPress={() => openExternalLink(selectedItem.url, "Resource link missing")}
                  style={styles.flexAction}
                />
              ) : null}
              {selectedItem.documentUrl ? (
                <ActionButton
                  label="Open Document"
                  icon="document"
                  onPress={() => openExternalLink(selectedItem.documentUrl, "Document link missing")}
                  style={styles.flexAction}
                />
              ) : null}
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
            {user?.role === "student" && selectedItem.mentor?.id ? (
              <View style={{ marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.border }}>
                <Text style={[styles.detailTitle, { color: colors.text }]}>Submit Work To {selectedItem.mentor?.name || "Mentor"}</Text>
                <Text style={[styles.detailMeta, { color: colors.textMuted }]}>Your proof will go to the mentor who uploaded this resource.</Text>
                {selectedItem.submission ? (
                  <View style={styles.tagRow}>
                    <StatusBadge
                      label={`Status: ${selectedItem.submission.status}`}
                      tone={
                        selectedItem.submission.status === "accepted"
                          ? "success"
                          : selectedItem.submission.status === "rejected"
                            ? "danger"
                            : "primary"
                      }
                    />
                    {selectedItem.submission.mentorReview?.xpAwarded ? (
                      <StatusBadge label={`+${selectedItem.submission.mentorReview.xpAwarded} XP`} tone="success" />
                    ) : null}
                  </View>
                ) : null}
                {selectedItem.submission?.mentorReview?.notes ? (
                  <Text style={[styles.detailMeta, { color: colors.textMuted }]}>Mentor note: {selectedItem.submission.mentorReview.notes}</Text>
                ) : null}
                {selectedItem.submission?.status !== "accepted" ? (
                  <>
                    <TextInput
                      style={[styles.input, styles.textArea, { backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF", borderColor: colors.border, color: colors.text }]}
                      placeholder="What did you complete using this resource?"
                      placeholderTextColor={colors.textMuted}
                      value={proofText}
                      onChangeText={setProofText}
                      multiline
                    />
                    <TextInput
                      style={[styles.input, { backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF", borderColor: colors.border, color: colors.text }]}
                      placeholder="Project / GitHub / demo link (optional)"
                      placeholderTextColor={colors.textMuted}
                      value={proofLink}
                      onChangeText={setProofLink}
                      autoCapitalize="none"
                    />
                    <View style={styles.uploadRow}>
                      <TouchableOpacity style={styles.uploadBtn} onPress={uploadProofFile} disabled={uploadingProofFile}>
                        <Text style={styles.uploadBtnText}>{uploadingProofFile ? "Uploading..." : proofFiles.length ? "Add More Proof" : "Upload Proof"}</Text>
                      </TouchableOpacity>
                      {proofFiles.length ? (
                        <Text style={[styles.historyMeta, { color: colors.textMuted }]}>{proofFiles.length} file{proofFiles.length === 1 ? "" : "s"} attached</Text>
                      ) : null}
                    </View>
                    <ActionButton
                      label={submittingProof ? "Submitting..." : selectedItem.submission ? "Resubmit Proof" : "Submit Proof"}
                      icon="cloud-upload"
                      onPress={submitResourceProof}
                      disabled={submittingProof}
                    />
                  </>
                ) : null}
              </View>
            ) : null}
          </View>
        </CommunitySection>
      ) : null}

      {user?.role === "mentor" || user?.role === "student" ? (
        <CommunitySection
          title="Contribute to the Library"
          subtitle="Mentors and students can submit resources. Admin approval is required before publishing."
          icon="add-circle"
        >
          <TextInput style={[styles.input, { backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF", borderColor: colors.border, color: colors.text }]} placeholder="Domain (optional)" placeholderTextColor={colors.textMuted} value={submitForm.domain} onChangeText={(text) => setSubmitForm((prev) => ({ ...prev, domain: text }))} />
          <TextInput style={[styles.input, { backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF", borderColor: colors.border, color: colors.text }]} placeholder="Type (roadmap, interview_questions, coding_resource, career_guide, other)" placeholderTextColor={colors.textMuted} value={submitForm.type} onChangeText={(text) => setSubmitForm((prev) => ({ ...prev, type: text }))} />
          <TextInput style={[styles.input, { backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF", borderColor: colors.border, color: colors.text }]} placeholder="Title" placeholderTextColor={colors.textMuted} value={submitForm.title} onChangeText={(text) => setSubmitForm((prev) => ({ ...prev, title: text }))} />
          <TextInput style={[styles.input, styles.textArea, { backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF", borderColor: colors.border, color: colors.text }]} placeholder="Short description" placeholderTextColor={colors.textMuted} value={submitForm.description} onChangeText={(text) => setSubmitForm((prev) => ({ ...prev, description: text }))} multiline />
          <TextInput style={[styles.input, { backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF", borderColor: colors.border, color: colors.text }]} placeholder="URL (optional)" placeholderTextColor={colors.textMuted} value={submitForm.url} onChangeText={(text) => setSubmitForm((prev) => ({ ...prev, url: text }))} />
          <View style={styles.uploadRow}>
            <TouchableOpacity style={styles.uploadBtn} onPress={uploadBanner} disabled={uploadingBanner}>
              <Text style={styles.uploadBtnText}>{uploadingBanner ? "Uploading..." : submitForm.bannerImageUrl ? "Change Banner" : "Upload Banner"}</Text>
            </TouchableOpacity>
            {submitForm.bannerImageUrl ? <Image source={{ uri: submitForm.bannerImageUrl }} style={styles.bannerPreview} /> : null}
          </View>
          <View style={styles.uploadRow}>
            <TouchableOpacity style={styles.uploadBtnAlt} onPress={uploadDocument} disabled={uploadingDoc}>
              <Text style={styles.uploadBtnText}>{uploadingDoc ? "Uploading..." : submitForm.documentUrl ? "Replace Document" : "Upload Document"}</Text>
            </TouchableOpacity>
            {submitForm.documentUrl ? (
              <TouchableOpacity style={styles.docRow} onPress={() => openExternalLink(submitForm.documentUrl, "Document link missing")}>
                <Ionicons name="document-text-outline" size={18} color="#175CD3" />
                <Text style={styles.docText}>Open uploaded document</Text>
              </TouchableOpacity>
            ) : null}
          </View>
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
                  url: submitForm.url.trim(),
                  bannerImageUrl: submitForm.bannerImageUrl.trim(),
                  documentUrl: submitForm.documentUrl.trim()
                });
                Alert.alert("Submitted", "Resource sent to admin for review.");
                setSubmitForm({ domain: "", type: "other", title: "", description: "", url: "", bannerImageUrl: "", documentUrl: "" });
              } catch (e: any) {
                handleAppError(e, { mode: "alert", title: "Failed", fallbackMessage: "Unable to submit resource." });
              } finally {
                setSubmitting(false);
              }
            }}
          />
        </CommunitySection>
      ) : null}
      <Modal visible={drawerVisible} transparent animationType="slide" onRequestClose={() => setDrawerVisible(false)}>
        <View style={styles.drawerOverlay}>
          <TouchableOpacity style={styles.drawerBackdrop} activeOpacity={1} onPress={() => setDrawerVisible(false)} />
          {drawerItems}
        </View>
      </Modal>
    </ScrollView>
    </KeyboardAvoidingView>
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
  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1
  },
  headerIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  headerCenter: { flex: 1, gap: 2 },
  headerTitle: { fontSize: 18, fontWeight: "800" },
  headerSub: { fontSize: 12, fontWeight: "600" },
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
  detailBanner: {
    width: "100%",
    height: 180,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E4E7EC"
  },
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
    borderColor: "#7A5AF8",
    backgroundColor: "#F4F3FF",
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
  docRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  docText: { color: "#175CD3", fontWeight: "700" },
  textArea: { minHeight: 92, textAlignVertical: "top" },
  drawerOverlay: { flex: 1, flexDirection: "row", backgroundColor: "rgba(15, 23, 42, 0.28)" },
  drawerBackdrop: { flex: 1 },
  drawerPanel: {
    width: "84%",
    maxWidth: 360,
    borderRightWidth: 1,
    paddingHorizontal: 16,
    gap: 14
  },
  drawerHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  drawerTitle: { fontSize: 20, fontWeight: "800" },
  drawerSub: { fontSize: 12, fontWeight: "600" },
  drawerCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  drawerSection: { gap: 10 },
  drawerHistorySection: { flex: 1 },
  drawerSectionTitle: { fontSize: 12, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5 },
  drawerModeRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12
  },
  drawerModeTitle: { fontSize: 14, fontWeight: "800" },
  drawerModeMeta: { marginTop: 2, fontSize: 12, lineHeight: 18 },
  drawerEmptyCard: { borderWidth: 1, borderRadius: 14, padding: 12, gap: 6 },
  drawerEmptyTitle: { fontSize: 14, fontWeight: "800" },
  drawerEmptyText: { fontSize: 13, lineHeight: 20 },
  historyRow: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    gap: 4,
    marginBottom: 10
  },
  historyTitle: { fontSize: 14, fontWeight: "800" },
  historyPreview: { fontSize: 12, lineHeight: 18 },
  historyMeta: { fontSize: 11, fontWeight: "600" }
});
