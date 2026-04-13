import React, { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { Ionicons } from "@expo/vector-icons";

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetForm = useCallback(() => {
    setEmail("");
    setPassword("");
    setShowPassword(false);
    setError(null);
    setIsSubmitting(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      resetForm();
    }, [resetForm])
  );

  async function handleLogin() {
    try {
      setIsSubmitting(true);
      setError(null);
      await login({ email: email.trim().toLowerCase(), password });
      Alert.alert("Login Successful", "Welcome back to ORIN.", [
        {
          text: "Continue",
          onPress: () => {
            resetForm();
            router.replace("/" as never);
          }
        }
      ]);
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
          placeholder="Password"
          placeholderTextColor="#6B7280"
          secureTextEntry={!showPassword}
          autoCorrect={false}
          autoCapitalize="none"
          autoComplete="current-password"
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
  label: {
    color: "#344054",
    fontWeight: "600",
    marginBottom: 6
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
