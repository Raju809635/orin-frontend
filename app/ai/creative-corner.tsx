import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams } from "expo-router";
import React, { useMemo, useRef, useState } from "react";
import { ActivityIndicator, PanResponder, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { api } from "@/lib/api";
import { handleAppError } from "@/lib/appError";
import { useAppTheme } from "@/context/ThemeContext";

const MODES = ["Drawing", "Story", "Craft", "Class Activity"] as const;
const COLORS = ["#EF4444", "#F59E0B", "#10B981", "#3B82F6", "#8B5CF6", "#111827"];
const STICKERS = ["STAR", "HEART", "SUN", "TREE"];
const CANVAS_SIZE = 240;

type Dot = { id: string; x: number; y: number; color: string };

function splitLines(text: string) {
  return String(text || "")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export default function CreativeCornerScreen() {
  const params = useLocalSearchParams<{ mode?: string; topic?: string }>();
  const { colors } = useAppTheme();
  const initialMode = MODES.includes(String(params.mode || "") as (typeof MODES)[number]) ? (String(params.mode || "") as (typeof MODES)[number]) : "Drawing";
  const [mode, setMode] = useState<(typeof MODES)[number]>(initialMode);
  const [topic, setTopic] = useState(String(params.topic || "space, nature, school, friendship"));
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedColor, setSelectedColor] = useState(COLORS[0]);
  const [dots, setDots] = useState<Dot[]>([]);
  const [stickers, setStickers] = useState<string[]>([]);
  const [uploadedImageName, setUploadedImageName] = useState("");
  const canvasRef = useRef<View | null>(null);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => mode === "Drawing",
        onMoveShouldSetPanResponder: () => mode === "Drawing",
        onPanResponderGrant: (event) => {
          if (mode !== "Drawing") return;
          const { locationX, locationY } = event.nativeEvent;
          setDots((prev) => [...prev, { id: `${Date.now()}-${prev.length}`, x: locationX, y: locationY, color: selectedColor }]);
        },
        onPanResponderMove: (event) => {
          if (mode !== "Drawing") return;
          const { locationX, locationY } = event.nativeEvent;
          setDots((prev) => [...prev, { id: `${Date.now()}-${prev.length}`, x: locationX, y: locationY, color: selectedColor }]);
        }
      }),
    [mode, selectedColor]
  );

  async function generateIdea() {
    try {
      setLoading(true);
      setAnswer("");
      const stickerText = stickers.length ? `Use stickers: ${stickers.join(", ")}.` : "";
      const { data } = await api.post<{ answer?: string }>("/api/ai/chat", {
        message: `You are helping a school child. Give kind, short feedback for a ${mode.toLowerCase()} activity about ${topic}. Start by praising the work, then suggest one next thing to add. ${stickerText}`,
        context: {
          assistantMode: "general",
          feature: "kids_creative_corner_draw_improve"
        }
      });
      setAnswer(String(data?.answer || "").trim());
    } catch (error) {
      handleAppError(error, { fallbackMessage: "Unable to create creative feedback. Please try again." });
    } finally {
      setLoading(false);
    }
  }

  async function uploadImage() {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker?.MediaTypeOptions?.Images ?? ["images"],
        quality: 0.9,
        allowsEditing: true
      } as any);
      if (result?.canceled || !result?.assets?.length) return;
      const asset = result.assets[0];
      setUploadedImageName(asset.fileName || "Uploaded image");
    } catch (error) {
      handleAppError(error, { fallbackMessage: "Unable to upload image right now." });
    }
  }

  function toggleSticker(sticker: string) {
    setStickers((prev) => (prev.includes(sticker) ? prev.filter((item) => item !== sticker) : [...prev, sticker]));
  }

  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.text }]}>Creative Corner</Text>
      <Text style={[styles.subtitle, { color: colors.textMuted }]}>
        Draw, color, add stickers, upload a picture, and get kind AI feedback on what to add next.
      </Text>

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
        placeholder="Example: my school, rainbow, village, festival"
        placeholderTextColor={colors.textMuted}
        value={topic}
        onChangeText={setTopic}
      />

      <View style={[styles.canvasCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Drawing Canvas</Text>
        <View style={styles.paletteRow}>
          {COLORS.map((color) => (
            <TouchableOpacity
              key={color}
              style={[styles.colorChip, { backgroundColor: color, borderColor: selectedColor === color ? colors.text : "transparent" }]}
              onPress={() => setSelectedColor(color)}
            />
          ))}
        </View>
        <View
          ref={(node) => {
            canvasRef.current = node;
          }}
          style={[styles.canvas, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}
          {...panResponder.panHandlers}
        >
          {dots.map((dot) => (
            <View key={dot.id} style={[styles.dot, { left: dot.x, top: dot.y, backgroundColor: dot.color }]} />
          ))}
        </View>
        <View style={styles.canvasActions}>
          <TouchableOpacity style={[styles.secondaryBtn, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }]} onPress={() => setDots([])}>
            <Text style={[styles.secondaryText, { color: colors.text }]}>Clear</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.secondaryBtn, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }]} onPress={uploadImage}>
            <Text style={[styles.secondaryText, { color: colors.text }]}>{uploadedImageName ? "Change Image" : "Upload Image"}</Text>
          </TouchableOpacity>
        </View>
        {uploadedImageName ? <Text style={[styles.meta, { color: colors.textMuted }]}>Image ready: {uploadedImageName}</Text> : null}
      </View>

      <View style={[styles.canvasCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Stickers & Color Fill</Text>
        <View style={styles.stickerRow}>
          {STICKERS.map((sticker) => {
            const active = stickers.includes(sticker);
            return (
              <TouchableOpacity
                key={sticker}
                style={[styles.stickerChip, { borderColor: active ? colors.accent : colors.border, backgroundColor: active ? colors.accentSoft : colors.surfaceAlt }]}
                onPress={() => toggleSticker(sticker)}
              >
                <Text style={[styles.stickerText, { color: active ? colors.accent : colors.textMuted }]}>{sticker}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <Text style={[styles.meta, { color: colors.textMuted }]}>
          Selected stickers: {stickers.length ? stickers.join(", ") : "none yet"}
        </Text>
      </View>

      <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: colors.accent }]} onPress={generateIdea} disabled={loading}>
        {loading ? <ActivityIndicator color={colors.accentText} /> : <Ionicons name="sparkles" size={18} color={colors.accentText} />}
        <Text style={[styles.primaryText, { color: colors.accentText }]}>{loading ? "Improving..." : "Draw & Improve"}</Text>
      </TouchableOpacity>

      {answer ? (
        <View style={[styles.answerCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>AI Feedback</Text>
          {splitLines(answer).map((line, index) => (
            <Text key={`${index}-${line.slice(0, 12)}`} style={[styles.answerLine, { color: colors.text }]}>
              {line}
            </Text>
          ))}
        </View>
      ) : (
        <View style={[styles.answerCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Weekly Best Drawing</Text>
          <Text style={[styles.meta, { color: colors.textMuted }]}>
            Keep drawing and submitting ideas. Weekly best creations can be highlighted by your school.
          </Text>
        </View>
      )}
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
  label: { fontWeight: "900" },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11 },
  canvasCard: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 12 },
  cardTitle: { fontSize: 18, fontWeight: "900" },
  paletteRow: { flexDirection: "row", gap: 8 },
  colorChip: { width: 28, height: 28, borderRadius: 14, borderWidth: 2 },
  canvas: { width: CANVAS_SIZE, height: CANVAS_SIZE, borderWidth: 1, borderRadius: 16, position: "relative", overflow: "hidden", alignSelf: "center" },
  dot: { position: "absolute", width: 10, height: 10, borderRadius: 5 },
  canvasActions: { flexDirection: "row", gap: 10 },
  secondaryBtn: { flex: 1, minHeight: 44, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  secondaryText: { fontWeight: "800" },
  stickerRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  stickerChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  stickerText: { fontWeight: "800" },
  primaryBtn: { minHeight: 50, borderRadius: 14, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 },
  primaryText: { fontWeight: "900", fontSize: 16 },
  answerCard: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 8 },
  answerLine: { lineHeight: 23, fontWeight: "600" },
  meta: { lineHeight: 20 }
});
