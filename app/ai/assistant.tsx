import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { api } from "@/lib/api";
import { notify } from "@/utils/notify";
import { saveAiItem } from "@/utils/aiSaves";
import { useAppTheme } from "@/context/ThemeContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const AI_GOLD = "#D4A017";
const AI_GOLD_SOFT = "#FFF4CC";
const AI_NAVY = "#1D4ED8";
const AI_NAVY_SOFT = "#E8EEFF";
const USER_BUBBLE = "#ECFDF3";

type AssistantTab = "general" | "personalized";
type AiConversationSummary = {
  conversationId: string;
  title: string;
  assistantMode: AssistantTab;
  pinned: boolean;
  lastPrompt: string;
  lastResponsePreview: string;
  lastMessageAt?: string;
  createdAt?: string;
  messageCount: number;
};
type AiThreadMessage = {
  id?: string;
  prompt: string;
  response: string;
  createdAt?: string;
};
type AiConversationResponse = {
  conversationId: string;
  messages: AiThreadMessage[];
};

const GENERAL_SUGGESTED = [
  "What skills are needed for AI engineer?",
  "How should I prepare for interviews?",
  "Explain machine learning in simple words.",
  "How do I improve my resume?"
];

const PERSONALIZED_SUGGESTED = [
  "Build a plan for my current goal.",
  "Analyze what I should learn next.",
  "Suggest projects for my roadmap stage.",
  "Show how to become internship-ready."
];

function formatHistoryDate(value?: string) {
  if (!value) return "Recent";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recent";
  return date.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function fallbackTitle(prompt: string) {
  const clean = String(prompt || "").trim().replace(/\s+/g, " ");
  if (!clean) return "New chat";
  return clean.length > 42 ? `${clean.slice(0, 42)}...` : clean;
}

function renderRichAnswer(text: string, colors: { text: string }) {
  const lines = String(text || "")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) {
    return <Text style={[styles.answerParagraph, { color: colors.text }]}>No answer available.</Text>;
  }

  return lines.map((line, index) => {
    const bulletMatch = line.match(/^[-*]\s+(.*)$/);
    const numberMatch = line.match(/^(\d+)[.)]\s+(.*)$/);
    const heading = line.endsWith(":") || (line.length <= 40 && !bulletMatch && !numberMatch);

    if (numberMatch) {
      return (
        <View key={`${line}-${index}`} style={styles.answerRow}>
          <View style={[styles.answerNumberWrap, { backgroundColor: AI_GOLD_SOFT }]}>
            <Text style={styles.answerNumber}>{numberMatch[1]}</Text>
          </View>
          <Text style={[styles.answerParagraph, styles.answerRowText, { color: colors.text }]}>{numberMatch[2]}</Text>
        </View>
      );
    }

    if (bulletMatch) {
      return (
        <View key={`${line}-${index}`} style={styles.answerRow}>
          <View style={[styles.answerDot, { backgroundColor: AI_GOLD }]} />
          <Text style={[styles.answerParagraph, styles.answerRowText, { color: colors.text }]}>{bulletMatch[1]}</Text>
        </View>
      );
    }

    if (heading) {
      return (
        <Text key={`${line}-${index}`} style={[styles.answerHeading, { color: colors.text }]}>
          {line.replace(/:$/, "")}
        </Text>
      );
    }

    return (
      <Text key={`${line}-${index}`} style={[styles.answerParagraph, { color: colors.text }]}>
        {line}
      </Text>
    );
  });
}

