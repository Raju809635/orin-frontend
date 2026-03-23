import React from "react";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

type HeroProps = {
  eyebrow?: string;
  title: string;
  subtitle: string;
  stats?: Array<{ icon: keyof typeof Ionicons.glyphMap; label: string; value: string }>;
  colors?: readonly [string, string, ...string[]];
};

type TabProps = {
  label: string;
  active: boolean;
  onPress: () => void;
};

type StatusBadgeProps = {
  label: string;
  tone?: "primary" | "success" | "warning" | "danger" | "neutral";
};

type ActionButtonProps = {
  label: string;
  onPress?: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  variant?: "primary" | "secondary" | "ghost";
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function CommunityHero({
  eyebrow,
  title,
  subtitle,
  stats = [],
  colors = ["#4457FF", "#7B61FF", "#A86CFF"]
}: HeroProps) {
  return (
    <LinearGradient colors={colors} style={styles.hero}>
      {eyebrow ? <Text style={styles.heroEyebrow}>{eyebrow}</Text> : null}
      <Text style={styles.heroTitle}>{title}</Text>
      <Text style={styles.heroSubtitle}>{subtitle}</Text>
      {stats.length ? (
        <View style={styles.heroStats}>
          {stats.map((stat) => (
            <View key={`${stat.label}-${stat.value}`} style={styles.heroStatCard}>
              <Ionicons name={stat.icon} size={16} color="#FFFFFF" />
              <Text style={styles.heroStatValue}>{stat.value}</Text>
              <Text style={styles.heroStatLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </LinearGradient>
  );
}

export function CommunitySection({
  title,
  subtitle,
  icon,
  children,
  style
}: {
  title: string;
  subtitle?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.section, style]}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleRow}>
          {icon ? <Ionicons name={icon} size={18} color="#1F7A4C" /> : null}
          <Text style={styles.sectionTitle}>{title}</Text>
        </View>
        {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
      </View>
      {children}
    </View>
  );
}

export function FilterTabs({ tabs }: { tabs: TabProps[] }) {
  return (
    <View style={styles.tabsRow}>
      {tabs.map((tab) => (
        <TouchableOpacity
          key={tab.label}
          style={[styles.tabChip, tab.active && styles.tabChipActive]}
          activeOpacity={0.9}
          onPress={tab.onPress}
        >
          <Text style={[styles.tabChipText, tab.active && styles.tabChipTextActive]}>{tab.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

export function StatusBadge({ label, tone = "neutral" }: StatusBadgeProps) {
  const badgeTone = badgeTones[tone];
  return (
    <View style={[styles.badge, { backgroundColor: badgeTone.bg, borderColor: badgeTone.border }]}>
      <Text style={[styles.badgeText, { color: badgeTone.text }]}>{label}</Text>
    </View>
  );
}

export function StatPill({
  icon,
  label,
  tone = "#EEF2FF",
  textStyle
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  tone?: string;
  textStyle?: StyleProp<TextStyle>;
}) {
  return (
    <View style={[styles.pill, { backgroundColor: tone }]}>
      <Ionicons name={icon} size={14} color="#1D2939" />
      <Text style={[styles.pillText, textStyle]}>{label}</Text>
    </View>
  );
}

export function ProgressBar({
  progress,
  tone = "#4457FF"
}: {
  progress: number;
  tone?: string;
}) {
  const width = `${Math.max(0, Math.min(100, progress))}%`;
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width, backgroundColor: tone }]} />
    </View>
  );
}

export function ActionButton({
  label,
  onPress,
  icon,
  variant = "primary",
  disabled,
  style
}: ActionButtonProps) {
  const buttonStyle =
    variant === "primary" ? styles.primaryButton : variant === "secondary" ? styles.secondaryButton : styles.ghostButton;
  const textStyle =
    variant === "primary" ? styles.primaryButtonText : variant === "secondary" ? styles.secondaryButtonText : styles.ghostButtonText;

  return (
    <TouchableOpacity
      activeOpacity={0.92}
      style={[buttonStyle, disabled && styles.buttonDisabled, style]}
      onPress={onPress}
      disabled={disabled}
    >
      {icon ? <Ionicons name={icon} size={16} color={variant === "primary" ? "#fff" : "#344054"} /> : null}
      <Text style={textStyle}>{label}</Text>
    </TouchableOpacity>
  );
}

const badgeTones = {
  primary: { bg: "#EEF2FF", border: "#C7D2FE", text: "#4457FF" },
  success: { bg: "#ECFDF3", border: "#ABEFC6", text: "#027A48" },
  warning: { bg: "#FFF7ED", border: "#F9DBAF", text: "#B54708" },
  danger: { bg: "#FEF3F2", border: "#FECDCA", text: "#B42318" },
  neutral: { bg: "#F2F4F7", border: "#D0D5DD", text: "#475467" }
};

const styles = StyleSheet.create({
  hero: {
    borderRadius: 22,
    padding: 18,
    gap: 10,
    shadowColor: "#4457FF",
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5
  },
  heroEyebrow: { color: "rgba(255,255,255,0.82)", fontWeight: "700", fontSize: 12, textTransform: "uppercase" },
  heroTitle: { color: "#FFFFFF", fontSize: 26, fontWeight: "800" },
  heroSubtitle: { color: "rgba(255,255,255,0.9)", lineHeight: 20 },
  heroStats: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 4 },
  heroStatCard: {
    minWidth: 92,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "rgba(255,255,255,0.18)",
    gap: 2
  },
  heroStatValue: { color: "#FFFFFF", fontWeight: "800", fontSize: 16 },
  heroStatLabel: { color: "rgba(255,255,255,0.86)", fontSize: 12, fontWeight: "600" },
  section: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 14,
    gap: 12,
    shadowColor: "#101828",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    borderWidth: 1,
    borderColor: "#EAECF0",
    elevation: 3
  },
  sectionHeader: { gap: 4 },
  sectionTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  sectionTitle: { color: "#101828", fontSize: 18, fontWeight: "800" },
  sectionSubtitle: { color: "#667085", lineHeight: 20 },
  tabsRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  tabChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#D0D5DD",
    backgroundColor: "#FFFFFF"
  },
  tabChipActive: { backgroundColor: "#EEF2FF", borderColor: "#C7D2FE" },
  tabChipText: { color: "#475467", fontWeight: "700", fontSize: 13 },
  tabChipTextActive: { color: "#3448C5" },
  badge: {
    alignSelf: "flex-start",
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999
  },
  badgeText: { fontSize: 12, fontWeight: "800" },
  pill: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: 6, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  pillText: { color: "#344054", fontSize: 12, fontWeight: "700" },
  progressTrack: { height: 10, borderRadius: 999, backgroundColor: "#E4E7EC", overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 999 },
  primaryButton: {
    minHeight: 42,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: "#1F7A4C",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8
  },
  secondaryButton: {
    minHeight: 42,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#D0D5DD",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8
  },
  ghostButton: {
    minHeight: 42,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: "#EEF2FF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8
  },
  primaryButtonText: { color: "#FFFFFF", fontWeight: "800" },
  secondaryButtonText: { color: "#344054", fontWeight: "800" },
  ghostButtonText: { color: "#3448C5", fontWeight: "800" },
  buttonDisabled: { opacity: 0.6 }
});
