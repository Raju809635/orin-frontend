import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useMemo, useRef, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { api } from "@/lib/api";
import { notify } from "@/utils/notify";
import { saveAiItem } from "@/utils/aiSaves";

type AiHistoryItem = { _id?: string; prompt: string; response: string; createdAt?: string };

const SUGGESTED = [
  "Help me become an AI engineer.",
  "Create a DSA preparation plan.",
  "Suggest projects for web development beginner.",
  "How should I prepare for interviews?"
];

export default function AiAssistantEntryPage() {
  const router = useRouter();
  const scrollRef = useRef<ScrollView | null>(null);
  const [message, setMessage] = useState("");
  const [history, setHistory] = useState<AiHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    try {
      if (refresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      const res = await api.get<AiHistoryItem[]>("/api/ai/history");
      setHistory(res.data || []);
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to load AI history.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const conversations = useMemo(() => history.slice(0, 12).reverse(), [history]);
  const latest = useMemo(() => history[0] || null, [history]);

  async function sendQuestion(text?: string) {
    const prompt = (text ?? message).trim();
    if (!prompt) return;
    try {
      setSending(true);
      setError(null);
      const pending: AiHistoryItem = { prompt, response: "", createdAt: new Date().toISOString() };
      setHistory((prev) => [pending, ...prev]);
      setMessage("");
      const res = await api.post<{ answer: string }>("/api/ai/chat", { message: prompt, context: { source: "ai-assistant-page" } });
      const answer = res.data?.answer || "";
      setHistory((prev) => [{ ...pending, response: answer }, ...prev.filter((item) => item !== pending)]);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150);
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to send message.");
    } finally {
      setSending(false);
    }
  }

  const suggestionBlocks = useMemo(() => {
    if (!latest?.response) return [];
    return latest.response
      .split(/\n+/)
      .map((item) => item.replace(/^[\-\*\d\.\s]+/, "").trim())
      .filter(Boolean)
      .slice(0, 5);
  }, [latest?.response]);

  return (
    <ScrollView
      ref={(ref) => {
        scrollRef.current = ref;
      }}
      contentContainerStyle={styles.page}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
    >
      <LinearGradient colors={["#3B5BFF", "#6C63FF", "#8F67FF"]} style={styles.hero}>
        <Text style={styles.heroTitle}>AI Mentor</Text>
        <Text style={styles.heroSub}>Ask ORIN anything and turn the answer into action right away.</Text>
        <View style={styles.flowRow}>
          {["AI Plan", "Skill Gap", "Roadmap", "Build"].map((item, index) => (
            <View key={item} style={styles.flowItem}>
              <Text style={styles.flowText}>{item}</Text>
              {index < 3 ? <Ionicons name="arrow-forward" size={12} color="#E8E7FF" /> : null}
            </View>
          ))}
        </View>
      </LinearGradient>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Suggested Prompts</Text>
        <View style={styles.chips}>
          {SUGGESTED.map((item) => (
            <TouchableOpacity key={item} style={styles.chip} onPress={() => sendQuestion(item)}>
              <Text style={styles.chipText}>{item}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Conversation</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {loading ? <ActivityIndicator size="large" color="#5B4DFF" /> : null}
        {!loading && !conversations.length && !sending ? (
          <View style={styles.emptyState}>
            <Ionicons name="chatbubbles-outline" size={28} color="#98A2B3" />
            <Text style={styles.emptyTitle}>Start your AI mentor chat</Text>
            <Text style={styles.meta}>Ask a goal-based question and ORIN will break it into steps.</Text>
          </View>
        ) : null}

        {conversations.map((item, index) => (
          <View key={`${item._id || index}-${item.createdAt || index}`} style={styles.chatGroup}>
            <View style={[styles.bubble, styles.userBubble]}>
              <Text style={styles.userBubbleText}>{item.prompt}</Text>
            </View>
            <LinearGradient colors={["#EEF2FF", "#F5F3FF"]} style={[styles.bubble, styles.aiBubble]}>
              {item.response ? (
                <>
                  <Text style={styles.aiIntro}>Here&apos;s your plan</Text>
                  {item.response
                    .split(/\n+/)
                    .map((line) => line.trim())
                    .filter(Boolean)
                    .slice(0, 6)
                    .map((line, lineIndex) => (
                      <View key={`${line}-${lineIndex}`} style={styles.aiStepRow}>
                        <Ionicons name="sparkles" size={14} color="#5B4DFF" />
                        <Text style={styles.aiBubbleText}>{line.replace(/^[\-\*\d\.\s]+/, "").trim()}</Text>
                      </View>
                    ))}
                </>
              ) : (
                <View style={styles.typingRow}>
                  <ActivityIndicator size="small" color="#5B4DFF" />
                  <Text style={styles.meta}>AI is thinking...</Text>
                </View>
              )}
            </LinearGradient>
          </View>
        ))}

        {latest?.response ? (
          <View style={styles.actionCard}>
            <Text style={styles.actionTitle}>Turn this into action</Text>
            <View style={styles.actionRow}>
              <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.push("/ai/skill-gap" as never)}>
                <Text style={styles.secondaryBtnText}>Analyze Skills</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.push("/ai/career-roadmap" as never)}>
                <Text style={styles.secondaryBtnText}>Generate Roadmap</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.push("/ai/project-ideas" as never)}>
                <Text style={styles.secondaryBtnText}>Get Projects</Text>
              </TouchableOpacity>
            </View>
            {suggestionBlocks.length ? (
              <View style={styles.blockList}>
                {suggestionBlocks.map((item) => (
                  <View key={item} style={styles.blockItem}>
                    <Text style={styles.blockText}>{item}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Ask ORIN</Text>
        <TextInput style={styles.input} multiline value={message} onChangeText={setMessage} placeholder="What do you want to achieve today?" />
        <TouchableOpacity style={styles.primaryBtn} onPress={() => sendQuestion()} disabled={sending}>
          <Text style={styles.primaryBtnText}>{sending ? "Sending..." : "Send to AI Mentor"}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Actions</Text>
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={async () => {
            if (!latest?.response) {
              notify("No answer to save yet.");
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, backgroundColor: "#F3F6FB", gap: 12 },
  hero: { borderRadius: 24, padding: 18, gap: 12 },
  heroTitle: { color: "#FFFFFF", fontSize: 28, fontWeight: "900" },
  heroSub: { color: "#E8E7FF" },
  flowRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center" },
  flowItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  flowText: { color: "#FFFFFF", fontWeight: "700", fontSize: 12 },
  section: { backgroundColor: "#FFFFFF", borderRadius: 18, borderWidth: 1, borderColor: "#E4E7EC", padding: 14, gap: 10 },
  sectionTitle: { fontWeight: "800", color: "#1E2B24", fontSize: 17 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1, borderColor: "#D0D5DD", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: "#fff" },
  chipText: { color: "#475467", fontWeight: "700", fontSize: 12 },
  chatGroup: { gap: 8, marginBottom: 4 },
  bubble: { borderRadius: 18, paddingHorizontal: 14, paddingVertical: 12, maxWidth: "90%" },
  userBubble: { alignSelf: "flex-end", backgroundColor: "#F2F4F7" },
  aiBubble: { alignSelf: "flex-start" },
  userBubbleText: { color: "#1F2937", fontWeight: "600" },
  aiIntro: { color: "#4338CA", fontWeight: "800", marginBottom: 4 },
  aiStepRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginTop: 4 },
  aiBubbleText: { flex: 1, color: "#312E81", lineHeight: 20 },
  typingRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  actionCard: { borderRadius: 16, backgroundColor: "#F8F7FF", borderWidth: 1, borderColor: "#DBD8FF", padding: 14, gap: 10 },
  actionTitle: { color: "#312E81", fontWeight: "800", fontSize: 16 },
  actionRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  blockList: { gap: 8 },
  blockItem: { borderRadius: 12, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E4E7EC", padding: 10 },
  blockText: { color: "#344054" },
  input: { borderWidth: 1, borderColor: "#D0D5DD", borderRadius: 12, backgroundColor: "#fff", paddingHorizontal: 12, paddingVertical: 12, minHeight: 100, textAlignVertical: "top", color: "#344054" },
  emptyState: { alignItems: "center", justifyContent: "center", paddingVertical: 18, gap: 8 },
  emptyTitle: { color: "#1E2B24", fontSize: 18, fontWeight: "800" },
  meta: { color: "#667085", lineHeight: 20, textAlign: "center" },
  error: { color: "#B42318" },
  primaryBtn: { alignSelf: "flex-start", backgroundColor: "#5B4DFF", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11 },
  primaryBtnText: { color: "#fff", fontWeight: "800" },
  secondaryBtn: { alignSelf: "flex-start", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, backgroundColor: "#EAF6EF" },
  secondaryBtnText: { color: "#1F7A4C", fontWeight: "800" }
});
