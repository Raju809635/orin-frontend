import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
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

type FeedPost = {
  _id: string;
  content: string;
  postType: string;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  saveCount: number;
  authorId?: { _id?: string; name?: string; role?: string } | null;
};

type Suggestion = {
  id: string;
  name: string;
  role: "student" | "mentor";
  reason: string;
};

type DailyDashboard = {
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
  const [daily, setDaily] = useState<DailyDashboard | null>(null);
  const [postText, setPostText] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
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

      setPosts(feedRes.status === "fulfilled" ? feedRes.value.data || [] : []);
      setSuggestions(suggestionsRes.status === "fulfilled" ? suggestionsRes.value.data || [] : []);
      setDaily(dailyRes.status === "fulfilled" ? dailyRes.value.data || null : null);
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to load network.");
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
        postType: "learning_progress",
        visibility: "public"
      });
      setPostText("");
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
      await api.post(`/api/network/feed/${postId}/react`, { action });
      await loadData(true);
    } catch (e: any) {
      setError(e?.response?.data?.message || `Failed to ${action} post.`);
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
        <TextInput
          style={styles.input}
          placeholder="Share update, achievement, project or question..."
          value={postText}
          onChangeText={setPostText}
          multiline
        />
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
              <Text style={styles.meta}>
                {post.postType} | Likes {post.likeCount || 0} | Comments {post.commentCount || 0}
              </Text>
              <View style={styles.actionRow}>
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
  meta: { color: "#667085", marginTop: 4 },
  rowItem: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 10 },
  rowTitle: { color: "#1E2B24", fontWeight: "700" },
  action: { color: "#175CD3", fontWeight: "700" },
  postCard: { borderWidth: 1, borderColor: "#E4E7EC", borderRadius: 10, padding: 10, marginBottom: 8 },
  postText: { marginTop: 4, color: "#344054", lineHeight: 18 },
  actionRow: { marginTop: 8, flexDirection: "row", gap: 12 }
});
