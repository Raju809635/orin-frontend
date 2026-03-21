import React, { useCallback, useState } from "react";
import {
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useNavigation, useRouter } from "expo-router";
import { DrawerActions } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";

type GlobalHeaderProps = {
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  onSubmitSearch?: () => void;
  searchPlaceholder?: string;
};

type Conversation = {
  unreadCount?: number;
};

type NotificationItem = {
  readByRecipient?: boolean;
};

export default function GlobalHeader({
  searchValue,
  onSearchChange,
  onSubmitSearch,
  searchPlaceholder = "Search ORIN"
}: GlobalHeaderProps) {
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [profilePhotoUrl, setProfilePhotoUrl] = useState("");
  const [messageUnreadCount, setMessageUnreadCount] = useState(0);
  const [notificationUnreadCount, setNotificationUnreadCount] = useState(0);
  const [localSearchValue, setLocalSearchValue] = useState("");

  useFocusEffect(
    useCallback(() => {
      let active = true;

      async function loadHeaderState() {
        if (!user) return;
        try {
          const profileEndpoint = user.role === "mentor" ? "/api/profiles/mentor/me" : "/api/profiles/student/me";
          const [profileRes, conversationsRes, notificationsRes] = await Promise.allSettled([
            api.get<{ profile?: { profilePhotoUrl?: string } }>(profileEndpoint),
            api.get<Conversation[]>("/api/chat/conversations"),
            api.get<NotificationItem[]>("/api/messages/notifications?limit=50")
          ]);

          if (!active) return;

          setProfilePhotoUrl(
            profileRes.status === "fulfilled" ? profileRes.value.data?.profile?.profilePhotoUrl || "" : ""
          );

          const unreadMessages =
            conversationsRes.status === "fulfilled"
              ? (conversationsRes.value.data || []).reduce(
                  (sum, item) => sum + Number(item?.unreadCount || 0),
                  0
                )
              : 0;
          setMessageUnreadCount(unreadMessages);

          const unreadNotifications =
            notificationsRes.status === "fulfilled"
              ? (notificationsRes.value.data || []).filter((item) => item?.readByRecipient === false).length
              : 0;
          setNotificationUnreadCount(unreadNotifications);
        } catch {
          if (!active) return;
          setProfilePhotoUrl("");
          setMessageUnreadCount(0);
          setNotificationUnreadCount(0);
        }
      }

      loadHeaderState();
      return () => {
        active = false;
      };
    }, [user?.id, user?.role])
  );

  const currentSearchValue = searchValue ?? localSearchValue;

  function handleSearchChange(value: string) {
    if (onSearchChange) onSearchChange(value);
    else setLocalSearchValue(value);
  }

  return (
    <View style={[styles.safeWrap, { paddingTop: insets.top + 8 }]}>
      <View style={styles.row}>
        <View style={styles.leftCluster}>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
          >
            <Ionicons name="menu" size={20} color="#1E2B24" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.avatarTap} onPress={() => router.push("/my-profile" as never)}>
            {profilePhotoUrl ? (
              <Image source={{ uri: profilePhotoUrl }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Text style={styles.avatarFallbackText}>{user?.name?.charAt(0)?.toUpperCase() || "O"}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.searchWrap}>
          <Ionicons name="search" size={18} color="#667085" />
          <TextInput
            style={styles.searchInput}
            placeholder={searchPlaceholder}
            placeholderTextColor="#98A2B3"
            value={currentSearchValue}
            onChangeText={handleSearchChange}
            onSubmitEditing={onSubmitSearch}
            returnKeyType="search"
          />
        </View>

        <TouchableOpacity style={styles.messageButton} onPress={() => router.push("/chat" as never)}>
          <Ionicons name="chatbubble-ellipses-outline" size={22} color="#1E2B24" />
          {messageUnreadCount > 0 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{messageUnreadCount > 99 ? "99+" : messageUnreadCount}</Text>
            </View>
          ) : notificationUnreadCount > 0 ? (
            <View style={styles.dotBadge} />
          ) : null}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeWrap: {
    backgroundColor: "#F4F9F6",
    paddingHorizontal: 16,
    paddingBottom: 12
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  leftCluster: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E4E7EC"
  },
  avatarTap: {
    borderRadius: 20
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#D0D5DD"
  },
  avatarFallback: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EAF6EF"
  },
  avatarFallbackText: {
    color: "#1F7A4C",
    fontWeight: "800"
  },
  searchWrap: {
    flex: 1,
    minHeight: 46,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#D0D5DD",
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    gap: 8
  },
  searchInput: {
    flex: 1,
    color: "#101828",
    fontSize: 14
  },
  messageButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E4E7EC"
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: "#F04438",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#FFFFFF"
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800"
  },
  dotBadge: {
    position: "absolute",
    top: 6,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#F04438",
    borderWidth: 1,
    borderColor: "#FFFFFF"
  }
});
