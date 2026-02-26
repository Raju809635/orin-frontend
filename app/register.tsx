import React, { useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { notify } from "@/utils/notify";

type Role = "student" | "mentor";

export default function RegisterScreen() {
  const router = useRouter();
  const { register } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("student");
  const [domain, setDomain] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRegister() {
    try {
      setIsSubmitting(true);
      setError(null);
      await register({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
        role,
        domain: role === "mentor" ? domain.trim() : undefined
      });
      notify("Registration successful. Please login.");
      router.replace("/login" as never);
    } catch (e: any) {
      const message = e?.response?.data?.message || "Registration failed.";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.heading}>Create Account</Text>
      <TextInput style={styles.input} placeholder="Full name" value={name} onChangeText={setName} />
      <TextInput
        style={styles.input}
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Password (min 8 characters)"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

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
        <TextInput
          style={styles.input}
          placeholder="Mentor domain (e.g. Technology & AI)"
          value={domain}
          onChangeText={setDomain}
        />
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
