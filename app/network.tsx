import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  ActivityIndicator,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
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
import { getAppErrorMessage, handleAppError } from "@/lib/appError";
import { useAuth } from "@/context/AuthContext";
import { useLearner } from "@/context/LearnerContext";
import { isKidStage } from "@/lib/learnerExperience";
import { useAppTheme } from "@/context/ThemeContext";
import { notify } from "@/utils/notify";
import { pickAndUploadPostImages } from "@/utils/postMediaUpload";
import { sharePost } from "@/utils/sharePost";
import { sanitizeDisplayText } from "@/utils/textSanitize";
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

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value.filter((item) => item != null) as T[] : [];
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
  reactions?: {
    userId?: string | { _id?: string; name?: string; role?: string; profilePhotoUrl?: string } | null;
    type?: "like" | "love" | "care" | "haha" | "wow" | "sad" | "angry" | null;
  }[];
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
  authorId?: { _id?: string; name?: string; role?: string; profilePhotoUrl?: string } | null;
};

type Suggestion = {
  id: string;
  name: string;
  role: "student" | "mentor";
  reason: string;
  profilePhotoUrl?: string;
};

type ConnectionRow = {
  _id: string;
  requesterId?: { _id?: string; name?: string; role?: string; profilePhotoUrl?: string } | null;
  recipientId?: { _id?: string; name?: string; role?: string; profilePhotoUrl?: string } | null;
  status: "pending" | "accepted" | "rejected" | "blocked";
};

type CircleMember = {
  id: string;
  name: string;
  role: string;
  profilePhotoUrl?: string;
};

type PostLikeUser = {
  id: string;
  name: string;
  role: string;
  profilePhotoUrl?: string;
  reactionType?: "like" | "love" | "care" | "haha" | "wow" | "sad" | "angry" | null;
};

type NetworkSectionId = "compose" | "feed" | "institution" | "connections";

const networkSections: { id: NetworkSectionId; label: string }[] = [
  { id: "feed", label: "Posts" },
  { id: "institution", label: "Institution Feed" },
  { id: "compose", label: "Post" },
  { id: "connections", label: "My Circle" }
];

