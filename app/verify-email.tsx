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
  const params = useLocalSearchParams<{ email?: string; role?: "student" | "mentor" }>();
  const initialEmail = useMemo(() => (params.email ? String(params.email) : ""), [params.email]);
  const initialRole = useMemo(() => (params.role ? String(params.role) : ""), [params.role]);

  const [email, setEmail] = useState(initialEmail);
  const [otp, setOtp] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function verifyOtp() {
    try {
      setIsSubmitting(true);
      setError(null);
      const { data } = await api.post<VerifyResponse>("/api/auth/verify-email-otp", {
        email: email.trim().toLowerCase(),
        otp: otp.trim()
      });

      notify(data?.message || "Email verified successfully.");
      const role = data?.role || initialRole;
      if (role === "mentor") {
        router.replace("/mentor-awaiting" as never);
      } else {
        router.replace("/login" as never);
      }
    } catch (e: any) {
      setError(e?.response?.data?.message || "OTP verification failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function resendOtp() {
    try {
      setIsResending(true);
      setError(null);
      const { data } = await api.post<{ message: string }>("/api/auth/resend-email-otp", {
        email: email.trim().toLowerCase()
      });
      notify(data?.message || "OTP resent.");
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to resend OTP.");
    } finally {
      setIsResending(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Verify Your Email</Text>
        <Text style={styles.subtitle}>
          Enter the 6-digit OTP sent to your email. Verification is required for signup privacy and account security.
        </Text>

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

        <Text style={styles.label}>OTP</Text>
        <TextInput
          style={styles.input}
          placeholder="6-digit OTP"
          placeholderTextColor="#6B7280"
          keyboardType="number-pad"
          value={otp}
          onChangeText={setOtp}
          maxLength={6}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity style={styles.buttonPrimary} onPress={verifyOtp} disabled={isSubmitting}>
          {isSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonPrimaryText}>Verify OTP</Text>}
        </TouchableOpacity>

        <TouchableOpacity style={styles.buttonSecondary} onPress={resendOtp} disabled={isResending}>
          {isResending ? <ActivityIndicator color="#1F7A4C" /> : <Text style={styles.buttonSecondaryText}>Resend OTP</Text>}
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
