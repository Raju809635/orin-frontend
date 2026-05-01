import React, { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useAppTheme } from "@/context/ThemeContext";

function toList(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function HighSchoolSubjectGapScreen() {
  const { colors, isDark } = useAppTheme();
  const [subjects, setSubjects] = useState("Maths, Science, English");
  const [weakAreas, setWeakAreas] = useState("fractions, electricity, grammar");
  const [submitted, setSubmitted] = useState(false);

  const strengths = useMemo(() => toList(subjects).slice(0, 3), [subjects]);
  const weakList = useMemo(() => toList(weakAreas).slice(0, 3), [weakAreas]);

  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.text }]}>Subject Gap Analyzer</Text>
      <Text style={[styles.subtitle, { color: colors.textMuted }]}>
        Add your subjects and weak areas to get a simple school improvement plan with a visual strength check.
      </Text>

      <Text style={[styles.label, { color: colors.text }]}>Subjects</Text>
      <TextInput
        style={[styles.input, { backgroundColor: colors.surfaceAlt, borderColor: colors.border, color: colors.text }]}
        value={subjects}
        onChangeText={setSubjects}
        placeholder="Example: Maths, Science, English"
        placeholderTextColor={colors.textMuted}
      />

      <Text style={[styles.label, { color: colors.text }]}>Weak Areas</Text>
      <TextInput
        style={[styles.input, styles.multi, { backgroundColor: colors.surfaceAlt, borderColor: colors.border, color: colors.text }]}
        value={weakAreas}
        onChangeText={setWeakAreas}
        placeholder="Example: algebra, diagrams, writing answers"
        placeholderTextColor={colors.textMuted}
        multiline
      />

      <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: colors.accent }]} onPress={() => setSubmitted(true)}>
        <Text style={[styles.primaryText, { color: colors.accentText }]}>Analyze Subjects</Text>
      </TouchableOpacity>

      {submitted ? (
        <View style={[styles.resultCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.resultTitle, { color: colors.text }]}>Visual Report</Text>
          {strengths.map((item) => (
            <View key={`strong-${item}`} style={styles.barRow}>
              <Text style={[styles.barLabel, { color: colors.text }]}>{item}</Text>
              <View style={[styles.barWrap, { backgroundColor: colors.surfaceAlt }]}>
                <View style={[styles.barFill, { width: "78%", backgroundColor: "#12B76A" }]} />
              </View>
            </View>
          ))}
          {weakList.map((item) => (
            <View key={`weak-${item}`} style={styles.barRow}>
              <Text style={[styles.barLabel, { color: colors.text }]}>{item}</Text>
              <View style={[styles.barWrap, { backgroundColor: colors.surfaceAlt }]}>
                <View style={[styles.barFill, { width: "35%", backgroundColor: isDark ? "#F97066" : "#F04438" }]} />
              </View>
            </View>
          ))}
          <Text style={[styles.focusText, { color: colors.textMuted }]}>
            Focus this week: revise {weakList[0] || "your weakest topic"} and try to improve by 10%.
          </Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 20, paddingBottom: 120, gap: 14 },
  title: { fontSize: 30, fontWeight: "900", marginBottom: 6 },
  subtitle: { fontSize: 15, lineHeight: 22 },
  label: { fontWeight: "900" },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11 },
  multi: { minHeight: 86, textAlignVertical: "top" },
  primaryBtn: { minHeight: 48, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  primaryText: { fontWeight: "900" },
  resultCard: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 12 },
  resultTitle: { fontSize: 18, fontWeight: "900" },
  barRow: { gap: 6 },
  barLabel: { fontWeight: "800" },
  barWrap: { height: 10, borderRadius: 999, overflow: "hidden" },
  barFill: { height: "100%", borderRadius: 999 },
  focusText: { lineHeight: 21, fontWeight: "700" }
});
