import React, { useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { api } from "@/lib/api";
import { handleAppError } from "@/lib/appError";
import { useAppTheme } from "@/context/ThemeContext";

const MODES = [
  { id: "simple", label: "Explain Simple" },
  { id: "steps", label: "Step-by-Step" },
  { id: "exam", label: "Exam Answer" }
] as const;

export default function HighSchoolStudyAssistantScreen() {
  const { colors } = useAppTheme();
  const [mode, setMode] = useState<(typeof MODES)[number]["id"]>("simple");
  const [question, setQuestion] = useState("Explain photosynthesis");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);

  async function ask() {
    try {
      setLoading(true);
      setAnswer("");
      const modePrompt =
        mode === "simple"
          ? "Explain this for a high school student in short easy language."
          : mode === "steps"
            ? "Explain this step by step for a high school student."
            : "Write this in exam-answer format for a high school student.";
      const { data } = await api.post<{ answer?: string }>("/api/ai/chat", {
        message: `${modePrompt} Question: ${question}`,
        context: {
          assistantMode: "general",
          feature: "highschool_study_assistant"
        }
      });
      setAnswer(String(data?.answer || "").trim());
    } catch (error) {
      handleAppError(error, { fallbackMessage: "Unable to get study help right now." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.text }]}>Study Assistant</Text>
      <Text style={[styles.subtitle, { color: colors.textMuted }]}>Ask doubts and choose how ORIN should explain the answer.</Text>
      <View style={styles.modeRow}>
        {MODES.map((item) => {
          const active = mode === item.id;
          return (
            <TouchableOpacity key={item.id} style={[styles.modeChip, { borderColor: active ? colors.accent : colors.border, backgroundColor: active ? colors.accentSoft : colors.surface }]} onPress={() => setMode(item.id)}>
              <Text style={[styles.modeText, { color: active ? colors.accent : colors.textMuted }]}>{item.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <TextInput
        style={[styles.input, styles.multi, { backgroundColor: colors.surfaceAlt, borderColor: colors.border, color: colors.text }]}
        value={question}
        onChangeText={setQuestion}
        placeholder="Ask a study question"
        placeholderTextColor={colors.textMuted}
        multiline
      />
      <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: colors.accent }]} onPress={ask} disabled={loading}>
        {loading ? <ActivityIndicator color={colors.accentText} /> : <Text style={[styles.primaryText, { color: colors.accentText }]}>Get Help</Text>}
      </TouchableOpacity>
      <View style={[styles.answerCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.answerText, { color: colors.textMuted }]}>{answer || "Your study answer will appear here."}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 20, paddingBottom: 120, gap: 14 },
  title: { fontSize: 30, fontWeight: "900", marginBottom: 6 },
  subtitle: { fontSize: 15, lineHeight: 22 },
  modeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  modeChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  modeText: { fontWeight: "800" },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11 },
  multi: { minHeight: 96, textAlignVertical: "top" },
  primaryBtn: { minHeight: 48, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  primaryText: { fontWeight: "900" },
  answerCard: { borderWidth: 1, borderRadius: 16, padding: 16, minHeight: 120 },
  answerText: { lineHeight: 24 }
});

