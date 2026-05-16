import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Image,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
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
import { pickAndUploadPostImage } from "@/utils/postMediaUpload";
import { pickAndUploadProgramDocument } from "@/utils/programDocumentUpload";

type GroupMeta = {
  id: string;
  name: string;
  domain?: string;
  description?: string;
  avatarUrl?: string;
  rules?: string;
  schedule?: string;
  membersCount?: number;
  ownedByMe?: boolean;
  settings?: {
    joinApproval?: boolean;
    allowMemberMessages?: boolean;
    allowMemberMedia?: boolean;
    allowReactions?: boolean;
  };
};

type GroupMessage = {
  id: string;
  text: string;
  attachments?: { type: "image" | "file"; url: string; name?: string; mimeType?: string }[];
  reactions?: { emoji: string; count: number; reactedByMe?: boolean }[];
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

const MESSAGE_REACTIONS = ["\u{1F44D}", "\u2764\uFE0F", "\u2705", "\u{1F44F}"];
const COMPOSER_EMOJIS = ["\u{1F44D}", "\u2705", "\u{1F4CC}", "\u{1F64F}", "\u{1F525}"];

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
  const [attachments, setAttachments] = useState<{ type: "image" | "file"; url: string; name?: string; mimeType?: string }[]>([]);
  const [activeReactionMessageId, setActiveReactionMessageId] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsForm, setSettingsForm] = useState({
    name: "",
    description: "",
    rules: "",
    schedule: "",
    joinApproval: true,
    allowMemberMessages: true,
    allowMemberMedia: true,
    allowReactions: true
  });

  const resolvedGroupId = useMemo(() => String(groupId || "").trim(), [groupId]);
  const mediaDisabled = !group?.ownedByMe && group?.settings?.allowMemberMedia === false;

  const loadThread = useCallback(async (silent = false) => {
    if (!resolvedGroupId) return;
    try {
      if (!silent) setLoading(true);
      const { data } = await api.get<{ group: GroupMeta; messages: GroupMessage[] }>(
        `/api/network/mentor-groups/${resolvedGroupId}/messages`
      );
      setGroup(data.group || null);
      setMessages(data.messages || []);
      if (data.group) {
        setSettingsForm({
          name: data.group.name || "",
          description: data.group.description || "",
          rules: data.group.rules || "",
          schedule: data.group.schedule || "",
          joinApproval: data.group.settings?.joinApproval !== false,
          allowMemberMessages: data.group.settings?.allowMemberMessages !== false,
          allowMemberMedia: data.group.settings?.allowMemberMedia !== false,
          allowReactions: data.group.settings?.allowReactions !== false
        });
      }
    } catch (e: any) {
      if (!silent) Alert.alert("Unable to load group chat", e?.response?.data?.message || "Please try again.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [resolvedGroupId]);

  useEffect(() => {
    loadThread();
  }, [loadThread]);

  useEffect(() => {
    const interval = setInterval(() => {
      loadThread(true);
    }, 4000);
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
    if (!resolvedGroupId || (!text.trim() && !attachments.length)) return;
    try {
      setSending(true);
      if (editingId) {
        await api.patch(`/api/network/mentor-groups/${resolvedGroupId}/messages/${editingId}`, {
          text: text.trim()
        });
        setEditingId("");
      } else {
        await api.post(`/api/network/mentor-groups/${resolvedGroupId}/messages`, { text: text.trim(), attachments });
      }
      setText("");
      setAttachments([]);
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
    setAttachments([]);
  }

  async function attachPhoto() {
    try {
      const url = await pickAndUploadPostImage();
      if (url) setAttachments((current) => [...current, { type: "image", url, name: "Photo" }].slice(0, 4));
    } catch (e: any) {
      Alert.alert("Photo failed", e?.message || "Unable to attach photo.");
    }
  }

  async function attachFile() {
    try {
      const uploaded = await pickAndUploadProgramDocument();
      if (uploaded?.url) {
        setAttachments((current) => [
          ...current,
          { type: "file", url: uploaded.url, name: uploaded.fileName, mimeType: uploaded.mimeType }
        ].slice(0, 4));
      }
    } catch (e: any) {
      Alert.alert("File failed", e?.message || "Unable to attach file.");
    }
  }

  async function reactToMessage(message: GroupMessage, emoji: string) {
    if (!resolvedGroupId || !message.id) return;
    try {
      const { data } = await api.post<{ chatMessage?: GroupMessage }>(
        `/api/network/mentor-groups/${resolvedGroupId}/messages/${message.id}/reactions`,
        { emoji }
      );
      if (data.chatMessage) {
        setMessages((current) => current.map((item) => (item.id === message.id ? data.chatMessage! : item)));
      } else {
        await loadThread();
      }
      setActiveReactionMessageId("");
    } catch (e: any) {
      Alert.alert("Reaction failed", e?.response?.data?.message || "Please try again.");
    }
  }

  async function uploadGroupDp() {
    if (!resolvedGroupId) return;
    try {
      const url = await pickAndUploadPostImage();
      if (!url) return;
      await api.patch(`/api/network/mentor-groups/${resolvedGroupId}`, { avatarUrl: url });
      await loadThread();
    } catch (e: any) {
      Alert.alert("Group photo failed", e?.response?.data?.message || e?.message || "Please try again.");
    }
  }

  async function saveSettings() {
    if (!resolvedGroupId) return;
    try {
      setSavingSettings(true);
      await api.patch(`/api/network/mentor-groups/${resolvedGroupId}`, {
        name: settingsForm.name,
        description: settingsForm.description,
        rules: settingsForm.rules,
        schedule: settingsForm.schedule,
        settings: {
          joinApproval: settingsForm.joinApproval,
          allowMemberMessages: settingsForm.allowMemberMessages,
          allowMemberMedia: settingsForm.allowMemberMedia,
          allowReactions: settingsForm.allowReactions
        }
      });
      setSettingsOpen(false);
      await loadThread();
    } catch (e: any) {
      Alert.alert("Settings failed", e?.response?.data?.message || "Please try again.");
    } finally {
      setSavingSettings(false);
    }
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
    setActiveReactionMessageId(message.id);
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
        <View style={[styles.headerCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={20} color={colors.text} />
            </TouchableOpacity>
            <TouchableOpacity onPress={group?.ownedByMe ? uploadGroupDp : undefined} activeOpacity={group?.ownedByMe ? 0.8 : 1}>
              {group?.avatarUrl ? (
                <Image source={{ uri: group.avatarUrl }} style={styles.groupAvatar} />
              ) : (
                <View style={[styles.groupAvatarFallback, { backgroundColor: colors.accentSoft, borderColor: colors.border }]}>
                  <Text style={[styles.groupAvatarText, { color: colors.accent }]}>{(group?.name || "G").slice(0, 2).toUpperCase()}</Text>
                </View>
              )}
            </TouchableOpacity>
            <View style={styles.headerMeta}>
              <Text style={[styles.headerTitle, { color: colors.text }]}>{group?.name || "Mentor Group"}</Text>
              <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>
                {group?.membersCount || 0} members · {group?.domain || "Community"}
              </Text>
            </View>
          </View>
          {group?.description ? <Text style={[styles.headerDesc, { color: colors.textMuted }]}>{group.description}</Text> : null}
          {group?.rules ? <Text style={[styles.headerRules, { color: colors.text }]}>Rules: {group.rules}</Text> : null}
          {group?.ownedByMe ? (
            <TouchableOpacity style={[styles.settingsToggle, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }]} onPress={() => setSettingsOpen((value) => !value)}>
              <Ionicons name="settings-outline" size={16} color={colors.text} />
              <Text style={[styles.settingsToggleText, { color: colors.text }]}>{settingsOpen ? "Close settings" : "Group settings"}</Text>
            </TouchableOpacity>
          ) : null}
          {settingsOpen ? (
            <View style={[styles.settingsPanel, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
              <TextInput style={[styles.settingsInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]} value={settingsForm.name} onChangeText={(name) => setSettingsForm((current) => ({ ...current, name }))} placeholder="Group name" placeholderTextColor={colors.textMuted} />
              <TextInput style={[styles.settingsInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]} value={settingsForm.schedule} onChangeText={(schedule) => setSettingsForm((current) => ({ ...current, schedule }))} placeholder="Schedule" placeholderTextColor={colors.textMuted} />
              <TextInput style={[styles.settingsInput, styles.settingsArea, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]} value={settingsForm.description} onChangeText={(description) => setSettingsForm((current) => ({ ...current, description }))} placeholder="Description" placeholderTextColor={colors.textMuted} multiline />
              <TextInput style={[styles.settingsInput, styles.settingsArea, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]} value={settingsForm.rules} onChangeText={(rules) => setSettingsForm((current) => ({ ...current, rules }))} placeholder="Group rules" placeholderTextColor={colors.textMuted} multiline />
              {[
                ["joinApproval", "Approve join requests"],
                ["allowMemberMessages", "Students can send messages"],
                ["allowMemberMedia", "Students can send photos/files"],
                ["allowReactions", "Allow emoji reactions"]
              ].map(([key, label]) => (
                <View key={key} style={styles.settingRow}>
                  <Text style={[styles.settingLabel, { color: colors.text }]}>{label}</Text>
                  <Switch
                    value={Boolean((settingsForm as any)[key])}
                    onValueChange={(value) => setSettingsForm((current) => ({ ...current, [key]: value }))}
                    trackColor={{ false: colors.border, true: colors.accentSoft }}
                    thumbColor={Boolean((settingsForm as any)[key]) ? colors.accent : colors.textMuted}
                  />
                </View>
              ))}
              <TouchableOpacity style={[styles.saveButton, { backgroundColor: colors.accent }]} onPress={saveSettings} disabled={savingSettings}>
                <Text style={styles.saveButtonText}>{savingSettings ? "Saving..." : "Save Settings"}</Text>
              </TouchableOpacity>
            </View>
          ) : null}
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
                      onPress={() => setActiveReactionMessageId((current) => (current === message.id ? "" : message.id))}
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
                      {message.text ? <Text style={[styles.bubbleText, { color: mine ? "#FFFFFF" : colors.text }]}>{message.text}</Text> : null}
                      {(message.attachments || []).map((attachment, index) => (
                        <TouchableOpacity key={`${message.id}-${attachment.url}-${index}`} style={[styles.attachmentCard, { backgroundColor: mine ? "rgba(255,255,255,0.14)" : colors.surface, borderColor: mine ? "rgba(255,255,255,0.2)" : colors.border }]} onPress={() => Linking.openURL(attachment.url)}>
                          {attachment.type === "image" ? (
                            <Image source={{ uri: attachment.url }} style={styles.attachmentImage} />
                          ) : (
                            <View style={styles.fileRow}>
                              <Ionicons name="document-attach-outline" size={18} color={mine ? "#FFFFFF" : colors.accent} />
                              <Text style={[styles.fileName, { color: mine ? "#FFFFFF" : colors.text }]} numberOfLines={1}>{attachment.name || "Open file"}</Text>
                            </View>
                          )}
                        </TouchableOpacity>
                      ))}
                      {group?.settings?.allowReactions !== false && activeReactionMessageId === message.id ? (
                        <View style={[styles.reactionPicker, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                          {MESSAGE_REACTIONS.map((emoji) => {
                            const reaction = (message.reactions || []).find((item) => item.emoji === emoji);
                            return (
                              <TouchableOpacity key={emoji} style={[styles.reactionBtn, { backgroundColor: reaction?.reactedByMe ? "rgba(255,255,255,0.22)" : "transparent", borderColor: mine ? "rgba(255,255,255,0.25)" : colors.border }]} onPress={() => reactToMessage(message, emoji)}>
                                <Text style={styles.reactionText}>{emoji}{reaction?.count ? ` ${reaction.count}` : ""}</Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      ) : null}
                      {(message.reactions || []).some((item) => item.count > 0) && activeReactionMessageId !== message.id ? (
                        <View style={[styles.reactionSummary, { backgroundColor: mine ? "rgba(255,255,255,0.16)" : colors.surface, borderColor: mine ? "rgba(255,255,255,0.25)" : colors.border }]}>
                          {(message.reactions || []).filter((item) => item.count > 0).slice(0, 4).map((item) => (
                            <Text key={item.emoji} style={styles.reactionSummaryText}>{item.emoji}{item.count > 1 ? ` ${item.count}` : ""}</Text>
                          ))}
                        </View>
                      ) : null}
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
        <TouchableOpacity style={[styles.attachButton, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }, (editingId.length > 0 || mediaDisabled) && styles.disabledControl]} onPress={attachPhoto} disabled={editingId.length > 0 || mediaDisabled}>
          <Ionicons name="image-outline" size={18} color={colors.text} />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.attachButton, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }, (editingId.length > 0 || mediaDisabled) && styles.disabledControl]} onPress={attachFile} disabled={editingId.length > 0 || mediaDisabled}>
          <Ionicons name="attach-outline" size={18} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.composerMain}>
          {attachments.length ? (
            <View style={styles.pendingAttachments}>
              {attachments.map((attachment, index) => (
                <View key={`${attachment.url}-${index}`} style={[styles.pendingAttachment, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
                  <Ionicons name={attachment.type === "image" ? "image-outline" : "document-attach-outline"} size={14} color={colors.accent} />
                  <Text style={[styles.pendingAttachmentText, { color: colors.text }]} numberOfLines={1}>{attachment.name || (attachment.type === "image" ? "Photo" : "File")}</Text>
                  <TouchableOpacity onPress={() => setAttachments((current) => current.filter((_, itemIndex) => itemIndex !== index))}>
                    <Ionicons name="close" size={14} color={colors.textMuted} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          ) : null}
          <View style={styles.quickEmojiRow}>
            {COMPOSER_EMOJIS.map((emoji) => (
              <TouchableOpacity key={emoji} style={[styles.quickEmojiBtn, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]} onPress={() => setText((current) => `${current}${emoji}`)}>
                <Text style={styles.quickEmojiText}>{emoji}</Text>
              </TouchableOpacity>
            ))}
          </View>
        <TextInput
          style={[styles.input, { color: colors.text }]}
          value={text}
          onChangeText={setText}
          placeholder="Message..."
          placeholderTextColor={colors.textMuted}
          multiline
        />
        </View>
        <TouchableOpacity
          style={[styles.sendBtn, { backgroundColor: colors.accent }, ((!text.trim() && !attachments.length) || sending) && styles.sendBtnDisabled]}
          onPress={sendMessage}
          disabled={(!text.trim() && !attachments.length) || sending}
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
  groupAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23
  },
  groupAvatarFallback: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  groupAvatarText: {
    fontSize: 15,
    fontWeight: "900"
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
  headerRules: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 18
  },
  settingsToggle: {
    marginTop: 10,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  settingsToggleText: {
    fontSize: 12,
    fontWeight: "900"
  },
  settingsPanel: {
    marginTop: 10,
    borderWidth: 1,
    borderRadius: 14,
    padding: 10,
    gap: 8
  },
  settingsInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 9,
    fontWeight: "700"
  },
  settingsArea: {
    minHeight: 70,
    textAlignVertical: "top"
  },
  settingRow: {
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10
  },
  settingLabel: {
    flex: 1,
    fontSize: 12,
    fontWeight: "800"
  },
  saveButton: {
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: "center"
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontWeight: "900"
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
  attachmentCard: {
    borderWidth: 1,
    borderRadius: 12,
    marginTop: 8,
    overflow: "hidden"
  },
  attachmentImage: {
    width: 210,
    height: 150
  },
  fileRow: {
    minWidth: 180,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 10
  },
  fileName: {
    flex: 1,
    fontSize: 12,
    fontWeight: "800"
  },
  reactionPicker: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 8,
    borderWidth: 1,
    borderRadius: 18,
    padding: 6,
    alignSelf: "flex-start"
  },
  reactionBtn: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 4
  },
  reactionText: {
    fontSize: 12,
    fontWeight: "800"
  },
  reactionSummary: {
    borderWidth: 1,
    borderRadius: 999,
    flexDirection: "row",
    gap: 4,
    alignSelf: "flex-start",
    marginTop: 6,
    paddingHorizontal: 7,
    paddingVertical: 3
  },
  reactionSummaryText: {
    fontSize: 12,
    fontWeight: "800"
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
  composerMain: {
    flex: 1
  },
  attachButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4
  },
  disabledControl: {
    opacity: 0.45
  },
  pendingAttachments: {
    gap: 6,
    marginBottom: 6
  },
  pendingAttachment: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  pendingAttachmentText: {
    flex: 1,
    fontSize: 12,
    fontWeight: "800"
  },
  quickEmojiRow: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 6
  },
  quickEmojiBtn: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  quickEmojiText: {
    fontSize: 13
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
