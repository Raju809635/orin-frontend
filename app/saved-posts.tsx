import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/lib/api";
import { useAppTheme } from "@/context/ThemeContext";
import GlobalHeader from "@/components/global-header";
import { sanitizeDisplayText } from "@/utils/textSanitize";

type FeedPost = {
  _id: string;
  content: string;
  postType: string;
  likeCount?: number;
  commentCount?: number;
  shareCount?: number;
  saveCount?: number;
  isSaved?: boolean;
  createdAt?: string;
  mediaUrls?: string[];
  authorId?: {
    _id?: string;
    name?: string;
    role?: string;
    profilePhotoUrl?: string;
  } | null;
};

const { width } = Dimensions.get("window");
const MEDIA_WIDTH = width - 32;

function formatPostTime(dateValue?: string) {
  if (!dateValue) return "";
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString();
}

export default function SavedPostsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ search?: string }>();
  const { colors } = useAppTheme();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mediaSizeByUrl, setMediaSizeByUrl] = useState<Record<string, { width: number; height: number }>>({});
  const [searchQuery, setSearchQuery] = useState("");

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

  useEffect(() => {
    setSearchQuery(String(params.search || "").trim());
  }, [params.search]);

  useEffect(() => {
    let cancelled = false;
    const missingMedia = posts
      .flatMap((post) => post.mediaUrls || [])
      .filter((uri) => uri && !mediaSizeByUrl[uri])
      .slice(0, 30);

    if (!missingMedia.length) return;

    missingMedia.forEach((uri) => {
      Image.getSize(
        uri,
        (imageWidth, imageHeight) => {
          if (cancelled) return;
          setMediaSizeByUrl((prev) =>
            prev[uri] ? prev : { ...prev, [uri]: { width: imageWidth, height: imageHeight } }
          );
        },
        () => undefined
      );
    });

    return () => {
      cancelled = true;
    };
  }, [mediaSizeByUrl, posts]);

  function getImageHeight(uri: string) {
    const size = mediaSizeByUrl[uri];
    if (!size?.width || !size?.height) return 320;
    const ratio = size.width / size.height;
    const computedHeight = MEDIA_WIDTH / ratio;
    return Math.max(220, Math.min(520, computedHeight));
  }

  async function toggleSave(postId: string) {
    try {
      await api.post(`/api/network/feed/${postId}/react`, { action: "save" });
      await loadData(true);
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to update saved post.");
    }
  }

  const filteredPosts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return posts;
    return posts.filter((post) => {
      const author = String(post.authorId?.name || "").toLowerCase();
      const role = String(post.authorId?.role || "").toLowerCase();
      const content = sanitizeDisplayText(post.content || "").toLowerCase();
      const type = String(post.postType || "").toLowerCase();
      return author.includes(query) || role.includes(query) || content.includes(query) || type.includes(query);
    });
  }, [posts, searchQuery]);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <GlobalHeader searchValue={searchQuery} onSearchChange={setSearchQuery} searchPlaceholder="Search saved posts" />
      <ScrollView
        contentContainerStyle={[styles.container, { backgroundColor: colors.background }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} tintColor={colors.accent} />}
      >
        <Text style={[styles.title, { color: colors.text }]}>Saved Posts</Text>
        <Text style={[styles.subTitle, { color: colors.textMuted }]}>Everything you saved stays here as a full post, not just a text summary.</Text>
        {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}

        {filteredPosts.length === 0 ? (
          <Text style={[styles.empty, { color: colors.textMuted }]}>
            {searchQuery.trim() ? "No saved posts match your search." : "No saved posts yet."}
          </Text>
        ) : (
          filteredPosts.map((post) => {
            const media = (post.mediaUrls || []).filter(Boolean);
            const authorName = post.authorId?.name || "ORIN User";
            const authorRole = (post.authorId?.role || "member").toUpperCase();
            return (
              <View key={post._id} style={styles.postWrap}>
                <TouchableOpacity
                  style={styles.authorRow}
                  onPress={() => (post.authorId?._id ? router.push(`/public-profile/${post.authorId._id}` as never) : undefined)}
                  disabled={!post.authorId?._id}
                >
                  {post.authorId?.profilePhotoUrl ? (
                    <Image source={{ uri: post.authorId.profilePhotoUrl }} style={styles.avatar} />
                  ) : (
                    <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: colors.accentSoft, borderColor: colors.border }]}>
                      <Text style={[styles.avatarText, { color: colors.accent }]}>
                        {authorName.trim().charAt(0).toUpperCase() || "U"}
                      </Text>
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.authorName, { color: colors.text }]}>{authorName}</Text>
                    <Text style={[styles.meta, { color: colors.textMuted }]}>
                      {authorRole} {post.createdAt ? `| ${formatPostTime(post.createdAt)}` : ""}
                    </Text>
                  </View>
                </TouchableOpacity>

                <Text style={[styles.content, { color: colors.text }]}>{sanitizeDisplayText(post.content || "")}</Text>

                {media.map((uri, idx) => (
                  <Image
                    key={`${post._id}-${idx}`}
                    source={{ uri }}
                    style={[styles.mediaImage, { height: getImageHeight(uri) }]}
                    resizeMode="cover"
                  />
                ))}

                <Text style={[styles.stats, { color: colors.textMuted }]}>
                  Likes {post.likeCount || 0} | Comments {post.commentCount || 0} | Shares {post.shareCount || 0}
                </Text>

                <TouchableOpacity
                  style={[styles.unsaveBtn, { borderColor: colors.danger, backgroundColor: colors.surfaceAlt }]}
                  onPress={() => toggleSave(post._id)}
                >
                  <Ionicons name="bookmark" size={16} color={colors.danger} />
                  <Text style={[styles.unsaveText, { color: colors.danger }]}>Remove from Saved</Text>
                </TouchableOpacity>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  container: { padding: 16, paddingBottom: 36, gap: 10 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 28, fontWeight: "900" },
  subTitle: { marginTop: 4, marginBottom: 10, lineHeight: 21, fontWeight: "600" },
  error: { marginBottom: 8 },
  empty: { fontWeight: "600" },
  postWrap: { paddingVertical: 14, gap: 10 },
  authorRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  avatar: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, borderColor: "#D0D5DD" },
  avatarFallback: { alignItems: "center", justifyContent: "center" },
  avatarText: { fontWeight: "800" },
  authorName: { fontSize: 15, fontWeight: "800" },
  meta: { fontSize: 12, fontWeight: "700" },
  content: { fontSize: 16, lineHeight: 28, fontWeight: "500" },
  mediaImage: {
    width: MEDIA_WIDTH,
    borderRadius: 18,
    backgroundColor: "#E5E7EB"
  },
  stats: { fontSize: 12, fontWeight: "700" },
  unsaveBtn: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  unsaveText: { fontWeight: "700" }
});
