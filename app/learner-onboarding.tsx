import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useEffect, useMemo, useState } from "react";
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

type InstitutionSearchResult = {
  id: string;
  name: string;
  institutionType: string;
  district?: string;
  state?: string;
  source?: string;
};

export default function LearnerOnboardingScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { refresh } = useLearner();
  const { colors, isDark } = useAppTheme();
  const [stage, setStage] = useState<LearnerStage>("after12");
  const [institutionQuery, setInstitutionQuery] = useState("");
  const [institutionName, setInstitutionName] = useState("");
  const [institutionResults, setInstitutionResults] = useState<InstitutionSearchResult[]>([]);
  const [searchingInstitutions, setSearchingInstitutions] = useState(false);
  const [institutionFocused, setInstitutionFocused] = useState(false);
  const [className, setClassName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);

  const isSchoolStage = stage === "kid" || stage === "highschool";
  const stageHelp = useMemo(() => {
    if (stage === "kid") return "Kids mode keeps ORIN school-safe and simple.";
    if (stage === "highschool") return "High School mode keeps study and institution features in front.";
    return "After 12 keeps the complete existing ORIN experience.";
  }, [stage]);

  useEffect(() => {
    let active = true;
    async function loadCurrentProfile() {
      if (user?.role !== "student") {
        if (active) setLoadingProfile(false);
        return;
      }
      try {
        const { data } = await api.get("/api/profiles/student/me");
        if (!active) return;
        const profile = data?.profile || {};
        const nextStage = normalizeLearnerStage(profile?.learnerStage);
        const nextInstitution = String(profile?.institutionName || profile?.collegeName || "").trim();
        setStage(nextStage);
        setInstitutionName(nextInstitution);
        setInstitutionQuery(nextInstitution);
        setClassName(String(profile?.className || "").trim());
      } catch {
        if (!active) return;
      } finally {
        if (active) setLoadingProfile(false);
      }
    }
    void loadCurrentProfile();
    return () => {
      active = false;
    };
  }, [user?.role]);

  useEffect(() => {
    if (!institutionFocused) {
      setInstitutionResults([]);
      return;
    }

    const query = institutionQuery.trim();
    if (query.length < 2) {
      setInstitutionResults([]);
      setSearchingInstitutions(false);
      return;
    }

    let active = true;
    const timer = setTimeout(async () => {
      try {
        setSearchingInstitutions(true);
        const { data } = await api.get("/api/profiles/institutions/search", {
          params: {
            q: query,
            institutionType: stage === "kid" || stage === "highschool" ? "School" : undefined,
            limit: 8
          }
        });
        if (!active) return;
        let nextResults = Array.isArray(data?.results) ? data.results : [];

        if (nextResults.length === 0) {
          const fallback = await api.get("/api/profiles/institutions/search", {
            params: {
              q: query,
              limit: 8
            }
          });
          if (!active) return;
          nextResults = Array.isArray(fallback?.data?.results) ? fallback.data.results : [];
        }

        setInstitutionResults(nextResults);
      } catch {
        if (active) setInstitutionResults([]);
      } finally {
        if (active) setSearchingInstitutions(false);
      }
    }, 250);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [institutionFocused, institutionQuery, stage]);

  function selectInstitution(institution: InstitutionSearchResult) {
    setInstitutionName(institution.name);
    setInstitutionQuery(institution.name);
    setInstitutionFocused(false);
    setInstitutionResults([]);
  }

  async function handleContinue() {
    if (user?.role !== "student") {
      router.replace("/mentor-dashboard?section=overview" as never);
      return;
    }

    try {
      setIsSubmitting(true);
      const normalizedStage = normalizeLearnerStage(stage);
      const selectedInstitutionName = institutionName.trim();
      if (isSchoolStage && institutionQuery.trim() && institutionQuery.trim() !== selectedInstitutionName) {
        handleAppError(new Error("Please select your institution from the list before continuing."), {
          fallbackMessage: "Please select your institution from the list before continuing."
        });
        return;
      }
      await api.put("/api/profiles/student/me", {
        learnerStage: normalizedStage,
        institutionName: selectedInstitutionName,
        collegeName: selectedInstitutionName,
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
        {loadingProfile ? <ActivityIndicator size="small" color={colors.accent} style={styles.loader} /> : null}
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
              onPress={() => {
                setStage(item.value);
                if (item.value === "kid" || item.value === "highschool") {
                  setInstitutionFocused(true);
                } else {
                  setInstitutionFocused(false);
                }
              }}
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
              placeholder="Search and select your school"
              placeholderTextColor={colors.textMuted}
              value={institutionQuery}
              onFocus={() => setInstitutionFocused(true)}
              onChangeText={(value) => {
                setInstitutionQuery(value);
                setInstitutionFocused(true);
                if (value.trim() !== institutionName.trim()) {
                  setInstitutionName("");
                }
              }}
            />
            {searchingInstitutions ? <ActivityIndicator size="small" color={colors.accent} style={styles.searchLoader} /> : null}
            {institutionFocused && institutionResults.length > 0 ? (
              <View style={[styles.suggestionBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                {institutionResults.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.suggestionItem, { borderBottomColor: colors.border }]}
                    onPress={() => selectInstitution(item)}
                  >
                    <Text style={[styles.suggestionTitle, { color: colors.text }]}>{item.name}</Text>
                    <Text style={[styles.suggestionMeta, { color: colors.textMuted }]}>
                      {[item.institutionType, item.district, item.state].filter(Boolean).join(" | ")}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}
            {institutionFocused && !searchingInstitutions && institutionQuery.trim().length >= 2 && institutionResults.length === 0 ? (
              <Text style={[styles.helper, { color: colors.textMuted }]}>
                No institution match yet. You can skip and add it later after admin adds your institution.
              </Text>
            ) : null}
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
  loader: { marginBottom: 10 },
  formBlock: { borderTopWidth: 1, marginTop: 16, paddingTop: 16 },
  label: { fontSize: 14, fontWeight: "800", marginBottom: 8 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11, marginBottom: 12 },
  searchLoader: { marginBottom: 8 },
  suggestionBox: { borderWidth: 1, borderRadius: 14, overflow: "hidden", marginBottom: 8 },
  suggestionItem: { paddingHorizontal: 12, paddingVertical: 11, borderBottomWidth: 1 },
  suggestionTitle: { fontSize: 14, fontWeight: "800" },
  suggestionMeta: { marginTop: 2, fontSize: 12 },
  primaryBtn: { minHeight: 50, borderRadius: 14, alignItems: "center", justifyContent: "center", marginTop: 10 },
  primaryText: { fontWeight: "900", fontSize: 16 },
  skipBtn: { alignItems: "center", paddingVertical: 14 },
  skipText: { fontWeight: "800" },
  disabled: { opacity: 0.7 }
});
