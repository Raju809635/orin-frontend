import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { api } from "@/lib/api";
import { handleAppError } from "@/lib/appError";
import { useAppTheme } from "@/context/ThemeContext";

const MODES = ["Drawing", "Story", "Craft", "Class Activity"];

function splitLines(text: string) {
  return String(text || "")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export default function CreativeCornerScreen() {
  const { colors } = useAppTheme();
  const [mode, setMode] = useState("Drawing");
  const [topic, setTopic] = useState("space, nature, school, friendship");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);

  async function generateIdea() {
    try {
      setLoading(true);
      setAnswer("");
      const { data } = await api.post<{ answer?: string }>("/api/ai/chat", {
        message: `Create a kid-friendly ${mode.toLowerCase()} activity about ${topic}. Keep it safe, simple, and step-by-step. Include materials if needed and one small reflection question.`,
        context: {
          assistantMode: "general",
          feature: "kids_creative_corner"
        }
      });
      setAnswer(String(data?.answer || "").trim());
    } catch (error) {
      handleAppError(error, { fallbackMessage: "Unable to create activity. Please try again." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.text }]}>Creative Corner</Text>
      <Text style={[styles.subtitle, { color: colors.textMuted }]}>Generate simple drawing, story, craft, and class activity ideas.</Text>

      <View style={styles.modeRow}>
        {MODES.map((item) => {
          const active = item === mode;
          return (
            <TouchableOpacity
              key={item}
              style={[styles.modeChip, { borderColor: active ? colors.accent : colors.border, backgroundColor: active ? colors.accentSoft : colors.surface }]}
              onPress={() => setMode(item)}
            >
              <Text style={[styles.modeText, { color: active ? colors.accent : colors.textMuted }]}>{item}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={[styles.label, { color: colors.text }]}>Topic</Text>
      <TextInput
        style={[styles.input, { backgroundColor: colors.surfaceAlt, borderColor: colors.border, color: colors.text }]}
        placeholder="Example: animals, festivals, planets, my school"
        placeholderTextColor={colors.textMuted}
        value={topic}
        onChangeText={setTopic}
      />

      <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: colors.accent }]} onPress={generateIdea} disabled={loading}>
        {loading ? <ActivityIndicator color={colors.accentText} /> : <Ionicons name="color-wand" size={18} color={colors.accentText} />}
        <Text style={[styles.primaryText, { color: colors.accentText }]}>{loading ? "Creating..." : "Create Activity"}</Text>
      </TouchableOpacity>

      {answer ? (
        <View style={[styles.answerCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {splitLines(answer).map((line, index) => (
            <Text key={`${index}-${line.slice(0, 12)}`} style={[styles.answerLine, { color: colors.text }]}>
              {line}
            </Text>
          ))}
        </View>
      ) : (
        <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>Pick a mode and topic</Text>
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>ORIN will create a small activity that students can do at home or in class.</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 20, paddingBottom: 120 },
  title: { fontSize: 30, fontWeight: "900", marginBottom: 6 },
  subtitle: { fontSize: 15, lineHeight: 22, marginBottom: 16 },
  modeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  modeChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  modeText: { fontWeight: "800" },
  label: { fontWeight: "900", marginBottom: 8 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11, marginBottom: 14 },
  primaryBtn: { minHeight: 50, borderRadius: 14, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 },
  primaryText: { fontWeight: "900", fontSize: 16 },
  answerCard: { borderWidth: 1, borderRadius: 16, padding: 16, marginTop: 18 },
  answerLine: { lineHeight: 23, marginBottom: 8, fontWeight: "600" },
  emptyCard: { borderWidth: 1, borderRadius: 16, padding: 16, marginTop: 18 },
  emptyTitle: { fontSize: 18, fontWeight: "900", marginBottom: 6 },
  emptyText: { lineHeight: 21 },
});
