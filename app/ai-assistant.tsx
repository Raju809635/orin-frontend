import React, { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

type ChatItem = {
  id: string;
  role: "user" | "assistant";
  text: string;
};

export default function AiAssistantScreen() {
  const { user } = useAuth();
  const [prompt, setPrompt] = useState("");
  const [items, setItems] = useState<ChatItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function askAi() {
    if (!prompt.trim() || isLoading) return;

    const nextUserItem: ChatItem = {
      id: `${Date.now()}-u`,
      role: "user",
      text: prompt.trim()
    };

    setItems((prev) => [nextUserItem, ...prev]);
    setPrompt("");
    setError(null);
    setIsLoading(true);

    try {
      const { data } = await api.post<{ answer: string }>("/api/ai/chat", {
        message: nextUserItem.text,
        context: {
          role: user?.role,
          app: "orin-mobile"
        }
      });

      const nextAssistantItem: ChatItem = {
        id: `${Date.now()}-a`,
        role: "assistant",
        text: data.answer
      };
      setItems((prev) => [nextAssistantItem, ...prev]);
    } catch (e: any) {
      setError(e?.response?.data?.message || "AI request failed.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>AI Assistant</Text>
      <Text style={styles.subheading}>Ask roadmap, mentorship, session, and study questions.</Text>

      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          placeholder="Ask ORIN AI..."
          value={prompt}
          onChangeText={setPrompt}
          multiline
        />
        <TouchableOpacity style={styles.sendBtn} onPress={askAi} disabled={isLoading}>
          {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.sendText}>Ask</Text>}
        </TouchableOpacity>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={[styles.bubble, item.role === "user" ? styles.userBubble : styles.assistantBubble]}>
            <Text style={[styles.bubbleText, item.role === "user" && styles.userText]}>{item.text}</Text>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No conversation yet. Start by asking a question.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F4F9F6", padding: 16 },
  heading: { fontSize: 24, fontWeight: "700", color: "#1E2B24" },
  subheading: { color: "#475467", marginTop: 4, marginBottom: 12 },
  composer: { marginBottom: 10 },
  input: {
    minHeight: 80,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#D0D5DD",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    textAlignVertical: "top"
  },
  sendBtn: {
    marginTop: 8,
    alignSelf: "flex-end",
    backgroundColor: "#1F7A4C",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10
  },
  sendText: { color: "#fff", fontWeight: "700" },
  bubble: {
    borderRadius: 12,
    padding: 10,
    marginBottom: 8
  },
  userBubble: { backgroundColor: "#1F7A4C", alignSelf: "flex-end", maxWidth: "86%" },
  assistantBubble: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E4E7EC",
    alignSelf: "flex-start",
    maxWidth: "90%"
  },
  bubbleText: { color: "#1E2B24" },
  userText: { color: "#fff" },
  error: { color: "#B42318", marginBottom: 8 },
  empty: { color: "#667085", marginTop: 12 }
});
