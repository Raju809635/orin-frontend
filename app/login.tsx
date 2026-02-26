import React, { useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { notify } from "@/utils/notify";

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin() {
    try {
      setIsSubmitting(true);
      setError(null);
      await login({ email: email.trim().toLowerCase(), password });
      notify("Login successful.");
      router.replace("/" as never);
    } catch (e: any) {
      const message = e?.response?.data?.message || "Login failed. Please check your credentials.";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Login</Text>
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
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={isSubmitting}>
        {isSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Login</Text>}
      </TouchableOpacity>
      <TouchableOpacity onPress={() => router.push("/register" as never)}>
        <Text style={styles.link}>New user? Register</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
