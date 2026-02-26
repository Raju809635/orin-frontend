import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/context/AuthContext";

export default function HomeScreen() {
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuth();

  const dashboardRoute =
    user?.role === "admin"
      ? "/admin-dashboard"
      : user?.role === "mentor"
        ? "/mentor-dashboard"
        : "/student-dashboard";

  return (
    <View style={styles.container}>
      <Text style={styles.title}>ORIN</Text>
      <Text style={styles.subtitle}>Direction eliminates distraction.</Text>

      {isAuthenticated ? (
        <View style={styles.actions}>
          <TouchableOpacity style={styles.button} onPress={() => router.push(dashboardRoute as never)}>
            <Text style={styles.buttonText}>Open Dashboard</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={() => router.push("/domains")}>
            <Text style={styles.secondaryButtonText}>Find Mentors</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.ghostButton} onPress={logout}>
            <Text style={styles.ghostButtonText}>Logout</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.actions}>
          <TouchableOpacity style={styles.button} onPress={() => router.push("/login" as never)}>
            <Text style={styles.buttonText}>Login</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={() => router.push("/register" as never)}>
            <Text style={styles.secondaryButtonText}>Create Account</Text>
          </TouchableOpacity>
        </View>
      )}
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
  title: {
    fontSize: 42,
    fontWeight: "bold",
    color: "#1F7A4C",
    marginBottom: 20
  },
  subtitle: {
    fontSize: 18,
    textAlign: "center",
    color: "#1E2B24",
    marginBottom: 30
  },
  actions: {
    width: "100%",
    maxWidth: 360
  },
  button: {
    backgroundColor: "#1F7A4C",
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    marginBottom: 12
  },
  buttonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600"
  },
  secondaryButton: {
    borderColor: "#1F7A4C",
    borderWidth: 1.5,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    marginBottom: 12
  },
  secondaryButtonText: {
    color: "#1F7A4C",
    fontSize: 16,
    fontWeight: "600"
  },
  ghostButton: {
    paddingVertical: 12,
    alignItems: "center"
  },
  ghostButtonText: {
    color: "#7A271A",
    fontSize: 14,
    fontWeight: "600"
  }
});
