import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
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
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useAppTheme } from "@/context/ThemeContext";
import GlobalHeader from "@/components/global-header";

type CounterpartUser = {
  _id: string;
  name: string;
  email: string;
  role: "student" | "mentor" | "admin";
  status?: "pending" | "approved";
  profilePhotoUrl?: string;
  isOnline?: boolean;
  isTyping?: boolean;
  lastSeenAt?: string | null;
};

type Conversation = {
  counterpartId: string;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
  lastMessageSenderId?: string;
  lastMessageReadAt?: string | null;
  counterpart: CounterpartUser;
};

type ChatMessage = {
  _id: string;
  sender: string;
  recipient: string;
  text: string;
  createdAt: string;
  readAt?: string | null;
};

type StudentSession = {
  _id: string;
  paymentStatus?: "pending" | "waiting_verification" | "verified" | "rejected" | "paid";
  sessionStatus?: "booked" | "confirmed" | "completed";
  mentorId?: {
    _id?: string;
    name?: string;
    email?: string;
    profilePhotoUrl?: string;
  };
};

type ConnectionRow = {
  _id: string;
  requesterId?: { _id?: string; name?: string; role?: "student" | "mentor" | "admin"; profilePhotoUrl?: string } | null;
  recipientId?: { _id?: string; name?: string; role?: "student" | "mentor" | "admin"; profilePhotoUrl?: string } | null;
};

const QUICK_EMOJIS = [":)", "<3", "gg", "idea", "go", "ty"];

const MESSAGE_TABS = ["Mentors", "Circle"] as const;

