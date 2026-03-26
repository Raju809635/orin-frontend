import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  ActivityIndicator,
  Dimensions,
  Image,
  Linking,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useAppTheme } from "@/context/ThemeContext";
import { notify } from "@/utils/notify";
import { pickAndUploadPostImages } from "@/utils/postMediaUpload";
import GlobalHeader from "@/components/global-header";

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

type FeedPost = {
  _id: string;
  content: string;
  postType: string;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  isLiked?: boolean;
  comments?: FeedComment[];
  createdAt?: string;
  mediaUrls?: string[];
  userReaction?: "like" | "love" | "care" | "haha" | "wow" | "sad" | "angry" | null;
  isSaved?: boolean;
  saveCount?: number;
  reactionCounts?: {
    like?: number;
    love?: number;
    care?: number;
    haha?: number;
    wow?: number;
    sad?: number;
    angry?: number;
  };
  authorId?: {
    _id?: string;
    name?: string;
    role?: "student" | "mentor";
    profilePhotoUrl?: string;
    isFollowing?: boolean;
  } | null;
};

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

type NetworkSectionId = "compose" | "feed" | "connections";

const networkSections: { id: NetworkSectionId; label: string }[] = [
  { id: "feed", label: "Home Feed" },
  { id: "compose", label: "Post" },
  { id: "connections", label: "My Circle" }
];

const FEED_BOTTOM_NAV_SPACE = 108;
const POST_COLLAPSED_LINES = 4;
const EXPAND_FALLBACK_THRESHOLD = 140;
const NETWORK_SECTION_STALE_MS = 2 * 60 * 1000;
const { width } = Dimensions.get("window");
const carouselWidth = Math.max(width - 56, 280);
const REACTION_ORDER = ["like", "love", "wow", "care", "sad", "angry"] as const;
const REACTION_OPTIONS: Record<(typeof REACTION_ORDER)[number], { emoji: string; label: string }> = {
  like: { emoji: "\u{1F44D}", label: "Like" },
  love: { emoji: "\u2764\uFE0F", label: "Love" },
  wow: { emoji: "\u{1F680}", label: "Boost" },
  care: { emoji: "\u{1F4A1}", label: "Insight" },
  sad: { emoji: "\u{1F622}", label: "Sad" },
  angry: { emoji: "\u{1F621}", label: "Angry" }
};

function formatPostTime(dateValue?: string) {
  if (!dateValue) return "Just now";
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "Just now";
  return date.toLocaleString();
}

