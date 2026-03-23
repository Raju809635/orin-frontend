import React, { useMemo, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import GlobalHeader from "@/components/global-header";
import { useAuth } from "@/context/AuthContext";
import { useAppTheme } from "@/context/ThemeContext";

type Role = "student" | "mentor";

type GuideSection = {
  id: string;
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  summary: string;
  whyItMatters: string;
  howToUse: string[];
  proTips: string[];
};

const STUDENT_QUICK_START = [
  "Open Home to read posts, updates, and useful community activity.",
  "Open Journey to see your XP, roadmap progress, daily quiz, and growth path.",
  "Use AI to analyze your skill gap, build a roadmap, and get project ideas.",
  "Go to Mentorship to find mentors, book sessions, and manage learning support.",
  "Use Community to join challenges, explore internships, and earn certificates."
];

const MENTOR_QUICK_START = [
  "Open Home to stay active in the feed and grow your professional presence.",
  "Open Journey to manage mentor activity, growth, stats, and upcoming work.",
  "Use AI to prepare sessions, evaluate learner gaps, and generate guidance plans.",
  "Go to Mentorship to manage requests, sessions, pricing, and availability.",
  "Use Community to host challenges, contribute knowledge, and build reputation."
];

function getGuideSections(role: Role): GuideSection[] {
  const common: GuideSection[] = [
    {
      id: "home",
      title: "Home Feed",
      icon: "home-outline",
      summary: "Your social and professional activity space inside ORIN.",
      whyItMatters:
        "This is where you discover updates from your circle, share progress, and stay connected to the ORIN ecosystem.",
      howToUse: [
        "Scroll the feed to see posts from your network and ORIN activity.",
        "Tap Like, Comment, or Share to engage with the post.",
        "Tap a user profile image or name to open their full profile.",
        "Use Start a post to share achievements, projects, or progress updates."
      ],
      proTips: [
        "Use Home daily to stay visible and build your circle.",
        "Posting milestones improves your profile presence and overall reputation."
      ]
    },
    {
      id: "messages",
      title: "Messages",
      icon: "chatbubble-ellipses-outline",
      summary: "A single conversation space for mentor chats and accepted circle chats.",
      whyItMatters:
        "Messages help you continue discussions after connections, mentorship bookings, or useful community interactions.",
      howToUse: [
        "Open the Messages icon in the header.",
        "Use the Mentors tab for mentor conversations and the Circle tab for accepted connections.",
        "Tap a conversation to continue, send updates, or ask follow-up questions.",
        "Use New Chat after connecting with someone or confirming mentorship activity."
      ],
      proTips: [
        "Accepted circle connections can chat with each other.",
        "Keep mentor conversations focused on goals, sessions, and progress."
      ]
    },
    {
      id: "profile",
      title: "Profile",
      icon: "person-circle-outline",
      summary: "Your identity, credibility, and progress snapshot inside ORIN.",
      whyItMatters:
        "A strong profile helps others understand your background, goals, and activity quickly.",
      howToUse: [
        "Open My Profile from the drawer or profile button.",
        "Use Edit Profile to update bio, skills, education, state, achievements, projects, and experience.",
        "Upload your profile image and resume so your profile feels complete.",
        "Keep your profile aligned with your current goals and work."
      ],
      proTips: [
        "Structured achievements and projects make your profile look professional.",
        "A complete profile supports better mentorship, stronger networking, and higher trust."
      ]
    },
    {
      id: "notifications",
      title: "Notifications",
      icon: "notifications-outline",
      summary: "Your important alerts for activity, progress, and opportunity updates.",
      whyItMatters:
        "Notifications keep you informed when something needs your attention, such as messages, certificates, challenges, or internships.",
      howToUse: [
        "Open Notifications from the drawer or relevant app entry.",
        "Check challenge updates, certificate announcements, and message alerts.",
        "Use notifications as a daily check-in point for momentum."
      ],
      proTips: [
        "Responding quickly to useful notifications helps you stay active and visible.",
        "Notifications are one of the fastest ways to catch new opportunities."
      ]
    }
  ];

  if (role === "mentor") {
    return [
      {
        id: "journey",
        title: "Journey Dashboard",
        icon: "map-outline",
        summary: "Your mentor control center for progress, stats, and action priorities.",
        whyItMatters:
          "Journey gives mentors a clean overview of current responsibilities, live activity, and growth signals.",
        howToUse: [
          "Open Journey from the bottom navigation.",
          "Review availability, requests, live sessions, XP, and growth signals.",
          "Use it as your daily command center before moving into deeper modules."
        ],
        proTips: [
          "Treat Journey as your start-of-day screen.",
          "Check it before sessions so nothing important gets missed."
        ]
      },
      {
        id: "mentorship",
        title: "Mentorship",
        icon: "school-outline",
        summary: "Manage student requests, sessions, pricing, and availability.",
        whyItMatters:
          "This is the operational heart of mentor work inside ORIN.",
        howToUse: [
          "Open Mentorship from the bottom tab.",
          "Review booking requests and confirm or decline them.",
          "Manage availability and pricing so students see the right options.",
          "Track confirmed sessions, notes, and ongoing mentorship work."
        ],
        proTips: [
          "Update availability regularly so bookings remain accurate.",
          "Keep notes after sessions to provide stronger guidance in follow-ups."
        ]
      },
      {
        id: "ai",
        title: "AI Workspace",
        icon: "sparkles-outline",
        summary: "Use AI as a mentoring copilot for guidance, planning, and content support.",
        whyItMatters:
          "AI saves time and helps you prepare better responses, plans, and resources for students.",
        howToUse: [
          "Use AI Assistant for general Q&A and personalized mentoring guidance.",
          "Use Skill Gap to understand what a learner is missing.",
          "Use Roadmap and Projects to build practical learning plans.",
          "Use Resume Builder to help review and improve learner positioning."
        ],
        proTips: [
          "Personalized AI mode works best when the student journey is already updated.",
          "Use AI outputs as guided starting points, then refine them with your mentoring judgment."
        ]
      },
      {
        id: "community",
        title: "Community & Growth",
        icon: "people-outline",
        summary: "Build influence, contribute knowledge, host challenges, and earn reputation.",
        whyItMatters:
          "Community is where mentors grow from individual guides into visible experts inside ORIN.",
        howToUse: [
          "Open Community to explore challenges, certificates, internships, the leaderboard, and knowledge resources.",
          "Use Challenges to host or participate in guided growth activities.",
          "Use Knowledge Library to contribute or reuse learning resources.",
          "Watch your reputation and leaderboard position to track impact."
        ],
        proTips: [
          "Contributing useful resources strengthens your mentor identity.",
          "Challenges and certificates create visible proof of value."
        ]
      },
      ...common
    ];
  }

  return [
    {
      id: "journey",
      title: "Journey Dashboard",
      icon: "map-outline",
      summary: "Your personal growth center inside ORIN.",
      whyItMatters:
        "Journey keeps your progress visible so ORIN feels like a guided path instead of random screens.",
      howToUse: [
        "Open Journey from the bottom navigation.",
        "Track XP, level, streaks, and personal growth progress.",
        "Use it to see today’s next step and where you stand in your journey."
      ],
      proTips: [
        "Checking Journey daily builds consistency.",
        "The progress view is most useful when combined with AI Roadmap and Challenges."
      ]
    },
    {
      id: "mentorship",
      title: "Mentorship",
      icon: "school-outline",
      summary: "Find mentors, explore domains, and manage mentorship sessions.",
      whyItMatters:
        "Mentorship gives you real human guidance instead of making you learn everything alone.",
      howToUse: [
        "Open Mentorship from the bottom tab.",
        "Browse domains and mentor profiles.",
        "Book a session when you need targeted guidance.",
        "Use session management to track pending, confirmed, and completed activity."
      ],
      proTips: [
        "Choose mentors based on your current goal and skill stage.",
        "Use messaging before and after sessions to stay clear on next steps."
      ]
    },
    {
      id: "ai",
      title: "AI Workspace",
      icon: "sparkles-outline",
      summary: "Your personalized intelligence layer for growth, planning, and action.",
      whyItMatters:
        "AI is where ORIN becomes adaptive. It helps turn your goal into a step-by-step path.",
      howToUse: [
        "Use AI Assistant for direct questions or personalized guidance.",
        "Use Skill Gap to see what you know and what you still need.",
        "Use Roadmap to convert goals into missions.",
        "Use Project Ideas to build practical proof of your learning.",
        "Use Resume Builder to create stronger career-ready output."
      ],
      proTips: [
        "Start with your goal in AI Assistant so the rest of the AI tools become more personalized.",
        "Use Roadmap and Project Ideas together for a stronger learning loop."
      ]
    },
    {
      id: "community",
      title: "Community & Growth",
      icon: "people-outline",
      summary: "Your activity zone for challenges, internships, certificates, learning resources, and rankings.",
      whyItMatters:
        "Community turns learning into visible progress, competition, and real opportunities.",
      howToUse: [
        "Open Community to browse Challenges, Certificates, Internships, Knowledge Library, and Leaderboard.",
        "Join challenges that match your current project or roadmap stage.",
        "Use the library to study only the resources relevant to your next step.",
        "Apply for internships when your readiness improves."
      ],
      proTips: [
        "Challenges and certificates help convert effort into visible credibility.",
        "The leaderboard becomes more useful when you stay active consistently."
      ]
    },
    ...common
  ];
}

export default function AppGuideScreen() {
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const role: Role = user?.role === "mentor" ? "mentor" : "student";
  const [search, setSearch] = useState("");

  const sections = useMemo(() => getGuideSections(role), [role]);
  const quickStart = role === "mentor" ? MENTOR_QUICK_START : STUDENT_QUICK_START;

  const filteredSections = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return sections;
    return sections.filter((section) =>
      `${section.title} ${section.summary} ${section.whyItMatters} ${section.howToUse.join(" ")} ${section.proTips.join(" ")}`
        .toLowerCase()
        .includes(needle)
    );
  }, [search, sections]);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <GlobalHeader
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search features, screens, or help..."
      />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.hero, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.heroBadge}>
            <Ionicons name="compass-outline" size={18} color={colors.accent} />
            <Text style={[styles.heroBadgeText, { color: colors.accent }]}>ORIN App Guide</Text>
          </View>
          <Text style={[styles.heroTitle, { color: colors.text }]}>
            {role === "mentor" ? "Mentor Guide" : "Student Guide"}
          </Text>
          <Text style={[styles.heroText, { color: colors.textMuted }]}>
            This guide walks you through every major part of ORIN in a simple, practical, step-by-step way so you always know what to do next.
          </Text>
          <View style={styles.heroPills}>
            <View style={[styles.heroPill, { backgroundColor: colors.accentSoft }]}>
              <Text style={[styles.heroPillText, { color: colors.accent }]}>{role === "mentor" ? "Lead smarter" : "Grow smarter"}</Text>
            </View>
            <View style={[styles.heroPill, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
              <Text style={[styles.heroPillText, { color: colors.text }]}>Step-by-step help</Text>
            </View>
            <View style={[styles.heroPill, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
              <Text style={[styles.heroPillText, { color: colors.text }]}>Action-focused</Text>
            </View>
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Quick Start</Text>
          <Text style={[styles.cardSub, { color: colors.textMuted }]}>
            Use this sequence when you open ORIN and want to know exactly where to start.
          </Text>
          <View style={styles.stepList}>
            {quickStart.map((step, index) => (
              <View key={step} style={styles.stepRow}>
                <View style={[styles.stepIndex, { backgroundColor: colors.accentSoft }]}>
                  <Text style={[styles.stepIndexText, { color: colors.accent }]}>{index + 1}</Text>
                </View>
                <Text style={[styles.stepText, { color: colors.text }]}>{step}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionHeaderTitle, { color: colors.text }]}>Feature-by-Feature Help</Text>
          <Text style={[styles.sectionHeaderText, { color: colors.textMuted }]}>
            Every section below explains what it does, why it matters, and how to use it effectively.
          </Text>
        </View>

        {filteredSections.map((section) => (
          <View key={section.id} style={[styles.featureCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.featureTop}>
              <View style={[styles.featureIconWrap, { backgroundColor: colors.accentSoft }]}>
                <Ionicons name={section.icon} size={18} color={colors.accent} />
              </View>
              <View style={styles.featureTopText}>
                <Text style={[styles.featureTitle, { color: colors.text }]}>{section.title}</Text>
                <Text style={[styles.featureSummary, { color: colors.textMuted }]}>{section.summary}</Text>
              </View>
            </View>

            <View style={[styles.infoBlock, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
              <Text style={[styles.infoLabel, { color: colors.accent }]}>Why this is useful</Text>
              <Text style={[styles.infoText, { color: colors.text }]}>{section.whyItMatters}</Text>
            </View>

            <View style={styles.dualRow}>
              <View style={[styles.subCard, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
                <Text style={[styles.subCardTitle, { color: colors.text }]}>How to use it</Text>
                {section.howToUse.map((item, index) => (
                  <View key={item} style={styles.bulletRow}>
                    <Text style={[styles.bulletIndex, { color: colors.accent }]}>{index + 1}.</Text>
                    <Text style={[styles.bulletText, { color: colors.text }]}>{item}</Text>
                  </View>
                ))}
              </View>

              <View style={[styles.subCard, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
                <Text style={[styles.subCardTitle, { color: colors.text }]}>Helpful tips</Text>
                {section.proTips.map((item) => (
                  <View key={item} style={styles.tipRow}>
                    <Ionicons name="sparkles-outline" size={14} color={colors.accent} />
                    <Text style={[styles.tipText, { color: colors.text }]}>{item}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        ))}

        <View style={[styles.footerCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.footerTitle, { color: colors.text }]}>How to get the most from ORIN</Text>
          <View style={styles.footerList}>
            {[
              "Keep your profile updated so ORIN can guide you better.",
              "Use AI, Mentorship, and Community together instead of separately.",
              "Return daily to track XP, progress, and new opportunities.",
              "Use this guide anytime you feel unsure about a screen or feature."
            ].map((item) => (
              <View key={item} style={styles.tipRow}>
                <Ionicons name="checkmark-circle-outline" size={16} color={colors.accent} />
                <Text style={[styles.tipText, { color: colors.text }]}>{item}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 16, paddingBottom: 120, gap: 14 },
  hero: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 18,
    gap: 12
  },
  heroBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  heroBadgeText: {
    fontWeight: "800",
    fontSize: 13
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: "900"
  },
  heroText: {
    fontSize: 15,
    lineHeight: 23,
    fontWeight: "600"
  },
  heroPills: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  heroPill: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "transparent"
  },
  heroPillText: {
    fontWeight: "800",
    fontSize: 12
  },
  card: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    gap: 10
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: "900"
  },
  cardSub: {
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "600"
  },
  stepList: {
    gap: 12
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10
  },
  stepIndex: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center"
  },
  stepIndexText: {
    fontWeight: "900"
  },
  stepText: {
    flex: 1,
    lineHeight: 22,
    fontWeight: "600"
  },
  sectionHeader: {
    gap: 4,
    marginTop: 4
  },
  sectionHeaderTitle: {
    fontSize: 22,
    fontWeight: "900"
  },
  sectionHeaderText: {
    lineHeight: 21,
    fontWeight: "600"
  },
  featureCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    gap: 12
  },
  featureTop: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start"
  },
  featureIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center"
  },
  featureTopText: {
    flex: 1,
    gap: 4
  },
  featureTitle: {
    fontSize: 18,
    fontWeight: "900"
  },
  featureSummary: {
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "600"
  },
  infoBlock: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    gap: 6
  },
  infoLabel: {
    fontWeight: "800",
    fontSize: 13
  },
  infoText: {
    lineHeight: 22,
    fontWeight: "600"
  },
  dualRow: {
    gap: 10
  },
  subCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    gap: 10
  },
  subCardTitle: {
    fontWeight: "900",
    fontSize: 16
  },
  bulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8
  },
  bulletIndex: {
    width: 18,
    fontWeight: "900"
  },
  bulletText: {
    flex: 1,
    lineHeight: 21,
    fontWeight: "600"
  },
  tipRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8
  },
  tipText: {
    flex: 1,
    lineHeight: 21,
    fontWeight: "600"
  },
  footerCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    gap: 12
  },
  footerTitle: {
    fontSize: 20,
    fontWeight: "900"
  },
  footerList: {
    gap: 10
  }
});
