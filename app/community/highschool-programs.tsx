import React, { useCallback, useMemo, useState } from "react";
import { Alert, Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { api } from "@/lib/api";
import { getAppErrorMessage } from "@/lib/appError";
import { useAppTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import * as ImagePicker from "expo-image-picker";
import {
  AcademicCard,
  AcademicEmpty,
  ActionButton,
  CommunitySection,
  HighSchoolCommunityShell,
  StatusBadge
} from "@/components/community/highschool-ui";

type OpportunityItem = {
  _id: string;
  title: string;
  company?: string;
  role?: string;
  type?: string;
  category?: string;
  duration?: string;
  description?: string;
  isActive?: boolean;
  recommendationReason?: string;
  applicationUrl?: string;
  url?: string;
  deadline?: string;
  location?: string;
};

type CompetitionItem = {
  _id: string;
  title: string;
  subject: string;
  chapter?: string;
  description?: string;
  scopeType: "institution_only" | "multi_institution" | "open_highschool";
  registrationDeadline: string;
  level1At: string;
  level2At?: string | null;
  status: string;
  qualificationTopN?: number;
  institutionName?: string;
  myRegistration?: {
    status?: string;
    qualifiedForLevel2?: boolean;
    level2BatchIndex?: number;
  } | null;
};

type FilterKey = "all" | "workshop" | "olympiad" | "bootcamp" | "scholarship" | "event";
const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "workshop", label: "Workshops" },
  { key: "olympiad", label: "Olympiad Prep" },
  { key: "bootcamp", label: "Bootcamps" },
  { key: "scholarship", label: "Scholarships" },
  { key: "event", label: "School Events" }
];
const CLASS_OPTIONS = ["8", "9", "10", "11", "12", "10 A", "10 B", "10 C"];
const TIME_SLOT_OPTIONS = ["08:00", "09:00", "10:00", "11:00", "14:00", "15:00", "16:00", "17:00"];
const DATE_OFFSET_OPTIONS = [1, 3, 7, 14, 21];

function academicBucket(item: OpportunityItem): FilterKey {
  const text = `${item.title} ${item.type} ${item.category} ${item.role} ${item.description}`.toLowerCase();
  if (text.includes("scholar")) return "scholarship";
  if (text.includes("olympiad") || text.includes("exam")) return "olympiad";
  if (text.includes("bootcamp") || text.includes("camp")) return "bootcamp";
  if (text.includes("event") || text.includes("school")) return "event";
  return "workshop";
}