export default function AiAssistantEntryPage() {
  const params = useLocalSearchParams<{
    board?: string;
    classNumber?: string;
    subject?: string;
    chapterName?: string;
    prompt?: string;
  }>();
  const scrollRef = useRef<ScrollView | null>(null);
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useAppTheme();
  const [message, setMessage] = useState("");
  const [history, setHistory] = useState<AiConversationSummary[]>([]);
  const [threadMessages, setThreadMessages] = useState<AiThreadMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<AssistantTab>("personalized");
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [renameModalVisible, setRenameModalVisible] = useState(false);
  const [renameDraft, setRenameDraft] = useState("");
  const [renamingConversationId, setRenamingConversationId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof params.prompt === "string" && params.prompt.trim()) {
      setMessage(params.prompt);
      setActiveTab("general");
    }
  }, [params.prompt]);

  const load = useCallback(async (refresh = false) => {
    try {
      if (refresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      const res = await api.get<AiConversationSummary[]>("/api/ai/history");
      setHistory(res.data || []);
    } catch {
      setError("Unable to load assistant history right now.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const loadConversation = useCallback(async (conversationId: string) => {
    try {
      const res = await api.get<AiConversationResponse>(`/api/ai/conversations/${conversationId}`);
      setThreadMessages(res.data?.messages || []);
    } catch {
      setError("Unable to load this conversation.");
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const selectedConversation = useMemo(
    () => history.find((item) => item.conversationId === selectedConversationId) || null,
    [history, selectedConversationId]
  );
  const latest = useMemo(() => threadMessages[threadMessages.length - 1] || null, [threadMessages]);
  const suggestedPrompts = activeTab === "general" ? GENERAL_SUGGESTED : PERSONALIZED_SUGGESTED;

  async function sendQuestion(text?: string) {
    const prompt = (text ?? message).trim();
    if (!prompt) return;

    try {
      setSending(true);
      setError(null);
      const pending: AiThreadMessage = { prompt, response: "", createdAt: new Date().toISOString() };
      setThreadMessages((prev) => [...prev, pending]);
      setMessage("");

      const res = await api.post<{ answer: string; conversationId: string }>("/api/ai/chat", {
        message: prompt,
        conversationId: selectedConversationId || undefined,
        context: {
          source: "ai-assistant-page",
          assistantMode: activeTab,
          academic: params.board && params.classNumber && params.subject
            ? {
                board: params.board,
                classNumber: Number(params.classNumber),
                subject: params.subject,
                chapterName: params.chapterName
              }
            : undefined
        }
      });

      const answer = String(res.data?.answer || "").trim() || "I could not generate a good answer right now. Please try again.";
      const conversationId = String(res.data?.conversationId || selectedConversationId || "");
      if (conversationId) setSelectedConversationId(conversationId);
      setThreadMessages((prev) => prev.map((item) => (item === pending ? { ...pending, response: answer } : item)));
      await load(true);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 180);
    } catch {
      setError(activeTab === "general" ? "Assistant reply failed. Please try again." : "Personalized response failed. Please try again.");
    } finally {
      setSending(false);
    }
  }

  function startNewChat(mode?: AssistantTab) {
    if (mode) setActiveTab(mode);
    setSelectedConversationId(null);
    setThreadMessages([]);
    setMessage("");
    setDrawerVisible(false);
  }

  async function openConversation(item: AiConversationSummary) {
    setActiveTab(item.assistantMode || "general");
    setSelectedConversationId(item.conversationId);
    setDrawerVisible(false);
    await loadConversation(item.conversationId);
  }

  async function updateConversation(conversationId: string, payload: { title?: string; pinned?: boolean }) {
    try {
      await api.patch(`/api/ai/conversations/${conversationId}`, payload);
      await load(true);
    } catch {
      notify("Could not update conversation.");
    }
  }

  async function deleteConversation(conversationId: string) {
    try {
      await api.delete(`/api/ai/conversations/${conversationId}`);
      if (selectedConversationId === conversationId) {
        setSelectedConversationId(null);
        setThreadMessages([]);
      }
      await load(true);
      notify("Conversation deleted.");
    } catch {
      notify("Could not delete conversation.");
    }
  }

  const sidebarItems = (
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
          <Text style={[styles.drawerTitle, { color: colors.text }]}>AI Assistant</Text>
          <Text style={[styles.drawerSub, { color: colors.textMuted }]}>Modes and recent chats</Text>
        </View>
        <TouchableOpacity style={[styles.drawerCloseBtn, { borderColor: colors.border }]} onPress={() => setDrawerVisible(false)}>
          <Ionicons name="close" size={18} color={colors.text} />
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={[styles.newChatBtn, { backgroundColor: AI_GOLD }]} onPress={() => startNewChat()}>
        <Ionicons name="add" size={16} color="#FFFFFF" />
        <Text style={styles.newChatText}>New chat</Text>
      </TouchableOpacity>

      <View style={styles.drawerSection}>
        <Text style={[styles.drawerSectionTitle, { color: colors.textMuted }]}>Assistant mode</Text>
        {(["general", "personalized"] as AssistantTab[]).map((item) => {
          const active = activeTab === item;
          return (
            <TouchableOpacity
              key={item}
              style={[
                styles.drawerModeRow,
                { borderColor: colors.border, backgroundColor: colors.surfaceAlt },
                active && { backgroundColor: item === "general" ? AI_GOLD_SOFT : AI_NAVY_SOFT, borderColor: item === "general" ? AI_GOLD : AI_NAVY }
              ]}
              onPress={() => startNewChat(item)}
            >
              <Ionicons name={item === "general" ? "sparkles" : "person-circle-outline"} size={16} color={active ? (item === "general" ? AI_GOLD : AI_NAVY) : colors.textMuted} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.drawerModeTitle, { color: colors.text }]}>{item === "general" ? "General" : "Personalized"}</Text>
                <Text style={[styles.drawerModeMeta, { color: colors.textMuted }]}>
                  {item === "general" ? "Quick answers without journey context" : "Uses your ORIN journey context"}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={[styles.drawerSection, styles.drawerHistorySection]}>
        <Text style={[styles.drawerSectionTitle, { color: colors.textMuted }]}>Recent history</Text>
        <ScrollView showsVerticalScrollIndicator={false}>
          {history.length ? (
            history.map((item) => {
              const active = selectedConversationId === item.conversationId;
              return (
                <View
                  key={item.conversationId}
                  style={[
                    styles.historyRow,
                    { borderColor: colors.border, backgroundColor: colors.surfaceAlt },
                    active && { borderColor: AI_GOLD, backgroundColor: AI_GOLD_SOFT }
                  ]}
                >
                  <TouchableOpacity style={{ gap: 4 }} onPress={() => openConversation(item)}>
                    <View style={styles.historyTopRow}>
                      <Text style={[styles.historyTitle, { color: colors.text }]} numberOfLines={1}>
                        {item.title || fallbackTitle(item.lastPrompt)}
                      </Text>
                      {item.pinned ? <Ionicons name="bookmark" size={14} color={AI_GOLD} /> : null}
                    </View>
                    <Text style={[styles.historyPreview, { color: colors.textMuted }]} numberOfLines={2}>
                      {item.lastResponsePreview || item.lastPrompt}
                    </Text>
                    <Text style={[styles.historyMeta, { color: colors.textMuted }]}>
                      {formatHistoryDate(item.lastMessageAt)} • {item.messageCount} message{item.messageCount === 1 ? "" : "s"}
                    </Text>
                  </TouchableOpacity>
                  <View style={styles.historyActionRow}>
                    <TouchableOpacity
                      onPress={() => updateConversation(item.conversationId, { pinned: !item.pinned })}
                      style={[styles.historyActionBtn, { borderColor: colors.border }]}
                    >
                      <Ionicons name={item.pinned ? "bookmark" : "bookmark-outline"} size={14} color={AI_GOLD} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => {
                        setRenamingConversationId(item.conversationId);
                        setRenameDraft(item.title || "");
                        setRenameModalVisible(true);
                      }}
                      style={[styles.historyActionBtn, { borderColor: colors.border }]}
                    >
                      <Ionicons name="create-outline" size={14} color={colors.text} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => deleteConversation(item.conversationId)} style={[styles.historyActionBtn, { borderColor: colors.border }]}>
                      <Ionicons name="trash-outline" size={14} color="#B42318" />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          ) : (
            <Text style={[styles.drawerEmptyText, { color: colors.textMuted }]}>No assistant history yet.</Text>
          )}
        </ScrollView>
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
    >
      <View style={[styles.headerBar, { backgroundColor: colors.background, borderBottomColor: colors.border, paddingTop: Math.max(insets.top, 12) }]}>
        <TouchableOpacity style={[styles.headerIconBtn, { borderColor: colors.border, backgroundColor: colors.surface }]} onPress={() => setDrawerVisible(true)}>
          <Ionicons name="menu" size={18} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
            {selectedConversation?.title || "AI Assistant"}
          </Text>
          <View style={[styles.modeChip, { backgroundColor: activeTab === "general" ? AI_GOLD_SOFT : AI_NAVY_SOFT }]}>
            <Text style={[styles.modeChipText, { color: activeTab === "general" ? AI_GOLD : AI_NAVY }]}>
              {activeTab === "general" ? "General" : "Personalized"}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          style={[styles.headerIconBtn, { borderColor: colors.border, backgroundColor: colors.surface }]}
          onPress={async () => {
            if (!latest?.response) {
              notify("No answer to save yet.");
              return;
            }
            await saveAiItem({
              type: "assistant",
              title: `AI Assistant: ${latest.prompt.slice(0, 48)}${latest.prompt.length > 48 ? "..." : ""}`,
              payload: { prompt: latest.prompt, answer: latest.response, mode: activeTab }
            });
            notify("Saved to Saved AI.");
          }}
        >
          <Ionicons name="bookmark-outline" size={18} color={colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView
        ref={(ref) => {
          scrollRef.current = ref;
        }}
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={[styles.page, { paddingBottom: Math.max(insets.bottom, 20) + 140 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
        keyboardShouldPersistTaps="handled"
      >
        {activeTab === "personalized" ? (
          <View style={[styles.contextCard, { backgroundColor: isDark ? colors.surface : "#F7F9FF", borderColor: colors.border }]}>
            <Ionicons name="sparkles" size={16} color={AI_NAVY} />
            <Text style={[styles.contextText, { color: colors.text }]}>Personalized mode uses your roadmap, skill gap, and journey context.</Text>
          </View>
        ) : null}

        {!loading && !threadMessages.length && !sending ? (
          <View style={[styles.emptyShell, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>{activeTab === "general" ? "Ask anything" : "Start a personalized AI chat"}</Text>
            <Text style={[styles.emptySub, { color: colors.textMuted }]}>
              {activeTab === "general"
                ? "Get fast, clear answers in a cleaner chat workspace."
                : "Use your journey-aware assistant for next-step guidance."}
            </Text>
            <View style={styles.promptWrap}>
              {suggestedPrompts.map((item) => (
                <TouchableOpacity key={item} style={[styles.promptChip, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }]} onPress={() => sendQuestion(item)}>
                  <Text style={[styles.promptChipText, { color: colors.text }]}>{item}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : null}

        {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
        {loading ? <ActivityIndicator size="large" color={AI_GOLD} style={{ marginTop: 32 }} /> : null}

        <View style={styles.threadWrap}>
          {threadMessages.map((item, index) => (
            <View key={`${item.id || item.createdAt || index}-${index}`} style={styles.exchangeWrap}>
              <View style={[styles.userBubble, { backgroundColor: isDark ? colors.surfaceAlt : USER_BUBBLE }]}>
                <Text style={[styles.userLabel, { color: colors.textMuted }]}>You</Text>
                <Text style={[styles.userText, { color: colors.text }]}>{item.prompt}</Text>
              </View>

              <View style={[styles.aiBubble, { backgroundColor: isDark ? colors.surface : "#FFFDF5", borderColor: isDark ? colors.border : "#F5E7A6" }]}>
                <View style={styles.aiBubbleTop}>
                  <View style={styles.aiBadge}>
                    <Ionicons name="sparkles" size={14} color={AI_GOLD} />
                    <Text style={styles.aiBadgeText}>{activeTab === "general" ? "ORIN AI" : "ORIN AI Mentor"}</Text>
                  </View>
                  <Text style={[styles.aiMeta, { color: colors.textMuted }]}>{formatHistoryDate(item.createdAt)}</Text>
                </View>

                {item.response ? (
                  <View style={styles.answerWrap}>{renderRichAnswer(item.response, { text: colors.text })}</View>
                ) : (
                  <View style={styles.typingRow}>
                    <ActivityIndicator size="small" color={AI_GOLD} />
                    <Text style={[styles.typingText, { color: colors.textMuted }]}>AI is thinking...</Text>
                  </View>
                )}
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      <View
        style={[
          styles.composerDock,
          {
            backgroundColor: colors.background,
            borderTopColor: colors.border,
            paddingBottom: Math.max(insets.bottom, 12)
          }
        ]}
      >
        <View style={[styles.composerCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <TextInput
            style={[styles.input, { borderColor: colors.border, backgroundColor: colors.surfaceAlt, color: colors.text }]}
            multiline
            value={message}
            onChangeText={setMessage}
            placeholder={activeTab === "general" ? "Message ORIN AI..." : "Ask ORIN AI Mentor about your journey..."}
            placeholderTextColor={colors.textMuted}
          />
          <View style={styles.composerActions}>
            <TouchableOpacity style={[styles.quickActionBtn, { borderColor: colors.border }]} onPress={() => setDrawerVisible(true)}>
              <Ionicons name="albums-outline" size={16} color={colors.text} />
              <Text style={[styles.quickActionText, { color: colors.text }]}>History</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.sendBtn, { backgroundColor: activeTab === "general" ? AI_GOLD : AI_NAVY }]} onPress={() => sendQuestion()} disabled={sending}>
              <Ionicons name="arrow-up" size={16} color="#FFFFFF" />
              <Text style={styles.sendBtnText}>{sending ? "Sending" : "Send"}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <Modal visible={drawerVisible} animationType="slide" transparent onRequestClose={() => setDrawerVisible(false)}>
        <View style={styles.drawerOverlay}>
          <TouchableOpacity style={styles.drawerBackdrop} activeOpacity={1} onPress={() => setDrawerVisible(false)} />
          {sidebarItems}
        </View>
      </Modal>

      <Modal visible={renameModalVisible} animationType="fade" transparent onRequestClose={() => setRenameModalVisible(false)}>
        <View style={styles.renameOverlay}>
          <View style={[styles.renameCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.renameTitle, { color: colors.text }]}>Rename chat</Text>
            <TextInput
              value={renameDraft}
              onChangeText={setRenameDraft}
              placeholder="Enter chat title"
              placeholderTextColor={colors.textMuted}
              style={[styles.renameInput, { backgroundColor: colors.surfaceAlt, borderColor: colors.border, color: colors.text }]}
            />
            <View style={styles.renameActions}>
              <TouchableOpacity style={[styles.renameBtn, { borderColor: colors.border }]} onPress={() => setRenameModalVisible(false)}>
                <Text style={[styles.renameBtnText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.renameBtn, { backgroundColor: AI_GOLD, borderColor: AI_GOLD }]}
                onPress={async () => {
                  if (renamingConversationId) {
                    await updateConversation(renamingConversationId, { title: renameDraft.trim() || "New chat" });
                  }
                  setRenameModalVisible(false);
                }}
              >
                <Text style={[styles.renameBtnText, { color: "#FFFFFF" }]}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1
  },
  headerIconBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  headerCenter: { flex: 1, gap: 4, alignItems: "center" },
  headerTitle: { fontSize: 18, fontWeight: "900", maxWidth: "90%" },
  modeChip: {
    alignSelf: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999
  },
  modeChipText: { fontSize: 12, fontWeight: "800" },
  page: { padding: 16, gap: 12 },
  contextCard: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: "row",
    gap: 10,
    alignItems: "center"
  },
  contextText: { flex: 1, fontWeight: "600", lineHeight: 19 },
  emptyShell: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 18,
    gap: 10
  },
  emptyTitle: { fontSize: 22, fontWeight: "900" },
  emptySub: { lineHeight: 21 },
  promptWrap: { gap: 10, marginTop: 6 },
  promptChip: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 12
  },
  promptChipText: { fontWeight: "700", lineHeight: 20 },
  error: { fontWeight: "700", marginTop: 6 },
  threadWrap: { gap: 14 },
  exchangeWrap: { gap: 10 },
  userBubble: {
    alignSelf: "flex-end",
    maxWidth: "90%",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  userLabel: { fontSize: 12, fontWeight: "700", marginBottom: 4 },
  userText: { fontSize: 15, lineHeight: 22, fontWeight: "600" },
  aiBubble: {
    alignSelf: "stretch",
    borderRadius: 22,
    borderWidth: 1,
    padding: 14,
    gap: 12
  },
  aiBubbleTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10
  },
  aiBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  aiBadgeText: { color: AI_GOLD, fontWeight: "900", fontSize: 12 },
  aiMeta: { fontSize: 12, fontWeight: "600" },
  answerWrap: { gap: 8 },
  answerHeading: { fontSize: 15, fontWeight: "900", marginTop: 4 },
  answerParagraph: { fontSize: 15, lineHeight: 24 },
  answerRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  answerRowText: { flex: 1 },
  answerDot: { width: 8, height: 8, borderRadius: 4, marginTop: 8 },
  answerNumberWrap: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1
  },
  answerNumber: { color: "#7C5A00", fontWeight: "900", fontSize: 12 },
  typingRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  typingText: { fontWeight: "600" },
  composerDock: {
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 12
  },
  composerCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 12,
    gap: 10
  },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    minHeight: 88,
    paddingHorizontal: 12,
    paddingVertical: 12,
    textAlignVertical: "top",
    fontSize: 15,
    lineHeight: 22
  },
  composerActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10
  },
  quickActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  quickActionText: { fontWeight: "700" },
  sendBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11
  },
  sendBtnText: { color: "#FFFFFF", fontWeight: "900" },
  drawerOverlay: { flex: 1, flexDirection: "row" },
  drawerBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.25)" },
  drawerPanel: {
    width: "84%",
    maxWidth: 360,
    borderLeftWidth: 1,
    paddingHorizontal: 14,
    gap: 14
  },
  drawerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10
  },
  drawerTitle: { fontSize: 20, fontWeight: "900" },
  drawerSub: { marginTop: 2, fontSize: 12 },
  drawerCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  newChatBtn: {
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8
  },
  newChatText: { color: "#FFFFFF", fontWeight: "900" },
  drawerSection: { gap: 8 },
  drawerHistorySection: { flex: 1 },
  drawerSectionTitle: { fontSize: 12, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5 },
  drawerModeRow: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  drawerModeTitle: { fontWeight: "800", fontSize: 14 },
  drawerModeMeta: { fontSize: 12, marginTop: 2 },
  historyRow: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    gap: 4
  },
  historyTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  historyTitle: { fontWeight: "800", fontSize: 14, flex: 1 },
  historyPreview: { fontSize: 12, lineHeight: 18 },
  historyMeta: { fontSize: 12 },
  historyActionRow: { flexDirection: "row", gap: 8, marginTop: 8 },
  historyActionBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  drawerEmptyText: { marginTop: 10, lineHeight: 20 },
  renameOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.3)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20
  },
  renameCard: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    gap: 12
  },
  renameTitle: { fontSize: 18, fontWeight: "900" },
  renameInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12
  },
  renameActions: { flexDirection: "row", justifyContent: "flex-end", gap: 10 },
  renameBtn: {
    minWidth: 84,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 11,
    alignItems: "center"
  },
  renameBtnText: { fontWeight: "800" }
});
