import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

type LibraryItem = { id: string; title: string; type: string; description?: string };

const CATEGORIES = ["All", "AI", "Web", "Career", "Interview Prep"];

export default function CommunityLibraryPage() {
  const { user } = useAuth();
  const [category, setCategory] = useState("All");
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [items, setItems] = useState<LibraryItem[]>([]);
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
      if (refresh) setRefreshing(true); else setLoading(true);
      setError(null);
      const res = await api.get<LibraryItem[]>("/api/network/knowledge-library");
      setItems(res.data || []);
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to load library.");
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const filtered = useMemo(() => {
    if (category === "All") return items;
    return items.filter((x) => `${x.type} ${x.title}`.toLowerCase().includes(category.toLowerCase()));
  }, [items, category]);

  return (
    <ScrollView contentContainerStyle={styles.page} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}>
      <Text style={styles.pageTitle}>Knowledge Library</Text>
      <Text style={styles.pageSub}>Explore categorized guides, resources, and prep material.</Text>

      <View style={styles.section}><View style={styles.sectionHeader}><Ionicons name="library" size={16} color="#1F7A4C" /><Text style={styles.sectionTitle}>Categories</Text></View><View style={styles.chips}>{CATEGORIES.map((c) => <TouchableOpacity key={c} style={[styles.chip, category===c && styles.chipActive]} onPress={() => setCategory(c)}><Text style={[styles.chipText, category===c && styles.chipTextActive]}>{c}</Text></TouchableOpacity>)}</View></View>

      <View style={styles.section}><View style={styles.sectionHeader}><Ionicons name="list" size={16} color="#1F7A4C" /><Text style={styles.sectionTitle}>Guides & Resources</Text></View>{error ? <Text style={styles.error}>{error}</Text> : null}{loading ? <ActivityIndicator size="large" color="#1F7A4C" /> : null}{!loading && filtered.length===0 ? <Text style={styles.meta}>No articles found.</Text> : null}{filtered.map((item) => <View key={item.id} style={styles.card}><Text style={styles.cardTitle}>{item.title}</Text><Text style={styles.meta}>{item.type}</Text>{item.description ? <Text style={styles.meta}>{item.description}</Text> : null}<TouchableOpacity style={styles.bookmarkBtn} onPress={() => setSaved((prev) => ({ ...prev, [item.id]: !prev[item.id] }))}><Text style={styles.bookmarkBtnText}>{saved[item.id] ? "Bookmarked" : "Bookmark"}</Text></TouchableOpacity></View>)}</View>

      {user?.role === "mentor" ? (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="add-circle" size={16} color="#1F7A4C" />
            <Text style={styles.sectionTitle}>Submit A Resource (Mentors)</Text>
          </View>
          <Text style={styles.meta}>Submitted items require admin approval before they appear to everyone.</Text>
          <TextInput style={styles.input} placeholder="Domain (optional)" value={submitForm.domain} onChangeText={(t) => setSubmitForm((p) => ({ ...p, domain: t }))} />
          <TextInput style={styles.input} placeholder="Type (roadmap, interview_questions, coding_resource, career_guide, other)" value={submitForm.type} onChangeText={(t) => setSubmitForm((p) => ({ ...p, type: t }))} />
          <TextInput style={styles.input} placeholder="Title" value={submitForm.title} onChangeText={(t) => setSubmitForm((p) => ({ ...p, title: t }))} />
          <TextInput style={[styles.input, styles.textArea]} placeholder="Short description" value={submitForm.description} onChangeText={(t) => setSubmitForm((p) => ({ ...p, description: t }))} multiline />
          <TextInput style={styles.input} placeholder="URL (optional)" value={submitForm.url} onChangeText={(t) => setSubmitForm((p) => ({ ...p, url: t }))} />
          <TouchableOpacity
            style={[styles.primaryBtn, submitting && styles.primaryBtnDisabled]}
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
                Alert.alert("Submitted", "Sent to admin for review.");
                setSubmitForm({ domain: "", type: "other", title: "", description: "", url: "" });
              } catch (e: any) {
                Alert.alert("Failed", e?.response?.data?.message || "Unable to submit resource.");
              } finally {
                setSubmitting(false);
              }
            }}
          >
            <Text style={styles.primaryBtnText}>{submitting ? "Submitting..." : "Submit For Review"}</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <View style={styles.section}><View style={styles.sectionHeader}><Ionicons name="help-circle" size={16} color="#1F7A4C" /><Text style={styles.sectionTitle}>Tips</Text></View><Text style={styles.meta}>Bookmark key resources and review them weekly.</Text></View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, backgroundColor: "#F3F6FB", gap: 10 },
  pageTitle: { fontSize: 26, fontWeight: "800", color: "#11261E" },
  pageSub: { color: "#667085" },
  section: { backgroundColor: "#FFFFFF", borderRadius: 14, borderWidth: 1, borderColor: "#E4E7EC", padding: 12, gap: 8 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  sectionTitle: { fontWeight: "800", color: "#1E2B24" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1, borderColor: "#D0D5DD", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: "#fff" },
  chipActive: { borderColor: "#1F7A4C", backgroundColor: "#EAF6EF" },
  chipText: { color: "#475467", fontWeight: "700", fontSize: 12 },
  chipTextActive: { color: "#1F7A4C" },
  card: { backgroundColor: "#EFF8FF", borderColor: "#B2DDFF", borderWidth: 1, borderRadius: 12, padding: 10, gap: 4 },
  cardTitle: { fontWeight: "800", color: "#1E2B24" },
  bookmarkBtn: { alignSelf: "flex-start", borderWidth: 1, borderColor: "#175CD3", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, marginTop: 4 },
  bookmarkBtnText: { color: "#175CD3", fontWeight: "700" },
  input: { borderWidth: 1, borderColor: "#D0D5DD", borderRadius: 12, backgroundColor: "#fff", paddingHorizontal: 10, paddingVertical: 9 },
  textArea: { minHeight: 80, textAlignVertical: "top" },
  primaryBtn: { alignSelf: "flex-start", backgroundColor: "#1F7A4C", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9 },
  primaryBtnDisabled: { opacity: 0.7 },
  primaryBtnText: { color: "#fff", fontWeight: "700" },
  meta: { color: "#667085" },
  error: { color: "#B42318" }
});
