import "react-native-gesture-handler";
import AsyncStorage from "@react-native-async-storage/async-storage";
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
import { useGlobalSearchParams, useNavigation, usePathname, useRouter } from "expo-router";
import { DrawerContentScrollView, DrawerItem, DrawerContentComponentProps } from "@react-navigation/drawer";
import { Ionicons } from "@expo/vector-icons";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { LearnerProvider, useLearner } from "@/context/LearnerContext";
import { ThemeProvider, useAppTheme } from "@/context/ThemeContext";
import { api, pingBackendReady } from "@/lib/api";
import { LEARNER_ONBOARDING_COMPLETING_KEY, LEARNER_ONBOARDING_PENDING_KEY } from "@/lib/learnerExperience";
import { useSafeAreaInsets } from "react-native-safe-area-context";

function defaultRouteByRole(role: "student" | "mentor") {
  return role === "mentor" ? "/mentor-dashboard?section=overview" : "/student-dashboard?section=overview";
}

function postsRouteByRole(_role: "student" | "mentor") {
  return "/network?section=feed";
}

type AppTabKey = "home" | "mentorship" | "journey" | "ai" | "community";

const TAB_BRAND_COLORS: Record<AppTabKey, { active: string; inactive: string; softLight: string; softDark: string; border: string }> = {
  home: { active: "#22C55E", inactive: "#86EFAC", softLight: "#EAFBF1", softDark: "rgba(34,197,94,0.20)", border: "#22C55E" },
  mentorship: { active: "#3B82F6", inactive: "#93C5FD", softLight: "#EAF2FF", softDark: "rgba(59,130,246,0.20)", border: "#3B82F6" },
  journey: { active: "#14B8A6", inactive: "#7DD3C7", softLight: "#E6FAF8", softDark: "rgba(20,184,166,0.20)", border: "#14B8A6" },
  ai: { active: "#FACC15", inactive: "#FDE68A", softLight: "#FFF7CC", softDark: "rgba(250,204,21,0.20)", border: "#FACC15" },
  community: { active: "#FB923C", inactive: "#FDBA74", softLight: "#FFF0E4", softDark: "rgba(251,146,60,0.20)", border: "#FB923C" }
};

function normalizeRouteParam(value: unknown) {
  if (Array.isArray(value)) {
    return value.length ? String(value[0] || "").trim() : "";
  }
  return String(value || "").trim();
}

function buildTrackedRoute(pathname: string, params: Record<string, unknown>) {
  const query = new URLSearchParams();
  ["section", "search", "growth", "openQuiz", "domain"].forEach((key) => {
    const value = normalizeRouteParam(params[key]);
    if (value) query.set(key, value);
  });
  const queryString = query.toString();
  return queryString ? `${pathname}?${queryString}` : pathname;
}

function getTabKeyForPath(pathname: string): AppTabKey | null {
  if (pathname.startsWith("/network") || pathname.startsWith("/posts")) return "home";
  if (pathname.startsWith("/mentorship") || pathname.startsWith("/domains") || pathname.startsWith("/domain-guide") || pathname.startsWith("/mentor/") || pathname.startsWith("/mentors") || pathname.startsWith("/student-sessions") || pathname.startsWith("/sprints/")) return "mentorship";
  if (pathname.startsWith("/student-dashboard") || pathname.startsWith("/mentor-dashboard")) return "journey";
  if (pathname.startsWith("/ai-hub") || pathname.startsWith("/ai/") || pathname.startsWith("/ai-assistant")) return "ai";
  if (pathname.startsWith("/community-growth") || pathname.startsWith("/community/") || pathname.startsWith("/collaborate")) return "community";
  return null;
}

type MentorOrgRole = "global_mentor" | "institution_teacher" | "organisation_head";

function getMentorMode(user?: { mentorOrgRole?: MentorOrgRole }) {
  if (user?.mentorOrgRole === "organisation_head") return "head";
  if (user?.mentorOrgRole === "institution_teacher") return "teacher";
  return "global";
}

