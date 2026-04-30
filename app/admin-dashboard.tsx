import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useAppTheme } from "@/context/ThemeContext";

export default function AdminDashboardPage() {
  const { colors } = useAppTheme();

  return (
    <ScrollView contentContainerStyle={[styles.page, { backgroundColor: colors.background }]}>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.text }]}>Admin Dashboard</Text>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>
          Admin controls are available on this route. This page exists so the app router, deep links, and saved navigation state stay stable.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    flexGrow: 1,
    padding: 20
  },
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 18,
    gap: 8
  },
  title: {
    fontSize: 28,
    fontWeight: "900"
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 21
  }
});
