import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/lib/api";
import { useAppTheme } from "@/context/ThemeContext";
import { useLearner } from "@/context/LearnerContext";
import { notify } from "@/utils/notify";

type AssistantMode = "general" | "academic";
type HistoryItem = {
  conversationId: string;
  title: string;
  assistantMode: AssistantMode;
  pinned: boolean;
  lastMessageAt?: string;
  lastResponsePreview?: string;
};
type ThreadMessage = { id?: string; prompt: string; response: string; createdAt?: string };

function fallbackTitle(prompt: string) {
  const clean = String(prompt || "").trim().replace(/\s+/g, " ");
  if (!clean) return "New chat";
  return clean.length > 42 ? `${clean.slice(0, 42)}...` : clean;
}

function isGreetingPrompt(prompt: string) {
  return /^(hi|hii|hello|hey|namaste|good\s*(morning|afternoon|evening)|yo)[\s!.]*$/i.test(String(prompt || "").trim());
}

function localFallbackAnswer(prompt: string, mode: AssistantMode, classLevel: string, subject: string) {
  if (isGreetingPrompt(prompt)) {
    return [
      "Hi! Welcome to ORIN.",
      "",
      mode === "general"
        ? "Ask me anything: school doubts, explanations, planning, writing, ideas, or general questions."
        : `Ask me any academic doubt for Class ${classLevel}${subject ? `, ${subject}` : ""}.`,
      "",
      "For example: what is photosynthesis?"
    ].join("\n");
  }
  return [
    "I’m having trouble reaching the AI service right now, but I’m still here.",
    "",
    "Please send the question again, and I’ll answer it directly. If it is academic, include the subject or chapter for a better answer."
  ].join("\n");
}