function getDefaultTabPath(tabKey: AppTabKey, user: { role: "student" | "mentor"; mentorOrgRole?: MentorOrgRole }) {
  const mentorMode = user.role === "mentor" ? getMentorMode(user) : "global";
  switch (tabKey) {
    case "home":
      return user.role === "mentor" && mentorMode !== "global" ? "/network?section=institution" : postsRouteByRole(user.role);
    case "mentorship":
      if (user.role === "mentor" && mentorMode === "teacher") return "/mentor-dashboard?section=classes";
      if (user.role === "mentor" && mentorMode === "head") return "/mentor-dashboard?section=teachers";
      return "/mentorship";
    case "journey":
      return user.role === "mentor" ? "/mentor-dashboard?section=overview" : "/student-dashboard?section=overview";
    case "ai":
      if (user.role === "mentor" && mentorMode === "teacher") return "/mentor-dashboard?section=assign";
      if (user.role === "mentor" && mentorMode === "head") return "/mentor-dashboard?section=reports";
      return "/ai-hub";
    case "community":
      if (user.role === "mentor" && mentorMode === "teacher") return "/mentor-dashboard?section=reviews";
      if (user.role === "mentor" && mentorMode === "head") return "/mentor-dashboard?section=approvals";
      return "/community-growth";
    default:
      return defaultRouteByRole(user.role);
  }
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
  const globalParams = useGlobalSearchParams<Record<string, string | string[]>>();
  const { colors, isDark } = useAppTheme();
  const { user, isAuthenticated, isBootstrapping, logout } = useAuth();
  const { learnerStage } = useLearner();
  const [isBackendReady, setIsBackendReady] = useState(false);
  const [isCheckingBackend, setIsCheckingBackend] = useState(true);
  const [drawerPhotoUrl, setDrawerPhotoUrl] = useState("");
  const [drawerReputation, setDrawerReputation] = useState<{ levelTag?: string; xp?: number; score?: number } | null>(null);
  const [drawerMentorStats, setDrawerMentorStats] = useState<{ rating?: number; studentsMentored?: number } | null>(null);
  const [hasPendingLearnerOnboarding, setHasPendingLearnerOnboarding] = useState(false);
  const [isCompletingLearnerOnboarding, setIsCompletingLearnerOnboarding] = useState(false);
  const isCheckingUpdateRef = useRef(false);
  const hasPromptedReloadRef = useRef(false);
  const tabHistoryRef = useRef<Record<AppTabKey, string[]>>({
    home: [],
    mentorship: [],
    journey: [],
    ai: [],
    community: []
  });

  const trackedRoute = buildTrackedRoute(pathname, globalParams);

  useEffect(() => {
    if (!user) {
      tabHistoryRef.current = { home: [], mentorship: [], journey: [], ai: [], community: [] };
      return;
    }

    (["home", "mentorship", "journey", "ai", "community"] as AppTabKey[]).forEach((tabKey) => {
      if (!tabHistoryRef.current[tabKey]?.length) {
        tabHistoryRef.current[tabKey] = [getDefaultTabPath(tabKey, user)];
      }
    });
  }, [user]);

  useEffect(() => {
    let active = true;
    async function syncPendingLearnerOnboarding() {
      if (!isAuthenticated || user?.role !== "student") {
        if (active) {
          setHasPendingLearnerOnboarding(false);
          setIsCompletingLearnerOnboarding(false);
        }
        return;
      }
      try {
        const [pendingValue, completingValue] = await Promise.all([
          AsyncStorage.getItem(LEARNER_ONBOARDING_PENDING_KEY),
          AsyncStorage.getItem(LEARNER_ONBOARDING_COMPLETING_KEY)
        ]);
        if (active) {
          setHasPendingLearnerOnboarding(pendingValue === "1");
          setIsCompletingLearnerOnboarding(completingValue === "1");
        }
      } catch {
        if (active) {
          setHasPendingLearnerOnboarding(false);
          setIsCompletingLearnerOnboarding(false);
        }
      }
    }
    void syncPendingLearnerOnboarding();
    return () => {
      active = false;
    };
  }, [isAuthenticated, user?.role, pathname]);

  useEffect(() => {
    if (!isCompletingLearnerOnboarding || pathname.startsWith("/learner-onboarding")) {
      return;
    }

    let active = true;
    async function clearCompletingFlag() {
      try {
        await AsyncStorage.removeItem(LEARNER_ONBOARDING_COMPLETING_KEY);
      } finally {
        if (active) {
          setIsCompletingLearnerOnboarding(false);
          setHasPendingLearnerOnboarding(false);
        }
      }
    }

    void clearCompletingFlag();
    return () => {
      active = false;
    };
  }, [isCompletingLearnerOnboarding, pathname]);

  useEffect(() => {
    if (!user || !isAuthenticated) return;

    const tabKey = getTabKeyForPath(pathname);
    if (!tabKey) return;

    const currentHistory = tabHistoryRef.current[tabKey] || [getDefaultTabPath(tabKey, user)];
    const existingIndex = currentHistory.lastIndexOf(trackedRoute);

    tabHistoryRef.current[tabKey] =
      existingIndex >= 0 ? currentHistory.slice(0, existingIndex + 1) : [...currentHistory, trackedRoute];
  }, [isAuthenticated, pathname, trackedRoute, user]);

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
      pathname.startsWith("/sprints") ||
      pathname.startsWith("/news-updates") ||
      pathname.startsWith("/mentorship") ||
      pathname.startsWith("/ai-hub") ||
      pathname.startsWith("/ai/") ||
      pathname.startsWith("/community-growth") ||
      pathname.startsWith("/community/") ||
      pathname.startsWith("/about") ||
      pathname.startsWith("/privacy") ||
      pathname.startsWith("/terms") ||
      pathname.startsWith("/help") ||
      pathname.startsWith("/mentors") ||
      pathname.startsWith("/mentor/") ||
      pathname.startsWith("/settings") ||
      pathname.startsWith("/notifications") ||
      pathname.startsWith("/my-profile") ||
      pathname.startsWith("/learner-onboarding") ||
      pathname.startsWith("/student-dashboard") ||
      pathname.startsWith("/mentor-dashboard") ||
      pathname.startsWith("/admin-dashboard") ||
      pathname.startsWith("/network");

    if (!isAuthenticated && isProtected) {
      router.replace("/login" as never);
      return;
    }

    if (isAuthenticated && user && isAuthScreen) {
      if (user.role === "student" && hasPendingLearnerOnboarding && !isCompletingLearnerOnboarding) {
        router.replace("/learner-onboarding?new=1" as never);
        return;
      }
      router.replace(homeRouteForUser(user) as never);
      return;
    }

    if (isAuthenticated && user) {
      if (user.role === "student" && hasPendingLearnerOnboarding && !isCompletingLearnerOnboarding && !pathname.startsWith("/learner-onboarding")) {
        router.replace("/learner-onboarding?new=1" as never);
      } else if (pathname.startsWith("/mentor-dashboard") && user.role !== "mentor") {
        router.replace(homeRouteForUser(user) as never);
      } else if (pathname.startsWith("/learner-onboarding") && user.role !== "student") {
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
  }, [hasPendingLearnerOnboarding, isBootstrapping, isAuthenticated, isCompletingLearnerOnboarding, pathname, router, user]);

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

      const tabKey = getTabKeyForPath(pathname);
      if (!tabKey) {
        router.replace(homePath as never);
        return true;
      }

      const currentHistory = tabHistoryRef.current[tabKey] || [];
      if (currentHistory.length > 1) {
        const nextHistory = currentHistory.slice(0, -1);
        const previousRoute = nextHistory[nextHistory.length - 1];
        tabHistoryRef.current[tabKey] = nextHistory;
        router.replace(previousRoute as never);
        return true;
      }

      const tabRoot = getDefaultTabPath(tabKey, user);
      if (trackedRoute !== tabRoot) {
        tabHistoryRef.current[tabKey] = [tabRoot];
        router.replace(tabRoot as never);
        return true;
      }

      return false;
    });

    return () => sub.remove();
  }, [isAuthenticated, isBootstrapping, navigation, pathname, router, trackedRoute, user]);

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
            ? api.get<{ studentId?: { email?: string; name?: string } | null }[]>("/api/sessions/mentor/me")
            : Promise.resolve({ data: [] as { studentId?: { email?: string; name?: string } | null }[] })
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
  }, [isAuthenticated, user]);

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

  useEffect(() => {
    let active = true;

    async function ensureBackendReady() {
      if (isBootstrapping) return;
      if (!isAuthenticated) {
        if (active) {
          setIsBackendReady(true);
          setIsCheckingBackend(false);
        }
        return;
      }

      if (active) setIsCheckingBackend(true);

      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          const ready = await pingBackendReady();
          if (!active) return;
          if (ready) {
            setIsBackendReady(true);
            setIsCheckingBackend(false);
            return;
          }
        } catch {}

        if (attempt < 2) {
          await new Promise((resolve) => setTimeout(resolve, 1500 * (attempt + 1)));
        }
      }

      if (active) {
        setIsBackendReady(false);
        setIsCheckingBackend(false);
      }
    }

    ensureBackendReady();
    return () => {
      active = false;
    };
  }, [isAuthenticated, isBootstrapping]);

  if (isBootstrapping) {
    return (
      <OrinStartupScreen
        colors={colors}
        title="ORIN"
        subtitle="Loading your workspace..."
        showSpinner
      />
    );
  }

  if (isAuthenticated && (isCheckingBackend || !isBackendReady)) {
    return (
      <OrinStartupScreen
        colors={colors}
        title="ORIN"
        subtitle={isCheckingBackend ? "Preparing your journey..." : "ORIN is waking up. Tap retry in a moment."}
        showSpinner={isCheckingBackend}
        action={
          !isCheckingBackend ? (
            <TouchableOpacity
              style={[styles.retryButton, { backgroundColor: colors.accent }]}
              onPress={async () => {
                setIsCheckingBackend(true);
                try {
                  const ready = await pingBackendReady();
                  setIsBackendReady(Boolean(ready));
                } catch {
                  setIsBackendReady(false);
                } finally {
                  setIsCheckingBackend(false);
                }
              }}
            >
              <Text style={[styles.retryButtonText, { color: colors.accentText }]}>Retry Connection</Text>
            </TouchableOpacity>
          ) : null
        }
      />
    );
  }

  function renderDrawerContent(props: DrawerContentComponentProps) {
    const openDrawerRoute = (path: string) => {
      props.navigation.closeDrawer();
      router.push(path as never);
    };
    const profilePath = user?.role === "mentor" ? "/mentor-profile" : "/my-profile";
    const drawerItemTheme = {
      activeTintColor: colors.accent,
      inactiveTintColor: colors.text,
      activeBackgroundColor: colors.accentSoft,
      pressColor: colors.accentSoft,
      labelStyle: { fontWeight: "700" as const, opacity: 1 },
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
    if (pathname.startsWith("/learner-onboarding")) return false;
    return true;
  }

  const studentTabs = [
    { key: "home", label: "Posts", icon: "newspaper", path: "/network?section=feed" },
    { key: "mentorship", label: learnerStage === "kid" ? "Teachers" : "Mentorship", icon: "school", path: "/mentorship" },
    { key: "journey", label: "Home", icon: "home", path: "/student-dashboard?section=overview" },
    { key: "ai", label: "AI", icon: "sparkles", path: "/ai-hub" },
    { key: "community", label: "Community", icon: "trophy", path: "/community-growth" }
  ] as const;

  const mentorMode = getMentorMode(user || undefined);
  const mentorTabs = mentorMode === "teacher"
    ? [
        { key: "home", label: "Class Posts", icon: "newspaper", path: "/network?section=institution" },
        { key: "mentorship", label: "Classes", icon: "people", path: "/mentor-dashboard?section=classes" },
        { key: "journey", label: "Home", icon: "home", path: "/mentor-dashboard?section=overview" },
        { key: "ai", label: "Assign", icon: "create", path: "/mentor-dashboard?section=assign" },
        { key: "community", label: "Reviews", icon: "checkmark-done", path: "/mentor-dashboard?section=reviews" }
      ]
    : mentorMode === "head"
      ? [
          { key: "home", label: "School Posts", icon: "newspaper", path: "/network?section=institution" },
          { key: "mentorship", label: "Teachers", icon: "people", path: "/mentor-dashboard?section=teachers" },
          { key: "journey", label: "Home", icon: "home", path: "/mentor-dashboard?section=overview" },
          { key: "ai", label: "Reports", icon: "stats-chart", path: "/mentor-dashboard?section=reports" },
          { key: "community", label: "Approvals", icon: "shield-checkmark", path: "/mentor-dashboard?section=approvals" }
        ]
      : [
          { key: "home", label: "Posts", icon: "newspaper", path: "/network?section=feed" },
          { key: "mentorship", label: "Mentorship", icon: "school", path: "/mentorship" },
          { key: "journey", label: "Home", icon: "home", path: "/mentor-dashboard?section=overview" },
          { key: "ai", label: "AI", icon: "sparkles", path: "/ai-hub" },
          { key: "community", label: "Community", icon: "trophy", path: "/community-growth" }
        ];

  const tabs = user?.role === "mentor" ? mentorTabs : studentTabs;
  const isTabActive = (tabKey: string, path: string) => {
    const basePath = path.split("?")[0];
    if (basePath === "/") return pathname === "/";
    if (tabKey === "journey" && basePath.startsWith("/student-dashboard")) return pathname.startsWith("/student-dashboard");
    if (user?.role === "mentor" && pathname.startsWith("/mentor-dashboard")) {
      const section = normalizeRouteParam(globalParams.section) || "overview";
      if (mentorMode === "teacher") {
        if (tabKey === "mentorship") return section === "classes";
        if (tabKey === "ai") return section === "assign";
        if (tabKey === "community") return section === "reviews";
        if (tabKey === "journey") return section === "overview";
      }
      if (mentorMode === "head") {
        if (tabKey === "mentorship") return section === "teachers";
        if (tabKey === "ai") return section === "reports";
        if (tabKey === "community") return section === "approvals";
        if (tabKey === "journey") return section === "overview";
      }
      if (tabKey === "journey" && basePath.startsWith("/mentor-dashboard")) return true;
    }
    if (tabKey === "mentorship") {
      return pathname.startsWith("/mentorship") || pathname.startsWith("/domains") || pathname.startsWith("/domain-guide") || pathname.startsWith("/mentor/") || pathname.startsWith("/mentors") || pathname.startsWith("/student-sessions") || pathname.startsWith("/sprints/");
    }
    if (tabKey === "ai") return pathname.startsWith("/ai-hub") || pathname.startsWith("/ai/") || pathname.startsWith("/ai-assistant");
    if (tabKey === "home") return pathname.startsWith("/network") || pathname.startsWith("/posts");
    if (tabKey === "community") return pathname.startsWith("/community-growth") || pathname.startsWith("/community/") || pathname.startsWith("/collaborate");
    return pathname.startsWith(basePath);
  };

  function openBottomTab(tab: (typeof tabs)[number]) {
    if (!user) return;
    const tabKey = tab.key as AppTabKey;
    const fallbackPath = getDefaultTabPath(tabKey, user);
    if (tabKey === "journey") {
      tabHistoryRef.current.journey = [fallbackPath];
      if (Platform.OS === "web" && typeof window !== "undefined") {
        window.location.assign(fallbackPath);
        return;
      }
      router.push(fallbackPath as never);
      return;
    }
    const tabHistory = tabHistoryRef.current[tabKey];
    const candidatePath = tabHistory?.[tabHistory.length - 1] || fallbackPath;
    const candidateBasePath = String(candidatePath || "").split("?")[0];
    const targetPath = candidateBasePath ? candidatePath : fallbackPath;

    if (trackedRoute === targetPath) return;
    router.replace(targetPath as never);
  }

  return (
    <View style={[styles.appRoot, { backgroundColor: colors.background }]}>
      <View style={styles.contentArea}>
        <Drawer
          drawerContent={renderDrawerContent}
          screenOptions={{
            headerShown: false,
            drawerActiveTintColor: colors.accent,
            drawerInactiveTintColor: colors.text,
            drawerStyle: { backgroundColor: colors.surface },
            drawerActiveBackgroundColor: colors.accentSoft,
            drawerLabelStyle: { fontWeight: "700" },
            drawerItemStyle: { borderRadius: 14, marginHorizontal: 6 },
            sceneStyle: { backgroundColor: colors.background }
          }}
        >
          <Drawer.Screen name="index" options={{ title: "Home", drawerItemStyle: { display: "none" } }} />
          <Drawer.Screen name="login" options={{ title: "Login", drawerItemStyle: { display: "none" } }} />
          <Drawer.Screen name="register" options={{ title: "Register", drawerItemStyle: { display: "none" } }} />
          <Drawer.Screen name="learner-onboarding" options={{ title: "Learner Setup", drawerItemStyle: { display: "none" } }} />
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
          <Drawer.Screen name="ai/kids-learning-games" options={{ title: "Learning Games", drawerItemStyle: { display: "none" } }} />
          <Drawer.Screen name="ai/reading-and-numbers" options={{ title: "Reading & Numbers", drawerItemStyle: { display: "none" } }} />
          <Drawer.Screen name="ai/creative-corner" options={{ title: "Creative Corner", drawerItemStyle: { display: "none" } }} />
          <Drawer.Screen name="ai/story-and-drawing" options={{ title: "Story & Drawing", drawerItemStyle: { display: "none" } }} />
          <Drawer.Screen name="ai/kids-learning-activities" options={{ title: "Learning Activities", drawerItemStyle: { display: "none" } }} />
          <Drawer.Screen name="ai/kids-ask-orin" options={{ title: "Ask ORIN", drawerItemStyle: { display: "none" } }} />
          <Drawer.Screen name="ai/career-explorer" options={{ title: "Career Explorer", drawerItemStyle: { display: "none" } }} />
          <Drawer.Screen name="ai/study-planner" options={{ title: "Study Planner", drawerItemStyle: { display: "none" } }} />
          <Drawer.Screen name="ai/highschool-subject-gap" options={{ title: "Subject Gap Analyzer", drawerItemStyle: { display: "none" } }} />
          <Drawer.Screen name="ai/highschool-study-roadmap" options={{ title: "Study Roadmap", drawerItemStyle: { display: "none" } }} />
          <Drawer.Screen name="ai/highschool-study-assistant" options={{ title: "Study Assistant", drawerItemStyle: { display: "none" } }} />
          <Drawer.Screen name="community-growth" options={{ title: "Community & Growth", drawerItemStyle: { display: "none" }, headerShown: false }} />
          <Drawer.Screen name="community/kids-community" options={{ title: "Kids Community", drawerItemStyle: { display: "none" } }} />
          <Drawer.Screen name="community/highschool-community" options={{ title: "High School Community", drawerItemStyle: { display: "none" } }} />
          <Drawer.Screen name="community/kid-group-activities" options={{ title: "Group Activities", drawerItemStyle: { display: "none" } }} />
          <Drawer.Screen name="community/kid-fun-challenges" options={{ title: "Fun Challenges", drawerItemStyle: { display: "none" } }} />
          <Drawer.Screen name="community/kid-star-rewards" options={{ title: "Star Rewards", drawerItemStyle: { display: "none" } }} />
          <Drawer.Screen name="community/kid-class-resources" options={{ title: "Class Resources", drawerItemStyle: { display: "none" } }} />
          <Drawer.Screen name="community/highschool-study-groups" options={{ title: "Study Groups", drawerItemStyle: { display: "none" } }} />
          <Drawer.Screen name="community/highschool-school-challenges" options={{ title: "School Challenges", drawerItemStyle: { display: "none" } }} />
          <Drawer.Screen name="community/highschool-resource-library" options={{ title: "Resource Library", drawerItemStyle: { display: "none" } }} />
          <Drawer.Screen name="community/highschool-achievements" options={{ title: "Achievements", drawerItemStyle: { display: "none" } }} />
          <Drawer.Screen name="community/learning-games" options={{ title: "Learning Games", drawerItemStyle: { display: "none" } }} />
          <Drawer.Screen name="community/highschool-programs" options={{ title: "Programs & Opportunities", drawerItemStyle: { display: "none" } }} />
          <Drawer.Screen name="community/highschool-leaderboard" options={{ title: "School Leaderboard", drawerItemStyle: { display: "none" } }} />
          <Drawer.Screen name="community/highschool-progress" options={{ title: "School Progress", drawerItemStyle: { display: "none" } }} />
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
          <Drawer.Screen name="mentor-group-chat/[groupId]" options={{ title: "Mentor Group Chat", drawerItemStyle: { display: "none" } }} />
          <Drawer.Screen name="mentor-pending" options={{ title: "Mentor Pending", drawerItemStyle: { display: "none" } }} />
          <Drawer.Screen name="mentor-awaiting" options={{ title: "Mentor Awaiting", drawerItemStyle: { display: "none" } }} />
          <Drawer.Screen name="admin-dashboard" options={{ title: "Admin Dashboard", drawerItemStyle: { display: "none" } }} />
          <Drawer.Screen name="sprints/[sprintId]" options={{ title: "Sprint", drawerItemStyle: { display: "none" } }} />
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
                isDark={isDark}
                onPress={() => openBottomTab(tab)}
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
  isDark,
  onPress
}: {
  tab: { key: string; label: string; icon: string; path: string };
  active: boolean;
  colors: { accent: string; textMuted: string; accentSoft: string; surfaceAlt: string; border: string };
  isDark: boolean;
  onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(active ? 1 : 0.96)).current;
  const lift = useRef(new Animated.Value(active ? -2 : 0)).current;
  const brand = TAB_BRAND_COLORS[(tab.key as AppTabKey) || "home"] || TAB_BRAND_COLORS.home;

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
          isCenter && [styles.bottomNavItemCenter, { backgroundColor: isDark ? brand.softDark : brand.softLight, borderColor: brand.border }],
          active && [styles.bottomNavItemActive, { backgroundColor: isDark ? brand.softDark : brand.softLight, borderColor: brand.border }],
          {
            transform: [{ scale }, { translateY: lift }]
          }
        ]}
      >
        <Ionicons name={tab.icon as any} size={isCenter ? 22 : 20} color={active ? brand.active : brand.inactive} />
        <Text style={[styles.bottomNavLabel, { color: active ? brand.active : brand.inactive }, active && styles.bottomNavLabelActive]}>{tab.label}</Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

