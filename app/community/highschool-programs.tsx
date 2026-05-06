import React, { useCallback, useMemo, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { api } from "@/lib/api";
import { getAppErrorMessage } from "@/lib/appError";
import { useAppTheme } from "@/context/ThemeContext";
import {
  AcademicCard,
  AcademicEmpty,
  ActionButton,
  CommunitySection,
  HighSchoolCommunityShell,
  StatusBadge
} from "@/components/community/highschool-ui";

type OpportunityItem = {
  _id: string;
  title: string;
  company?: string;
  role?: string;
  type?: string;
  category?: string;
  duration?: string;
  description?: string;
  isActive?: boolean;
  recommendationReason?: string;
  applicationUrl?: string;
  url?: string;
  deadline?: string;
  location?: string;
};

type FilterKey = "all" | "workshop" | "olympiad" | "bootcamp" | "scholarship" | "event";
const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "workshop", label: "Workshops" },
  { key: "olympiad", label: "Olympiad Prep" },
  { key: "bootcamp", label: "Bootcamps" },
  { key: "scholarship", label: "Scholarships" },
  { key: "event", label: "School Events" }
];

function academicBucket(item: OpportunityItem): FilterKey {
  const text = `${item.title} ${item.type} ${item.category} ${item.role} ${item.description}`.toLowerCase();
  if (text.includes("scholar")) return "scholarship";
  if (text.includes("olympiad") || text.includes("exam")) return "olympiad";
  if (text.includes("bootcamp") || text.includes("camp")) return "bootcamp";
  if (text.includes("event") || text.includes("school")) return "event";
  return "workshop";
}

export default function HighSchoolProgramsScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const [programs, setPrograms] = useState<OpportunityItem[]>([]);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [selected, setSelected] = useState<OpportunityItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    try {
      if (refresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      const { data } = await api.get<OpportunityItem[]>("/api/network/opportunities");
      setPrograms((data || []).filter((item) => item.isActive !== false));
    } catch (e) {
      setError(getAppErrorMessage(e, "Failed to load school programs."));
      setPrograms([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const visible = useMemo(() => programs.filter((item) => filter === "all" || academicBucket(item) === filter), [filter, programs]);

  return (
    <HighSchoolCommunityShell
      title="School Programs"
      subtitle="After-12 opportunities engine, filtered and presented for academic-safe workshops, scholarships, bootcamps and school events."
      stats={[
        { icon: "briefcase", label: "Programs", value: String(programs.length) },
        { icon: "filter", label: "Filter", value: FILTERS.find((item) => item.key === filter)?.label || "All" },
        { icon: "school", label: "Mode", value: "Academic" }
      ]}
      loading={loading}
      error={error}
      refreshing={refreshing}
      onRefresh={() => load(true)}
    >
      <CommunitySection title="Program Filters" subtitle="Challenges do not appear here. They stay in School Challenges." icon="options">
        <View style={styles.filterRow}>
          {FILTERS.map((item) => {
            const active = filter === item.key;
            return (
              <TouchableOpacity
                key={item.key}
                onPress={() => setFilter(item.key)}
                style={[styles.filterChip, { borderColor: active ? "#16A34A" : colors.border, backgroundColor: active ? "#ECFDF3" : colors.surfaceAlt }]}
              >
                <Text style={[styles.filterText, { color: active ? "#15803D" : colors.textMuted }]}>{item.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </CommunitySection>

      <CommunitySection title="Available Academic Programs" subtitle="Real records from Opportunities API, academically labelled." icon="briefcase">
        {visible.length ? (
          visible.map((item) => {
            const bucket = academicBucket(item);
            return (
              <AcademicCard
                key={item._id || item.title}
                icon={bucket === "scholarship" ? "school-outline" : bucket === "olympiad" ? "medal-outline" : "calendar-outline"}
                title={item.title}
                meta={`${item.category || item.type || FILTERS.find((filterItem) => filterItem.key === bucket)?.label || "Program"}${item.duration ? ` · ${item.duration}` : ""}`}
                note={item.recommendationReason || item.description || `${item.company || "ORIN"}${item.location ? ` · ${item.location}` : ""}`}
                badge={bucket === "all" ? "Program" : FILTERS.find((filterItem) => filterItem.key === bucket)?.label || "Program"}
                badgeTone={bucket === "scholarship" ? "success" : "primary"}
                actionLabel="View Details"
                secondaryLabel={item.applicationUrl || item.url ? "Open Link" : undefined}
                onPress={() => setSelected(item)}
                onSecondaryPress={() => router.push("/community/opportunities" as never)}
              />
            );
          })
        ) : (
          <AcademicEmpty label="No academic programs are live for this filter right now." />
        )}
      </CommunitySection>

      {selected ? (
        <CommunitySection title="Program Detail" subtitle="Use the full after-12 opportunities workflow when application data exists." icon="reader">
          <View style={styles.detailHead}>
            <Text style={[styles.detailTitle, { color: colors.text }]}>{selected.title}</Text>
            <StatusBadge label={FILTERS.find((item) => item.key === academicBucket(selected))?.label || "Program"} tone="success" />
          </View>
          <Text style={[styles.detailMeta, { color: colors.textMuted }]}>
            {[selected.company, selected.role, selected.duration, selected.deadline ? `Deadline ${new Date(selected.deadline).toLocaleDateString("en-IN")}` : ""]
              .filter(Boolean)
              .join(" · ")}
          </Text>
          <Text style={[styles.detailText, { color: colors.textMuted }]}>{selected.description || selected.recommendationReason || "Program details will appear here when the backend provides them."}</Text>
          <ActionButton label="Open Full Opportunities" icon="open-outline" onPress={() => router.push("/community/opportunities" as never)} />
        </CommunitySection>
      ) : null}
    </HighSchoolCommunityShell>
  );
}

const styles = StyleSheet.create({
  filterRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  filterChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  filterText: { fontWeight: "900", fontSize: 12 },
  detailHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  detailTitle: { flex: 1, fontSize: 20, fontWeight: "900" },
  detailMeta: { fontWeight: "800", lineHeight: 20 },
  detailText: { lineHeight: 21, fontWeight: "600" }
});
