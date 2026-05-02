import React, { ReactNode, useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAppTheme } from "@/context/ThemeContext";
import { api } from "@/lib/api";
import { getAppErrorMessage } from "@/lib/appError";

export type ManagementScope = {
  mentorOrgRole?: "global_mentor" | "institution_teacher" | "organisation_head";
  institutionName?: string;
  assignedClasses?: string[];
  isHead?: boolean;
};

export function useInstitutionManagement<T>(endpoint: string) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (nextRefreshing = false) => {
    if (nextRefreshing) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError("");
    try {
      const response = await api.get<T>(`/api/institution-management/${endpoint}`);
      setData(response.data);
    } catch (err) {
      setError(getAppErrorMessage(err, "Unable to load institution management data."));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [endpoint]);

  useEffect(() => {
    void load();
  }, [load]);

  return { data, loading, refreshing, error, reload: () => load(true) };
}

export function ManagementScreen({
  eyebrow,
  title,
  subtitle,
  children,
  loading,
  refreshing,
  error,
  onRefresh
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  children: ReactNode;
  loading?: boolean;
  refreshing?: boolean;
  error?: string;
  onRefresh?: () => void;
}) {
  const { colors, isDark } = useAppTheme();

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={Boolean(refreshing)} onRefresh={onRefresh || (() => {})} />}
    >
      <View style={[styles.hero, { backgroundColor: isDark ? "#0F2D22" : "#EAF7EF", borderColor: colors.border }]}>
        <Text style={[styles.eyebrow, { color: colors.accent }]}>{eyebrow}</Text>
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>{subtitle}</Text>
      </View>
      {error ? (
        <View style={[styles.notice, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="alert-circle" size={20} color={colors.danger} />
          <Text style={[styles.noticeText, { color: colors.text }]}>{error}</Text>
        </View>
      ) : null}
      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.accent} />
          <Text style={[styles.meta, { color: colors.textMuted }]}>Loading management data...</Text>
        </View>
      ) : (
        children
      )}
    </ScrollView>
  );
}

export function MetricGrid({ children }: { children: ReactNode }) {
  return <View style={styles.metricGrid}>{children}</View>;
}

export function MetricCard({ label, value, icon }: { label: string; value: string | number; icon: keyof typeof Ionicons.glyphMap }) {
  const { colors } = useAppTheme();
  return (
    <View style={[styles.metricCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={[styles.iconBubble, { backgroundColor: colors.accentSoft }]}>
        <Ionicons name={icon} size={18} color={colors.accent} />
      </View>
      <Text style={[styles.metricValue, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.meta, { color: colors.textMuted }]}>{label}</Text>
    </View>
  );
}

export function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.sectionTitleWrap}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
      {subtitle ? <Text style={[styles.meta, { color: colors.textMuted }]}>{subtitle}</Text> : null}
    </View>
  );
}

export function InfoCard({
  title,
  subtitle,
  meta,
  icon,
  to
}: {
  title: string;
  subtitle?: string;
  meta?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  to?: string;
}) {
  const router = useRouter();
  const { colors } = useAppTheme();
  const content = (
    <>
      <View style={styles.cardHead}>
        {icon ? (
          <View style={[styles.iconBubble, { backgroundColor: colors.accentSoft }]}>
            <Ionicons name={icon} size={18} color={colors.accent} />
          </View>
        ) : null}
        <View style={styles.cardText}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>{title}</Text>
          {subtitle ? <Text style={[styles.meta, { color: colors.textMuted }]}>{subtitle}</Text> : null}
        </View>
        {to ? <Ionicons name="chevron-forward" size={18} color={colors.textMuted} /> : null}
      </View>
      {meta ? <Text style={[styles.cardMeta, { color: colors.textMuted }]}>{meta}</Text> : null}
    </>
  );

  if (to) {
    return (
      <TouchableOpacity style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => router.push(to as never)}>
        {content}
      </TouchableOpacity>
    );
  }

  return <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>{content}</View>;
}

export function EmptyState({ title, subtitle }: { title: string; subtitle: string }) {
  const { colors } = useAppTheme();
  return (
    <View style={[styles.empty, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Ionicons name="file-tray-outline" size={24} color={colors.textMuted} />
      <Text style={[styles.cardTitle, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.meta, { color: colors.textMuted }]}>{subtitle}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 18, paddingBottom: 110, gap: 16 },
  hero: { borderWidth: 1, borderRadius: 26, padding: 22, gap: 8 },
  eyebrow: { fontSize: 12, fontWeight: "900", letterSpacing: 1, textTransform: "uppercase" },
  title: { fontSize: 28, fontWeight: "900" },
  subtitle: { fontSize: 15, lineHeight: 22 },
  notice: { borderWidth: 1, borderRadius: 18, padding: 14, flexDirection: "row", gap: 10, alignItems: "center" },
  noticeText: { flex: 1, fontWeight: "700" },
  loading: { paddingVertical: 40, alignItems: "center", gap: 10 },
  metricGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  metricCard: { width: "48%", minWidth: 150, borderWidth: 1, borderRadius: 20, padding: 16, gap: 8 },
  iconBubble: { width: 38, height: 38, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  metricValue: { fontSize: 24, fontWeight: "900" },
  meta: { fontSize: 13, lineHeight: 19 },
  sectionTitleWrap: { gap: 4, marginTop: 6 },
  sectionTitle: { fontSize: 20, fontWeight: "900" },
  infoCard: { borderWidth: 1, borderRadius: 20, padding: 16, gap: 10 },
  cardHead: { flexDirection: "row", alignItems: "center", gap: 12 },
  cardText: { flex: 1, gap: 3 },
  cardTitle: { fontSize: 16, fontWeight: "900" },
  cardMeta: { fontSize: 13, lineHeight: 19 },
  empty: { borderWidth: 1, borderRadius: 20, padding: 18, alignItems: "center", gap: 8 }
});
