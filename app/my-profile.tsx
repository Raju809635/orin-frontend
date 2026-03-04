import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Ionicons } from "@expo/vector-icons";

type NetworkOverview = {
  connections?: {
    accepted?: number;
    pendingIncoming?: number;
    pendingOutgoing?: number;
  };
  follow?: {
    followers?: number;
    following?: number;
  };
  reputation?: {
    score?: number;
    levelTag?: string;
  };
};

type ConnectionRow = {
  _id: string;
  requesterId?: { _id?: string; name?: string; role?: string } | null;
  recipientId?: { _id?: string; name?: string; role?: string } | null;
};

type FeedPost = {
  _id: string;
  content: string;
  postType: string;
  likeCount?: number;
  commentCount?: number;
  shareCount?: number;
  authorId?: { _id?: string; name?: string; role?: string } | null;
};

export default function MyProfileScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [overview, setOverview] = useState<NetworkOverview | null>(null);
  const [connections, setConnections] = useState<ConnectionRow[]>([]);
  const [myPosts, setMyPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const editRoute = useMemo(() => (user?.role === "mentor" ? "/mentor-profile" : "/student-profile"), [user?.role]);

  const loadProfileData = useCallback(async (refresh = false) => {
    try {
      if (refresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      const [overviewRes, connectionsRes, feedRes] = await Promise.allSettled([
        api.get<NetworkOverview>("/api/network/overview"),
        api.get<ConnectionRow[]>("/api/network/connections?status=accepted"),
        api.get<FeedPost[]>("/api/network/feed")
      ]);

      const overviewData = overviewRes.status === "fulfilled" ? overviewRes.value.data : null;
      const connectionData = connectionsRes.status === "fulfilled" ? connectionsRes.value.data || [] : [];
      const feedData = feedRes.status === "fulfilled" ? feedRes.value.data || [] : [];

      setOverview(overviewData);
      setConnections(connectionData);
      setMyPosts(feedData.filter((post) => String(post?.authorId?._id || "") === String(user?.id || "")));
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to load profile.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      loadProfileData();
    }, [loadProfileData])
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#1F7A4C" />
      </View>
    );
  }

  async function removePost(postId: string) {
    try {
      setDeletingPostId(postId);
      setError(null);
      await api.delete(`/api/network/feed/${postId}`);
      setMyPosts((prev) => prev.filter((item) => item._id !== postId));
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to delete post.");
    } finally {
      setDeletingPostId(null);
    }
  }

  function confirmDelete(postId: string) {
    Alert.alert("Delete post?", "This will permanently remove your post.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => removePost(postId) }
    ]);
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadProfileData(true)} />}
    >
      <View style={styles.headerCard}>
        <View style={styles.headerTop}>
          <View style={styles.avatarWrap}>
            <Text style={styles.avatarText}>{(user?.name || "O").charAt(0).toUpperCase()}</Text>
          </View>
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{myPosts.length}</Text>
              <Text style={styles.statLabel}>Posts</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{overview?.follow?.followers ?? 0}</Text>
              <Text style={styles.statLabel}>Followers</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{overview?.connections?.accepted ?? 0}</Text>
              <Text style={styles.statLabel}>Connections</Text>
            </View>
          </View>
        </View>
        <Text style={styles.name}>{user?.name || "ORIN User"}</Text>
        <Text style={styles.meta}>{user?.email || ""}</Text>
        <Text style={styles.metaRole}>{user?.role === "mentor" ? "Mentor" : "Student"}</Text>
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.primaryButton} onPress={() => router.push(editRoute as never)}>
            <Text style={styles.primaryButtonText}>Edit Profile</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={() => router.push("/settings" as never)}>
            <Text style={styles.secondaryButtonText}>Settings</Text>
          </TouchableOpacity>
        </View>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Reputation</Text>
        <Text style={styles.meta}>Score: {overview?.reputation?.score ?? 0}</Text>
        <Text style={styles.meta}>Tag: {overview?.reputation?.levelTag || "Starter"}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>My Connections</Text>
        {connections.length === 0 ? (
          <Text style={styles.meta}>No accepted connections yet.</Text>
        ) : (
          connections.slice(0, 20).map((item) => {
            const isRequester = String(item.requesterId?._id || "") === String(user?.id || "");
            const other = isRequester ? item.recipientId : item.requesterId;
            return (
              <View key={item._id} style={styles.rowItem}>
                <Text style={styles.rowName}>{other?.name || "Connection"}</Text>
                <Text style={styles.rowRole}>{other?.role || "member"}</Text>
              </View>
            );
          })
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>My Posts</Text>
        {myPosts.length === 0 ? (
          <Text style={styles.meta}>No posts yet.</Text>
        ) : (
          myPosts.map((post) => (
            <View key={post._id} style={styles.postCard}>
              <View style={styles.postTop}>
                <Ionicons name="apps" size={18} color="#475467" />
                <TouchableOpacity
                  style={styles.deleteBtn}
                  onPress={() => confirmDelete(post._id)}
                  disabled={deletingPostId === post._id}
                >
                  <Text style={styles.deleteBtnText}>{deletingPostId === post._id ? "Deleting..." : "Delete"}</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.postText}>{post.content}</Text>
              <Text style={styles.meta}>
                {post.postType} | Likes {post.likeCount || 0} | Comments {post.commentCount || 0} | Shares {post.shareCount || 0}
              </Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: "#F3F5F7", padding: 16, paddingBottom: 28 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#F3F5F7" },
  headerCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E4E7EC",
    borderRadius: 14,
    padding: 14
  },
  headerTop: { flexDirection: "row", alignItems: "center" },
  avatarWrap: {
    width: 78,
    height: 78,
    borderRadius: 39,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E8F5EE",
    borderWidth: 2,
    borderColor: "#CDE7D8"
  },
  avatarText: { color: "#0B3D2E", fontWeight: "800", fontSize: 28 },
  name: { fontSize: 24, fontWeight: "800", color: "#13251E" },
  meta: { marginTop: 4, color: "#667085" },
  metaRole: { marginTop: 2, color: "#175CD3", fontWeight: "700", textTransform: "capitalize" },
  actionRow: { flexDirection: "row", gap: 8, marginTop: 12 },
  primaryButton: {
    flex: 1,
    backgroundColor: "#1F7A4C",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center"
  },
  primaryButtonText: { color: "#fff", fontWeight: "700" },
  secondaryButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#D0D5DD",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    backgroundColor: "#fff"
  },
  secondaryButtonText: { color: "#344054", fontWeight: "700" },
  error: { marginTop: 8, color: "#B42318" },
  statsRow: { flexDirection: "row", gap: 8, marginLeft: 10, flex: 1 },
  statCard: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E4E7EC",
    borderRadius: 12,
    paddingVertical: 8,
    alignItems: "center"
  },
  statValue: { fontSize: 16, fontWeight: "800", color: "#1E2B24" },
  statLabel: { marginTop: 2, color: "#667085", fontWeight: "600", fontSize: 11 },
  card: {
    marginTop: 12,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E4E7EC",
    borderRadius: 12,
    padding: 12
  },
  cardTitle: { color: "#1E2B24", fontWeight: "800", fontSize: 16, marginBottom: 8 },
  rowItem: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#F2F4F7" },
  rowName: { color: "#1E2B24", fontWeight: "700" },
  rowRole: { color: "#667085", textTransform: "capitalize", marginTop: 2 },
  postCard: { borderWidth: 1, borderColor: "#E4E7EC", borderRadius: 10, padding: 10, marginBottom: 8 },
  postTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  deleteBtn: {
    borderWidth: 1,
    borderColor: "#F04438",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: "#FFF1F3"
  },
  deleteBtnText: { color: "#B42318", fontWeight: "700", fontSize: 12 },
  postText: { color: "#344054", lineHeight: 19 }
});
