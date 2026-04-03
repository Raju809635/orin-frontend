import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useAppTheme } from "@/context/ThemeContext";
import { notify } from "@/utils/notify";
import { sanitizeDisplayText } from "@/utils/textSanitize";

type PublicUser = {
  _id: string;
  name: string;
  email: string;
  role: "student" | "mentor";
  status?: string;
  primaryCategory?: string;
  subCategory?: string;
  specializations?: string[];
};

type PublicProfile = {
  profilePhotoUrl?: string;
  title?: string;
  headline?: string;
  about?: string;
  bio?: string;
  state?: string;
  collegeName?: string;
  education?: Array<{ school?: string; degree?: string; year?: string }>;
  skills?: string[];
  experienceYears?: number;
  rating?: number;
  careerGoals?: string;
};

type PublicProfileResponse = {
  user: PublicUser;
  profile: PublicProfile | null;
  social?: {
    followers?: number;
    following?: number;
    connections?: number;
    isFollowing?: boolean;
    followsYou?: boolean;
    connectionStatus?: "none" | "pending_incoming" | "pending_outgoing" | "accepted" | "rejected" | "blocked";
    connectionId?: string | null;
  };
  socialPreview?: {
    followers?: Array<{ _id?: string; name?: string; role?: string; profilePhotoUrl?: string }>;
    following?: Array<{ _id?: string; name?: string; role?: string; profilePhotoUrl?: string }>;
  };
  endorsements?: {
    counts?: Record<string, number>;
    viewerEndorsedSkills?: string[];
  };
};

