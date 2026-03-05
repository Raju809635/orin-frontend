import React, { useCallback, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/lib/api";

type FeedPost = {
  _id: string;
  content: string;
  postType: string;
  likeCount?: number;
  commentCount?: number;
  shareCount?: number;
  saveCount?: number;
  isSaved?: boolean;
  authorId?: { _id?: string; name?: string; role?: string } | null;
};

export default function SavedPostsScreen() {
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async (refresh = false) => {
    try {
      if (refresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      const { data } = await api.get<FeedPost[]>("/api/network/feed/saved");
      setPosts(data || []);
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to load saved posts.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  async function toggleSave(postId: string) {
    try {
      await api.post(`/api/network/feed/${postId}/react`, { action: "save" });
      await loadData(true);
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to update saved post.");
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
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} />}
    >
      <Text style={styles.title}>Saved Posts</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {posts.length === 0 ? (
        <Text style={styles.empty}>No saved posts yet.</Text>
      ) : (
        posts.map((post) => (
          <View key={post._id} style={styles.card}>
            <Text style={styles.author}>{post.authorId?.name || "ORIN User"}</Text>
            <Text style={styles.meta}>{(post.authorId?.role || "member").toUpperCase()}</Text>
            <Text style={styles.content}>{post.content}</Text>
            <Text style={styles.meta}>
              {post.postType} | Likes {post.likeCount || 0} | Comments {post.commentCount || 0} | Shares {post.shareCount || 0}
            </Text>
            <TouchableOpacity style={styles.unsaveBtn} onPress={() => toggleSave(post._id)}>
              <Ionicons name="bookmark" size={16} color="#B42318" />
              <Text style={styles.unsaveText}>Remove from Saved</Text>
            </TouchableOpacity>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: "#F4F9F6", padding: 16, paddingBottom: 24 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#F4F9F6" },
  title: { fontSize: 24, fontWeight: "800", color: "#13251E", marginBottom: 10 },
  error: { color: "#B42318", marginBottom: 8 },
  empty: { color: "#667085" },
  card: {
    borderWidth: 1,
    borderColor: "#E4E7EC",
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    padding: 12,
    marginBottom: 10
  },
  author: { color: "#1E2B24", fontWeight: "800" },
  meta: { color: "#667085", marginTop: 4, fontSize: 12 },
  content: { color: "#344054", marginTop: 8, lineHeight: 19 },
  unsaveBtn: {
    marginTop: 10,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: "#F04438",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#FFF1F3"
  },
  unsaveText: { color: "#B42318", fontWeight: "700" }
});
