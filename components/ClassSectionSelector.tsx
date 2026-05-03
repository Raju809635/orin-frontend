import React, { useMemo } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useAppTheme } from "@/context/ThemeContext";

export const CLASS_NUMBER_OPTIONS = Array.from({ length: 12 }, (_, index) => String(index + 1));
export const SECTION_OPTIONS = ["A", "B", "C", "D", "E", "F"];

export function formatClassSection(classNumber: string, section: string) {
  const normalizedClass = String(classNumber || "").trim();
  const normalizedSection = String(section || "").trim().toUpperCase();
  if (!normalizedClass) return "";
  return `Class ${normalizedClass}${normalizedSection ? ` ${normalizedSection}` : ""}`;
}

export function parseClassSection(value: string) {
  const match = String(value || "").match(/(?:class|grade)?\s*(1[0-2]|[1-9])\s*([A-F])?/i);
  return {
    classNumber: match?.[1] || "",
    section: (match?.[2] || "").toUpperCase()
  };
}

type ClassSectionSelectorProps = {
  value: string;
  onChange: (value: string) => void;
  classLabel?: string;
  sectionLabel?: string;
  optionalSection?: boolean;
};

export default function ClassSectionSelector({
  value,
  onChange,
  classLabel = "Class",
  sectionLabel = "Section",
  optionalSection = false
}: ClassSectionSelectorProps) {
  const { colors } = useAppTheme();
  const parsed = useMemo(() => parseClassSection(value), [value]);

  const setClassNumber = (classNumber: string) => {
    onChange(formatClassSection(classNumber, parsed.section));
  };

  const setSection = (section: string) => {
    if (!parsed.classNumber) return;
    onChange(formatClassSection(parsed.classNumber, section));
  };

  return (
    <View style={styles.wrap}>
      <Text style={[styles.selectorLabel, { color: colors.textMuted }]}>{classLabel}</Text>
      <View style={styles.chipWrap}>
        {CLASS_NUMBER_OPTIONS.map((item) => {
          const active = parsed.classNumber === item;
          return (
            <TouchableOpacity
              key={item}
              style={[
                styles.chip,
                { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
                active && { backgroundColor: colors.accentSoft, borderColor: colors.accent }
              ]}
              onPress={() => setClassNumber(item)}
            >
              <Text style={[styles.chipText, { color: active ? colors.accent : colors.textMuted }]}>{item}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.sectionHeader}>
        <Text style={[styles.selectorLabel, { color: colors.textMuted }]}>{sectionLabel}</Text>
        {optionalSection && parsed.section ? (
          <TouchableOpacity onPress={() => onChange(formatClassSection(parsed.classNumber, ""))}>
            <Text style={[styles.clearText, { color: colors.accent }]}>Clear</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      <View style={styles.chipWrap}>
        {SECTION_OPTIONS.map((item) => {
          const active = parsed.section === item;
          const disabled = !parsed.classNumber;
          return (
            <TouchableOpacity
              key={item}
              disabled={disabled}
              style={[
                styles.chip,
                { backgroundColor: colors.surfaceAlt, borderColor: colors.border, opacity: disabled ? 0.55 : 1 },
                active && { backgroundColor: colors.accentSoft, borderColor: colors.accent }
              ]}
              onPress={() => setSection(item)}
            >
              <Text style={[styles.chipText, { color: active ? colors.accent : colors.textMuted }]}>{item}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {value ? <Text style={[styles.selectedText, { color: colors.textMuted }]}>Selected: {value}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8, marginBottom: 12 },
  selectorLabel: { fontSize: 12, fontWeight: "800", textTransform: "uppercase" },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    minWidth: 40,
    minHeight: 38,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10
  },
  chipText: { fontSize: 13, fontWeight: "900" },
  clearText: { fontSize: 12, fontWeight: "900" },
  selectedText: { fontSize: 12, fontWeight: "700" }
});
