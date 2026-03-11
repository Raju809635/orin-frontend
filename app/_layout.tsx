import "react-native-gesture-handler";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  AppStateStatus,
  BackHandler,
  Image,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { Drawer } from "expo-router/drawer";
import { useNavigation, usePathname, useRouter } from "expo-router";
import { DrawerContentScrollView, DrawerItem, DrawerContentComponentProps } from "@react-navigation/drawer";
import { Ionicons } from "@expo/vector-icons";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { useSafeAreaInsets } from "react-native-safe-area-context";

function defaultRouteByRole(role: "student" | "mentor") {
  if (role === "student") return "/student-dashboard?section=overview";
  return "/mentor-dashboard?section=overview";
}

function homeRouteForUser(user: { role: "student" | "mentor"; approvalStatus?: "pending" | "approved" | "rejected" }) {
  if (user.role === "mentor" && user.approvalStatus !== "approved") {
    return "/mentor-pending";
  }
  return defaultRouteByRole(user.role);
}

function RootDrawer() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const navigation = useNavigation();
  const pathname = usePathname();
  const { user, isAuthenticated, isBootstrapping } = useAuth();
  const [drawerPhotoUrl, setDrawerPhotoUrl] = useState("");
  const [drawerReputation, setDrawerReputation] = useState<{ levelTag?: string; xp?: number; score?: number } | null>(null);
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
      pathname.startsWith("/news-updates") ||
      pathname.startsWith("/mentorship") ||
      pathname.startsWith("/ai-hub") ||
      pathname.startsWith("/community-growth") ||
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
    if (Platform.OS !== "android") return;

    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (isBootstrapping) return true;

      const isAuthScreen = pathname === "/login" || pathname === "/register" || pathname === "/verify-email";
      if (!isAuthenticated || !user) {
        return false;
      }

      const homePath = homeRouteForUser(user);
      const homeBasePath = homePath.split("?")[0];
      const atHome = pathname.startsWith(homeBasePath);

      if (atHome || isAuthScreen) {
        return false;
      }

      if (typeof (navigation as any).canGoBack === "function" && (navigation as any).canGoBack()) {
        (navigation as any).goBack();
        return true;
      }

      if (pathname.startsWith("/mentor/") || pathname.startsWith("/mentors")) {
        router.push("/domains" as never);
        return true;
      }
      if (pathname.startsWith("/domains") || pathname.startsWith("/domain-guide")) {
        router.push("/mentorship" as never);
        return true;
      }
      if (pathname.startsWith("/public-profile/")) {
        router.push("/network?section=feed" as never);
        return true;
      }
      if (
        pathname.startsWith("/ai-assistant") ||
        pathname.startsWith("/ai-hub") ||
        pathname.startsWith("/network") ||
        pathname.startsWith("/community-growth") ||
        pathname.startsWith("/news-updates") ||
        pathname.startsWith("/chat") ||
        pathname.startsWith("/notifications") ||
        pathname.startsWith("/my-profile") ||
        pathname.startsWith("/settings") ||
        pathname.startsWith("/complaints") ||
        pathname.startsWith("/collaborate")
      ) {
        router.push(homePath as never);
        return true;
      }

      router.push(homePath as never);
      return true;
    });

    return () => sub.remove();
  }, [isAuthenticated, isBootstrapping, navigation, pathname, router, user]);

  useEffect(() => {
    let active = true;

    async function loadDrawerPhoto() {
      if (!isAuthenticated || !user) {
        if (active) setDrawerPhotoUrl("");
        return;
      }
      try {
        const endpoint = user.role === "mentor" ? "/api/profiles/mentor/me" : "/api/profiles/student/me";
        const [profileRes, dailyRes] = await Promise.allSettled([
          api.get<{ profile?: { profilePhotoUrl?: string } }>(endpoint),
          api.get<{ levelTag?: string; xp?: number; reputationScore?: number }>("/api/network/daily-dashboard")
        ]);
        if (!active) return;
        setDrawerPhotoUrl(profileRes.status === "fulfilled" ? profileRes.value.data?.profile?.profilePhotoUrl || "" : "");
        setDrawerReputation(
          dailyRes.status === "fulfilled"
            ? {
                levelTag: dailyRes.value.data?.levelTag || "Starter",
                xp: Number(dailyRes.value.data?.xp || 0),
                score: Number(dailyRes.value.data?.reputationScore || 0)
              }
            : { levelTag: "Starter", xp: 0, score: 0 }
        );
      } catch {
        if (active) {
          setDrawerPhotoUrl("");
          setDrawerReputation({ levelTag: "Starter", xp: 0, score: 0 });
        }
      }
    }

    loadDrawerPhoto();
    return () => {
      active = false;
    };
  }, [isAuthenticated, user?.id, user?.role]);

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
            <View style={styles.drawerProfileHead}>
              {drawerPhotoUrl ? (
                <Image source={{ uri: drawerPhotoUrl }} style={styles.drawerAvatarImage} />
              ) : (
                <View style={styles.drawerAvatarFallback}>
                  <Text style={styles.drawerAvatarText}>{user.name?.charAt(0)?.toUpperCase() || "U"}</Text>
                </View>
              )}
              <View style={styles.drawerProfileTextWrap}>
            <Text style={styles.drawerProfileName}>{user.name || "ORIN User"}</Text>
            <Text style={styles.drawerProfileRole}>{user.role === "mentor" ? "Mentor" : "Student"}</Text>
            <Text style={styles.drawerProfileMeta}>
              {drawerReputation?.levelTag || "Starter"} | XP {drawerReputation?.xp ?? 0} | Score {drawerReputation?.score ?? 0}
            </Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={() => router.push("/my-profile" as never)}
            >
            <Text style={styles.drawerProfileLink}>View Profile</Text>
            </TouchableOpacity>
          </View>
        ) : null}
        <View style={styles.drawerFlatList}>
          <DrawerItem label="Domains" onPress={() => router.push("/domains" as never)} />
          <DrawerItem
            label="Daily Quiz"
            onPress={() =>
              router.push((user?.role === "student" ? "/student-dashboard?section=overview&openQuiz=1" : "/mentor-dashboard?section=overview") as never)
            }
          />
          <DrawerItem label="AI Assistant" onPress={() => router.push("/ai-assistant" as never)} />
          <DrawerItem label="News & Updates" onPress={() => router.push("/news-updates" as never)} />
          <DrawerItem label="Collaborate" onPress={() => router.push("/collaborate" as never)} />
          <DrawerItem label="Settings" onPress={() => router.push("/settings" as never)} />
        </View>
      </DrawerContentScrollView>
    );
  }

  function showBottomNav() {
    if (!isAuthenticated || !user) return false;
    if (pathname === "/login" || pathname === "/register" || pathname === "/verify-email") return false;
    if (pathname === "/mentor-awaiting" || pathname === "/mentor-pending") return false;
    return true;
  }

  const studentTabs = [
    { key: "dashboard", label: "Dashboard", icon: "speedometer", path: "/student-dashboard?section=overview" },
    { key: "mentorship", label: "Mentorship", icon: "school", path: "/mentorship" },
    { key: "network", label: "Network", icon: "people", path: "/network?section=feed" },
    { key: "ai", label: "AI", icon: "sparkles", path: "/ai-hub" },
    { key: "community", label: "Community", icon: "trophy", path: "/community-growth" }
  ] as const;

  const mentorTabs = [
    { key: "dashboard", label: "Dashboard", icon: "speedometer", path: "/mentor-dashboard?section=overview" },
    { key: "mentorship", label: "Mentorship", icon: "school", path: "/mentorship" },
    { key: "network", label: "Network", icon: "people", path: "/network?section=feed" },
    { key: "ai", label: "AI", icon: "sparkles", path: "/ai-hub" },
    { key: "community", label: "Community", icon: "trophy", path: "/community-growth" }
  ] as const;

  const tabs = user?.role === "mentor" ? mentorTabs : studentTabs;
  const isTabActive = (tabKey: string, path: string) => {
    const basePath = path.split("?")[0];
    if (basePath === "/") return pathname === "/";
    if (tabKey === "dashboard" && basePath.startsWith("/student-dashboard")) return pathname.startsWith("/student-dashboard");
    if (tabKey === "dashboard" && basePath.startsWith("/mentor-dashboard")) return pathname.startsWith("/mentor-dashboard");
    if (tabKey === "mentorship") {
      return pathname.startsWith("/mentorship") || pathname.startsWith("/domains") || pathname.startsWith("/domain-guide") || pathname.startsWith("/mentor/");
    }
    if (tabKey === "ai") return pathname.startsWith("/ai-hub") || pathname.startsWith("/ai-assistant");
    if (tabKey === "network") return pathname.startsWith("/network") || pathname.startsWith("/posts");
    if (tabKey === "community") return pathname.startsWith("/community-growth") || pathname.startsWith("/collaborate");
    return pathname.startsWith(basePath);
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
          <Drawer.Screen name="news-updates" options={{ title: "News & Updates", drawerItemStyle: { display: "none" } }} />
          <Drawer.Screen name="about" options={{ title: "About ORIN", drawerItemStyle: { display: "none" } }} />
          <Drawer.Screen name="privacy" options={{ title: "Privacy Policy", drawerItemStyle: { display: "none" } }} />
          <Drawer.Screen name="terms" options={{ title: "Terms of Use", drawerItemStyle: { display: "none" } }} />
          <Drawer.Screen name="help" options={{ title: "Help & Support", drawerItemStyle: { display: "none" } }} />
          <Drawer.Screen name="settings" options={{ title: "Settings", drawerItemStyle: { display: "none" } }} />
          <Drawer.Screen name="notifications" options={{ title: "Notifications", drawerItemStyle: { display: "none" } }} />
          <Drawer.Screen name="saved-posts" options={{ title: "Saved Posts", drawerItemStyle: { display: "none" } }} />
          <Drawer.Screen name="student-dashboard" options={{ title: "Student Dashboard", drawerItemStyle: { display: "none" } }} />
          <Drawer.Screen name="student-sessions" options={{ title: "Session Management", drawerItemStyle: { display: "none" } }} />
          <Drawer.Screen name="mentorship" options={{ title: "Mentorship", drawerItemStyle: { display: "none" } }} />
          <Drawer.Screen name="ai-hub" options={{ title: "AI", drawerItemStyle: { display: "none" } }} />
          <Drawer.Screen name="ai/mentor-matching" options={{ title: "AI Mentor Matching", drawerItemStyle: { display: "none" } }} />
          <Drawer.Screen name="ai/skill-gap" options={{ title: "AI Skill Gap Analysis", drawerItemStyle: { display: "none" } }} />
          <Drawer.Screen name="ai/career-roadmap" options={{ title: "AI Career Roadmap", drawerItemStyle: { display: "none" } }} />
          <Drawer.Screen name="ai/project-ideas" options={{ title: "AI Project Ideas", drawerItemStyle: { display: "none" } }} />
          <Drawer.Screen name="ai/resume-builder" options={{ title: "AI Resume Builder", drawerItemStyle: { display: "none" } }} />
          <Drawer.Screen name="ai/assistant" options={{ title: "AI Assistant", drawerItemStyle: { display: "none" } }} />
          <Drawer.Screen name="community-growth" options={{ title: "Community & Growth", drawerItemStyle: { display: "none" } }} />
          <Drawer.Screen name="community/collaboration" options={{ title: "Community & Collaboration", drawerItemStyle: { display: "none" } }} />
          <Drawer.Screen name="community/challenges" options={{ title: "Community Challenges", drawerItemStyle: { display: "none" } }} />
          <Drawer.Screen name="community/certifications" options={{ title: "Certifications", drawerItemStyle: { display: "none" } }} />
          <Drawer.Screen name="community/opportunities" options={{ title: "Internship Opportunities", drawerItemStyle: { display: "none" } }} />
          <Drawer.Screen name="community/leaderboard" options={{ title: "College Leaderboard", drawerItemStyle: { display: "none" } }} />
          <Drawer.Screen name="community/knowledge-library" options={{ title: "Knowledge Library", drawerItemStyle: { display: "none" } }} />
          <Drawer.Screen name="community/reputation" options={{ title: "Reputation & Ranking", drawerItemStyle: { display: "none" } }} />
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
        <View style={[styles.bottomNav, { paddingBottom: Math.max(insets.bottom, 8), minHeight: 66 + Math.max(insets.bottom, 8) }]}>
          {tabs.map((tab) => {
            const active = isTabActive(tab.key, tab.path);
            return (
              <TouchableOpacity key={tab.key} style={styles.bottomNavItem} onPress={() => router.push(tab.path as never)}>
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
  drawerProfileHead: { flexDirection: "row", alignItems: "center", gap: 10 },
  drawerProfileTextWrap: { flex: 1 },
  drawerAvatarImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#CFE4D8"
  },
  drawerAvatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#CFE4D8",
    backgroundColor: "#E8F5EE",
    alignItems: "center",
    justifyContent: "center"
  },
  drawerAvatarText: { color: "#0B3D2E", fontWeight: "800", fontSize: 18 },
  drawerProfileName: { color: "#1E2B24", fontWeight: "800", fontSize: 16 },
  drawerProfileRole: { marginTop: 4, color: "#667085", fontWeight: "600" },
  drawerProfileMeta: { marginTop: 4, color: "#344054", fontWeight: "600", fontSize: 12 },
  drawerProfileLink: { marginTop: 8, color: "#1F7A4C", fontWeight: "700" },
  drawerFlatList: { paddingTop: 4, paddingLeft: 6 },
  bottomNav: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderColor: "#E4E7EC",
    backgroundColor: "#FFFFFF",
    paddingTop: 8,
    paddingHorizontal: 8
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