function formatMessageTime(dateValue?: string) {
  if (!dateValue) return "";
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatConversationTime(dateValue?: string) {
  if (!dateValue) return "";
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  const sameDay = now.toDateString() === date.toDateString();
  return sameDay
    ? date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : date.toLocaleDateString([], { day: "2-digit", month: "short" });
}

function formatPresence(user?: CounterpartUser | null, typing = false) {
  if (!user) return "Select a conversation";
  if (typing) return `${user.name.split(" ")[0]} is typing...`;
  if (user.isOnline) return "Online";
  if (user.lastSeenAt) {
    const date = new Date(user.lastSeenAt);
    if (!Number.isNaN(date.getTime())) {
      return `Last seen ${date.toLocaleString([], {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit"
      })}`;
    }
  }
  return "Recently active";
}

function getInitial(name?: string) {
  return String(name || "U").trim().charAt(0).toUpperCase() || "U";
}

export default function ChatScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ userId?: string }>();
  const requestedUserId = useMemo(() => (params.userId || "").trim(), [params.userId]);
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const [searchQuery, setSearchQuery] = useState("");

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [confirmedMentors, setConfirmedMentors] = useState<CounterpartUser[]>([]);
  const [circleContacts, setCircleContacts] = useState<CounterpartUser[]>([]);
  const [activeUserId, setActiveUserId] = useState<string>("");
  const [activeUser, setActiveUser] = useState<CounterpartUser | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [activeTyping, setActiveTyping] = useState(false);
  const [showEmojiBar, setShowEmojiBar] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<(typeof MESSAGE_TABS)[number]>("Mentors");
  const [profilePhotoById, setProfilePhotoById] = useState<Record<string, string>>({});
  const [threadMode, setThreadMode] = useState(false);

  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingActiveRef = useRef(false);

  const activeConversation = useMemo(
    () => conversations.find((item) => item.counterpartId === activeUserId) || null,
    [activeUserId, conversations]
  );

  const filteredConversations = useMemo(() => {
    const baseRows = conversations.filter((item) =>
      activeTab === "Mentors" ? item.counterpart.role === "mentor" : item.counterpart.role !== "mentor"
    );
    const query = searchQuery.trim().toLowerCase();
    if (!query) return baseRows;
    return baseRows.filter((item) =>
      `${item.counterpart.name} ${item.counterpart.email || ""} ${item.lastMessage || ""}`.toLowerCase().includes(query)
    );
  }, [activeTab, conversations, searchQuery]);

  const filteredMentors = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return confirmedMentors;
    return confirmedMentors.filter((item) => `${item.name} ${item.email || ""}`.toLowerCase().includes(query));
  }, [confirmedMentors, searchQuery]);

  const filteredCircleContacts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return circleContacts;
    return circleContacts.filter((item) => `${item.name} ${item.role || ""}`.toLowerCase().includes(query));
  }, [circleContacts, searchQuery]);

  const contactLookup = useMemo(() => {
    const next = new Map<string, CounterpartUser>();
    confirmedMentors.forEach((item) => next.set(String(item._id || ""), item));
    circleContacts.forEach((item) => next.set(String(item._id || ""), item));
    conversations.forEach((item) => next.set(String(item.counterpartId || ""), item.counterpart));
    return next;
  }, [circleContacts, confirmedMentors, conversations]);

  useEffect(() => {
    if (!filteredConversations.length || activeUserId) return;
    const stillVisible = filteredConversations.some((item) => item.counterpartId === activeUserId);
    if (!stillVisible) {
      setActiveUserId(filteredConversations[0].counterpartId);
    }
  }, [activeUserId, filteredConversations]);

  const lastOutgoingMessageId = useMemo(() => {
    const lastMine = [...messages].reverse().find((item) => item.sender === user?.id);
    return lastMine?._id || "";
  }, [messages, user?.id]);

  useEffect(() => {
    if (requestedUserId) {
      setActiveUserId(requestedUserId);
      setThreadMode(true);
    }
  }, [requestedUserId]);

  const loadConversations = useCallback(async () => {
    try {
      setError(null);
      const [conversationRes, sessionsRes] = await Promise.all([
        api.get<Conversation[]>("/api/chat/conversations"),
        user?.role === "student"
          ? api.get<StudentSession[]>("/api/sessions/student/me")
          : Promise.resolve({ data: [] as StudentSession[] })
      ]);

      const data = conversationRes.data || [];
      setConversations(data);

      if (user?.role === "student") {
        const mentorMap = new Map<string, CounterpartUser>();
        (sessionsRes.data || []).forEach((session) => {
          const mentor = session.mentorId;
          if (!mentor?._id) return;
          const isConfirmedSession = session.sessionStatus === "confirmed";
          const isPaid = session.paymentStatus === "paid" || session.paymentStatus === "verified";
          if (!isConfirmedSession || !isPaid) return;
          mentorMap.set(mentor._id, {
            _id: mentor._id,
            name: mentor.name || "Mentor",
            email: mentor.email || "",
            role: "mentor",
            status: "approved",
            profilePhotoUrl: mentor.profilePhotoUrl || ""
          });
        });
        setConfirmedMentors(Array.from(mentorMap.values()));
      } else {
        setConfirmedMentors([]);
      }

      const acceptedConnectionsRes = await api.get<ConnectionRow[]>("/api/network/connections?status=accepted");
      const me = String(user?.id || "");
      const nextCircle = (acceptedConnectionsRes.data || [])
        .map((item) => {
          const requesterId = String(item?.requesterId?._id || "");
          const recipientId = String(item?.recipientId?._id || "");
          const other = requesterId === me ? item?.recipientId : recipientId === me ? item?.requesterId : null;
          if (!other?._id || String(other.role || "").toLowerCase() === "mentor") return null;
          return {
            _id: other._id,
            name: other.name || "Connection",
            email: "",
            role: (other.role || "student") as CounterpartUser["role"],
            status: "approved" as const,
            profilePhotoUrl: other.profilePhotoUrl || ""
          };
        })
        .filter((item): item is CounterpartUser => Boolean(item));
      setCircleContacts(nextCircle);

      if (!activeUserId && data.length > 0) {
        setActiveUserId(data[0].counterpartId);
      }
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to load chats.");
    } finally {
      setLoading(false);
    }
  }, [activeUserId, user?.role]);

  const loadThread = useCallback(async () => {
    if (!activeUserId) {
      setMessages([]);
      setActiveUser(null);
      setActiveTyping(false);
      return;
    }

    const knownUser = contactLookup.get(activeUserId) || null;
    if (knownUser) {
      setActiveUser((prev) => ({
        ...(prev || {}),
        ...knownUser,
        profilePhotoUrl: knownUser.profilePhotoUrl || prev?.profilePhotoUrl || ""
      }));
    }

    try {
      setError(null);
      const [{ data }, typingRes] = await Promise.all([
        api.get<{ counterpart: CounterpartUser; messages: ChatMessage[] }>(`/api/chat/messages/${activeUserId}`),
        api.get<{ isTyping: boolean; isOnline: boolean; lastSeenAt: string | null }>(
          `/api/chat/messages/${activeUserId}/typing`
        )
      ]);

      const counterpart = {
        ...(data.counterpart || {}),
        isTyping: Boolean(typingRes.data?.isTyping),
        isOnline: Boolean(typingRes.data?.isOnline),
        lastSeenAt: typingRes.data?.lastSeenAt || data.counterpart?.lastSeenAt || null
      };

      setActiveUser(counterpart);
      setActiveTyping(Boolean(typingRes.data?.isTyping));
      setMessages(data.messages || []);
      await api.patch(`/api/chat/messages/${activeUserId}/read`);
    } catch (e: any) {
      if (knownUser) {
        setMessages([]);
        setActiveTyping(false);
        setError(null);
        return;
      }
      setError(e?.response?.data?.message || "Failed to load messages.");
    }
  }, [activeUserId, contactLookup]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadConversations();
    }, [loadConversations])
  );

  useEffect(() => {
    loadThread();
  }, [loadThread]);

  useEffect(() => {
    if (!activeUserId) return;
    const interval = setInterval(() => {
      loadConversations();
      loadThread();
    }, 5000);
    return () => clearInterval(interval);
  }, [activeUserId, loadConversations, loadThread]);

  useEffect(() => {
    let cancelled = false;
    const missingIds = Array.from(
      new Set(
        [
          ...circleContacts.filter((item) => !item.profilePhotoUrl).map((item) => String(item._id || "").trim()),
          ...conversations.filter((item) => !item.counterpart.profilePhotoUrl).map((item) => String(item.counterpartId || "").trim()),
          activeUser && !activeUser.profilePhotoUrl ? String(activeUser._id || "").trim() : ""
        ].filter((id) => id && !profilePhotoById[id])
      )
    ).slice(0, 18);

    if (missingIds.length === 0) return;

    (async () => {
      const rows = await Promise.all(
        missingIds.map(async (id) => {
          try {
            const { data } = await api.get(`/api/profiles/public/${id}`);
            return [id, data?.profile?.profilePhotoUrl || ""] as const;
          } catch {
            return [id, ""] as const;
          }
        })
      );

      if (cancelled) return;

      setProfilePhotoById((prev) => {
        const next = { ...prev };
        let changed = false;
        rows.forEach(([id, url]) => {
          if (url && next[id] !== url) {
            next[id] = url;
            changed = true;
          }
        });
        return changed ? next : prev;
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [activeUser, circleContacts, conversations, profilePhotoById]);

  useEffect(() => {
    return () => {
      if (typingTimerRef.current) {
        clearTimeout(typingTimerRef.current);
      }
      if (typingActiveRef.current && activeUserId) {
        api.post(`/api/chat/messages/${activeUserId}/typing`, { isTyping: false }).catch(() => null);
      }
    };
  }, [activeUserId]);

  async function setTyping(isTyping: boolean) {
    if (!activeUserId) return;
    try {
      await api.post(`/api/chat/messages/${activeUserId}/typing`, { isTyping });
      typingActiveRef.current = isTyping;
    } catch {
      // keep chat responsive even if typing heartbeat fails
    }
  }

  function handleTextChange(value: string) {
    setText(value);
    setShowEmojiBar(false);
    const hasText = value.trim().length > 0;

    if (!activeUserId) return;

    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
    }

    if (hasText && !typingActiveRef.current) {
      setTyping(true);
    }

    if (!hasText && typingActiveRef.current) {
      setTyping(false);
      return;
    }

    typingTimerRef.current = setTimeout(() => {
      if (typingActiveRef.current) {
        setTyping(false);
      }
    }, 1800);
  }

  async function sendMessage() {
    if (!activeUserId || !text.trim()) return;

    try {
      setSending(true);
      setError(null);
      await api.post(`/api/chat/messages/${activeUserId}`, { text: text.trim() });
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingActiveRef.current = false;
      setText("");
      setShowEmojiBar(false);
      await loadThread();
      await loadConversations();
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to send message.");
    } finally {
      setSending(false);
    }
  }

  function appendEmoji(emoji: string) {
    handleTextChange(`${text}${emoji}`);
  }

  function handleAttachment() {
    Alert.alert("Attachments", "File sharing will be added next. The button is now placed in the final chat layout.");
  }

  function openThread(userId: string) {
    if (!userId) return;
    setActiveUserId(userId);
    setThreadMode(true);
    setMessages([]);
    setError(null);
  }

  function closeThread() {
    setThreadMode(false);
  }

  if (user?.role !== "student" && user?.role !== "mentor") {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={[styles.error, { color: colors.danger }]}>Chat is only available for students and mentors.</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 84 : 0}
    >
      {!threadMode ? (
        <GlobalHeader
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder="Search mentors or circle chats"
        />
      ) : null}
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {!threadMode ? (
        <>
        <View style={styles.screenHeader}>
          <Text style={[styles.heading, { color: colors.text }]}>Messages</Text>
          <Text style={[styles.subTitle, { color: colors.textMuted }]}>Stay close to mentors and your circle from one clean conversation hub.</Text>
        </View>

        {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}

        <View style={styles.tabRow}>
          {MESSAGE_TABS.map((tab) => {
            const active = activeTab === tab;
            return (
              <TouchableOpacity
                key={tab}
                style={[
                  styles.tabChip,
                  { borderColor: colors.border, backgroundColor: colors.surface },
                  active && [styles.tabChipActive, { borderColor: colors.accent, backgroundColor: colors.accentSoft }]
                ]}
                onPress={() => setActiveTab(tab)}
              >
                <Text style={[styles.tabChipText, { color: colors.textMuted }, active && [styles.tabChipTextActive, { color: colors.accent }]]}>{tab}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.quickActionsRow}>
          <TouchableOpacity
            style={[styles.quickActionBtn, { borderColor: colors.border, backgroundColor: colors.surface }]}
            onPress={() => (activeTab === "Mentors" ? router.push("/mentors" as never) : router.push("/network?section=connections" as never))}
          >
            <Ionicons name="search-outline" size={16} color={colors.accent} />
            <Text style={[styles.quickActionText, { color: colors.text }]}>{activeTab === "Mentors" ? "Find Mentor" : "Find People"}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.quickActionBtn, { borderColor: colors.border, backgroundColor: colors.surface }]}
            onPress={() => {
              const nextId =
                activeTab === "Mentors"
                  ? filteredMentors[0]?._id || filteredConversations[0]?.counterpartId || ""
                  : filteredCircleContacts[0]?._id || filteredConversations[0]?.counterpartId || "";
              if (nextId) {
                openThread(nextId);
                return;
              }
              router.push(activeTab === "Mentors" ? ("/mentors" as never) : ("/network?section=connections" as never));
            }}
          >
            <Ionicons name="add-outline" size={16} color={colors.accent} />
            <Text style={[styles.quickActionText, { color: colors.text }]}>New Chat</Text>
          </TouchableOpacity>
        </View>

        {user?.role === "student" && activeTab === "Mentors" ? (
          <>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Confirmed Mentors</Text>
            {filteredMentors.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.confirmedList}
                contentContainerStyle={styles.confirmedListContent}
              >
                {filteredMentors.map((item) => (
                  <TouchableOpacity key={item._id} style={[styles.mentorProfileCard, { borderColor: colors.border, backgroundColor: colors.surface }]} onPress={() => openThread(item._id)}>
                    {item.profilePhotoUrl ? (
                      <Image source={{ uri: item.profilePhotoUrl }} style={styles.avatar} />
                    ) : (
                      <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: colors.accentSoft }]}>
                        <Text style={styles.avatarText}>{getInitial(item.name)}</Text>
                      </View>
                    )}
                    <Text style={[styles.mentorName, { color: colors.text }]} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={[styles.mentorMail, { color: colors.textMuted }]} numberOfLines={1}>
                      {item.email || "Confirmed mentor"}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            ) : (
              <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={styles.emptyEmoji}>💬</Text>
                <Text style={[styles.emptyTitle, { color: colors.text }]}>Start a conversation</Text>
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>Connect with people from Network or confirm a mentor session to begin chatting.</Text>
              </View>
            )}
          </>
        ) : null}

        {activeTab === "Circle" ? (
          <>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Your Circle</Text>
            {filteredCircleContacts.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.confirmedList}
                contentContainerStyle={styles.confirmedListContent}
              >
                {filteredCircleContacts.map((item) => (
                  <TouchableOpacity key={item._id} style={[styles.mentorProfileCard, { borderColor: colors.border, backgroundColor: colors.surface }]} onPress={() => openThread(item._id)}>
                    {item.profilePhotoUrl || profilePhotoById[item._id] ? (
                      <Image source={{ uri: item.profilePhotoUrl || profilePhotoById[item._id] }} style={styles.avatar} />
                    ) : (
                      <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: colors.accentSoft }]}>
                        <Text style={styles.avatarText}>{getInitial(item.name)}</Text>
                      </View>
                    )}
                    <Text style={[styles.mentorName, { color: colors.text }]} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={[styles.mentorMail, { color: colors.textMuted }]} numberOfLines={1}>
                      {item.role}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            ) : (
              <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={styles.emptyEmoji}>💬</Text>
                <Text style={[styles.emptyTitle, { color: colors.text }]}>No circle contacts yet</Text>
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>Accepted non-mentor connections from your circle will appear here.</Text>
              </View>
            )}
          </>
        ) : null}

        <Text style={[styles.sectionTitle, { color: colors.text }]}>Recent Chats</Text>
        <View style={styles.conversationList}>
          {filteredConversations.length > 0 ? (
            filteredConversations.map((item) => {
              const isActive = activeUserId === item.counterpartId;
              return (
                <TouchableOpacity
                  key={item.counterpartId}
                  style={[
                    styles.conversationRow,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                    isActive && [styles.conversationRowActive, { borderColor: colors.accent, backgroundColor: colors.accentSoft }]
                  ]}
                  onPress={() => openThread(item.counterpartId)}
                >
                  <View>
                    {item.counterpart.profilePhotoUrl || profilePhotoById[item.counterpartId] ? (
                      <Image source={{ uri: item.counterpart.profilePhotoUrl || profilePhotoById[item.counterpartId] }} style={styles.avatarLarge} />
                    ) : (
                      <View style={[styles.avatarLarge, styles.avatarFallback, { backgroundColor: colors.accentSoft }]}>
                        <Text style={styles.avatarText}>{getInitial(item.counterpart.name)}</Text>
                      </View>
                    )}
                    {item.counterpart.isOnline ? <View style={styles.onlineDot} /> : null}
                  </View>
                  <View style={styles.conversationBody}>
                    <View style={styles.conversationTopLine}>
                      <Text style={[styles.conversationName, { color: colors.text }]}>{item.counterpart.name}</Text>
                      <Text style={[styles.conversationTime, { color: colors.textMuted }]}>{formatConversationTime(item.lastMessageAt)}</Text>
                    </View>
                    <Text style={[styles.conversationMeta, { color: colors.textMuted }]}>
                      {item.counterpart.isTyping
                        ? `${item.counterpart.name.split(" ")[0]} is typing...`
                        : item.lastMessage || "Start chatting"}
                    </Text>
                  </View>
                  {item.unreadCount > 0 ? (
                    <View style={styles.unreadBadge}>
                      <Text style={styles.unreadText}>{item.unreadCount > 9 ? "9+" : item.unreadCount}</Text>
                    </View>
                  ) : null}
                </TouchableOpacity>
              );
            })
          ) : (
            <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={styles.emptyEmoji}>💬</Text>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No {activeTab.toLowerCase()} conversations yet</Text>
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                {activeTab === "Mentors"
                  ? "Connect with mentors or confirm a mentorship session to start chatting."
                  : "Connect with accepted circle friends to start your first circle chat."}
              </Text>
            </View>
          )}
        </View>

        </>
        ) : null}

        <View style={[styles.threadCard, threadMode && styles.threadCardFull, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.threadHeader, { borderBottomColor: colors.border }]}>
            <View style={styles.threadIdentity}>
              {threadMode ? (
                <TouchableOpacity style={[styles.backPill, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]} onPress={closeThread}>
                  <Ionicons name="arrow-back" size={18} color={colors.text} />
                </TouchableOpacity>
              ) : null}
              {activeUser?.profilePhotoUrl || (activeUser?._id ? profilePhotoById[String(activeUser._id)] : "") ? (
                <Image source={{ uri: activeUser?.profilePhotoUrl || profilePhotoById[String(activeUser?._id || "")] }} style={styles.avatarLarge} />
              ) : (
                <View style={[styles.avatarLarge, styles.avatarFallback, { backgroundColor: colors.accentSoft }]}>
                  <Text style={styles.avatarText}>{getInitial(activeUser?.name)}</Text>
                </View>
              )}
              <View style={styles.threadHeaderText}>
                <Text style={[styles.threadTitle, { color: colors.text }]}>{activeUser?.name || "Select a conversation"}</Text>
                <Text style={[styles.threadPresence, { color: colors.textMuted }]}>{formatPresence(activeUser, activeTyping)}</Text>
              </View>
            </View>
            {activeUser?.isOnline ? (
              <View style={[styles.threadOnlinePill, { backgroundColor: colors.accentSoft }]}>
                <Text style={[styles.threadOnlineText, { color: colors.accent }]}>Online</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.messageList}>
            {messages.length > 0 ? (
              messages.map((item) => {
                const mine = item.sender === user?.id;
                const isLastMine = mine && item._id === lastOutgoingMessageId;
                const statusText = item.readAt ? "Seen" : "Sent";
                return (
                  <View key={item._id} style={[styles.messageRow, mine ? styles.messageRowMine : styles.messageRowOther]}>
                    <View
                      style={[
                        styles.bubble,
                        mine
                          ? [styles.bubbleMine, { backgroundColor: colors.accent }]
                          : [styles.bubbleOther, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]
                      ]}
                    >
                      <Text style={[styles.bubbleText, { color: mine ? "#FFFFFF" : colors.text }, mine && styles.bubbleTextMine]}>{item.text}</Text>
                      <View style={styles.bubbleFooter}>
                        <Text style={[styles.bubbleMeta, { color: mine ? "#D1FADF" : colors.textMuted }, mine && styles.bubbleMetaMine]}>
                          {formatMessageTime(item.createdAt)}
                        </Text>
                        {isLastMine ? (
                          <View style={styles.readStateWrap}>
                            <Ionicons
                              name={item.readAt ? "checkmark-done" : "checkmark"}
                              size={12}
                              color={mine ? "#D1FADF" : "#98A2B3"}
                            />
                            <Text style={[styles.readStateText, mine && styles.readStateTextMine]}>{statusText}</Text>
                          </View>
                        ) : null}
                      </View>
                    </View>
                  </View>
                );
              })
            ) : (
              <View style={styles.emptyThread}>
                <Text style={styles.emptyEmoji}>💬</Text>
                <Text style={[styles.emptyTitle, { color: colors.text }]}>Start a conversation</Text>
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>Choose a chat above and send the first message.</Text>
              </View>
            )}
          </View>

          {showEmojiBar ? (
            <View style={[styles.emojiBar, { borderTopColor: colors.border }]}>
              {QUICK_EMOJIS.map((emoji) => (
                <TouchableOpacity key={emoji} style={[styles.emojiBtn, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]} onPress={() => appendEmoji(emoji)}>
                  <Text style={styles.emojiText}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}

          <View style={[styles.composer, { borderTopColor: colors.border }]}>
            <TouchableOpacity style={[styles.iconBtn, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]} onPress={handleAttachment} disabled={!activeUserId}>
              <Ionicons name="add" size={20} color={colors.textMuted} />
            </TouchableOpacity>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
              value={text}
              onChangeText={handleTextChange}
              placeholder={activeUserId ? "Message..." : "Select a chat first"}
              placeholderTextColor={colors.textMuted}
              editable={!!activeUserId && !sending}
              multiline
            />
            <TouchableOpacity style={[styles.iconBtn, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]} onPress={() => setShowEmojiBar((prev) => !prev)} disabled={!activeUserId}>
              <Ionicons name="happy-outline" size={20} color={colors.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.sendBtn, { backgroundColor: colors.accent }, (!activeUserId || sending || !text.trim()) && styles.sendBtnDisabled]}
              onPress={sendMessage}
              disabled={!activeUserId || sending || !text.trim()}
            >
              <Ionicons name="send" size={16} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F4F9F6",
    padding: 16
  },
  scrollContent: {
    paddingBottom: 120
  },
  threadCardFull: {
    minHeight: 640,
    marginTop: 4
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F4F9F6"
  },
  screenHeader: {
    marginBottom: 12
  },
  heading: {
    fontSize: 26,
    fontWeight: "800",
    color: "#13251E"
  },
  subTitle: {
    marginTop: 4,
    color: "#667085",
    fontWeight: "600"
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#1E2B24",
    marginBottom: 8
  },
  error: {
    color: "#B42318",
    marginBottom: 8
  },
  quickActionsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 14
  },
  tabRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 14
  },
  tabChip: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 11,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#D0D5DD",
    backgroundColor: "#FFFFFF"
  },
  tabChipActive: {
    borderColor: "#1F7A4C",
    backgroundColor: "#EAF6EF"
  },
  tabChipText: {
    color: "#475467",
    fontWeight: "800"
  },
  tabChipTextActive: {
    color: "#1F7A4C"
  },
  quickActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: "#CFE8D6",
    backgroundColor: "#FFFFFF",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  quickActionText: {
    color: "#1F7A4C",
    fontWeight: "800"
  },
  confirmedList: {
    marginBottom: 14
  },
  confirmedListContent: {
    paddingRight: 8
  },
  mentorProfileCard: {
    width: 132,
    borderWidth: 1,
    borderColor: "#E4E7EC",
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    marginRight: 10,
    padding: 12,
    alignItems: "center"
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 1,
    borderColor: "#D0D5DD"
  },
  avatarLarge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: "#D0D5DD"
  },
  avatarFallback: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E8F5EE"
  },
  avatarText: {
    color: "#0B3D2E",
    fontWeight: "800",
    fontSize: 18
  },
  mentorName: {
    marginTop: 8,
    color: "#1E2B24",
    fontWeight: "800",
    fontSize: 13
  },
  mentorMail: {
    marginTop: 2,
    color: "#667085",
    fontSize: 11,
    textAlign: "center"
  },
  conversationList: {
    marginBottom: 14
  },
  conversationEmptyWrap: {
    minHeight: 120
  },
  conversationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E4E7EC",
    borderRadius: 16,
    padding: 12,
    marginBottom: 10
  },
  conversationRowActive: {
    borderColor: "#1F7A4C",
    backgroundColor: "#EEF8F2"
  },
  conversationBody: {
    flex: 1
  },
  conversationTopLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8
  },
  conversationName: {
    color: "#13251E",
    fontWeight: "800",
    fontSize: 15
  },
  conversationTime: {
    color: "#667085",
    fontSize: 12,
    fontWeight: "600"
  },
  conversationMeta: {
    marginTop: 4,
    color: "#667085",
    fontWeight: "600"
  },
  unreadBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    backgroundColor: "#B42318",
    alignItems: "center",
    justifyContent: "center"
  },
  unreadText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 11
  },
  onlineDot: {
    position: "absolute",
    right: 2,
    bottom: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#12B76A",
    borderWidth: 2,
    borderColor: "#FFFFFF"
  },
  threadCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E4E7EC",
    borderRadius: 18,
    padding: 14
  },
  threadHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#EAECF0"
  },
  threadIdentity: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1
  },
  backPill: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  threadHeaderText: {
    flex: 1
  },
  threadTitle: {
    color: "#13251E",
    fontWeight: "800",
    fontSize: 16
  },
  threadPresence: {
    marginTop: 2,
    color: "#667085",
    fontWeight: "600"
  },
  threadOnlinePill: {
    backgroundColor: "#EAF6EF",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  threadOnlineText: {
    color: "#1F7A4C",
    fontWeight: "800",
    fontSize: 12
  },
  messageList: {
    paddingVertical: 12,
    gap: 10,
    flexGrow: 1
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
    maxWidth: "78%",
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  bubbleMine: {
    backgroundColor: "#1F7A4C"
  },
  bubbleOther: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E4E7EC"
  },
  bubbleText: {
    color: "#1E2B24",
    lineHeight: 20
  },
  bubbleTextMine: {
    color: "#FFFFFF"
  },
  bubbleFooter: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 6
  },
  bubbleMeta: {
    fontSize: 11,
    color: "#667085"
  },
  bubbleMetaMine: {
    color: "#D1FADF"
  },
  readStateWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2
  },
  readStateText: {
    fontSize: 11,
    color: "#98A2B3"
  },
  readStateTextMine: {
    color: "#D1FADF"
  },
  emojiBar: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#EAECF0"
  },
  emojiBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#F8FAFC",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E4E7EC"
  },
  emojiText: {
    fontSize: 18
  },
  composer: {
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-end",
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#EAECF0"
  },
  iconBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E4E7EC",
    alignItems: "center",
    justifyContent: "center"
  },
  input: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D0D5DD",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxHeight: 110
  },
  sendBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#1F7A4C",
    alignItems: "center",
    justifyContent: "center"
  },
  sendBtnDisabled: {
    opacity: 0.55
  },
  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E4E7EC",
    borderRadius: 16,
    padding: 18,
    alignItems: "center",
    justifyContent: "center"
  },
  emptyThread: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 28
  },
  emptyEmoji: {
    fontSize: 24
  },
  emptyTitle: {
    marginTop: 8,
    color: "#13251E",
    fontWeight: "800",
    fontSize: 16
  },
  emptyText: {
    marginTop: 4,
    color: "#667085",
    textAlign: "center",
    fontWeight: "600"
  }
});


