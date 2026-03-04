import React, { useCallback, useEffect, useMemo, useState } from "react";
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
import { useFocusEffect } from "expo-router";
import { api } from "@/lib/api";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getStoredNewsLanguage, NEWS_LANGUAGES, NewsLanguageCode, setStoredNewsLanguage } from "@/utils/newsLanguage";

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
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false);
  const [language, setLanguage] = useState<NewsLanguageCode>("en");
  const [activeTab, setActiveTab] = useState<NewsCategoryKey>("tech");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

  const loadCategory = useCallback(async (category: NewsCategoryKey, refresh = false) => {
    try {
      if (refresh) setRefreshing(true);
      else setLoading((prev) => (articlesByTab[category]?.length ? prev : true));
      setError(null);
      const { data } = await api.get<{ category: string; articles: NewsArticle[] }>(
        `/api/news/${category}?limit=8&language=${language}`
      );
      setArticlesByTab((prev) => ({
        ...prev,
        [category]: data?.articles || []
      }));
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to load news.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [articlesByTab, language]);

  useFocusEffect(
    useCallback(() => {
      loadCategory(activeTab, true);
    }, [activeTab, language, loadCategory])
  );

  const activeArticles = useMemo(() => articlesByTab[activeTab] || [], [activeTab, articlesByTab]);

  return (
    <ScrollView
      contentContainerStyle={[styles.container, { paddingBottom: 88 + insets.bottom }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadCategory(activeTab, true)} />}
    >
      <Text style={styles.heading}>News & Updates</Text>
      <Text style={styles.subheading}>Career, tech, exams, scholarships, and opportunities curated daily.</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.languageWrap}>
        <Text style={styles.languageTitle}>Select Language</Text>
        <TouchableOpacity style={styles.languagePicker} onPress={() => setLanguageMenuOpen((prev) => !prev)}>
          <Text style={styles.languagePickerText}>
            {NEWS_LANGUAGES.find((item) => item.code === language)?.label || "English"}
          </Text>
          <Text style={styles.languagePickerArrow}>{languageMenuOpen ? "▲" : "▼"}</Text>
        </TouchableOpacity>
        {languageMenuOpen ? (
          <View style={styles.languageMenu}>
            {NEWS_LANGUAGES.map((item) => (
              <TouchableOpacity
                key={item.code}
                style={[styles.languageOption, language === item.code && styles.languageOptionActive]}
                onPress={async () => {
                  setLanguage(item.code);
                  setLanguageMenuOpen(false);
                  await setStoredNewsLanguage(item.code);
                  await loadCategory(activeTab, true);
                }}
              >
                <Text style={[styles.languageOptionText, language === item.code && styles.languageOptionTextActive]}>
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
              style={[styles.tabChip, active && styles.tabChipActive]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{tab.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {loading && !activeArticles.length ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="large" color="#1F7A4C" />
        </View>
      ) : null}

      {activeArticles.length === 0 && !loading ? (
        <Text style={styles.empty}>No updates found for this category.</Text>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.newsRow}>
          {activeArticles.map((item, idx) => (
            <View key={`${item.url}-${idx}`} style={styles.newsCard}>
              {item.imageUrl ? <Image source={{ uri: item.imageUrl }} style={styles.newsImage} resizeMode="cover" /> : null}
              <Text style={styles.newsTitle} numberOfLines={3}>{item.title}</Text>
              <Text style={styles.newsDesc} numberOfLines={3}>{item.description || "Tap Read More for full details."}</Text>
              <View style={styles.newsMetaRow}>
                <Text style={styles.newsSource} numberOfLines={1}>{item.source || "News Source"}</Text>
                <TouchableOpacity onPress={() => item.url && Linking.openURL(item.url)}>
                  <Text style={styles.readMore}>Read More</Text>
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
