import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

type CounterpartUser = {
  _id: string;
  name: string;
  email: string;
  role: "student" | "mentor";
  status?: "pending" | "approved";
  profilePhotoUrl?: string;
};

type Conversation = {
  counterpartId: string;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
  counterpart: CounterpartUser;
};

type ChatMessage = {
  _id: string;
  sender: string;
  recipient: string;
  text: string;
  createdAt: string;
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

export default function ChatScreen() {
  const params = useLocalSearchParams<{ userId?: string }>();
  const requestedUserId = useMemo(() => (params.userId || "").trim(), [params.userId]);
  const { user } = useAuth();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [confirmedMentors, setConfirmedMentors] = useState<CounterpartUser[]>([]);
  const [activeUserId, setActiveUserId] = useState<string>("");
  const [activeUser, setActiveUser] = useState<CounterpartUser | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (requestedUserId) {
      setActiveUserId(requestedUserId);
    }
  }, [requestedUserId]);

  useEffect(() => {
    let mounted = true;

    async function loadConversations() {
      try {
        setLoading(true);
        setError(null);
        const [conversationRes, sessionsRes] = await Promise.all([
          api.get<Conversation[]>("/api/chat/conversations"),
          user?.role === "student"
            ? api.get<StudentSession[]>("/api/sessions/student/me")
            : Promise.resolve({ data: [] as StudentSession[] })
        ]);

        const data = conversationRes.data;

        if (!mounted) return;
        setConversations(data);

        if (user?.role === "student") {
          const sessionData = sessionsRes.data || [];
          const mentorMap = new Map<string, CounterpartUser>();

          sessionData.forEach((session) => {
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

        if (!activeUserId && data.length > 0) {
          setActiveUserId(data[0].counterpartId);
        }
      } catch (e: any) {
        if (mounted) {
          setError(e?.response?.data?.message || "Failed to load chats.");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadConversations();
    return () => {
      mounted = false;
    };
  }, [activeUserId, user?.role]);

  useEffect(() => {
    let mounted = true;

    async function loadThread() {
      if (!activeUserId) {
        setMessages([]);
        setActiveUser(null);
        return;
      }

      try {
        const { data } = await api.get<{ counterpart: CounterpartUser; messages: ChatMessage[] }>(
          `/api/chat/messages/${activeUserId}`
        );
        if (!mounted) return;
        setActiveUser(data.counterpart);
        setMessages(data.messages);
        await api.patch(`/api/chat/messages/${activeUserId}/read`);
      } catch (e: any) {
        if (mounted) {
          setError(e?.response?.data?.message || "Failed to load messages.");
        }
      }
    }

    loadThread();
    return () => {
      mounted = false;
    };
  }, [activeUserId]);

  async function sendMessage() {
    if (!activeUserId || !text.trim()) return;

    try {
      setSending(true);
      setError(null);
      await api.post(`/api/chat/messages/${activeUserId}`, { text: text.trim() });
      setText("");
      const { data } = await api.get<{ counterpart: CounterpartUser; messages: ChatMessage[] }>(
        `/api/chat/messages/${activeUserId}`
      );
      setMessages(data.messages);
      const refreshed = await api.get<Conversation[]>("/api/chat/conversations");
      setConversations(refreshed.data);
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to send message.");
    } finally {
      setSending(false);
    }
  }

  if (user?.role !== "student" && user?.role !== "mentor") {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>Chat is only available for students and mentors.</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#1F7A4C" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Messages</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {user?.role === "student" ? (
        <>
          <Text style={styles.subTitle}>Confirmed Mentors</Text>
          <FlatList
            horizontal
            data={confirmedMentors}
            keyExtractor={(item) => item._id}
            style={styles.confirmedList}
            showsHorizontalScrollIndicator={false}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.mentorProfileCard} onPress={() => setActiveUserId(item._id)}>
                {item.profilePhotoUrl ? (
                  <Image source={{ uri: item.profilePhotoUrl }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatar, styles.avatarFallback]}>
                    <Text style={styles.avatarText}>{item.name?.charAt(0)?.toUpperCase() || "M"}</Text>
                  </View>
                )}
                <Text style={styles.mentorName} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.mentorMail} numberOfLines={1}>
                  {item.email || "Confirmed Mentor"}
                </Text>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <Text style={styles.empty}>No confirmed mentors yet. Book and confirm a session to chat.</Text>
            }
          />
        </>
      ) : null}

      <Text style={styles.subTitle}>Conversations</Text>
      <FlatList
        horizontal
        data={conversations}
        keyExtractor={(item) => item.counterpartId}
        style={styles.conversationList}
        showsHorizontalScrollIndicator={false}
        renderItem={({ item }) => {
          const isActive = activeUserId === item.counterpartId;
          return (
            <TouchableOpacity
              style={[styles.conversationChip, isActive && styles.conversationChipActive]}
              onPress={() => setActiveUserId(item.counterpartId)}
            >
              <Text style={[styles.conversationName, isActive && styles.conversationNameActive]}>
                {item.counterpart.name}
              </Text>
              {item.unreadCount > 0 ? <Text style={styles.unread}>{item.unreadCount}</Text> : null}
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={<Text style={styles.empty}>No conversations yet.</Text>}
      />

      <Text style={styles.threadTitle}>{activeUser ? `Chat with ${activeUser.name}` : "Select a chat"}</Text>
      <FlatList
        data={messages}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.messageList}
        renderItem={({ item }) => {
          const mine = item.sender === user?.id;
          return (
            <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleOther]}>
              <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>{item.text}</Text>
              <Text style={[styles.bubbleMeta, mine && styles.bubbleMetaMine]}>
                {new Date(item.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </Text>
            </View>
          );
        }}
        ListEmptyComponent={<Text style={styles.empty}>No messages yet.</Text>}
      />

      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder={activeUserId ? "Type your message" : "Select a chat first"}
          editable={!!activeUserId && !sending}
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!activeUserId || sending) && styles.sendBtnDisabled]}
          onPress={sendMessage}
          disabled={!activeUserId || sending}
        >
          <Text style={styles.sendText}>{sending ? "..." : "Send"}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F4F9F6", padding: 16 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#F4F9F6" },
  heading: { fontSize: 24, fontWeight: "700", color: "#1E2B24", marginBottom: 8 },
  subTitle: { fontSize: 14, color: "#475467", fontWeight: "700", marginBottom: 6 },
  error: { color: "#B42318", marginBottom: 8 },
  confirmedList: { maxHeight: 120, marginBottom: 10 },
  mentorProfileCard: {
    width: 130,
    borderWidth: 1,
    borderColor: "#E4E7EC",
    borderRadius: 12,
    backgroundColor: "#fff",
    marginRight: 8,
    padding: 10,
    alignItems: "center"
  },
  avatar: { width: 46, height: 46, borderRadius: 23, borderWidth: 1, borderColor: "#D0D5DD" },
  avatarFallback: { alignItems: "center", justifyContent: "center", backgroundColor: "#E8F5EE" },
  avatarText: { color: "#0B3D2E", fontWeight: "700", fontSize: 18 },
  mentorName: { marginTop: 8, color: "#1E2B24", fontWeight: "700", fontSize: 13 },
  mentorMail: { marginTop: 2, color: "#667085", fontSize: 11, textAlign: "center" },
  conversationList: { maxHeight: 58, marginBottom: 8 },
  conversationChip: {
    borderWidth: 1,
    borderColor: "#D0D5DD",
    backgroundColor: "#fff",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginRight: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  conversationChipActive: { borderColor: "#1F7A4C", backgroundColor: "#E8F5EE" },
  conversationName: { color: "#344054", fontWeight: "600" },
  conversationNameActive: { color: "#1F7A4C" },
  unread: {
    minWidth: 18,
    paddingHorizontal: 5,
    textAlign: "center",
    color: "#fff",
    backgroundColor: "#B42318",
    borderRadius: 999,
    fontSize: 12
  },
  threadTitle: { color: "#475467", fontWeight: "600", marginBottom: 8 },
  messageList: { paddingBottom: 12, gap: 8 },
  bubble: {
    maxWidth: "78%",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  bubbleMine: { backgroundColor: "#1F7A4C", alignSelf: "flex-end" },
  bubbleOther: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#E4E7EC", alignSelf: "flex-start" },
  bubbleText: { color: "#1E2B24" },
  bubbleTextMine: { color: "#fff" },
  bubbleMeta: { marginTop: 4, fontSize: 11, color: "#667085", textAlign: "right" },
  bubbleMetaMine: { color: "#D1FADF" },
  composer: { flexDirection: "row", gap: 8, alignItems: "center" },
  input: {
    flex: 1,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#D0D5DD",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  sendBtn: { backgroundColor: "#1F7A4C", borderRadius: 12, paddingVertical: 10, paddingHorizontal: 16 },
  sendBtnDisabled: { opacity: 0.6 },
  sendText: { color: "#fff", fontWeight: "700" },
  empty: { color: "#667085", marginTop: 10 }
});
