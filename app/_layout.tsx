import "react-native-gesture-handler";
import React, { useEffect } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { Drawer } from "expo-router/drawer";
import { usePathname, useRouter } from "expo-router";
import { AuthProvider, useAuth } from "@/context/AuthContext";

function defaultRouteByRole(role: "student" | "mentor") {
  if (role === "student") return "/student-dashboard";
  return "/mentor-dashboard";
}

function RootDrawer() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated, isBootstrapping } = useAuth();

  useEffect(() => {
    if (isBootstrapping) {
      return;
    }

    const isAuthScreen = pathname === "/login" || pathname === "/register";
    const isProtected =
      pathname.startsWith("/ai-assistant") ||
      pathname.startsWith("/complaints") ||
      pathname.startsWith("/chat") ||
      pathname.startsWith("/collaborate") ||
      pathname.startsWith("/domains") ||
      pathname.startsWith("/mentors") ||
      pathname.startsWith("/mentor/") ||
      pathname.startsWith("/settings") ||
      pathname.startsWith("/student-dashboard") ||
      pathname.startsWith("/mentor-dashboard") ||
      pathname.startsWith("/admin-dashboard");

    if (!isAuthenticated && isProtected) {
      router.replace("/login" as never);
      return;
    }

    if (isAuthenticated && user && isAuthScreen) {
      router.replace(defaultRouteByRole(user.role) as never);
      return;
    }

    if (isAuthenticated && user) {
      if (pathname.startsWith("/mentor-dashboard") && user.role !== "mentor") {
        router.replace(defaultRouteByRole(user.role) as never);
      } else if (pathname.startsWith("/student-dashboard") && user.role !== "student") {
        router.replace(defaultRouteByRole(user.role) as never);
      } else if (pathname.startsWith("/admin-dashboard")) {
        router.replace(defaultRouteByRole(user.role) as never);
      } else if (pathname.startsWith("/mentor-awaiting") || pathname.startsWith("/mentor-pending")) {
        if (user.role !== "mentor" || user.approvalStatus === "approved") {
          router.replace(defaultRouteByRole(user.role) as never);
        }
      }
    }
  }, [isBootstrapping, isAuthenticated, pathname, router, user]);

  if (isBootstrapping) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1F7A4C" />
        <Text style={styles.loadingText}>Loading ORIN...</Text>
      </View>
    );
  }

  return (
    <Drawer
      screenOptions={{
        headerStyle: { backgroundColor: "#1F7A4C" },
        headerTintColor: "#fff",
        drawerActiveTintColor: "#1F7A4C"
      }}
    >
      <Drawer.Screen name="index" options={{ title: "Home", drawerLabel: "Home" }} />
      <Drawer.Screen name="login" options={{ title: "Login", drawerLabel: "Login" }} />
      <Drawer.Screen name="register" options={{ title: "Register", drawerLabel: "Register" }} />
      <Drawer.Screen name="collaborate" options={{ title: "Collaborate", drawerLabel: "Collaborate" }} />
      <Drawer.Screen
        name="chat"
        options={{
          title: "Messages",
          drawerLabel: "Messages",
          drawerItemStyle: user ? undefined : { display: "none" }
        }}
      />
      <Drawer.Screen
        name="ai-assistant"
        options={{
          title: "AI Assistant",
          drawerLabel: "AI Assistant",
          drawerItemStyle: user ? undefined : { display: "none" }
        }}
      />
      <Drawer.Screen
        name="complaints"
        options={{
          title: "Complaints",
          drawerLabel: "Complaints",
          drawerItemStyle: user?.role === "student" ? undefined : { display: "none" }
        }}
      />
      <Drawer.Screen name="domains" options={{ title: "Domains", drawerLabel: "Domains" }} />
      <Drawer.Screen
        name="settings"
        options={{
          title: "Settings",
          drawerLabel: "Settings",
          drawerItemStyle: user ? undefined : { display: "none" }
        }}
      />

      <Drawer.Screen
        name="student-dashboard"
        options={{
          title: "Student Dashboard",
          drawerLabel: "Student Dashboard",
          drawerItemStyle: user?.role === "student" ? undefined : { display: "none" }
        }}
      />
      <Drawer.Screen
        name="student-profile"
        options={{
          title: "Student Profile",
          drawerLabel: "My Profile",
          drawerItemStyle: user?.role === "student" ? undefined : { display: "none" }
        }}
      />
      <Drawer.Screen
        name="mentor-dashboard"
        options={{
          title: "Mentor Dashboard",
          drawerLabel: "Mentor Dashboard",
          drawerItemStyle: user?.role === "mentor" ? undefined : { display: "none" }
        }}
      />
      <Drawer.Screen
        name="mentor-profile"
        options={{
          title: "Mentor Profile",
          drawerLabel: "My Profile",
          drawerItemStyle: user?.role === "mentor" ? undefined : { display: "none" }
        }}
      />
      <Drawer.Screen name="mentors" options={{ title: "Mentors", drawerItemStyle: { display: "none" } }} />
      <Drawer.Screen
        name="mentor/[mentorId]"
        options={{ title: "Mentor Profile", drawerItemStyle: { display: "none" } }}
      />
      <Drawer.Screen name="mentor-pending" options={{ title: "Mentor Pending", drawerItemStyle: { display: "none" } }} />
      <Drawer.Screen
        name="mentor-awaiting"
        options={{ title: "Mentor Awaiting", drawerItemStyle: { display: "none" } }}
      />
      <Drawer.Screen
        name="admin-dashboard"
        options={{ title: "Admin Dashboard", drawerItemStyle: { display: "none" } }}
      />
    </Drawer>
  );
}

export default function Layout() {
  return (
    <AuthProvider>
      <RootDrawer />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: "#F4F9F6",
    alignItems: "center",
    justifyContent: "center"
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#1E2B24"
  }
});
