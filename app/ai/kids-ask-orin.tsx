import React, { useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { api } from "@/lib/api";
import { handleAppError } from "@/lib/appError";
import { useAppTheme } from "@/context/ThemeContext";
import { speakKidText } from "@/lib/kidsSpeech";

const PROMPTS = [
  "What is the letter A?",
  "What is red?",
  "How do I count to 10?",
  "Tell me about a circle.",
  "What sound does B make?",
  "How do plants grow?"
];

export default function KidsAskOrinScreen() {
  const { colors } = useAppTheme();
  const [answer, setAnswer] = useState("");
  const [activePrompt, setActivePrompt] = useState("");
  const [loading, setLoading] = useState(false);

  async function ask(prompt: string) {
    try {
      setLoading(true);
      setActivePrompt(prompt);
      setAnswer("");
      const { data } = await api.post<{ answer?: string }>("/api/ai/chat", {
        message: `Answer for a young school student in 2-4 short, friendly sentences. Keep it safe, simple, visual, and encouraging. Question: ${prompt}`,
        context: {
          assistantMode: "general",
          feature: "kids_ask_orin"
        }
      });
      const nextAnswer = String(data?.answer || "").trim() || "Let's learn together. Try asking again.";
      setAnswer(nextAnswer);
      void speakKidText(nextAnswer);
    } catch (error) {
      handleAppError(error, { fallbackMessage: "ORIN could not answer right now. Please try again." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.text }]}>Ask ORIN</Text>
      <Text style={[styles.subtitle, { color: colors.textMuted }]}>
        Tap a question, hear the answer, and learn in short friendly steps. Typing is hidden in kids mode.
      </Text>

      <View style={styles.promptStack}>
        {PROMPTS.map((prompt) => (
          <TouchableOpacity
            key={prompt}
            style={[styles.promptCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => ask(prompt)}
            disabled={loading}
          >
            <Text style={[styles.promptText, { color: colors.text }]}>{prompt}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={[styles.answerCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.answerTitle, { color: colors.text }]}>{activePrompt || "Tap a question"}</Text>
        {loading ? <ActivityIndicator color={colors.accent} style={{ marginVertical: 12 }} /> : null}
        <Text style={[styles.answerBody, { color: colors.textMuted }]}>{answer || "ORIN will speak and show the answer here."}</Text>
        {answer ? (
          <TouchableOpacity style={[styles.speakBtn, { backgroundColor: colors.accent }]} onPress={() => void speakKidText(answer)}>
            <Text style={[styles.speakBtnText, { color: colors.accentText }]}>Hear Again</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 20, paddingBottom: 120 },
  title: { fontSize: 30, fontWeight: "900", marginBottom: 6 },
  subtitle: { fontSize: 15, lineHeight: 22, marginBottom: 16 },
  promptStack: { gap: 10 },
  promptCard: { borderWidth: 1, borderRadius: 14, padding: 14 },
  promptText: { fontWeight: "800", lineHeight: 21 },
  answerCard: { borderWidth: 1, borderRadius: 16, padding: 16, marginTop: 18 },
  answerTitle: { fontWeight: "900", fontSize: 18, marginBottom: 8 },
  answerBody: { lineHeight: 24, minHeight: 72 },
  speakBtn: { minHeight: 46, borderRadius: 14, alignItems: "center", justifyContent: "center", marginTop: 14 },
  speakBtnText: { fontWeight: "900" }
});

