import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useAuth } from "@/context/AuthContext";

export default function MentorPendingScreen() {
  const { logout } = useAuth();

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Waiting for Admin Approval</Text>
        <Text style={styles.body}>
          Your mentor account is currently under review. You will get full mentor dashboard and profile access once
          admin approves your account.
        </Text>
        <TouchableOpacity style={styles.button} onPress={logout}>
          <Text style={styles.buttonText}>Logout</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F4F9F6", alignItems: "center", justifyContent: "center", padding: 20 },
  card: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#D0E2D9",
    borderRadius: 16,
    padding: 18
  },
  title: { fontSize: 24, fontWeight: "700", color: "#0B3D2E", marginBottom: 10 },
  body: { color: "#344054", lineHeight: 22 },
  button: { marginTop: 16, backgroundColor: "#0B3D2E", paddingVertical: 12, borderRadius: 12, alignItems: "center" },
  buttonText: { color: "#fff", fontWeight: "700" }
});

