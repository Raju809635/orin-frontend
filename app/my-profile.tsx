import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Image, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useAppTheme } from "@/context/ThemeContext";
import { Ionicons } from "@expo/vector-icons";

type NetworkOverview = {
  connections?: {
    accepted?: number;
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

type EducationItem = { school?: string; degree?: string; year?: string };

type PublicProfileLite = {
  profile?: {
    profilePhotoUrl?: string;
    headline?: string;
    title?: string;
    about?: string;
    bio?: string;
    state?: string;
    collegeName?: string;
    education?: EducationItem[];
    skills?: string[];
    careerGoals?: string;
  };
  socialPreview?: {
    followers?: Array<{ _id?: string; name?: string; role?: string }>;
    following?: Array<{ _id?: string; name?: string; role?: string }>;
  };
};

type MentorProfilePrivate = {
  title?: string;
  company?: string;
  state?: string;
  experienceYears?: number;
  sessionPrice?: number;
  primaryCategory?: string;
  subCategory?: string;
  specializations?: string[];
  rating?: number;
  totalSessionsConducted?: number;
  verifiedBadge?: boolean;
  education?: EducationItem[];
};

type MentorSessionLite = {
  _id: string;
  sessionStatus?: string;
  studentId?: { name?: string; email?: string } | null;
};

export default function MyProfileScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const [overview, setOverview] = useState<NetworkOverview | null>(null);
  const [connections, setConnections] = useState<ConnectionRow[]>([]);
  const [myPosts, setMyPosts] = useState<FeedPost[]>([]);
  const [publicProfile, setPublicProfile] = useState<PublicProfileLite["profile"] | null>(null);
  const [socialPreview, setSocialPreview] = useState<PublicProfileLite["socialPreview"] | null>(null);
  const [mentorProfile, setMentorProfile] = useState<MentorProfilePrivate | null>(null);
  const [mentorSessions, setMentorSessions] = useState<MentorSessionLite[]>([]);
  const [activeList, setActiveList] = useState<"insights" | "audience" | "following" | "circle">("insights");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const editRoute = useMemo(() => (user?.role === "mentor" ? "/mentor-profile" : "/student-profile"), [user?.role]);
  const mentorStudentsMentored = useMemo(() => {
    const ids = new Set(
      mentorSessions
        .map((item) => item.studentId?.email || item.studentId?.name || "")
        .filter(Boolean)
    );
    return ids.size;
  }, [mentorSessions]);

  const heroTitle = useMemo(() => {
    if (user?.role === "mentor") return mentorProfile?.title || "Mentor";
    return publicProfile?.headline || "Student building with ORIN";
  }, [mentorProfile?.title, publicProfile?.headline, user?.role]);

  const heroMeta = useMemo(() => {
    if (user?.role === "mentor") {
      return [mentorProfile?.company, mentorProfile?.state].filter(Boolean).join(" â€¢ ");
    }
    return [publicProfile?.collegeName, publicProfile?.state].filter(Boolean).join(" â€¢ ");
  }, [mentorProfile?.company, mentorProfile?.state, publicProfile?.collegeName, publicProfile?.state, user?.role]);

  const educationLine = useMemo(() => {
    const source = user?.role === "mentor" ? mentorProfile?.education || [] : publicProfile?.education || [];
    if (!source.length) return "";
    const top = source[0];
    return [top?.degree, top?.school, top?.year].filter(Boolean).join(" â€¢ ");
  }, [mentorProfile?.education, publicProfile?.education, user?.role]);

  const avatarUrl = publicProfile?.profilePhotoUrl || "";
  const skillPreview = useMemo(() => (publicProfile?.skills || mentorProfile?.specializations || []).slice(0, 4), [mentorProfile?.specializations, publicProfile?.skills]);

  const loadProfileData = useCallback(async (refresh = false) => {
    try {
      if (refresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      const [overviewRes, connectionsRes, feedRes, publicRes, mentorProfileRes, mentorSessionsRes] = await Promise.allSettled([
        api.get<NetworkOverview>("/api/network/overview"),
        api.get<ConnectionRow[]>("/api/network/connections?status=accepted"),
        api.get<FeedPost[]>("/api/network/feed"),
        user?.id ? api.get<PublicProfileLite>(`/api/profiles/public/${user.id}`) : Promise.resolve({ data: {} as PublicProfileLite }),
        user?.role === "mentor"
          ? api.get<{ profile?: MentorProfilePrivate }>("/api/profiles/mentor/me")
          : Promise.resolve({ data: {} as { profile?: MentorProfilePrivate } }),
        user?.role === "mentor"
          ? api.get<MentorSessionLite[]>("/api/sessions/mentor/me")
          : Promise.resolve({ data: [] as MentorSessionLite[] })
      ]);

      const overviewData = overviewRes.status === "fulfilled" ? overviewRes.value.data : null;
      const connectionData = connectionsRes.status === "fulfilled" ? connectionsRes.value.data || [] : [];
      const feedData = feedRes.status === "fulfilled" ? feedRes.value.data || [] : [];
      const publicData = publicRes.status === "fulfilled" ? publicRes.value.data : null;

      setOverview(overviewData);
      setConnections(connectionData);
      setMyPosts(feedData.filter((post) => String(post?.authorId?._id || "") === String(user?.id || "")));
      setPublicProfile(publicData?.profile || null);
      setSocialPreview(publicData?.socialPreview || null);
      setMentorProfile(mentorProfileRes.status === "fulfilled" ? mentorProfileRes.value.data?.profile || null : null);
      setMentorSessions(mentorSessionsRes.status === "fulfilled" ? mentorSessionsRes.value.data || [] : []);
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to load profile.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id, user?.role]);

  useFocusEffect(
    useCallback(() => {
      loadProfileData();
    }, [loadProfileData])
  );

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

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={[styles.container, { backgroundColor: colors.background }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadProfileData(true)} />}
    >
      <View style={[styles.heroCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.heroTop}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
          ) : (
            <View style={[styles.avatarWrap, { backgroundColor: colors.accentSoft, borderColor: colors.border }]}>
              <Text style={styles.avatarText}>{(user?.name || "O").charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <View style={styles.statsRow}>
            <TouchableOpacity style={styles.statPlain} onPress={() => setActiveList("insights")}>
              <Text style={styles.statValue}>{myPosts.length}</Text>
              <Text style={[styles.statLabel, activeList === "insights" && styles.statLabelActive]}>Insights</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.statPlain} onPress={() => setActiveList("circle")}>
              <Text style={styles.statValue}>{overview?.connections?.accepted ?? 0}</Text>
              <Text style={[styles.statLabel, activeList === "circle" && styles.statLabelActive]}>Circle</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.statPlain} onPress={() => setActiveList("following")}>
              <Text style={styles.statValue}>{overview?.follow?.following ?? 0}</Text>
              <Text style={[styles.statLabel, activeList === "following" && styles.statLabelActive]}>Following</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.statPlain} onPress={() => setActiveList("audience")}>
              <Text style={styles.statValue}>{overview?.follow?.followers ?? 0}</Text>
              <Text style={[styles.statLabel, activeList === "audience" && styles.statLabelActive]}>Audience</Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={[styles.name, { color: colors.text }]}>{user?.name || "ORIN User"}</Text>
        <Text style={styles.role}>{user?.role === "mentor" ? "Mentor" : "Student"}</Text>
        {heroTitle ? <Text style={[styles.headline, { color: colors.text }]}>{heroTitle}</Text> : null}
        {heroMeta ? <Text style={[styles.subMeta, { color: colors.textMuted }]}>{heroMeta}</Text> : null}
        {publicProfile?.about || publicProfile?.bio ? (
          <Text style={[styles.bio, { color: colors.textMuted }]} numberOfLines={3}>
            {publicProfile?.about || publicProfile?.bio}
          </Text>
        ) : null}

        <View style={styles.metaChips}>
          <View style={[styles.metaChip, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
            <Ionicons name="flash-outline" size={14} color="#1F7A4C" />
            <Text style={[styles.metaChipText, { color: colors.text }]}>{overview?.reputation?.score ?? 0} XP</Text>
          </View>
          <View style={[styles.metaChip, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
            <Ionicons name="flame-outline" size={14} color="#B54708" />
            <Text style={[styles.metaChipText, { color: colors.text }]}>{overview?.reputation?.levelTag || "Starter"}</Text>
          </View>
          {publicProfile?.state || mentorProfile?.state ? (
            <View style={[styles.metaChip, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
              <Ionicons name="location-outline" size={14} color="#475467" />
              <Text style={[styles.metaChipText, { color: colors.text }]}>{publicProfile?.state || mentorProfile?.state}</Text>
            </View>
          ) : null}
          {educationLine ? (
            <View style={[styles.metaChip, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
              <Ionicons name="school-outline" size={14} color="#475467" />
              <Text style={[styles.metaChipText, { color: colors.text }]}>{educationLine}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.primaryButton} onPress={() => router.push(editRoute as never)}>
            <Text style={styles.primaryButtonText}>Edit Profile</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.secondaryButton, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }]} onPress={() => router.push("/settings" as never)}>
            <Text style={[styles.secondaryButtonText, { color: colors.text }]}>Settings</Text>
          </TouchableOpacity>
        </View>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {skillPreview.length ? (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Focus Areas</Text>
          <View style={styles.skillRow}>
            {skillPreview.map((item) => (
              <View key={item} style={[styles.skillChip, { backgroundColor: colors.accentSoft }]}>
                <Text style={[styles.skillChipText, { color: colors.accent }]}>{item}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {user?.role === "mentor" ? (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Mentor Snapshot</Text>
          <View style={styles.detailGrid}>
            <View style={[styles.detailPill, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
              <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Students</Text>
              <Text style={[styles.detailValue, { color: colors.text }]}>{mentorStudentsMentored}</Text>
            </View>
            <View style={[styles.detailPill, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
              <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Sessions</Text>
              <Text style={[styles.detailValue, { color: colors.text }]}>
                {Math.max(Number(mentorProfile?.totalSessionsConducted || 0), mentorSessions.filter((item) => item.sessionStatus === "completed").length)}
              </Text>
            </View>
            <View style={[styles.detailPill, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
              <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Rating</Text>
              <Text style={[styles.detailValue, { color: colors.text }]}>{Number(mentorProfile?.rating || 0).toFixed(1)}</Text>
            </View>
            <View style={[styles.detailPill, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
              <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Pricing</Text>
              <Text style={[styles.detailValue, { color: colors.text }]}>INR {mentorProfile?.sessionPrice || 0}</Text>
            </View>
          </View>
          <Text style={[styles.inlineMeta, { color: colors.textMuted }]}>Domain: {mentorProfile?.primaryCategory || "Not selected"}</Text>
          <Text style={[styles.inlineMeta, { color: colors.textMuted }]}>Subject: {mentorProfile?.subCategory || "Not selected"}</Text>
          {(mentorProfile?.specializations || []).length ? (
            <Text style={[styles.inlineMeta, { color: colors.textMuted }]}>Specializations: {(mentorProfile?.specializations || []).join(", ")}</Text>
          ) : null}
        </View>
      ) : null}

      {activeList === "circle" ? (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>My Circle</Text>
          {connections.length === 0 ? (
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>No accepted connections yet.</Text>
          ) : (
            connections.slice(0, 20).map((item) => {
              const isRequester = String(item.requesterId?._id || "") === String(user?.id || "");
              const other = isRequester ? item.recipientId : item.requesterId;
              return (
                <TouchableOpacity
                  key={item._id}
                  style={styles.rowItem}
                  onPress={() => (other?._id ? router.push(`/public-profile/${other._id}` as never) : undefined)}
                  disabled={!other?._id}
                >
                  <Text style={[styles.rowName, { color: colors.text }]}>{other?.name || "Connection"}</Text>
                  <Text style={[styles.rowRole, { color: colors.textMuted }]}>{other?.role || "member"}</Text>
                </TouchableOpacity>
              );
            })
          )}
        </View>
      ) : null}

      {activeList === "audience" ? (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Audience</Text>
          {(socialPreview?.followers || []).length === 0 ? (
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>No followers yet.</Text>
          ) : (
            (socialPreview?.followers || []).slice(0, 20).map((item, idx) => (
              <TouchableOpacity key={`${item._id || idx}-f`} style={styles.rowItem} onPress={() => item._id ? router.push(`/public-profile/${item._id}` as never) : undefined}>
                <Text style={[styles.rowName, { color: colors.text }]}>{item.name || "User"}</Text>
                <Text style={[styles.rowRole, { color: colors.textMuted }]}>{item.role || "member"}</Text>
              </TouchableOpacity>
            ))
          )}
        </View>
      ) : null}

      {activeList === "following" ? (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Following</Text>
          {(socialPreview?.following || []).length === 0 ? (
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>Not following anyone yet.</Text>
          ) : (
            (socialPreview?.following || []).slice(0, 20).map((item, idx) => (
              <TouchableOpacity key={`${item._id || idx}-g`} style={styles.rowItem} onPress={() => item._id ? router.push(`/public-profile/${item._id}` as never) : undefined}>
                <Text style={[styles.rowName, { color: colors.text }]}>{item.name || "User"}</Text>
                <Text style={[styles.rowRole, { color: colors.textMuted }]}>{item.role || "member"}</Text>
              </TouchableOpacity>
            ))
          )}
        </View>
      ) : null}

      {activeList === "insights" ? (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Insights</Text>
          {myPosts.length === 0 ? (
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>No posts yet.</Text>
          ) : (
            myPosts.map((post) => (
              <View key={post._id} style={[styles.postCard, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
                <View style={styles.postTop}>
                  <View style={[styles.postTypePill, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <Ionicons name="grid-outline" size={14} color="#475467" />
                    <Text style={[styles.postTypeText, { color: colors.textMuted }]}>{post.postType}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={() => confirmDelete(post._id)}
                    disabled={deletingPostId === post._id}
                  >
                    <Text style={styles.deleteBtnText}>{deletingPostId === post._id ? "Deleting..." : "Delete"}</Text>
                  </TouchableOpacity>
                </View>
                <Text style={[styles.postText, { color: colors.text }]} numberOfLines={5}>{post.content}</Text>
                <Text style={[styles.postMeta, { color: colors.textMuted }]}>
                  {post.likeCount || 0} likes â€¢ {post.commentCount || 0} comments â€¢ {post.shareCount || 0} shares
                </Text>
              </View>
            ))
          )}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: "#F3F5F7", padding: 16, paddingBottom: 28 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#F3F5F7" },
  heroCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E4E7EC",
    borderRadius: 22,
    padding: 16
  },
  heroTop: { flexDirection: "row", alignItems: "center" },
  avatarImage: {
    width: 92,
    height: 92,
    borderRadius: 46,
    borderWidth: 2,
    borderColor: "#CDE7D8"
  },
  avatarWrap: {
    width: 92,
    height: 92,
    borderRadius: 46,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E8F5EE",
    borderWidth: 2,
    borderColor: "#CDE7D8"
  },
  avatarText: { color: "#0B3D2E", fontWeight: "800", fontSize: 30 },
  statsRow: { flexDirection: "row", marginLeft: 12, flex: 1, justifyContent: "space-between" },
  statPlain: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 4 },
  statValue: { fontSize: 18, fontWeight: "800", color: "#1E2B24" },
  statLabel: { marginTop: 3, color: "#667085", fontWeight: "600", fontSize: 12 },
  statLabelActive: { color: "#1F7A4C" },
  name: { fontSize: 26, fontWeight: "800", color: "#13251E", marginTop: 14 },
  role: { marginTop: 4, color: "#175CD3", fontWeight: "700", textTransform: "capitalize" },
  headline: { marginTop: 8, color: "#1E2B24", fontSize: 17, fontWeight: "700" },
  subMeta: { marginTop: 4, color: "#667085" },
  bio: { marginTop: 10, color: "#344054", lineHeight: 21 },
  metaChips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 14 },
  metaChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E4E7EC"
  },
  metaChipText: { color: "#344054", fontWeight: "700", fontSize: 12 },
  actionRow: { flexDirection: "row", gap: 8, marginTop: 16 },
  primaryButton: {
    flex: 1,
    backgroundColor: "#1F7A4C",
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: "center"
  },
  primaryButtonText: { color: "#fff", fontWeight: "700" },
  secondaryButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#D0D5DD",
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: "center",
    backgroundColor: "#fff"
  },
  secondaryButtonText: { color: "#344054", fontWeight: "700" },
  error: { marginTop: 10, color: "#B42318" },
  card: {
    marginTop: 12,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E4E7EC",
    borderRadius: 18,
    padding: 14
  },
  cardTitle: { color: "#1E2B24", fontWeight: "800", fontSize: 18, marginBottom: 10 },
  skillRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  skillChip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#EAF7F0"
  },
  skillChipText: { color: "#17563A", fontWeight: "700" },
  detailGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 10 },
  detailPill: {
    width: "47%",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E4E7EC",
    padding: 12,
    backgroundColor: "#F8FAFC"
  },
  detailLabel: { color: "#667085", fontSize: 12, fontWeight: "700" },
  detailValue: { color: "#1E2B24", fontSize: 17, fontWeight: "800", marginTop: 4 },
  inlineMeta: { color: "#667085", marginTop: 4 },
  rowItem: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#F2F4F7" },
  rowName: { color: "#1E2B24", fontWeight: "700" },
  rowRole: { color: "#667085", textTransform: "capitalize", marginTop: 2 },
  emptyText: { color: "#667085" },
  postCard: { borderWidth: 1, borderColor: "#E4E7EC", borderRadius: 16, padding: 12, marginBottom: 10, backgroundColor: "#FCFCFD" },
  postTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  postTypePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#F2F4F7"
  },
  postTypeText: { color: "#475467", fontWeight: "700", textTransform: "capitalize" },
  deleteBtn: {
    borderWidth: 1,
    borderColor: "#F04438",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: "#FFF1F3"
  },
  deleteBtnText: { color: "#B42318", fontWeight: "700", fontSize: 12 },
  postText: { color: "#344054", lineHeight: 24, fontSize: 15 },
  postMeta: { color: "#667085", marginTop: 12, fontWeight: "600" }
});
