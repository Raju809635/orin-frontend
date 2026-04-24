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
import { useAppTheme } from "@/context/ThemeContext";

const COMMUNITY_ACCENT = "#C98A00";
const COMMUNITY_ACCENT_SOFT = "#FFF4CC";
const COMMUNITY_SUCCESS = "#15803D";
const COMMUNITY_INFO = "#1D4ED8";
const COMMUNITY_GHOST = "#FFF7ED";

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
  const { colors, isDark } = useAppTheme();
  return (
    <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border, shadowColor: isDark ? "#000000" : "#101828" }, style]}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleRow}>
          {icon ? <Ionicons name={icon} size={18} color={COMMUNITY_ACCENT} /> : null}
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
        </View>
        {subtitle ? <Text style={[styles.sectionSubtitle, { color: colors.textMuted }]}>{subtitle}</Text> : null}
      </View>
      {children}
    </View>
  );
}

export function FilterTabs({ tabs }: { tabs: TabProps[] }) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.tabsRow}>
      {tabs.map((tab) => (
        <TouchableOpacity
          key={tab.label}
          style={[
            styles.tabChip,
            { borderColor: colors.border, backgroundColor: colors.surfaceAlt },
            tab.active && [styles.tabChipActive, { backgroundColor: isDark ? colors.surfaceAlt : COMMUNITY_ACCENT_SOFT, borderColor: COMMUNITY_ACCENT }]
          ]}
          activeOpacity={0.9}
          onPress={tab.onPress}
        >
          <Text style={[styles.tabChipText, { color: colors.textMuted }, tab.active && [styles.tabChipTextActive, { color: COMMUNITY_ACCENT }]]}>{tab.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

export function StatusBadge({ label, tone = "neutral" }: StatusBadgeProps) {
  const { isDark } = useAppTheme();
  const badgeTone = badgeTones[tone];
  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: isDark ? badgeTone.darkBg || badgeTone.bg : badgeTone.bg,
          borderColor: isDark ? badgeTone.darkBorder || badgeTone.border : badgeTone.border
        }
      ]}
    >
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
  const { colors, isDark } = useAppTheme();
  return (
    <View style={[styles.pill, { backgroundColor: isDark ? colors.surfaceAlt : tone, borderColor: colors.border, borderWidth: isDark ? 1 : 0 }]}>
      <Ionicons name={icon} size={14} color={COMMUNITY_ACCENT} />
      <Text style={[styles.pillText, { color: colors.text }, textStyle]}>{label}</Text>
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
  const { colors, isDark } = useAppTheme();
  const width = `${Math.max(0, Math.min(100, progress))}%`;
  return (
    <View style={[styles.progressTrack, { backgroundColor: isDark ? colors.surfaceAlt : "#E4E7EC" }]}>
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
  const { colors, isDark } = useAppTheme();
  const buttonStyle =
    variant === "primary" ? styles.primaryButton : variant === "secondary" ? styles.secondaryButton : styles.ghostButton;
  const iconColor = variant === "primary" ? colors.accentText : variant === "secondary" ? COMMUNITY_INFO : COMMUNITY_ACCENT;
  const dynamicButtonStyle =
    variant === "primary"
      ? { backgroundColor: COMMUNITY_SUCCESS }
      : variant === "secondary"
        ? { backgroundColor: isDark ? colors.surfaceAlt : "#F8FAFC", borderColor: colors.border }
        : { backgroundColor: COMMUNITY_GHOST };
  const dynamicTextStyle =
    variant === "primary"
      ? { color: colors.accentText }
      : variant === "secondary"
        ? { color: COMMUNITY_INFO }
        : { color: COMMUNITY_ACCENT };

  return (
    <TouchableOpacity
      activeOpacity={0.92}
      style={[buttonStyle, dynamicButtonStyle, disabled && styles.buttonDisabled, style]}
      onPress={onPress}
      disabled={disabled}
    >
      {icon ? <Ionicons name={icon} size={16} color={iconColor} /> : null}
      <Text style={[variant === "primary" ? styles.primaryButtonText : variant === "secondary" ? styles.secondaryButtonText : styles.ghostButtonText, dynamicTextStyle]}>{label}</Text>
    </TouchableOpacity>
  );
}

const badgeTones = {
  primary: { bg: "#EEF2FF", border: "#C7D2FE", darkBg: "#1C2748", darkBorder: "#324A8A", text: "#7EA5FF" },
  success: { bg: "#ECFDF3", border: "#ABEFC6", darkBg: "#123323", darkBorder: "#2A7751", text: "#63D297" },
  warning: { bg: "#FFF7ED", border: "#F9DBAF", darkBg: "#3A2A10", darkBorder: "#6D5223", text: "#FDBA74" },
  danger: { bg: "#FEF3F2", border: "#FECDCA", darkBg: "#3A1717", darkBorder: "#7C2D2D", text: "#FCA5A5" },
  neutral: { bg: "#F2F4F7", border: "#D0D5DD", darkBg: "#1D2731", darkBorder: "#344054", text: "#D0D5DD" }
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
