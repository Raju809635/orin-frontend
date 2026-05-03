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
  emoji?: string;
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
  const params = useLocalSearchParams<{ search?: string; scope?: string }>();
  const { user } = useAuth();
  const { learnerStage } = useLearner();
  const { colors, isDark } = useAppTheme();
  const isMentor = user?.role === "mentor";
  const mentorOrgRole = user?.mentorOrgRole || "global_mentor";
  const isRoleGlobalView = isMentor && String(params.scope || "") === "global" && mentorOrgRole !== "global_mentor";
  const isTeacherMentor = isMentor && mentorOrgRole === "institution_teacher" && !isRoleGlobalView;
  const isHeadMentor = isMentor && mentorOrgRole === "organisation_head" && !isRoleGlobalView;
  const isKid = !isMentor && isKidStage(learnerStage);
  const isHighSchool = !isMentor && learnerStage === "highschool";
  const [searchQuery, setSearchQuery] = React.useState("");

  React.useEffect(() => {
    setSearchQuery(String(params.search || "").trim());
  }, [params.search]);

  const modules: CommunityModule[] = [
    {
      id: "collaboration",
      label: isTeacherMentor ? "Class Groups" : isHeadMentor ? "School Community" : isKid ? "Group Activities" : isHighSchool ? "Study Groups" : "Community & Collaboration",
      description: isTeacherMentor
        ? "Coordinate class groups, student discussions, activity posts, and teacher-guided participation."
        : isHeadMentor
          ? "Build school-wide community through teachers, class posts, announcements, and shared wins."
          : isMentor
            ? "Collaborate with other mentors, support initiatives, and grow your mentoring network."
            : isKid
          ? "Safe class activities and guided group participation for younger learners."
          : isHighSchool
            ? "Join study groups, school initiatives, and guided collaboration."
            : "Join ORIN collaboration initiatives and partnerships.",
      icon: "people",
      emoji: isKid ? "👫" : isHighSchool ? "👥" : undefined,
      path: isTeacherMentor || isHeadMentor ? "/network?section=institution" : isKid ? "/community/kid-group-activities" : isHighSchool ? "/community/highschool-study-groups" : "/community/collaboration",
      iconColor: "#7C3AED",
      iconBg: "#F3E8FF",
      darkIconBg: "rgba(124,58,237,0.18)",
      border: "#D6BBFB",
      gradient: ["#FFFFFF", "#F9F5FF"],
      darkGradient: ["#22182F", "#111827"]
    },
    {
      id: "challenges",
      label: isTeacherMentor ? "Class Challenges" : isHeadMentor ? "Inter-Class Competitions" : isKid ? "Learning Games" : isHighSchool ? "Quiz Battle & Study Games" : "Challenges",
      description: isTeacherMentor
        ? "Run daily quiz challenges, streak missions, topper awards, and classroom competitions."
        : isHeadMentor
          ? "Promote inter-class competitions, weekly winners, school champion events, and fair play."
          : isMentor
            ? "Join mentoring challenges and contribute structured learning activities."
            : isKid
          ? "Play quiz battles, speed math, word games, streak missions, and reward tasks."
          : isHighSchool
            ? "Practice quiz battles, speed math, subject games, and school tournaments."
            : "Participate in monthly challenges and competitions.",
      icon: isKid || isHighSchool ? "game-controller" : "trophy",
      emoji: isKid ? "🎮" : isHighSchool ? "⚔️" : undefined,
      path: isTeacherMentor || isHeadMentor || isKid || isHighSchool ? "/community/learning-games" : "/community/challenges",
      iconColor: "#C98A00",
      iconBg: "#FFF4CC",
      darkIconBg: "rgba(201,138,0,0.18)",
      border: "#F9DBAF",
      gradient: ["#FFFFFF", "#FFF7ED"],
      darkGradient: ["#2A2212", "#161B22"]
    },
    {
      id: "certifications",
      label: isTeacherMentor ? "Student Rewards" : isHeadMentor ? "School Certificates" : isKid ? "Star Rewards" : isHighSchool ? "Achievements" : "Certifications",
      description: isTeacherMentor
        ? "Recognize top performers, most improved students, streak holders, and helpful classmates."
        : isHeadMentor
          ? "Track certificates, class awards, teacher recognition, and school-wide achievements."
          : isMentor
            ? "Track certification tracks you can recommend, review, or contribute toward."
            : isKid
          ? "View stars, badges, and simple recognition for class progress."
          : "Explore ORIN certifications and level progression.",
      icon: "ribbon",
      emoji: isKid ? "⭐" : isHighSchool ? "🎓" : undefined,
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
      label: isTeacherMentor ? "Quiz Battle" : isHeadMentor ? "Programs & Events" : isHighSchool ? "Programs & Opportunities" : "Internship Opportunities",
      description: isTeacherMentor
        ? "Open game-style practice for quiz battles, speed math, streaks, and subject mini games."
        : isHeadMentor
          ? "Plan school events, ORIN champions programs, competitions, and special awards."
          : isMentor
            ? "Track opportunities you can share with students and your mentoring circle."
            : isHighSchool
          ? "Discover selected school-friendly programs, camps, and future opportunities."
          : "Discover internships and career opportunities.",
      icon: isTeacherMentor ? "game-controller" : isHeadMentor ? "calendar" : "briefcase",
      emoji: isHighSchool ? "🚀" : undefined,
      path: isTeacherMentor ? "/community/learning-games" : isHeadMentor ? "/community/challenges" : isHighSchool ? "/community/highschool-programs" : "/community/opportunities",
      iconColor: "#15803D",
      iconBg: "#DCFCE7",
      darkIconBg: "rgba(21,128,61,0.18)",
      border: "#ABEFC6",
      gradient: ["#FFFFFF", "#ECFDF3"],
      darkGradient: ["#16291E", "#111A18"]
    },
    {
      id: "leaderboard",
      label: isTeacherMentor ? "Class Leaderboard" : isHeadMentor ? "School Leaderboard" : isKid ? "Star Board" : isHighSchool ? "School Leaderboard" : "College Leaderboard",
      description: isTeacherMentor
        ? "Track class toppers, streaks, quiz participation, XP, and students who need support."
        : isHeadMentor
          ? "Compare classes, teachers, active students, participation rate, and school ranking."
          : isMentor
            ? "See where your students and mentoring community are performing across colleges."
            : isKid
          ? "See stars and friendly rankings inside your school community."
          : isHighSchool
            ? "Check rankings and top students in your school."
            : "Check rankings and top students in your college.",
      icon: "podium",
      emoji: isKid ? "🥇" : isHighSchool ? "📊" : undefined,
      path: isKid ? "/community/kid-star-rewards" : isHighSchool ? "/community/highschool-leaderboard" : "/community/leaderboard",
      iconColor: "#B45309",
      iconBg: "#FFEDD5",
      darkIconBg: "rgba(180,83,9,0.18)",
      border: "#F9DBAF",
      gradient: ["#FFFFFF", "#FFF7ED"],
      darkGradient: ["#2A1E15", "#161B22"]
    },
    {
      id: "library",
      label: isTeacherMentor ? "Class Resources" : isHeadMentor ? "School Resource Library" : isKid ? "Class Resource Library" : isHighSchool ? "Resource Library" : "Knowledge Library",
      description: isTeacherMentor
        ? "Upload and reuse class resources, activity sheets, quiz notes, and teacher materials."
        : isHeadMentor
          ? "Organize school resources, institution roadmaps, teacher content, and shared libraries."
          : isMentor
            ? "Contribute guides, mentoring notes, and reusable learning resources."
            : isKid
          ? "Open simple class resources, activity sheets, and school learning material."
          : "Access resources, guides, and interview prep.",
      icon: "library",
      emoji: isKid ? "📚" : isHighSchool ? "📖" : undefined,
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
      label: isTeacherMentor ? "Class Progress" : isHeadMentor ? "Reports & Recognition" : isKid ? "School Highlights" : isHighSchool ? "School Progress" : "Reputation & Ranking",
      description: isTeacherMentor
        ? "See class momentum through participation, rewards, feedback, and improvement signals."
        : isHeadMentor
          ? "Review school progress, recognition culture, reports, and engagement health."
          : isMentor
            ? "Track your mentor reputation, ranking, and trust indicators inside ORIN."
            : isKid
          ? "See achievements and positive learning highlights without complex ranking."
          : isHighSchool
            ? "Track school progress, institution standing, and achievement momentum."
            : "Track your score, tag, and percentile performance.",
      icon: "stats-chart",
      emoji: isKid ? "✨" : isHighSchool ? "📈" : undefined,
      path: isTeacherMentor || isHeadMentor ? "/community/leaderboard" : isKid ? "/community/kid-group-activities" : isHighSchool ? "/community/highschool-progress" : "/community/reputation",
      iconColor: "#DC2626",
      iconBg: "#FEE2E2",
      darkIconBg: "rgba(220,38,38,0.18)",
      border: "#FDA29B",
      gradient: ["#FFFFFF", "#FEF3F2"],
      darkGradient: ["#2D171A", "#161B22"]
    }
  ];

  const globalModules: CommunityModule[] = isRoleGlobalView
    ? [
        {
          id: "global_posts",
          label: mentorOrgRole === "organisation_head" ? "Global Schools Posts" : "Global Posts",
          description: "Open ORIN-wide posts, public updates, global announcements, and cross-institution activity.",
          icon: "newspaper",
          path: "/network?section=feed",
          iconColor: "#0F766E",
          iconBg: "#DDF7F2",
          darkIconBg: "rgba(15,118,110,0.18)",
          border: "#ABEFC6",
          gradient: ["#FFFFFF", "#ECFDF3"],
          darkGradient: ["#14292A", "#0F1E24"]
        },
        {
          id: "global_roadmaps",
          label: "Global Roadmaps",
          description: "Open ORIN-wide AI roadmaps and global learning paths outside your institution/class workspace.",
          icon: "map",
          path: "/ai/career-roadmap",
          iconColor: "#6D28D9",
          iconBg: "#F3E8FF",
          darkIconBg: "rgba(109,40,217,0.18)",
          border: "#C4B5FD",
          gradient: ["#FFFFFF", "#F4F3FF"],
          darkGradient: ["#20192F", "#111827"]
        }
      ]
    : [];

  const stageModules = [...globalModules, ...modules].filter((item) => {
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
      <Text style={[styles.title, { color: colors.text }]}>{isRoleGlobalView ? "Global" : "Community & Growth"}</Text>
      <Text style={[styles.sub, { color: colors.textMuted }]}>
        {isRoleGlobalView
          ? "Open ORIN-wide posts, challenges, competitions, resources, certificates, leaderboards, and mentor/community tools. Institution and class work stays out of this tab."
          : isMentor
            ? isTeacherMentor
            ? "Open class-focused tools for groups, challenges, rewards, resources, quiz battles, and progress."
            : isHeadMentor
              ? "Open school-wide tools for community, competitions, certificates, events, reports, and leaderboards."
              : "Use community tools to collaborate with mentors, contribute knowledge, and track your mentor standing."
          : isKid
            ? "Open school-safe community modules built around rewards, activities, and class participation."
            : isHighSchool
              ? "Open guided community modules for study groups, challenges, and school growth."
              : "Open a module to go to its dedicated full page."}
      </Text>

      <View style={styles.moduleStack}>
        {filteredModules.map((item) => {
          const playful = isKid || isHighSchool || isTeacherMentor || isHeadMentor;
          return (
          <TouchableOpacity key={item.id} activeOpacity={0.92} onPress={() => router.push(item.path as never)}>
            <LinearGradient
              colors={isDark ? item.darkGradient : item.gradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[
                styles.moduleCard,
                playful && styles.stageModuleCard,
                { borderColor: isDark ? item.iconColor : item.border, shadowColor: item.iconColor, shadowOpacity: isDark ? 0.18 : 0.08 }
              ]}
            >
              {playful && item.emoji ? <Text style={styles.stageEmoji}>{item.emoji}</Text> : null}
              <View style={[styles.moduleIconWrap, playful && styles.stageIconWrap, { backgroundColor: isDark ? item.darkIconBg : item.iconBg, borderColor: isDark ? `${item.iconColor}55` : "transparent" }]}>
                <Ionicons name={item.icon} size={20} color={item.iconColor} />
              </View>
              <View style={styles.moduleTextWrap}>
                <Text style={[styles.moduleTitle, { color: colors.text }]}>{item.label}</Text>
                <Text style={[styles.moduleDesc, { color: colors.textMuted }]}>{item.description}</Text>
                {playful ? (
                  <Text style={[styles.stageActionText, { color: item.iconColor }]}>
                    {isKid ? "Open fun school space" : isTeacherMentor ? "Open class tool" : isHeadMentor ? "Open school tool" : "Open school growth space"}
                  </Text>
                ) : null}
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </LinearGradient>
          </TouchableOpacity>
          );
        })}
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
  stageModuleCard: {
    minHeight: 112,
    borderRadius: 24,
    padding: 16,
    gap: 12
  },
  stageEmoji: {
    position: "absolute",
    right: 46,
    top: 12,
    fontSize: 32,
    opacity: 0.9
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
  stageIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 18
  },
  moduleTextWrap: { flex: 1, gap: 2 },
  moduleTitle: { color: "#1E2B24", fontWeight: "900", fontSize: 16 },
  moduleDesc: { color: "#667085", fontSize: 12, lineHeight: 16 },
  stageActionText: { marginTop: 6, fontSize: 12, fontWeight: "900" }
});
