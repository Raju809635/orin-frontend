import React from "react";
import { Ionicons } from "@expo/vector-icons";
import { ScrollView, StyleSheet, Text, View } from "react-native";

type DomainGuide = {
  domain: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  softBg: string;
  subDomains: {
    name: string;
    icon: keyof typeof Ionicons.glyphMap;
    color: string;
    tracks: string[];
  }[];
  focus: string;
  outcomes: string[];
};

const DOMAIN_GUIDE: DomainGuide[] = [
  {
    domain: "Academic",
    icon: "school",
    color: "#2563EB",
    softBg: "#EEF4FF",
    subDomains: [
      {
        name: "School",
        icon: "book",
        color: "#1D4ED8",
        tracks: ["Math", "Science", "English", "Social Studies"]
      },
      {
        name: "Intermediate",
        icon: "layers",
        color: "#1D4ED8",
        tracks: ["MPC", "BiPC", "MEC", "CEC"]
      },
      {
        name: "Engineering",
        icon: "construct",
        color: "#1D4ED8",
        tracks: ["CSE", "ECE", "EEE", "Mechanical"]
      },
      {
        name: "MBA",
        icon: "briefcase",
        color: "#1D4ED8",
        tracks: ["Marketing", "Finance", "Operations", "HR"]
      },
      {
        name: "Law",
        icon: "library",
        color: "#1D4ED8",
        tracks: ["Constitutional Law", "Corporate Law", "Litigation"]
      }
    ],
    focus: "Core subject clarity, consistent study methods, and academic planning.",
    outcomes: ["Strong fundamentals", "Exam confidence", "Structured progress"]
  },
  {
    domain: "Competitive Exams",
    icon: "trophy",
    color: "#B45309",
    softBg: "#FFF7ED",
    subDomains: [
      { name: "JEE", icon: "ribbon", color: "#B45309", tracks: ["JEE Main", "JEE Advanced", "Revision Strategy"] },
      { name: "NEET", icon: "medkit", color: "#B45309", tracks: ["Biology", "Physics", "Chemistry"] },
      { name: "UPSC", icon: "globe", color: "#B45309", tracks: ["Prelims", "Mains", "Interview"] },
      { name: "SSC", icon: "clipboard", color: "#B45309", tracks: ["CGL", "CHSL", "Reasoning"] },
      { name: "TGPSC", icon: "flag", color: "#B45309", tracks: ["Group 1", "Group 2", "General Studies"] },
      { name: "Banking Exams", icon: "card", color: "#B45309", tracks: ["IBPS", "SBI PO", "Clerical"] }
    ],
    focus: "Strategy, revision cycles, mock analysis, and score improvement.",
    outcomes: ["Higher mock scores", "Better test strategy", "Clear revision plan"]
  },
  {
    domain: "Professional Courses",
    icon: "document-text",
    color: "#0F766E",
    softBg: "#ECFEFF",
    subDomains: [
      { name: "CA", icon: "calculator", color: "#0F766E", tracks: ["Foundation", "Inter", "Final"] },
      { name: "CS", icon: "newspaper", color: "#0F766E", tracks: ["Executive", "Professional"] },
      { name: "CMA", icon: "stats-chart", color: "#0F766E", tracks: ["Foundation", "Inter", "Final"] }
    ],
    focus: "Course roadmap, preparation milestones, and attempt planning.",
    outcomes: ["Clear exam path", "Concept retention", "Long-term discipline"]
  },
  {
    domain: "Career & Placements",
    icon: "briefcase",
    color: "#9333EA",
    softBg: "#F5F3FF",
    subDomains: [
      { name: "Placements", icon: "document-attach", color: "#9333EA", tracks: ["Resume Review", "Mock Interviews", "Aptitude"] },
      { name: "Career Guidance", icon: "trail-sign", color: "#9333EA", tracks: ["Roadmap Planning", "Role Selection", "Higher Studies"] }
    ],
    focus: "Resume, interview preparation, role targeting, and career decisions.",
    outcomes: ["Better resumes", "Interview confidence", "Role clarity"]
  },
  {
    domain: "Technology & AI",
    icon: "hardware-chip",
    color: "#0369A1",
    softBg: "#EFF6FF",
    subDomains: [
      { name: "Web Development", icon: "code-slash", color: "#0369A1", tracks: ["Frontend", "Backend", "Full Stack"] },
      { name: "Data Science", icon: "bar-chart", color: "#0369A1", tracks: ["Python", "Statistics", "Data Visualization"] },
      { name: "AI/ML", icon: "sparkles", color: "#0369A1", tracks: ["Machine Learning", "Deep Learning", "MLOps"] }
    ],
    focus: "Skills building, project direction, and practical industry readiness.",
    outcomes: ["Portfolio growth", "Technical confidence", "Job readiness"]
  },
  {
    domain: "Startups & Entrepreneurship",
    icon: "rocket",
    color: "#DC2626",
    softBg: "#FEF2F2",
    subDomains: [
      { name: "Startup", icon: "bulb", color: "#DC2626", tracks: ["Idea Validation", "MVP Building", "Fundraising"] },
      { name: "Growth", icon: "trending-up", color: "#DC2626", tracks: ["Go-To-Market", "Sales", "Team Building"] }
    ],
    focus: "Idea validation, MVP strategy, GTM, and team scaling mindset.",
    outcomes: ["Faster execution", "Business clarity", "Startup discipline"]
  },
  {
    domain: "Finance & Investing",
    icon: "cash",
    color: "#047857",
    softBg: "#ECFDF3",
    subDomains: [
      { name: "Investing", icon: "pie-chart", color: "#047857", tracks: ["Stocks", "Mutual Funds", "Portfolio Strategy"] },
      { name: "Finance", icon: "wallet", color: "#047857", tracks: ["Budgeting", "Personal Finance", "Risk Management"] }
    ],
    focus: "Financial literacy, risk understanding, and investment thinking.",
    outcomes: ["Money management", "Investment basics", "Risk awareness"]
  },
  {
    domain: "Creative & Design",
    icon: "color-palette",
    color: "#DB2777",
    softBg: "#FDF2F8",
    subDomains: [
      { name: "Design", icon: "images", color: "#DB2777", tracks: ["UI Design", "UX Research", "Product Design"] },
      { name: "Creative", icon: "brush", color: "#DB2777", tracks: ["Branding", "Content", "Visual Storytelling"] }
    ],
    focus: "UI/UX thinking, branding, visual storytelling, and creative growth.",
    outcomes: ["Design quality", "Creative confidence", "Stronger communication"]
  },
  {
    domain: "Personal Development",
    icon: "fitness",
    color: "#7C2D12",
    softBg: "#FFF7ED",
    subDomains: [
      { name: "Growth", icon: "trending-up", color: "#7C2D12", tracks: ["Communication", "Productivity", "Leadership"] },
      { name: "Wellness", icon: "heart", color: "#7C2D12", tracks: ["Mindset", "Work-Life Balance", "Confidence Building"] }
    ],
    focus: "Communication, productivity, confidence, and long-term habits.",
    outcomes: ["Better communication", "Consistency", "Stronger mindset"]
  }
];

