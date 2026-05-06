import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type StyleProp,
  type ViewStyle
} from "react-native";
import {
  ActionButton,
  CommunityHero,
  CommunitySection,
  ProgressBar,
  StatPill,
  StatusBadge
} from "@/components/community/ui";
import { useAppTheme } from "@/context/ThemeContext";

type HeroStat = { icon: keyof typeof Ionicons.glyphMap; label: string; value: string };

export function HighSchoolCommunityShell({
  eyebrow = "High School Community",
  title,
  subtitle,
  stats,
  loading,
  refreshing,
  error,
  onRefresh,
  children
}: {
  eyebrow?: string;
  title: string;
  subtitle: string;
  stats?: HeroStat[];
  loading?: boolean;
  refreshing?: boolean;
  error?: string | null;
  onRefresh?: () => void;
  children: React.ReactNode;
}) {
  const { colors } = useAppTheme();
  return (
    <ScrollView
      contentContainerStyle={[styles.page, { backgroundColor: colors.background }]}
      refreshControl={onRefresh ? <RefreshControl refreshing={Boolean(refreshing)} onRefresh={onRefresh} /> : undefined}
      showsVerticalScrollIndicator={false}
    >
      <CommunityHero
        eyebrow={eyebrow}
        title={title}
        subtitle={subtitle}
        stats={stats}
        colors={["#0F766E", "#16A34A", "#F59E0B"]}
      />
      {error ? (
        <View style={[styles.notice, { backgroundColor: colors.surface, borderColor: "#FCA5A5" }]}>
          <Ionicons name="warning-outline" size={17} color="#DC2626" />
          <Text style={[styles.noticeText, { color: colors.text }]}>{error}</Text>
        </View>
      ) : null}
      {loading ? <ActivityIndicator size="large" color="#16A34A" /> : children}
    </ScrollView>
  );
}

export function AcademicCard({
  icon,
  title,
  meta,
  note,
  badge,
  badgeTone = "neutral",
  progress,
  progressTone = "#16A34A",
  actionLabel,
  secondaryLabel,
  onPress,
  onSecondaryPress,
  style
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  meta?: string;
  note?: string;
  badge?: string;
  badgeTone?: "primary" | "success" | "warning" | "danger" | "neutral";
  progress?: number;
  progressTone?: string;
  actionLabel?: string;
  secondaryLabel?: string;
  onPress?: () => void;
  onSecondaryPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useAppTheme();
  return (
    <TouchableOpacity
      activeOpacity={onPress ? 0.9 : 1}
      onPress={onPress}
      style={[styles.card, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }, style]}
    >
      <View style={styles.cardTop}>
        <View style={[styles.iconBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name={icon || "school-outline"} size={20} color="#15803D" />
        </View>
        <View style={styles.cardText}>
          <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={2}>
            {title}
          </Text>
          {meta ? (
            <Text style={[styles.cardMeta, { color: colors.textMuted }]} numberOfLines={1}>
              {meta}
            </Text>
          ) : null}
        </View>
        {badge ? <StatusBadge label={badge} tone={badgeTone} /> : null}
      </View>
      {note ? (
        <Text style={[styles.cardNote, { color: colors.textMuted }]} numberOfLines={3}>
          {note}
        </Text>
      ) : null}
      {typeof progress === "number" ? <ProgressBar progress={progress} tone={progressTone} /> : null}
      {(actionLabel || secondaryLabel) ? (
        <View style={styles.actionRow}>
          {actionLabel ? <ActionButton label={actionLabel} icon="arrow-forward" onPress={onPress} style={styles.actionButton} /> : null}
          {secondaryLabel ? (
            <ActionButton label={secondaryLabel} icon="open-outline" variant="secondary" onPress={onSecondaryPress} style={styles.actionButton} />
          ) : null}
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

export function AcademicEmpty({ label, actionLabel, onAction }: { label: string; actionLabel?: string; onAction?: () => void }) {
  const { colors } = useAppTheme();
  return (
    <View style={[styles.empty, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
      <Ionicons name="file-tray-outline" size={24} color="#94A3B8" />
      <Text style={[styles.emptyText, { color: colors.textMuted }]}>{label}</Text>
      {actionLabel ? <ActionButton label={actionLabel} variant="ghost" icon="add-circle-outline" onPress={onAction} /> : null}
    </View>
  );
}

export function AcademicMetricRow({ items }: { items: { icon: keyof typeof Ionicons.glyphMap; label: string; tone?: string }[] }) {
  return (
    <View style={styles.metricRow}>
      {items.map((item) => (
        <StatPill key={`${item.icon}-${item.label}`} icon={item.icon} label={item.label} tone={item.tone} />
      ))}
    </View>
  );
}

export { ActionButton, CommunitySection, ProgressBar, StatusBadge };

const styles = StyleSheet.create({
  page: {
    padding: 16,
    paddingBottom: 110,
    gap: 12
  },
  notice: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    flexDirection: "row",
    gap: 8,
    alignItems: "center"
  },
  noticeText: {
    flex: 1,
    fontWeight: "700",
    lineHeight: 19
  },
  card: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    gap: 10
  },
  cardTop: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start"
  },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  cardText: {
    flex: 1,
    gap: 3
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "900"
  },
  cardMeta: {
    fontSize: 12,
    fontWeight: "700"
  },
  cardNote: {
    lineHeight: 20,
    fontWeight: "600"
  },
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  actionButton: {
    flexGrow: 1
  },
  empty: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 18,
    gap: 10,
    alignItems: "center"
  },
  emptyText: {
    textAlign: "center",
    lineHeight: 20,
    fontWeight: "700"
  },
  metricRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  }
});