export default function PublicProfileScreen() {
  const router = useRouter();
  const { user: viewer } = useAuth();
  const { colors, isDark } = useAppTheme();
  const params = useLocalSearchParams<{ userId?: string }>();
  const userId = String(params.userId || "").trim();
  const [data, setData] = useState<PublicProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatingFollow, setUpdatingFollow] = useState(false);
  const [updatingConnection, setUpdatingConnection] = useState(false);
  const [endorsingSkill, setEndorsingSkill] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewPhotoById, setPreviewPhotoById] = useState<Record<string, string>>({});

  useEffect(() => {
    let mounted = true;

    async function loadProfile() {
      if (!userId) {
        setError("Missing user id.");
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        setError(null);
        const res = await api.get<PublicProfileResponse>(`/api/profiles/public/${userId}`);
        if (!mounted) return;
        setData(res.data);
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.response?.data?.message || "Failed to load profile.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadProfile();
    return () => {
      mounted = false;
    };
  }, [userId]);

  const previewIds = useMemo(() => {
    const ids = new Set<string>();
    [...(data?.socialPreview?.followers || []), ...(data?.socialPreview?.following || [])].forEach((item) => {
      const id = String(item?._id || "").trim();
      if (id && !item?.profilePhotoUrl && !previewPhotoById[id]) ids.add(id);
    });
    return Array.from(ids).slice(0, 12);
  }, [data?.socialPreview?.followers, data?.socialPreview?.following, previewPhotoById]);

  useEffect(() => {
    let cancelled = false;
    if (previewIds.length === 0) return;

    (async () => {
      const rows = await Promise.all(
        previewIds.map(async (id) => {
          try {
            const res = await api.get<PublicProfileResponse>(`/api/profiles/public/${id}`);
            return [id, res.data?.profile?.profilePhotoUrl || ""] as const;
          } catch {
            return [id, ""] as const;
          }
        })
      );

      if (cancelled) return;

      setPreviewPhotoById((prev) => {
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
    })();

    return () => {
      cancelled = true;
    };
  }, [previewIds]);

  async function refreshProfile() {
    if (!userId) return;
    const res = await api.get<PublicProfileResponse>(`/api/profiles/public/${userId}`);
    setData(res.data);
  }

  async function toggleFollow() {
    if (!userId || !data || String(viewer?.id || "") === String(userId)) return;
    try {
      setUpdatingFollow(true);
      await api.post(`/api/network/follow/${userId}`);
      await refreshProfile();
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to update follow.");
    } finally {
      setUpdatingFollow(false);
    }
  }

  async function sendConnectionRequest() {
    if (!userId || !data || String(viewer?.id || "") === String(userId)) return;
    try {
      setUpdatingConnection(true);
      await api.post("/api/network/connections/request", { recipientId: userId });
      notify("Connection request sent.");
      await refreshProfile();
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to send request.");
    } finally {
      setUpdatingConnection(false);
    }
  }

  async function respondConnection(action: "accept" | "reject") {
    if (!data?.social?.connectionId) return;
    try {
      setUpdatingConnection(true);
      await api.post(`/api/network/connections/${data.social.connectionId}/respond`, { action });
      notify(`Request ${action}ed.`);
      await refreshProfile();
    } catch (e: any) {
      setError(e?.response?.data?.message || `Failed to ${action} request.`);
    } finally {
      setUpdatingConnection(false);
    }
  }

  async function endorseSkill(skill: string) {
    const normalizedSkill = String(skill || "").trim();
    if (!normalizedSkill || !userId || isSelf || endorsingSkill) return;
    try {
      setEndorsingSkill(normalizedSkill);
      await api.post(`/api/network/endorse/${userId}`, { skill: normalizedSkill });
      notify(`Endorsed ${normalizedSkill}`);
      await refreshProfile();
    } catch (e: any) {
      notify(e?.response?.data?.message || "Unable to endorse skill right now.");
    } finally {
      setEndorsingSkill(null);
    }
  }

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (!data) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={[styles.error, { color: colors.danger }]}>{error || "Profile not found."}</Text>
      </View>
    );
  }

  const profile = data.profile || {};
  const displayLine = [data.user.primaryCategory, data.user.subCategory].filter(Boolean).join(" > ");
  const educationLine = (profile.education || []).length
    ? [profile.education?.[0]?.degree, profile.education?.[0]?.school, profile.education?.[0]?.year].filter(Boolean).join(" | ")
    : "";
  const isSelf = String(viewer?.id || "") === String(data.user._id || "");
  const connectionStatus = data.social?.connectionStatus || "none";
  const profileSummary = sanitizeDisplayText(profile.about || profile.bio || "No profile summary yet.");
  const identityMeta = [profile.collegeName, profile.state].filter(Boolean).join(" | ");
  const circleCount = (data.social?.followers ?? 0) + (data.social?.connections ?? 0);
  const profileStats = [
    { label: "Circle", value: circleCount },
    { label: "Following", value: data.social?.following ?? 0 }
  ];
  const endorsedSkills = new Set((data.endorsements?.viewerEndorsedSkills || []).map((item) => String(item).trim()));

  function renderPreviewRow(items: Array<{ _id?: string; name?: string; role?: string; profilePhotoUrl?: string }>, emptyText: string) {
    if (!items.length) {
      return <Text style={[styles.meta, { color: colors.textMuted, textAlign: "left" }]}>{emptyText}</Text>;
    }

    return items.slice(0, 8).map((item, idx) => {
      const id = String(item._id || "");
      const photoUrl = item.profilePhotoUrl || previewPhotoById[id] || "";
      return (
        <TouchableOpacity
          key={`${id || idx}`}
          style={[styles.previewRow, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}
          onPress={() => (id ? router.push(`/public-profile/${id}` as never) : undefined)}
          disabled={!id}
        >
          {photoUrl ? (
            <Image source={{ uri: photoUrl }} style={styles.previewAvatarImage} />
          ) : (
            <View style={[styles.previewAvatarFallback, { backgroundColor: colors.accentSoft, borderColor: colors.border }]}>
              <Text style={[styles.previewAvatarText, { color: colors.accent }]}>
                {String(item.name || "U").trim().charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={[styles.previewName, { color: colors.text }]} numberOfLines={1}>
              {item.name || "User"}
            </Text>
            <Text style={[styles.previewRole, { color: colors.textMuted }]} numberOfLines={1}>
              {item.role || "Member"}
            </Text>
          </View>
          {id ? <Text style={[styles.previewLink, { color: colors.accent }]}>View</Text> : null}
        </TouchableOpacity>
      );
    });
  }

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.heroCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {profile.profilePhotoUrl ? (
          <Image source={{ uri: profile.profilePhotoUrl }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatarFallback, { backgroundColor: colors.accentSoft, borderColor: colors.border }]}>
            <Text style={[styles.avatarText, { color: colors.accent }]}>{data.user.name?.charAt(0)?.toUpperCase() || "U"}</Text>
          </View>
        )}

        <View style={styles.heroIdentity}>
          <Text style={[styles.name, { color: colors.text }]}>{data.user.name}</Text>
          <Text style={[styles.role, { color: colors.textMuted }]}>{data.user.role}</Text>
          {profile.title || profile.headline ? (
            <Text style={[styles.title, { color: colors.text }]}>{sanitizeDisplayText(profile.title || profile.headline)}</Text>
          ) : null}
          {identityMeta ? <Text style={[styles.metaLine, { color: colors.textMuted }]}>{identityMeta}</Text> : null}
        </View>

        <View style={styles.statsGrid}>
          {profileStats.map((item) => (
            <View key={item.label} style={[styles.statCard, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
              <Text style={[styles.statValue, { color: colors.text }]}>{item.value}</Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>{item.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.metaChips}>
          {displayLine ? (
            <View style={[styles.chip, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}>
              <Text style={[styles.chipText, { color: colors.text }]}>{displayLine}</Text>
            </View>
          ) : null}
          {educationLine ? (
            <View style={[styles.chip, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}>
              <Text style={[styles.chipText, { color: colors.text }]}>{educationLine}</Text>
            </View>
          ) : null}
          {typeof profile.rating === "number" ? (
            <View style={[styles.chip, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}>
              <Text style={[styles.chipText, { color: colors.text }]}>Rating {profile.rating}</Text>
            </View>
          ) : null}
          {typeof profile.experienceYears === "number" && profile.experienceYears > 0 ? (
            <View style={[styles.chip, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}>
              <Text style={[styles.chipText, { color: colors.text }]}>{profile.experienceYears} years exp</Text>
            </View>
          ) : null}
        </View>

        {!isSelf ? (
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.actionBtn, styles.followBtn, { backgroundColor: colors.accent }]}
              onPress={toggleFollow}
              disabled={updatingFollow}
            >
              <Text style={styles.followBtnText}>
                {updatingFollow ? "Updating..." : data.social?.isFollowing ? "Unfollow" : "Follow"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, styles.messageBtn, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}
              onPress={() => router.push(`/chat?userId=${userId}` as never)}
            >
              <Text style={[styles.messageBtnText, { color: colors.text }]}>Message</Text>
            </TouchableOpacity>
            {connectionStatus === "none" || connectionStatus === "rejected" ? (
              <TouchableOpacity
                style={[styles.actionBtn, styles.connectBtn, { backgroundColor: isDark ? colors.accentSoft : "#EAF6EF", borderColor: colors.accent }]}
                onPress={sendConnectionRequest}
                disabled={updatingConnection}
              >
                <Text style={[styles.connectBtnText, { color: colors.accent }]}>{updatingConnection ? "Sending..." : "Connect"}</Text>
              </TouchableOpacity>
            ) : null}
            {connectionStatus === "pending_outgoing" ? (
              <View style={[styles.actionBtn, styles.pendingBtn, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
                <Text style={[styles.pendingBtnText, { color: colors.text }]}>Request Sent</Text>
              </View>
            ) : null}
            {connectionStatus === "accepted" ? (
              <View style={[styles.actionBtn, styles.connectedBtn, { backgroundColor: colors.accentSoft, borderColor: colors.accent }]}>
                <Text style={[styles.connectedBtnText, { color: colors.accent }]}>Connected</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {!isSelf && connectionStatus === "pending_incoming" ? (
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.actionBtn, styles.followBtn, { backgroundColor: colors.accent }]}
              onPress={() => respondConnection("accept")}
              disabled={updatingConnection}
            >
              <Text style={styles.followBtnText}>{updatingConnection ? "Updating..." : "Accept Request"}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, styles.rejectBtn, { backgroundColor: colors.surfaceAlt, borderColor: colors.danger }]}
              onPress={() => respondConnection("reject")}
              disabled={updatingConnection}
            >
              <Text style={[styles.rejectBtnText, { color: colors.danger }]}>{updatingConnection ? "Updating..." : "Reject"}</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {!isSelf && data.social?.followsYou ? <Text style={[styles.followBadge, { color: colors.textMuted }]}>Follows you</Text> : null}
      </View>

      <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>About</Text>
        <Text style={[styles.about, { color: colors.text }]}>{profileSummary}</Text>
      </View>

      {(profile.skills || []).length ? (
        <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Skills</Text>
          {!isSelf ? (
            <Text style={[styles.sectionHint, { color: colors.textMuted }]}>
              Tap a skill to endorse it. Each endorsement strengthens the student&apos;s credibility and XP.
            </Text>
          ) : null}
          <View style={styles.chips}>
            {(profile.skills || []).map((item) => {
              const normalized = String(item || "").trim();
              const count = Number(data.endorsements?.counts?.[normalized] || 0);
              const alreadyEndorsed = endorsedSkills.has(normalized);
              const active = alreadyEndorsed || endorsingSkill === normalized;
              return (
                <TouchableOpacity
                  key={normalized}
                  style={[
                    styles.chip,
                    {
                      borderColor: active ? colors.accent : colors.border,
                      backgroundColor: active ? colors.accentSoft : colors.surfaceAlt
                    }
                  ]}
                  onPress={() => endorseSkill(normalized)}
                  disabled={isSelf || alreadyEndorsed || endorsingSkill === normalized}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.chipText, { color: active ? colors.accent : colors.text }]}>
                    {normalized}
                  </Text>
                  <Text style={[styles.chipMeta, { color: active ? colors.accent : colors.textMuted }]}>
                    {alreadyEndorsed ? `Endorsed | ${count}` : `${count} endorse${count === 1 ? "" : "ments"}`}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      ) : null}

      {(data.user.specializations || []).length ? (
        <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Specializations</Text>
          <View style={styles.chips}>
            {(data.user.specializations || []).map((item) => (
              <View key={item} style={[styles.chip, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}>
                <Text style={[styles.chipText, { color: colors.text }]}>{item}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {(data.socialPreview?.followers || []).length ? (
        <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Followers</Text>
          {renderPreviewRow(data.socialPreview?.followers || [], "No followers yet.")}
        </View>
      ) : null}

      {(data.socialPreview?.following || []).length ? (
        <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Following</Text>
          {renderPreviewRow(data.socialPreview?.following || [], "Not following anyone yet.")}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 32, gap: 14 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  heroCard: { borderWidth: 1, borderRadius: 28, padding: 18, gap: 14 },
  avatar: { width: 112, height: 112, borderRadius: 56, alignSelf: "center", borderWidth: 2, borderColor: "#CFE4D8" },
  avatarFallback: {
    width: 112,
    height: 112,
    borderRadius: 56,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2
  },
  avatarText: { fontSize: 40, fontWeight: "800" },
  heroIdentity: { alignItems: "center", gap: 4 },
  name: { fontSize: 28, fontWeight: "900", textAlign: "center" },
  role: { textTransform: "capitalize", fontWeight: "700", fontSize: 15 },
  title: { textAlign: "center", fontWeight: "800", fontSize: 16 },
  metaLine: { textAlign: "center", lineHeight: 20 },
  meta: { marginTop: 4, textAlign: "center", lineHeight: 20 },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  statCard: {
    width: "31%",
    borderWidth: 1,
    borderRadius: 16,
    minHeight: 82,
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: "center"
  },
  statValue: { fontWeight: "900", fontSize: 22 },
  statLabel: { marginTop: 4, fontSize: 12, fontWeight: "700", textAlign: "center" },
  metaChips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  actionRow: { marginTop: 2, flexDirection: "row", gap: 10, flexWrap: "wrap" },
  actionBtn: { borderRadius: 999, paddingVertical: 12, paddingHorizontal: 16, alignItems: "center", justifyContent: "center", minWidth: "31%" },
  followBtn: { flex: 1 },
  followBtnText: { color: "#fff", fontWeight: "700" },
  messageBtn: { borderWidth: 1, flex: 1 },
  messageBtnText: { fontWeight: "700" },
  connectBtn: { borderWidth: 1, flex: 1 },
  connectBtnText: { fontWeight: "700" },
  pendingBtn: { borderWidth: 1, flex: 1 },
  pendingBtnText: { fontWeight: "700" },
  connectedBtn: { borderWidth: 1, flex: 1 },
  connectedBtnText: { fontWeight: "700" },
  rejectBtn: { borderWidth: 1, flex: 1 },
  rejectBtnText: { fontWeight: "700" },
  followBadge: { fontWeight: "700", textAlign: "center" },
  sectionCard: { borderWidth: 1, borderRadius: 24, padding: 18 },
  sectionTitle: { marginBottom: 10, fontWeight: "900", fontSize: 18 },
  sectionHint: { marginTop: -2, marginBottom: 12, lineHeight: 20, fontWeight: "600" },
  about: { lineHeight: 24, fontSize: 15, fontWeight: "600" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  chipText: { fontWeight: "700", fontSize: 12 },
  chipMeta: { marginTop: 3, fontSize: 10, fontWeight: "700" },
  previewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10
  },
  previewAvatarImage: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, borderColor: "#CFE4D8" },
  previewAvatarFallback: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  previewAvatarText: { fontWeight: "800", fontSize: 18 },
  previewName: { fontWeight: "800", fontSize: 15 },
  previewRole: { marginTop: 2, fontSize: 12, textTransform: "capitalize" },
  previewLink: { fontWeight: "800" },
  error: { fontWeight: "700" }
});
