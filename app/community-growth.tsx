import React, { useCallback, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { api } from "@/lib/api";

type CommunitySectionId =
  | "collaboration"
  | "challenges"
  | "certifications"
  | "opportunities"
  | "leaderboard"
  | "library"
  | "reputation";

type ChallengeItem = { id: string; title: string; domain?: string; participantsCount?: number; deadline: string };
type CertificationItem = { id: string; title: string; level?: string };
type OpportunityItem = { _id: string; title: string; company?: string; role?: string; type?: string; duration?: string };
type LeaderboardResponse = { collegeName?: string; collegeTop: Array<{ rank: number; name: string; score: number }> };
type LibraryItem = { id: string; title: string; type: string; description?: string };
type ReputationSummary = { score: number; levelTag: string; topPercent: number };

const sections: { id: CommunitySectionId; label: string; tint: string; bg: string }[] = [
  { id: "collaboration", label: "Community & Collaboration", tint: "#6941C6", bg: "#F9F5FF" },
  { id: "challenges", label: "Challenges", tint: "#B54708", bg: "#FFF7ED" },
  { id: "certifications", label: "Certifications", tint: "#165DFF", bg: "#EEF4FF" },
  { id: "opportunities", label: "Internships", tint: "#027A48", bg: "#ECFDF3" },
  { id: "leaderboard", label: "Leaderboard", tint: "#B54708", bg: "#FFF7ED" },
  { id: "library", label: "Knowledge Library", tint: "#175CD3", bg: "#EFF8FF" },
  { id: "reputation", label: "Reputation & Ranking", tint: "#B42318", bg: "#FEF3F2" }
];

export default function CommunityGrowthScreen() {
  const router = useRouter();
  const [activeSection, setActiveSection] = useState<CommunitySectionId>("collaboration");
  const [challenges, setChallenges] = useState<ChallengeItem[]>([]);
  const [certifications, setCertifications] = useState<CertificationItem[]>([]);
  const [opportunities, setOpportunities] = useState<OpportunityItem[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardResponse | null>(null);
  const [knowledgeLibrary, setKnowledgeLibrary] = useState<LibraryItem[]>([]);
  const [reputation, setReputation] = useState<ReputationSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async (refresh = false) => {
    try {
      if (refresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      const [challengesRes, certificationsRes, opportunitiesRes, leaderboardRes, libraryRes, reputationRes] = await Promise.allSettled([
        api.get<ChallengeItem[]>("/api/network/challenges"),
        api.get<CertificationItem[]>("/api/network/certifications"),
        api.get<OpportunityItem[]>("/api/network/opportunities"),
        api.get<LeaderboardResponse>("/api/network/leaderboard"),
        api.get<LibraryItem[]>("/api/network/knowledge-library"),
        api.get<ReputationSummary>("/api/network/reputation-summary")
      ]);
      setChallenges(challengesRes.status === "fulfilled" ? challengesRes.value.data || [] : []);
      setCertifications(certificationsRes.status === "fulfilled" ? certificationsRes.value.data || [] : []);
      setOpportunities(opportunitiesRes.status === "fulfilled" ? opportunitiesRes.value.data || [] : []);
      setLeaderboard(leaderboardRes.status === "fulfilled" ? leaderboardRes.value.data || null : null);
      setKnowledgeLibrary(libraryRes.status === "fulfilled" ? libraryRes.value.data || [] : []);
      setReputation(reputationRes.status === "fulfilled" ? reputationRes.value.data || null : null);
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to load community modules.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} />}
    >
      <Text style={styles.title}>Community & Growth</Text>
      <Text style={styles.sub}>Tap a section and only that section appears here.</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
        {sections.map((item) => {
          const active = activeSection === item.id;
          return (
            <TouchableOpacity
              key={item.id}
              style={[styles.chip, { borderColor: item.tint }, active && { backgroundColor: item.bg }]}
              onPress={() => setActiveSection(item.id)}
            >
              <Text style={[styles.chipText, { color: item.tint }, active && styles.chipTextActive]}>{item.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color="#1F7A4C" />
        </View>
      ) : null}

      {!loading && activeSection === "collaboration" ? (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Community & Collaboration</Text>
          <View style={[styles.card, styles.cardViolet]}>
            <Text style={styles.meta}>Join ORIN collaboration initiatives and partnership programs.</Text>
            <TouchableOpacity style={styles.openBtn} onPress={() => router.push("/collaborate" as never)}>
              <Text style={styles.openBtnText}>Open Collaborate</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      {!loading && activeSection === "challenges" ? (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Community Challenges</Text>
          {challenges.length === 0 ? (
            <Text style={styles.meta}>No active challenges right now.</Text>
          ) : (
            challenges.slice(0, 8).map((item) => (
              <View key={item.id} style={[styles.card, styles.cardOrange]}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.meta}>{item.domain || "General"} | Participants: {item.participantsCount || 0}</Text>
                <Text style={styles.meta}>Deadline: {new Date(item.deadline).toLocaleDateString()}</Text>
              </View>
            ))
          )}
        </View>
      ) : null}

      {!loading && activeSection === "certifications" ? (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>ORIN Certification</Text>
          {certifications.length === 0 ? (
            <Text style={styles.meta}>No certifications available.</Text>
          ) : (
            certifications.slice(0, 8).map((item) => (
              <View key={item.id} style={[styles.card, styles.cardBlue]}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.meta}>Level: {item.level || "Beginner"}</Text>
              </View>
            ))
          )}
        </View>
      ) : null}

      {!loading && activeSection === "opportunities" ? (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Internship Opportunities</Text>
          {opportunities.length === 0 ? (
            <Text style={styles.meta}>No opportunities available right now.</Text>
          ) : (
            opportunities.slice(0, 8).map((item) => (
              <View key={item._id} style={[styles.card, styles.cardGreen]}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.meta}>{item.company || "ORIN Network"} | {item.role || item.type || "Opportunity"}</Text>
                <Text style={styles.meta}>Duration: {item.duration || "Flexible"}</Text>
              </View>
            ))
          )}
        </View>
      ) : null}

      {!loading && activeSection === "leaderboard" ? (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>College Leaderboard</Text>
          {!leaderboard || leaderboard.collegeTop.length === 0 ? (
            <Text style={styles.meta}>Leaderboard not available right now.</Text>
          ) : (
            <View style={[styles.card, styles.cardOrange]}>
              <Text style={styles.cardTitle}>{leaderboard.collegeName || "Your College"}</Text>
              {leaderboard.collegeTop.slice(0, 8).map((entry) => (
                <Text key={`${entry.rank}-${entry.name}`} style={styles.meta}>
                  {entry.rank}. {entry.name} - {entry.score}
                </Text>
              ))}
            </View>
          )}
        </View>
      ) : null}

      {!loading && activeSection === "library" ? (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Knowledge Library</Text>
          {knowledgeLibrary.length === 0 ? (
            <Text style={styles.meta}>No library items available.</Text>
          ) : (
            knowledgeLibrary.slice(0, 10).map((item) => (
              <View key={item.id} style={[styles.card, styles.cardCyan]}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.meta}>{item.type}</Text>
                <Text style={styles.meta}>{item.description || ""}</Text>
              </View>
            ))
          )}
        </View>
      ) : null}

      {!loading && activeSection === "reputation" ? (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Reputation & Ranking</Text>
          {!reputation ? (
            <Text style={styles.meta}>Reputation data unavailable.</Text>
          ) : (
            <View style={[styles.card, styles.cardRed]}>
              <Text style={styles.cardTitle}>Reputation Score: {reputation.score}</Text>
              <Text style={styles.meta}>{reputation.levelTag}</Text>
              <Text style={styles.meta}>Top {reputation.topPercent}% learners</Text>
            </View>
          )}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: "#F3F6FB", gap: 10 },
  title: { fontSize: 28, fontWeight: "800", color: "#11261E" },
  sub: { color: "#475467" },
  error: { color: "#B42318" },
  chipsRow: { gap: 8, paddingBottom: 4 },
  chip: {
    borderWidth: 1,
    borderColor: "#D0D5DD",
    borderRadius: 999,
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  chipText: { fontWeight: "700", fontSize: 12 },
  chipTextActive: { fontWeight: "800" },
  loadingWrap: { alignItems: "center", justifyContent: "center", minHeight: 180 },
  panel: { gap: 8 },
  panelTitle: { fontSize: 16, fontWeight: "800", color: "#1E2B24" },
  card: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DDE6E1",
    borderRadius: 12,
    padding: 12,
    gap: 4
  },
  cardViolet: { backgroundColor: "#F9F5FF", borderColor: "#E2D6FF" },
  cardOrange: { backgroundColor: "#FFF7ED", borderColor: "#F9DBAF" },
  cardBlue: { backgroundColor: "#EEF4FF", borderColor: "#C7D7FE" },
  cardGreen: { backgroundColor: "#ECFDF3", borderColor: "#B7E5CC" },
  cardCyan: { backgroundColor: "#EFF8FF", borderColor: "#B2DDFF" },
  cardRed: { backgroundColor: "#FEF3F2", borderColor: "#F7C1BB" },
  cardTitle: { color: "#1E2B24", fontWeight: "800" },
  meta: { color: "#667085" },
  openBtn: {
    marginTop: 8,
    alignSelf: "flex-start",
    backgroundColor: "#1F7A4C",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9
  },
  openBtnText: { color: "#fff", fontWeight: "700" }
});
