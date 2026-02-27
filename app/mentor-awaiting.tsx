import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";

export default function MentorAwaitingScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Waiting for Admin Approval</Text>
        <Text style={styles.body}>
          Your mentor registration is submitted successfully. Please login later after admin approval to access mentor
          dashboard and profile editing.
        </Text>
        <TouchableOpacity style={styles.button} onPress={() => router.replace("/login" as never)}>
          <Text style={styles.buttonText}>Go to Login</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F4F9F6", alignItems: "center", justifyContent: "center", padding: 20 },
  card: { width: "100%", maxWidth: 420, backgroundColor: "#fff", borderRadius: 16, borderWidth: 1, borderColor: "#D3E4DB", padding: 18 },
  title: { fontSize: 24, fontWeight: "700", color: "#0B3D2E", marginBottom: 8 },
  body: { color: "#344054", lineHeight: 22 },
  button: { marginTop: 16, backgroundColor: "#0B3D2E", borderRadius: 12, alignItems: "center", paddingVertical: 12 },
  buttonText: { color: "#fff", fontWeight: "700" }
});