export default function NetworkScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ section?: string }>();
  const { user } = useAuth();
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const sectionFetchAtRef = useRef<Record<string, number>>({});
  const [activeSection, setActiveSection] = useState<NetworkSectionId>("feed");
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [expandedPosts, setExpandedPosts] = useState<Record<string, boolean>>({});
  const [expandablePosts, setExpandablePosts] = useState<Record<string, boolean>>({});
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [pendingIncoming, setPendingIncoming] = useState<ConnectionRow[]>([]);
  const [requestedCircleIds, setRequestedCircleIds] = useState<Record<string, boolean>>({});
  const [circleMemberIds, setCircleMemberIds] = useState<Record<string, boolean>>({});
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [postText, setPostText] = useState("");
  const [postImageUrls, setPostImageUrls] = useState<string[]>([]);
  const [postType, setPostType] = useState<FeedPost["postType"]>("learning_progress");
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
  const [submitting, setSubmitting] = useState(false);
  const [uploadingPostImage, setUploadingPostImage] = useState(false);
  const [commentsModal, setCommentsModal] = useState<{ visible: boolean; postId: string; comments: FeedComment[] }>({
    visible: false,
    postId: "",
    comments: []
  });
  const [editingCommentId, setEditingCommentId] = useState<string>("");
  const [editingCommentText, setEditingCommentText] = useState("");
  const [reactionMenuFor, setReactionMenuFor] = useState<string | null>(null);
  const [editingPost, setEditingPost] = useState<{ postId: string; content: string } | null>(null);
  const [postOptionsFor, setPostOptionsFor] = useState<FeedPost | null>(null);
  const [savingPostEdit, setSavingPostEdit] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [hiddenPostIds, setHiddenPostIds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const section = String(params.section || "");
    if (section === "compose" || section === "feed" || section === "connections") {
      setActiveSection(section);
    }
  }, [params.section]);

  const shouldSkipSectionFetch = useCallback((key: string, refresh = false, force = false) => {
    const now = Date.now();
    return !refresh && !force && now - (sectionFetchAtRef.current[key] || 0) < NETWORK_SECTION_STALE_MS;
  }, []);

  const markSectionFetched = useCallback((key: string) => {
    sectionFetchAtRef.current[key] = Date.now();
  }, []);

  const applyConnectionState = useCallback((pendingRows: ConnectionRow[], acceptedRows: ConnectionRow[]) => {
    setPendingIncoming(
      pendingRows.filter((item) => String(item?.recipientId?._id || "") === String(user?.id || ""))
    );
    const requested: Record<string, boolean> = {};
    pendingRows.forEach((item) => {
      if (String(item?.requesterId?._id || "") === String(user?.id || "")) {
        const targetId = String(item?.recipientId?._id || "");
        if (targetId) requested[targetId] = true;
      }
    });
    setRequestedCircleIds(requested);

    const inCircle: Record<string, boolean> = {};
    acceptedRows.forEach((item) => {
      const requesterId = String(item?.requesterId?._id || "");
      const recipientId = String(item?.recipientId?._id || "");
      const me = String(user?.id || "");
      const other = requesterId === me ? recipientId : recipientId === me ? requesterId : "";
      if (other) inCircle[other] = true;
    });
    setCircleMemberIds(inCircle);
  }, [user?.id]);

  const loadFeedSection = useCallback(async (refresh = false, force = false) => {
    const cacheKey = "feed";
    if (shouldSkipSectionFetch(cacheKey, refresh, force)) return;
    markSectionFetched(cacheKey);
    const feedRes = await api.get<FeedPost[]>("/api/network/feed");
    const nextPosts = feedRes.data || [];
    setPosts(nextPosts);
    const followMap: Record<string, boolean> = {};
    nextPosts.forEach((post) => {
      const authorId = String(post.authorId?._id || "");
      if (authorId) followMap[authorId] = Boolean(post.authorId?.isFollowing);
    });
    setFollowingState((prev) => ({ ...followMap, ...prev }));
  }, [markSectionFetched, shouldSkipSectionFetch]);

  const loadComposeSection = useCallback(async (refresh = false, force = false) => {
    const cacheKey = "compose";
    if (shouldSkipSectionFetch(cacheKey, refresh, force)) return;
    markSectionFetched(cacheKey);
    const [suggestionsRes, pendingRes, acceptedRes] = await Promise.allSettled([
      api.get<Suggestion[]>("/api/network/suggestions"),
      api.get<ConnectionRow[]>("/api/network/connections?status=pending"),
      api.get<ConnectionRow[]>("/api/network/connections?status=accepted")
    ]);
    const pendingRows = pendingRes.status === "fulfilled" ? pendingRes.value.data || [] : [];
    const acceptedRows = acceptedRes.status === "fulfilled" ? acceptedRes.value.data || [] : [];
    setSuggestions(suggestionsRes.status === "fulfilled" ? suggestionsRes.value.data || [] : []);
    applyConnectionState(pendingRows, acceptedRows);
  }, [applyConnectionState, markSectionFetched, shouldSkipSectionFetch]);

  const loadConnectionsSection = useCallback(async (refresh = false, force = false) => {
    const cacheKey = "connections";
    if (shouldSkipSectionFetch(cacheKey, refresh, force)) return;
    markSectionFetched(cacheKey);
    const [pendingRes, acceptedRes] = await Promise.allSettled([
      api.get<ConnectionRow[]>("/api/network/connections?status=pending"),
      api.get<ConnectionRow[]>("/api/network/connections?status=accepted")
    ]);
    const pendingRows = pendingRes.status === "fulfilled" ? pendingRes.value.data || [] : [];
    const acceptedRows = acceptedRes.status === "fulfilled" ? acceptedRes.value.data || [] : [];
    applyConnectionState(pendingRows, acceptedRows);
  }, [applyConnectionState, markSectionFetched, shouldSkipSectionFetch]);

  const loadData = useCallback(
    async (refresh = false, force = false) => {
      try {
        if (refresh) setRefreshing(true);
        else setLoading(true);
        setError(null);

        if (activeSection === "feed") {
          await loadFeedSection(refresh, force);
        } else if (activeSection === "compose") {
          await loadComposeSection(refresh, force);
        } else if (activeSection === "connections") {
          await loadConnectionsSection(refresh, force);
        }
      } catch (e: any) {
        setError(e?.response?.data?.message || "Failed to load network.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [activeSection, loadComposeSection, loadConnectionsSection, loadFeedSection]
  );

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  useEffect(() => {
    void loadData(false);
  }, [activeSection, loadData]);

  const normalizedSearch = searchQuery.trim().toLowerCase();

  const filteredSuggestions = normalizedSearch
    ? suggestions.filter((item) => {
        const name = String(item.name || "").toLowerCase();
        const role = String(item.role || "").toLowerCase();
        const reason = String(item.reason || "").toLowerCase();
        return (
          name.includes(normalizedSearch) ||
          role.includes(normalizedSearch) ||
          reason.includes(normalizedSearch)
        );
      })
    : suggestions;

  const filteredPosts = normalizedSearch
    ? posts.filter((post) => {
        const authorName = String(post.authorId?.name || "").toLowerCase();
        const authorRole = String(post.authorId?.role || "").toLowerCase();
        const content = String(post.content || "").toLowerCase();
        const postType = String(post.postType || "").toLowerCase();
        return (
          authorName.includes(normalizedSearch) ||
          authorRole.includes(normalizedSearch) ||
          content.includes(normalizedSearch) ||
          postType.includes(normalizedSearch)
        );
      })
    : posts;

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
        mediaUrls: postImageUrls.slice(0, 5),
        visibility: "public"
      });
      setPostText("");
      setPostImageUrls([]);
      notify("Post published.");
      await loadFeedSection(true, true);
      setActiveSection("feed");
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to publish post.");
    } finally {
      setSubmitting(false);
    }
  }

  async function uploadPostImages() {
    if (postImageUrls.length >= 5) {
      setError("Maximum 5 images allowed per post.");
      return;
    }
    try {
      setUploadingPostImage(true);
      const uploadedUrls = await pickAndUploadPostImages(5 - postImageUrls.length);
      if (!uploadedUrls.length) return;
      setPostImageUrls((prev) => [...prev, ...uploadedUrls].slice(0, 5));
      notify("Images added.");
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || "Failed to upload post image.");
    } finally {
      setUploadingPostImage(false);
    }
  }

  function openPostOptions(post: FeedPost) {
    setReactionMenuFor(null);
    setPostOptionsFor(post);
  }

  function confirmDeletePost(postId: string) {
    Alert.alert("Delete post?", "This will remove your post permanently.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => removePost(postId) }
    ]);
  }

  async function removePost(postId: string) {
    try {
      setError(null);
      await api.delete(`/api/network/feed/${postId}`);
      notify("Post deleted.");
      await loadFeedSection(true, true);
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to delete post.");
    }
  }

  async function savePostEdit() {
    if (!editingPost?.postId) return;
    const nextContent = editingPost.content.trim();
    if (nextContent.length < 3) {
      setError("Post content is required.");
      return;
    }
    try {
      setSavingPostEdit(true);
      setError(null);
      await api.patch(`/api/network/feed/${editingPost.postId}`, { content: nextContent });
      setEditingPost(null);
      notify("Post updated.");
      await loadFeedSection(true, true);
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to update post.");
    } finally {
      setSavingPostEdit(false);
    }
  }

  async function react(postId: string, action: "like" | "react" | "save" | "share", reactionType?: (typeof REACTION_ORDER)[number]) {
    try {
      const post = posts.find((p) => p._id === postId);
      if (action === "share" && post?.content) {
        await Share.share({
          message: `${post.content}\n\nShared via ORIN`
        });
      }
      await api.post(`/api/network/feed/${postId}/react`, reactionType ? { action, reactionType } : { action });
      setReactionMenuFor(null);
      await loadFeedSection(true, true);
    } catch (e: any) {
      setError(e?.response?.data?.message || `Failed to ${action} post.`);
    }
  }

  async function copyPostLink(post: FeedPost) {
    const postUrl = `https://orin-frontend.vercel.app/network?post=${post._id}`;
    try {
      if (Platform.OS === "web" && typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(postUrl);
        notify("Post link copied.");
      } else {
        Alert.alert("Copy Link", postUrl, [{ text: "OK" }]);
      }
    } catch {
      Alert.alert("Copy Link", postUrl, [{ text: "OK" }]);
    } finally {
      setPostOptionsFor(null);
    }
  }

  function hidePost(postId: string) {
    setHiddenPostIds((prev) => ({ ...prev, [postId]: true }));
    setPostOptionsFor(null);
    notify("Post hidden from your feed.");
  }

  function reportPost() {
    setPostOptionsFor(null);
    notify("Post reported. We will review it.");
  }

  async function comment(postId: string) {
    const content = (commentDrafts[postId] || "").trim();
    if (!content) return;
    try {
      await api.post(`/api/network/feed/${postId}/comment`, { content });
      setCommentDrafts((prev) => ({ ...prev, [postId]: "" }));
      await loadFeedSection(true, true);
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to comment.");
    }
  }

  async function openComments(postId: string) {
    try {
      setError(null);
      const { data } = await api.get<FeedComment[]>(`/api/network/feed/${postId}/comments`);
      setCommentsModal({ visible: true, postId, comments: data || [] });
      setEditingCommentId("");
      setEditingCommentText("");
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to load comments.");
    }
  }

  function replyToComment(item: FeedComment) {
    const authorName = String(item.authorId?.name || "").trim();
    if (!commentsModal.postId) return;
    setCommentDrafts((prev) => ({
      ...prev,
      [commentsModal.postId]: authorName ? `@${authorName} ` : ""
    }));
  }

  async function saveCommentEdit() {
    if (!commentsModal.postId || !editingCommentId || !editingCommentText.trim()) return;
    try {
      setError(null);
      const { data } = await api.patch<FeedComment>(
        `/api/network/feed/${commentsModal.postId}/comment/${editingCommentId}`,
        { content: editingCommentText.trim() }
      );
      setCommentsModal((prev) => ({
        ...prev,
        comments: prev.comments.map((item) => (item._id === editingCommentId ? { ...item, ...data } : item))
      }));
      setEditingCommentId("");
      setEditingCommentText("");
      await loadFeedSection(true, true);
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to update comment.");
    }
  }

  async function removeComment(commentId: string) {
    if (!commentsModal.postId) return;
    try {
      setError(null);
      await api.delete(`/api/network/feed/${commentsModal.postId}/comment/${commentId}`);
      setCommentsModal((prev) => ({
        ...prev,
        comments: prev.comments.filter((item) => item._id !== commentId)
      }));
      await loadFeedSection(true, true);
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to delete comment.");
    }
  }

  async function connect(recipientId: string) {
    try {
      await api.post("/api/network/connections/request", { recipientId });
      setRequestedCircleIds((prev) => ({ ...prev, [recipientId]: true }));
      notify("Request Sent");
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to send connection request.");
    }
  }

  async function follow(targetId: string) {
    try {
      const { data } = await api.post<{ following: boolean }>(`/api/network/follow/${targetId}`);
      setFollowingState((prev) => ({ ...prev, [targetId]: Boolean(data?.following) }));
      notify(data?.following ? "Following" : "Unfollowed");
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to update follow.");
    }
  }

  async function respondConnection(connectionId: string, action: "accept" | "reject") {
    try {
      await api.post(`/api/network/connections/${connectionId}/respond`, { action });
      if (action === "accept") {
        const accepted = pendingIncoming.find((item) => item._id === connectionId);
        const otherId = String(accepted?.requesterId?._id || "");
        if (otherId) setCircleMemberIds((prev) => ({ ...prev, [otherId]: true }));
      }
      notify(action === "accept" ? "In Your Circle" : `Request ${action}ed.`);
      await loadData(true);
    } catch (e: any) {
      setError(e?.response?.data?.message || `Failed to ${action} request.`);
    }
  }

  function onCarouselScroll(postId: string, x: number) {
    const index = Math.max(0, Math.round(x / carouselWidth));
    setCarouselIndexByPost((prev) => ({ ...prev, [postId]: index }));
  }

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GlobalHeader
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search circle, posts, people"
      />
      <ScrollView
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={[styles.container, { backgroundColor: colors.background, paddingBottom: FEED_BOTTOM_NAV_SPACE + insets.bottom }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadData(true, true)} tintColor={colors.accent} />}
      >
        <Text style={[styles.heading, { color: colors.text }]}>Home</Text>
        <Text style={[styles.subheading, { color: colors.textMuted }]}>
          {user?.role === "mentor" ? "Your professional feed for mentor insights, conversations, and visibility." : "Your student growth feed with people, ideas, and progress that match your journey."}
        </Text>
        {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sectionNavRow}>
          {networkSections.map((item) => {
            const active = activeSection === item.id;
            return (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.sectionChip,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                  active ? [styles.sectionChipActive, { backgroundColor: colors.accentSoft, borderColor: colors.accent }] : null
                ]}
                onPress={() => setActiveSection(item.id)}
              >
                <Text style={[styles.sectionChipText, { color: colors.textMuted }, active && [styles.sectionChipTextActive, { color: colors.accent }]]}>{item.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {activeSection === "compose" ? (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Start a post</Text>
            <View style={styles.chipsRow}>
              {[
                ["learning_progress", "Learning"],
                ["project_update", "Project"],
                ["achievement", "Achievement"],
                ["question", "Question"]
              ].map(([value, label]) => (
                <TouchableOpacity
                  key={value}
                    style={[styles.chip, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }, postType === value ? [styles.chipActive, { backgroundColor: colors.accentSoft, borderColor: colors.accent }] : null]}
                  onPress={() => setPostType(value as FeedPost["postType"])}
                >
                    <Text style={[styles.chipText, { color: colors.textMuted }, postType === value ? [styles.chipTextActive, { color: colors.accent }] : null]}>{label}</Text>
                  </TouchableOpacity>
              ))}
            </View>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surfaceAlt, borderColor: colors.border, color: colors.text }]}
              placeholder="Share update, achievement, project or question..."
              placeholderTextColor={colors.textMuted}
              value={postText}
              onChangeText={setPostText}
              multiline
            />
            <View style={styles.rowItem}>
              <TouchableOpacity style={styles.secondaryButton} onPress={uploadPostImages} disabled={uploadingPostImage}>
                <Text style={[styles.secondaryButtonText, { color: colors.text }]}>{uploadingPostImage ? "Uploading..." : "Add Photos"}</Text>
              </TouchableOpacity>
              {postImageUrls.length ? (
                <TouchableOpacity
                  onPress={() => setPostImageUrls([])}
                  style={[styles.secondaryButton, { borderColor: "#F04438" }]}
                >
                  <Text style={[styles.secondaryButtonText, { color: "#B42318" }]}>Clear</Text>
                </TouchableOpacity>
              ) : null}
            </View>
            {postImageUrls.length ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.previewRow}>
                {postImageUrls.map((uri, idx) => (
                  <Image key={`${uri}-${idx}`} source={{ uri }} style={styles.composerPreview} resizeMode="cover" />
                ))}
              </ScrollView>
            ) : null}
              <Text style={[styles.meta, { color: colors.textMuted }]}>Images selected: {postImageUrls.length}/5</Text>
            <TouchableOpacity style={styles.primaryButton} onPress={publishPost} disabled={submitting}>
              <Text style={styles.primaryButtonText}>{submitting ? "Posting..." : "Publish Insight"}</Text>
            </TouchableOpacity>
              <Text style={[styles.cardTitle, { marginTop: 14, color: colors.text }]}>People You May Know</Text>
              {filteredSuggestions.length === 0 ? (
                <Text style={[styles.meta, { color: colors.textMuted }]}>No suggestions yet.</Text>
              ) : (
              filteredSuggestions.slice(0, 8).map((item) => {
                const inCircle = Boolean(circleMemberIds[item.id]);
                const requested = Boolean(requestedCircleIds[item.id]);
                return (
                  <View key={`discover-${item.id}`} style={styles.rowItem}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.rowTitle, { color: colors.text }]}>{item.name}</Text>
                      <Text style={[styles.meta, { color: colors.textMuted }]}>{item.reason}</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => (!inCircle && !requested ? connect(item.id) : undefined)}
                      disabled={inCircle || requested}
                    >
                      <Text style={styles.action}>
                        {inCircle ? "\u2713 In Your Circle" : requested ? "Request Sent" : "+ Add to Circle"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                );
              })
            )}
          </View>
        ) : null}

        {activeSection === "connections" ? (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>My Circle Requests</Text>
            {pendingIncoming.length === 0 ? (
              <Text style={[styles.meta, { color: colors.textMuted }]}>No pending requests.</Text>
            ) : (
              pendingIncoming.map((item) => (
                <View key={item._id} style={styles.rowItem}>
                  <View style={{ flex: 1 }}>
                      <Text style={[styles.rowTitle, { color: colors.text }]}>{item.requesterId?.name || "User"}</Text>
                      <Text style={[styles.meta, { color: colors.textMuted }]}>Wants to join your circle</Text>
                  </View>
                  <TouchableOpacity onPress={() => respondConnection(item._id, "accept")}>
                    <Text style={styles.action}>{"\u2713 In Your Circle"}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => respondConnection(item._id, "reject")}>
                    <Text style={styles.actionDanger}>Reject</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>
        ) : null}

        {activeSection === "feed" ? (
          <View style={styles.feedSection}>
            <TouchableOpacity
              activeOpacity={0.92}
              style={[styles.startPostCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => setActiveSection("compose")}
            >
              <View style={[styles.startPostAvatar, { backgroundColor: colors.accentSoft }]}>
                <Text style={styles.startPostAvatarText}>{user?.name?.charAt(0)?.toUpperCase() || "O"}</Text>
              </View>
              <View style={[styles.startPostInput, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
                <Text style={[styles.startPostPlaceholder, { color: colors.textMuted }]}>Start a post...</Text>
              </View>
            </TouchableOpacity>
            {filteredPosts.filter((post) => !hiddenPostIds[post._id]).length === 0 ? (
              <Text style={[styles.meta, { color: colors.textMuted }]}>No posts yet. Create the first one.</Text>
            ) : (
              filteredPosts.filter((post) => !hiddenPostIds[post._id]).map((post) => {
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
                const summaryReactionCount = Math.max(totalReactions, Number(post.likeCount || 0));
                const summaryReactionIcons = topReactions.length
                  ? topReactions.map((item) => REACTION_OPTIONS[item.type].emoji).join(" ")
                  : summaryReactionCount > 0
                    ? REACTION_OPTIONS.like.emoji
                    : "";
                const summaryCommentCount = Number(post.commentCount || 0);

                return (
                  <View key={post._id} style={[styles.postCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
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
                            <Text style={styles.authorAvatarText}>
                              {(post.authorId?.name || "U").charAt(0).toUpperCase()}
                            </Text>
                          </View>
                        )}
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.rowTitle, { color: colors.text }]}>{post.authorId?.name || "ORIN User"}</Text>
                            <Text style={[styles.metaSmall, { color: colors.textMuted }]}>
                            {(post.authorId?.role || "member").toUpperCase()} {"\u2022"} {formatPostTime(post.createdAt)}
                          </Text>
                          </View>
                      </TouchableOpacity>
                      {!isOwnPost && authorId ? (
                        <TouchableOpacity style={[styles.followBtn, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }, isFollowing ? [styles.followingBtn, { backgroundColor: colors.accentSoft, borderColor: colors.accent }] : null]} onPress={() => follow(authorId)}>
                          <Text style={[styles.followBtnText, { color: colors.text }, isFollowing ? [styles.followingBtnText, { color: colors.accent }] : null]}>
                            {isFollowing ? "Following" : "+ Follow"}
                          </Text>
                        </TouchableOpacity>
                      ) : null}
                    {isOwnPost ? (
                      <TouchableOpacity style={[styles.postMenuBtn, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }]} onPress={() => openPostOptions(post)}>
                        <Ionicons name="ellipsis-horizontal" size={18} color={colors.textMuted} />
                      </TouchableOpacity>
                    ) : null}
                    </View>

                    {(() => {
                      const expanded = Boolean(expandedPosts[post._id]);
                      const contentText = String(post.content || "");
                      const heuristicExpandable =
                        contentText.length > EXPAND_FALLBACK_THRESHOLD || contentText.includes("\n");
                      const canExpand = Boolean(expandablePosts[post._id]) || heuristicExpandable;

                      return (
                        <>
                          <Text
                            style={[styles.postText, { color: colors.text }]}
                            numberOfLines={expanded ? undefined : POST_COLLAPSED_LINES}
                            onTextLayout={(e) => {
                              // Some devices/versions are flaky with onTextLayout for nested <Text>;
                              // keep a heuristic fallback so "View more" still shows for long posts.
                              const lineCount = e?.nativeEvent?.lines?.length || 0;
                              const next = lineCount > POST_COLLAPSED_LINES;
                              setExpandablePosts((prev) => (prev[post._id] === next ? prev : { ...prev, [post._id]: next }));
                            }}
                          >
                      {splitByUrls(post.content || "").map((part, idx) =>
                        part.url ? (
                          <Text
                            key={`${post._id}-url-${idx}`}
                            style={[styles.postLink, { color: isDark ? "#8AB4FF" : "#1D4ED8" }]}
                            onPress={() => Linking.openURL(normalizeUrl(part.url || ""))}
                          >
                            {part.text}
                          </Text>
                        ) : (
                          <Text key={`${post._id}-txt-${idx}`}>{part.text}</Text>
                        )
                      )}
                          </Text>
                          {canExpand ? (
                            <TouchableOpacity
                              style={styles.viewMoreBtn}
                              onPress={() => setExpandedPosts((prev) => ({ ...prev, [post._id]: !expanded }))}
                            >
                              <Text style={[styles.viewMoreText, { color: isDark ? "#8AB4FF" : "#1D4ED8" }]}>{expanded ? "View less" : "View more"}</Text>
                            </TouchableOpacity>
                          ) : null}
                        </>
                      );
                    })()}

                    {media.length ? (
                      <>
                        <ScrollView
                          horizontal
                          pagingEnabled
                          showsHorizontalScrollIndicator={false}
                          onMomentumScrollEnd={(e) => onCarouselScroll(post._id, e.nativeEvent.contentOffset.x)}
                        >
                          {media.map((uri, idx) => (
                            <TouchableOpacity key={`${post._id}-media-${idx}`} activeOpacity={0.9} onPress={() => setViewer({ visible: true, postId: post._id, images: media, index: idx })}>
                              <Image source={{ uri }} style={[styles.postImage, { borderColor: colors.border }]} resizeMode="cover" />
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                        <View style={styles.dotRow}>
                          {media.map((_, idx) => (
                            <View key={`${post._id}-dot-${idx}`} style={[styles.dot, { backgroundColor: colors.border }, idx === currentIndex ? [styles.dotActive, { backgroundColor: colors.accent }] : null]} />
                          ))}
                        </View>
                      </>
                    ) : null}

                    {(summaryReactionCount > 0 || summaryCommentCount > 0) ? (
                      <View style={[styles.feedStatsRow, { borderColor: colors.border }]}>
                        <Text style={[styles.feedStatsText, { color: colors.textMuted }]}>
                          {summaryReactionCount > 0 ? `${summaryReactionIcons} ${summaryReactionCount}` : ""}
                          {summaryReactionCount > 0 && summaryCommentCount > 0 ? "   •   " : ""}
                          {summaryCommentCount > 0 ? `${summaryCommentCount} comments` : ""}
                        </Text>
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
                          </TouchableOpacity>
                        ))}
                      </View>
                    ) : null}
                    <View style={styles.postActionRow}>
                      <TouchableOpacity
                        style={[styles.postActionBtn, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }, userReaction ? [styles.postActionBtnActive, { backgroundColor: colors.accentSoft, borderColor: colors.accent }] : null]}
                        onPress={() => react(post._id, "react", "like")}
                        onLongPress={() => setReactionMenuFor((prev) => (prev === post._id ? null : post._id))}
                      >
                        {userReaction ? (
                          <Text style={styles.selectedReactionEmoji}>
                            {REACTION_OPTIONS[(userReaction in REACTION_OPTIONS
                              ? userReaction
                              : "like") as keyof typeof REACTION_OPTIONS]?.emoji || REACTION_OPTIONS.like.emoji}
                          </Text>
                        ) : (
                          <Ionicons name="thumbs-up-outline" size={16} color={colors.textMuted} />
                        )}
                        <Text style={[styles.postActionText, { color: colors.textMuted }, userReaction ? [styles.postActionTextActive, { color: colors.accent }] : null]}>
                          {userReaction
                            ? REACTION_OPTIONS[(userReaction in REACTION_OPTIONS
                                ? userReaction
                                : "like") as keyof typeof REACTION_OPTIONS]?.label || "Like"
                            : "Like"}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.postActionBtn, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}
                        onPress={() => {
                          setReactionMenuFor(null);
                          openComments(post._id);
                        }}
                      >
                         <Ionicons name="chatbubble-outline" size={16} color={colors.textMuted} />
                         <Text style={[styles.postActionText, { color: colors.textMuted }]} numberOfLines={1}>Comment</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.postActionBtn, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}
                        onPress={() => {
                          setReactionMenuFor(null);
                          react(post._id, "share");
                        }}
                      >
                         <Ionicons name="share-social-outline" size={16} color={colors.textMuted} />
                         <Text style={[styles.postActionText, { color: colors.textMuted }]} numberOfLines={1}>Share</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.postActionBtn, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}
                        onPress={() => {
                          setReactionMenuFor(null);
                          openPostOptions(post);
                        }}
                      >
                         <Ionicons name="ellipsis-horizontal" size={16} color={colors.textMuted} />
                         <Text style={[styles.postActionText, { color: colors.textMuted }]} numberOfLines={1}>More</Text>
                      </TouchableOpacity>
                    </View>
                    {(post.commentCount || 0) > 0 ? (
                      <TouchableOpacity onPress={() => openComments(post._id)}>
                        <Text style={[styles.viewCommentsLink, { color: isDark ? "#8AB4FF" : "#1D4ED8" }]}>View all {post.commentCount || 0} comments</Text>
                      </TouchableOpacity>
                    ) : null}
                      </View>
                );
              })
            )}
          </View>
        ) : null}
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
        visible={Boolean(editingPost)}
        transparent
        animationType="fade"
        onRequestClose={() => (savingPostEdit ? null : setEditingPost(null))}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.editModalCard}>
            <Text style={styles.cardTitle}>Edit Post</Text>
            <Text style={styles.meta}>Update your description. Links will remain clickable.</Text>
            <TextInput
              style={styles.editPostInput}
              multiline
              placeholder="Update your post..."
              value={editingPost?.content || ""}
              onChangeText={(text) => setEditingPost((prev) => (prev ? { ...prev, content: text } : prev))}
              editable={!savingPostEdit}
            />
            <View style={styles.editModalActions}>
              <TouchableOpacity
                style={[styles.secondaryBtn, savingPostEdit && styles.disabledBtn]}
                onPress={() => setEditingPost(null)}
                disabled={savingPostEdit}
              >
                <Text style={styles.secondaryBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryBtn, savingPostEdit && styles.disabledBtn]}
                onPress={savePostEdit}
                disabled={savingPostEdit}
              >
                <Text style={styles.primaryBtnText}>{savingPostEdit ? "Saving..." : "Save"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={commentsModal.visible}
        transparent
        animationType="slide"
        onRequestClose={() => setCommentsModal({ visible: false, postId: "", comments: [] })}
      >
        <View style={styles.commentsModalRoot}>
          <View style={styles.commentsSheet}>
            <View style={styles.commentsHeader}>
              <Text style={styles.cardTitle}>All Comments</Text>
              <TouchableOpacity onPress={() => setCommentsModal({ visible: false, postId: "", comments: [] })}>
                <Ionicons name="close" size={20} color="#344054" />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 360 }}>
              {commentsModal.comments.length === 0 ? (
                <View style={styles.commentsEmptyState}>
                  <Text style={styles.commentsEmptyEmoji}>💬</Text>
                  <Text style={styles.commentsEmptyTitle}>No comments yet</Text>
                  <Text style={styles.commentsEmptyText}>Be the first to comment!</Text>
                </View>
              ) : (
                commentsModal.comments.map((item) => {
                  const isMine = String(item.authorId?._id || "") === String(user?.id || "");
                  const editing = editingCommentId === item._id;
                  const commentInitial = String(item.authorId?.name || "U").trim().charAt(0).toUpperCase();
                  return (
                    <View key={item._id} style={styles.commentItem}>
                      <View style={styles.commentTopRow}>
                        <View style={styles.commentAvatar}>
                          <Text style={styles.commentAvatarText}>{commentInitial}</Text>
                        </View>
                        <View style={styles.commentMetaBlock}>
                          <Text style={styles.commentAuthor}>{item.authorId?.name || "User"}</Text>
                          <Text style={styles.metaSmall}>{item.createdAt ? new Date(item.createdAt).toLocaleString() : ""}</Text>
                        </View>
                      </View>
                      {editing ? (
                        <>
                          <TextInput
                            style={styles.commentEditInput}
                            value={editingCommentText}
                            onChangeText={setEditingCommentText}
                          />
                          <View style={styles.commentActionsRow}>
                            <TouchableOpacity onPress={saveCommentEdit}>
                              <Text style={styles.action}>Save</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => {
                                setEditingCommentId("");
                                setEditingCommentText("");
                              }}
                            >
                              <Text style={styles.actionDanger}>Cancel</Text>
                            </TouchableOpacity>
                          </View>
                        </>
                      ) : (
                        <>
                          <Text style={styles.commentBody}>{item.content}</Text>
                          <View style={styles.commentActionsRow}>
                            <TouchableOpacity onPress={() => replyToComment(item)}>
                              <Text style={styles.action}>Reply</Text>
                            </TouchableOpacity>
                            {isMine ? (
                              <>
                                <TouchableOpacity
                                  onPress={() => {
                                    setEditingCommentId(item._id);
                                    setEditingCommentText(item.content || "");
                                  }}
                                >
                                  <Text style={styles.action}>Edit</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => removeComment(item._id)}>
                                  <Text style={styles.actionDanger}>Delete</Text>
                                </TouchableOpacity>
                              </>
                            ) : null}
                          </View>
                        </>
                      )}
                    </View>
                  );
                })
              )}
            </ScrollView>
            <View style={styles.commentComposerSheet}>
              <View style={styles.commentAvatar}>
                <Text style={styles.commentAvatarText}>{String(user?.name || "U").trim().charAt(0).toUpperCase()}</Text>
              </View>
              <TextInput
                style={styles.commentInput}
                placeholder="Write a comment..."
                value={commentDrafts[commentsModal.postId] || ""}
                onChangeText={(text) => setCommentDrafts((prev) => ({ ...prev, [commentsModal.postId]: text }))}
              />
              <TouchableOpacity onPress={() => comment(commentsModal.postId)}>
                <Text style={styles.action}>Send</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={Boolean(postOptionsFor)}
        transparent
        animationType="slide"
        onRequestClose={() => setPostOptionsFor(null)}
      >
        <TouchableOpacity style={styles.sheetOverlay} activeOpacity={1} onPress={() => setPostOptionsFor(null)}>
          <TouchableOpacity activeOpacity={1} style={styles.optionsSheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.optionsTitle}>Post options</Text>

            <TouchableOpacity style={styles.optionRow} onPress={() => postOptionsFor && react(postOptionsFor._id, "save")}>
              <Ionicons name={postOptionsFor?.isSaved ? "bookmark" : "bookmark-outline"} size={18} color="#344054" />
              <Text style={styles.optionText}>{postOptionsFor?.isSaved ? "Unsave Post" : "Save Post"}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.optionRow} onPress={() => postOptionsFor && copyPostLink(postOptionsFor)}>
              <Ionicons name="copy-outline" size={18} color="#344054" />
              <Text style={styles.optionText}>Copy Link</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.optionRow} onPress={reportPost}>
              <Ionicons name="flag-outline" size={18} color="#344054" />
              <Text style={styles.optionText}>Report Post</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.optionRow} onPress={() => postOptionsFor && hidePost(postOptionsFor._id)}>
              <Ionicons name="eye-off-outline" size={18} color="#344054" />
              <Text style={styles.optionText}>Hide Post</Text>
            </TouchableOpacity>

            {postOptionsFor?.authorId?._id ? (
              <TouchableOpacity
                style={styles.optionRow}
                onPress={() => {
                  const authorId = String(postOptionsFor.authorId?._id || "");
                  setPostOptionsFor(null);
                  if (authorId) router.push(`/public-profile/${authorId}` as never);
                }}
              >
                <Ionicons name="person-outline" size={18} color="#344054" />
                <Text style={styles.optionText}>View Profile</Text>
              </TouchableOpacity>
            ) : null}

            {postOptionsFor?.authorId?._id && String(postOptionsFor.authorId._id) === String(user?.id || "") ? (
              <>
                <TouchableOpacity
                  style={styles.optionRow}
                  onPress={() => {
                    setEditingPost({ postId: postOptionsFor._id, content: postOptionsFor.content || "" });
                    setPostOptionsFor(null);
                  }}
                >
                  <Ionicons name="create-outline" size={18} color="#344054" />
                  <Text style={styles.optionText}>Edit Post</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.optionRow}
                  onPress={() => {
                    const postId = postOptionsFor._id;
                    setPostOptionsFor(null);
                    confirmDeletePost(postId);
                  }}
                >
                  <Ionicons name="trash-outline" size={18} color="#B42318" />
                  <Text style={styles.optionTextDanger}>Delete Post</Text>
                </TouchableOpacity>
              </>
            ) : null}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: "#F3F5F7", padding: 16 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#F3F5F7" },
  heading: { fontSize: 30, fontWeight: "900", color: "#13251E" },
  subheading: { marginTop: 6, marginBottom: 14, color: "#475467", lineHeight: 21 },
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
  sectionNavRow: { flexDirection: "row", gap: 8, marginBottom: 10 },
  sectionChip: {
    borderWidth: 1,
    borderColor: "#D0D5DD",
    backgroundColor: "#fff",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  sectionChipActive: { borderColor: "#1F7A4C", backgroundColor: "#EAF6EF" },
  sectionChipText: { color: "#475467", fontWeight: "700", fontSize: 12 },
  sectionChipTextActive: { color: "#1F7A4C" },
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
  meta: { color: "#667085", marginTop: 6 },
  metaSmall: { color: "#667085", marginTop: 2, fontSize: 12 },
  rowItem: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 10 },
  rowTitle: { color: "#1E2B24", fontWeight: "700" },
  action: { color: "#175CD3", fontWeight: "700" },
  actionDanger: { color: "#B42318", fontWeight: "700" },
  feedSection: { gap: 14 },
  startPostCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E4E7EC",
    padding: 14,
    marginBottom: 4
  },
  startPostAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#EAF6EF",
    alignItems: "center",
    justifyContent: "center"
  },
  startPostAvatarText: { color: "#1F7A4C", fontWeight: "900", fontSize: 18 },
  startPostInput: {
    flex: 1,
    minHeight: 44,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#D0D5DD",
    justifyContent: "center",
    paddingHorizontal: 14,
    backgroundColor: "#FAFAFA"
  },
  startPostPlaceholder: { color: "#667085", fontWeight: "600" },
  postCard: {
    borderWidth: 1,
    borderColor: "#E4E7EC",
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginVertical: 2,
    backgroundColor: "#FFFFFF"
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
  postMenuBtn: {
    marginLeft: 6,
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: "#EAECF0",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center"
  },
  postText: { marginTop: 10, color: "#344054", lineHeight: 24, fontWeight: "500", fontSize: 15.5 },
  postLink: { color: "#175CD3", fontWeight: "700" },
  viewMoreBtn: { marginTop: 6, alignSelf: "flex-start" },
  viewMoreText: { color: "#175CD3", fontWeight: "800" },
  postImage: {
    width: carouselWidth,
    height: 240,
    borderRadius: 14,
    marginTop: 10,
    marginRight: 8,
    borderWidth: 1,
    borderColor: "#E4E7EC"
  },
  dotRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 8 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#D0D5DD" },
  dotActive: { width: 14, backgroundColor: "#1F7A4C", borderRadius: 7 },
  postActionRow: { marginTop: 10, flexDirection: "row", gap: 6 },
  postActionBtn: {
    flex: 1,
    minWidth: 0,
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#EAECF0"
  },
  postActionText: { color: "#475467", fontWeight: "700", fontSize: 11, textAlign: "center" },
  postActionTextActive: { color: "#175CD3" },
  postActionBtnActive: { backgroundColor: "#EEF4FF", borderColor: "#B2DDFF" },
  selectedReactionEmoji: { fontSize: 18 },
  feedStatsRow: { marginTop: 10, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: "#EAECF0" },
  feedStatsText: { color: "#475467", fontWeight: "700", fontSize: 12 },
  reactionDropdown: {
    position: "absolute",
    left: 12,
    bottom: 56,
    borderWidth: 1,
    borderColor: "#E4E7EC",
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 8,
    paddingVertical: 6,
    flexDirection: "row",
    gap: 6,
    shadowColor: "#101828",
    shadowOpacity: 0.14,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8
  },
  reactionDropdownItem: {
    alignItems: "center",
    justifyContent: "center",
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F9FAFB"
  },
  reactionDropdownEmoji: { fontSize: 14 },
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
  commentComposer: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#E4E7EC",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  commentInput: { flex: 1, minHeight: 32, color: "#344054" },
  commentLine: { marginTop: 6, color: "#475467" },
  viewCommentsLink: { marginTop: 8, color: "#175CD3", fontWeight: "800" },
  commentComposerSheet: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#EAECF0",
    paddingTop: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  modalOverlay: { flex: 1, backgroundColor: "rgba(15,23,42,0.45)", alignItems: "center", justifyContent: "center", padding: 18 },
  editModalCard: {
    width: "100%",
    maxWidth: 520,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E4E7EC",
    padding: 14
  },
  editPostInput: {
    marginTop: 10,
    minHeight: 120,
    borderWidth: 1,
    borderColor: "#D0D5DD",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#fff",
    textAlignVertical: "top"
  },
  editModalActions: { marginTop: 12, flexDirection: "row", gap: 10, justifyContent: "flex-end" },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: "#D0D5DD",
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14
  },
  secondaryBtnText: { color: "#344054", fontWeight: "800" },
  primaryBtn: {
    backgroundColor: "#1F7A4C",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16
  },
  primaryBtnText: { color: "#fff", fontWeight: "900" },
  disabledBtn: { opacity: 0.6 },
  commentsModalRoot: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.45)",
    justifyContent: "flex-end"
  },
  commentsSheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 14
  },
  commentsHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  commentsEmptyState: { alignItems: "center", justifyContent: "center", paddingVertical: 26, gap: 4 },
  commentsEmptyEmoji: { fontSize: 24 },
  commentsEmptyTitle: { color: "#1E2B24", fontWeight: "800", fontSize: 16 },
  commentsEmptyText: { color: "#667085", fontWeight: "600" },
  commentItem: {
    borderWidth: 1,
    borderColor: "#EAECF0",
    borderRadius: 10,
    padding: 10,
    marginBottom: 8
  },
  commentTopRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  commentAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#EAF6EF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#CFE8D6"
  },
  commentAvatarText: { color: "#1F7A4C", fontWeight: "900" },
  commentMetaBlock: { flex: 1 },
  commentAuthor: { color: "#1E2B24", fontWeight: "800" },
  commentBody: { color: "#344054", marginTop: 4, lineHeight: 18 },
  commentEditInput: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: "#D0D5DD",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  commentActionsRow: { flexDirection: "row", gap: 16, marginTop: 8 },
  previewRow: { gap: 8, marginTop: 10 },
  composerPreview: { width: 110, height: 110, borderRadius: 10, borderWidth: 1, borderColor: "#E4E7EC" },
  viewerRoot: { flex: 1, backgroundColor: "rgba(0,0,0,0.95)", justifyContent: "center" },
  viewerClose: { position: "absolute", right: 16, top: 50, zIndex: 10, padding: 8 },
  zoomWrap: { width },
  zoomInner: { width, height: "100%", alignItems: "center", justifyContent: "center" },
  viewerImage: { width, height: "85%" },
  sheetOverlay: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.45)",
    justifyContent: "flex-end"
  },
  optionsSheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 20
  },
  sheetHandle: {
    alignSelf: "center",
    width: 44,
    height: 5,
    borderRadius: 999,
    backgroundColor: "#D0D5DD",
    marginBottom: 12
  },
  optionsTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#101828",
    marginBottom: 10
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14
  },
  optionText: {
    color: "#344054",
    fontWeight: "700",
    fontSize: 14
  },
  optionTextDanger: {
    color: "#B42318",
    fontWeight: "700",
    fontSize: 14
  }
});







