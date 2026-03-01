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
    tracks: {
      name: string;
      topics: string[];
    }[];
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
        tracks: [
          { name: "Primary", topics: ["Math Basics", "Reading", "General Science", "Social Basics"] },
          { name: "High School", topics: ["Algebra", "Physics Basics", "Biology Basics", "English Grammar"] }
        ]
      },
      {
        name: "Intermediate",
        icon: "layers",
        color: "#2563EB",
        tracks: [
          { name: "MPC", topics: ["Maths", "Physics", "Chemistry"] },
          { name: "BiPC", topics: ["Botany", "Zoology", "Physics", "Chemistry"] },
          { name: "MEC", topics: ["Maths", "Economics", "Commerce"] },
          { name: "CEC", topics: ["Civics", "Economics", "Commerce"] }
        ]
      },
      {
        name: "Engineering",
        icon: "construct",
        color: "#1E40AF",
        tracks: [
          { name: "CSE", topics: ["DSA", "Web Development", "System Design"] },
          { name: "ECE", topics: ["Signals", "Communication", "Embedded"] },
          { name: "EEE", topics: ["Power Systems", "Machines", "Control Systems"] },
          { name: "Mechanical", topics: ["Thermodynamics", "Design", "Manufacturing"] }
        ]
      },
      {
        name: "MBA",
        icon: "briefcase",
        color: "#1E3A8A",
        tracks: [
          { name: "Marketing", topics: ["Branding", "Digital Marketing", "Consumer Behavior"] },
          { name: "Finance", topics: ["Valuation", "Corporate Finance", "Risk"] },
          { name: "Operations", topics: ["Supply Chain", "Process Design", "Quality"] }
        ]
      },
      {
        name: "Law",
        icon: "library",
        color: "#1D4ED8",
        tracks: [
          { name: "Core Law", topics: ["Constitution", "Criminal Law", "Civil Procedure"] },
          { name: "Corporate Law", topics: ["Companies Act", "Compliance", "Drafting"] }
        ]
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
      {
        name: "JEE",
        icon: "ribbon",
        color: "#B45309",
        tracks: [
          { name: "JEE Main", topics: ["Maths", "Physics", "Chemistry"] },
          { name: "JEE Advanced", topics: ["Problem Solving", "Time Strategy", "Revision"] }
        ]
      },
      {
        name: "NEET",
        icon: "medkit",
        color: "#C2410C",
        tracks: [
          { name: "Biology", topics: ["Botany", "Zoology", "NCERT Mastery"] },
          { name: "PCM Support", topics: ["Physics Numericals", "Chemistry Concepts"] }
        ]
      },
      {
        name: "UPSC",
        icon: "globe",
        color: "#9A3412",
        tracks: [
          { name: "Prelims", topics: ["Polity", "History", "Economy", "Current Affairs"] },
          { name: "Mains", topics: ["Geography", "Law", "Ethics", "Society", "IR"] },
          { name: "Interview", topics: ["DAF", "Communication", "Opinion Framing"] }
        ]
      },
      {
        name: "SSC",
        icon: "clipboard",
        color: "#B45309",
        tracks: [
          { name: "Tier Preparation", topics: ["Quant", "Reasoning", "English", "GK"] },
          { name: "Role Focus", topics: ["CGL", "CHSL", "CPO"] }
        ]
      },
      {
        name: "TGPSC",
        icon: "flag",
        color: "#B45309",
        tracks: [
          { name: "Group 1", topics: ["General Studies", "Essay", "State-specific"] },
          { name: "Group 2", topics: ["GS", "Aptitude", "Interview"] }
        ]
      },
      {
        name: "Banking Exams",
        icon: "card",
        color: "#B45309",
        tracks: [
          { name: "PO", topics: ["Quant", "Reasoning", "English", "Banking Awareness"] },
          { name: "Clerk", topics: ["Speed Math", "Reasoning", "Accuracy"] }
        ]
      }
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
      {
        name: "CA",
        icon: "calculator",
        color: "#0F766E",
        tracks: [
          { name: "Foundation", topics: ["Accounts", "Law", "Maths"] },
          { name: "Inter", topics: ["Tax", "Costing", "Audit"] },
          { name: "Final", topics: ["FR", "SFM", "Direct Tax"] }
        ]
      },
      {
        name: "CS",
        icon: "newspaper",
        color: "#0E7490",
        tracks: [
          { name: "Executive", topics: ["Company Law", "Tax Laws", "Securities Law"] },
          { name: "Professional", topics: ["Drafting", "Governance", "Compliance"] }
        ]
      },
      {
        name: "CMA",
        icon: "stats-chart",
        color: "#0F766E",
        tracks: [
          { name: "Inter", topics: ["Cost Accounting", "Taxation", "Law"] },
          { name: "Final", topics: ["Strategic Cost", "Performance Mgmt", "Corporate Laws"] }
        ]
      }
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
      {
        name: "Placements",
        icon: "document-attach",
        color: "#7E22CE",
        tracks: [
          { name: "Resume", topics: ["ATS Format", "Project Bullets", "Positioning"] },
          { name: "Interviews", topics: ["HR Questions", "Technical Round", "Mock Practice"] }
        ]
      },
      {
        name: "Career Guidance",
        icon: "trail-sign",
        color: "#9333EA",
        tracks: [
          { name: "Roadmap", topics: ["Role Selection", "Skill Gap", "Execution Plan"] },
          { name: "Higher Studies", topics: ["GRE/GMAT", "SOP", "University Shortlisting"] }
        ]
      }
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
      {
        name: "Web Development",
        icon: "code-slash",
        color: "#0369A1",
        tracks: [
          { name: "Frontend", topics: ["React", "React Native", "UI Patterns"] },
          { name: "Backend", topics: ["Node.js", "Express", "APIs"] },
          { name: "Full Stack", topics: ["Architecture", "Deployment", "Debugging"] }
        ]
      },
      {
        name: "Data Science",
        icon: "bar-chart",
        color: "#0C4A6E",
        tracks: [
          { name: "Core", topics: ["Python", "Statistics", "EDA"] },
          { name: "Advanced", topics: ["Feature Engineering", "Model Eval", "Visualization"] }
        ]
      },
      {
        name: "AI/ML",
        icon: "sparkles",
        color: "#0369A1",
        tracks: [
          { name: "Machine Learning", topics: ["Supervised", "Unsupervised", "Model Tuning"] },
          { name: "Deep Learning", topics: ["CNN", "RNN", "Transformers"] },
          { name: "MLOps", topics: ["Serving", "Monitoring", "Pipelines"] }
        ]
      }
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
      {
        name: "Startup",
        icon: "bulb",
        color: "#DC2626",
        tracks: [
          { name: "Idea Stage", topics: ["Validation", "User Persona", "Problem Discovery"] },
          { name: "Build Stage", topics: ["MVP", "Iteration", "Early Users"] }
        ]
      },
      {
        name: "Growth",
        icon: "trending-up",
        color: "#B91C1C",
        tracks: [
          { name: "GTM", topics: ["Positioning", "Channels", "Pricing"] },
          { name: "Scale", topics: ["Hiring", "Sales Process", "Ops"] }
        ]
      }
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
      {
        name: "Investing",
        icon: "pie-chart",
        color: "#047857",
        tracks: [
          { name: "Equity", topics: ["Fundamental Analysis", "Risk", "Allocation"] },
          { name: "Mutual Funds", topics: ["SIP", "Debt vs Equity", "Rebalancing"] }
        ]
      },
      {
        name: "Finance",
        icon: "wallet",
        color: "#065F46",
        tracks: [
          { name: "Personal Finance", topics: ["Budgeting", "Emergency Fund", "Insurance"] },
          { name: "Planning", topics: ["Goal Mapping", "Tax Basics", "Retirement"] }
        ]
      }
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
      {
        name: "Design",
        icon: "images",
        color: "#DB2777",
        tracks: [
          { name: "UI", topics: ["Layouts", "Color Systems", "Typography"] },
          { name: "UX", topics: ["Research", "User Flows", "Testing"] }
        ]
      },
      {
        name: "Creative",
        icon: "brush",
        color: "#BE185D",
        tracks: [
          { name: "Branding", topics: ["Identity", "Voice", "Positioning"] },
          { name: "Content", topics: ["Storytelling", "Visuals", "Social Formats"] }
        ]
      }
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
      {
        name: "Growth",
        icon: "trending-up",
        color: "#7C2D12",
        tracks: [
          { name: "Communication", topics: ["Public Speaking", "Writing", "Listening"] },
          { name: "Leadership", topics: ["Decision Making", "Team Handling", "Ownership"] }
        ]
      },
      {
        name: "Wellness",
        icon: "heart",
        color: "#9A3412",
        tracks: [
          { name: "Mindset", topics: ["Consistency", "Confidence", "Stress Handling"] },
          { name: "Balance", topics: ["Routines", "Focus", "Energy Management"] }
        ]
      }
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
        Understand every ORIN domain, sub-domain, track, and topic before choosing a mentor.
      </Text>

      <View style={styles.introCard}>
        <Text style={styles.cardTitle}>Why ORIN Exists</Text>
        <Text style={styles.cardText}>
          ORIN was built to reduce confusion in student growth journeys. Many students know they need guidance, but
          do not know where to start. This platform organizes mentorship into clear levels so decision-making is easier,
          faster, and more practical.
        </Text>
      </View>

      <Text style={styles.sectionTitle}>All Domains and Deep Subsections</Text>
      {DOMAIN_GUIDE.map((item) => (
        <View key={item.domain} style={[styles.domainCard, { borderColor: `${item.color}33`, backgroundColor: item.softBg }]}>
          <View style={styles.domainHead}>
            <View style={[styles.domainIconWrap, { backgroundColor: `${item.color}22` }]}>
              <Ionicons name={item.icon} size={20} color={item.color} />
            </View>
            <Text style={[styles.domainTitle, { color: item.color }]}>{item.domain}</Text>
          </View>

          <Text style={[styles.label, styles.labelSub]}>Sub-Domains</Text>
          <View style={styles.subGrid}>
            {item.subDomains.map((sub) => (
              <View
                key={`${item.domain}-${sub.name}`}
                style={[styles.subSquare, { borderColor: `${sub.color}33`, backgroundColor: `${sub.color}11` }]}
              >
                <View style={[styles.subIconWrap, { backgroundColor: `${sub.color}22` }]}>
                  <Ionicons name={sub.icon} size={16} color={sub.color} />
                </View>
                <Text style={[styles.subName, { color: sub.color }]}>{sub.name}</Text>
                {sub.tracks.map((track) => (
                  <View key={`${sub.name}-${track.name}`} style={styles.trackWrap}>
                    <Text style={styles.trackName}>{track.name}</Text>
                    <View style={styles.topicWrap}>
                      {track.topics.map((topic) => (
                        <Text key={`${track.name}-${topic}`} style={[styles.topicChip, { borderColor: `${sub.color}55` }]}>
                          {topic}
                        </Text>
                      ))}
                    </View>
                  </View>
                ))}
              </View>
            ))}
          </View>

          <Text style={[styles.label, styles.labelFocus]}>Focus</Text>
          <Text style={styles.value}>{item.focus}</Text>
          <Text style={[styles.label, styles.labelOutcome]}>Expected Outcomes</Text>
          <Text style={styles.value}>{item.outcomes.join(" | ")}</Text>
        </View>
      ))}
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
    color: "#0F172A"
  },
  introCard: {
    marginTop: 14,
    backgroundColor: "#EAF2FF",
    borderWidth: 1,
    borderColor: "#BED6FF",
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
  domainTitle: {
    fontSize: 17,
    fontWeight: "800"
  },
  label: {
    marginTop: 9,
    fontWeight: "800",
    color: "#1E2B24",
    fontSize: 13
  },
  labelSub: { color: "#0C4A6E" },
  labelFocus: { color: "#166534" },
  labelOutcome: { color: "#7C2D12" },
  subGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 6
  },
  subSquare: {
    width: "100%",
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1
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
    fontWeight: "800",
    fontSize: 14
  },
  trackWrap: {
    marginTop: 8,
    backgroundColor: "#FFFFFF",
    borderColor: "#E5E7EB",
    borderWidth: 1,
    borderRadius: 10,
    padding: 8
  },
  trackName: {
    color: "#1E2B24",
    fontWeight: "700",
    fontSize: 12
  },
  topicWrap: {
    marginTop: 6,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6
  },
  topicChip: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    color: "#475467",
    fontSize: 11,
    fontWeight: "600",
    overflow: "hidden"
  },
  value: {
    marginTop: 4,
    color: "#475467",
    lineHeight: 19
  }
});
