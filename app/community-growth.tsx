import React, { useCallback, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { api } from "@/lib/api";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

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

const sections: {
  id: CommunitySectionId;
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  border: string;
  gradient: [string, string];
  gradientActive: [string, string];
}[] = [
  {
    id: "collaboration",
    label: "Community & Collaboration",
    description: "Join ORIN collaboration initiatives and shared growth programs.",
    icon: "people",
    border: "#D6BBFB",
    gradient: ["#FFFFFF", "#F9F5FF"],
    gradientActive: ["#F4EBFF", "#F9F5FF"]
  },
  {
    id: "challenges",
    label: "Challenges",
    description: "Participate in monthly challenges and climb the rankings.",
    icon: "trophy",
    border: "#F9DBAF",
    gradient: ["#FFFFFF", "#FFF7ED"],
    gradientActive: ["#FFEDD5", "#FFF7ED"]
  },
  {
    id: "certifications",
    label: "Certifications",
    description: "Track ORIN certifications and skill credibility badges.",
    icon: "ribbon",
    border: "#A4BCFD",
    gradient: ["#FFFFFF", "#EEF4FF"],
    gradientActive: ["#E0EAFF", "#EEF4FF"]
  },
  {
    id: "opportunities",
    label: "Internship Opportunities",
    description: "Discover internships and practical career opportunities.",
    icon: "briefcase",
    border: "#ABEFC6",
    gradient: ["#FFFFFF", "#ECFDF3"],
    gradientActive: ["#DCFCE7", "#ECFDF3"]
  },
  {
    id: "leaderboard",
    label: "College Leaderboard",
    description: "See top performers and your standing across peers.",
    icon: "podium",
    border: "#F9DBAF",
    gradient: ["#FFFFFF", "#FFF7ED"],
    gradientActive: ["#FFEDD5", "#FFF7ED"]
  },
  {
    id: "library",
    label: "Knowledge Library",
    description: "Access guides, resources, interview prep, and roadmaps.",
    icon: "library",
    border: "#B2DDFF",
    gradient: ["#FFFFFF", "#EFF8FF"],
    gradientActive: ["#E0F2FE", "#EFF8FF"]
  },
  {
    id: "reputation",
    label: "Reputation & Ranking",
    description: "Monitor your score, level, and growth percentile.",
    icon: "stats-chart",
    border: "#FDA29B",
    gradient: ["#FFFFFF", "#FEF3F2"],
    gradientActive: ["#FEE4E2", "#FEF3F2"]
  }
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
      <Text style={styles.sub}>Select a module card to focus on that community area.</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.moduleStack}>
        {sections.map((item) => {
          const active = activeSection === item.id;
          return (
            <TouchableOpacity key={item.id} activeOpacity={0.92} onPress={() => setActiveSection(item.id)}>
              <LinearGradient
                colors={active ? item.gradientActive : item.gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.moduleCard, { borderColor: item.border }, active && styles.moduleCardActive]}
              >
                <View style={[styles.moduleIconWrap, active && styles.moduleIconWrapActive]}>
                  <Ionicons name={item.icon} size={20} color={active ? "#1F7A4C" : "#475467"} />
                </View>
                <View style={styles.moduleTextWrap}>
                  <Text style={styles.moduleTitle}>{item.label}</Text>
                  <Text style={styles.moduleDesc}>{item.description}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={active ? "#1F7A4C" : "#98A2B3"} />
              </LinearGradient>
            </TouchableOpacity>
          );
        })}
      </View>

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
  moduleStack: { gap: 10 },
  moduleCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    shadowColor: "#101828",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4
  },
  moduleCardActive: { shadowOpacity: 0.13, elevation: 6 },
  moduleIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.85)",
    alignItems: "center",
    justifyContent: "center"
  },
  moduleIconWrapActive: { backgroundColor: "rgba(255,255,255,1)" },
  moduleTextWrap: { flex: 1, gap: 2 },
  moduleTitle: { color: "#1E2B24", fontWeight: "800", fontSize: 15 },
  moduleDesc: { color: "#667085", fontSize: 12, lineHeight: 16 },
  loadingWrap: { alignItems: "center", justifyContent: "center", minHeight: 180 },
  panel: { gap: 8, marginTop: 4 },
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
