import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { Ionicons } from "@expo/vector-icons";
import { LEARNER_ONBOARDING_PENDING_KEY } from "@/lib/learnerExperience";
import { api } from "@/lib/api";
import ClassSectionSelector from "@/components/ClassSectionSelector";

type Role = "student" | "mentor";
type MentorOrgRole = "global_mentor" | "institution_teacher" | "organisation_head";

type InstitutionSearchResult = {
  id: string;
  name: string;
  institutionType: string;
  district?: string;
  state?: string;
  source?: string;
};

const MENTOR_ROLE_OPTIONS: { value: MentorOrgRole; label: string; note: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  {
    value: "global_mentor",
    label: "Global Mentor",
    note: "For after-12 students: public mentorship, sessions, sprints, and career guidance.",
    icon: "globe-outline"
  },
  {
    value: "institution_teacher",
    label: "Global Teacher",
    note: "For high-school students: classes, academic resources, challenges, roadmaps, and reviews.",
    icon: "school-outline"
  }
];

function parseCommaSeparated(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function RegisterScreen() {
  const router = useRouter();
  const { register, login } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<Role>("student");
  const [mentorOrgRole, setMentorOrgRole] = useState<MentorOrgRole>("global_mentor");
  const [institutionQuery, setInstitutionQuery] = useState("");
  const [selectedInstitution, setSelectedInstitution] = useState<InstitutionSearchResult | null>(null);
  const [institutionResults, setInstitutionResults] = useState<InstitutionSearchResult[]>([]);
  const [institutionFocused, setInstitutionFocused] = useState(false);
  const [searchingInstitutions, setSearchingInstitutions] = useState(false);
  const [assignedClassesDraft, setAssignedClassesDraft] = useState("");
  const [assignedClassPick, setAssignedClassPick] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetForm = useCallback(() => {
    setName("");
    setEmail("");
    setPhoneNumber("");
    setPassword("");
    setShowPassword(false);
    setRole("student");
    setMentorOrgRole("global_mentor");
    setInstitutionQuery("");
    setSelectedInstitution(null);
    setInstitutionResults([]);
    setInstitutionFocused(false);
    setAssignedClassesDraft("");
    setAssignedClassPick("");
    setError(null);
    setIsSubmitting(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      resetForm();
    }, [resetForm])
  );

  useEffect(() => {
    if (role !== "mentor" || mentorOrgRole === "global_mentor" || !institutionFocused) {
      setInstitutionResults([]);
      setSearchingInstitutions(false);
      return;
    }

    const query = institutionQuery.trim();
    if (query.length < 2) {
      setInstitutionResults([]);
      setSearchingInstitutions(false);
      return;
    }

    let active = true;
    const timer = setTimeout(async () => {
      try {
        setSearchingInstitutions(true);
        const { data } = await api.get("/api/auth/institutions/search", {
          params: { q: query, limit: 8 }
        });
        if (active) {
          setInstitutionResults(Array.isArray(data?.results) ? data.results : []);
        }
      } catch {
        if (active) setInstitutionResults([]);
      } finally {
        if (active) setSearchingInstitutions(false);
      }
    }, 250);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [institutionFocused, institutionQuery, mentorOrgRole, role]);

  async function handleRegister() {
    const normalizedPhone = phoneNumber.trim();
    const normalizedEmail = email.trim().toLowerCase();
    if (role === "mentor" && normalizedPhone.length < 8) {
      setError("Phone number is required for mentor signup.");
      return;
    }
    if (role === "mentor" && mentorOrgRole !== "global_mentor" && !selectedInstitution?.name) {
      setError("Please select your institution from the list.");
      return;
    }
    const selectedAssignedClasses = [
      ...parseCommaSeparated(assignedClassesDraft),
      ...(assignedClassPick.trim() ? [assignedClassPick.trim()] : [])
    ].filter((item, index, arr) => arr.indexOf(item) === index);
    if (role === "mentor" && mentorOrgRole === "institution_teacher" && selectedAssignedClasses.length === 0) {
      setError("Please add at least one assigned class.");
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      const response = await register({
        name: name.trim(),
        email: normalizedEmail,
        password,
        role,
        phoneNumber: role === "mentor" ? normalizedPhone : "",
        mentorOrgRole: role === "mentor" ? mentorOrgRole : undefined,
        institutionName: role === "mentor" && selectedInstitution ? selectedInstitution.name : "",
        institutionType: role === "mentor" && selectedInstitution ? selectedInstitution.institutionType : "",
        institutionDistrict: role === "mentor" && selectedInstitution ? selectedInstitution.district || "" : "",
        institutionSource: role === "mentor" && selectedInstitution ? selectedInstitution.source || "" : "",
        assignedClasses: role === "mentor" ? selectedAssignedClasses : []
      });
      if (!response) {
        throw new Error("Registration failed");
      }

      if (response.requiresEmailVerification) {
        resetForm();
        router.replace(`/verify-email?role=${role}` as never);
        return;
      }

      resetForm();
      if (role === "student") {
        // Auto-login so new students land in setup first, then Home (Android requirement).
        await login({ email: normalizedEmail, password });
        await AsyncStorage.setItem(LEARNER_ONBOARDING_PENDING_KEY, "1");
        router.replace("/learner-onboarding?new=1" as never);
      } else {
        router.replace(`/mentor-awaiting?mode=${mentorOrgRole}` as never);
      }
    } catch (e: any) {
      const rawMessage = e?.response?.data?.message || e?.message || "Registration failed.";
      const message =
        rawMessage.includes("duplicate key") || rawMessage.includes("User already exists")
          ? "An account with this email already exists. Try login or use a different email."
          : rawMessage;
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.heading}>Create Account</Text>
      <Text style={styles.label}>Full Name</Text>
      <TextInput
        style={styles.input}
        placeholder="Full name"
        placeholderTextColor="#6B7280"
        value={name}
        onChangeText={setName}
      />
      <Text style={styles.label}>Email</Text>
      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor="#6B7280"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <Text style={styles.label}>Password</Text>
      <View style={styles.passwordWrap}>
        <TextInput
          style={styles.passwordInput}
          placeholder="Password (min 8 characters)"
          placeholderTextColor="#6B7280"
          secureTextEntry={!showPassword}
          autoCorrect={false}
          autoCapitalize="none"
          autoComplete="new-password"
          keyboardType={Platform.OS === "android" && showPassword ? "visible-password" : "default"}
          selectionColor="#1F7A4C"
          cursorColor="#1F7A4C"
          value={password}
          onChangeText={setPassword}
        />
        <TouchableOpacity onPress={() => setShowPassword((v) => !v)} style={styles.eyeButton}>
          <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color="#0B3D2E" />
        </TouchableOpacity>
      </View>

      <Text style={styles.label}>Role</Text>
      <View style={styles.roleRow}>
        <TouchableOpacity
          style={[styles.roleButton, role === "student" && styles.roleButtonActive]}
          onPress={() => setRole("student")}
        >
          <Text style={[styles.roleButtonText, role === "student" && styles.roleButtonTextActive]}>
            Student
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.roleButton, role === "mentor" && styles.roleButtonActive]}
          onPress={() => setRole("mentor")}
        >
          <Text style={[styles.roleButtonText, role === "mentor" && styles.roleButtonTextActive]}>
            Mentor
          </Text>
        </TouchableOpacity>
      </View>

      {role === "mentor" ? (
        <>
          <Text style={styles.label}>Mentor Type</Text>
          <View style={styles.mentorRoleStack}>
            {MENTOR_ROLE_OPTIONS.map((item) => {
              const active = mentorOrgRole === item.value;
              return (
                <TouchableOpacity
                  key={item.value}
                  style={[styles.mentorRoleCard, active && styles.mentorRoleCardActive]}
                  onPress={() => {
                    setMentorOrgRole(item.value);
                  if (item.value === "global_mentor") {
                    setInstitutionQuery("");
                    setSelectedInstitution(null);
                    setInstitutionResults([]);
                    setAssignedClassesDraft("");
                    setAssignedClassPick("");
                  }
                  }}
                >
                  <View style={styles.mentorRoleHeader}>
                    <Ionicons name={item.icon} size={22} color={active ? "#0B3D2E" : "#667085"} />
                    <Text style={[styles.mentorRoleTitle, active && styles.mentorRoleTitleActive]}>{item.label}</Text>
                  </View>
                  <Text style={styles.mentorRoleNote}>{item.note}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.label}>Phone Number</Text>
          <TextInput
            style={styles.input}
            placeholder="Mentor phone number"
            placeholderTextColor="#6B7280"
            keyboardType="phone-pad"
            value={phoneNumber}
            onChangeText={setPhoneNumber}
          />
          {mentorOrgRole !== "global_mentor" ? (
            <>
              <Text style={styles.label}>Institution</Text>
              <TextInput
                style={styles.input}
                placeholder="Search and select your school / institution"
                placeholderTextColor="#6B7280"
                value={institutionQuery}
                onFocus={() => setInstitutionFocused(true)}
                onChangeText={(value) => {
                  setInstitutionQuery(value);
                  setSelectedInstitution(null);
                  setInstitutionFocused(true);
                }}
              />
              {searchingInstitutions ? <ActivityIndicator size="small" color="#1F7A4C" style={styles.searchLoader} /> : null}
              {institutionFocused && institutionResults.length > 0 ? (
                <View style={styles.suggestionBox}>
                  {institutionResults.map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      style={styles.suggestionItem}
                      onPress={() => {
                        setSelectedInstitution(item);
                        setInstitutionQuery(item.name);
                        setInstitutionResults([]);
                        setInstitutionFocused(false);
                      }}
                    >
                      <Text style={styles.suggestionTitle}>{item.name}</Text>
                      <Text style={styles.suggestionMeta}>
                        {[item.institutionType, item.district, item.state].filter(Boolean).join(" | ")}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : null}
              {institutionFocused && !searchingInstitutions && institutionQuery.trim().length >= 2 && institutionResults.length === 0 ? (
                <Text style={styles.smallHint}>No match yet. Select from suggestions when your institution appears.</Text>
              ) : null}
              {selectedInstitution ? (
                <Text style={styles.smallHint}>Selected: {selectedInstitution.name}</Text>
              ) : null}
            </>
          ) : null}

          {mentorOrgRole !== "global_mentor" ? (
            <>
              <Text style={styles.label}>Assigned Classes</Text>
              <ClassSectionSelector value={assignedClassPick} onChange={setAssignedClassPick} />
              <TouchableOpacity
                style={[styles.classAddButton, !assignedClassPick && styles.classAddButtonDisabled]}
                disabled={!assignedClassPick}
                onPress={() => {
                  const nextClass = assignedClassPick.trim();
                  if (!nextClass) return;
                  const existing = parseCommaSeparated(assignedClassesDraft);
                  if (!existing.includes(nextClass)) {
                    setAssignedClassesDraft([...existing, nextClass].join(", "));
                  }
                  setAssignedClassPick("");
                }}
              >
                <Text style={styles.classAddButtonText}>Add Class</Text>
              </TouchableOpacity>
              <View style={styles.classChipWrap}>
                {parseCommaSeparated(assignedClassesDraft).map((item) => (
                  <TouchableOpacity
                    key={item}
                    style={styles.classChip}
                    onPress={() => setAssignedClassesDraft(parseCommaSeparated(assignedClassesDraft).filter((classItem) => classItem !== item).join(", "))}
                  >
                    <Text style={styles.classChipText}>{item} x</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          ) : null}

          <View style={styles.infoCard}>
            <Text style={styles.infoText}>
              Mentor registrations are reviewed by admin. Your selected mode decides which dashboard tools unlock after approval.
            </Text>
          </View>
        </>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <TouchableOpacity style={styles.button} onPress={handleRegister} disabled={isSubmitting}>
        {isSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Register</Text>}
      </TouchableOpacity>
      <TouchableOpacity onPress={() => router.push("/login" as never)}>
        <Text style={styles.link}>Already have an account? Login</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: "#F4F9F6",
    padding: 20,
    justifyContent: "center"
  },
  heading: {
    fontSize: 28,
    fontWeight: "700",
    color: "#1E2B24",
    marginBottom: 16
  },
  input: {
    backgroundColor: "#FFF",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    marginBottom: 12,
    borderColor: "#D0D5DD",
    borderWidth: 1
  },
  label: {
    color: "#344054",
    fontWeight: "600",
    marginBottom: 8
  },
  roleRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 14
  },
  roleButton: {
    borderWidth: 1,
    borderColor: "#D0D5DD",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  roleButtonActive: {
    borderColor: "#1F7A4C",
    backgroundColor: "#E8F5EE"
  },
  roleButtonText: {
    color: "#344054",
    fontWeight: "600"
  },
  roleButtonTextActive: {
    color: "#1F7A4C"
  },
  mentorRoleStack: {
    gap: 10,
    marginBottom: 14
  },
  mentorRoleCard: {
    backgroundColor: "#FFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#D0D5DD",
    padding: 12
  },
  mentorRoleCardActive: {
    borderColor: "#1F7A4C",
    backgroundColor: "#E8F5EE"
  },
  mentorRoleHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4
  },
  mentorRoleTitle: {
    color: "#344054",
    fontWeight: "800"
  },
  mentorRoleTitleActive: {
    color: "#0B3D2E"
  },
  mentorRoleNote: {
    color: "#667085",
    lineHeight: 19
  },
  searchLoader: {
    alignSelf: "flex-start",
    marginBottom: 8
  },
  suggestionBox: {
    marginTop: -6,
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#D0D5DD",
    backgroundColor: "#FFF",
    overflow: "hidden"
  },
  suggestionItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#EAECF0"
  },
  suggestionTitle: {
    color: "#1E2B24",
    fontWeight: "700"
  },
  suggestionMeta: {
    color: "#667085",
    marginTop: 2
  },
  smallHint: {
    color: "#667085",
    marginTop: -4,
    marginBottom: 10,
    lineHeight: 19
  },
  classAddButton: {
    alignSelf: "flex-start",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#1F7A4C",
    backgroundColor: "#E8F5EE",
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 10
  },
  classAddButtonDisabled: {
    opacity: 0.6
  },
  classAddButtonText: {
    color: "#1F7A4C",
    fontWeight: "800"
  },
  classChipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12
  },
  classChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#1F7A4C",
    backgroundColor: "#E8F5EE",
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  classChipText: {
    color: "#1F7A4C",
    fontWeight: "800"
  },
  infoCard: {
    marginBottom: 12,
    padding: 12,
    borderRadius: 10,
    backgroundColor: "#EEF7F2",
    borderWidth: 1,
    borderColor: "#CFE4D8"
  },
  infoText: {
    color: "#0B3D2E",
    fontWeight: "600",
    lineHeight: 20
  },
  passwordWrap: {
    backgroundColor: "#FFF",
    borderRadius: 12,
    borderColor: "#D0D5DD",
    borderWidth: 1,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center"
  },
  passwordInput: {
    flex: 1,
    color: "#1E2B24",
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 13
  },
  eyeButton: {
    paddingHorizontal: 12
  },
  button: {
    backgroundColor: "#1F7A4C",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 4
  },
  buttonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16
  },
  link: {
    marginTop: 14,
    color: "#1F7A4C",
    fontWeight: "600",
    textAlign: "center"
  },
  error: {
    color: "#B42318",
    marginBottom: 10
  }
});
