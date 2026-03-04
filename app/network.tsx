import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Image,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { useFocusEffect } from "expo-router";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { notify } from "@/utils/notify";
import { pickAndUploadPostImage } from "@/utils/postMediaUpload";

type FeedPost = {
  _id: string;
  content: string;
  postType: string;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  saveCount: number;
  isLiked?: boolean;
  isSaved?: boolean;
  userReaction?: ReactionType | null;
  reactionCounts?: Partial<Record<ReactionType, number>>;
  comments?: FeedComment[];
  createdAt?: string;
  mediaUrls?: string[];
  authorId?: { _id?: string; name?: string; role?: string } | null;
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

type FeedComment = {
  _id: string;
  content: string;
  createdAt?: string;
  authorId?: { _id?: string; name?: string; role?: string } | null;
};

type Suggestion = {
  id: string;
  name: string;
  role: "student" | "mentor";
  reason: string;
};

type ConnectionRow = {
  _id: string;
  requesterId?: { _id?: string; name?: string; role?: string } | null;
  recipientId?: { _id?: string; name?: string; role?: string } | null;
  status: "pending" | "accepted" | "rejected" | "blocked";
};

type DailyTask = {
  key: string;
  title: string;
  xp: number;
  completed: boolean;
};

type DailyDashboard = {
  tasks?: DailyTask[];
  streakDays: number;
  xp: number;
  levelTag: string;
  reputationScore: number;
  leaderboard?: { globalRank?: number | null; collegeRank?: number | null };
};

export default function NetworkScreen() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [pendingIncoming, setPendingIncoming] = useState<ConnectionRow[]>([]);
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [reactionPickerPostId, setReactionPickerPostId] = useState<string | null>(null);
  const [daily, setDaily] = useState<DailyDashboard | null>(null);
  const [postText, setPostText] = useState("");
  const [postImageUrl, setPostImageUrl] = useState<string | null>(null);
  const [postType, setPostType] = useState<FeedPost["postType"]>("learning_progress");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingPostImage, setUploadingPostImage] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async (refresh = false) => {
    try {
      if (refresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      const [feedRes, suggestionsRes, dailyRes] = await Promise.allSettled([
        api.get<FeedPost[]>("/api/network/feed"),
        api.get<Suggestion[]>("/api/network/suggestions"),
        api.get<DailyDashboard>("/api/network/daily-dashboard")
      ]);
      const pendingRes = await api.get<ConnectionRow[]>("/api/network/connections?status=pending");

      setPosts(feedRes.status === "fulfilled" ? feedRes.value.data || [] : []);
      setSuggestions(suggestionsRes.status === "fulfilled" ? suggestionsRes.value.data || [] : []);
      setDaily(dailyRes.status === "fulfilled" ? dailyRes.value.data || null : null);
      setPendingIncoming(
        (pendingRes.data || []).filter((item) => String(item?.recipientId?._id || "") === String(user?.id || ""))
      );
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to load network.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  async function publishPost() {
    const content = postText.trim();
    if (!content) {
      setError("Post content is required.");
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      await api.post("/api/network/feed", {
        content,
        postType,
        mediaUrls: postImageUrl ? [postImageUrl] : [],
        visibility: "public"
      });
      setPostText("");
      setPostImageUrl(null);
      notify("Post published.");
      await loadData(true);
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to publish post.");
    } finally {
      setSubmitting(false);
    }
  }

  async function react(postId: string, action: "like" | "save" | "share") {
    try {
      const post = posts.find((p) => p._id === postId);
      if (action === "share" && post?.content) {
        await Share.share({
          message: `${post.content}\n\nShared via ORIN`
        });
      }
      await api.post(`/api/network/feed/${postId}/react`, { action });
      await loadData(true);
    } catch (e: any) {
      setError(e?.response?.data?.message || `Failed to ${action} post.`);
    }
  }

  async function reactWithType(postId: string, reactionType: ReactionType) {
    try {
      await api.post(`/api/network/feed/${postId}/react`, { action: "react", reactionType });
      setReactionPickerPostId(null);
      await loadData(true);
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to react.");
    }
  }

  function reactionSummary(post: FeedPost) {
    const counts = post.reactionCounts || {};
    const active = REACTIONS.filter((item) => Number(counts[item.type] || 0) > 0);
    if (!active.length) return "No reactions yet";
    return active
      .map((item) => `${item.emoji} ${counts[item.type] || 0}`)
      .join("  ");
  }

  async function uploadPostImage() {
    try {
      setUploadingPostImage(true);
      const uploadedUrl = await pickAndUploadPostImage();
      if (!uploadedUrl) return;
      setPostImageUrl(uploadedUrl);
      notify("Post image added.");
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || "Failed to upload post image.");
    } finally {
      setUploadingPostImage(false);
    }
  }

  async function comment(postId: string) {
    const content = (commentDrafts[postId] || "").trim();
    if (!content) return;
    try {
      await api.post(`/api/network/feed/${postId}/comment`, { content });
      setCommentDrafts((prev) => ({ ...prev, [postId]: "" }));
      await loadData(true);
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to comment.");
    }
  }

  async function connect(recipientId: string) {
    try {
      await api.post("/api/network/connections/request", { recipientId });
      notify("Connection request sent.");
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to send connection request.");
    }
  }

  async function follow(userId: string) {
    try {
      const { data } = await api.post<{ following: boolean }>(`/api/network/follow/${userId}`);
      notify(data?.following ? "Now following." : "Unfollowed.");
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to update follow.");
    }
  }

  async function respondConnection(connectionId: string, action: "accept" | "reject") {
    try {
      await api.post(`/api/network/connections/${connectionId}/respond`, { action });
      notify(`Request ${action}ed.`);
      await loadData(true);
    } catch (e: any) {
      setError(e?.response?.data?.message || `Failed to ${action} request.`);
    }
  }

  async function completeTask(taskKey: string) {
    try {
      await api.post("/api/network/daily-task/complete", { taskKey });
      notify("Task completed.");
      await loadData(true);
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to complete task.");
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
      <Text style={styles.heading}>Network</Text>
      <Text style={styles.subheading}>
        {user?.role === "mentor" ? "Share mentor insights and grow your presence." : "Build your learning network and share progress."}
      </Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Create Post</Text>
        <View style={styles.chipsRow}>
          {[
            ["learning_progress", "Learning"],
            ["project_update", "Project"],
            ["achievement", "Achievement"],
            ["question", "Question"]
          ].map(([value, label]) => (
            <TouchableOpacity
              key={value}
              style={[styles.chip, postType === value ? styles.chipActive : null]}
              onPress={() => setPostType(value as FeedPost["postType"])}
            >
              <Text style={[styles.chipText, postType === value ? styles.chipTextActive : null]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TextInput
          style={styles.input}
          placeholder="Share update, achievement, project or question..."
          value={postText}
          onChangeText={setPostText}
          multiline
        />
        <View style={styles.rowItem}>
          <TouchableOpacity style={styles.secondaryButton} onPress={uploadPostImage} disabled={uploadingPostImage}>
            <Text style={styles.secondaryButtonText}>{uploadingPostImage ? "Uploading..." : "Add Photo"}</Text>
          </TouchableOpacity>
          {postImageUrl ? (
            <TouchableOpacity
              onPress={() => setPostImageUrl(null)}
              style={[styles.secondaryButton, { borderColor: "#F04438" }]}
            >
              <Text style={[styles.secondaryButtonText, { color: "#B42318" }]}>Remove</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        {postImageUrl ? <Image source={{ uri: postImageUrl }} style={styles.composerPreview} resizeMode="cover" /> : null}
        <TouchableOpacity style={styles.primaryButton} onPress={publishPost} disabled={submitting}>
          <Text style={styles.primaryButtonText}>{submitting ? "Posting..." : "Publish Post"}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Reputation & Daily Progress</Text>
        <Text style={styles.meta}>Reputation Score: {daily?.reputationScore ?? 0}</Text>
        <Text style={styles.meta}>Level: {daily?.levelTag ?? "Starter"}</Text>
        <Text style={styles.meta}>Streak: {daily?.streakDays ?? 0} days | XP: {daily?.xp ?? 0}</Text>
        <Text style={styles.meta}>
          Leaderboard: College #{daily?.leaderboard?.collegeRank ?? "-"} | Global #{daily?.leaderboard?.globalRank ?? "-"}
        </Text>
        <View style={{ marginTop: 8 }}>
          {(daily?.tasks || []).map((task) => (
            <View key={task.key} style={styles.taskRow}>
              <Text style={styles.taskTitle}>
                {task.title} (+{task.xp} XP)
              </Text>
              <TouchableOpacity
                style={[styles.taskButton, task.completed ? styles.taskButtonDone : null]}
                onPress={() => completeTask(task.key)}
                disabled={task.completed}
              >
                <Text style={styles.taskButtonText}>{task.completed ? "Done" : "Complete"}</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Pending Requests</Text>
        {pendingIncoming.length === 0 ? (
          <Text style={styles.meta}>No pending requests.</Text>
        ) : (
          pendingIncoming.map((item) => (
            <View key={item._id} style={styles.rowItem}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{item.requesterId?.name || "User"}</Text>
                <Text style={styles.meta}>Wants to connect with you</Text>
              </View>
              <TouchableOpacity onPress={() => respondConnection(item._id, "accept")}>
                <Text style={styles.action}>Accept</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => respondConnection(item._id, "reject")}>
                <Text style={styles.actionDanger}>Reject</Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>People You May Know</Text>
        {suggestions.length === 0 ? (
          <Text style={styles.meta}>No suggestions yet.</Text>
        ) : (
          suggestions.slice(0, 12).map((item) => (
            <View key={item.id} style={styles.rowItem}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{item.name}</Text>
                <Text style={styles.meta}>{item.reason}</Text>
              </View>
              <TouchableOpacity onPress={() => connect(item.id)}>
                <Text style={styles.action}>Connect</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => follow(item.id)}>
                <Text style={styles.action}>Follow</Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Activity Feed</Text>
        {posts.length === 0 ? (
          <Text style={styles.meta}>No posts yet. Create the first one.</Text>
        ) : (
          posts.map((post) => (
            <View key={post._id} style={styles.postCard}>
              <Text style={styles.rowTitle}>{post.authorId?.name || "ORIN User"}</Text>
              <Text style={styles.postText}>{post.content}</Text>
              {post.mediaUrls?.[0] ? <Image source={{ uri: post.mediaUrls[0] }} style={styles.postImage} resizeMode="cover" /> : null}
              <Text style={styles.reactionSummary}>{reactionSummary(post)}</Text>
              <Text style={styles.meta}>
                {post.postType} | Likes {post.likeCount || 0} | Comments {post.commentCount || 0} | Shares {post.shareCount || 0}
              </Text>
              <View style={styles.actionRow}>
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
                    <TouchableOpacity
                      key={reaction.type}
                      style={styles.reactionChip}
                      onPress={() => reactWithType(post._id, reaction.type)}
                    >
                      <Text style={styles.reactionChipText}>{reaction.emoji}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : null}
              <View style={styles.commentComposer}>
                <TextInput
                  style={styles.commentInput}
                  placeholder="Write a comment..."
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
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: "#F3F5F7", padding: 16, paddingBottom: 30 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#F3F5F7" },
  heading: { fontSize: 26, fontWeight: "800", color: "#13251E" },
  subheading: { marginTop: 4, marginBottom: 12, color: "#475467" },
  error: { color: "#B42318", marginBottom: 8 },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E4E7EC",
    padding: 12,
    marginBottom: 10
  },
  cardTitle: { fontSize: 16, fontWeight: "800", color: "#1E2B24", marginBottom: 8 },
  input: {
    minHeight: 84,
    borderWidth: 1,
    borderColor: "#D0D5DD",
    borderRadius: 10,
    backgroundColor: "#fff",
    paddingHorizontal: 10,
    paddingVertical: 9,
    textAlignVertical: "top"
  },
  primaryButton: { marginTop: 10, backgroundColor: "#1F7A4C", borderRadius: 10, alignItems: "center", paddingVertical: 10 },
  primaryButtonText: { color: "#fff", fontWeight: "700" },
  secondaryButton: {
    borderWidth: 1,
    borderColor: "#D0D5DD",
    backgroundColor: "#fff",
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12
  },
  secondaryButtonText: { color: "#344054", fontWeight: "700" },
  meta: { color: "#667085", marginTop: 4 },
  rowItem: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 10 },
  rowTitle: { color: "#1E2B24", fontWeight: "700" },
  action: { color: "#175CD3", fontWeight: "700" },
  actionDanger: { color: "#B42318", fontWeight: "700" },
  postCard: { borderWidth: 1, borderColor: "#E4E7EC", borderRadius: 10, padding: 10, marginBottom: 8 },
  postText: { marginTop: 4, color: "#344054", lineHeight: 18 },
  actionRow: { marginTop: 8, flexDirection: "row", gap: 12 },
  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 10 },
  chip: {
    borderWidth: 1,
    borderColor: "#D0D5DD",
    backgroundColor: "#fff",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  chipActive: { borderColor: "#1F7A4C", backgroundColor: "#EAF6EF" },
  chipText: { color: "#475467", fontWeight: "600", fontSize: 12 },
  chipTextActive: { color: "#1F7A4C" },
  taskRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  taskTitle: { color: "#344054", flex: 1, marginRight: 8 },
  taskButton: { backgroundColor: "#175CD3", borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10 },
  taskButtonDone: { backgroundColor: "#12B76A" },
  taskButtonText: { color: "#fff", fontWeight: "700", fontSize: 12 },
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
  composerPreview: { width: "100%", height: 170, borderRadius: 10, marginTop: 10, borderWidth: 1, borderColor: "#E4E7EC" },
  postImage: { width: "100%", height: 210, borderRadius: 10, marginTop: 8, borderWidth: 1, borderColor: "#E4E7EC" },
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
