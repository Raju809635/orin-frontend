import React, { useCallback, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { api } from "@/lib/api";

type Post = {
  _id: string;
  content: string;
  postType: string;
  likeCount?: number;
  commentCount?: number;
  shareCount?: number;
  saveCount?: number;
  authorId?: {
    name?: string;
    role?: "student" | "mentor";
  } | null;
  createdAt?: string;
};

export default function PostsScreen() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPosts = useCallback(async (refresh = false) => {
    try {
      if (refresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const { data } = await api.get<Post[]>("/api/network/feed/public");
        setPosts(data || []);
      } catch (e: any) {
        const message = e?.response?.data?.message || "";
        const status = e?.response?.status;
        if (status === 404 || message.toLowerCase().includes("route not found")) {
          const fallback = await api.get<Post[]>("/api/network/feed");
          const publicPosts = (fallback.data || []).filter((post) => post?.postType || post?.content);
          setPosts(publicPosts);
          setError("Public feed route not deployed yet. Showing latest feed.");
        } else {
          throw e;
        }
      }
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to load public posts.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadPosts();
    }, [loadPosts])
  );

  async function react(postId: string, action: "like" | "save" | "share") {
    try {
      await api.post(`/api/network/feed/${postId}/react`, { action });
      await loadPosts(true);
    } catch (e: any) {
      setError(e?.response?.data?.message || `Failed to ${action} post.`);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#1F7A4C" />
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadPosts(true)} />}
    >
      <Text style={styles.heading}>Public Posts</Text>
      <Text style={styles.subheading}>Explore public updates from students and mentors.</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {posts.length === 0 ? (
        <Text style={styles.empty}>No public posts yet.</Text>
      ) : (
        posts.map((post) => (
          <View key={post._id} style={styles.card}>
            <Text style={styles.author}>{post.authorId?.name || "ORIN User"}</Text>
            <Text style={styles.role}>{post.authorId?.role || "member"}</Text>
            <Text style={styles.content}>{post.content}</Text>
            <Text style={styles.meta}>
              {post.postType} | Likes {post.likeCount || 0} | Comments {post.commentCount || 0}
            </Text>
            <View style={styles.actions}>
              <TouchableOpacity onPress={() => react(post._id, "like")}>
                <Text style={styles.action}>Like</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => react(post._id, "save")}>
                <Text style={styles.action}>Save</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => react(post._id, "share")}>
                <Text style={styles.action}>Share</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: "#F3F5F7", padding: 16, paddingBottom: 28 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#F3F5F7" },
  heading: { fontSize: 26, fontWeight: "800", color: "#13251E" },
  subheading: { marginTop: 4, marginBottom: 10, color: "#475467" },
  error: { color: "#B42318", marginBottom: 8 },
  empty: { color: "#667085", marginTop: 14 },
  card: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E4E7EC",
    borderRadius: 12,
    padding: 12,
    marginBottom: 10
  },
  author: { color: "#1E2B24", fontWeight: "800" },
  role: { marginTop: 2, color: "#667085", fontSize: 12, textTransform: "capitalize" },
  content: { marginTop: 8, color: "#344054", lineHeight: 19 },
  meta: { marginTop: 6, color: "#667085", fontSize: 12, fontWeight: "600" },
  actions: { marginTop: 8, flexDirection: "row", gap: 12 },
  action: { color: "#175CD3", fontWeight: "700", fontSize: 12 }
});
