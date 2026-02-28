import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

type Complaint = {
  _id: string;
  subject: string;
  description: string;
  category: "technical" | "mentor" | "booking" | "payment" | "general";
  priority: "low" | "medium" | "high";
  status: "open" | "in_progress" | "resolved" | "closed";
  adminResponse?: string;
  createdAt: string;
};

const CATEGORY_OPTIONS: Complaint["category"][] = ["general", "technical", "mentor", "booking", "payment"];
const PRIORITY_OPTIONS: Complaint["priority"][] = ["low", "medium", "high"];

export default function ComplaintsScreen() {
  const { user } = useAuth();
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<Complaint["category"]>("general");
  const [priority, setPriority] = useState<Complaint["priority"]>("medium");
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadComplaints = useCallback(async (refresh = false) => {
    try {
      if (refresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);
      const { data } = await api.get<Complaint[]>("/api/complaints/me");
      setComplaints(data);
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to load complaints.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadComplaints();
  }, [loadComplaints]);

  async function submitComplaint() {
    if (!subject.trim() || !description.trim()) {
      setError("Subject and description are required.");
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      await api.post("/api/complaints", {
        subject: subject.trim(),
        description: description.trim(),
        category,
        priority
      });
      setSubject("");
      setDescription("");
      await loadComplaints(true);
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to submit complaint.");
    } finally {
      setSubmitting(false);
    }
  }

  if (user?.role !== "student") {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>Complaints are available only for students.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Raise Complaint</Text>
      <Text style={styles.sub}>Share issues, blockers, or support needs with admin.</Text>

      <TextInput
        style={styles.input}
        placeholder="Subject"
        value={subject}
        onChangeText={setSubject}
      />

      <TextInput
        style={[styles.input, styles.descriptionInput]}
        placeholder="Describe your issue and what help you need"
        multiline
        value={description}
        onChangeText={setDescription}
      />

      <View style={styles.row}>
        {CATEGORY_OPTIONS.map((item) => (
          <TouchableOpacity
            key={item}
            style={[styles.chip, category === item && styles.chipActive]}
            onPress={() => setCategory(item)}
          >
            <Text style={[styles.chipText, category === item && styles.chipTextActive]}>{item}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.row}>
        {PRIORITY_OPTIONS.map((item) => (
          <TouchableOpacity
            key={item}
            style={[styles.chip, priority === item && styles.chipActive]}
            onPress={() => setPriority(item)}
          >
            <Text style={[styles.chipText, priority === item && styles.chipTextActive]}>{item}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={styles.submitButton} onPress={submitComplaint} disabled={submitting}>
        <Text style={styles.submitText}>{submitting ? "Submitting..." : "Submit Complaint"}</Text>
      </TouchableOpacity>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#1F7A4C" />
        </View>
      ) : (
        <FlatList
          data={complaints}
          keyExtractor={(item) => item._id}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => loadComplaints(true)} />}
          ListHeaderComponent={<Text style={styles.historyHeading}>My Complaints</Text>}
          ListEmptyComponent={<Text style={styles.empty}>No complaints raised yet.</Text>}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>{item.subject}</Text>
                <Text style={styles.status}>{item.status}</Text>
              </View>
              <Text style={styles.meta}>
                {item.category} • {item.priority} • {new Date(item.createdAt).toLocaleString()}
              </Text>
              <Text style={styles.body}>{item.description}</Text>
              {item.adminResponse ? (
                <View style={styles.responseBox}>
                  <Text style={styles.responseTitle}>Admin response</Text>
                  <Text style={styles.responseText}>{item.adminResponse}</Text>
                </View>
              ) : null}
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F4F9F6", padding: 16 },
  centered: { alignItems: "center", justifyContent: "center", paddingVertical: 20 },
  heading: { fontSize: 24, fontWeight: "700", color: "#1E2B24" },
  sub: { color: "#475467", marginTop: 4, marginBottom: 10 },
  input: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#D0D5DD",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8
  },
  descriptionInput: { minHeight: 90, textAlignVertical: "top" },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
  chip: {
    borderWidth: 1,
    borderColor: "#D0D5DD",
    borderRadius: 999,
    backgroundColor: "#fff",
    paddingHorizontal: 10,
    paddingVertical: 7
  },
  chipActive: { borderColor: "#1F7A4C", backgroundColor: "#E8F5EE" },
  chipText: { color: "#344054", fontWeight: "600", fontSize: 12 },
  chipTextActive: { color: "#1F7A4C" },
  submitButton: {
    backgroundColor: "#1F7A4C",
    borderRadius: 12,
    alignItems: "center",
    paddingVertical: 12,
    marginBottom: 8
  },
  submitText: { color: "#fff", fontWeight: "700" },
  historyHeading: { fontSize: 18, fontWeight: "700", color: "#1E2B24", marginVertical: 10 },
  card: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#EAECF0",
    borderRadius: 12,
    padding: 12,
    marginBottom: 10
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  cardTitle: { fontWeight: "700", color: "#1E2B24", flex: 1 },
  status: { color: "#1F7A4C", fontWeight: "700", textTransform: "capitalize" },
  meta: { color: "#667085", marginTop: 4, fontSize: 12 },
  body: { color: "#344054", marginTop: 8 },
  responseBox: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#E4E7EC",
    paddingTop: 8
  },
  responseTitle: { fontWeight: "700", color: "#1E2B24" },
  responseText: { color: "#344054", marginTop: 4 },
  empty: { color: "#667085", textAlign: "center", marginTop: 12 },
  error: { color: "#B42318", marginBottom: 8 }
});
