import "react-native-gesture-handler";
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, AppState, AppStateStatus, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Drawer } from "expo-router/drawer";
import { useGlobalSearchParams, usePathname, useRouter } from "expo-router";
import { DrawerContentScrollView, DrawerItem, DrawerContentComponentProps } from "@react-navigation/drawer";
import { Ionicons } from "@expo/vector-icons";
import { AuthProvider, useAuth } from "@/context/AuthContext";

function defaultRouteByRole(role: "student" | "mentor") {
  if (role === "student") return "/student-dashboard";
  return "/mentor-dashboard";
}

function homeRouteForUser(user: { role: "student" | "mentor"; approvalStatus?: "pending" | "approved" | "rejected" }) {
  if (user.role === "mentor" && user.approvalStatus !== "approved") {
    return "/mentor-pending";
  }
  return defaultRouteByRole(user.role);
}

function RootDrawer() {
  const router = useRouter();
  const pathname = usePathname();
  const globalParams = useGlobalSearchParams<{ section?: string }>();
  const { user, isAuthenticated, isBootstrapping } = useAuth();
  const [mainOpen, setMainOpen] = useState(true);
  const [toolsOpen, setToolsOpen] = useState(false);
  const isCheckingUpdateRef = useRef(false);
  const hasPromptedReloadRef = useRef(false);

  useEffect(() => {
    if (isBootstrapping) {
      return;
    }

    const isAuthScreen = pathname === "/login" || pathname === "/register" || pathname === "/verify-email";
    const isProtected =
      pathname.startsWith("/ai-assistant") ||
      pathname.startsWith("/complaints") ||
      pathname.startsWith("/chat") ||
      pathname.startsWith("/collaborate") ||
      pathname.startsWith("/domains") ||
      pathname.startsWith("/about") ||
      pathname.startsWith("/privacy") ||
      pathname.startsWith("/terms") ||
      pathname.startsWith("/help") ||
      pathname.startsWith("/mentors") ||
      pathname.startsWith("/mentor/") ||
      pathname.startsWith("/settings") ||
      pathname.startsWith("/notifications") ||
      pathname.startsWith("/my-profile") ||
      pathname.startsWith("/student-dashboard") ||
      pathname.startsWith("/mentor-dashboard") ||
      pathname.startsWith("/admin-dashboard") ||
      pathname.startsWith("/network");

    if (!isAuthenticated && isProtected) {
      router.replace("/login" as never);
      return;
    }

    if (isAuthenticated && user && isAuthScreen) {
      router.replace(homeRouteForUser(user) as never);
      return;
    }

    if (isAuthenticated && user) {
      if (pathname.startsWith("/mentor-dashboard") && user.role !== "mentor") {
        router.replace(homeRouteForUser(user) as never);
      } else if (pathname.startsWith("/student-dashboard") && user.role !== "student") {
        router.replace(homeRouteForUser(user) as never);
      } else if (pathname.startsWith("/admin-dashboard")) {
        router.replace(homeRouteForUser(user) as never);
      } else if (pathname.startsWith("/mentor-awaiting") || pathname.startsWith("/mentor-pending")) {
        if (user.role !== "mentor" || user.approvalStatus === "approved") {
          router.replace(homeRouteForUser(user) as never);
        }
      }
    }
  }, [isBootstrapping, isAuthenticated, pathname, router, user]);

  useEffect(() => {
    if (__DEV__ || Platform.OS === "web") {
      return;
    }

    async function checkForUpdates() {
      if (isCheckingUpdateRef.current || hasPromptedReloadRef.current) {
        return;
      }

      try {
        isCheckingUpdateRef.current = true;
        const Updates = await import("expo-updates");
        const update = await Updates.checkForUpdateAsync();

        if (!update.isAvailable) {
          return;
        }

        await Updates.fetchUpdateAsync();
        hasPromptedReloadRef.current = true;

        Alert.alert("Update Available", "A new update is ready. Restart now?", [
          {
            text: "Later",
            style: "cancel",
            onPress: () => {
              hasPromptedReloadRef.current = false;
            }
          },
          {
            text: "Restart",
            onPress: () => {
              Updates.reloadAsync().catch(() => {
                hasPromptedReloadRef.current = false;
              });
            }
          }
        ]);
      } catch {
        // Ignore OTA check failures silently to avoid blocking app usage.
      } finally {
        isCheckingUpdateRef.current = false;
      }
    }

    checkForUpdates();

    const sub = AppState.addEventListener("change", (nextState: AppStateStatus) => {
      if (nextState === "active") {
        checkForUpdates();
      }
    });

    return () => {
      sub.remove();
    };
  }, []);

  if (isBootstrapping) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1F7A4C" />
        <Text style={styles.loadingText}>Loading ORIN...</Text>
      </View>
    );
  }

  function renderDrawerContent(props: DrawerContentComponentProps) {
    return (
      <DrawerContentScrollView {...props} contentContainerStyle={styles.drawerContent}>
        {user ? (
          <View style={styles.drawerProfileCard}>
            <Text style={styles.drawerProfileName}>{user.name || "ORIN User"}</Text>
            <Text style={styles.drawerProfileRole}>{user.role === "mentor" ? "Mentor" : "Student"}</Text>
            <TouchableOpacity
              onPress={() => router.push("/my-profile" as never)}
            >
            <Text style={styles.drawerProfileLink}>View Profile</Text>
            </TouchableOpacity>
          </View>
        ) : null}
        <TouchableOpacity style={styles.drawerGroupHeader} onPress={() => setMainOpen((prev) => !prev)}>
          <Text style={styles.drawerSectionTitle}>Main</Text>
          <Ionicons name={mainOpen ? "chevron-up" : "chevron-down"} size={16} color="#475467" />
        </TouchableOpacity>
        {mainOpen ? (
          <View style={styles.drawerSubList}>
            {user?.role === "mentor" ? (
              <>
                <DrawerItem label="Mentor Home" onPress={() => router.push("/mentor-dashboard?section=overview" as never)} />
                <DrawerItem label="Session Requests" onPress={() => router.push("/mentor-dashboard?section=requests" as never)} />
                <DrawerItem label="Sessions" onPress={() => router.push("/mentor-dashboard?section=sessions" as never)} />
                <DrawerItem label="Availability" onPress={() => router.push("/mentor-dashboard?section=availability" as never)} />
              </>
            ) : (
              <>
                <DrawerItem label="Student Home" onPress={() => router.push("/student-dashboard?section=overview" as never)} />
                <DrawerItem label="Career Growth" onPress={() => router.push("/student-dashboard?section=growth" as never)} />
                <DrawerItem label="My Sessions" onPress={() => router.push("/student-dashboard?section=sessions" as never)} />
                <DrawerItem label="Network Hub" onPress={() => router.push("/network?section=feed" as never)} />
              </>
            )}
          </View>
        ) : null}

        <TouchableOpacity style={styles.drawerGroupHeader} onPress={() => setToolsOpen((prev) => !prev)}>
          <Text style={styles.drawerSectionTitle}>Tools</Text>
          <Ionicons name={toolsOpen ? "chevron-up" : "chevron-down"} size={16} color="#475467" />
        </TouchableOpacity>
        {toolsOpen ? (
          <View style={styles.drawerSubList}>
            <DrawerItem label="My Profile" onPress={() => router.push("/my-profile" as never)} />
            <DrawerItem label="AI Assistant" onPress={() => router.push("/ai-assistant" as never)} />
            <DrawerItem label="Domain Guide" onPress={() => router.push("/domain-guide" as never)} />
            <DrawerItem label="Posts" onPress={() => router.push("/posts" as never)} />
            <DrawerItem label="Messages" onPress={() => router.push("/chat" as never)} />
            <DrawerItem label="Notifications" onPress={() => router.push("/notifications" as never)} />
            {user?.role === "student" ? <DrawerItem label="Complaints" onPress={() => router.push("/complaints" as never)} /> : null}
            <DrawerItem label="Settings" onPress={() => router.push("/settings" as never)} />
          </View>
        ) : null}
      </DrawerContentScrollView>
    );
  }

  function showBottomNav() {
    if (!isAuthenticated || !user) return false;
    if (pathname === "/login" || pathname === "/register" || pathname === "/verify-email") return false;
    if (pathname === "/mentor-awaiting" || pathname === "/mentor-pending") return false;
    return true;
  }

  const currentMentorSection = String(globalParams.section || "overview");

  const studentTabs = [
    { key: "profile", label: "My Profile", icon: "person-circle", path: "/my-profile" },
    { key: "domains", label: "Domains", icon: "grid", path: "/domains" },
    { key: "dashboard", label: "Dashboard", icon: "speedometer", path: "/student-dashboard" },
    { key: "network", label: "Network", icon: "people", path: "/network" },
    { key: "posts", label: "Posts", icon: "newspaper", path: "/posts" }
  ] as const;

  const mentorTabs = [
    { key: "profile", label: "My Profile", icon: "person-circle", path: "/my-profile" },
    { key: "requests", label: "Requests", icon: "list", path: "/mentor-dashboard?section=requests" },
    { key: "sessions", label: "Sessions", icon: "videocam", path: "/mentor-dashboard?section=sessions" },
    { key: "network", label: "Network", icon: "people", path: "/network" },
    { key: "posts", label: "Posts", icon: "newspaper", path: "/posts" }
  ] as const;

  const tabs = user?.role === "mentor" ? mentorTabs : studentTabs;
  const isTabActive = (tabKey: string, path: string) => {
    if (path === "/") return pathname === "/";
    if (tabKey === "requests") return pathname.startsWith("/mentor-dashboard") && currentMentorSection === "requests";
    if (tabKey === "sessions") return pathname.startsWith("/mentor-dashboard") && currentMentorSection === "sessions";
    if (path.startsWith("/mentor-dashboard")) return pathname.startsWith("/mentor-dashboard");
    return pathname.startsWith(path);
  };

  return (
    <View style={styles.appRoot}>
      <View style={styles.contentArea}>
        <Drawer
          drawerContent={renderDrawerContent}
          screenOptions={{
            headerStyle: { backgroundColor: "#1F7A4C" },
            headerTintColor: "#fff",
            drawerActiveTintColor: "#1F7A4C"
          }}
        >
          <Drawer.Screen name="index" options={{ title: "Home", drawerItemStyle: { display: "none" } }} />
          <Drawer.Screen name="login" options={{ title: "Login", drawerItemStyle: { display: "none" } }} />
          <Drawer.Screen name="register" options={{ title: "Register", drawerItemStyle: { display: "none" } }} />
          <Drawer.Screen name="verify-email" options={{ title: "Verify Email", drawerItemStyle: { display: "none" } }} />
          <Drawer.Screen name="collaborate" options={{ title: "Collaborate", drawerItemStyle: { display: "none" } }} />
          <Drawer.Screen name="chat" options={{ title: "Messages", drawerItemStyle: { display: "none" } }} />
          <Drawer.Screen name="ai-assistant" options={{ title: "AI Assistant", drawerItemStyle: { display: "none" } }} />
          <Drawer.Screen name="complaints" options={{ title: "Complaints", drawerItemStyle: { display: "none" } }} />
          <Drawer.Screen name="domains" options={{ title: "Domains", drawerItemStyle: { display: "none" } }} />
          <Drawer.Screen name="domain-guide" options={{ title: "Domain Guide", drawerItemStyle: { display: "none" } }} />
          <Drawer.Screen name="about" options={{ title: "About ORIN", drawerItemStyle: { display: "none" } }} />
          <Drawer.Screen name="privacy" options={{ title: "Privacy Policy", drawerItemStyle: { display: "none" } }} />
          <Drawer.Screen name="terms" options={{ title: "Terms of Use", drawerItemStyle: { display: "none" } }} />
          <Drawer.Screen name="help" options={{ title: "Help & Support", drawerItemStyle: { display: "none" } }} />
          <Drawer.Screen name="settings" options={{ title: "Settings", drawerItemStyle: { display: "none" } }} />
          <Drawer.Screen name="notifications" options={{ title: "Notifications", drawerItemStyle: { display: "none" } }} />
          <Drawer.Screen name="student-dashboard" options={{ title: "Student Dashboard", drawerItemStyle: { display: "none" } }} />
          <Drawer.Screen name="my-profile" options={{ title: "My Profile", drawerItemStyle: { display: "none" } }} />
          <Drawer.Screen name="student-profile" options={{ title: "My Profile", drawerItemStyle: { display: "none" } }} />
          <Drawer.Screen name="mentor-dashboard" options={{ title: "Mentor Dashboard", drawerItemStyle: { display: "none" } }} />
          <Drawer.Screen name="mentor-profile" options={{ title: "My Profile", drawerItemStyle: { display: "none" } }} />
          <Drawer.Screen name="mentor-policy" options={{ title: "Mentor Policy", drawerItemStyle: { display: "none" } }} />
          <Drawer.Screen name="mentors" options={{ title: "Mentors", drawerItemStyle: { display: "none" } }} />
          <Drawer.Screen name="mentor/[mentorId]" options={{ title: "Mentor Profile", drawerItemStyle: { display: "none" } }} />
          <Drawer.Screen name="mentor-pending" options={{ title: "Mentor Pending", drawerItemStyle: { display: "none" } }} />
          <Drawer.Screen name="mentor-awaiting" options={{ title: "Mentor Awaiting", drawerItemStyle: { display: "none" } }} />
          <Drawer.Screen name="admin-dashboard" options={{ title: "Admin Dashboard", drawerItemStyle: { display: "none" } }} />
          <Drawer.Screen name="network" options={{ title: "Network", drawerItemStyle: { display: "none" } }} />
          <Drawer.Screen name="posts" options={{ title: "Posts", drawerItemStyle: { display: "none" } }} />
          <Drawer.Screen name="public-profile/[userId]" options={{ title: "Profile", drawerItemStyle: { display: "none" } }} />
        </Drawer>
      </View>
      {showBottomNav() ? (
        <View style={styles.bottomNav}>
          {tabs.map((tab) => {
            const active = isTabActive(tab.key, tab.path);
            return (
              <TouchableOpacity key={tab.key} style={styles.bottomNavItem} onPress={() => router.replace(tab.path as never)}>
                <Ionicons name={tab.icon as any} size={20} color={active ? "#1F7A4C" : "#667085"} />
                <Text style={[styles.bottomNavLabel, active && styles.bottomNavLabelActive]}>{tab.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ) : null}
    </View>
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
  appRoot: { flex: 1, backgroundColor: "#F4F9F6" },
  contentArea: { flex: 1 },
  drawerContent: { paddingTop: 0 },
  drawerProfileCard: {
    marginHorizontal: 10,
    marginTop: 10,
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#D0D5DD",
    backgroundColor: "#FFFFFF",
    padding: 12
  },
  drawerProfileName: { color: "#1E2B24", fontWeight: "800", fontSize: 16 },
  drawerProfileRole: { marginTop: 4, color: "#667085", fontWeight: "600" },
  drawerProfileLink: { marginTop: 8, color: "#1F7A4C", fontWeight: "700" },
  drawerSectionTitle: {
    color: "#475467",
    fontWeight: "700",
    fontSize: 12
  },
  drawerGroupHeader: {
    marginTop: 8,
    marginBottom: 4,
    marginHorizontal: 16,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: "#E4E7EC",
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  drawerSubList: {
    paddingLeft: 6
  },
  bottomNav: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderColor: "#E4E7EC",
    backgroundColor: "#FFFFFF",
    paddingVertical: 6
  },
  bottomNavItem: { flex: 1, alignItems: "center", justifyContent: "center", gap: 2, paddingVertical: 4 },
  bottomNavLabel: { fontSize: 11, color: "#667085", fontWeight: "600" },
  bottomNavLabelActive: { color: "#1F7A4C" },
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
