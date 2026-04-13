import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useAppTheme } from "@/context/ThemeContext";
import GlobalHeader from "@/components/global-header";

type GroupMeta = {
  id: string;
  name: string;
  domain?: string;
  description?: string;
  membersCount?: number;
};

type GroupMessage = {
  id: string;
  text: string;
  createdAt: string;
  editedAt?: string | null;
  sender: {
    id: string;
    name?: string;
    role?: string;
  };
};

function formatTime(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function MentorGroupChatScreen() {
  const router = useRouter();
  const { groupId } = useLocalSearchParams<{ groupId?: string }>();
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const [loading, setLoading] = useState(true);
  const [group, setGroup] = useState<GroupMeta | null>(null);
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [editingId, setEditingId] = useState("");
  const scrollRef = useRef<ScrollView | null>(null);

  const resolvedGroupId = useMemo(() => String(groupId || "").trim(), [groupId]);

  const loadThread = useCallback(async () => {
    if (!resolvedGroupId) return;
    try {
      setLoading(true);
      const { data } = await api.get<{ group: GroupMeta; messages: GroupMessage[] }>(
        `/api/network/mentor-groups/${resolvedGroupId}/messages`
      );
      setGroup(data.group || null);
      setMessages(data.messages || []);
    } catch (e: any) {
      Alert.alert("Unable to load group chat", e?.response?.data?.message || "Please try again.");
    } finally {
      setLoading(false);
    }
  }, [resolvedGroupId]);

  useEffect(() => {
    loadThread();
  }, [loadThread]);

  useEffect(() => {
    const interval = setInterval(() => {
      loadThread();
    }, 7000);
    return () => clearInterval(interval);
  }, [loadThread]);

  useEffect(() => {
    if (!scrollRef.current) return;
    const timeout = setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 300);
    return () => clearTimeout(timeout);
  }, [messages.length]);

  async function sendMessage() {
    if (!resolvedGroupId || !text.trim()) return;
    try {
      setSending(true);
      if (editingId) {
        await api.patch(`/api/network/mentor-groups/${resolvedGroupId}/messages/${editingId}`, {
          text: text.trim()
        });
        setEditingId("");
      } else {
        await api.post(`/api/network/mentor-groups/${resolvedGroupId}/messages`, { text: text.trim() });
      }
      setText("");
      await loadThread();
    } catch (e: any) {
      Alert.alert("Message failed", e?.response?.data?.message || "Please try again.");
    } finally {
      setSending(false);
    }
  }

  function beginEdit(message: GroupMessage) {
    setEditingId(message.id);
    setText(message.text);
  }

  function cancelEdit() {
    setEditingId("");
    setText("");
  }

  async function deleteMessage(message: GroupMessage) {
    try {
      await api.delete(`/api/network/mentor-groups/${resolvedGroupId}/messages/${message.id}`);
      await loadThread();
    } catch (e: any) {
      Alert.alert("Delete failed", e?.response?.data?.message || "Please try again.");
    }
  }

  async function copyMessage(message: GroupMessage) {
    await Clipboard.setStringAsync(message.text || "");
    Alert.alert("Copied", "Message copied to clipboard.");
  }

  function handleMessageActions(message: GroupMessage) {
    const mine = String(message.sender?.id || "") === String(user?.id || "");
    const actions = [
      { text: "Copy", onPress: () => copyMessage(message) },
      mine ? { text: "Edit", onPress: () => beginEdit(message) } : null,
      mine ? { text: "Delete", style: "destructive" as const, onPress: () => deleteMessage(message) } : null,
      { text: "Cancel", style: "cancel" as const }
    ].filter(Boolean) as { text: string; onPress?: () => void; style?: "cancel" | "destructive" }[];

    Alert.alert("Message actions", "Choose an action", actions);
  }

  if (!resolvedGroupId) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={[styles.emptyText, { color: colors.textMuted }]}>No group selected.</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 0}
    >
      <ScrollView
        ref={(ref) => (scrollRef.current = ref)}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 120 }]}
        keyboardShouldPersistTaps="handled"
      >
        <GlobalHeader title={group?.name || "Mentor Group"} subtitle={group?.domain || ""} />

        <View style={[styles.headerCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={20} color={colors.text} />
            </TouchableOpacity>
            <View style={styles.headerMeta}>
              <Text style={[styles.headerTitle, { color: colors.text }]}>{group?.name || "Mentor Group"}</Text>
              <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>
                {group?.membersCount || 0} members · {group?.domain || "Community"}
              </Text>
            </View>
          </View>
          {group?.description ? <Text style={[styles.headerDesc, { color: colors.textMuted }]}>{group.description}</Text> : null}
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.accent} />
            <Text style={[styles.loadingText, { color: colors.textMuted }]}>Loading messages...</Text>
          </View>
        ) : (
          <View style={styles.messageList}>
            {messages.length === 0 ? (
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>Start the first message in this group.</Text>
            ) : (
              messages.map((message) => {
                const mine = String(message.sender?.id || "") === String(user?.id || "");
                return (
                  <View key={message.id} style={[styles.messageRow, mine ? styles.messageRowMine : styles.messageRowOther]}>
                    <TouchableOpacity
                      onLongPress={() => handleMessageActions(message)}
                      style={[
                        styles.bubble,
                        mine
                          ? [styles.bubbleMine, { backgroundColor: colors.accent }]
                          : [styles.bubbleOther, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]
                      ]}
                      activeOpacity={0.9}
                    >
                      {!mine ? (
                        <Text style={[styles.senderName, { color: colors.accent }]}>{message.sender?.name || "Member"}</Text>
                      ) : null}
                      <Text style={[styles.bubbleText, { color: mine ? "#FFFFFF" : colors.text }]}>{message.text}</Text>
                      <View style={styles.bubbleFooter}>
                        <Text style={[styles.bubbleMeta, { color: mine ? "#D1FADF" : colors.textMuted }]}>
                          {formatTime(message.createdAt)}
                        </Text>
                        {message.editedAt ? (
                          <Text style={[styles.bubbleMeta, { color: mine ? "#D1FADF" : colors.textMuted }]}>Edited</Text>
                        ) : null}
                      </View>
                    </TouchableOpacity>
                  </View>
                );
              })
            )}
          </View>
        )}
      </ScrollView>

      {editingId ? (
        <View style={[styles.editBar, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
          <Text style={[styles.editText, { color: colors.text }]}>Editing message</Text>
          <TouchableOpacity onPress={cancelEdit}>
            <Ionicons name="close-circle" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      ) : null}

      <View style={[styles.composer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <TextInput
          style={[styles.input, { color: colors.text }]}
          value={text}
          onChangeText={setText}
          placeholder="Message..."
          placeholderTextColor={colors.textMuted}
          multiline
        />
        <TouchableOpacity
          style={[styles.sendBtn, { backgroundColor: colors.accent }, (!text.trim() || sending) && styles.sendBtnDisabled]}
          onPress={sendMessage}
          disabled={!text.trim() || sending}
        >
          <Ionicons name="send" size={16} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    padding: 16,
    paddingBottom: 140
  },
  center: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 24
  },
  loadingText: {
    marginTop: 10,
    fontWeight: "600"
  },
  headerCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    marginBottom: 16
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  headerMeta: {
    flex: 1
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "800"
  },
  headerSubtitle: {
    marginTop: 4,
    fontWeight: "600"
  },
  headerDesc: {
    marginTop: 8,
    fontWeight: "600"
  },
  messageList: {
    gap: 10
  },
  messageRow: {
    flexDirection: "row"
  },
  messageRowMine: {
    justifyContent: "flex-end"
  },
  messageRowOther: {
    justifyContent: "flex-start"
  },
  bubble: {
    maxWidth: "82%",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  bubbleMine: {
    backgroundColor: "#1F7A4C"
  },
  bubbleOther: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E4E7EC"
  },
  senderName: {
    fontWeight: "800",
    fontSize: 12,
    marginBottom: 4
  },
  bubbleText: {
    fontWeight: "600",
    lineHeight: 20
  },
  bubbleFooter: {
    flexDirection: "row",
    gap: 8,
    marginTop: 6,
    justifyContent: "flex-end"
  },
  bubbleMeta: {
    fontSize: 11,
    fontWeight: "600"
  },
  emptyText: {
    textAlign: "center",
    fontWeight: "600"
  },
  composer: {
    borderTopWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 140,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: "transparent"
  },
  sendBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center"
  },
  sendBtnDisabled: {
    opacity: 0.6
  },
  editBar: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  editText: {
    fontWeight: "700"
  }
});
