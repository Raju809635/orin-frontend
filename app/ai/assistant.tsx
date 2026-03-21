import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/lib/api";
import { notify } from "@/utils/notify";
import { saveAiItem } from "@/utils/aiSaves";

type AiHistoryItem = { _id?: string; prompt: string; response: string; createdAt?: string };

const SUGGESTED = [
  "How to become an AI engineer in 6 months?",
  "Give me a weekly plan for DSA.",
  "Suggest projects for web development beginner.",
  "How should I prepare for interviews?"
];

export default function AiAssistantEntryPage() {
  const [message, setMessage] = useState("");
  const [history, setHistory] = useState<AiHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    try {
      if (refresh) setRefreshing(true); else setLoading(true);
      setError(null);
      const res = await api.get<AiHistoryItem[]>("/api/ai/history");
      setHistory(res.data || []);
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to load AI history.");
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const conversations = useMemo(() => history.slice(0, 12), [history]);

  async function sendQuestion(text?: string) {
    const prompt = (text ?? message).trim();
    if (!prompt) return;
    try {
      setSending(true);
      setError(null);
      const res = await api.post<{ answer: string }>("/api/ai/chat", { message: prompt, context: { source: "ai-assistant-page" } });
      const next: AiHistoryItem = { prompt, response: res.data?.answer || "", createdAt: new Date().toISOString() };
      setHistory((prev) => [next, ...prev]);
      setMessage("");
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to send message.");
    } finally {
      setSending(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.page} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}>
      <Text style={styles.pageTitle}>AI Assistant</Text>
      <Text style={styles.pageSub}>Chat with ORIN AI for guidance, planning, and interview help.</Text>

      <View style={styles.section}><View style={styles.sectionHeader}><Ionicons name="chatbubbles" size={16} color="#1F7A4C" /><Text style={styles.sectionTitle}>Overview</Text></View><Text style={styles.meta}>Ask direct career questions and receive instant suggestions.</Text></View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}><Ionicons name="create" size={16} color="#1F7A4C" /><Text style={styles.sectionTitle}>Main Feature</Text></View>
        <TextInput style={styles.input} multiline value={message} onChangeText={setMessage} placeholder="Ask anything..." />
        <TouchableOpacity style={styles.primaryBtn} onPress={() => sendQuestion()} disabled={sending}><Text style={styles.primaryBtnText}>{sending ? "Sending..." : "Send"}</Text></TouchableOpacity>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}><Ionicons name="bulb" size={16} color="#1F7A4C" /><Text style={styles.sectionTitle}>Suggested Questions</Text></View>
        <View style={styles.chips}>{SUGGESTED.map((q) => <TouchableOpacity key={q} style={styles.chip} onPress={() => sendQuestion(q)}><Text style={styles.chipText}>{q}</Text></TouchableOpacity>)}</View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}><Ionicons name="time" size={16} color="#1F7A4C" /><Text style={styles.sectionTitle}>Conversation History</Text></View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {loading ? <ActivityIndicator size="large" color="#1F7A4C" /> : null}
        {!loading && conversations.length === 0 ? <Text style={styles.meta}>No conversation history yet.</Text> : null}
        {conversations.map((item, idx) => (
          <View key={`${item._id || idx}`} style={styles.historyCard}>
            <Text style={styles.q}>Q: {item.prompt}</Text>
            <Text style={styles.a}>A: {item.response}</Text>
          </View>
        ))}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}><Ionicons name="bookmark" size={16} color="#1F7A4C" /><Text style={styles.sectionTitle}>Actions</Text></View>
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={async () => {
            const latest = conversations[0];
            if (!latest) {
              notify("No conversation to save yet.");
              return;
            }
            await saveAiItem({
              type: "assistant",
              title: `AI Assistant: ${latest.prompt.slice(0, 48)}${latest.prompt.length > 48 ? "..." : ""}`,
              payload: { prompt: latest.prompt, answer: latest.response }
            });
            notify("Saved to Saved AI.");
          }}
        >
          <Text style={styles.primaryBtnText}>Save Latest Answer</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}><View style={styles.sectionHeader}><Ionicons name="help-circle" size={16} color="#1F7A4C" /><Text style={styles.sectionTitle}>Tips</Text></View><Text style={styles.meta}>Ask specific questions with goal and timeline for better answers.</Text></View>
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
  input: { borderWidth: 1, borderColor: "#D0D5DD", borderRadius: 10, backgroundColor: "#fff", paddingHorizontal: 12, paddingVertical: 10, minHeight: 90, textAlignVertical: "top", color: "#344054" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1, borderColor: "#D0D5DD", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: "#fff" },
  chipText: { color: "#475467", fontWeight: "700", fontSize: 12 },
  historyCard: { borderWidth: 1, borderColor: "#E4E7EC", borderRadius: 10, padding: 10, gap: 4, backgroundColor: "#F9FAFB" },
  q: { color: "#1E2B24", fontWeight: "700" },
  a: { color: "#475467" },
  meta: { color: "#667085" },
  error: { color: "#B42318" },
  primaryBtn: { alignSelf: "flex-start", backgroundColor: "#1F7A4C", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9 },
  primaryBtnText: { color: "#fff", fontWeight: "700" }
});
