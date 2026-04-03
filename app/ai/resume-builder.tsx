import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/lib/api";
import { useAppTheme } from "@/context/ThemeContext";
import { notify } from "@/utils/notify";
import { saveAiItem } from "@/utils/aiSaves";
import { markdownToPlainText } from "@/utils/textFormat";

type ResumeProject = {
  title: string;
  tech?: string[];
  link?: string;
  description?: string;
};

type ResumeAchievement = {
  title: string;
  issuer?: string;
  date?: string;
  url?: string;
};

type ResumeExperience = {
  organization?: string;
  role?: string;
  start?: string;
  end?: string;
  description?: string;
};

type ResumeEducation = {
  school?: string;
  degree?: string;
  year?: string;
};

type ResumeData = {
  name: string;
  role?: string;
  roleLabel?: string;
  userRole?: "student" | "mentor";
  email?: string;
  phone?: string;
  profileImage?: string;
  summary?: string;
  domains?: string[];
  skills?: string[];
  projects?: ResumeProject[];
  achievements?: ResumeAchievement[];
  experience?: ResumeExperience[];
  education?: ResumeEducation[];
  careerGoal?: string;
  linkedInUrl?: string;
  location?: string;
  strengths?: string;
  rating?: number;
  totalStudentsMentored?: number;
};

type MissingField = {
  id: string;
  label: string;
  prompt: string;
  recommendedValue?: string;
};

type ResumeReadiness = {
  score?: number;
  level?: string;
  onePageOptimized?: boolean;
};

type ResumeOverrides = {
  targetRole: string;
  phone: string;
  location: string;
  linkedInUrl: string;
  careerGoal: string;
  summary: string;
  strengths: string;
  projectDescription: string;
  experienceDescription: string;
  educationDetail: string;
};

type ResumeResponse = {
  resume?: ResumeData;
  summary?: string;
  markdown?: string;
  previewHtml?: string;
  templates?: string[];
  missingFields?: MissingField[];
  readiness?: ResumeReadiness;
  export?: { fileName?: string; pdfFileName?: string };
};

const TEMPLATE_META = {
  modern: {
    label: "Modern",
    subtitle: "Startup-ready with bold header",
    colors: ["#0F7B6C", "#5BC58C"] as const,
    badge: "Best for startups"
  },
  corporate: {
    label: "Corporate",
    subtitle: "ATS-friendly and placement-ready",
    colors: ["#1D2939", "#475467"] as const,
    badge: "Best for jobs"
  },
  creative: {
    label: "Creative",
    subtitle: "Portfolio layout with strong visual identity",
    colors: ["#0E8C6E", "#1F4D8F"] as const,
    badge: "Best for standout profiles"
  }
};

type TemplateKey = keyof typeof TEMPLATE_META;
const CACHE_KEY_PREFIX = "ai-resume-builder-cache-v1";

function previewNameFallback(name = "") {
  return String(name || "O").trim().slice(0, 1).toUpperCase() || "O";
}

function chipList(items: string[] = []) {
  return items.filter(Boolean).slice(0, 6);
}

const EMPTY_OVERRIDES: ResumeOverrides = {
  targetRole: "",
  phone: "",
  location: "",
  linkedInUrl: "",
  careerGoal: "",
  summary: "",
  strengths: "",
  projectDescription: "",
  experienceDescription: "",
  educationDetail: ""
};

