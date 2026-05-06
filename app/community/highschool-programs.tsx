import React, { useCallback, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { Text, TouchableOpacity, View } from "react-native";
import { api } from "@/lib/api";
import { getAppErrorMessage } from "@/lib/appError";
import { EmptyState, StageCommunityScaffold, StageListCard, StageSection, StageStatRow } from "@/components/community/stage-community-data-ui";

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
};

export default function HighSchoolProgramsScreen() {
  const router = useRouter();
  const [programs, setPrograms] = useState<OpportunityItem[]>([]);
  const [typeFilter, setTypeFilter] = useState<"all" | "program" | "opportunity">("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    try {
      if (refresh) setRefreshing(true); else setLoading(true);
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

  useFocusEffect(useCallback(() => { load(); }, [load]));
  const visiblePrograms = programs.filter((item) => {
    const bucket = String(item.type || item.category || "").toLowerCase();
    const normalized = bucket.includes("program") ? "program" : "opportunity";
    return typeFilter === "all" ? true : normalized === typeFilter;
  });

  return (
    <StageCommunityScaffold
      eyebrow="High School Community"
      title="School Programs"
      subtitle="Academic programs, workshops, camps, and opportunities only. Challenges are kept in School Challenges."
      loading={loading}
      error={error}
      refreshing={refreshing}
      onRefresh={() => load(true)}
    >
      <StageStatRow items={[
        { label: "Programs", value: String(programs.length) },
        { label: "Scope", value: "Academic" }
      ]} />
      <StageSection title="Filter" icon="options">
        <View style={{ flexDirection: "row", gap: 8 }}>
          {(["all", "program", "opportunity"] as const).map((item) => (
            <TouchableOpacity
              key={item}
              onPress={() => setTypeFilter(item)}
              style={{
                borderWidth: 1,
                borderRadius: 999,
                paddingHorizontal: 12,
                paddingVertical: 7,
                borderColor: typeFilter === item ? "#16A34A" : "#D0D5DD",
                backgroundColor: typeFilter === item ? "#ECFDF3" : "#FFFFFF"
              }}
            >
              <Text style={{ fontWeight: "800", color: typeFilter === item ? "#15803D" : "#475467" }}>
                {item === "all" ? "All" : item === "program" ? "Programs" : "Opportunities"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </StageSection>
      <StageSection title="Available Programs" icon="briefcase" actionLabel="Open full" onAction={() => router.push("/community/opportunities" as never)}>
        {visiblePrograms.length ? visiblePrograms.slice(0, 8).map((item) => (
          <StageListCard
            key={item._id || item.title}
            title={item.title}
            meta={`${item.category || item.type || "Program"}${item.duration ? ` | ${item.duration}` : ""}`}
            note={item.recommendationReason || item.description || `${item.company || "ORIN"}${item.role ? ` | ${item.role}` : ""}`}
            tone="highschool"
            onPress={() => router.push("/community/opportunities" as never)}
          />
        )) : <EmptyState label="No school programs are live right now." />}
      </StageSection>
    </StageCommunityScaffold>
  );
}
