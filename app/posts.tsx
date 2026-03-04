import React, { useCallback, useState } from "react";
import { ActivityIndicator, Image, RefreshControl, ScrollView, Share, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
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
  isLiked?: boolean;
  isSaved?: boolean;
  userReaction?: ReactionType | null;
  reactionCounts?: Partial<Record<ReactionType, number>>;
  comments?: PostComment[];
  mediaUrls?: string[];
  authorId?: {
    name?: string;
    role?: "student" | "mentor";
  } | null;
  createdAt?: string;
};

type PostComment = {
  _id: string;
  content: string;
  authorId?: { name?: string } | null;
};

type ReactionType = "like" | "love" | "care" | "haha" | "wow" | "sad" | "angry";

const REACTIONS: { type: ReactionType; emoji: string; label: string }[] = [
  { type: "like", emoji: "👍", label: "Like" },
  { type: "love", emoji: "❤️", label: "Love" },
  { type: "care", emoji: "🤗", label: "Care" },
  { type: "haha", emoji: "😂", label: "Haha" },
  { type: "wow", emoji: "😮", label: "Wow" },
  { type: "sad", emoji: "😢", label: "Sad" },
  { type: "angry", emoji: "😡", label: "Angry" }
];

export default function PostsScreen() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [reactionPickerPostId, setReactionPickerPostId] = useState<string | null>(null);
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
      const post = posts.find((p) => p._id === postId);
      if (action === "share" && post?.content) {
        await Share.share({ message: `${post.content}\n\nShared via ORIN` });
      }
      await api.post(`/api/network/feed/${postId}/react`, { action });
      await loadPosts(true);
    } catch (e: any) {
      setError(e?.response?.data?.message || `Failed to ${action} post.`);
    }
  }

  async function reactWithType(postId: string, reactionType: ReactionType) {
    try {
      await api.post(`/api/network/feed/${postId}/react`, { action: "react", reactionType });
      setReactionPickerPostId(null);
      await loadPosts(true);
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to react.");
    }
  }

  function reactionSummary(post: Post) {
    const counts = post.reactionCounts || {};
    const active = REACTIONS.filter((item) => Number(counts[item.type] || 0) > 0);
    if (!active.length) return "No reactions yet";
    return active.map((item) => `${item.emoji} ${counts[item.type] || 0}`).join("  ");
  }

  async function comment(postId: string) {
    const content = (commentDrafts[postId] || "").trim();
    if (!content) return;
    try {
      await api.post(`/api/network/feed/${postId}/comment`, { content });
      setCommentDrafts((prev) => ({ ...prev, [postId]: "" }));
      await loadPosts(true);
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to comment.");
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
            {post.mediaUrls?.[0] ? <Image source={{ uri: post.mediaUrls[0] }} style={styles.postImage} resizeMode="cover" /> : null}
            <Text style={styles.reactionSummary}>{reactionSummary(post)}</Text>
            <Text style={styles.meta}>
              {post.postType} | Likes {post.likeCount || 0} | Comments {post.commentCount || 0} | Shares {post.shareCount || 0}
            </Text>
            <View style={styles.actions}>
              <TouchableOpacity onPress={() => setReactionPickerPostId((prev) => (prev === post._id ? null : post._id))}>
                <Text style={styles.action}>
                  {REACTIONS.find((item) => item.type === post.userReaction)?.emoji || "👍"}{" "}
                  {REACTIONS.find((item) => item.type === post.userReaction)?.label || "React"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => react(post._id, "save")}>
                <Text style={styles.action}>{post.isSaved ? "Saved" : "Save"}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => react(post._id, "share")}>
                <Text style={styles.action}>Share</Text>
              </TouchableOpacity>
            </View>
            {reactionPickerPostId === post._id ? (
              <View style={styles.reactionPickerRow}>
                {REACTIONS.map((reaction) => (
                  <TouchableOpacity key={reaction.type} style={styles.reactionChip} onPress={() => reactWithType(post._id, reaction.type)}>
                    <Text style={styles.reactionChipText}>{reaction.emoji}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}
            <View style={styles.commentComposer}>
              <TextInput
                style={styles.commentInput}
                placeholder="Add comment..."
                value={commentDrafts[post._id] || ""}
                onChangeText={(text) => setCommentDrafts((prev) => ({ ...prev, [post._id]: text }))}
              />
              <TouchableOpacity onPress={() => comment(post._id)}>
                <Text style={styles.action}>Post</Text>
              </TouchableOpacity>
            </View>
            {(post.comments || []).slice(0, 2).map((item) => (
              <Text key={item._id} style={styles.commentLine}>
                <Text style={{ fontWeight: "700", color: "#1E2B24" }}>{item.authorId?.name || "User"}: </Text>
                {item.content}
              </Text>
            ))}
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
  action: { color: "#175CD3", fontWeight: "700", fontSize: 12 },
  commentComposer: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#E4E7EC",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  commentInput: { flex: 1, minHeight: 32, color: "#344054" },
  commentLine: { marginTop: 6, color: "#475467" },
  postImage: { width: "100%", height: 220, borderRadius: 10, marginTop: 8, borderWidth: 1, borderColor: "#E4E7EC" },
  reactionSummary: { marginTop: 8, color: "#475467", fontWeight: "700", fontSize: 12 },
  reactionPickerRow: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#E4E7EC",
    backgroundColor: "#FCFCFD",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 6,
    flexDirection: "row",
    gap: 8
  },
  reactionChip: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  reactionChipText: { fontSize: 17 }
});
