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
import HighSchoolHeader from "@/components/high-school/HighSchoolHeader";

type AiModule = {
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

export default function AiHubScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ search?: string }>();
  const { user } = useAuth();
  const { learnerStage } = useLearner();
  const { colors, isDark } = useAppTheme();
  const isMentor = user?.role === "mentor";
  const mentorOrgRole = user?.mentorOrgRole || "global_mentor";
  const isTeacherMentor = isMentor && mentorOrgRole === "institution_teacher";
  const isHeadMentor = isMentor && mentorOrgRole === "organisation_head";
  const isKid = !isMentor && isKidStage(learnerStage);
  const isHighSchool = !isMentor && learnerStage === "highschool";
  const [searchQuery, setSearchQuery] = React.useState("");

  React.useEffect(() => {
    setSearchQuery(String(params.search || "").trim());
  }, [params.search]);

  const modules: AiModule[] = [
    {
      id: "mentor_matching",
      label: isTeacherMentor ? "AI Lesson Planner" : isHeadMentor ? "School Strategy AI" : isKid ? "Learning Games" : isHighSchool ? "Career Explorer" : "AI Mentor Matching",
      description: isTeacherMentor
        ? "Plan class lessons, warmups, examples, and quick checks for tomorrow's students."
        : isHeadMentor
          ? "Draft school engagement plans, launch checklists, and teacher enablement ideas."
          : isMentor
            ? "Identify students whose goals and interests align with your mentoring domains."
            : isKid
          ? "Play guided learning activities and simple practice sessions."
          : isHighSchool
            ? "Explore future streams and mentor-guided direction with simpler suggestions."
            : "Find best-fit mentors with match score and experience insights.",
      icon: isTeacherMentor ? "reader" : isHeadMentor ? "business" : isKid ? "game-controller" : "sparkles",
      emoji: isKid ? "🎮" : isHighSchool ? "🧭" : undefined,
      path: isTeacherMentor || isHeadMentor ? "/ai/assistant" : isKid ? "/ai/kids-learning-games" : isHighSchool ? "/ai/career-explorer" : "/ai/mentor-matching",
      iconColor: "#D4A017",
      iconBg: "#FFF7D6",
      darkIconBg: "rgba(212,160,23,0.16)",
      border: "#A4BCFD",
      gradient: ["#FFFFFF", "#EEF4FF"],
      darkGradient: ["#1C2333", "#101827"]
    },
    {
      id: "skill_gap",
      label: isTeacherMentor ? "Class Quiz Builder" : isHeadMentor ? "School Reports AI" : isKid ? "Reading & Numbers" : isHighSchool ? "Subject Gap Analyzer" : "AI Skill Gap Analysis",
      description: isTeacherMentor
        ? "Create quiz questions, practice rounds, and revision checks for class engagement."
        : isHeadMentor
          ? "Summarize participation, winners, weak classes, and next actions for management."
          : isMentor
            ? "Review likely student skill gaps before sessions and plan better guidance."
            : isKid
          ? "Practice reading, numbers, and basic concept support in a simpler guided format."
          : isHighSchool
            ? "See missing subject areas and simple study suggestions for your next goal."
            : "Identify missing skills and course suggestions for your goal.",
      icon: isTeacherMentor ? "help-circle" : isHeadMentor ? "bar-chart" : isKid ? "school" : "analytics",
      emoji: isKid ? "🔢" : isHighSchool ? "🧠" : undefined,
      path: isTeacherMentor || isHeadMentor ? "/ai/assistant" : isKid ? "/ai/reading-and-numbers" : isHighSchool ? "/ai/highschool-subject-gap" : "/ai/skill-gap",
      iconColor: "#6D28D9",
      iconBg: "#F3E8FF",
      darkIconBg: "rgba(109,40,217,0.18)",
      border: "#C4B5FD",
      gradient: ["#FFFFFF", "#F4F3FF"],
      darkGradient: ["#20192F", "#111827"]
    },
    {
      id: "roadmap",
      label: isTeacherMentor ? "Activity Roadmap" : isHeadMentor ? "Implementation Roadmap" : isKid ? "Learning Activities" : isHighSchool ? "Study Roadmap" : "AI Career Roadmap",
      description: isTeacherMentor
        ? "Turn a class goal into weekly activities, proof tasks, reviews, and rewards."
        : isHeadMentor
          ? "Plan school launch phases, teacher routines, competitions, and recognition cycles."
          : isMentor
            ? "Generate structured mentoring plans and milestone-based guidance for mentees."
            : isKid
          ? "Open simpler weekly activities and mentor-guided progress instead of a career roadmap."
          : isHighSchool
            ? "Get a subject-first plan with guided milestones for school progress."
            : "Get your step-by-step path and next milestones.",
      icon: "map",
      emoji: isKid ? "🗺️" : isHighSchool ? "🎯" : undefined,
      path: isTeacherMentor || isHeadMentor ? "/ai/assistant" : isKid ? "/ai/kids-learning-activities" : isHighSchool ? "/ai/highschool-study-roadmap" : "/ai/career-roadmap",
      iconColor: "#0F766E",
      iconBg: "#DDF7F2",
      darkIconBg: "rgba(15,118,110,0.18)",
      border: "#ABEFC6",
      gradient: ["#FFFFFF", "#ECFDF3"],
      darkGradient: ["#14292A", "#0F1E24"]
    },
    {
      id: "project_ideas",
      label: isTeacherMentor ? "Class Activity Ideas" : isHeadMentor ? "Competition Ideas" : isKid ? "Creative Corner" : isHighSchool ? "Exam Strategy Builder" : "AI Project Ideas",
      description: isTeacherMentor
        ? "Generate homework, classroom tasks, challenge ideas, and proof-based activities."
        : isHeadMentor
          ? "Plan inter-class competitions, weekly winners, school events, and award themes."
          : isMentor
            ? "Generate assignments, practice tasks, and project suggestions for students."
            : isKid
          ? "Get drawing, story, and simple make-and-build ideas for class activities."
          : isHighSchool
            ? "Create a marks-focused exam strategy with subject priorities, weightage, and weekly planning."
            : "Generate practical project ideas aligned to your career track.",
      icon: isTeacherMentor ? "clipboard" : isHeadMentor ? "trophy" : isKid ? "color-wand" : isHighSchool ? "locate" : "bulb",
      emoji: isKid ? "🎨" : isHighSchool ? "💡" : undefined,
      path: isKid ? "/ai/creative-corner" : isHighSchool ? "/ai/exam-strategy-builder" : "/ai/project-ideas",
      iconColor: "#D97706",
      iconBg: "#FFF1DA",
      darkIconBg: "rgba(217,119,6,0.18)",
      border: "#F9DBAF",
      gradient: ["#FFFFFF", "#FFF7ED"],
      darkGradient: ["#2B1F14", "#161B22"]
    },
    {
      id: "resume_builder",
      label: isTeacherMentor ? "Feedback Writer" : isHeadMentor ? "Announcement Writer" : isKid ? "Story & Drawing" : isHighSchool ? "Study Planner" : "AI Resume Builder",
      description: isTeacherMentor
        ? "Draft encouraging feedback, improvement notes, parent messages, and winner appreciation."
        : isHeadMentor
          ? "Write school announcements, launch messages, winner notes, and teacher reminders."
          : isMentor
            ? "Review student resumes and prepare sharper improvement suggestions."
            : isKid
          ? "Use ORIN for storytelling, creativity prompts, and simple self-expression tasks."
          : isHighSchool
            ? "Turn goals and school tasks into a simpler study plan."
            : "Create resume draft from profile and activity data.",
      icon: isTeacherMentor ? "chatbox-ellipses" : isHeadMentor ? "megaphone" : isKid ? "brush" : isHighSchool ? "calendar" : "document-text",
      emoji: isKid ? "✏️" : isHighSchool ? "📅" : undefined,
      path: isTeacherMentor || isHeadMentor ? "/ai/assistant" : isKid ? "/ai/story-and-drawing" : isHighSchool ? "/ai/study-planner" : "/ai/resume-builder",
      iconColor: "#DC2626",
      iconBg: "#FEE2E2",
      darkIconBg: "rgba(220,38,38,0.18)",
      border: "#FDA29B",
      gradient: ["#FFFFFF", "#FEF3F2"],
      darkGradient: ["#2D171A", "#161B22"]
    },
    {
      id: "assistant",
      label: isTeacherMentor ? "Teacher Assistant" : isHeadMentor ? "Management Assistant" : isKid ? "Ask ORIN" : isHighSchool ? "Study Assistant" : "AI Assistant",
      description: isTeacherMentor
        ? "Ask ORIN for class motivation, weak-student support, quiz ideas, and daily routines."
        : isHeadMentor
          ? "Ask ORIN for school operations, adoption plans, analytics interpretation, and reports."
          : isMentor
            ? "Open your mentoring assistant for session preparation and student guidance support."
            : isKid
          ? "Open a simpler AI helper for class doubts, learning help, and guided support."
          : isHighSchool
            ? "Open a simpler study helper for doubts, revision, and school guidance."
            : "Open AI chat for personalized answers and guidance.",
      icon: "chatbubbles",
      emoji: isKid ? "💬" : isHighSchool ? "📘" : undefined,
      path: isKid ? "/ai/kids-ask-orin" : isHighSchool ? "/ai/highschool-study-assistant" : "/ai/assistant",
      iconColor: "#7C3AED",
      iconBg: "#F3E8FF",
      darkIconBg: "rgba(124,58,237,0.18)",
      border: "#D6BBFB",
      gradient: ["#FFFFFF", "#F9F5FF"],
      darkGradient: ["#22182F", "#111827"]
    }
  ];

  const filteredModules = modules.filter((item) =>
    `${item.label} ${item.description}`.toLowerCase().includes(searchQuery.trim().toLowerCase())
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GlobalHeader
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        onSubmitSearch={() => null}
        searchPlaceholder="Search AI tools"
      />
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={[styles.container, { backgroundColor: colors.background }]}>
      {isHighSchool ? (
        <HighSchoolHeader
          eyebrow="High School AI"
          title="Plan, practice, improve"
          subtitle="Use AI for career direction, subject gaps, weekly roadmaps, projects, and doubt clearing without the heavy after-12 workflow."
          chips={["Study first", "Subject support", "Progress ready"]}
        />
      ) : (
        <>
          <Text style={[styles.title, { color: colors.text }]}>AI</Text>
          <Text style={[styles.sub, { color: colors.textMuted }]}>
            {isMentor
              ? isTeacherMentor
                ? "Use teacher AI tools for lesson planning, quiz creation, feedback, activities, and class motivation."
                : isHeadMentor
                  ? "Use school-management AI tools for reports, teacher enablement, competitions, and announcements."
                  : "Open a mentor-focused AI tool to prepare sessions, guide students, and improve mentoring delivery."
              : isKid
                ? "Open simple AI learning tools chosen for younger students."
                : "Open a module to go to its dedicated full page."}
          </Text>
        </>
      )}

      <View style={styles.moduleStack}>
        {filteredModules.map((item) => {
          const stageStyled = isKid || isHighSchool || isTeacherMentor || isHeadMentor;
          const playful = isKid || isTeacherMentor || isHeadMentor;
          return (
          <TouchableOpacity key={item.id} activeOpacity={0.92} onPress={() => router.push(item.path as never)}>
            <LinearGradient
              colors={isDark ? item.darkGradient : item.gradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[
                styles.moduleCard,
                stageStyled && styles.stageModuleCard,
                isHighSchool && styles.highSchoolModuleCard,
                { borderColor: isDark ? item.iconColor : item.border, shadowColor: item.iconColor, shadowOpacity: isDark ? 0.18 : 0.08 }
              ]}
            >
              {playful && item.emoji ? <Text style={styles.stageEmoji}>{item.emoji}</Text> : null}
              <View style={[styles.moduleIconWrap, playful && styles.stageIconWrap, { backgroundColor: isDark ? item.darkIconBg : item.iconBg, borderColor: isDark ? `${item.iconColor}55` : "transparent" }]}>
                <Ionicons name={item.icon} size={20} color={item.iconColor} />
              </View>
              <View style={styles.moduleTextWrap}>
                <Text style={[styles.moduleTitle, isHighSchool && styles.highSchoolModuleTitle, { color: colors.text }]}>{item.label}</Text>
                <Text style={[styles.moduleDesc, isHighSchool && styles.highSchoolModuleDesc, { color: colors.textMuted }]}>{item.description}</Text>
                {stageStyled ? (
                  <Text style={[styles.stageActionText, { color: item.iconColor }]}>
                    {isKid ? "Tap to play and learn" : isTeacherMentor ? "Open teacher tool" : isHeadMentor ? "Open school tool" : "Open guided study tool"}
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
  stageActionText: { marginTop: 6, fontSize: 12, fontWeight: "900" },
  highSchoolModuleCard: {
    minHeight: 118,
    borderRadius: 22,
    padding: 17
  },
  highSchoolModuleTitle: {
    fontSize: 17,
    lineHeight: 22
  },
  highSchoolModuleDesc: {
    fontSize: 13,
    lineHeight: 19
  }
});
