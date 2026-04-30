import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/lib/api";
import { handleAppError } from "@/lib/appError";
import { useAuth } from "@/context/AuthContext";
import { useLearner } from "@/context/LearnerContext";
import { useAppTheme } from "@/context/ThemeContext";
import { LEARNER_ONBOARDING_PENDING_KEY, normalizeLearnerStage, type LearnerStage } from "@/lib/learnerExperience";

const STAGES: { value: LearnerStage; title: string; body: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  {
    value: "kid",
    title: "Kids",
    body: "School feed, activities, stars, teacher support.",
    icon: "sparkles"
  },
  {
    value: "highschool",
    title: "High School",
    body: "Study plans, institution resources, competitions.",
    icon: "school"
  },
  {
    value: "after12",
    title: "After 12",
    body: "Full ORIN with AI, career tools, mentorship.",
    icon: "rocket"
  }
];

export default function LearnerOnboardingScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { refresh } = useLearner();
  const { colors, isDark } = useAppTheme();
  const [stage, setStage] = useState<LearnerStage>("after12");
  const [institutionName, setInstitutionName] = useState("");
  const [className, setClassName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isSchoolStage = stage === "kid" || stage === "highschool";
  const stageHelp = useMemo(() => {
    if (stage === "kid") return "Kids mode keeps ORIN school-safe and simple.";
    if (stage === "highschool") return "High School mode keeps study and institution features in front.";
    return "After 12 keeps the complete existing ORIN experience.";
  }, [stage]);

  async function handleContinue() {
    if (user?.role !== "student") {
      router.replace("/mentor-dashboard?section=overview" as never);
      return;
    }

    try {
      setIsSubmitting(true);
      const normalizedStage = normalizeLearnerStage(stage);
      await api.put("/api/profiles/student/me", {
        learnerStage: normalizedStage,
        institutionName: institutionName.trim(),
        collegeName: institutionName.trim(),
        institutionType: isSchoolStage ? "School" : "",
        className: className.trim()
      });
      await AsyncStorage.removeItem(LEARNER_ONBOARDING_PENDING_KEY);
      await refresh();
      router.replace("/student-dashboard?section=overview" as never);
    } catch (error) {
      handleAppError(error);
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleSkip() {
    void AsyncStorage.removeItem(LEARNER_ONBOARDING_PENDING_KEY);
    router.replace("/student-dashboard?section=overview" as never);
  }

  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.eyebrow, { color: colors.accent }]}>Set up your ORIN experience</Text>
        <Text style={[styles.title, { color: colors.text }]}>Choose how you learn</Text>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>
          Existing users stay in After 12 mode by default. This step helps new students get the right school or career experience.
        </Text>

        <View style={styles.stageGrid}>
          {STAGES.map((item) => {
            const active = stage === item.value;
            return (
              <TouchableOpacity
                key={item.value}
                activeOpacity={0.9}
                style={[
                  styles.stageCard,
                  { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
                  active && { borderColor: colors.accent, backgroundColor: colors.accentSoft }
                ]}
                onPress={() => setStage(item.value)}
              >
                <View style={[styles.iconWrap, { backgroundColor: isDark ? "#111827" : "#FFFFFF" }]}>
                  <Ionicons name={item.icon} size={20} color={active ? colors.accent : colors.textMuted} />
                </View>
                <Text style={[styles.stageTitle, { color: active ? colors.accent : colors.text }]}>{item.title}</Text>
                <Text style={[styles.stageBody, { color: colors.textMuted }]}>{item.body}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={[styles.helper, { color: colors.textMuted }]}>{stageHelp}</Text>

        {isSchoolStage ? (
          <View style={[styles.formBlock, { borderColor: colors.border }]}>
            <Text style={[styles.label, { color: colors.text }]}>School / Institution</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surfaceAlt, borderColor: colors.border, color: colors.text }]}
              placeholder="Example: ORIN Public School"
              placeholderTextColor={colors.textMuted}
              value={institutionName}
              onChangeText={setInstitutionName}
            />
            <Text style={[styles.label, { color: colors.text }]}>Class / Section</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surfaceAlt, borderColor: colors.border, color: colors.text }]}
              placeholder="Example: Class 8 A"
              placeholderTextColor={colors.textMuted}
              value={className}
              onChangeText={setClassName}
            />
            <Text style={[styles.helper, { color: colors.textMuted }]}>
              You can continue without this and add school/class later from profile.
            </Text>
          </View>
        ) : null}

        <TouchableOpacity
          activeOpacity={0.9}
          style={[styles.primaryBtn, { backgroundColor: colors.accent }, isSubmitting && styles.disabled]}
          onPress={handleContinue}
          disabled={isSubmitting}
        >
          {isSubmitting ? <ActivityIndicator size="small" color={colors.accentText} /> : <Text style={[styles.primaryText, { color: colors.accentText }]}>Continue</Text>}
        </TouchableOpacity>

        <TouchableOpacity style={styles.skipBtn} onPress={handleSkip} disabled={isSubmitting}>
          <Text style={[styles.skipText, { color: colors.textMuted }]}>Skip for now</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 20, justifyContent: "center" },
  card: { borderWidth: 1, borderRadius: 18, padding: 18 },
  eyebrow: { fontSize: 13, fontWeight: "800", marginBottom: 8 },
  title: { fontSize: 28, fontWeight: "900", marginBottom: 8 },
  subtitle: { fontSize: 15, lineHeight: 22, marginBottom: 18 },
  stageGrid: { gap: 12 },
  stageCard: { borderWidth: 1, borderRadius: 14, padding: 14 },
  iconWrap: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center", marginBottom: 10 },
  stageTitle: { fontSize: 17, fontWeight: "900", marginBottom: 4 },
  stageBody: { fontSize: 14, lineHeight: 20 },
  helper: { marginTop: 14, lineHeight: 20 },
  formBlock: { borderTopWidth: 1, marginTop: 16, paddingTop: 16 },
  label: { fontSize: 14, fontWeight: "800", marginBottom: 8 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11, marginBottom: 12 },
  primaryBtn: { minHeight: 50, borderRadius: 14, alignItems: "center", justifyContent: "center", marginTop: 10 },
  primaryText: { fontWeight: "900", fontSize: 16 },
  skipBtn: { alignItems: "center", paddingVertical: 14 },
  skipText: { fontWeight: "800" },
  disabled: { opacity: 0.7 }
});
