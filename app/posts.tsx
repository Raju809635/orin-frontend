import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Linking,
  Modal,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { sanitizeDisplayText } from "@/utils/textSanitize";

type Post = {
  _id: string;
  content: string;
  postType: string;
  likeCount?: number;
  userReaction?: "like" | "love" | "care" | "haha" | "wow" | "sad" | "angry" | null;
  reactionCounts?: {
    like?: number;
    love?: number;
    care?: number;
    haha?: number;
    wow?: number;
    sad?: number;
    angry?: number;
  };
  commentCount?: number;
  shareCount?: number;
  isLiked?: boolean;
  comments?: PostComment[];
  mediaUrls?: string[];
  authorId?: {
    _id?: string;
    name?: string;
    role?: "student" | "mentor";
    profilePhotoUrl?: string;
    isFollowing?: boolean;
  } | null;
  createdAt?: string;
};

type PostComment = {
  _id: string;
  content: string;
  authorId?: { _id?: string; name?: string; role?: string } | null;
};

const FEED_BOTTOM_NAV_SPACE = 108;
const { width } = Dimensions.get("window");
const carouselWidth = Math.max(width - 56, 280);

const REACTION_ORDER = ["like", "love", "care", "haha", "wow", "sad", "angry"] as const;
const REACTION_OPTIONS: Record<(typeof REACTION_ORDER)[number], { emoji: string; label: string }> = {
  like: { emoji: "👍", label: "Like" },
  love: { emoji: "❤️", label: "Love" },
  care: { emoji: "🤗", label: "Care" },
  haha: { emoji: "😂", label: "Haha" },
  wow: { emoji: "😮", label: "Wow" },
  sad: { emoji: "😢", label: "Sad" },
  angry: { emoji: "😡", label: "Angry" }
};

function normalizeUrl(rawUrl: string) {
  const cleaned = rawUrl.replace(/[),.;!?]+$/, "");
  if (/^https?:\/\//i.test(cleaned)) return cleaned;
  return `https://${cleaned}`;
}

function splitByUrls(text: string) {
  const regex = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;
  const out: { text: string; url?: string }[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    const start = match.index;
    const raw = match[0];
    if (start > lastIndex) out.push({ text: text.slice(lastIndex, start) });
    out.push({ text: raw, url: raw });
    lastIndex = start + raw.length;
  }
  if (lastIndex < text.length) out.push({ text: text.slice(lastIndex) });
  return out;
}

function formatPostTime(dateValue?: string) {
  if (!dateValue) return "Just now";
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "Just now";
  return date.toLocaleString();
}

