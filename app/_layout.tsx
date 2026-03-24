import "react-native-gesture-handler";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
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
import { ThemeProvider, useAppTheme } from "@/context/ThemeContext";
import { api } from "@/lib/api";
import { useSafeAreaInsets } from "react-native-safe-area-context";

function defaultRouteByRole(role: "student" | "mentor") {
  return "/network?section=feed";
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
  const { colors } = useAppTheme();
  const { user, isAuthenticated, isBootstrapping, logout } = useAuth();
  const [drawerPhotoUrl, setDrawerPhotoUrl] = useState("");
  const [drawerReputation, setDrawerReputation] = useState<{ levelTag?: string; xp?: number; score?: number } | null>(null);
  const [drawerMentorStats, setDrawerMentorStats] = useState<{ rating?: number; studentsMentored?: number } | null>(null);
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
        if (active) setDrawerMentorStats(null);
        return;
      }
      try {
        const endpoint = user.role === "mentor" ? "/api/profiles/mentor/me" : "/api/profiles/student/me";
        const [profileRes, dailyRes, mentorSessionsRes] = await Promise.allSettled([
          api.get<{ profile?: { profilePhotoUrl?: string } }>(endpoint),
          api.get<{ levelTag?: string; xp?: number; reputationScore?: number }>("/api/network/daily-dashboard"),
          user.role === "mentor"
            ? api.get<Array<{ studentId?: { email?: string; name?: string } | null }>>("/api/sessions/mentor/me")
            : Promise.resolve({ data: [] as Array<{ studentId?: { email?: string; name?: string } | null }> })
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
        if (user.role === "mentor") {
          const mentorProfile = profileRes.status === "fulfilled" ? (profileRes.value.data?.profile as { rating?: number } | undefined) : undefined;
          const sessionRows = mentorSessionsRes.status === "fulfilled" ? mentorSessionsRes.value.data || [] : [];
          const studentsMentored = new Set(
            sessionRows
              .map((item) => item.studentId?.email || item.studentId?.name || "")
              .filter(Boolean)
          ).size;
          setDrawerMentorStats({
            rating: Number(mentorProfile?.rating || 0),
            studentsMentored
          });
        } else {
          setDrawerMentorStats(null);
        }
      } catch {
        if (active) {
          setDrawerPhotoUrl("");
          setDrawerReputation({ levelTag: "Starter", xp: 0, score: 0 });
          setDrawerMentorStats(null);
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
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={[styles.loadingText, { color: colors.text }]}>Loading ORIN...</Text>
      </View>
    );
  }

  function renderDrawerContent(props: DrawerContentComponentProps) {
    const openDrawerRoute = (path: string) => {
      props.navigation.closeDrawer();
      router.replace(path as never);
    };
    const profilePath = user?.role === "mentor" ? "/mentor-profile" : "/my-profile";
    const drawerItemTheme = {
      activeTintColor: colors.accent,
      inactiveTintColor: colors.text,
      activeBackgroundColor: colors.accentSoft,
      pressColor: colors.accentSoft,
      labelStyle: { color: colors.text, fontWeight: "700" as const },
      style: { borderRadius: 14, marginHorizontal: 6 }
    };

    return (
      <DrawerContentScrollView
        {...props}
        contentContainerStyle={[styles.drawerContent, { backgroundColor: colors.surface }]}
        style={{ backgroundColor: colors.surface }}
      >
        {user ? (
          <View style={[styles.drawerProfileCard, { borderColor: colors.border, backgroundColor: colors.surface }]}>
            <View style={styles.drawerProfileHead}>
              {drawerPhotoUrl ? (
                <Image source={{ uri: drawerPhotoUrl }} style={styles.drawerAvatarImage} />
              ) : (
                <View style={[styles.drawerAvatarFallback, { borderColor: colors.border, backgroundColor: colors.accentSoft }]}>
                  <Text style={[styles.drawerAvatarText, { color: colors.accent }]}>{user.name?.charAt(0)?.toUpperCase() || "U"}</Text>
                </View>
              )}
              <View style={styles.drawerProfileTextWrap}>
            <Text style={[styles.drawerProfileName, { color: colors.text }]}>{user.name || "ORIN User"}</Text>
            <Text style={[styles.drawerProfileRole, { color: colors.textMuted }]}>{user.role === "mentor" ? "Mentor" : "Student"}</Text>
            <Text style={[styles.drawerProfileMeta, { color: colors.text }]}>
              {drawerReputation?.levelTag || "Starter"} | XP {drawerReputation?.xp ?? drawerReputation?.score ?? 0}
            </Text>
            {user.role === "mentor" ? (
              <Text style={[styles.drawerProfileMeta, { color: colors.text }]}>
                Rating {Number(drawerMentorStats?.rating || 0).toFixed(1)} | Students Mentored {drawerMentorStats?.studentsMentored ?? 0}
              </Text>
            ) : null}
              </View>
            </View>
            <TouchableOpacity
              onPress={() => openDrawerRoute(profilePath)}
            >
            <Text style={[styles.drawerProfileLink, { color: colors.accent }]}>View Profile</Text>
            </TouchableOpacity>
          </View>
        ) : null}
        <View style={styles.drawerFlatList}>
          <DrawerItem {...drawerItemTheme} label="Profile" icon={({ color, size }) => <Ionicons name="person-outline" size={size} color={color} />} onPress={() => openDrawerRoute(profilePath)} />
          <DrawerItem {...drawerItemTheme} label="News & Updates" icon={({ color, size }) => <Ionicons name="newspaper-outline" size={size} color={color} />} onPress={() => openDrawerRoute("/news-updates")} />
          <DrawerItem {...drawerItemTheme} label="Certificates" icon={({ color, size }) => <Ionicons name="ribbon-outline" size={size} color={color} />} onPress={() => openDrawerRoute("/community/certifications")} />
          <DrawerItem {...drawerItemTheme} label="Saved" icon={({ color, size }) => <Ionicons name="bookmark-outline" size={size} color={color} />} onPress={() => openDrawerRoute("/saved-posts")} />
          <DrawerItem {...drawerItemTheme} label="Settings" icon={({ color, size }) => <Ionicons name="settings-outline" size={size} color={color} />} onPress={() => openDrawerRoute("/settings")} />
          <DrawerItem {...drawerItemTheme} label="Notifications" icon={({ color, size }) => <Ionicons name="notifications-outline" size={size} color={color} />} onPress={() => openDrawerRoute("/notifications")} />
          <DrawerItem
            {...drawerItemTheme}
            label="Logout"
            icon={({ color, size }) => <Ionicons name="log-out-outline" size={size} color={color} />}
            onPress={async () => {
              props.navigation.closeDrawer();
              await logout();
              router.replace("/login" as never);
            }}
          />
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
    { key: "home", label: "Home", icon: "home", path: "/network?section=feed" },
    { key: "mentorship", label: "Mentorship", icon: "school", path: "/mentorship" },
    { key: "journey", label: "Journey", icon: "map", path: "/student-dashboard?section=overview" },
    { key: "ai", label: "AI", icon: "sparkles", path: "/ai-hub" },
    { key: "community", label: "Community", icon: "trophy", path: "/community-growth" }
  ] as const;

  const mentorTabs = [
    { key: "home", label: "Home", icon: "home", path: "/network?section=feed" },
    { key: "mentorship", label: "Mentorship", icon: "school", path: "/mentorship" },
    { key: "journey", label: "Journey", icon: "map", path: "/mentor-dashboard?section=overview" },
    { key: "ai", label: "AI", icon: "sparkles", path: "/ai-hub" },
    { key: "community", label: "Community", icon: "trophy", path: "/community-growth" }
  ] as const;

  const tabs = user?.role === "mentor" ? mentorTabs : studentTabs;
  const isTabActive = (tabKey: string, path: string) => {
    const basePath = path.split("?")[0];
    if (basePath === "/") return pathname === "/";
    if (tabKey === "journey" && basePath.startsWith("/student-dashboard")) return pathname.startsWith("/student-dashboard");
    if (tabKey === "journey" && basePath.startsWith("/mentor-dashboard")) return pathname.startsWith("/mentor-dashboard");
    if (tabKey === "mentorship") {
      return pathname.startsWith("/mentorship") || pathname.startsWith("/domains") || pathname.startsWith("/domain-guide") || pathname.startsWith("/mentor/");
    }
    if (tabKey === "ai") return pathname.startsWith("/ai-hub") || pathname.startsWith("/ai-assistant");
    if (tabKey === "home") return pathname.startsWith("/network") || pathname.startsWith("/posts");
    if (tabKey === "community") return pathname.startsWith("/community-growth") || pathname.startsWith("/collaborate");
    return pathname.startsWith(basePath);
  };

  return (
    <View style={[styles.appRoot, { backgroundColor: colors.background }]}>
      <View style={styles.contentArea}>
        <Drawer
          drawerContent={renderDrawerContent}
          screenOptions={{
            headerShown: false,
            drawerActiveTintColor: colors.accent,
            drawerInactiveTintColor: colors.textMuted,
            drawerStyle: { backgroundColor: colors.surface },
            drawerActiveBackgroundColor: colors.accentSoft,
            drawerLabelStyle: { color: colors.text, fontWeight: "700" },
            drawerItemStyle: { borderRadius: 14, marginHorizontal: 6 },
            sceneStyle: { backgroundColor: colors.background }
          }}
        >
          <Drawer.Screen name="index" options={{ title: "Home", drawerItemStyle: { display: "none" } }} />
          <Drawer.Screen name="login" options={{ title: "Login", drawerItemStyle: { display: "none" } }} />
          <Drawer.Screen name="register" options={{ title: "Register", drawerItemStyle: { display: "none" } }} />
          <Drawer.Screen name="verify-email" options={{ title: "Verify Email", drawerItemStyle: { display: "none" } }} />
          <Drawer.Screen name="verify/[certificateId]" options={{ title: "Verify Certificate", drawerItemStyle: { display: "none" } }} />
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
          <Drawer.Screen name="saved-ai" options={{ title: "Saved AI", drawerItemStyle: { display: "none" } }} />
          <Drawer.Screen name="saved-posts" options={{ title: "Saved Posts", drawerItemStyle: { display: "none" } }} />
          <Drawer.Screen name="student-dashboard" options={{ title: "Student Dashboard", drawerItemStyle: { display: "none" }, headerShown: false }} />
          <Drawer.Screen name="student-sessions" options={{ title: "Session Management", drawerItemStyle: { display: "none" } }} />
          <Drawer.Screen name="mentorship" options={{ title: "Mentorship", drawerItemStyle: { display: "none" }, headerShown: false }} />
          <Drawer.Screen name="ai-hub" options={{ title: "AI", drawerItemStyle: { display: "none" }, headerShown: false }} />
          <Drawer.Screen name="ai/mentor-matching" options={{ title: "AI Mentor Matching", drawerItemStyle: { display: "none" } }} />
          <Drawer.Screen name="ai/skill-gap" options={{ title: "AI Skill Gap Analysis", drawerItemStyle: { display: "none" } }} />
          <Drawer.Screen name="ai/career-roadmap" options={{ title: "AI Career Roadmap", drawerItemStyle: { display: "none" } }} />
          <Drawer.Screen name="ai/project-ideas" options={{ title: "AI Project Ideas", drawerItemStyle: { display: "none" } }} />
          <Drawer.Screen name="ai/resume-builder" options={{ title: "AI Resume Builder", drawerItemStyle: { display: "none" } }} />
          <Drawer.Screen name="ai/assistant" options={{ title: "AI Assistant", drawerItemStyle: { display: "none" } }} />
          <Drawer.Screen name="community-growth" options={{ title: "Community & Growth", drawerItemStyle: { display: "none" }, headerShown: false }} />
          <Drawer.Screen name="community/collaboration" options={{ title: "Community & Collaboration", drawerItemStyle: { display: "none" } }} />
          <Drawer.Screen name="community/challenges" options={{ title: "Community Challenges", drawerItemStyle: { display: "none" } }} />
          <Drawer.Screen name="community/certifications" options={{ title: "Certifications", drawerItemStyle: { display: "none" } }} />
          <Drawer.Screen name="community/opportunities" options={{ title: "Internship Opportunities", drawerItemStyle: { display: "none" } }} />
          <Drawer.Screen name="community/leaderboard" options={{ title: "College Leaderboard", drawerItemStyle: { display: "none" } }} />
          <Drawer.Screen name="community/knowledge-library" options={{ title: "Knowledge Library", drawerItemStyle: { display: "none" } }} />
          <Drawer.Screen name="community/reputation" options={{ title: "Reputation & Ranking", drawerItemStyle: { display: "none" } }} />
          <Drawer.Screen name="my-profile" options={{ title: "My Profile", drawerItemStyle: { display: "none" } }} />
          <Drawer.Screen name="student-profile" options={{ title: "My Profile", drawerItemStyle: { display: "none" } }} />
          <Drawer.Screen name="mentor-dashboard" options={{ title: "Mentor Dashboard", drawerItemStyle: { display: "none" }, headerShown: false }} />
          <Drawer.Screen name="mentor-profile" options={{ title: "My Profile", drawerItemStyle: { display: "none" } }} />
          <Drawer.Screen name="mentor-policy" options={{ title: "Mentor Policy", drawerItemStyle: { display: "none" } }} />
          <Drawer.Screen name="mentors" options={{ title: "Mentors", drawerItemStyle: { display: "none" } }} />
          <Drawer.Screen name="mentor/[mentorId]" options={{ title: "Mentor Profile", drawerItemStyle: { display: "none" } }} />
          <Drawer.Screen name="mentor-pending" options={{ title: "Mentor Pending", drawerItemStyle: { display: "none" } }} />
          <Drawer.Screen name="mentor-awaiting" options={{ title: "Mentor Awaiting", drawerItemStyle: { display: "none" } }} />
          <Drawer.Screen name="admin-dashboard" options={{ title: "Admin Dashboard", drawerItemStyle: { display: "none" } }} />
          <Drawer.Screen name="network" options={{ title: "Network", drawerItemStyle: { display: "none" }, headerShown: false }} />
          <Drawer.Screen name="posts" options={{ title: "Posts", drawerItemStyle: { display: "none" } }} />
          <Drawer.Screen name="public-profile/[userId]" options={{ title: "Profile", drawerItemStyle: { display: "none" } }} />
        </Drawer>
      </View>
      {showBottomNav() ? (
        <View style={[styles.bottomNav, { backgroundColor: colors.surface, borderColor: colors.border, paddingBottom: Math.max(insets.bottom, 8), minHeight: 66 + Math.max(insets.bottom, 8) }]}>
          {tabs.map((tab) => {
            const active = isTabActive(tab.key, tab.path);
            return (
              <AnimatedTabButton
                key={tab.key}
                tab={tab}
                active={active}
                colors={colors}
                onPress={() => router.push(tab.path as never)}
              />
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

function AnimatedTabButton({
  tab,
  active,
  colors,
  onPress
}: {
  tab: { key: string; label: string; icon: string; path: string };
  active: boolean;
  colors: { accent: string; textMuted: string; accentSoft: string; surfaceAlt: string; border: string };
  onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(active ? 1 : 0.96)).current;
  const lift = useRef(new Animated.Value(active ? -2 : 0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: active ? 1.08 : 1,
        useNativeDriver: true,
        friction: 5,
        tension: 140
      }),
      Animated.spring(lift, {
        toValue: active ? -2 : 0,
        useNativeDriver: true,
        friction: 6,
        tension: 130
      })
    ]).start();
  }, [active, lift, scale]);

  const isCenter = tab.key === "journey";

  return (
    <TouchableOpacity style={styles.bottomNavTouch} activeOpacity={0.9} onPress={onPress}>
      <Animated.View
        style={[
          styles.bottomNavItem,
          isCenter && [styles.bottomNavItemCenter, { backgroundColor: colors.accentSoft, borderColor: colors.border }],
          active && [styles.bottomNavItemActive, { backgroundColor: colors.surfaceAlt }],
          {
            transform: [{ scale }, { translateY: lift }]
          }
        ]}
      >
        <Ionicons name={tab.icon as any} size={isCenter ? 22 : 20} color={active ? colors.accent : colors.textMuted} />
        <Text style={[styles.bottomNavLabel, { color: colors.textMuted }, active && [styles.bottomNavLabelActive, { color: colors.accent }]]}>{tab.label}</Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

export default function Layout() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <RootDrawer />
      </AuthProvider>
    </ThemeProvider>
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
  bottomNavTouch: { flex: 1 },
  bottomNavItem: {
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 6,
    borderRadius: 16
  },
  bottomNavItemCenter: {
    backgroundColor: "#F0FDF4",
    borderWidth: 1,
    borderColor: "#CFE8D6"
  },
  bottomNavItemActive: {
    backgroundColor: "#F7FAF8"
  },
  bottomNavLabel: { fontSize: 11, color: "#667085", fontWeight: "700" },
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