const FEED_BOTTOM_NAV_SPACE = 108;
const POST_COLLAPSED_LINES = 4;
const EXPAND_FALLBACK_THRESHOLD = 140;
const NETWORK_SECTION_STALE_MS = 2 * 60 * 1000;
const { width } = Dimensions.get("window");
const feedMediaWidth = width - 32;
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
  const params = useLocalSearchParams<{ section?: string; search?: string }>();
  const { user } = useAuth();
  const { learnerStage } = useLearner();
  const { colors, isDark } = useAppTheme();
  const isKid = user?.role === "student" && isKidStage(learnerStage);
  const isHighSchool = user?.role === "student" && learnerStage === "highschool";
  const insets = useSafeAreaInsets();
  const sectionFetchAtRef = useRef<Record<string, number>>({});
  const feedScrollRef = useRef<ScrollView | null>(null);
  const commentsScrollRef = useRef<ScrollView | null>(null);
  const [activeSection, setActiveSection] = useState<NetworkSectionId>("feed");
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [expandedPosts, setExpandedPosts] = useState<Record<string, boolean>>({});
  const [expandablePosts, setExpandablePosts] = useState<Record<string, boolean>>({});
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [suggestionPhotoById, setSuggestionPhotoById] = useState<Record<string, string>>({});
  const [personPhotoById, setPersonPhotoById] = useState<Record<string, string>>({});
  const [mediaSizeByUrl, setMediaSizeByUrl] = useState<Record<string, { width: number; height: number }>>({});
  const [pendingIncoming, setPendingIncoming] = useState<ConnectionRow[]>([]);
  const [circleMembers, setCircleMembers] = useState<CircleMember[]>([]);
  const [requestedCircleIds, setRequestedCircleIds] = useState<Record<string, boolean>>({});
  const [circleMemberIds, setCircleMemberIds] = useState<Record<string, boolean>>({});
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [postText, setPostText] = useState("");
  const [postImageUrls, setPostImageUrls] = useState<string[]>([]);
  const [postType, setPostType] = useState<FeedPost["postType"]>("learning_progress");
  const [followingState, setFollowingState] = useState<Record<string, boolean>>({});
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
  const [likesModal, setLikesModal] = useState<{ visible: boolean; postId: string; users: PostLikeUser[] }>({
    visible: false,
    postId: "",
    users: []
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
  const [connectionActionById, setConnectionActionById] = useState<Record<string, boolean>>({});
  const visibleSections = React.useMemo(
    () => (isKid ? networkSections.filter((item) => item.id === "institution") : networkSections),
    [isKid]
  );

  useEffect(() => {
    const section = String(params.section || "");
    if (section === "compose" || section === "feed" || section === "institution" || section === "connections") {
      setActiveSection(section);
    }
  }, [params.section]);

  useEffect(() => {
    if (isKid && activeSection !== "institution") {
      setActiveSection("institution");
    }
  }, [activeSection, isKid]);

  useEffect(() => {
    setSearchQuery(String(params.search || "").trim());
  }, [params.search]);

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
    const members: CircleMember[] = [];
    acceptedRows.forEach((item) => {
      const requesterId = String(item?.requesterId?._id || "");
      const recipientId = String(item?.recipientId?._id || "");
      const me = String(user?.id || "");
      const otherUser = requesterId === me ? item?.recipientId : recipientId === me ? item?.requesterId : null;
      const other = String(otherUser?._id || "");
      if (other) {
        inCircle[other] = true;
        if (String(otherUser?.role || "").toLowerCase() !== "mentor") {
          members.push({
            id: other,
            name: otherUser?.name || "Connection",
            role: otherUser?.role || "student",
            profilePhotoUrl: otherUser?.profilePhotoUrl || ""
          });
        }
      }
    });
    setCircleMemberIds(inCircle);
    setCircleMembers(members);
  }, [user?.id]);

  const loadFeedSection = useCallback(async (refresh = false, force = false) => {
    const cacheKey = "feed";
    if (shouldSkipSectionFetch(cacheKey, refresh, force)) return;
    const feedRes = await api.get<FeedPost[]>("/api/network/feed");
    const nextPosts = asArray<FeedPost>(feedRes.data);
    setPosts(nextPosts);
    const followMap: Record<string, boolean> = {};
    nextPosts.forEach((post) => {
      const authorId = String(post.authorId?._id || "");
      if (authorId) followMap[authorId] = Boolean(post.authorId?.isFollowing);
    });
    setFollowingState((prev) => ({ ...followMap, ...prev }));
    markSectionFetched(cacheKey);
  }, [markSectionFetched, shouldSkipSectionFetch]);

  const loadInstitutionSection = useCallback(async (refresh = false, force = false) => {
    const cacheKey = "institution";
    if (shouldSkipSectionFetch(cacheKey, refresh, force)) return;
    const feedRes = await api.get<FeedPost[]>("/api/network/feed/institution");
    const nextPosts = asArray<FeedPost>(feedRes.data);
    setPosts(nextPosts);
    const followMap: Record<string, boolean> = {};
    nextPosts.forEach((post) => {
      const authorId = String(post.authorId?._id || "");
      if (authorId) followMap[authorId] = Boolean(post.authorId?.isFollowing);
    });
    setFollowingState((prev) => ({ ...followMap, ...prev }));
    markSectionFetched(cacheKey);
  }, [markSectionFetched, shouldSkipSectionFetch]);

  const loadComposeSection = useCallback(async (refresh = false, force = false) => {
    const cacheKey = "compose";
    if (shouldSkipSectionFetch(cacheKey, refresh, force)) return;
    const [suggestionsRes, pendingRes, acceptedRes] = await Promise.allSettled([
      api.get<Suggestion[]>("/api/network/suggestions"),
      api.get<ConnectionRow[]>("/api/network/connections?status=pending"),
      api.get<ConnectionRow[]>("/api/network/connections?status=accepted")
    ]);
    const pendingRows = pendingRes.status === "fulfilled" ? asArray<ConnectionRow>(pendingRes.value.data) : [];
    const acceptedRows = acceptedRes.status === "fulfilled" ? asArray<ConnectionRow>(acceptedRes.value.data) : [];
    setSuggestions(suggestionsRes.status === "fulfilled" ? asArray<Suggestion>(suggestionsRes.value.data) : []);
    applyConnectionState(pendingRows, acceptedRows);
    markSectionFetched(cacheKey);
  }, [applyConnectionState, markSectionFetched, shouldSkipSectionFetch]);

  const loadConnectionsSection = useCallback(async (refresh = false, force = false) => {
    const cacheKey = "connections";
    if (shouldSkipSectionFetch(cacheKey, refresh, force)) return;
    const [pendingRes, acceptedRes] = await Promise.allSettled([
      api.get<ConnectionRow[]>("/api/network/connections?status=pending"),
      api.get<ConnectionRow[]>("/api/network/connections?status=accepted")
    ]);
    const pendingRows = pendingRes.status === "fulfilled" ? asArray<ConnectionRow>(pendingRes.value.data) : [];
    const acceptedRows = acceptedRes.status === "fulfilled" ? asArray<ConnectionRow>(acceptedRes.value.data) : [];
    applyConnectionState(pendingRows, acceptedRows);
    markSectionFetched(cacheKey);
  }, [applyConnectionState, markSectionFetched, shouldSkipSectionFetch]);

  const loadData = useCallback(
    async (refresh = false, force = false) => {
      try {
        if (refresh) setRefreshing(true);
        else setLoading(true);
        setError(null);

        if (activeSection === "feed") {
          await loadFeedSection(refresh, force);
        } else if (activeSection === "institution") {
          await loadInstitutionSection(refresh, force);
        } else if (activeSection === "compose") {
          await loadComposeSection(refresh, force);
      } else if (activeSection === "connections") {
          await loadConnectionsSection(refresh, force);
        }
      } catch (e: any) {
        setError(getAppErrorMessage(e, "Something went wrong. Please try again."));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [activeSection, loadComposeSection, loadConnectionsSection, loadFeedSection, loadInstitutionSection]
  );

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  useEffect(() => {
    void loadData(false);
  }, [activeSection, loadData]);

  useEffect(() => {
    let cancelled = false;
    const missingIds = suggestions
      .filter((item) => !item.profilePhotoUrl && !suggestionPhotoById[item.id])
      .slice(0, 12)
      .map((item) => item.id);

    if (missingIds.length === 0) return;

    (async () => {
      const rows = await Promise.all(
        missingIds.map(async (id) => {
          try {
            const { data } = await api.get(`/api/profiles/public/${id}`);
            return [id, data?.profile?.profilePhotoUrl || ""] as const;
          } catch {
            return [id, ""] as const;
          }
        })
      );

      if (cancelled) return;

      setSuggestionPhotoById((prev) => {
        let changed = false;
        const next = { ...prev };
        rows.forEach(([id, url]) => {
          if (url && next[id] !== url) {
            next[id] = url;
            changed = true;
          }
        });
        return changed ? next : prev;
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [suggestions, suggestionPhotoById]);

  const pendingIncomingByUserId = React.useMemo(() => {
    const next: Record<string, ConnectionRow> = {};
    pendingIncoming.forEach((item) => {
      const requesterId = String(item?.requesterId?._id || "");
      if (requesterId) next[requesterId] = item;
    });
    return next;
  }, [pendingIncoming]);

  const ensureComposerVisible = useCallback(() => {
    setTimeout(() => {
      feedScrollRef.current?.scrollToEnd({ animated: true });
    }, 180);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const missingIds = Array.from(
      new Set(
        [
          ...circleMembers
            .filter((item) => !item.profilePhotoUrl)
            .map((item) => String(item.id || "").trim()),
          ...commentsModal.comments
            .filter((item) => !item.authorId?.profilePhotoUrl)
            .map((item) => String(item.authorId?._id || "").trim())
        ].filter((id) => id && !personPhotoById[id])
      )
    ).slice(0, 16);

    if (missingIds.length === 0) return;

    (async () => {
      const rows = await Promise.all(
        missingIds.map(async (id) => {
          try {
            const { data } = await api.get(`/api/profiles/public/${id}`);
            return [id, data?.profile?.profilePhotoUrl || ""] as const;
          } catch {
            return [id, ""] as const;
          }
        })
      );

      if (cancelled) return;

      setPersonPhotoById((prev) => {
        let changed = false;
        const next = { ...prev };
        rows.forEach(([id, url]) => {
          if (url && next[id] !== url) {
            next[id] = url;
            changed = true;
          }
        });
        return changed ? next : prev;
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [circleMembers, commentsModal.comments, personPhotoById]);

  useEffect(() => {
    let cancelled = false;
    const mediaUrls = Array.from(
      new Set(
        posts
          .flatMap((post) => post.mediaUrls || [])
          .filter(Boolean)
          .filter((uri) => !mediaSizeByUrl[uri])
      )
    ).slice(0, 20);

    if (mediaUrls.length === 0) return;

    (async () => {
      const rows = await Promise.all(
        mediaUrls.map(
          (uri) =>
            new Promise<readonly [string, { width: number; height: number } | null]>((resolve) => {
              Image.getSize(
                uri,
                (w, h) => resolve([uri, { width: w, height: h }] as const),
                () => resolve([uri, null] as const)
              );
            })
        )
      );

      if (cancelled) return;

      setMediaSizeByUrl((prev) => {
        const next = { ...prev };
        let changed = false;
        rows.forEach(([uri, size]) => {
          if (size && !next[uri]) {
            next[uri] = size;
            changed = true;
          }
        });
        return changed ? next : prev;
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [mediaSizeByUrl, posts]);

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
        const content = sanitizeDisplayText(post.content || "").toLowerCase();
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
      sectionFetchAtRef.current.institution = 0;
      setActiveSection("feed");
    } catch (e: any) {
      const message = handleAppError(e, { fallbackMessage: "Failed to publish post." });
      setError(message);
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
      const message = handleAppError(e, { fallbackMessage: "Failed to upload post image." });
      setError(message);
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
      if (activeSection === "institution") {
        await loadInstitutionSection(true, true);
      }
    } catch (e: any) {
      const message = handleAppError(e, { fallbackMessage: "Failed to delete post." });
      setError(message);
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
      if (activeSection === "institution") {
        await loadInstitutionSection(true, true);
      }
    } catch (e: any) {
      const message = handleAppError(e, { fallbackMessage: "Failed to update post." });
      setError(message);
    } finally {
      setSavingPostEdit(false);
    }
  }

  async function react(postId: string, action: "like" | "react" | "save" | "share", reactionType?: (typeof REACTION_ORDER)[number]) {
    const prevPosts = posts;
    try {
      const post = posts.find((p) => p._id === postId);
      const wasSaved = Boolean(post?.isSaved);
      if (action === "share") {
        if (!post) return;
        const didShare = await sharePost(post);
        if (!didShare) return;
      }
      setPosts((prev) =>
        prev.map((item) => {
          if (item._id !== postId) return item;
          const next = { ...item };
          if (action === "save") {
            const nextSaved = !item.isSaved;
            next.isSaved = nextSaved;
            next.saveCount = Math.max(0, Number(item.saveCount || 0) + (nextSaved ? 1 : -1));
            return next;
          }
          if (action === "share") {
            next.shareCount = Math.max(0, Number(item.shareCount || 0) + 1);
            return next;
          }
          const nextType = reactionType || "like";
          const prevType = item.userReaction || null;
          if (prevType === nextType) {
            next.userReaction = null;
            next.likeCount = Math.max(0, Number(item.likeCount || 0) - 1);
            if (next.reactionCounts) {
              next.reactionCounts = {
                ...next.reactionCounts,
                [nextType]: Math.max(0, Number(next.reactionCounts?.[nextType] || 0) - 1)
              };
            }
            return next;
          }
          next.userReaction = nextType;
          if (!prevType) {
            next.likeCount = Number(item.likeCount || 0) + 1;
          }
          if (next.reactionCounts) {
            const nextCounts = { ...next.reactionCounts };
            if (prevType) {
              nextCounts[prevType] = Math.max(0, Number(nextCounts[prevType] || 0) - 1);
            }
            nextCounts[nextType] = Number(nextCounts[nextType] || 0) + 1;
            next.reactionCounts = nextCounts;
          }
          return next;
        })
      );
      await api.post(`/api/network/feed/${postId}/react`, reactionType ? { action, reactionType } : { action });
      setReactionMenuFor(null);
      if (action === "save") notify(wasSaved ? "Removed from saved." : "Saved for later.");
      if (action === "share") notify("Shared.");
      setPostOptionsFor(null);
    } catch (e: any) {
      setPosts(prevPosts);
      handleAppError(e, { fallbackMessage: `Unable to ${action} this post right now.` });
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
      handleAppError(e, { fallbackMessage: "Unable to post your comment right now." });
    }
  }

  async function openComments(postId: string) {
    try {
      setError(null);
      const { data } = await api.get<FeedComment[]>(`/api/network/feed/${postId}/comments`);
      setCommentsModal({ visible: true, postId, comments: data || [] });
      setEditingCommentId("");
      setEditingCommentText("");
      requestAnimationFrame(() => {
        setTimeout(() => commentsScrollRef.current?.scrollToEnd({ animated: false }), 80);
      });
    } catch (e: any) {
      handleAppError(e, { fallbackMessage: "Unable to load comments right now." });
    }
  }

  async function openLikes(post: FeedPost) {
    const reactions = post.reactions || [];
    if (!reactions.length) return;

    const unique = new Map<string, PostLikeUser>();
    reactions.forEach((entry) => {
      const rawUser = entry.userId;
      const id = typeof rawUser === "string" ? rawUser : String(rawUser?._id || "").trim();
      if (!id) return;
      unique.set(id, {
        id,
        name: typeof rawUser === "string" ? "ORIN User" : rawUser?.name || "ORIN User",
        role: typeof rawUser === "string" ? "member" : rawUser?.role || "member",
        profilePhotoUrl: typeof rawUser === "string" ? "" : rawUser?.profilePhotoUrl || personPhotoById[id] || "",
        reactionType: entry.type || "like"
      });
    });

    const users = Array.from(unique.values());
    const missingIds = users.filter((item) => !item.profilePhotoUrl).map((item) => item.id).slice(0, 20);

    if (missingIds.length > 0) {
      const rows = await Promise.all(
        missingIds.map(async (id) => {
          try {
            const { data } = await api.get(`/api/profiles/public/${id}`);
            return [id, data?.profile?.profilePhotoUrl || "", data?.user?.name || "", data?.user?.role || "member"] as const;
          } catch {
            return [id, "", "", "member"] as const;
          }
        })
      );

      setPersonPhotoById((prev) => {
        const next = { ...prev };
        let changed = false;
        rows.forEach(([id, photoUrl]) => {
          if (photoUrl && next[id] !== photoUrl) {
            next[id] = photoUrl;
            changed = true;
          }
        });
        return changed ? next : prev;
      });

      rows.forEach(([id, photoUrl, name, role]) => {
        const item = unique.get(id);
        if (!item) return;
        if (photoUrl) item.profilePhotoUrl = photoUrl;
        if (name) item.name = name;
        if (role) item.role = role;
      });
    }

    setLikesModal({ visible: true, postId: post._id, users: Array.from(unique.values()) });
  }

  function getSingleImageHeight(uri: string) {
    const size = mediaSizeByUrl[uri];
    if (!size?.width || !size?.height) return 320;
    const ratio = size.width / size.height;
    const computedHeight = feedMediaWidth / ratio;
    return Math.max(220, Math.min(520, computedHeight));
  }

  function getGridRowHeight(uris: string[], columnWidth: number, fallback = 230) {
    const heights = uris
      .map((uri) => {
        const size = mediaSizeByUrl[uri];
        if (!size?.width || !size?.height) return null;
        const ratio = size.width / size.height;
        return columnWidth / ratio;
      })
      .filter((value): value is number => typeof value === "number" && Number.isFinite(value));

    if (!heights.length) return fallback;

    const avgHeight = heights.reduce((sum, value) => sum + value, 0) / heights.length;
    return Math.max(190, Math.min(320, avgHeight));
  }

  function renderMediaLayout(postId: string, media: string[]) {
    if (!media.length) return null;

    if (media.length === 1) {
      const uri = media[0];
      return (
        <TouchableOpacity
          activeOpacity={0.95}
          style={styles.singleMediaWrap}
          onPress={() => setViewer({ visible: true, postId, images: media, index: 0 })}
        >
          <Image source={{ uri }} style={[styles.singlePostImage, { height: getSingleImageHeight(uri) }]} resizeMode="cover" />
        </TouchableOpacity>
      );
    }

    const visible = media.slice(0, 4);
    const extraCount = media.length - visible.length;

    if (visible.length === 2) {
      const tileHeight = getGridRowHeight(visible, (feedMediaWidth - 4) / 2);
      return (
        <View style={styles.mediaGridRow}>
          {visible.map((uri, idx) => (
            <TouchableOpacity
              key={`${postId}-two-${idx}`}
              activeOpacity={0.95}
              style={[styles.mediaHalf, { height: tileHeight }]}
              onPress={() => setViewer({ visible: true, postId, images: media, index: idx })}
            >
              <Image source={{ uri }} style={styles.mediaFill} resizeMode="cover" />
            </TouchableOpacity>
          ))}
        </View>
      );
    }

    if (visible.length === 3) {
      return (
        <View style={styles.mediaGridRow}>
          <TouchableOpacity
            activeOpacity={0.95}
            style={[styles.mediaHalf, styles.mediaTall]}
            onPress={() => setViewer({ visible: true, postId, images: media, index: 0 })}
          >
            <Image source={{ uri: visible[0] }} style={styles.mediaFill} resizeMode="cover" />
          </TouchableOpacity>
          <View style={styles.mediaStack}>
            {visible.slice(1).map((uri, idx) => (
              <TouchableOpacity
                key={`${postId}-three-${idx + 1}`}
                activeOpacity={0.95}
                style={[styles.mediaHalf, styles.mediaShort]}
                onPress={() => setViewer({ visible: true, postId, images: media, index: idx + 1 })}
              >
                <Image source={{ uri }} style={styles.mediaFill} resizeMode="cover" />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      );
    }

    return (
      <View style={styles.mediaFourGrid}>
        {visible.map((uri, idx) => {
          const isLast = idx === visible.length - 1 && extraCount > 0;
          return (
            <TouchableOpacity
              key={`${postId}-four-${idx}`}
              activeOpacity={0.95}
              style={styles.mediaQuarter}
              onPress={() => setViewer({ visible: true, postId, images: media, index: idx })}
            >
              <Image source={{ uri }} style={styles.mediaFill} resizeMode="cover" />
              {isLast ? (
                <View style={styles.mediaOverlay}>
                  <Text style={styles.mediaOverlayText}>+{extraCount}</Text>
                </View>
              ) : null}
            </TouchableOpacity>
          );
        })}
      </View>
    );
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
      handleAppError(e, { fallbackMessage: "Unable to update this comment right now." });
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
      handleAppError(e, { fallbackMessage: "Unable to delete this comment right now." });
    }
  }

  async function connect(recipientId: string) {
    if (connectionActionById[recipientId]) return;
    setConnectionActionById((prev) => ({ ...prev, [recipientId]: true }));
    setRequestedCircleIds((prev) => ({ ...prev, [recipientId]: true }));
    try {
      const { data } = await api.post<{ message?: string }>("/api/network/connections/request", { recipientId });
      notify(data?.message === "This user already requested to connect with you" ? "They already requested you. Accept it below." : "Request sent");
    } catch (e: any) {
      setRequestedCircleIds((prev) => {
        const next = { ...prev };
        delete next[recipientId];
        return next;
      });
      handleAppError(e, { fallbackMessage: "Unable to send the request right now." });
    } finally {
      setConnectionActionById((prev) => ({ ...prev, [recipientId]: false }));
    }
  }

  async function follow(targetId: string) {
    try {
      const { data } = await api.post<{ following: boolean }>(`/api/network/follow/${targetId}`);
      setFollowingState((prev) => ({ ...prev, [targetId]: Boolean(data?.following) }));
      notify(data?.following ? "Following" : "Unfollowed");
    } catch (e: any) {
      handleAppError(e, { fallbackMessage: "Unable to update follow right now." });
    }
  }

  async function respondConnection(connectionId: string, action: "accept" | "reject") {
    if (connectionActionById[connectionId]) return;
    setConnectionActionById((prev) => ({ ...prev, [connectionId]: true }));
    const existing = pendingIncoming.find((item) => item._id === connectionId);
    const otherId = String(existing?.requesterId?._id || "");
    setPendingIncoming((prev) => prev.filter((item) => item._id !== connectionId));
    if (action === "accept" && existing && otherId) {
      setCircleMemberIds((prev) => ({ ...prev, [otherId]: true }));
      setCircleMembers((prev) => [
        {
          id: otherId,
          name: existing?.requesterId?.name || "Connection",
          role: existing?.requesterId?.role || "student",
          profilePhotoUrl: existing?.requesterId?.profilePhotoUrl || ""
        },
        ...prev.filter((item) => item.id !== otherId)
      ]);
    }
    try {
      await api.post(`/api/network/connections/${connectionId}/respond`, { action });
      notify(action === "accept" ? "In Your Circle" : `Request ${action}ed.`);
    } catch (e: any) {
      await loadData(true, true);
      handleAppError(e, { fallbackMessage: `Unable to ${action} this request right now.` });
    } finally {
      setConnectionActionById((prev) => ({ ...prev, [connectionId]: false }));
    }
  }

  if (loading) {
    const loadingLabel =
      activeSection === "compose"
        ? "Preparing your post composer..."
        : activeSection === "connections"
          ? "Loading your circle..."
          : "Posts are loading...";
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <GlobalHeader
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder="Search circle, posts, people"
        />
        <View style={[styles.center, { backgroundColor: colors.background, paddingHorizontal: 24 }]}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={[styles.meta, { marginTop: 14, color: colors.textMuted, textAlign: "center" }]}>{loadingLabel}</Text>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={Platform.OS === "ios" ? 12 : 0}>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <GlobalHeader
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder="Search circle, posts, people"
        />
        <ScrollView
          ref={feedScrollRef}
          style={{ backgroundColor: colors.background }}
          contentContainerStyle={[
            styles.container,
            {
              backgroundColor: colors.background,
              paddingBottom: FEED_BOTTOM_NAV_SPACE + insets.bottom + (activeSection === "compose" ? 180 : 0)
            }
          ]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadData(true, true)} tintColor={colors.accent} />}
          keyboardShouldPersistTaps="handled"
        >
        <Text style={[styles.heading, { color: colors.text }]}>{isKid ? "School Posts" : "Posts"}</Text>
        <Text style={[styles.subheading, { color: colors.textMuted }]}>
          {user?.role === "mentor" ? "Your professional feed for mentor insights, conversations, and visibility." : "Your student growth feed with people, ideas, and progress that match your journey."}
        </Text>
        {isKid ? (
          <Text style={[styles.meta, { color: colors.textMuted }]}>
            Kids mode shows only your institution feed with simple reactions and teacher-friendly updates.
          </Text>
        ) : isHighSchool ? (
          <Text style={[styles.meta, { color: colors.textMuted }]}>
            High school mode keeps institution learning first while still allowing selected posting and discussion.
          </Text>
        ) : null}
        {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sectionNavRow}>
          {visibleSections.map((item) => {
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
              onFocus={ensureComposerVisible}
              multiline
            />
            <View style={styles.rowItem}>
              <TouchableOpacity
                style={[
                  styles.secondaryButton,
                  {
                    borderColor: colors.border,
                    backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF"
                  },
                  uploadingPostImage && styles.disabledBtn
                ]}
                onPress={uploadPostImages}
                disabled={uploadingPostImage}
              >
                <Text style={[styles.secondaryButtonText, { color: colors.text }]}>{uploadingPostImage ? "Uploading..." : "Add Photos"}</Text>
              </TouchableOpacity>
              {postImageUrls.length ? (
                <TouchableOpacity
                  onPress={() => setPostImageUrls([])}
                  style={[
                    styles.secondaryButton,
                    {
                      borderColor: "#F04438",
                      backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF"
                    }
                  ]}
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
                const incomingRequest = pendingIncomingByUserId[item.id];
                const suggestionPhoto = item.profilePhotoUrl || suggestionPhotoById[item.id] || "";
                return (
                  <View key={`discover-${item.id}`} style={styles.rowItem}>
                    {suggestionPhoto ? (
                      <Image source={{ uri: suggestionPhoto }} style={styles.commentAvatarImage} />
                    ) : (
                      <View style={styles.commentAvatar}>
                        <Text style={styles.commentAvatarText}>{String(item.name || "U").trim().charAt(0).toUpperCase()}</Text>
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.rowTitle, { color: colors.text }]}>{item.name}</Text>
                      <Text style={[styles.meta, { color: colors.textMuted }]}>{item.reason}</Text>
                    </View>
                    {incomingRequest ? (
                      <View style={styles.inlineActions}>
                        <TouchableOpacity onPress={() => respondConnection(incomingRequest._id, "accept")} disabled={Boolean(connectionActionById[incomingRequest._id])}>
                          <Text style={styles.action}>Accept</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => respondConnection(incomingRequest._id, "reject")} disabled={Boolean(connectionActionById[incomingRequest._id])}>
                          <Text style={styles.actionDanger}>Reject</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <TouchableOpacity
                        onPress={() => (!inCircle && !requested ? connect(item.id) : undefined)}
                        disabled={inCircle || requested || Boolean(connectionActionById[item.id])}
                      >
                        <Text style={styles.action}>
                          {inCircle ? "\u2713 In Your Circle" : requested ? "Request Sent" : "+ Add to Circle"}
                        </Text>
                      </TouchableOpacity>
                    )}
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
            <Text style={[styles.cardTitle, { color: colors.text, marginTop: 18 }]}>Your Circle</Text>
            {circleMembers.length === 0 ? (
              <Text style={[styles.meta, { color: colors.textMuted }]}>Accepted student connections will appear here.</Text>
            ) : (
              circleMembers.map((member) => (
                <TouchableOpacity
                  key={`circle-${member.id}`}
                  style={styles.rowItem}
                  onPress={() => router.push(`/public-profile/${member.id}` as never)}
                >
                  {member.profilePhotoUrl || personPhotoById[member.id] ? (
                    <Image source={{ uri: member.profilePhotoUrl || personPhotoById[member.id] }} style={styles.commentAvatarImage} />
                  ) : (
                    <View style={styles.commentAvatar}>
                      <Text style={styles.commentAvatarText}>{String(member.name || "U").trim().charAt(0).toUpperCase()}</Text>
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.rowTitle, { color: colors.text }]}>{member.name}</Text>
                    <Text style={[styles.meta, { color: colors.textMuted }]}>{member.role}</Text>
                  </View>
                  <Text style={styles.action}>View Profile</Text>
                </TouchableOpacity>
              ))
            )}
          </View>
        ) : null}

        {activeSection === "feed" || activeSection === "institution" ? (
          <View style={styles.feedSection}>
            {activeSection === "feed" ? (
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
            ) : (
              <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.cardTitle, { color: colors.text }]}>Institution Feed</Text>
                <Text style={[styles.meta, { color: colors.textMuted }]}>
                  Posts here are only from students in your own institution.
                </Text>
              </View>
            )}
            {loading && filteredPosts.length === 0 ? (
              <Text style={[styles.meta, { color: colors.textMuted }]}>
                {activeSection === "institution" ? "Institution feed is loading..." : "Posts are loading..."}
              </Text>
            ) : filteredPosts.filter((post) => !hiddenPostIds[post._id]).length === 0 ? (
              <Text style={[styles.meta, { color: colors.textMuted }]}>
                {normalizedSearch
                  ? "No posts match your search yet."
                  : activeSection === "institution"
                    ? "No posts from your institution yet."
                    : "No posts yet. Create the first one."}
              </Text>
            ) : (
              filteredPosts.filter((post) => !hiddenPostIds[post._id]).map((post) => {
                const authorId = String(post.authorId?._id || "");
                const isOwnPost = authorId && String(authorId) === String(user?.id || "");
                const isFollowing = authorId ? Boolean(followingState[authorId]) : false;
                const media = (post.mediaUrls || []).slice(0, 5);
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
                  <View key={post._id} style={styles.postCard}>
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
                      const contentText = sanitizeDisplayText(post.content || "");
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
                      {splitByUrls(sanitizeDisplayText(post.content || "")).map((part, idx) =>
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

                    {media.length ? renderMediaLayout(post._id, media) : null}

                    {(summaryReactionCount > 0 || summaryCommentCount > 0) ? (
                      <TouchableOpacity
                        activeOpacity={summaryReactionCount > 0 ? 0.85 : 1}
                        onPress={() => (summaryReactionCount > 0 ? openLikes(post) : undefined)}
                        style={[styles.feedStatsRow, { borderColor: colors.border }]}
                      >
                        <Text style={[styles.feedStatsText, { color: colors.textMuted }]}>
                          {summaryReactionCount > 0 ? `${summaryReactionIcons} ${summaryReactionCount}` : ""}
                          {summaryReactionCount > 0 && summaryCommentCount > 0 ? "   |   " : ""}
                          {summaryCommentCount > 0 ? `${summaryCommentCount} comments` : ""}
                        </Text>
                      </TouchableOpacity>
                    ) : null}
                    {reactionMenuFor === post._id ? (
                      <View style={[styles.reactionDropdown, { backgroundColor: isDark ? "#16212B" : "#FFFFFF", borderColor: colors.border }]}>
                        {REACTION_ORDER.map((type) => (
                          <TouchableOpacity
                            key={`${post._id}-drop-${type}`}
                            style={[styles.reactionDropdownItem, { backgroundColor: isDark ? colors.surfaceAlt : "#F9FAFB" }]}
                            onPress={() => react(post._id, "react", type)}
                          >
                            <Text style={styles.reactionDropdownEmoji}>{REACTION_OPTIONS[type].emoji}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    ) : null}
                    <View style={styles.postActionRow}>
                      <TouchableOpacity
                        style={[styles.postActionBtn, userReaction ? styles.postActionBtnActive : null]}
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
                            : isKid
                              ? "React"
                              : "Like"}
                        </Text>
                      </TouchableOpacity>
                      {!isKid ? (
                        <TouchableOpacity
                          style={styles.postActionBtn}
                          onPress={() => {
                            setReactionMenuFor(null);
                            openComments(post._id);
                          }}
                        >
                           <Ionicons name="chatbubble-outline" size={16} color={colors.textMuted} />
                           <Text style={[styles.postActionText, { color: colors.textMuted }]} numberOfLines={1}>Comment</Text>
                        </TouchableOpacity>
                      ) : null}
                      {!isKid ? (
                        <TouchableOpacity
                          style={styles.postActionBtn}
                          onPress={() => {
                            setReactionMenuFor(null);
                            react(post._id, "share");
                          }}
                        >
                           <Ionicons name="share-social-outline" size={16} color={colors.textMuted} />
                           <Text style={[styles.postActionText, { color: colors.textMuted }]} numberOfLines={1}>Share</Text>
                        </TouchableOpacity>
                      ) : null}
                      {!isKid ? (
                        <TouchableOpacity
                          style={styles.postActionBtn}
                          onPress={() => {
                            setReactionMenuFor(null);
                            react(post._id, "save");
                          }}
                        >
                           <Ionicons name={post.isSaved ? "bookmark" : "bookmark-outline"} size={16} color={post.isSaved ? colors.accent : colors.textMuted} />
                           <Text style={[styles.postActionText, { color: post.isSaved ? colors.accent : colors.textMuted }]} numberOfLines={1}>
                             {post.isSaved ? "Saved" : "Save"}
                           </Text>
                        </TouchableOpacity>
                      ) : null}
                      <TouchableOpacity
                        style={styles.postActionBtn}
                        onPress={() => {
                          setReactionMenuFor(null);
                          openPostOptions(post);
                        }}
                      >
                         <Ionicons name="ellipsis-horizontal" size={16} color={colors.textMuted} />
                         <Text style={[styles.postActionText, { color: colors.textMuted }]} numberOfLines={1}>More</Text>
                      </TouchableOpacity>
                    </View>
                    {!isKid && (post.commentCount || 0) > 0 ? (
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
            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={Platform.OS === "ios" ? 12 : 0}>
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
            </KeyboardAvoidingView>
          </View>
        </Modal>

      <Modal
        visible={commentsModal.visible}
        transparent
        animationType="slide"
        onRequestClose={() => setCommentsModal({ visible: false, postId: "", comments: [] })}
      >
        <View style={styles.commentsModalRoot}>
          <KeyboardAvoidingView
            style={{ width: "100%", justifyContent: "flex-end" }}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            keyboardVerticalOffset={Platform.OS === "ios" ? insets.top + 12 : 24}
          >
            <View style={[styles.commentsSheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.commentsHeader}>
                <Text style={[styles.cardTitle, { color: colors.text }]}>All Comments</Text>
                <TouchableOpacity onPress={() => setCommentsModal({ visible: false, postId: "", comments: [] })}>
                  <Ionicons name="close" size={20} color={colors.text} />
                </TouchableOpacity>
              </View>
              <ScrollView
                ref={commentsScrollRef}
                style={{ maxHeight: 360 }}
                keyboardShouldPersistTaps="handled"
                onContentSizeChange={() => commentsScrollRef.current?.scrollToEnd({ animated: false })}
              >
                {commentsModal.comments.length === 0 ? (
                  <View style={styles.commentsEmptyState}>
                    <Text style={styles.commentsEmptyEmoji}>Comments</Text>
                    <Text style={[styles.commentsEmptyTitle, { color: colors.text }]}>No comments yet</Text>
                    <Text style={[styles.commentsEmptyText, { color: colors.textMuted }]}>Be the first to comment!</Text>
                  </View>
                ) : (
                  commentsModal.comments.map((item) => {
                  const isMine = String(item.authorId?._id || "") === String(user?.id || "");
                  const editing = editingCommentId === item._id;
                  const commentInitial = String(item.authorId?.name || "U").trim().charAt(0).toUpperCase();
                  const commentAuthorId = String(item.authorId?._id || "");
                  const commentPhotoUrl = item.authorId?.profilePhotoUrl || personPhotoById[commentAuthorId] || "";
                  return (
                    <View key={item._id} style={[styles.commentItem, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
                      <View style={styles.commentTopRow}>
                        {commentPhotoUrl ? (
                          <Image source={{ uri: commentPhotoUrl }} style={styles.commentAvatarImage} />
                        ) : (
                          <View style={styles.commentAvatar}>
                            <Text style={styles.commentAvatarText}>{commentInitial}</Text>
                          </View>
                        )}
                        <View style={styles.commentMetaBlock}>
                          <Text style={[styles.commentAuthor, { color: colors.text }]}>{item.authorId?.name || "User"}</Text>
                          <Text style={[styles.metaSmall, { color: colors.textMuted }]}>{item.createdAt ? new Date(item.createdAt).toLocaleString() : ""}</Text>
                        </View>
                      </View>
                      {editing ? (
                        <>
                          <TextInput
                            style={[styles.commentEditInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                            value={editingCommentText}
                            onChangeText={setEditingCommentText}
                            placeholderTextColor={colors.textMuted}
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
                          <Text style={[styles.commentBody, { color: colors.text }]}>{sanitizeDisplayText(item.content)}</Text>
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
                <View
                  style={[
                    styles.commentComposerSheet,
                    { borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, 18) }
                  ]}
                >
                <View style={styles.commentAvatar}>
                  <Text style={styles.commentAvatarText}>{String(user?.name || "U").trim().charAt(0).toUpperCase()}</Text>
                </View>
                  <TextInput
                    style={[styles.commentInput, { color: colors.text }]}
                    placeholder="Write a comment..."
                    placeholderTextColor={colors.textMuted}
                    value={commentDrafts[commentsModal.postId] || ""}
                    onChangeText={(text) => setCommentDrafts((prev) => ({ ...prev, [commentsModal.postId]: text }))}
                    onFocus={() => setTimeout(() => commentsScrollRef.current?.scrollToEnd({ animated: true }), 160)}
                  />
                <TouchableOpacity onPress={() => comment(commentsModal.postId)}>
                  <Text style={styles.action}>Send</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <Modal
        visible={likesModal.visible}
        transparent
        animationType="slide"
        onRequestClose={() => setLikesModal({ visible: false, postId: "", users: [] })}
      >
        <View style={styles.commentsModalRoot}>
          <View style={[styles.commentsSheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.commentsHeader}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>Liked By</Text>
              <TouchableOpacity onPress={() => setLikesModal({ visible: false, postId: "", users: [] })}>
                <Ionicons name="close" size={20} color={colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 360 }}>
              {likesModal.users.length === 0 ? (
                <View style={styles.commentsEmptyState}>
                  <Text style={styles.commentsEmptyEmoji}>Likes</Text>
                  <Text style={[styles.commentsEmptyTitle, { color: colors.text }]}>No likes yet</Text>
                  <Text style={[styles.commentsEmptyText, { color: colors.textMuted }]}>Likes will appear here.</Text>
                </View>
              ) : (
                likesModal.users.map((item) => (
                  <TouchableOpacity
                    key={`like-user-${item.id}`}
                    style={[styles.commentItem, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}
                    onPress={() => {
                      setLikesModal({ visible: false, postId: "", users: [] });
                      router.push(`/public-profile/${item.id}` as never);
                    }}
                  >
                    <View style={styles.commentTopRow}>
                      {item.profilePhotoUrl || personPhotoById[item.id] ? (
                        <Image source={{ uri: item.profilePhotoUrl || personPhotoById[item.id] }} style={styles.commentAvatarImage} />
                      ) : (
                        <View style={styles.commentAvatar}>
                          <Text style={styles.commentAvatarText}>{String(item.name || "U").trim().charAt(0).toUpperCase()}</Text>
                        </View>
                      )}
                      <View style={styles.commentMetaBlock}>
                        <Text style={[styles.commentAuthor, { color: colors.text }]}>{item.name}</Text>
                        <Text style={[styles.metaSmall, { color: colors.textMuted }]}>
                          {(item.role || "member").toString()} | {REACTION_OPTIONS[(item.reactionType || "like") as keyof typeof REACTION_OPTIONS]?.label || "Like"}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
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
    </KeyboardAvoidingView>
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
  inlineActions: { flexDirection: "row", alignItems: "center", gap: 10 },
  rowTitle: { color: "#1E2B24", fontWeight: "700" },
  action: { color: "#175CD3", fontWeight: "700" },
  actionDanger: { color: "#B42318", fontWeight: "700" },
  feedSection: { gap: 8, marginHorizontal: -16 },
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
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginVertical: 2,
    backgroundColor: "transparent"
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
  singleMediaWrap: { marginTop: 12 },
  singlePostImage: {
    width: feedMediaWidth,
    borderRadius: 18,
    backgroundColor: "#E5E7EB"
  },
  mediaGridRow: { marginTop: 12, flexDirection: "row", gap: 4 },
  mediaHalf: { flex: 1, borderRadius: 16, overflow: "hidden", backgroundColor: "#E5E7EB" },
  mediaTall: { height: 264 },
  mediaShort: { height: 130 },
  mediaStack: { flex: 1, gap: 4 },
  mediaFourGrid: { marginTop: 12, flexDirection: "row", flexWrap: "wrap", gap: 4 },
  mediaQuarter: {
    width: (feedMediaWidth - 4) / 2,
    height: 150,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#E5E7EB"
  },
  mediaFill: { width: "100%", height: "100%" },
  mediaOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15,23,42,0.42)",
    alignItems: "center",
    justifyContent: "center"
  },
  mediaOverlayText: { color: "#FFFFFF", fontSize: 30, fontWeight: "900" },
  postActionRow: { marginTop: 10, flexDirection: "row", gap: 6, zIndex: 2 },
  postActionBtn: {
    flex: 1,
    minWidth: 0,
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "transparent",
    borderWidth: 0
  },
  postActionText: { color: "#475467", fontWeight: "700", fontSize: 11, textAlign: "center" },
  postActionTextActive: { color: "#175CD3" },
  postActionBtnActive: { backgroundColor: "transparent", borderWidth: 0 },
  selectedReactionEmoji: { fontSize: 18 },
  feedStatsRow: { marginTop: 10, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: "#EAECF0" },
  feedStatsText: { color: "#475467", fontWeight: "700", fontSize: 12 },
  reactionDropdown: {
    position: "absolute",
    left: 12,
    bottom: 46,
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
    elevation: 12,
    zIndex: 40
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
    commentInput: {
      flex: 1,
      minHeight: 40,
      color: "#344054",
      paddingVertical: 8,
      paddingHorizontal: 10
    },
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
  commentAvatarImage: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: "#CFE8D6"
  },
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