export default function DomainGuideScreen() {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.heading}>Domain Guide</Text>
      <Text style={styles.subheading}>
        Understand every ORIN domain and sub-domain before choosing a mentor.
      </Text>

      <View style={styles.introCard}>
        <Text style={styles.cardTitle}>Why ORIN Exists</Text>
        <Text style={styles.cardText}>
          ORIN was built to reduce confusion in student growth journeys. Many students know they need guidance,
          but do not know where to start. This platform organizes mentorship into clear domains so decision-making
          is easier, faster, and more practical.
        </Text>
        <Text style={styles.cardText}>
          ORIN connects students with approved mentors across academics, careers, exams, technology, and life skills.
          The goal is direction-first growth: right guidance at the right time.
        </Text>
      </View>

      <Text style={styles.sectionTitle}>All Domains & Sub-Domains</Text>
      {DOMAIN_GUIDE.map((item) => (
        <View key={item.domain} style={[styles.domainCard, { borderColor: item.color + "33", backgroundColor: item.softBg }]}>
          <View style={styles.domainHead}>
            <View style={[styles.domainIconWrap, { backgroundColor: item.color + "22" }]}>
              <Ionicons name={item.icon} size={20} color={item.color} />
            </View>
            <Text style={[styles.domainTitle, { color: item.color }]}>{item.domain}</Text>
          </View>
          <Text style={styles.label}>Sub-Domains</Text>
          <View style={styles.subGrid}>
            {item.subDomains.map((sub) => (
              <View key={`${item.domain}-${sub.name}`} style={styles.subSquare}>
                <View style={[styles.subIconWrap, { backgroundColor: sub.color + "22" }]}>
                  <Ionicons name={sub.icon} size={16} color={sub.color} />
                </View>
                <Text style={styles.subName}>{sub.name}</Text>
                <Text style={styles.subTracks}>{sub.tracks.join(", ")}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.label}>Focus</Text>
          <Text style={styles.value}>{item.focus}</Text>
          <Text style={styles.label}>Expected Outcomes</Text>
          <Text style={styles.value}>{item.outcomes.join(" | ")}</Text>
        </View>
      ))}

      <View style={styles.closingCard}>
        <Text style={styles.cardTitle}>How Students Should Use This</Text>
        <Text style={styles.cardText}>
          Choose a domain based on your immediate need, shortlist mentors in that domain, and book focused sessions
          with clear goals. This improves session quality and saves time.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#F3F6F8",
    padding: 18,
    paddingBottom: 28
  },
  heading: {
    fontSize: 28,
    fontWeight: "800",
    color: "#13251E"
  },
  subheading: {
    marginTop: 6,
    color: "#475467",
    lineHeight: 20
  },
  sectionTitle: {
    marginTop: 16,
    marginBottom: 10,
    fontSize: 16,
    fontWeight: "800",
    color: "#1E2B24"
  },
  introCard: {
    marginTop: 14,
    backgroundColor: "#F8FBFF",
    borderWidth: 1,
    borderColor: "#D8E7F7",
    borderRadius: 14,
    padding: 14
  },
  closingCard: {
    marginTop: 12,
    backgroundColor: "#F5FAF6",
    borderWidth: 1,
    borderColor: "#D5E9DB",
    borderRadius: 14,
    padding: 14
  },
  cardTitle: {
    fontWeight: "800",
    color: "#143225",
    marginBottom: 6
  },
  cardText: {
    color: "#475467",
    lineHeight: 20,
    marginTop: 4
  },
  domainCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10
  },
  domainHead: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 2
  },
  domainIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10
  },
  subGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 6
  },
  subSquare: {
    width: "48.6%",
    minHeight: 120,
    paddingVertical: 8,
    paddingHorizontal: 8,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB"
  },
  subIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center"
  },
  subName: {
    marginTop: 6,
    color: "#1E2B24",
    fontWeight: "700",
    fontSize: 13
  },
  subTracks: {
    marginTop: 4,
    color: "#667085",
    lineHeight: 18,
    fontSize: 12
  },
  domainTitle: {
    fontSize: 17,
    fontWeight: "800"
  },
  label: {
    marginTop: 9,
    fontWeight: "700",
    color: "#1E2B24",
    fontSize: 13
  },
  value: {
    marginTop: 4,
    color: "#475467",
    lineHeight: 19
  }
});
