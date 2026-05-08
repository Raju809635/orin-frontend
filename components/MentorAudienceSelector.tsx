import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import ClassSectionSelector from "@/components/ClassSectionSelector";
import { useAppTheme } from "@/context/ThemeContext";
import { api } from "@/lib/api";

export type MentorAudienceScope = "global" | "institution" | "class";

export type MentorAudienceValue = {
  scope: MentorAudienceScope;
  institutionName: string;
  className: string;
};

type InstitutionSearchResult = {
  id?: string;
  name: string;
  institutionType?: string;
  district?: string;
  state?: string;
  source?: string;
};

type MentorAudienceSelectorProps = {
  value: MentorAudienceValue;
  onChange: (value: MentorAudienceValue) => void;
  audienceStage: "highschool" | "after12";
  label?: string;
};

const SCOPE_OPTIONS: MentorAudienceScope[] = ["global", "institution", "class"];

function scopeLabel(scope: MentorAudienceScope, audienceStage: "highschool" | "after12") {
  if (scope === "global") return audienceStage === "highschool" ? "Global - High School" : "Global - After 12";
  if (scope === "institution") return "Specific Institution";
  return "Specific Class";
}

export default function MentorAudienceSelector({
  value,
  onChange,
  audienceStage,
  label = "Audience"
}: MentorAudienceSelectorProps) {
  const { colors, isDark } = useAppTheme();
  const [institutionQuery, setInstitutionQuery] = useState(value.institutionName || "");
  const [results, setResults] = useState<InstitutionSearchResult[]>([]);
  const [focused, setFocused] = useState(false);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    setInstitutionQuery(value.institutionName || "");
  }, [value.institutionName]);

  useEffect(() => {
    let active = true;
    if (!focused || value.scope === "global") {
      setResults([]);
      setSearching(false);
      return;
    }
    const query = institutionQuery.trim();
    if (query.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        setSearching(true);
        const { data } = await api.get("/api/profiles/institutions/search", { params: { q: query } });
        if (active) setResults(Array.isArray(data?.results) ? data.results : []);
      } catch {
        if (active) setResults([]);
      } finally {
        if (active) setSearching(false);
      }
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [focused, institutionQuery, value.scope]);

  const helperText = useMemo(() => {
    if (value.scope === "global") {
      return audienceStage === "highschool"
        ? "Visible across ORIN high-school surfaces."
        : "Visible across ORIN after-12 surfaces.";
    }
    if (value.scope === "institution") return "Visible only to students from the selected institution.";
    return "Visible only to students from the selected institution and class/section.";
  }, [audienceStage, value.scope]);

  const setScope = (scope: MentorAudienceScope) => {
    onChange({
      scope,
      institutionName: scope === "global" ? "" : value.institutionName,
      className: scope === "class" ? value.className : ""
    });
  };

  const setInstitution = (institutionName: string) => {
    onChange({ ...value, institutionName });
    setInstitutionQuery(institutionName);
  };

  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
      <View style={styles.chipRow}>
        {SCOPE_OPTIONS.map((scope) => {
          const active = value.scope === scope;
          return (
            <TouchableOpacity
              key={scope}
              style={[
                styles.scopeChip,
                { backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF", borderColor: colors.border },
                active && { backgroundColor: colors.accentSoft, borderColor: colors.accent }
              ]}
              onPress={() => setScope(scope)}
            >
              <Text style={[styles.scopeText, { color: active ? colors.accent : colors.textMuted }]}>
                {scopeLabel(scope, audienceStage)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <Text style={[styles.helpText, { color: colors.textMuted }]}>{helperText}</Text>

      {value.scope !== "global" ? (
        <View style={styles.searchWrap}>
          <Text style={[styles.subLabel, { color: colors.textMuted }]}>Institution</Text>
          <TextInput
            style={[
              styles.input,
              { backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF", borderColor: colors.border, color: colors.text }
            ]}
            placeholder="Search and select institution"
            placeholderTextColor={colors.textMuted}
            value={institutionQuery}
            onFocus={() => setFocused(true)}
            onChangeText={(text) => {
              setInstitutionQuery(text);
              onChange({ ...value, institutionName: text });
              setFocused(true);
            }}
          />
          {searching ? <ActivityIndicator size="small" color={colors.accent} style={styles.loader} /> : null}
          {focused && results.length ? (
            <View style={[styles.resultsBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {results.slice(0, 6).map((item) => (
                <TouchableOpacity
                  key={item.id || item.name}
                  style={styles.resultItem}
                  onPress={() => {
                    setInstitution(item.name);
                    setFocused(false);
                    setResults([]);
                  }}
                >
                  <Text style={[styles.resultName, { color: colors.text }]}>{item.name}</Text>
                  <Text style={[styles.resultMeta, { color: colors.textMuted }]}>
                    {[item.institutionType, item.district, item.state].filter(Boolean).join(" | ")}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
          {value.institutionName ? (
            <Text style={[styles.selectedText, { color: colors.textMuted }]}>Selected: {value.institutionName}</Text>
          ) : null}
        </View>
      ) : null}

      {value.scope === "class" ? (
        <ClassSectionSelector
          value={value.className}
          onChange={(className) => onChange({ ...value, className })}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8, marginBottom: 12 },
  label: { fontSize: 14, fontWeight: "900" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  scopeChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 9 },
  scopeText: { fontSize: 12, fontWeight: "900" },
  helpText: { fontSize: 12, fontWeight: "700" },
  searchWrap: { gap: 6 },
  subLabel: { fontSize: 12, fontWeight: "900", textTransform: "uppercase" },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontWeight: "700" },
  loader: { alignSelf: "flex-start" },
  resultsBox: { borderWidth: 1, borderRadius: 12, overflow: "hidden" },
  resultItem: { paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#D0D5DD" },
  resultName: { fontSize: 13, fontWeight: "900" },
  resultMeta: { marginTop: 2, fontSize: 11, fontWeight: "700" },
  selectedText: { fontSize: 12, fontWeight: "800" }
});
