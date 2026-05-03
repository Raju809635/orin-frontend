import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "@/context/ThemeContext";

type HighSchoolHeaderProps = {
  eyebrow: string;
  title: string;
  subtitle: string;
  chips?: string[];
};

export default function HighSchoolHeader({ eyebrow, title, subtitle, chips = [] }: HighSchoolHeaderProps) {
  const { colors, isDark } = useAppTheme();
  const gradient = isDark ? ["#102033", "#142A29"] : ["#EAF4FF", "#ECFDF3"];

  return (
    <LinearGradient colors={gradient as [string, string]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.card, { borderColor: colors.border }]}>
      <View style={styles.topRow}>
        <View style={[styles.iconWrap, { backgroundColor: colors.surface }]}>
          <Ionicons name="school" size={20} color={colors.accent} />
        </View>
        <Text style={[styles.eyebrow, { color: colors.accent }]}>{eyebrow}</Text>
      </View>
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.subtitle, { color: colors.textMuted }]}>{subtitle}</Text>
      {chips.length ? (
        <View style={styles.chipRow}>
          {chips.map((chip) => (
            <View key={chip} style={[styles.chip, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.chipText, { color: colors.text }]}>{chip}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 26,
    padding: 18,
    gap: 9,
    marginBottom: 14,
    shadowColor: "#0F172A",
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 3
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center"
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.8,
    textTransform: "uppercase"
  },
  title: {
    fontSize: 25,
    lineHeight: 30,
    fontWeight: "900"
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "600"
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 2
  },
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  chipText: {
    fontSize: 11,
    fontWeight: "900"
  }
});