export default function AiResumeBuilderPage() {
  const { colors, isDark } = useAppTheme();
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateKey>("corporate");
  const [data, setData] = useState<ResumeResponse | null>(null);
  const [resumeInputs, setResumeInputs] = useState<ResumeOverrides>(EMPTY_OVERRIDES);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const resumeInputsRef = React.useRef<ResumeOverrides>(EMPTY_OVERRIDES);

  React.useEffect(() => {
    resumeInputsRef.current = resumeInputs;
  }, [resumeInputs]);

  const load = useCallback(async (refresh = false, template: TemplateKey = selectedTemplate, overrides: ResumeOverrides = EMPTY_OVERRIDES) => {
    try {
      if (refresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      const res = await api.post<ResumeResponse>(
        "/api/network/resume/generate",
        overrides,
        {
          params: { template }
        }
      );
      const nextData = res.data || null;
      setData(nextData);
      AsyncStorage.setItem(`${CACHE_KEY_PREFIX}-${template}`, JSON.stringify(nextData)).catch(() => undefined);
    } catch (e: any) {
      const cached = await AsyncStorage.getItem(`${CACHE_KEY_PREFIX}-${template}`).catch(() => null);
      if (cached) {
        setData(JSON.parse(cached) as ResumeResponse);
        setError("Showing last generated resume.");
      } else {
        setError(e?.response?.data?.message || "Failed to load resume builder.");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedTemplate]);

  useFocusEffect(
    useCallback(() => {
      load(false, selectedTemplate, resumeInputsRef.current);
    }, [load, selectedTemplate])
  );

  const resume = data?.resume;
  const plainText = useMemo(() => markdownToPlainText(data?.markdown || ""), [data?.markdown]);
  const fileName = useMemo(() => {
    const raw = data?.export?.fileName || "orin_resume.txt";
    return raw.replace(/[^\w.\-]+/g, "_");
  }, [data?.export?.fileName]);

  const pdfFileName = useMemo(() => {
    const raw = data?.export?.pdfFileName || "orin_resume.pdf";
    return raw.replace(/[^\w.\-]+/g, "_");
  }, [data?.export?.pdfFileName]);

  const changeTemplate = useCallback(
    async (template: TemplateKey) => {
      setSelectedTemplate(template);
      await load(true, template, resumeInputs);
    },
    [load, resumeInputs]
  );

  const generateResume = useCallback(async () => {
    await load(true, selectedTemplate, resumeInputs);
  }, [load, resumeInputs, selectedTemplate]);

  const downloadText = useCallback(async () => {
    if (!plainText) {
      notify("Generate resume first.");
      return;
    }

    let FileSystem: any;
    let Sharing: any;
    try {
      FileSystem = await import("expo-file-system");
      Sharing = await import("expo-sharing");
    } catch {
      Alert.alert("Update required", "Text export requires the latest app build.");
      return;
    }

    if (!FileSystem?.writeAsStringAsync || !FileSystem?.cacheDirectory) {
      notify("File system is not available on this device.");
      return;
    }

    const targetPath = `${FileSystem.cacheDirectory}${fileName}`;
    await FileSystem.writeAsStringAsync(targetPath, plainText, {
      encoding: FileSystem.EncodingType.UTF8
    });

    if (Sharing?.isAvailableAsync && (await Sharing.isAvailableAsync())) {
      await Sharing.shareAsync(targetPath, {
        dialogTitle: "Share resume text",
        mimeType: "text/plain"
      });
      return;
    }

    notify(`Saved to cache: ${fileName}`);
  }, [fileName, plainText]);

  const downloadPdf = useCallback(async () => {
    if (!resume) {
      notify("Generate resume first.");
      return;
    }

    if (Platform.OS === "web") {
      try {
        const res = await api.get("/api/network/resume/pdf", {
          params: { template: selectedTemplate },
          responseType: "blob",
          timeout: 30000
        } as any);

        const blob: Blob = (res as any).data;
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = pdfFileName;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
      } catch (e: any) {
        notify(e?.response?.data?.message || "Failed to download PDF.");
      }
      return;
    }

    let Print: any;
    let Sharing: any;
    try {
      Print = await import("expo-print");
      Sharing = await import("expo-sharing");
    } catch {
      Alert.alert("Update required", "PDF export requires the latest app build.");
      return;
    }

    if (!Print?.printToFileAsync || !data?.previewHtml) {
      notify("Resume preview is not ready.");
      return;
    }

    const result = await Print.printToFileAsync({ html: data.previewHtml });
    if (!result?.uri) {
      notify("Failed to generate PDF.");
      return;
    }

    if (Sharing?.isAvailableAsync && (await Sharing.isAvailableAsync())) {
      await Sharing.shareAsync(result.uri, {
        dialogTitle: "Share resume PDF",
        mimeType: "application/pdf"
      });
      return;
    }

    notify("PDF created.");
  }, [data?.previewHtml, pdfFileName, resume, selectedTemplate]);

  const save = useCallback(async () => {
    if (!resume) {
      notify("Generate resume first.");
      return;
    }

    await saveAiItem({
      type: "resume",
      title: `AI Resume (${TEMPLATE_META[selectedTemplate].label})`,
      payload: {
        template: selectedTemplate,
        summary: data?.summary || resume.summary,
        text: plainText,
        resume
      }
    });
    notify("Saved to Saved AI.");
  }, [data?.summary, plainText, resume, selectedTemplate]);

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[styles.page, { backgroundColor: colors.background }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true, selectedTemplate, resumeInputs)} />}
    >
      <View style={styles.hero}>
        <Text style={styles.pageTitle}>AI Resume Builder</Text>
        <Text style={styles.pageSub}>
          Build a clean resume from your ORIN profile, choose a professional template, preview it, and export a proper PDF.
        </Text>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="color-palette" size={18} color="#0F7B6C" />
          <Text style={styles.sectionTitle}>Choose Template</Text>
        </View>
        <View style={styles.templateGrid}>
          {(Object.keys(TEMPLATE_META) as TemplateKey[]).map((template) => {
            const active = selectedTemplate === template;
            return (
              <TouchableOpacity
                key={template}
                style={[styles.templateCard, active ? styles.templateCardActive : null]}
                onPress={() => changeTemplate(template)}
              >
                <View style={[styles.templateSwatch, { backgroundColor: TEMPLATE_META[template].colors[0] }]} />
                <Text style={styles.templateTitle}>{TEMPLATE_META[template].label}</Text>
                <Text style={styles.templateSub}>{TEMPLATE_META[template].subtitle}</Text>
                <Text style={styles.templateBadge}>{TEMPLATE_META[template].badge}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="sparkles" size={18} color="#0F7B6C" />
          <Text style={styles.sectionTitle}>Resume Engine</Text>
        </View>
        <Text style={styles.meta}>Uses your live ORIN profile data, role-specific fields, and a structured summary.</Text>
        <View style={styles.readinessCard}>
          <View>
            <Text style={styles.readinessLabel}>Resume Readiness</Text>
            <Text style={styles.readinessValue}>{data?.readiness?.score || 0}/100</Text>
            <Text style={styles.meta}>{data?.readiness?.level || "Needs more detail"}</Text>
          </View>
          <View style={styles.readinessBadge}>
            <Text style={styles.readinessBadgeText}>{data?.readiness?.onePageOptimized ? "1 Page" : "Draft"}</Text>
          </View>
        </View>
        {data?.missingFields?.length ? (
          <View style={styles.missingWrap}>
            <Text style={styles.previewBlockTitle}>Still Missing</Text>
            {data.missingFields.map((field) => (
              <View key={field.id} style={styles.missingCard}>
                <Text style={styles.missingTitle}>{field.label}</Text>
                <Text style={styles.meta}>{field.prompt}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.successText}>This resume is looking company-ready. Use Generate Resume after any final polish.</Text>
        )}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="create-outline" size={18} color="#0F7B6C" />
          <Text style={styles.sectionTitle}>Complete Missing Details</Text>
        </View>
        <Text style={styles.meta}>Fill only what is missing or weak. ORIN will blend this with the profile data and keep the resume to one page.</Text>
        <TextInput
          style={styles.input}
          value={resumeInputs.targetRole}
          onChangeText={(text) => setResumeInputs((prev) => ({ ...prev, targetRole: text }))}
          placeholder="Target role, e.g. Software Engineer Intern"
          placeholderTextColor="#98A2B3"
        />
        <View style={styles.dualRow}>
          <TextInput
            style={[styles.input, styles.halfInput]}
            value={resumeInputs.phone}
            onChangeText={(text) => setResumeInputs((prev) => ({ ...prev, phone: text }))}
            placeholder="Phone number"
            placeholderTextColor="#98A2B3"
            keyboardType="phone-pad"
          />
          <TextInput
            style={[styles.input, styles.halfInput]}
            value={resumeInputs.location}
            onChangeText={(text) => setResumeInputs((prev) => ({ ...prev, location: text }))}
            placeholder="City, State"
            placeholderTextColor="#98A2B3"
          />
        </View>
        <TextInput
          style={styles.input}
          value={resumeInputs.linkedInUrl}
          onChangeText={(text) => setResumeInputs((prev) => ({ ...prev, linkedInUrl: text }))}
          placeholder="LinkedIn URL"
          placeholderTextColor="#98A2B3"
          autoCapitalize="none"
        />
        <TextInput
          style={styles.input}
          value={resumeInputs.careerGoal}
          onChangeText={(text) => setResumeInputs((prev) => ({ ...prev, careerGoal: text }))}
          placeholder="Career focus, e.g. Backend development, Data analytics"
          placeholderTextColor="#98A2B3"
        />
        <TextInput
          style={[styles.input, styles.textarea]}
          value={resumeInputs.summary}
          onChangeText={(text) => setResumeInputs((prev) => ({ ...prev, summary: text }))}
          placeholder="2-3 line professional summary with strengths, domain, and outcomes"
          placeholderTextColor="#98A2B3"
          multiline
        />
        <TextInput
          style={[styles.input, styles.textarea]}
          value={resumeInputs.strengths}
          onChangeText={(text) => setResumeInputs((prev) => ({ ...prev, strengths: text }))}
          placeholder="Key strengths, e.g. problem solving, APIs, data storytelling"
          placeholderTextColor="#98A2B3"
          multiline
        />
        <TextInput
          style={[styles.input, styles.textarea]}
          value={resumeInputs.projectDescription}
          onChangeText={(text) => setResumeInputs((prev) => ({ ...prev, projectDescription: text }))}
          placeholder="If project descriptions are weak, add one strong project impact note here"
          placeholderTextColor="#98A2B3"
          multiline
        />
        <TextInput
          style={[styles.input, styles.textarea]}
          value={resumeInputs.experienceDescription}
          onChangeText={(text) => setResumeInputs((prev) => ({ ...prev, experienceDescription: text }))}
          placeholder="If experience is weak, add role impact here"
          placeholderTextColor="#98A2B3"
          multiline
        />
        <TextInput
          style={styles.input}
          value={resumeInputs.educationDetail}
          onChangeText={(text) => setResumeInputs((prev) => ({ ...prev, educationDetail: text }))}
          placeholder="Education detail if missing, e.g. B.Tech CSE"
          placeholderTextColor="#98A2B3"
        />
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.primaryBtn} onPress={generateResume}>
            <Text style={styles.primaryBtnText}>Build One-Page Resume</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryBtn} onPress={downloadPdf}>
            <Text style={styles.secondaryBtnText}>Download PDF</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryBtn} onPress={downloadText}>
            <Text style={styles.secondaryBtnText}>Download Text</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryBtn} onPress={save}>
            <Text style={styles.secondaryBtnText}>Save</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="eye" size={18} color="#0F7B6C" />
          <Text style={styles.sectionTitle}>Resume Preview</Text>
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {loading ? <ActivityIndicator size="large" color="#0F7B6C" /> : null}
        {!loading && !resume ? <Text style={styles.meta}>Resume preview unavailable right now.</Text> : null}

        {resume ? (
          <View style={styles.previewShell}>
            <View
              style={[
                styles.previewHeader,
                { backgroundColor: TEMPLATE_META[selectedTemplate].colors[0] }
              ]}
            >
              {resume.profileImage ? (
                <Image source={{ uri: resume.profileImage }} style={styles.profileImage} />
              ) : (
                <View style={styles.profileFallback}>
                  <Text style={styles.profileFallbackText}>{previewNameFallback(resume.name)}</Text>
                </View>
              )}
              <View style={styles.previewIdentity}>
                <Text style={styles.previewName}>{resume.name}</Text>
                <Text style={styles.previewRole}>{resume.roleLabel || resume.role || "Career Builder"}</Text>
                <Text style={styles.previewMeta}>
                  {[resume.email, resume.phone, resume.location].filter(Boolean).join(" | ") || "Contact details unavailable"}
                </Text>
              </View>
            </View>

            <View style={styles.previewBody}>
              <View style={styles.previewBlock}>
                <Text style={styles.previewBlockTitle}>Professional Summary</Text>
                <Text style={styles.previewText}>{data?.summary || resume.summary || "Summary will appear here."}</Text>
              </View>

              {resume.strengths ? (
                <View style={styles.previewBlock}>
                  <Text style={styles.previewBlockTitle}>Strengths</Text>
                  <Text style={styles.previewText}>{resume.strengths}</Text>
                </View>
              ) : null}

              {chipList(resume.skills || []).length ? (
                <View style={styles.previewBlock}>
                  <Text style={styles.previewBlockTitle}>Skills</Text>
                  <View style={styles.chipRow}>
                    {chipList(resume.skills || []).map((skill) => (
                      <View key={skill} style={styles.skillChip}>
                        <Text style={styles.skillChipText}>{skill}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}

              <View style={styles.previewBlock}>
                <Text style={styles.previewBlockTitle}>Projects</Text>
                {resume.projects?.length ? (
                  resume.projects.map((project, index) => (
                    <View key={`${project.title}-${index}`} style={styles.itemCard}>
                      <Text style={styles.itemTitle}>{project.title || "Project"}</Text>
                      {project.tech?.length ? <Text style={styles.itemMeta}>{project.tech.join(" | ")}</Text> : null}
                      {project.description ? <Text style={styles.previewText}>{project.description}</Text> : null}
                      {project.link ? <Text style={styles.linkText}>{project.link}</Text> : null}
                    </View>
                  ))
                ) : (
                  <Text style={styles.meta}>Projects will appear here when added to your profile.</Text>
                )}
              </View>

              <View style={styles.previewBlock}>
                <Text style={styles.previewBlockTitle}>Experience</Text>
                {resume.experience?.length ? (
                  resume.experience.map((item, index) => (
                    <View key={`${item.role}-${index}`} style={styles.itemCard}>
                      <Text style={styles.itemTitle}>
                        {[item.role, item.organization].filter(Boolean).join(" | ") || "Experience"}
                      </Text>
                      {item.start || item.end ? (
                        <Text style={styles.itemMeta}>{[item.start, item.end].filter(Boolean).join(" - ")}</Text>
                      ) : null}
                      {item.description ? <Text style={styles.previewText}>{item.description}</Text> : null}
                    </View>
                  ))
                ) : (
                  <Text style={styles.meta}>Experience details will appear here when added to your profile.</Text>
                )}
              </View>

              <View style={styles.previewBlock}>
                <Text style={styles.previewBlockTitle}>Achievements</Text>
                {resume.achievements?.length ? (
                  resume.achievements.map((item, index) => (
                    <View key={`${item.title}-${index}`} style={styles.itemCard}>
                      <Text style={styles.itemTitle}>{item.title}</Text>
                      <Text style={styles.itemMeta}>{[item.issuer, item.date].filter(Boolean).join(" | ")}</Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.meta}>Achievements will appear here when added to your profile.</Text>
                )}
              </View>

              {resume.education?.length ? (
                <View style={styles.previewBlock}>
                  <Text style={styles.previewBlockTitle}>Education</Text>
                  {resume.education.map((item, index) => (
                    <View key={`${item.degree}-${index}`} style={styles.itemCard}>
                      <Text style={styles.itemTitle}>{item.degree || "Education"}</Text>
                      <Text style={styles.itemMeta}>{[item.school, item.year].filter(Boolean).join(" | ")}</Text>
                    </View>
                  ))}
                </View>
              ) : null}

              <View style={styles.previewBlock}>
                <Text style={styles.previewBlockTitle}>Career Focus</Text>
                <Text style={styles.previewText}>{resume.careerGoal || "Career growth and mentorship"}</Text>
              </View>
            </View>
          </View>
        ) : null}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="help-circle" size={18} color="#0F7B6C" />
          <Text style={styles.sectionTitle}>Tips</Text>
        </View>
        <Text style={styles.meta}>Add measurable project outcomes, clean role titles, and a strong summary for the best result.</Text>
        <Text style={styles.meta}>Mentors can use this builder too. Their resume emphasizes expertise, mentoring impact, pricing credibility, and profile strength.</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    padding: 16,
    backgroundColor: "#F3F6FB",
    gap: 12
  },
  hero: {
    paddingVertical: 6
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: "900",
    color: "#102A22"
  },
  pageSub: {
    marginTop: 6,
    color: "#667085",
    lineHeight: 21
  },
  section: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E4E7EC",
    padding: 14,
    gap: 10
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  sectionTitle: {
    fontWeight: "800",
    color: "#1E2B24",
    fontSize: 16
  },
  templateGrid: {
    gap: 10
  },
  templateCard: {
    borderWidth: 1,
    borderColor: "#D0D5DD",
    borderRadius: 16,
    padding: 12,
    backgroundColor: "#F9FAFB"
  },
  templateCardActive: {
    borderColor: "#0F7B6C",
    backgroundColor: "#ECFDF3"
  },
  templateSwatch: {
    width: 52,
    height: 8,
    borderRadius: 999,
    marginBottom: 10
  },
  templateTitle: {
    fontWeight: "800",
    color: "#101828"
  },
  templateSub: {
    marginTop: 4,
    color: "#667085"
  },
  templateBadge: {
    marginTop: 8,
    color: "#0F7B6C",
    fontWeight: "700"
  },
  meta: {
    color: "#667085",
    lineHeight: 20
  },
  successText: {
    color: "#0F7B6C",
    fontWeight: "700"
  },
  error: {
    color: "#B42318",
    fontWeight: "700"
  },
  readinessCard: {
    borderWidth: 1,
    borderColor: "#B8E0C8",
    borderRadius: 16,
    backgroundColor: "#F4FBF7",
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  readinessLabel: {
    color: "#667085",
    fontWeight: "700"
  },
  readinessValue: {
    color: "#102A22",
    fontSize: 24,
    fontWeight: "900",
    marginTop: 4
  },
  readinessBadge: {
    backgroundColor: "#0F7B6C",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  readinessBadgeText: {
    color: "#FFFFFF",
    fontWeight: "800"
  },
  missingWrap: {
    gap: 8
  },
  missingCard: {
    borderWidth: 1,
    borderColor: "#F1D6AE",
    backgroundColor: "#FFF8EE",
    borderRadius: 14,
    padding: 12
  },
  missingTitle: {
    color: "#8A4B00",
    fontWeight: "800",
    marginBottom: 4
  },
  dualRow: {
    flexDirection: "row",
    gap: 10
  },
  halfInput: {
    flex: 1
  },
  input: {
    borderWidth: 1,
    borderColor: "#D0D5DD",
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    color: "#101828",
    paddingHorizontal: 12,
    paddingVertical: 11
  },
  textarea: {
    minHeight: 92,
    textAlignVertical: "top"
  },
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    alignItems: "center"
  },
  primaryBtn: {
    backgroundColor: "#0F7B6C",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11
  },
  primaryBtnText: {
    color: "#FFFFFF",
    fontWeight: "800"
  },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: "#0F7B6C",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11
  },
  secondaryBtnText: {
    color: "#0F7B6C",
    fontWeight: "800"
  },
  previewShell: {
    borderRadius: 22,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#D8E3DC",
    backgroundColor: "#FFFFFF"
  },
  previewHeader: {
    padding: 18,
    flexDirection: "row",
    gap: 14,
    alignItems: "center"
  },
  profileImage: {
    width: 82,
    height: 82,
    borderRadius: 20,
    backgroundColor: "#D0D5DD"
  },
  profileFallback: {
    width: 82,
    height: 82,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
    alignItems: "center",
    justifyContent: "center"
  },
  profileFallbackText: {
    color: "#FFFFFF",
    fontSize: 30,
    fontWeight: "900"
  },
  previewIdentity: {
    flex: 1
  },
  previewName: {
    fontSize: 24,
    fontWeight: "900",
    color: "#FFFFFF"
  },
  previewRole: {
    marginTop: 4,
    color: "#F2F4F7",
    fontWeight: "700"
  },
  previewMeta: {
    marginTop: 6,
    color: "#E4E7EC"
  },
  previewBody: {
    padding: 14,
    gap: 12
  },
  previewBlock: {
    borderWidth: 1,
    borderColor: "#E4E7EC",
    borderRadius: 16,
    padding: 12,
    backgroundColor: "#FBFCFD"
  },
  previewBlockTitle: {
    fontWeight: "800",
    color: "#102A22",
    marginBottom: 8
  },
  previewText: {
    color: "#344054",
    lineHeight: 20
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  skillChip: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "#E6F4EC",
    borderWidth: 1,
    borderColor: "#B8E0C8"
  },
  skillChipText: {
    color: "#0F7B6C",
    fontWeight: "700"
  },
  itemCard: {
    borderWidth: 1,
    borderColor: "#E4E7EC",
    borderRadius: 14,
    padding: 10,
    backgroundColor: "#FFFFFF",
    marginBottom: 8
  },
  itemTitle: {
    fontWeight: "800",
    color: "#101828"
  },
  itemMeta: {
    marginTop: 4,
    color: "#667085"
  },
  linkText: {
    marginTop: 6,
    color: "#0F7B6C",
    fontWeight: "700"
  }
});
