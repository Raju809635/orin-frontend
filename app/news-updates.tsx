import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { api } from "@/lib/api";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getStoredNewsLanguage, NEWS_LANGUAGES, NewsLanguageCode, setStoredNewsLanguage } from "@/utils/newsLanguage";
import { useAppTheme } from "@/context/ThemeContext";

const NEWS_SCREEN_CACHE_MS = 5 * 60 * 1000;

type NewsCategoryKey = "tech" | "edtech" | "exams" | "scholarships" | "opportunities";

type NewsArticle = {
  title: string;
  description: string;
  imageUrl: string;
  source: string;
  url: string;
  publishedAt: string;
};

const tabs: { key: NewsCategoryKey; label: string }[] = [
  { key: "tech", label: "Tech" },
  { key: "edtech", label: "EdTech" },
  { key: "exams", label: "Govt Exams" },
  { key: "scholarships", label: "Scholarships" },
  { key: "opportunities", label: "Opportunities" }
];

export default function NewsUpdatesScreen() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useAppTheme();
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false);
  const [language, setLanguage] = useState<NewsLanguageCode>("en");
  const [activeTab, setActiveTab] = useState<NewsCategoryKey>("tech");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastFetchedRef = useRef<Record<string, number>>({});
  const [articlesByTab, setArticlesByTab] = useState<Record<NewsCategoryKey, NewsArticle[]>>({
    tech: [],
    edtech: [],
    exams: [],
    scholarships: [],
    opportunities: []
  });

  useEffect(() => {
    let mounted = true;
    getStoredNewsLanguage().then((lang) => {
      if (mounted) setLanguage(lang);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const loadCategory = useCallback(async (category: NewsCategoryKey, refresh = false, force = false) => {
    const cacheKey = `${language}:${category}`;
    const now = Date.now();
    if (!refresh && !force && articlesByTab[category]?.length && now - (lastFetchedRef.current[cacheKey] || 0) < NEWS_SCREEN_CACHE_MS) {
      return;
    }

    try {
      if (refresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      let data: { category: string; articles: NewsArticle[] } | null = null;
      try {
        const response = await api.get<{ category: string; articles: NewsArticle[] }>(
          `/api/news/${category}?limit=8&language=${language}`
        );
        data = response.data;
      } catch {
        if (language !== "en") {
          const fallbackResponse = await api.get<{ category: string; articles: NewsArticle[] }>(
            `/api/news/${category}?limit=8&language=en`
          );
          data = fallbackResponse.data;
        } else {
          throw new Error("Unable to fetch news");
        }
      }
      setArticlesByTab((prev) => ({
        ...prev,
        [category]: data?.articles || []
      }));
      lastFetchedRef.current[cacheKey] = now;
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || "Unable to load news right now.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [articlesByTab, language]);

  useEffect(() => {
    loadCategory(activeTab, false);
  }, [activeTab, language, loadCategory]);

  const activeArticles = useMemo(() => articlesByTab[activeTab] || [], [activeTab, articlesByTab]);

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[styles.container, { backgroundColor: colors.background, paddingBottom: 88 + insets.bottom }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadCategory(activeTab, true)} />}
    >
      <Text style={[styles.heading, { color: colors.text }]}>News & Updates</Text>
      <Text style={[styles.subheading, { color: colors.textMuted }]}>Career, tech, exams, scholarships, and opportunities curated daily.</Text>
      {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
      <View style={styles.languageWrap}>
        <Text style={[styles.languageTitle, { color: colors.text }]}>Select Language</Text>
        <TouchableOpacity style={[styles.languagePicker, { borderColor: colors.border, backgroundColor: colors.surface }]} onPress={() => setLanguageMenuOpen((prev) => !prev)}>
          <Text style={[styles.languagePickerText, { color: colors.text }]}>
            {NEWS_LANGUAGES.find((item) => item.code === language)?.label || "English"}
          </Text>
          <Text style={[styles.languagePickerArrow, { color: colors.textMuted }]}>{languageMenuOpen ? "^" : "v"}</Text>
        </TouchableOpacity>
        {languageMenuOpen ? (
          <View style={[styles.languageMenu, { borderColor: colors.border, backgroundColor: colors.surface }]}>
            {NEWS_LANGUAGES.map((item) => (
              <TouchableOpacity
                key={item.code}
                style={[styles.languageOption, language === item.code && [styles.languageOptionActive, { backgroundColor: colors.accentSoft }]]}
                onPress={async () => {
                  setLanguage(item.code);
                  setLanguageMenuOpen(false);
                  await setStoredNewsLanguage(item.code);
                }}
              >
                <Text style={[styles.languageOptionText, { color: colors.text }, language === item.code && [styles.languageOptionTextActive, { color: colors.accent }]]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabRow}>
        {tabs.map((tab) => {
          const active = tab.key === activeTab;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tabChip, { borderColor: colors.border, backgroundColor: colors.surface }, active && [styles.tabChipActive, { borderColor: colors.accent, backgroundColor: colors.accentSoft }]]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Text style={[styles.tabText, { color: colors.textMuted }, active && [styles.tabTextActive, { color: colors.accent }]]}>{tab.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {loading && !activeArticles.length ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : null}

      {activeArticles.length === 0 && !loading ? (
        <Text style={[styles.empty, { color: colors.textMuted }]}>No updates found for this category.</Text>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.newsRow}>
          {activeArticles.map((item, idx) => (
            <View key={`${item.url}-${idx}`} style={[styles.newsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {item.imageUrl ? <Image source={{ uri: item.imageUrl }} style={styles.newsImage} resizeMode="cover" /> : null}
              <Text style={[styles.newsTitle, { color: colors.text }]} numberOfLines={3}>{item.title}</Text>
              <Text style={[styles.newsDesc, { color: colors.textMuted }]} numberOfLines={3}>{item.description || "Tap Read More for full details."}</Text>
              <View style={styles.newsMetaRow}>
                <Text style={[styles.newsSource, { color: colors.textMuted }]} numberOfLines={1}>{item.source || "News Source"}</Text>
                <TouchableOpacity onPress={() => item.url && Linking.openURL(item.url)}>
                  <Text style={[styles.readMore, { color: isDark ? "#8AB4FF" : "#175CD3" }]}>Read More</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: "#F3F5F7", padding: 16 },
  heading: { fontSize: 26, fontWeight: "800", color: "#13251E" },
  subheading: { marginTop: 4, marginBottom: 10, color: "#475467" },
  error: { color: "#B42318", marginBottom: 8 },
  languageWrap: { marginBottom: 10 },
  languageTitle: { color: "#1E2B24", fontWeight: "700", marginBottom: 6 },
  languagePicker: {
    borderWidth: 1,
    borderColor: "#D0D5DD",
    borderRadius: 10,
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  languagePickerText: { color: "#344054", fontWeight: "600" },
  languagePickerArrow: { color: "#667085", fontWeight: "700" },
  languageMenu: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: "#E4E7EC",
    borderRadius: 10,
    backgroundColor: "#fff",
    overflow: "hidden"
  },
  languageOption: { paddingHorizontal: 12, paddingVertical: 10 },
  languageOptionActive: { backgroundColor: "#E8F5EE" },
  languageOptionText: { color: "#344054", fontWeight: "600" },
  languageOptionTextActive: { color: "#1F7A4C" },
  tabRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  tabChip: {
    borderWidth: 1,
    borderColor: "#D0D5DD",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#fff"
  },
  tabChipActive: { borderColor: "#1F7A4C", backgroundColor: "#E8F5EE" },
  tabText: { color: "#475467", fontWeight: "700", fontSize: 12 },
  tabTextActive: { color: "#1F7A4C" },
  loaderWrap: { alignItems: "center", justifyContent: "center", minHeight: 180 },
  empty: { color: "#667085", marginTop: 8 },
  newsRow: { gap: 12, paddingBottom: 6 },
  newsCard: {
    width: 296,
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E4E7EC",
    padding: 10
  },
  newsImage: { width: "100%", height: 150, borderRadius: 10, backgroundColor: "#EAECF0" },
  newsTitle: { marginTop: 8, color: "#13251E", fontWeight: "800", lineHeight: 20 },
  newsDesc: { marginTop: 6, color: "#667085", lineHeight: 18 },
  newsMetaRow: { marginTop: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  newsSource: { flex: 1, color: "#475467", fontWeight: "700", fontSize: 12 },
  readMore: { color: "#175CD3", fontWeight: "800", fontSize: 12 }
});


