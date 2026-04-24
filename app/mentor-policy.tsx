import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

const SECTIONS: { title: string; body: string[] }[] = [
  {
    title: "Role Of A Mentor On ORIN",
    body: [
      "Mentors on ORIN support students through 1:1 sessions, live sessions, sprint-style programs, institution roadmaps, chat guidance, and approved knowledge contributions.",
      "Mentor access may depend on approval, profile quality, verification, and platform review workflows."
    ]
  },
  {
    title: "Professional Conduct",
    body: [
      "Mentors must communicate respectfully, arrive prepared, and conduct sessions professionally.",
      "Misleading claims, harassment, abusive conduct, repeated no-shows, or off-platform payment pressure are not allowed.",
      "Mentors should share clear session expectations, next steps, and relevant follow-up guidance when appropriate."
    ]
  },
  {
    title: "Sessions, Links, And Delivery",
    body: [
      "Mentors are responsible for the quality and conduct of the sessions they offer through ORIN.",
      "Session links may be added manually by the mentor or generated through supported meeting workflows such as Jitsi-enabled links where available.",
      "Mentors should ensure that meeting links, schedules, and joining instructions are accurate before the session begins."
    ]
  },
  {
    title: "Institution And Program Workflows",
    body: [
      "Institution mentors may create institution roadmaps, review student proof submissions, award XP, and issue certificates where that workflow is enabled.",
      "Mentors contributing institution content, challenges, or learning resources should ensure the material is accurate, useful, and appropriate for the learner group.",
      "Class-ready institution features may be supported in some flows, but mentors should avoid publishing misleading class or institution information."
    ]
  },
  {
    title: "Payments, Payouts, And Commission",
    body: [
      "Paid session bookings, verification, refunds, and mentor payouts must follow the official ORIN workflow.",
      "Platform commission and mentor payout percentages may vary by workflow, but payout processing always depends on valid verification and platform records.",
      "Mentors must keep payout details such as bank account or UPI information accurate if those payout methods are used by ORIN."
    ]
  },
  {
    title: "Content And Guidance Responsibility",
    body: [
      "Mentors remain responsible for the advice, roadmap feedback, knowledge resources, and session material they provide.",
      "ORIN may host and display mentor-contributed material, but mentors are responsible for ensuring it is lawful, accurate, and not infringing or harmful.",
      "Mentors should avoid guaranteeing job placement, exam results, admissions, or outcomes they cannot responsibly control."
    ]
  },
  {
    title: "Policy Enforcement",
    body: [
      "ORIN may review mentor behavior, payouts, content, session quality, complaints, and approval status when needed for safety and platform operations.",
      "Violations may lead to warnings, content removal, payout holds, temporary restrictions, suspension, or account removal."
    ]
  },
  {
    title: "Support",
    body: [
      "Mentors can use Mentor Dashboard workflows and admin support channels for payout, session, verification, and operational questions.",
      "For general support, contact: orin2k26@gmail.com"
    ]
  }
];

export default function MentorPolicyScreen() {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Mentor Policy</Text>
        <Text style={styles.meta}>Effective date: April 24, 2026</Text>
        <Text style={styles.intro}>
          This policy reflects the current ORIN mentor experience, including sessions, live programs, institution
          roadmaps, knowledge contributions, payouts, and platform conduct expectations.
        </Text>

        {SECTIONS.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.subtitle}>{section.title}</Text>
            {section.body.map((item) => (
              <Text key={`${section.title}-${item}`} style={styles.text}>
                - {item}
              </Text>
            ))}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: "#F4F9F6",
    padding: 20
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderColor: "#E4E7EC",
    borderWidth: 1,
    borderRadius: 16,
    padding: 18
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: "#1E2B24",
    marginBottom: 6
  },
  meta: {
    color: "#667085",
    marginBottom: 10
  },
  intro: {
    color: "#475467",
    lineHeight: 22
  },
  section: {
    marginTop: 14
  },
  subtitle: {
    marginBottom: 6,
    fontSize: 16,
    fontWeight: "700",
    color: "#1F7A4C"
  },
  text: {
    color: "#475467",
    lineHeight: 22,
    marginBottom: 4
  }
});
