import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

const SECTIONS: { title: string; body: string[] }[] = [
  {
    title: "Acceptance",
    body: [
      "By creating an account, accessing ORIN, or using any ORIN feature, you agree to these Terms of Use and related platform policies.",
      "If you do not agree, do not use the app."
    ]
  },
  {
    title: "What ORIN Provides",
    body: [
      "ORIN is a learning, mentorship, AI guidance, community, and institution-support platform.",
      "Features may include AI assistant, AI career roadmaps, institution roadmaps, project ideas, knowledge library, mentor discovery, live sessions, sprints, community posts, chat, challenges, certificates, and support workflows.",
      "Some features may be enabled, disabled, or limited based on user role, approval status, institution setup, or admin review."
    ]
  },
  {
    title: "Accounts And Eligibility",
    body: [
      "You must provide accurate account and profile information and keep it reasonably updated.",
      "You are responsible for activity that happens through your account and for protecting your login credentials.",
      "Mentor accounts, admin access, and certain monetized features may require approval or verification before use."
    ]
  },
  {
    title: "Acceptable Use",
    body: [
      "Use ORIN only for lawful learning, mentorship, networking, collaboration, and platform-supported activities.",
      "Do not impersonate another person, upload fraudulent proof, share fake payment records, abuse mentors or students, scrape platform data, or misuse community and AI tools.",
      "Do not post illegal, harmful, harassing, sexually explicit, hateful, misleading, or infringing content.",
      "Do not use ORIN to bypass official session, payment, moderation, or complaint workflows."
    ]
  },
  {
    title: "AI Features",
    body: [
      "AI outputs in ORIN are guidance tools and may be incomplete, incorrect, generic, or not suitable for every real-world decision.",
      "Users must review AI-generated roadmaps, projects, skill suggestions, resumes, and recommendations before relying on them.",
      "ORIN may use third-party AI providers when configured to power these experiences."
    ]
  },
  {
    title: "Mentorship, Sessions, And Programs",
    body: [
      "Mentor sessions, live programs, sprints, and institution-led learning paths depend on mentor availability, admin workflows, and platform configuration.",
      "Mentors and students must respect schedule commitments, conduct sessions professionally, and use official ORIN workflows for coordination wherever required.",
      "ORIN may support manual meeting links and generated Jitsi links, but the platform does not guarantee uninterrupted third-party meeting availability."
    ]
  },
  {
    title: "Payments, Refunds, And Payouts",
    body: [
      "Paid bookings, payment verification, and mentor payouts must follow the official ORIN process.",
      "Submitting fake proofs, manipulated screenshots, or misleading transaction details is a serious policy violation.",
      "Refunds, reversals, payout holds, and settlement actions may depend on admin review, dispute handling, fraud checks, or policy outcomes."
    ]
  },
  {
    title: "Community And Institution Content",
    body: [
      "You remain responsible for posts, comments, uploads, proof submissions, roadmap work, knowledge resources, and other material you submit.",
      "By posting content in ORIN, you allow ORIN to host, display, process, moderate, and use that content as needed to operate the service.",
      "Institution-linked content may be visible inside institution views, roadmap views, or related student and mentor workflows."
    ]
  },
  {
    title: "Moderation And Enforcement",
    body: [
      "ORIN may review, restrict, reject, remove, or moderate accounts, content, submissions, payouts, approvals, sessions, and access when needed for safety, compliance, abuse prevention, or platform operation.",
      "Violations may lead to warnings, content removal, temporary restrictions, payment holds, suspension, or permanent account removal."
    ]
  },
  {
    title: "Disclaimers And Liability",
    body: [
      "ORIN is provided on an as-available basis without a guarantee that every feature will be available at all times.",
      "ORIN is not responsible for third-party provider outages, mentor-specific promises outside platform workflows, user misconduct, or indirect losses caused by reliance on platform content or AI output.",
      "To the extent allowed by law, ORIN's liability is limited to the amount directly paid by the user for the relevant platform service, if any."
    ]
  },
  {
    title: "Contact",
    body: [
      "Support email: orin2k26@gmail.com",
      "Privacy policy URL: https://orin-privacy-policy.vercel.app/privacy-policy",
      "Account deletion URL: https://orin-privacy-policy.vercel.app/delete-account"
    ]
  }
];

export default function TermsScreen() {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Terms of Use</Text>
        <Text style={styles.meta}>Effective date: April 24, 2026</Text>
        <Text style={styles.intro}>
          These in-app terms describe the current ORIN mobile platform, including AI tools, mentorship workflows,
          institution experiences, community features, live programs, support processes, and payment-linked services.
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
  container: { flexGrow: 1, backgroundColor: "#F4F9F6", padding: 20 },
  card: {
    backgroundColor: "#fff",
    borderColor: "#E4E7EC",
    borderWidth: 1,
    borderRadius: 14,
    padding: 16
  },
  title: { fontSize: 24, fontWeight: "800", color: "#1E2B24", marginBottom: 6 },
  meta: { color: "#667085", marginBottom: 10 },
  intro: { color: "#475467", lineHeight: 22 },
  section: { marginTop: 14 },
  subtitle: { marginBottom: 6, fontSize: 16, fontWeight: "700", color: "#1F7A4C" },
  text: { color: "#475467", lineHeight: 22, marginBottom: 4 }
});