function OrinStartupScreen({
  colors,
  title,
  subtitle,
  showSpinner = false,
  action
}: {
  colors: {
    background: string;
    surface: string;
    accent: string;
    accentText: string;
    text: string;
    textMuted: string;
    border: string;
  };
  title: string;
  subtitle: string;
  showSpinner?: boolean;
  action?: React.ReactNode;
}) {
  const pulse = useRef(new Animated.Value(1)).current;
  const glow = useRef(new Animated.Value(0.3)).current;
  const copyFade = useRef(new Animated.Value(0.65)).current;

  useEffect(() => {
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(pulse, {
            toValue: 1.08,
            duration: 850,
            useNativeDriver: true
          }),
          Animated.timing(glow, {
            toValue: 1,
            duration: 850,
            useNativeDriver: false
          }),
          Animated.timing(copyFade, {
            toValue: 1,
            duration: 850,
            useNativeDriver: true
          })
        ]),
        Animated.parallel([
          Animated.timing(pulse, {
            toValue: 1,
            duration: 850,
            useNativeDriver: true
          }),
          Animated.timing(glow, {
            toValue: 0.3,
            duration: 850,
            useNativeDriver: false
          }),
          Animated.timing(copyFade, {
            toValue: 0.7,
            duration: 850,
            useNativeDriver: true
          })
        ])
      ])
    );

    pulseLoop.start();
    return () => pulseLoop.stop();
  }, [copyFade, glow, pulse]);

  const haloScale = glow.interpolate({
    inputRange: [0.3, 1],
    outputRange: [1, 1.18]
  });

  return (
    <View style={[styles.loadingContainer, { backgroundColor: colors.background, paddingHorizontal: 24 }]}>
      <View style={styles.brandWrap}>
        <Animated.View
          style={[
            styles.brandHalo,
            {
              backgroundColor: colors.accent,
              opacity: glow.interpolate({
                inputRange: [0.3, 1],
                outputRange: [0.08, 0.18]
              }),
              transform: [{ scale: haloScale }]
            }
          ]}
        />
        <Animated.View style={{ transform: [{ scale: pulse }] }}>
          <Image source={require("../assets/images/splash-icon.png")} style={styles.brandLogo} resizeMode="contain" />
        </Animated.View>
      </View>
      <Text style={[styles.startupTitle, { color: colors.text }]}>{title}</Text>
      <Animated.Text style={[styles.startupSubtitle, { color: colors.textMuted, opacity: copyFade }]}>
        {subtitle}
      </Animated.Text>
      {showSpinner ? <ActivityIndicator size="small" color={colors.accent} style={styles.startupSpinner} /> : null}
      {action}
    </View>
  );
}

export default function Layout() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <LearnerProvider>
          <RootDrawer />
        </LearnerProvider>
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
  brandWrap: {
    width: 152,
    height: 152,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18
  },
  brandHalo: {
    position: "absolute",
    width: 132,
    height: 132,
    borderRadius: 66
  },
  brandLogo: {
    width: 108,
    height: 108,
    borderRadius: 24
  },
  startupTitle: {
    fontSize: 30,
    fontWeight: "900",
    letterSpacing: 0.4
  },
  startupSubtitle: {
    marginTop: 10,
    fontSize: 15,
    fontWeight: "600",
    textAlign: "center",
    maxWidth: 280,
    lineHeight: 22
  },
  startupSpinner: {
    marginTop: 18
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#1E2B24"
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 14
  },
  retryButtonText: {
    fontWeight: "800",
    fontSize: 14
  }
});
