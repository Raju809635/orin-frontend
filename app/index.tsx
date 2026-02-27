import React, { useEffect, useRef } from "react";
import { Animated, Dimensions, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { LinearGradient } from "expo-linear-gradient";

const { width } = Dimensions.get("window");

export default function HomeScreen() {
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuth();
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.18,
          duration: 4200,
          useNativeDriver: true
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 4200,
          useNativeDriver: true
        })
      ])
    ).start();
  }, [scaleAnim]);

  const dashboardRoute =
    user?.role === "admin"
      ? "/admin-dashboard"
      : user?.role === "mentor"
        ? "/mentor-dashboard"
        : "/student-dashboard";

  return (
    <View style={styles.container}>
      <LinearGradient colors={["#E6F6EE", "#F8FCFA", "#FFFFFF"]} style={StyleSheet.absoluteFillObject} />
      <Animated.View style={[styles.glow, { transform: [{ scale: scaleAnim }] }]} />

      <View style={styles.heroCard}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20
  },
  glow: {
    position: "absolute",
    width: 520,
    height: 520,
    borderRadius: 260,
    backgroundColor: "rgba(12, 126, 80, 0.18)"
  },
  heroCard: {
    width: "100%",
    maxWidth: 430,
    borderRadius: 24,
    padding: 24,
    backgroundColor: "rgba(255,255,255,0.9)",
    borderWidth: 1,
    borderColor: "#D4E9DF",
    shadowColor: "#0B3D2E",
    shadowOpacity: 0.14,
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 22,
    elevation: 8
  },
  title: {
    fontSize: 48,
    letterSpacing: 6,
    fontWeight: "700",
    textAlign: "center",
    color: "#0B3D2E",
    marginBottom: 10
  },
  subtitle: {
    fontSize: 18,
    textAlign: "center",
    color: "#264D3F",
    marginBottom: 26
  },
  actions: {
    width: "100%",
    maxWidth: width * 0.9
  },
  button: {
    backgroundColor: "#0B3D2E",
    paddingVertical: 14,
    borderRadius: 40,
    alignItems: "center",
    marginBottom: 12
  },
  buttonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600"
  },
  secondaryButton: {
    borderColor: "#0B3D2E",
    borderWidth: 2,
    paddingVertical: 14,
    borderRadius: 40,
    alignItems: "center",
    marginBottom: 12
  },
  secondaryButtonText: {
    color: "#0B3D2E",
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