function formatHistoryDate(value?: string) {
  if (!value) return "Recent";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recent";
  return date.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function renderLines(text: string, color: string) {
  return String(text || "")
    .split(/\n+/)
    .filter(Boolean)
    .map((line, idx) => (
      <Text key={`${idx}-${line}`} style={[styles.assistantText, { color }]}>
        {line}
      </Text>
    ));
}

export default function HighSchoolStudyAssistantScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const { className, institutionName } = useLearner();
  const scrollRef = useRef<ScrollView | null>(null);

  const [mode, setMode] = useState<AssistantMode>("academic");
  const [message, setMessage] = useState("");
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [thread, setThread] = useState<ThreadMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [classLevel, setClassLevel] = useState(className || "10");
  const [subject, setSubject] = useState("Science");
  const [chapter, setChapter] = useState("");
  const [renameFor, setRenameFor] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");

  const promptChips = useMemo(
    () =>
      mode === "general"
        ? ["Explain this simply", "Give quick summary", "Translate to easy English"]
        : ["Make exam answer", "Give step-by-step", "Create revision points"],
    [mode]
  );

  const loadHistory = useCallback(async (refresh = false) => {
    try {
      if (refresh) setRefreshing(true);
      else setLoadingHistory(true);
      const { data } = await api.get<HistoryItem[]>("/api/ai/highschool/assistant/history");
      setHistory(Array.isArray(data) ? data : []);
      setError(null);
    } catch {
      setError("Unable to load assistant history.");
    } finally {
      setLoadingHistory(false);
      setRefreshing(false);
    }
  }, []);

  const loadThread = useCallback(async (id: string) => {
    try {
      const { data } = await api.get<{ messages?: ThreadMessage[] }>(`/api/ai/highschool/assistant/conversations/${id}`);
      setThread(Array.isArray(data?.messages) ? data.messages : []);
    } catch {
      notify("Unable to load this chat.");
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadHistory();
    }, [loadHistory])
  );

  async function sendPrompt(seed?: string) {
    const prompt = String(seed ?? message).trim();
    if (!prompt || sending) return;
    setSending(true);
    setError(null);
    const pending: ThreadMessage = { prompt, response: "", createdAt: new Date().toISOString() };
    setThread((prev) => [...prev, pending]);
    setMessage("");
    try {
      const { data } = await api.post<{
        answer: string;
        conversationId: string;
      }>("/api/ai/highschool/assistant/chat", {
        message: prompt,
        conversationId: conversationId || undefined,
        assistantMode: mode,
        academicContext: mode === "academic" ? { classLevel, subject, chapter } : undefined
      });

      const nextId = String(data?.conversationId || conversationId || "").trim();
      if (nextId) setConversationId(nextId);
      setThread((prev) => prev.map((item) => (item === pending ? { ...pending, response: String(data?.answer || "") } : item)));
      await loadHistory(true);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 120);
    } catch {
      setThread((prev) =>
        prev.map((item) =>
          item === pending
            ? {
                ...pending,
                response: localFallbackAnswer(prompt, mode, classLevel, subject)
              }
            : item
        )
      );
    } finally {
      setSending(false);
    }
  }

  async function openConversation(item: HistoryItem) {
    setConversationId(item.conversationId);
    setMode(item.assistantMode === "general" ? "general" : "academic");
    setDrawerVisible(false);
    await loadThread(item.conversationId);
  }

  function startNewChat(nextMode?: AssistantMode) {
    if (nextMode) setMode(nextMode);
    setConversationId(null);
    setThread([]);
    setMessage("");
    setDrawerVisible(false);
  }

  async function patchConversation(id: string, payload: { title?: string; pinned?: boolean }) {
    try {
      await api.patch(`/api/ai/highschool/assistant/conversations/${id}`, payload);
      await loadHistory(true);
    } catch {
      notify("Could not update chat.");
    }
  }

  async function deleteConversation(id: string) {
    try {
      await api.delete(`/api/ai/highschool/assistant/conversations/${id}`);
      if (conversationId === id) {
        setConversationId(null);
        setThread([]);
      }
      await loadHistory(true);
    } catch {
      notify("Could not delete chat.");
    }
  }

  return (
    <KeyboardAvoidingView style={[styles.root, { backgroundColor: colors.background }]} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 10), borderColor: colors.border, backgroundColor: colors.surface }]}>
        <TouchableOpacity style={[styles.iconBtn, { borderColor: colors.border }]} onPress={() => setDrawerVisible(true)}>
          <Ionicons name="menu" size={20} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerTextWrap}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>High School Assistant</Text>
          <Text style={[styles.headerMeta, { color: colors.textMuted }]}>
            {mode === "academic" ? `Class ${classLevel}${subject ? ` • ${subject}` : ""}` : "General mode"}
          </Text>
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.thread}
        contentContainerStyle={styles.threadContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void loadHistory(true)} />}
      >
        {loadingHistory ? <ActivityIndicator color={colors.accent} /> : null}
        {error ? <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text> : null}
        {!thread.length ? (
          <View style={[styles.emptyCard, { borderColor: colors.border, backgroundColor: colors.surface }]}>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>Ask anything</Text>
            <Text style={[styles.emptyMeta, { color: colors.textMuted }]}>
              {mode === "academic"
                ? `Academic mode is ready${institutionName ? ` for ${institutionName}` : ""}.`
                : "General mode is ready for any prompt."}
            </Text>
            <View style={styles.chipRow}>
              {promptChips.map((chip) => (
                <TouchableOpacity key={chip} style={[styles.chip, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }]} onPress={() => void sendPrompt(chip)}>
                  <Text style={[styles.chipText, { color: colors.text }]}>{chip}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : null}

        {thread.map((item, idx) => (
          <View key={`${item.createdAt || idx}-${idx}`} style={styles.messageBlock}>
            <View style={[styles.userBubble, { backgroundColor: colors.accentSoft }]}>
              <Text style={[styles.userText, { color: colors.text }]}>{item.prompt}</Text>
            </View>
            <View style={[styles.assistantBubble, { borderColor: colors.border, backgroundColor: colors.surface }]}>
              {item.response ? renderLines(item.response, colors.text) : <ActivityIndicator color={colors.accent} />}
            </View>
          </View>
        ))}
      </ScrollView>

      <View style={[styles.composerWrap, { borderColor: colors.border, paddingBottom: Math.max(insets.bottom, 8), backgroundColor: colors.surface }]}>
        <TextInput
          value={message}
          onChangeText={setMessage}
          placeholder={mode === "academic" ? "Ask your subject doubt..." : "Ask anything..."}
          placeholderTextColor={colors.textMuted}
          multiline
          style={[styles.input, { borderColor: colors.border, backgroundColor: colors.surfaceAlt, color: colors.text }]}
        />
        <TouchableOpacity style={[styles.sendBtn, { backgroundColor: colors.accent }]} onPress={() => void sendPrompt()} disabled={sending}>
          {sending ? <ActivityIndicator color={colors.accentText} /> : <Ionicons name="send" size={18} color={colors.accentText} />}
        </TouchableOpacity>
      </View>

      <Modal visible={drawerVisible} transparent animationType="slide" onRequestClose={() => setDrawerVisible(false)}>
        <View style={styles.overlay}>
          <View style={[styles.drawer, { backgroundColor: colors.surface, borderColor: colors.border, paddingTop: Math.max(insets.top, 16) }]}>
            <View style={styles.drawerHeader}>
              <Text style={[styles.drawerTitle, { color: colors.text }]}>Assistant Menu</Text>
              <TouchableOpacity style={[styles.iconBtn, { borderColor: colors.border }]} onPress={() => setDrawerVisible(false)}>
                <Ionicons name="close" size={18} color={colors.text} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={[styles.newChatBtn, { backgroundColor: colors.accent }]} onPress={() => startNewChat()}>
              <Ionicons name="add" size={16} color={colors.accentText} />
              <Text style={[styles.newChatText, { color: colors.accentText }]}>New Chat</Text>
            </TouchableOpacity>

            <View style={styles.modeRow}>
              {(["general", "academic"] as AssistantMode[]).map((m) => {
                const active = mode === m;
                return (
                  <TouchableOpacity key={m} style={[styles.modeChip, { borderColor: active ? colors.accent : colors.border, backgroundColor: active ? colors.accentSoft : colors.surfaceAlt }]} onPress={() => startNewChat(m)}>
                    <Text style={[styles.modeText, { color: active ? colors.accent : colors.text }]}>{m === "general" ? "General" : "Academic"}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {mode === "academic" ? (
              <View style={[styles.contextCard, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}>
                <Text style={[styles.contextTitle, { color: colors.text }]}>Academic Context</Text>
                <TextInput style={[styles.contextInput, { borderColor: colors.border, color: colors.text }]} value={classLevel} onChangeText={setClassLevel} placeholder="Class" placeholderTextColor={colors.textMuted} />
                <TextInput style={[styles.contextInput, { borderColor: colors.border, color: colors.text }]} value={subject} onChangeText={setSubject} placeholder="Subject" placeholderTextColor={colors.textMuted} />
                <TextInput style={[styles.contextInput, { borderColor: colors.border, color: colors.text }]} value={chapter} onChangeText={setChapter} placeholder="Chapter (optional)" placeholderTextColor={colors.textMuted} />
              </View>
            ) : null}

            <Text style={[styles.historyTitle, { color: colors.textMuted }]}>Chat History</Text>
            <ScrollView style={{ maxHeight: 320 }}>
              {history.map((item) => (
                <View key={item.conversationId} style={[styles.historyCard, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}>
                  <TouchableOpacity onPress={() => void openConversation(item)}>
                    <Text style={[styles.historyItemTitle, { color: colors.text }]} numberOfLines={1}>
                      {item.title || fallbackTitle(item.lastResponsePreview || "")}
                    </Text>
                    <Text style={[styles.historyMeta, { color: colors.textMuted }]} numberOfLines={1}>
                      {item.assistantMode} • {formatHistoryDate(item.lastMessageAt)}
                    </Text>
                  </TouchableOpacity>
                  <View style={styles.historyActions}>
                    <TouchableOpacity onPress={() => void patchConversation(item.conversationId, { pinned: !item.pinned })}>
                      <Ionicons name={item.pinned ? "bookmark" : "bookmark-outline"} size={16} color={colors.textMuted} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => {
                        setRenameFor(item.conversationId);
                        setRenameDraft(item.title || "");
                      }}
                    >
                      <Ionicons name="create-outline" size={16} color={colors.textMuted} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => void deleteConversation(item.conversationId)}>
                      <Ionicons name="trash-outline" size={16} color={colors.danger} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </ScrollView>

            {renameFor ? (
              <View style={[styles.renameBox, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}>
                <TextInput
                  value={renameDraft}
                  onChangeText={setRenameDraft}
                  placeholder="Rename chat"
                  placeholderTextColor={colors.textMuted}
                  style={[styles.contextInput, { borderColor: colors.border, color: colors.text }]}
                />
                <TouchableOpacity
                  style={[styles.renameSave, { backgroundColor: colors.accent }]}
                  onPress={async () => {
                    await patchConversation(renameFor, { title: renameDraft.trim() || "New chat" });
                    setRenameFor(null);
                    setRenameDraft("");
                  }}
                >
                  <Text style={{ color: colors.accentText, fontWeight: "800" }}>Save</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { borderBottomWidth: 1, paddingHorizontal: 12, paddingBottom: 10, flexDirection: "row", alignItems: "center", gap: 10 },
  iconBtn: { width: 36, height: 36, borderRadius: 10, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  headerTextWrap: { flex: 1 },
  headerTitle: { fontSize: 18, fontWeight: "900" },
  headerMeta: { fontSize: 12, marginTop: 2 },
  thread: { flex: 1 },
  threadContent: { padding: 14, gap: 12, paddingBottom: 120 },
  messageBlock: { gap: 8 },
  userBubble: { alignSelf: "flex-end", maxWidth: "85%", borderRadius: 14, padding: 10 },
  userText: { fontSize: 14, fontWeight: "600", lineHeight: 20 },
  assistantBubble: { alignSelf: "stretch", borderRadius: 14, borderWidth: 1, padding: 10, gap: 4 },
  assistantText: { fontSize: 14, lineHeight: 21, fontWeight: "500" },
  composerWrap: { borderTopWidth: 1, paddingHorizontal: 12, paddingTop: 10, flexDirection: "row", alignItems: "flex-end", gap: 8 },
  input: { flex: 1, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, minHeight: 44, maxHeight: 120, fontWeight: "500" },
  sendBtn: { width: 42, height: 42, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  emptyCard: { borderWidth: 1, borderRadius: 14, padding: 12, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: "900" },
  emptyMeta: { fontSize: 13, lineHeight: 19 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  chipText: { fontSize: 12, fontWeight: "700" },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)" },
  drawer: { width: "88%", maxWidth: 430, height: "100%", borderRightWidth: 1, paddingHorizontal: 12, paddingBottom: 16 },
  drawerHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  drawerTitle: { fontSize: 17, fontWeight: "900" },
  newChatBtn: { borderRadius: 10, paddingVertical: 10, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6, marginBottom: 10 },
  newChatText: { fontWeight: "900" },
  modeRow: { flexDirection: "row", gap: 8, marginBottom: 10 },
  modeChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  modeText: { fontWeight: "800", fontSize: 12 },
  contextCard: { borderWidth: 1, borderRadius: 12, padding: 10, gap: 8, marginBottom: 10 },
  contextTitle: { fontWeight: "800", fontSize: 13 },
  contextInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13, fontWeight: "600" },
  historyTitle: { fontSize: 12, fontWeight: "800", marginBottom: 8 },
  historyCard: { borderWidth: 1, borderRadius: 10, padding: 9, marginBottom: 8, flexDirection: "row", justifyContent: "space-between", gap: 8 },
  historyItemTitle: { fontWeight: "800", fontSize: 13, maxWidth: 210 },
  historyMeta: { fontSize: 11, marginTop: 2 },
  historyActions: { flexDirection: "row", gap: 10, alignItems: "center" },
  renameBox: { borderWidth: 1, borderRadius: 10, padding: 8, marginTop: 8, gap: 8 },
  renameSave: { borderRadius: 8, alignItems: "center", paddingVertical: 8 },
  errorText: { fontSize: 12, fontWeight: "600" }
});
