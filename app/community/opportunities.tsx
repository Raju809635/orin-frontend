import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Linking, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

type OpportunityItem = { _id: string; title: string; company?: string; role?: string; type?: string; duration?: string; applicationUrl?: string; isActive?: boolean };

const FILTERS = ["All", "Remote", "Paid", "Domain"];

export default function CommunityOpportunitiesPage() {
  const { user } = useAuth();
  const [filter, setFilter] = useState("All");
  const [items, setItems] = useState<OpportunityItem[]>([]);
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
      if (refresh) setRefreshing(true); else setLoading(true);
      setError(null);
      const res = await api.get<OpportunityItem[]>("/api/network/opportunities");
      setItems(res.data || []);
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to load opportunities.");
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const filtered = useMemo(() => {
    if (filter === "All") return items;
    return items.filter((x) => `${x.type || ""} ${x.title}`.toLowerCase().includes(filter.toLowerCase()));
  }, [items, filter]);

  return (
    <ScrollView contentContainerStyle={styles.page} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}>
      <Text style={styles.pageTitle}>Internship Opportunities</Text>
      <Text style={styles.pageSub}>Browse internships with practical filters and apply directly.</Text>

      <View style={styles.section}><View style={styles.sectionHeader}><Ionicons name="briefcase" size={16} color="#1F7A4C" /><Text style={styles.sectionTitle}>Overview</Text></View><Text style={styles.meta}>Discover relevant internships by mode, type, and role focus.</Text></View>

      <View style={styles.section}><View style={styles.sectionHeader}><Ionicons name="funnel" size={16} color="#1F7A4C" /><Text style={styles.sectionTitle}>Filters</Text></View><View style={styles.chips}>{FILTERS.map((f) => <TouchableOpacity key={f} style={[styles.chip, filter===f && styles.chipActive]} onPress={() => setFilter(f)}><Text style={[styles.chipText, filter===f && styles.chipTextActive]}>{f}</Text></TouchableOpacity>)}</View></View>

      <View style={styles.section}><View style={styles.sectionHeader}><Ionicons name="list" size={16} color="#1F7A4C" /><Text style={styles.sectionTitle}>Listings</Text></View>{error ? <Text style={styles.error}>{error}</Text> : null}{loading ? <ActivityIndicator size="large" color="#1F7A4C" /> : null}{!loading && filtered.length===0 ? <Text style={styles.meta}>No internships available.</Text> : null}{filtered.map((item) => <View key={item._id} style={styles.card}><Text style={styles.cardTitle}>{item.title}</Text><Text style={styles.meta}>{item.company || "ORIN Network"}</Text><Text style={styles.meta}>Role: {item.role || item.type || "Intern"} | Duration: {item.duration || "Flexible"}</Text><TouchableOpacity style={styles.secondaryBtn} onPress={() => (item.applicationUrl ? Linking.openURL(item.applicationUrl) : undefined)} disabled={!item.applicationUrl}><Text style={styles.secondaryBtnText}>{item.applicationUrl ? "Apply" : "Link not available"}</Text></TouchableOpacity></View>)}</View>

      {user?.role === "mentor" ? (
        <View style={styles.section}>
          <View style={styles.sectionHeader}><Ionicons name="add-circle" size={16} color="#1F7A4C" /><Text style={styles.sectionTitle}>Submit An Opportunity (Mentors)</Text></View>
          <Text style={styles.meta}>Your opportunity will be published after admin approval.</Text>
          <TextInput style={styles.input} placeholder="Title" value={submitForm.title} onChangeText={(t) => setSubmitForm((p) => ({ ...p, title: t }))} />
          <TextInput style={styles.input} placeholder="Company (optional)" value={submitForm.company} onChangeText={(t) => setSubmitForm((p) => ({ ...p, company: t }))} />
          <TextInput style={styles.input} placeholder="Role (optional)" value={submitForm.role} onChangeText={(t) => setSubmitForm((p) => ({ ...p, role: t }))} />
          <TextInput style={styles.input} placeholder="Duration (optional)" value={submitForm.duration} onChangeText={(t) => setSubmitForm((p) => ({ ...p, duration: t }))} />
          <TextInput style={styles.input} placeholder="Application URL (optional)" value={submitForm.applicationUrl} onChangeText={(t) => setSubmitForm((p) => ({ ...p, applicationUrl: t }))} />
          <TextInput style={[styles.input, styles.textArea]} placeholder="Short description (optional)" value={submitForm.description} onChangeText={(t) => setSubmitForm((p) => ({ ...p, description: t }))} multiline />
          <TouchableOpacity
            style={[styles.primaryBtn, submitting && styles.primaryBtnDisabled]}
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
                Alert.alert("Submitted", "Sent to admin for review.");
                setSubmitForm({ title: "", company: "", role: "", duration: "", applicationUrl: "", description: "" });
                await load(true);
              } catch (e: any) {
                Alert.alert("Failed", e?.response?.data?.message || "Unable to submit opportunity.");
              } finally {
                setSubmitting(false);
              }
            }}
          >
            <Text style={styles.primaryBtnText}>{submitting ? "Submitting..." : "Submit For Review"}</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <View style={styles.section}><View style={styles.sectionHeader}><Ionicons name="help-circle" size={16} color="#1F7A4C" /><Text style={styles.sectionTitle}>Tips</Text></View><Text style={styles.meta}>Apply to 3 to 5 relevant opportunities every week for better response rate.</Text></View>
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
  card: { backgroundColor: "#ECFDF3", borderColor: "#B7E5CC", borderWidth: 1, borderRadius: 12, padding: 10, gap: 4 },
  cardTitle: { fontWeight: "800", color: "#1E2B24" },
  meta: { color: "#667085" },
  error: { color: "#B42318" },
  secondaryBtn: { alignSelf: "flex-start", borderWidth: 1, borderColor: "#1F7A4C", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, marginTop: 4 },
  secondaryBtnText: { color: "#1F7A4C", fontWeight: "700" },
  input: { borderWidth: 1, borderColor: "#D0D5DD", borderRadius: 12, backgroundColor: "#fff", paddingHorizontal: 10, paddingVertical: 9 },
  textArea: { minHeight: 80, textAlignVertical: "top" },
  primaryBtn: { alignSelf: "flex-start", backgroundColor: "#1F7A4C", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9 },
  primaryBtnDisabled: { opacity: 0.7 },
  primaryBtnText: { color: "#fff", fontWeight: "700" }
});
