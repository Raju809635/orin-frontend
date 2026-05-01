import React, { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { useAppTheme } from "@/context/ThemeContext";
import { speakKidText } from "@/lib/kidsSpeech";

type StoryCard = {
  id: string;
  title: string;
  story: string;
  prompt: string;
};

const STORIES: StoryCard[] = [
  {
    id: "rainbow-bird",
    title: "The Rainbow Bird",
    story: "A tiny bird found seven bright feathers and used them to paint the sky with a rainbow after the rain.",
    prompt: "Draw the bird, clouds, and the rainbow it made."
  },
  {
    id: "kind-tree",
    title: "The Kind Tree",
    story: "A tree gave shade to children, fruit to birds, and leaves for a squirrel to build a warm little home.",
    prompt: "Draw the tree and the friends around it."
  },
  {
    id: "moon-boat",
    title: "The Moon Boat",
    story: "A paper boat floated on a pond at night and looked like it was carrying the moon across the water.",
    prompt: "Draw the pond, the moon, and the little boat."
  }
];

export default function StoryAndDrawingScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const [selectedId, setSelectedId] = useState(STORIES[0].id);

  const selectedStory = useMemo(
    () => STORIES.find((item) => item.id === selectedId) || STORIES[0],
    [selectedId]
  );

  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.text }]}>Story & Drawing</Text>
      <Text style={[styles.subtitle, { color: colors.textMuted }]}>
        Listen to a short story, imagine the scene, then open drawing time and create what you saw.
      </Text>

      <View style={styles.storyRow}>
        {STORIES.map((story) => {
          const active = story.id === selectedId;
          return (
            <TouchableOpacity
              key={story.id}
              style={[
                styles.storyChip,
                { backgroundColor: active ? colors.accentSoft : colors.surface, borderColor: active ? colors.accent : colors.border }
              ]}
              onPress={() => setSelectedId(story.id)}
            >
              <Text style={[styles.storyChipText, { color: active ? colors.accent : colors.textMuted }]}>{story.title}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={[styles.storyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.storyTitle, { color: colors.text }]}>{selectedStory.title}</Text>
        <Text style={[styles.storyBody, { color: colors.textMuted }]}>{selectedStory.story}</Text>
        <Text style={[styles.promptTitle, { color: colors.text }]}>Draw this next</Text>
        <Text style={[styles.promptBody, { color: colors.textMuted }]}>{selectedStory.prompt}</Text>

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.accent }]}
            onPress={() => void speakKidText(`${selectedStory.title}. ${selectedStory.story}`)}
          >
            <Text style={[styles.actionBtnText, { color: colors.accentText }]}>Tap to Hear</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.secondaryBtn, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}
            onPress={() =>
              router.push({
                pathname: "/ai/creative-corner",
                params: {
                  mode: "Drawing",
                  topic: selectedStory.prompt
                }
              } as never)
            }
          >
            <Text style={[styles.secondaryBtnText, { color: colors.text }]}>Open Drawing</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 20, paddingBottom: 120 },
  title: { fontSize: 30, fontWeight: "900", marginBottom: 6 },
  subtitle: { fontSize: 15, lineHeight: 22, marginBottom: 16 },
  storyRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  storyChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  storyChipText: { fontWeight: "800" },
  storyCard: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 10 },
  storyTitle: { fontSize: 22, fontWeight: "900" },
  storyBody: { fontSize: 15, lineHeight: 24 },
  promptTitle: { marginTop: 8, fontSize: 16, fontWeight: "900" },
  promptBody: { lineHeight: 21 },
  actionRow: { flexDirection: "row", gap: 10, marginTop: 8 },
  actionBtn: { flex: 1, minHeight: 48, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  actionBtnText: { fontWeight: "900" },
  secondaryBtn: { flex: 1, minHeight: 48, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  secondaryBtnText: { fontWeight: "800" }
});