export default function HighSchoolProgramsScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const { user } = useAuth();
  const mentorOrgRole = String(user?.mentorOrgRole || "");
  const isInstitutionTeacher = user?.role === "mentor" && (mentorOrgRole === "institution_teacher" || mentorOrgRole === "global_teacher" || mentorOrgRole === "teacher");
  const [programs, setPrograms] = useState<OpportunityItem[]>([]);
  const [competitions, setCompetitions] = useState<CompetitionItem[]>([]);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [selected, setSelected] = useState<OpportunityItem | null>(null);
  const [creating, setCreating] = useState(false);
  const [scopeType, setScopeType] = useState<"institution_only" | "multi_institution" | "open_highschool">("institution_only");
  const [selectedInstitutionName, setSelectedInstitutionName] = useState("");
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("Mathematics");
  const [chapter, setChapter] = useState("");
  const [description, setDescription] = useState("");
  const [bannerImageUrl, setBannerImageUrl] = useState("");
  const [allowedInstitutions, setAllowedInstitutions] = useState<string[]>([]);
  const [classLevelFilter, setClassLevelFilter] = useState<string[]>([]);
  const [registrationDateOffset, setRegistrationDateOffset] = useState(7);
  const [registrationTimeSlot, setRegistrationTimeSlot] = useState("17:00");
  const [level1DateOffset, setLevel1DateOffset] = useState(10);
  const [level1TimeSlot, setLevel1TimeSlot] = useState("10:00");
  const [level2DateOffset, setLevel2DateOffset] = useState(12);
  const [level2TimeSlot, setLevel2TimeSlot] = useState("10:00");
  const [qualificationTopN, setQualificationTopN] = useState("20");
  const [level1QuestionCount, setLevel1QuestionCount] = useState("15");
  const [level1TimeModeSec, setLevel1TimeModeSec] = useState<10 | 30>(30);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    try {
      if (refresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      const [competitionRes, opportunityRes] = await Promise.all([
        api.get<{ competitions: CompetitionItem[] }>("/api/network/highschool-competitions"),
        api.get<OpportunityItem[]>("/api/network/opportunities")
      ]);
      setCompetitions(competitionRes.data?.competitions || []);
      setPrograms((opportunityRes.data || []).filter((item) => item.isActive !== false));
    } catch (e) {
      setError(getAppErrorMessage(e, "Failed to load school programs."));
      setPrograms([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const visible = useMemo(() => programs.filter((item) => filter === "all" || academicBucket(item) === filter), [filter, programs]);
  const institutionChoices = useMemo(() => {
    const set = new Set<string>();
    if (user?.institutionName) set.add(user.institutionName);
    competitions.forEach((item) => {
      if (item.institutionName) set.add(item.institutionName);
    });
    return [...set].filter(Boolean);
  }, [competitions, user?.institutionName]);

  function toIso(offsetDays: number, timeSlot: string) {
    const [h, m] = timeSlot.split(":").map((item) => Number(item || 0));
    const date = new Date();
    date.setDate(date.getDate() + offsetDays);
    date.setHours(h, m, 0, 0);
    return date.toISOString();
  }

  async function pickBannerImage() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission needed", "Allow gallery access to pick an event banner.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      quality: 0.8
    });
    if (result.canceled) return;
    const uri = result.assets?.[0]?.uri || "";
    if (uri) setBannerImageUrl(uri);
  }

  async function createCompetition() {
    if (!isInstitutionTeacher) return;
    if (!title.trim() || !subject.trim()) {
      Alert.alert("Required fields", "Please fill title and subject.");
      return;
    }
    if (scopeType === "multi_institution" && allowedInstitutions.length < 2) {
      Alert.alert("Select schools", "For Inter-School mode, select at least 2 institutions.");
      return;
    }
    if (scopeType === "institution_only" && !selectedInstitutionName && !user?.institutionName) {
      Alert.alert("Select institution", "Pick the institution for this competition.");
      return;
    }
    try {
      setCreating(true);
      setError(null);
      await api.post("/api/network/highschool-competitions", {
        title: title.trim(),
        subject: subject.trim(),
        chapter: chapter.trim(),
        description: description.trim(),
        bannerImageUrl: bannerImageUrl.trim(),
        scopeType,
        selectedInstitutionName: scopeType === "institution_only" ? (selectedInstitutionName || user?.institutionName || "") : "",
        allowedInstitutions: scopeType === "multi_institution" ? allowedInstitutions : [],
        classLevelFilter,
        registrationDeadline: toIso(registrationDateOffset, registrationTimeSlot),
        level1At: toIso(level1DateOffset, level1TimeSlot),
        level2At: toIso(level2DateOffset, level2TimeSlot),
        qualificationTopN: Math.max(1, Number(qualificationTopN || "20")),
        level1QuestionCount: Math.max(5, Number(level1QuestionCount || "15")),
        level1TimeModeSec
      });
      Alert.alert("Created", "Championship program created.");
      setTitle("");
      setChapter("");
      setDescription("");
      setAllowedInstitutions([]);
      setClassLevelFilter([]);
      setBannerImageUrl("");
      await load(true);
    } catch (e) {
      setError(getAppErrorMessage(e, "Unable to create championship program."));
    } finally {
      setCreating(false);
    }
  }

  return (
    <HighSchoolCommunityShell
      title="School Programs"
      subtitle="After-12 opportunities engine, filtered and presented for academic-safe workshops, scholarships, bootcamps and school events."
      stats={[
        { icon: "briefcase", label: "Programs", value: String(competitions.length || programs.length) },
        { icon: "filter", label: "Filter", value: FILTERS.find((item) => item.key === filter)?.label || "All" },
        { icon: "school", label: "Mode", value: "Academic" }
      ]}
      loading={loading}
      error={error}
      refreshing={refreshing}
      onRefresh={() => load(true)}
    >
      {isInstitutionTeacher ? (
        <CommunitySection title="Create Championship Program" subtitle="Teacher-only panel to create Level-1 and Level-2 school competitions." icon="add-circle">
          <TextInput
            style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}
            placeholder="Program title (e.g., Maths Championship 2026)"
            placeholderTextColor={colors.textMuted}
            value={title}
            onChangeText={setTitle}
          />
          <TextInput
            style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}
            placeholder="Subject"
            placeholderTextColor={colors.textMuted}
            value={subject}
            onChangeText={setSubject}
          />
          <TextInput
            style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}
            placeholder="Chapter / topic scope (optional)"
            placeholderTextColor={colors.textMuted}
            value={chapter}
            onChangeText={setChapter}
          />
          <TextInput
            style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}
            placeholder="Description (optional)"
            placeholderTextColor={colors.textMuted}
            value={description}
            onChangeText={setDescription}
          />
          <TouchableOpacity style={[styles.bannerPicker, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }]} onPress={pickBannerImage}>
            <Text style={[styles.bannerPickerText, { color: colors.text }]}>Select Event Banner</Text>
            <Text style={[styles.bannerPickerMeta, { color: colors.textMuted }]}>Tap to choose image from gallery</Text>
          </TouchableOpacity>
          {bannerImageUrl ? (
            <Image source={{ uri: bannerImageUrl }} style={styles.bannerPreview} />
          ) : null}

          <Text style={[styles.scopeHeading, { color: colors.text }]}>Competition Audience</Text>
          <View style={styles.filterRow}>
            {[
              { key: "institution_only", label: "Specific Institution" },
              { key: "open_highschool", label: "Global Schools" },
              { key: "multi_institution", label: "Inter-School (Selected)" }
            ].map((item) => {
              const active = scopeType === item.key;
              return (
                <TouchableOpacity
                  key={item.key}
                  onPress={() => setScopeType(item.key as "institution_only" | "multi_institution" | "open_highschool")}
                  style={[styles.filterChip, { borderColor: active ? "#16A34A" : colors.border, backgroundColor: active ? "#ECFDF3" : colors.surfaceAlt }]}
                >
                  <Text style={[styles.filterText, { color: active ? "#15803D" : colors.textMuted }]}>{item.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={[styles.scopeNote, { color: colors.textMuted }]}>
            {scopeType === "institution_only"
              ? "Only students from your institution can register."
              : scopeType === "open_highschool"
                ? "Any high-school student across institutions can register."
                : "Only students from the schools you list below can register."}
          </Text>

          {scopeType === "multi_institution" ? (
            <View style={styles.filterRow}>
              {institutionChoices.map((item) => {
                const active = allowedInstitutions.includes(item);
                return (
                  <TouchableOpacity
                    key={item}
                    onPress={() =>
                      setAllowedInstitutions((prev) => (active ? prev.filter((x) => x !== item) : [...prev, item]))
                    }
                    style={[styles.filterChip, { borderColor: active ? "#16A34A" : colors.border, backgroundColor: active ? "#ECFDF3" : colors.surfaceAlt }]}
                  >
                    <Text style={[styles.filterText, { color: active ? "#15803D" : colors.textMuted }]}>{item}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : null}
          {scopeType === "institution_only" ? (
            <View style={styles.filterRow}>
              {(institutionChoices.length ? institutionChoices : [user?.institutionName || ""]).filter(Boolean).map((item) => {
                const active = (selectedInstitutionName || user?.institutionName || "") === item;
                return (
                  <TouchableOpacity
                    key={item}
                    onPress={() => setSelectedInstitutionName(item)}
                    style={[styles.filterChip, { borderColor: active ? "#16A34A" : colors.border, backgroundColor: active ? "#ECFDF3" : colors.surfaceAlt }]}
                  >
                    <Text style={[styles.filterText, { color: active ? "#15803D" : colors.textMuted }]}>{item}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : null}

          <Text style={[styles.scopeHeading, { color: colors.text }]}>Class Selection (Optional)</Text>
          <View style={styles.filterRow}>
            {CLASS_OPTIONS.map((item) => {
              const active = classLevelFilter.includes(item);
              return (
                <TouchableOpacity
                  key={item}
                  onPress={() =>
                    setClassLevelFilter((prev) => (active ? prev.filter((x) => x !== item) : [...prev, item]))
                  }
                  style={[styles.filterChip, { borderColor: active ? "#16A34A" : colors.border, backgroundColor: active ? "#ECFDF3" : colors.surfaceAlt }]}
                >
                  <Text style={[styles.filterText, { color: active ? "#15803D" : colors.textMuted }]}>{item}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={[styles.scopeHeading, { color: colors.text }]}>Registration Deadline</Text>
          <View style={styles.row}>
            <View style={styles.inlineSelect}>
              <Text style={[styles.inlineLabel, { color: colors.textMuted }]}>After days</Text>
              <View style={styles.filterRow}>
                {DATE_OFFSET_OPTIONS.map((d) => (
                  <TouchableOpacity key={`reg-${d}`} onPress={() => setRegistrationDateOffset(d)} style={[styles.filterChip, { borderColor: registrationDateOffset === d ? "#16A34A" : colors.border, backgroundColor: registrationDateOffset === d ? "#ECFDF3" : colors.surfaceAlt }]}>
                    <Text style={[styles.filterText, { color: registrationDateOffset === d ? "#15803D" : colors.textMuted }]}>{d}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <View style={styles.inlineSelect}>
              <Text style={[styles.inlineLabel, { color: colors.textMuted }]}>Time</Text>
              <View style={styles.filterRow}>
                {TIME_SLOT_OPTIONS.map((t) => (
                  <TouchableOpacity key={`reg-time-${t}`} onPress={() => setRegistrationTimeSlot(t)} style={[styles.filterChip, { borderColor: registrationTimeSlot === t ? "#16A34A" : colors.border, backgroundColor: registrationTimeSlot === t ? "#ECFDF3" : colors.surfaceAlt }]}>
                    <Text style={[styles.filterText, { color: registrationTimeSlot === t ? "#15803D" : colors.textMuted }]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          <Text style={[styles.scopeHeading, { color: colors.text }]}>Level Schedules</Text>
          <View style={styles.inlineSelect}>
            <Text style={[styles.inlineLabel, { color: colors.textMuted }]}>Level 1</Text>
            <View style={styles.filterRow}>
              {DATE_OFFSET_OPTIONS.map((d) => (
                <TouchableOpacity key={`l1-${d}`} onPress={() => setLevel1DateOffset(d)} style={[styles.filterChip, { borderColor: level1DateOffset === d ? "#16A34A" : colors.border, backgroundColor: level1DateOffset === d ? "#ECFDF3" : colors.surfaceAlt }]}>
                  <Text style={[styles.filterText, { color: level1DateOffset === d ? "#15803D" : colors.textMuted }]}>{d}d</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.filterRow}>
              {TIME_SLOT_OPTIONS.map((t) => (
                <TouchableOpacity key={`l1-time-${t}`} onPress={() => setLevel1TimeSlot(t)} style={[styles.filterChip, { borderColor: level1TimeSlot === t ? "#16A34A" : colors.border, backgroundColor: level1TimeSlot === t ? "#ECFDF3" : colors.surfaceAlt }]}>
                  <Text style={[styles.filterText, { color: level1TimeSlot === t ? "#15803D" : colors.textMuted }]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <View style={styles.inlineSelect}>
            <Text style={[styles.inlineLabel, { color: colors.textMuted }]}>Level 2</Text>
            <View style={styles.filterRow}>
              {DATE_OFFSET_OPTIONS.map((d) => (
                <TouchableOpacity key={`l2-${d}`} onPress={() => setLevel2DateOffset(d)} style={[styles.filterChip, { borderColor: level2DateOffset === d ? "#16A34A" : colors.border, backgroundColor: level2DateOffset === d ? "#ECFDF3" : colors.surfaceAlt }]}>
                  <Text style={[styles.filterText, { color: level2DateOffset === d ? "#15803D" : colors.textMuted }]}>{d}d</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.filterRow}>
              {TIME_SLOT_OPTIONS.map((t) => (
                <TouchableOpacity key={`l2-time-${t}`} onPress={() => setLevel2TimeSlot(t)} style={[styles.filterChip, { borderColor: level2TimeSlot === t ? "#16A34A" : colors.border, backgroundColor: level2TimeSlot === t ? "#ECFDF3" : colors.surfaceAlt }]}>
                  <Text style={[styles.filterText, { color: level2TimeSlot === t ? "#15803D" : colors.textMuted }]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.row}>
            <TextInput
              style={[styles.input, styles.halfInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}
              placeholder="Top N qualify"
              placeholderTextColor={colors.textMuted}
              value={qualificationTopN}
              keyboardType="numeric"
              onChangeText={setQualificationTopN}
            />
            <TextInput
              style={[styles.input, styles.halfInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}
              placeholder="L1 question count"
              placeholderTextColor={colors.textMuted}
              value={level1QuestionCount}
              keyboardType="numeric"
              onChangeText={setLevel1QuestionCount}
            />
          </View>

          <View style={styles.filterRow}>
            {[10, 30].map((item) => {
              const active = level1TimeModeSec === item;
              return (
                <TouchableOpacity
                  key={item}
                  onPress={() => setLevel1TimeModeSec(item as 10 | 30)}
                  style={[styles.filterChip, { borderColor: active ? "#16A34A" : colors.border, backgroundColor: active ? "#ECFDF3" : colors.surfaceAlt }]}
                >
                  <Text style={[styles.filterText, { color: active ? "#15803D" : colors.textMuted }]}>{item}s mode</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <ActionButton label={creating ? "Creating..." : "Create Championship"} icon="sparkles-outline" onPress={createCompetition} />
          <Text style={[styles.helpTitle, { color: colors.text }]}>How this works</Text>
          <Text style={[styles.helpText, { color: colors.textMuted }]}>
            Top N qualify means after Level 1, only the highest N scoring students move to Level 2. Example: Top N = 20 means best 20 students qualify.
          </Text>
          <Text style={[styles.helpText, { color: colors.textMuted }]}>
            Quiz questions are added right after program creation in the next teacher step: Level-1 question set and Level-2 batch question sets (15 each), with manual + AI assist.
          </Text>
        </CommunitySection>
      ) : null}

      <CommunitySection title="Program Filters" subtitle="Challenges do not appear here. They stay in Challenges." icon="options">
        <View style={styles.filterRow}>
          {FILTERS.map((item) => {
            const active = filter === item.key;
            return (
              <TouchableOpacity
                key={item.key}
                onPress={() => setFilter(item.key)}
                style={[styles.filterChip, { borderColor: active ? "#16A34A" : colors.border, backgroundColor: active ? "#ECFDF3" : colors.surfaceAlt }]}
              >
                <Text style={[styles.filterText, { color: active ? "#15803D" : colors.textMuted }]}>{item.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </CommunitySection>

      <CommunitySection title="Championship Programs" subtitle="Cross-institution events with registration, Level-1 qualification, and live Level-2 rounds." icon="trophy">
        {competitions.length ? (
          competitions.map((item) => {
            const scopeLabel =
              item.scopeType === "open_highschool"
                ? "Open High School"
                : item.scopeType === "multi_institution"
                  ? "Multi Institution"
                  : "Institution Only";
            const statusLabel = item.myRegistration?.qualifiedForLevel2
              ? "Qualified L2"
              : item.myRegistration?.status === "registered"
                ? "Registered"
                : item.status === "registration_open"
                  ? "Open"
                  : item.status.replace(/_/g, " ");
            return (
              <AcademicCard
                key={item._id}
                icon="trophy-outline"
                title={item.title}
                meta={`${item.subject}${item.chapter ? ` · ${item.chapter}` : ""} · ${scopeLabel}`}
                note={`Register by ${new Date(item.registrationDeadline).toLocaleString("en-IN")} · L1 ${new Date(item.level1At).toLocaleString("en-IN")}${item.level2At ? ` · L2 ${new Date(item.level2At).toLocaleString("en-IN")}` : ""}`}
                badge={statusLabel}
                badgeTone={item.myRegistration?.qualifiedForLevel2 ? "success" : "primary"}
                actionLabel={item.myRegistration ? "View Status" : "Register"}
                onPress={async () => {
                  if (item.myRegistration) {
                    setSelected({
                      _id: item._id,
                      title: item.title,
                      company: item.institutionName || "ORIN",
                      type: "competition",
                      category: scopeLabel,
                      role: item.subject,
                      duration: item.level2At ? "2 Levels" : "Level 1",
                      description: item.description || "Championship program"
                    });
                    return;
                  }
                  try {
                    await api.post(`/api/network/highschool-competitions/${item._id}/register`, {});
                    await load(true);
                  } catch (e) {
                    setError(getAppErrorMessage(e, "Unable to register right now."));
                  }
                }}
              />
            );
          })
        ) : (
          <AcademicEmpty label="No championship programs are live right now." />
        )}
      </CommunitySection>

      <CommunitySection title="Available Academic Programs" subtitle="Real records from Opportunities API, academically labelled." icon="briefcase">
        {visible.length ? (
          visible.map((item) => {
            const bucket = academicBucket(item);
            return (
              <AcademicCard
                key={item._id || item.title}
                icon={bucket === "scholarship" ? "school-outline" : bucket === "olympiad" ? "medal-outline" : "calendar-outline"}
                title={item.title}
                meta={`${item.category || item.type || FILTERS.find((filterItem) => filterItem.key === bucket)?.label || "Program"}${item.duration ? ` · ${item.duration}` : ""}`}
                note={item.recommendationReason || item.description || `${item.company || "ORIN"}${item.location ? ` · ${item.location}` : ""}`}
                badge={bucket === "all" ? "Program" : FILTERS.find((filterItem) => filterItem.key === bucket)?.label || "Program"}
                badgeTone={bucket === "scholarship" ? "success" : "primary"}
                actionLabel="View Details"
                secondaryLabel={item.applicationUrl || item.url ? "Open Link" : undefined}
                onPress={() => setSelected(item)}
                onSecondaryPress={() => router.push("/community/opportunities" as never)}
              />
            );
          })
        ) : (
          <AcademicEmpty label="No academic programs are live for this filter right now." />
        )}
      </CommunitySection>

      {selected ? (
        <CommunitySection title="Program Detail" subtitle="Use the full after-12 opportunities workflow when application data exists." icon="reader">
          <View style={styles.detailHead}>
            <Text style={[styles.detailTitle, { color: colors.text }]}>{selected.title}</Text>
            <StatusBadge label={FILTERS.find((item) => item.key === academicBucket(selected))?.label || "Program"} tone="success" />
          </View>
          <Text style={[styles.detailMeta, { color: colors.textMuted }]}>
            {[selected.company, selected.role, selected.duration, selected.deadline ? `Deadline ${new Date(selected.deadline).toLocaleDateString("en-IN")}` : ""]
              .filter(Boolean)
              .join(" · ")}
          </Text>
          <Text style={[styles.detailText, { color: colors.textMuted }]}>{selected.description || selected.recommendationReason || "Program details will appear here when the backend provides them."}</Text>
          <ActionButton label="Open Full Opportunities" icon="open-outline" onPress={() => router.push("/community/opportunities" as never)} />
        </CommunitySection>
      ) : null}
    </HighSchoolCommunityShell>
  );
}

const styles = StyleSheet.create({
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  row: { flexDirection: "row", gap: 10 },
  halfInput: { flex: 1 },
  filterRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  scopeHeading: { fontWeight: "900", fontSize: 14 },
  inlineLabel: { fontWeight: "800", fontSize: 12 },
  inlineSelect: { gap: 8 },
  scopeNote: { fontWeight: "700", lineHeight: 19 },
  bannerPicker: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11 },
  bannerPickerText: { fontWeight: "900" },
  bannerPickerMeta: { fontWeight: "700", marginTop: 2 },
  bannerPreview: { width: "100%", height: 140, borderRadius: 12, resizeMode: "cover" },
  helpTitle: { fontWeight: "900", marginTop: 4 },
  helpText: { fontWeight: "700", lineHeight: 19 },
  filterChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  filterText: { fontWeight: "900", fontSize: 12 },
  detailHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  detailTitle: { flex: 1, fontSize: 20, fontWeight: "900" },
  detailMeta: { fontWeight: "800", lineHeight: 20 },
  detailText: { lineHeight: 21, fontWeight: "600" }
});
