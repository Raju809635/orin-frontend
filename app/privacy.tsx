import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

const POLICY_SECTIONS: { title: string; body: string[] }[] = [
  {
    title: "Overview",
    body: [
      "ORIN is an adaptive learning, mentorship, AI guidance, academic resource, and community platform for high-school learners, after-12 learners, Global Teachers, Global Mentors, and administrators.",
      "This policy explains what information ORIN collects, how it is used, when it may be shared with service providers, how it is protected, and what choices you have."
    ]
  },
  {
    title: "Information We Collect",
    body: [
      "Account and identity information such as name, email address, password, role, learner stage, mentor type, education details, institution, class, state, and profile photo.",
      "Profile and community information such as bio, skills, interests, posts, comments, reactions, follows, connections, certificates, achievements, quiz battle activity, challenge submissions, opportunity applications, knowledge-library submissions, study-group participation, and mentor-group participation.",
      "Academic information such as board, class, subject, chapter, topic, syllabus selections, study plans, roadmaps, subject-gap inputs, exam strategy inputs, quiz answers, progress, XP, streaks, and resource usage.",
      "Mentorship and teaching information such as Global Mentor bookings, mentor availability, live-session bookings, sprint enrollments, Global Teacher assigned classes, teacher-created resources, challenges, roadmaps, opportunities, review notes, ratings, meeting links, and attendance-related workflow data.",
      "Payment and payout information such as Razorpay payment references, manual payment screenshots, transaction references, payout UPI details, payout QR codes, and payout status records.",
      "Uploaded files and media such as profile photos, challenge proof files, roadmap proof files, posters, academic PDFs, curriculum documents, resumes, certificates, screenshots, and support attachments.",
      "AI and learning inputs such as prompts, academic context, roadmap preferences, subject-gap inputs, exam strategy requests, career exploration inputs, project or activity requests, resume-builder inputs, and AI-generated outputs saved by the user.",
      "Technical and usage information such as device/browser data, app version, log information, timestamps, basic analytics needed to secure and operate the app, and security-related records."
    ]
  },
  {
    title: "How We Use Information",
    body: [
      "To create and manage accounts, authenticate users, and provide stage-based or role-based access for students, Global Teachers, Global Mentors, and administrators.",
      "To operate features including high-school academic tools, after-12 career tools, mentorship sessions, live sessions, sprint programs, certificates, achievements, quiz battles, study groups, community spaces, chat, knowledge library, opportunities, complaints, and notifications.",
      "To show the right content to the right audience, such as high-school resources for high-school learners, after-12 content for after-12 learners, institution content for matching institutions, and class content for matching classes.",
      "To process and verify payments, manual payment reviews, mentor payouts, and financial records connected to paid services.",
      "To generate AI responses, recommendations, subject-gap insights, study planners, exam strategies, academic roadmaps, career guidance, project ideas, resumes, and other personalized learning support.",
      "To moderate content, review approvals, prevent abuse, investigate complaints, enforce policies, and maintain platform safety.",
      "To improve feature quality, reliability, personalization, fraud prevention, and customer support."
    ]
  },
  {
    title: "High School, Global Teacher, And Academic Data",
    body: [
      "High-school features may use academic selections such as class, subject, chapter, topic, quiz answers, roadmap progress, study-group activity, and PDF resource usage to provide learning support.",
      "Global Teachers may create or review high-school resources, challenges, roadmaps, opportunities, announcements, and submissions for global high-school audiences, selected institutions, or selected classes.",
      "ORIN may process uploaded academic PDFs and structured syllabus data to power resource browsing, topic selection, AI prompts, study roadmaps, and exam strategy features.",
      "Students should avoid uploading unnecessary personal documents as academic proof unless the app specifically requests them."
    ]
  },
  {
    title: "Meeting Links And Jitsi",
    body: [
      "ORIN supports mentor-managed session links. Mentors may add manual meeting links or generate Jitsi meeting links for eligible 1:1 sessions, live sessions, and sprint programs.",
      "If a mentor generates a Jitsi link, ORIN stores the generated room link inside the existing meeting-link workflow so the session can still fall back to a manual link if needed.",
      "No Jitsi API key is required for the current implementation because ORIN generates standard public Jitsi meeting URLs."
    ]
  },
  {
    title: "Service Providers And Third Parties",
    body: [
      "ORIN may use third-party providers that process limited data to deliver app functionality, including payment providers such as Razorpay, storage/media services such as Cloudinary and Firebase Storage, AI providers such as OpenAI, Groq, or Gemini when configured, and Jitsi for generated meeting links.",
      "These providers only receive the information reasonably necessary for the relevant function, such as processing a payment, storing uploaded media, generating AI responses, or opening a meeting room.",
      "ORIN may also disclose information when required by law, to respond to valid legal requests, or to protect users, administrators, mentors, students, or the platform."
    ]
  },
  {
    title: "Data Sharing Inside ORIN",
    body: [
      "Some information is visible to other users by design, such as public profile details, posts, comments, certificates, achievements, leaderboard entries, community submissions, mentor program information, teacher-created content, and meeting availability where applicable.",
      "Global Teachers and students may see relevant class, institution, resource, challenge, roadmap, study-group, proof, and review details when they are participating in the same academic activity.",
      "Global Mentors and students may see each other's relevant session and program details when they are participating in the same mentorship activity.",
      "Administrators may access records needed for moderation, approvals, support, complaint handling, payment verification, academic content review, fraud prevention, and operational review."
    ]
  },
  {
    title: "Retention",
    body: [
      "ORIN keeps information for as long as it is needed to operate the service, complete transactions, maintain records, resolve disputes, enforce policies, or comply with legal obligations.",
      "Retention periods may differ by data type. For example, payment records, complaints, certificates, moderation records, and security logs may be kept longer than general session or profile edits."
    ]
  },
  {
    title: "Security",
    body: [
      "ORIN uses reasonable administrative, technical, and organizational safeguards to protect account data, uploaded files, payment-related records, and platform operations.",
      "No method of storage or transmission is completely secure, so ORIN cannot guarantee absolute security."
    ]
  },
  {
    title: "Your Choices",
    body: [
      "You can update parts of your account and profile information inside the app.",
      "You can control some privacy settings, such as profile visibility and whether certain information is shown in your profile.",
      "You can request account deletion or data-related support through the published account deletion flow or by contacting ORIN support."
    ]
  },
  {
    title: "Children",
    body: [
      "ORIN currently focuses on high-school and after-12 learning experiences. Kids entry points may exist in product code for future use, but normal public onboarding is focused on high school and after-12 users.",
      "ORIN is not intended for children below the minimum age required under applicable law to use the service independently. If you believe personal data from a child has been provided improperly, contact support so it can be reviewed."
    ]
  },
  {
    title: "Contact",
    body: [
      "Support email: orin2k26@gmail.com",
      "Public policy URL: https://orin-privacy-policy.vercel.app/privacy-policy",
      "Account deletion URL: https://orin-privacy-policy.vercel.app/delete-account"
    ]
  }
];

export default function PrivacyScreen() {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Privacy Policy</Text>
        <Text style={styles.meta}>Effective date: May 9, 2026</Text>
        <Text style={styles.intro}>
          This in-app privacy policy reflects the current ORIN mobile experience, including high-school academic tools,
          after-12 mentorship tools, Global Teacher workflows, AI features, academic PDFs, community features, file
          uploads, payments, certificates, and mentor-managed meeting links.
        </Text>

        {POLICY_SECTIONS.map((section) => (
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
