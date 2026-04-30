import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useAppTheme } from "@/context/ThemeContext";

export function StageCommunityScaffold({
  title,
  subtitle,
  loading,
  error,
  refreshing,
  onRefresh,
  children
}: {
  title: string;
  subtitle: string;
  loading: boolean;
  error?: string | null;
  refreshing: boolean;
  onRefresh: () => void;
  children: React.ReactNode;
}) {
  const { colors } = useAppTheme();
  return (
    <ScrollView
      contentContainerStyle={[styles.page, { backgroundColor: colors.background }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={[styles.pageTitle, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.pageSub, { color: colors.textMuted }]}>{subtitle}</Text>
      {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
      {loading ? <ActivityIndicator size="large" color={colors.accent} style={{ marginVertical: 12 }} /> : null}
      {children}
    </ScrollView>
  );
}

export function StageStatRow({ items }: { items: { label: string; value: string }[] }) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.statRow}>
      {items.map((item) => (
        <View key={item.label} style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.statValue, { color: colors.text }]}>{item.value}</Text>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>{item.label}</Text>
        </View>
      ))}
    </View>
  );
}

export function StageSection({
  title,
  icon,
  actionLabel,
  onAction,
  children
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  actionLabel?: string;
  onAction?: () => void;
  children: React.ReactNode;
}) {
  const { colors } = useAppTheme();
  return (
    <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleWrap}>
          <Ionicons name={icon} size={16} color={colors.accent} />
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
        </View>
        {actionLabel && onAction ? (
          <TouchableOpacity onPress={onAction}>
            <Text style={[styles.sectionAction, { color: colors.accent }]}>{actionLabel}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      {children}
    </View>
  );
}

export function StageListCard({
  title,
  meta,
  note,
  tone = "default"
}: {
  title: string;
  meta?: string;
  note?: string;
  tone?: "default" | "kid" | "highschool";
}) {
  const { colors, isDark } = useAppTheme();
  const backgroundColor =
    tone === "kid" ? (isDark ? "rgba(34,197,94,0.12)" : "#F0FDF4") :
    tone === "highschool" ? (isDark ? "rgba(59,130,246,0.12)" : "#EFF6FF") :
    colors.surfaceAlt;
  return (
    <View style={[styles.listCard, { backgroundColor, borderColor: colors.border }]}>
      <Text style={[styles.cardTitle, { color: colors.text }]}>{title}</Text>
      {meta ? <Text style={[styles.cardMeta, { color: colors.textMuted }]}>{meta}</Text> : null}
      {note ? <Text style={[styles.cardNote, { color: colors.textMuted }]}>{note}</Text> : null}
    </View>
  );
}

export function EmptyState({ label }: { label: string }) {
  const { colors } = useAppTheme();
  return <Text style={[styles.empty, { color: colors.textMuted }]}>{label}</Text>;
}

const styles = StyleSheet.create({
  page: { flexGrow: 1, padding: 20, paddingBottom: 120, gap: 14 },
  pageTitle: { fontSize: 30, fontWeight: "900" },
  pageSub: { fontSize: 15, lineHeight: 22 },
  error: { fontWeight: "700" },
  statRow: { flexDirection: "row", gap: 10 },
  statCard: { flex: 1, borderWidth: 1, borderRadius: 14, padding: 12, gap: 4 },
  statValue: { fontSize: 22, fontWeight: "900" },
  statLabel: { fontSize: 12, fontWeight: "700" },
  section: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 10 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sectionTitleWrap: { flexDirection: "row", alignItems: "center", gap: 6 },
  sectionTitle: { fontWeight: "900", fontSize: 16 },
  sectionAction: { fontWeight: "800" },
  listCard: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 4 },
  cardTitle: { fontWeight: "900", fontSize: 15 },
  cardMeta: { fontSize: 13, lineHeight: 18 },
  cardNote: { fontSize: 12, lineHeight: 17 },
  empty: { lineHeight: 20 }
});
