import React, { useEffect, useState } from "react";
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { notify } from "@/utils/notify";

type PublicUser = {
  _id: string;
  name: string;
  email: string;
  role: "student" | "mentor";
  status?: string;
  primaryCategory?: string;
  subCategory?: string;
  specializations?: string[];
};

type PublicProfile = {
  profilePhotoUrl?: string;
  title?: string;
  headline?: string;
  about?: string;
  bio?: string;
  skills?: string[];
  experienceYears?: number;
  rating?: number;
  careerGoals?: string;
};

type PublicProfileResponse = {
  user: PublicUser;
  profile: PublicProfile | null;
  social?: {
    followers?: number;
    following?: number;
    connections?: number;
    isFollowing?: boolean;
    followsYou?: boolean;
    connectionStatus?: "none" | "pending_incoming" | "pending_outgoing" | "accepted" | "rejected" | "blocked";
    connectionId?: string | null;
  };
  socialPreview?: {
    followers?: Array<{ _id?: string; name?: string; role?: string }>;
    following?: Array<{ _id?: string; name?: string; role?: string }>;
  };
};

export default function PublicProfileScreen() {
  const { user: viewer } = useAuth();
  const params = useLocalSearchParams<{ userId?: string }>();
  const userId = String(params.userId || "").trim();
  const [data, setData] = useState<PublicProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatingFollow, setUpdatingFollow] = useState(false);
  const [updatingConnection, setUpdatingConnection] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadProfile() {
      if (!userId) {
        setError("Missing user id.");
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        setError(null);
        const res = await api.get<PublicProfileResponse>(`/api/profiles/public/${userId}`);
        if (!mounted) return;
        setData(res.data);
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.response?.data?.message || "Failed to load profile.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadProfile();
    return () => {
      mounted = false;
    };
  }, [userId]);

  async function refreshProfile() {
    if (!userId) return;
    const res = await api.get<PublicProfileResponse>(`/api/profiles/public/${userId}`);
    setData(res.data);
  }

  async function toggleFollow() {
    if (!userId || !data || String(viewer?.id || "") === String(userId)) return;
    try {
      setUpdatingFollow(true);
      await api.post(`/api/network/follow/${userId}`);
      await refreshProfile();
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to update follow.");
    } finally {
      setUpdatingFollow(false);
    }
  }

  async function sendConnectionRequest() {
    if (!userId || !data || String(viewer?.id || "") === String(userId)) return;
    try {
      setUpdatingConnection(true);
      await api.post("/api/network/connections/request", { recipientId: userId });
      notify("Connection request sent.");
      await refreshProfile();
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to send request.");
    } finally {
      setUpdatingConnection(false);
    }
  }

  async function respondConnection(action: "accept" | "reject") {
    if (!data?.social?.connectionId) return;
    try {
      setUpdatingConnection(true);
      await api.post(`/api/network/connections/${data.social.connectionId}/respond`, { action });
      notify(`Request ${action}ed.`);
      await refreshProfile();
    } catch (e: any) {
      setError(e?.response?.data?.message || `Failed to ${action} request.`);
    } finally {
      setUpdatingConnection(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#1F7A4C" />
      </View>
    );
  }

  if (!data) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error || "Profile not found."}</Text>
      </View>
    );
  }

  const profile = data.profile || {};
  const displayLine = [data.user.primaryCategory, data.user.subCategory].filter(Boolean).join(" > ");
  const isSelf = String(viewer?.id || "") === String(data.user._id || "");
  const connectionStatus = data.social?.connectionStatus || "none";

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {profile.profilePhotoUrl ? (
        <Image source={{ uri: profile.profilePhotoUrl }} style={styles.avatar} />
      ) : (
        <View style={styles.avatarFallback}>
          <Text style={styles.avatarText}>{data.user.name?.charAt(0)?.toUpperCase() || "U"}</Text>
        </View>
      )}

      <Text style={styles.name}>{data.user.name}</Text>
      <Text style={styles.role}>{data.user.role}</Text>
      {profile.title || profile.headline ? <Text style={styles.title}>{profile.title || profile.headline}</Text> : null}
      {displayLine ? <Text style={styles.domain}>{displayLine}</Text> : null}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{data.social?.followers ?? 0}</Text>
          <Text style={styles.statLabel}>Followers</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{data.social?.following ?? 0}</Text>
          <Text style={styles.statLabel}>Following</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{data.social?.connections ?? 0}</Text>
          <Text style={styles.statLabel}>Connections</Text>
        </View>
      </View>
      {typeof profile.rating === "number" ? <Text style={styles.meta}>Rating: {profile.rating}</Text> : null}
      {typeof profile.experienceYears === "number" && profile.experienceYears > 0 ? (
        <Text style={styles.meta}>Experience: {profile.experienceYears} years</Text>
      ) : null}
      {!isSelf ? (
        <View style={styles.actionRow}>
          <TouchableOpacity style={[styles.actionBtn, styles.followBtn]} onPress={toggleFollow} disabled={updatingFollow}>
            <Text style={styles.followBtnText}>
              {updatingFollow ? "Updating..." : data.social?.isFollowing ? "Unfollow" : "Follow"}
            </Text>
          </TouchableOpacity>
          {connectionStatus === "none" || connectionStatus === "rejected" ? (
            <TouchableOpacity style={[styles.actionBtn, styles.connectBtn]} onPress={sendConnectionRequest} disabled={updatingConnection}>
              <Text style={styles.connectBtnText}>{updatingConnection ? "Sending..." : "Connect"}</Text>
            </TouchableOpacity>
          ) : null}
          {connectionStatus === "pending_outgoing" ? (
            <View style={[styles.actionBtn, styles.pendingBtn]}>
              <Text style={styles.pendingBtnText}>Request Sent</Text>
            </View>
          ) : null}
          {connectionStatus === "accepted" ? (
            <View style={[styles.actionBtn, styles.connectedBtn]}>
              <Text style={styles.connectedBtnText}>Connected</Text>
            </View>
          ) : null}
        </View>
      ) : null}
      {!isSelf && connectionStatus === "pending_incoming" ? (
        <View style={styles.actionRow}>
          <TouchableOpacity style={[styles.actionBtn, styles.connectBtn]} onPress={() => respondConnection("accept")} disabled={updatingConnection}>
            <Text style={styles.connectBtnText}>{updatingConnection ? "Updating..." : "Accept Request"}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, styles.rejectBtn]} onPress={() => respondConnection("reject")} disabled={updatingConnection}>
            <Text style={styles.rejectBtnText}>{updatingConnection ? "Updating..." : "Reject"}</Text>
          </TouchableOpacity>
        </View>
      ) : null}
      {!isSelf && data.social?.followsYou ? <Text style={styles.meta}>Follows you</Text> : null}

      <Text style={styles.sectionTitle}>About</Text>
      <Text style={styles.about}>{profile.about || profile.bio || "No profile summary yet."}</Text>

      {(profile.skills || []).length ? (
        <>
          <Text style={styles.sectionTitle}>Skills</Text>
          <View style={styles.chips}>
            {(profile.skills || []).map((item) => (
              <View key={item} style={styles.chip}>
                <Text style={styles.chipText}>{item}</Text>
              </View>
            ))}
          </View>
        </>
      ) : null}

      {(data.user.specializations || []).length ? (
        <>
          <Text style={styles.sectionTitle}>Specializations</Text>
          <View style={styles.chips}>
            {(data.user.specializations || []).map((item) => (
              <View key={item} style={styles.chip}>
                <Text style={styles.chipText}>{item}</Text>
              </View>
            ))}
          </View>
        </>
      ) : null}

      {(data.socialPreview?.followers || []).length ? (
        <>
          <Text style={styles.sectionTitle}>Followers</Text>
          {(data.socialPreview?.followers || []).slice(0, 8).map((item, idx) => (
            <Text key={`${item._id || idx}`} style={styles.meta}>
              {item.name || "User"} {item.role ? `(${item.role})` : ""}
            </Text>
          ))}
        </>
      ) : null}

      {(data.socialPreview?.following || []).length ? (
        <>
          <Text style={styles.sectionTitle}>Following</Text>
          {(data.socialPreview?.following || []).slice(0, 8).map((item, idx) => (
            <Text key={`${item._id || idx}`} style={styles.meta}>
              {item.name || "User"} {item.role ? `(${item.role})` : ""}
            </Text>
          ))}
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: "#F4F9F6", padding: 20, paddingBottom: 28 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#F4F9F6" },
  avatar: { width: 100, height: 100, borderRadius: 50, alignSelf: "center", borderWidth: 2, borderColor: "#CFE4D8" },
  avatarFallback: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#CFE4D8",
    backgroundColor: "#E8F5EE"
  },
  avatarText: { color: "#0B3D2E", fontSize: 36, fontWeight: "800" },
  name: { marginTop: 12, fontSize: 24, fontWeight: "800", color: "#1E2B24", textAlign: "center" },
  role: { marginTop: 4, color: "#667085", textTransform: "capitalize", textAlign: "center" },
  title: { marginTop: 4, color: "#344054", textAlign: "center" },
  domain: { marginTop: 4, color: "#1F7A4C", fontWeight: "700", textAlign: "center" },
  meta: { marginTop: 4, color: "#667085", textAlign: "center" },
  statsRow: { marginTop: 12, flexDirection: "row", gap: 8 },
  statCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E4E7EC",
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: "center"
  },
  statValue: { color: "#13251E", fontWeight: "800", fontSize: 16 },
  statLabel: { marginTop: 2, color: "#667085", fontSize: 11, fontWeight: "600" },
  actionRow: { marginTop: 10, flexDirection: "row", gap: 8 },
  actionBtn: { borderRadius: 999, paddingVertical: 8, paddingHorizontal: 12, alignItems: "center", justifyContent: "center" },
  followBtn: { backgroundColor: "#1F7A4C", flex: 1 },
  followBtnText: { color: "#fff", fontWeight: "700" },
  connectBtn: { backgroundColor: "#165DFF", flex: 1 },
  connectBtnText: { color: "#fff", fontWeight: "700" },
  pendingBtn: { backgroundColor: "#F2F4F7", borderWidth: 1, borderColor: "#D0D5DD", flex: 1 },
  pendingBtnText: { color: "#344054", fontWeight: "700" },
  connectedBtn: { backgroundColor: "#E7F5EE", borderWidth: 1, borderColor: "#CDE7D8", flex: 1 },
  connectedBtnText: { color: "#1F7A4C", fontWeight: "700" },
  rejectBtn: { backgroundColor: "#FFF1F3", borderWidth: 1, borderColor: "#F04438", flex: 1 },
  rejectBtnText: { color: "#B42318", fontWeight: "700" },
  sectionTitle: { marginTop: 18, marginBottom: 8, color: "#1E2B24", fontWeight: "800", fontSize: 16 },
  about: { color: "#344054", lineHeight: 20 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: "#D0D5DD",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#FFFFFF"
  },
  chipText: { color: "#344054", fontWeight: "600", fontSize: 12 },
  error: { color: "#B42318" }
});
