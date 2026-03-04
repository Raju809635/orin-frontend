import React, { useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { api } from "@/lib/api";
import { notify } from "@/utils/notify";

type VerifyResponse = {
  message: string;
  role?: "student" | "mentor";
};

export default function VerifyEmailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ role?: "student" | "mentor" }>();
  const initialRole = useMemo(() => (params.role ? String(params.role) : ""), [params.role]);
  const [isContinuing, setIsContinuing] = useState(false);

  async function continueToLogin() {
    try {
      setIsContinuing(true);
      const { data } = await api.post<VerifyResponse>("/api/auth/resend-email-otp", { email: "not-required@orin.app" });
      notify(data?.message || "Email verification is not required.");
    } catch {
      // no-op
    } finally {
      setIsContinuing(false);
      if (initialRole === "mentor") router.replace("/mentor-awaiting" as never);
      else router.replace("/login" as never);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Verify Your Email</Text>
        <Text style={styles.subtitle}>
          Email OTP verification is currently disabled. Continue to login directly.
        </Text>

        <TouchableOpacity style={styles.buttonPrimary} onPress={continueToLogin} disabled={isContinuing}>
          {isContinuing ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonPrimaryText}>Continue</Text>}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.replace("/login" as never)}>
          <Text style={styles.link}>Back to Login</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F4F9F6",
    alignItems: "center",
    justifyContent: "center",
    padding: 20
  },
  card: {
    width: "100%",
    maxWidth: 440,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#D3E4DB",
    padding: 18
  },
  title: { fontSize: 26, fontWeight: "800", color: "#13251E" },
  subtitle: { marginTop: 6, color: "#475467", lineHeight: 20 },
  label: { marginTop: 12, marginBottom: 6, color: "#344054", fontWeight: "600" },
  input: {
    backgroundColor: "#FFF",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderColor: "#D0D5DD",
    borderWidth: 1
  },
  buttonPrimary: {
    marginTop: 14,
    backgroundColor: "#1F7A4C",
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center"
  },
  buttonPrimaryText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  buttonSecondary: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#1F7A4C",
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
    backgroundColor: "#E8F5EE"
  },
  buttonSecondaryText: { color: "#1F7A4C", fontWeight: "700", fontSize: 15 },
  link: { marginTop: 13, textAlign: "center", color: "#1F7A4C", fontWeight: "600" },
  error: { color: "#B42318", marginTop: 10 }
});
