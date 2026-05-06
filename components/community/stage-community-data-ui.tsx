import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useAppTheme } from "@/context/ThemeContext";

export function StageCommunityScaffold({
  title,
  subtitle,
  eyebrow,
  loading,
  error,
  refreshing,
  onRefresh,
  children
}: {
  title: string;
  subtitle: string;
  eyebrow?: string;
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
      <View style={[styles.hero, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {eyebrow ? <Text style={[styles.eyebrow, { color: colors.accent }]}>{eyebrow}</Text> : null}
        <Text style={[styles.pageTitle, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.pageSub, { color: colors.textMuted }]}>{subtitle}</Text>
      </View>
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
  tone = "default",
  onPress
}: {
  title: string;
  meta?: string;
  note?: string;
  tone?: "default" | "kid" | "highschool";
  onPress?: () => void;
}) {
  const { colors, isDark } = useAppTheme();
  const backgroundColor =
    tone === "kid" ? (isDark ? "rgba(34,197,94,0.12)" : "#F0FDF4") :
    tone === "highschool" ? (isDark ? "rgba(59,130,246,0.12)" : "#EFF6FF") :
    colors.surfaceAlt;
  const content = (
    <>
      <Text style={[styles.cardTitle, { color: colors.text }]}>{title}</Text>
      {meta ? <Text style={[styles.cardMeta, { color: colors.textMuted }]}>{meta}</Text> : null}
      {note ? <Text style={[styles.cardNote, { color: colors.textMuted }]}>{note}</Text> : null}
    </>
  );
  if (onPress) {
    return (
      <TouchableOpacity activeOpacity={0.9} onPress={onPress} style={[styles.listCard, { backgroundColor, borderColor: colors.border }]}>
        {content}
      </TouchableOpacity>
    );
  }
  return (
    <View style={[styles.listCard, { backgroundColor, borderColor: colors.border }]}>
      {content}
    </View>
  );
}

export function EmptyState({ label }: { label: string }) {
  const { colors } = useAppTheme();
  return <Text style={[styles.empty, { color: colors.textMuted }]}>{label}</Text>;
}

export function StageProgressBar({ value, tone = "highschool" }: { value: number; tone?: "highschool" | "success" | "warning" }) {
  const { colors } = useAppTheme();
  const safeValue = Math.max(0, Math.min(100, Number(value || 0)));
  const fillColor = tone === "success" ? "#16A34A" : tone === "warning" ? "#F97316" : colors.accent;
  return (
    <View style={[styles.progressTrack, { backgroundColor: colors.surfaceAlt }]}>
      <View style={[styles.progressFill, { width: `${safeValue}%`, backgroundColor: fillColor }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flexGrow: 1, padding: 16, paddingBottom: 112, gap: 12 },
  hero: { borderWidth: 1, borderRadius: 22, padding: 16, gap: 6 },
  eyebrow: { fontSize: 12, fontWeight: "900", letterSpacing: 0.8, textTransform: "uppercase" },
  pageTitle: { fontSize: 26, fontWeight: "900", letterSpacing: -0.4 },
  pageSub: { fontSize: 14, lineHeight: 20 },
  error: { fontWeight: "700" },
  statRow: { flexDirection: "row", gap: 10 },
  statCard: { flex: 1, borderWidth: 1, borderRadius: 16, padding: 12, gap: 3 },
  statValue: { fontSize: 20, fontWeight: "900" },
  statLabel: { fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.3 },
  section: { borderWidth: 1, borderRadius: 18, padding: 14, gap: 10 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sectionTitleWrap: { flexDirection: "row", alignItems: "center", gap: 6 },
  sectionTitle: { fontWeight: "900", fontSize: 16 },
  sectionAction: { fontWeight: "800" },
  listCard: { borderWidth: 1, borderRadius: 14, padding: 12, gap: 4 },
  cardTitle: { fontWeight: "900", fontSize: 15 },
  cardMeta: { fontSize: 13, lineHeight: 18 },
  cardNote: { fontSize: 12, lineHeight: 17 },
  empty: { lineHeight: 20, fontWeight: "700" },
  progressTrack: { height: 8, borderRadius: 999, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 999 }
});
