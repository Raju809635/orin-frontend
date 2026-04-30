import React from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "@/context/AuthContext";
import { useLearner } from "@/context/LearnerContext";
import { isKidStage } from "@/lib/learnerExperience";
import { useAppTheme } from "@/context/ThemeContext";
import GlobalHeader from "@/components/global-header";

type CommunityModule = {
  id: string;
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  path: string;
  iconColor: string;
  iconBg: string;
  darkIconBg: string;
  border: string;
  gradient: [string, string];
  darkGradient: [string, string];
};

export default function CommunityGrowthScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ search?: string }>();
  const { user } = useAuth();
  const { learnerStage } = useLearner();
  const { colors, isDark } = useAppTheme();
  const isMentor = user?.role === "mentor";
  const isKid = !isMentor && isKidStage(learnerStage);
  const isHighSchool = !isMentor && learnerStage === "highschool";
  const [searchQuery, setSearchQuery] = React.useState("");

  React.useEffect(() => {
    setSearchQuery(String(params.search || "").trim());
  }, [params.search]);

  const modules: CommunityModule[] = [
    {
      id: "collaboration",
      label: isKid ? "Group Activities" : isHighSchool ? "Study Groups" : "Community & Collaboration",
      description: isMentor
        ? "Collaborate with other mentors, support initiatives, and grow your mentoring network."
        : isKid
          ? "Safe class activities and guided group participation for younger learners."
          : isHighSchool
            ? "Join study groups, school initiatives, and guided collaboration."
            : "Join ORIN collaboration initiatives and partnerships.",
      icon: "people",
      path: isKid ? "/community/kid-group-activities" : isHighSchool ? "/community/highschool-study-groups" : "/community/collaboration",
      iconColor: "#7C3AED",
      iconBg: "#F3E8FF",
      darkIconBg: "rgba(124,58,237,0.18)",
      border: "#D6BBFB",
      gradient: ["#FFFFFF", "#F9F5FF"],
      darkGradient: ["#22182F", "#111827"]
    },
    {
      id: "challenges",
      label: isKid ? "Fun Challenges" : "Challenges",
      description: isMentor
        ? "Join mentoring challenges and contribute structured learning activities."
        : isKid
          ? "Take part in simpler activity-based school challenges and reward tasks."
          : "Participate in monthly challenges and competitions.",
      icon: "trophy",
      path: isKid ? "/community/kid-fun-challenges" : isHighSchool ? "/community/highschool-school-challenges" : "/community/challenges",
      iconColor: "#C98A00",
      iconBg: "#FFF4CC",
      darkIconBg: "rgba(201,138,0,0.18)",
      border: "#F9DBAF",
      gradient: ["#FFFFFF", "#FFF7ED"],
      darkGradient: ["#2A2212", "#161B22"]
    },
    {
      id: "certifications",
      label: isKid ? "Star Rewards" : "Certifications",
      description: isMentor
        ? "Track certification tracks you can recommend, review, or contribute toward."
        : isKid
          ? "View stars, badges, and simple recognition for class progress."
          : "Explore ORIN certifications and level progression.",
      icon: "ribbon",
      path: isKid ? "/community/kid-star-rewards" : isHighSchool ? "/community/highschool-achievements" : "/community/certifications",
      iconColor: "#1D4ED8",
      iconBg: "#DBEAFE",
      darkIconBg: "rgba(29,78,216,0.18)",
      border: "#A4BCFD",
      gradient: ["#FFFFFF", "#EEF4FF"],
      darkGradient: ["#18233A", "#101827"]
    },
    {
      id: "opportunities",
      label: isHighSchool ? "Programs & Opportunities" : "Internship Opportunities",
      description: isMentor
        ? "Track opportunities you can share with students and your mentoring circle."
        : isHighSchool
          ? "Discover selected school-friendly programs, camps, and future opportunities."
          : "Discover internships and career opportunities.",
      icon: "briefcase",
      path: isHighSchool ? "/community/highschool-achievements" : "/community/opportunities",
      iconColor: "#15803D",
      iconBg: "#DCFCE7",
      darkIconBg: "rgba(21,128,61,0.18)",
      border: "#ABEFC6",
      gradient: ["#FFFFFF", "#ECFDF3"],
      darkGradient: ["#16291E", "#111A18"]
    },
    {
      id: "leaderboard",
      label: isKid ? "Star Board" : "College Leaderboard",
      description: isMentor
        ? "See where your students and mentoring community are performing across colleges."
        : isKid
          ? "See stars and friendly rankings inside your school community."
          : "Check rankings and top students in your college.",
      icon: "podium",
      path: isKid ? "/community/kid-star-rewards" : isHighSchool ? "/community/highschool-achievements" : "/community/leaderboard",
      iconColor: "#B45309",
      iconBg: "#FFEDD5",
      darkIconBg: "rgba(180,83,9,0.18)",
      border: "#F9DBAF",
      gradient: ["#FFFFFF", "#FFF7ED"],
      darkGradient: ["#2A1E15", "#161B22"]
    },
    {
      id: "library",
      label: isKid ? "Class Resource Library" : "Knowledge Library",
      description: isMentor
        ? "Contribute guides, mentoring notes, and reusable learning resources."
        : isKid
          ? "Open simple class resources, activity sheets, and school learning material."
          : "Access resources, guides, and interview prep.",
      icon: "library",
      path: isKid ? "/community/kid-class-resources" : isHighSchool ? "/community/highschool-resource-library" : "/community/knowledge-library",
      iconColor: "#0369A1",
      iconBg: "#E0F2FE",
      darkIconBg: "rgba(3,105,161,0.18)",
      border: "#B2DDFF",
      gradient: ["#FFFFFF", "#EFF8FF"],
      darkGradient: ["#132634", "#101827"]
    },
    {
      id: "reputation",
      label: isKid ? "School Highlights" : "Reputation & Ranking",
      description: isMentor
        ? "Track your mentor reputation, ranking, and trust indicators inside ORIN."
        : isKid
          ? "See achievements and positive learning highlights without complex ranking."
          : "Track your score, tag, and percentile performance.",
      icon: "stats-chart",
      path: isKid ? "/community/kid-group-activities" : isHighSchool ? "/community/highschool-achievements" : "/community/reputation",
      iconColor: "#DC2626",
      iconBg: "#FEE2E2",
      darkIconBg: "rgba(220,38,38,0.18)",
      border: "#FDA29B",
      gradient: ["#FFFFFF", "#FEF3F2"],
      darkGradient: ["#2D171A", "#161B22"]
    }
  ];

  const stageModules = modules.filter((item) => {
    if (isKid && item.id === "opportunities") return false;
    return true;
  });

  const filteredModules = stageModules.filter((item) =>
    `${item.label} ${item.description}`.toLowerCase().includes(searchQuery.trim().toLowerCase())
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GlobalHeader
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        onSubmitSearch={() => null}
        searchPlaceholder="Search community tools"
      />
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.text }]}>Community & Growth</Text>
      <Text style={[styles.sub, { color: colors.textMuted }]}>
        {isMentor
          ? "Use community tools to collaborate with mentors, contribute knowledge, and track your mentor standing."
          : isKid
            ? "Open school-safe community modules built around rewards, activities, and class participation."
            : isHighSchool
              ? "Open guided community modules for study groups, challenges, and school growth."
              : "Open a module to go to its dedicated full page."}
      </Text>

      <View style={styles.moduleStack}>
        {filteredModules.map((item) => (
          <TouchableOpacity key={item.id} activeOpacity={0.92} onPress={() => router.push(item.path as never)}>
            <LinearGradient
              colors={isDark ? item.darkGradient : item.gradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.moduleCard, { borderColor: isDark ? item.iconColor : item.border, shadowColor: item.iconColor, shadowOpacity: isDark ? 0.18 : 0.08 }]}
            >
              <View style={[styles.moduleIconWrap, { backgroundColor: isDark ? item.darkIconBg : item.iconBg, borderColor: isDark ? `${item.iconColor}55` : "transparent" }]}>
                <Ionicons name={item.icon} size={20} color={item.iconColor} />
              </View>
              <View style={styles.moduleTextWrap}>
                <Text style={[styles.moduleTitle, { color: colors.text }]}>{item.label}</Text>
                <Text style={[styles.moduleDesc, { color: colors.textMuted }]}>{item.description}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </LinearGradient>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: "#F3F6FB", gap: 10 },
  title: { fontSize: 28, fontWeight: "800", color: "#11261E" },
  sub: { color: "#475467" },
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
  moduleIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: "rgba(255,255,255,0.95)",
    alignItems: "center",
    justifyContent: "center"
  },
  moduleTextWrap: { flex: 1, gap: 2 },
  moduleTitle: { color: "#1E2B24", fontWeight: "800", fontSize: 15 },
  moduleDesc: { color: "#667085", fontSize: 12, lineHeight: 16 }
});