export default function PostsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [posts, setPosts] = useState<Post[]>([]);
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [openCommentFor, setOpenCommentFor] = useState<Record<string, boolean>>({});
  const [followingState, setFollowingState] = useState<Record<string, boolean>>({});
  const [carouselIndexByPost, setCarouselIndexByPost] = useState<Record<string, number>>({});
  const [viewer, setViewer] = useState<{ visible: boolean; postId: string; images: string[]; index: number }>({
    visible: false,
    postId: "",
    images: [],
    index: 0
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reactionMenuFor, setReactionMenuFor] = useState<string | null>(null);
  const [commentsModal, setCommentsModal] = useState<{ visible: boolean; postId: string; comments: PostComment[] }>({
    visible: false,
    postId: "",
    comments: []
  });
  const [loadingComments, setLoadingComments] = useState(false);

  const loadPosts = useCallback(async (refresh = false) => {
    try {
      if (refresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      let data: Post[] = [];
      try {
        const res = await api.get<Post[]>("/api/network/feed/public");
        data = res.data || [];
      } catch (e: any) {
        const message = e?.response?.data?.message || "";
        const status = e?.response?.status;
        if (status === 404 || message.toLowerCase().includes("route not found")) {
          const fallback = await api.get<Post[]>("/api/network/feed");
          data = (fallback.data || []).filter((post) => post?.postType || post?.content);
          setError("Public feed route not deployed yet. Showing latest feed.");
        } else {
          throw e;
        }
      }
      setPosts(data);
      const followMap: Record<string, boolean> = {};
      data.forEach((post) => {
        const authorId = String(post.authorId?._id || "");
        if (authorId) followMap[authorId] = Boolean(post.authorId?.isFollowing);
      });
      setFollowingState((prev) => ({ ...followMap, ...prev }));
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

  async function react(postId: string, action: "like" | "react" | "share", reactionType?: (typeof REACTION_ORDER)[number]) {
    try {
      const post = posts.find((p) => p._id === postId);
      if (action === "share" && post?.content) {
        await Share.share({ message: `${sanitizeDisplayText(post.content)}\n\nShared via ORIN` });
      }
      await api.post(`/api/network/feed/${postId}/react`, reactionType ? { action, reactionType } : { action });
      setReactionMenuFor(null);
      await loadPosts(true);
    } catch (e: any) {
      setError(e?.response?.data?.message || `Failed to ${action} post.`);
    }
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

  async function openComments(postId: string) {
    try {
      setError(null);
      setLoadingComments(true);
      const { data } = await api.get<PostComment[]>(`/api/network/feed/${postId}/comments`);
      setCommentsModal({ visible: true, postId, comments: data || [] });
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to load comments.");
    } finally {
      setLoadingComments(false);
    }
  }

  async function follow(targetId: string) {
    try {
      const { data } = await api.post<{ following: boolean }>(`/api/network/follow/${targetId}`);
      setFollowingState((prev) => ({ ...prev, [targetId]: Boolean(data?.following) }));
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to update follow.");
    }
  }

  function onCarouselScroll(postId: string, x: number) {
    const index = Math.max(0, Math.round(x / carouselWidth));
    setCarouselIndexByPost((prev) => ({ ...prev, [postId]: index }));
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#1F7A4C" />
      </View>
    );
  }

  return (
    <>
      <ScrollView
        contentContainerStyle={[styles.container, { paddingBottom: FEED_BOTTOM_NAV_SPACE + insets.bottom }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadPosts(true)} />}
      >
        <Text style={styles.heading}>Public Posts</Text>
        <Text style={styles.subheading}>Explore public updates from students and mentors.</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {posts.length === 0 ? (
          <Text style={styles.empty}>No public posts yet.</Text>
        ) : (
          posts.map((post) => {
            const authorId = String(post.authorId?._id || "");
            const isOwnPost = authorId && String(authorId) === String(user?.id || "");
            const isFollowing = authorId ? Boolean(followingState[authorId]) : false;
            const media = (post.mediaUrls || []).slice(0, 5);
            const currentIndex = carouselIndexByPost[post._id] || 0;
            const userReaction = post.userReaction || null;
            const totalReactions = REACTION_ORDER.reduce(
              (sum, type) => sum + Number(post.reactionCounts?.[type] || 0),
              0
            );
            const topReactions = REACTION_ORDER
              .map((type) => ({ type, count: Number(post.reactionCounts?.[type] || 0) }))
              .filter((item) => item.count > 0)
              .sort((a, b) => b.count - a.count)
              .slice(0, 3);

            return (
              <View key={post._id} style={styles.card}>
                <View style={styles.postHeader}>
                  <TouchableOpacity
                    style={styles.authorWrap}
                    onPress={() => (authorId ? router.push(`/public-profile/${authorId}` as never) : undefined)}
                    disabled={!authorId}
                  >
                    {post.authorId?.profilePhotoUrl ? (
                      <Image source={{ uri: post.authorId.profilePhotoUrl }} style={styles.authorAvatar} />
                    ) : (
                      <View style={styles.authorAvatarFallback}>
                        <Text style={styles.authorAvatarText}>{(post.authorId?.name || "U").charAt(0).toUpperCase()}</Text>
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.author}>{post.authorId?.name || "ORIN User"}</Text>
                      <Text style={styles.role}>
                        {(post.authorId?.role || "member").toUpperCase()} | {formatPostTime(post.createdAt)}
                      </Text>
                    </View>
                  </TouchableOpacity>
                  {!isOwnPost && authorId ? (
                    <TouchableOpacity style={[styles.followBtn, isFollowing && styles.followingBtn]} onPress={() => follow(authorId)}>
                      <Text style={[styles.followBtnText, isFollowing && styles.followingBtnText]}>
                        {isFollowing ? "Following" : "+ Follow"}
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                </View>

                <Text style={styles.content}>
                  {splitByUrls(sanitizeDisplayText(post.content || "")).map((part, idx) =>
                    part.url ? (
                      <Text
                        key={`${post._id}-url-${idx}`}
                        style={styles.postLink}
                        onPress={() => Linking.openURL(normalizeUrl(part.url || ""))}
                      >
                        {part.text}
                      </Text>
                    ) : (
                      <Text key={`${post._id}-txt-${idx}`}>{part.text}</Text>
                    )
                  )}
                </Text>

                {media.length ? (
                  <>
                    <ScrollView
                      horizontal
                      pagingEnabled
                      showsHorizontalScrollIndicator={false}
                      onMomentumScrollEnd={(e) => onCarouselScroll(post._id, e.nativeEvent.contentOffset.x)}
                    >
                      {media.map((uri, idx) => (
                        <TouchableOpacity key={`${post._id}-media-${idx}`} onPress={() => setViewer({ visible: true, postId: post._id, images: media, index: idx })}>
                          <Image source={{ uri }} style={styles.postImage} resizeMode="cover" />
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                    <View style={styles.dotRow}>
                      {media.map((_, idx) => (
                        <View key={`${post._id}-dot-${idx}`} style={[styles.dot, idx === currentIndex && styles.dotActive]} />
                      ))}
                    </View>
                  </>
                ) : null}

                <Text style={styles.meta}>
                  {post.postType} | Reactions {Math.max(totalReactions, Number(post.likeCount || 0))} | Comments{" "}
                  {post.commentCount || 0} | Shares {post.shareCount || 0}
                </Text>
                {Math.max(totalReactions, Number(post.likeCount || 0)) > 0 ? (
                  <View style={styles.reactionSummaryRow}>
                    <View style={styles.reactionIconStack}>
                      {topReactions.map((item, idx) => (
                        <View
                          key={`${post._id}-rx-${item.type}`}
                          style={[styles.reactionIconBubble, idx > 0 ? styles.reactionIconBubbleOverlap : null]}
                        >
                          <Text style={styles.reactionIconEmoji}>{REACTION_OPTIONS[item.type].emoji}</Text>
                        </View>
                      ))}
                    </View>
                    <Text style={styles.reactionSummaryText}>{Math.max(totalReactions, Number(post.likeCount || 0))}</Text>
                  </View>
                ) : null}
                {reactionMenuFor === post._id ? (
                  <View style={styles.reactionDropdown}>
                    {REACTION_ORDER.map((type) => (
                      <TouchableOpacity
                        key={`${post._id}-drop-${type}`}
                        style={styles.reactionDropdownItem}
                        onPress={() => react(post._id, "react", type)}
                      >
                        <Text style={styles.reactionDropdownEmoji}>{REACTION_OPTIONS[type].emoji}</Text>
                        <Text style={styles.reactionDropdownLabel}>{REACTION_OPTIONS[type].label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : null}
                <View style={styles.actions}>
                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => setReactionMenuFor((prev) => (prev === post._id ? null : post._id))}
                  >
                    <Ionicons
                      name={userReaction ? "thumbs-up" : "thumbs-up-outline"}
                      size={16}
                      color={userReaction ? "#175CD3" : "#475467"}
                    />
                    <Text style={[styles.action, userReaction ? styles.actionActive : null]}>
                      {userReaction ? REACTION_OPTIONS[userReaction].label : "Like"}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => {
                      setReactionMenuFor(null);
                      setOpenCommentFor((prev) => ({ ...prev, [post._id]: !prev[post._id] }));
                    }}
                  >
                    <Ionicons name="chatbubble-outline" size={16} color="#475467" />
                    <Text style={styles.action}>Comment</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => {
                      setReactionMenuFor(null);
                      openComments(post._id);
                    }}
                  >
                    <Ionicons name="eye-outline" size={16} color="#475467" />
                    <Text style={styles.action}>View</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionBtn} onPress={() => react(post._id, "share")}>
                    <Ionicons name="share-social-outline" size={16} color="#475467" />
                    <Text style={styles.action}>Share</Text>
                  </TouchableOpacity>
                </View>
                {openCommentFor[post._id] ? (
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
                ) : null}
                {(post.commentCount || 0) > 0 ? (
                  <TouchableOpacity onPress={() => openComments(post._id)}>
                    <Text style={styles.viewCommentsLink}>View comments ({post.commentCount || 0})</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            );
          })
        )}
      </ScrollView>

      <Modal visible={viewer.visible} transparent animationType="fade" onRequestClose={() => setViewer({ visible: false, postId: "", images: [], index: 0 })}>
        <View style={styles.viewerRoot}>
          <TouchableOpacity style={styles.viewerClose} onPress={() => setViewer({ visible: false, postId: "", images: [], index: 0 })}>
            <Ionicons name="close" size={26} color="#fff" />
          </TouchableOpacity>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            contentOffset={{ x: viewer.index * width, y: 0 }}
            onMomentumScrollEnd={(e) => {
              const index = Math.round(e.nativeEvent.contentOffset.x / width);
              setViewer((prev) => ({ ...prev, index }));
              if (viewer.postId) setCarouselIndexByPost((prev) => ({ ...prev, [viewer.postId]: index }));
            }}
          >
            {viewer.images.map((uri, idx) => (
              <ScrollView key={`${uri}-${idx}`} style={styles.zoomWrap} contentContainerStyle={styles.zoomInner} minimumZoomScale={1} maximumZoomScale={3} showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false}>
                <Image source={{ uri }} style={styles.viewerImage} resizeMode="contain" />
              </ScrollView>
            ))}
          </ScrollView>
        </View>
      </Modal>

      <Modal
        visible={commentsModal.visible}
        transparent
        animationType="slide"
        onRequestClose={() => setCommentsModal({ visible: false, postId: "", comments: [] })}
      >
        <View style={styles.commentsModalRoot}>
          <View style={[styles.commentsModalCard, { paddingBottom: 18 + insets.bottom }]}>
            <View style={styles.commentsModalHeader}>
              <Text style={styles.commentsModalTitle}>Comments</Text>
              <TouchableOpacity onPress={() => setCommentsModal({ visible: false, postId: "", comments: [] })}>
                <Ionicons name="close" size={22} color="#101828" />
              </TouchableOpacity>
            </View>
            {loadingComments ? (
              <View style={styles.commentsModalLoading}>
                <ActivityIndicator size="small" color="#1F7A4C" />
                <Text style={styles.meta}>Loading...</Text>
              </View>
            ) : commentsModal.comments.length === 0 ? (
              <Text style={styles.meta}>No comments yet.</Text>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                {commentsModal.comments.map((item) => (
                  <View key={item._id} style={styles.commentRow}>
                    <Text style={styles.commentAuthor}>{item.authorId?.name || "User"}</Text>
                    <Text style={styles.commentBody}>{sanitizeDisplayText(item.content)}</Text>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: "#F3F5F7", padding: 16 },
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
  postHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  authorWrap: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  authorAvatar: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderColor: "#D0D5DD" },
  authorAvatarFallback: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: "#D0D5DD",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EAF6EF"
  },
  authorAvatarText: { color: "#1F7A4C", fontWeight: "800" },
  author: { color: "#1E2B24", fontWeight: "800" },
  role: { marginTop: 2, color: "#667085", fontSize: 12 },
  content: { marginTop: 8, color: "#344054", lineHeight: 19 },
  postLink: { color: "#175CD3", fontWeight: "800" },
  meta: { marginTop: 6, color: "#667085", fontSize: 12, fontWeight: "600" },
  reactionSummaryRow: { marginTop: 6, flexDirection: "row", alignItems: "center", gap: 8 },
  reactionIconStack: { flexDirection: "row", alignItems: "center" },
  reactionIconBubble: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: "#FFFFFF",
    backgroundColor: "#F2F4F7",
    alignItems: "center",
    justifyContent: "center"
  },
  reactionIconBubbleOverlap: { marginLeft: -6 },
  reactionIconEmoji: { fontSize: 11 },
  reactionSummaryText: { color: "#475467", fontWeight: "800", fontSize: 12 },
  reactionDropdown: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#E4E7EC",
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    padding: 8,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6
  },
  reactionDropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: "#D0D5DD",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 5,
    backgroundColor: "#F9FAFB"
  },
  reactionDropdownEmoji: { fontSize: 14 },
  reactionDropdownLabel: { color: "#344054", fontWeight: "700", fontSize: 11 },
  actions: { marginTop: 8, flexDirection: "row", justifyContent: "space-between" },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#EAECF0"
  },
  action: { color: "#475467", fontWeight: "700", fontSize: 12 },
  actionActive: { color: "#175CD3" },
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
  viewCommentsLink: { marginTop: 8, color: "#175CD3", fontWeight: "800" },
  postImage: { width: carouselWidth, height: 220, borderRadius: 10, marginTop: 8, marginRight: 6, borderWidth: 1, borderColor: "#E4E7EC" },
  dotRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 8 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#D0D5DD" },
  dotActive: { width: 14, backgroundColor: "#1F7A4C", borderRadius: 7 },
  followBtn: {
    borderWidth: 1,
    borderColor: "#175CD3",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: "#EFF8FF"
  },
  followingBtn: { borderColor: "#1F7A4C", backgroundColor: "#EAF6EF" },
  followBtnText: { color: "#175CD3", fontWeight: "700", fontSize: 12 },
  followingBtnText: { color: "#1F7A4C" },
  commentsModalRoot: { flex: 1, backgroundColor: "rgba(15,23,42,0.45)", justifyContent: "flex-end" },
  commentsModalCard: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 14,
    maxHeight: "78%"
  },
  commentsModalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  commentsModalTitle: { color: "#101828", fontWeight: "900", fontSize: 16 },
  commentsModalLoading: { paddingVertical: 16, alignItems: "center", gap: 8 },
  commentRow: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#EAECF0" },
  commentAuthor: { color: "#13251E", fontWeight: "900" },
  commentBody: { marginTop: 4, color: "#475467", lineHeight: 18 },
  viewerRoot: { flex: 1, backgroundColor: "rgba(0,0,0,0.95)", justifyContent: "center" },
  viewerClose: { position: "absolute", right: 16, top: 50, zIndex: 10, padding: 8 },
  zoomWrap: { width },
  zoomInner: { width, height: "100%", alignItems: "center", justifyContent: "center" },
  viewerImage: { width, height: "85%" }
});
