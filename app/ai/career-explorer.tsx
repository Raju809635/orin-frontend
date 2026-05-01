import React, { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useAppTheme } from "@/context/ThemeContext";

type InterestKey = "Science" | "Commerce" | "Arts" | "Tech";
type CareerPath = {
  title: string;
  subjects: string[];
  skills: string[];
  nextStep: string;
  futureScope: string;
};

const CAREER_MAP: Record<InterestKey, CareerPath[]> = {
  Science: [
    { title: "Doctor", subjects: ["Biology", "Chemistry"], skills: ["Focus", "Memory"], nextStep: "Prepare for NEET", futureScope: "Healthcare and medical services" },
    { title: "Engineer", subjects: ["Maths", "Physics"], skills: ["Problem solving", "Logic"], nextStep: "Prepare for JEE or state entrance", futureScope: "Tech, design, and manufacturing" }
  ],
  Commerce: [
    { title: "Chartered Accountant", subjects: ["Accountancy", "Maths"], skills: ["Accuracy", "Analysis"], nextStep: "Learn CA foundation path", futureScope: "Finance, tax, audit" },
    { title: "Business Manager", subjects: ["Economics", "Business Studies"], skills: ["Leadership", "Planning"], nextStep: "Build leadership projects", futureScope: "Management and entrepreneurship" }
  ],
  Arts: [
    { title: "Lawyer", subjects: ["Political Science", "English"], skills: ["Communication", "Reasoning"], nextStep: "Explore CLAT path", futureScope: "Law, policy, advocacy" },
    { title: "Designer", subjects: ["Fine Arts", "English"], skills: ["Creativity", "Observation"], nextStep: "Build a design portfolio", futureScope: "Media, design, branding" }
  ],
  Tech: [
    { title: "App Developer", subjects: ["Computer Science", "Maths"], skills: ["Coding", "Testing"], nextStep: "Start small apps and projects", futureScope: "Software and product teams" },
    { title: "AI Specialist", subjects: ["Maths", "Computer Science"], skills: ["Curiosity", "Data thinking"], nextStep: "Learn Python and machine learning basics", futureScope: "AI tools, automation, research" }
  ]
};

export default function CareerExplorerScreen() {
  const { colors } = useAppTheme();
  const [interest, setInterest] = useState<InterestKey>("Science");
  const [savedCareer, setSavedCareer] = useState("");

  const paths = useMemo(() => CAREER_MAP[interest], [interest]);

  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.text }]}>Career Explorer</Text>
      <Text style={[styles.subtitle, { color: colors.textMuted }]}>
        Select an interest and preview possible paths, required subjects, useful skills, and the next step.
      </Text>

      <View style={styles.interestRow}>
        {(Object.keys(CAREER_MAP) as InterestKey[]).map((item) => {
          const active = interest === item;
          return (
            <TouchableOpacity
              key={item}
              style={[styles.interestChip, { borderColor: active ? colors.accent : colors.border, backgroundColor: active ? colors.accentSoft : colors.surface }]}
              onPress={() => setInterest(item)}
            >
              <Text style={[styles.interestText, { color: active ? colors.accent : colors.textMuted }]}>{item}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.pathStack}>
        {paths.map((path) => (
          <View key={path.title} style={[styles.pathCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.pathTitle, { color: colors.text }]}>{path.title}</Text>
            <Text style={[styles.pathMeta, { color: colors.textMuted }]}>Subjects: {path.subjects.join(", ")}</Text>
            <Text style={[styles.pathMeta, { color: colors.textMuted }]}>Skills: {path.skills.join(", ")}</Text>
            <Text style={[styles.pathMeta, { color: colors.textMuted }]}>Next step: {path.nextStep}</Text>
            <Text style={[styles.pathMeta, { color: colors.textMuted }]}>Future scope: {path.futureScope}</Text>
            <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.accent }]} onPress={() => setSavedCareer(path.title)}>
              <Text style={[styles.saveBtnText, { color: colors.accentText }]}>Save Career</Text>
            </TouchableOpacity>
          </View>
        ))}
      </View>

      {savedCareer ? <Text style={[styles.savedText, { color: colors.text }]}>Saved for later: {savedCareer}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 20, paddingBottom: 120, gap: 14 },
  title: { fontSize: 30, fontWeight: "900", marginBottom: 6 },
  subtitle: { fontSize: 15, lineHeight: 22 },
  interestRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  interestChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  interestText: { fontWeight: "800" },
  pathStack: { gap: 12 },
  pathCard: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 8 },
  pathTitle: { fontSize: 20, fontWeight: "900" },
  pathMeta: { lineHeight: 21 },
  saveBtn: { marginTop: 8, minHeight: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  saveBtnText: { fontWeight: "900" },
  savedText: { fontWeight: "800" }
});

