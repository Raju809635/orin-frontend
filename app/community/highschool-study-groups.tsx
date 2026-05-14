import React, { useCallback, useMemo, useState } from "react";
import { Alert, Image, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { api } from "@/lib/api";
import { getAppErrorMessage, handleAppError } from "@/lib/appError";
import { useAuth } from "@/context/AuthContext";
import { useAppTheme } from "@/context/ThemeContext";
import { pickAndUploadPostImage } from "@/utils/postMediaUpload";
import {
  AcademicCard,
  AcademicEmpty,
  CommunitySection,
  HighSchoolCommunityShell
} from "@/components/community/highschool-ui";

type FeedPost = { _id: string; content: string; authorId?: { name?: string } | null; commentCount?: number };
type MentorGroupItem = {
  id: string;
  _id?: string;
  name: string;
  domain?: string;
  description?: string;
  avatarUrl?: string;
  rules?: string;
  membersCount?: number;
  maxStudents?: number;
  mentor?: { id?: string; name?: string } | null;
  topicTags?: string[];
  schedule?: string;
  settings?: {
    joinApproval?: boolean;
    allowMemberMessages?: boolean;
    allowMemberMedia?: boolean;
    allowReactions?: boolean;
  };
  joined?: boolean;
  requestPending?: boolean;
  ownedByMe?: boolean;
  pendingRequestsCount?: number;
  pendingRequests?: { id: string; name?: string; email?: string }[];
  members?: { id: string; name?: string; email?: string }[];
};

function groupId(group: MentorGroupItem) {
  return String(group.id || group._id || "");
}

export default function HighSchoolStudyGroupsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const [groups, setGroups] = useState<MentorGroupItem[]>([]);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    domain: "",
    description: "",
    avatarUrl: "",
    rules: "",
    schedule: "",
    maxStudents: "50",
    topicTags: "",
    joinApproval: true,
    allowMemberMessages: true,
    allowMemberMedia: true,
    allowReactions: true
  });

  const load = useCallback(async (refresh = false) => {
    try {
      if (refresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      const [groupsRes, feedRes] = await Promise.allSettled([
        api.get<MentorGroupItem[]>("/api/network/mentor-groups"),
        api.get<FeedPost[]>("/api/network/feed/institution")
      ]);
      setGroups(groupsRes.status === "fulfilled" ? groupsRes.value.data || [] : []);
      setPosts(feedRes.status === "fulfilled" ? feedRes.value.data || [] : []);
    } catch (e) {
      setError(getAppErrorMessage(e, "Failed to load study groups."));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const joinedGroups = useMemo(() => groups.filter((item) => item.joined), [groups]);
  const isMentor = user?.role === "mentor";
  const managedGroups = useMemo(() => groups.filter((item) => item.ownedByMe || String(item.mentor?.id || "") === String(user?.id || "")), [groups, user?.id]);
  const recommendedGroups = useMemo(() => groups.filter((item) => !item.joined).slice(0, 6), [groups]);

  async function createGroup() {
    const name = form.name.trim();
    if (!name) {
      Alert.alert("Create Group", "Group name is required.");
      return;
    }
    try {
      setCreating(true);
      await api.post("/api/network/mentor-groups", {
        name,
        domain: form.domain.trim(),
        description: form.description.trim(),
        avatarUrl: form.avatarUrl.trim(),
        rules: form.rules.trim(),
        schedule: form.schedule.trim() || "Weekly sessions",
        maxStudents: Number(form.maxStudents || 50),
        topicTags: form.topicTags.split(",").map((item) => item.trim()).filter(Boolean),
        settings: {
          joinApproval: form.joinApproval,
          allowMemberMessages: form.allowMemberMessages,
          allowMemberMedia: form.allowMemberMedia,
          allowReactions: form.allowReactions
        }
      });
      setForm({
        name: "",
        domain: "",
        description: "",
        avatarUrl: "",
        rules: "",
        schedule: "",
        maxStudents: "50",
        topicTags: "",
        joinApproval: true,
        allowMemberMessages: true,
        allowMemberMedia: true,
        allowReactions: true
      });
      await load(true);
    } catch (e) {
      handleAppError(e, { mode: "alert", title: "Create Group", fallbackMessage: "Unable to create the study group right now." });
    } finally {
      setCreating(false);
    }
  }

  async function respondToRequest(group: MentorGroupItem, studentId: string, action: "approve" | "reject") {
    const id = groupId(group);
    if (!id || !studentId) return;
    try {
      setRespondingId(`${id}-${studentId}`);
      await api.patch(`/api/network/mentor-groups/${id}/requests/${studentId}`, { action });
      await load(true);
    } catch (e) {
      handleAppError(e, { mode: "alert", title: "Join Request", fallbackMessage: "Unable to update this group request right now." });
    } finally {
      setRespondingId(null);
    }
  }

  async function joinGroup(group: MentorGroupItem) {
    const id = groupId(group);
    if (!id || group.requestPending) return;
    try {
      setJoiningId(id);
      await api.post(`/api/network/mentor-groups/${id}/join`);
      await load(true);
    } catch (e) {
      handleAppError(e, { mode: "alert", title: "Study Groups", fallbackMessage: "Unable to send group join request right now." });
    } finally {
      setJoiningId(null);
    }
  }

  function openGroup(group: MentorGroupItem) {
    const id = groupId(group);
    if (!id) return;
    if (group.joined || group.ownedByMe || String(group.mentor?.id || "") === String(user?.id || "")) {
      router.push(`/mentor-group-chat/${id}` as never);
      return;
    }
    if (isMentor) return;
    joinGroup(group);
  }

  async function uploadGroupDp() {
    try {
      const url = await pickAndUploadPostImage();
      if (url) setForm((current) => ({ ...current, avatarUrl: url }));
    } catch (e) {
      handleAppError(e, { mode: "alert", title: "Group DP", fallbackMessage: "Unable to upload group photo right now." });
    }
  }

  return (
    <HighSchoolCommunityShell
      title="Study Groups"
      subtitle="Real mentor-group data with WhatsApp-like academic group entry. Joined groups open the existing group chat directly."
      stats={[
        { icon: "people", label: "Groups", value: String(groups.length) },
        { icon: "chatbubbles", label: "Joined", value: String(joinedGroups.length) },
        { icon: "newspaper", label: "School posts", value: String(posts.length) }
      ]}
      loading={loading}
      error={error}
      refreshing={refreshing}
      onRefresh={() => load(true)}
    >
      {isMentor ? (
        <CommunitySection title="Create Study Group" subtitle="Create academic groups for students. Groups stay inside Community, not the bottom tabs." icon="add-circle">
          <View style={[styles.formCard, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
            <View style={styles.formHeader}>
              {form.avatarUrl ? (
                <Image source={{ uri: form.avatarUrl }} style={styles.groupDp} />
              ) : (
                <View style={[styles.groupDpFallback, { backgroundColor: colors.accentSoft, borderColor: colors.border }]}>
                  <Text style={[styles.groupDpText, { color: colors.accent }]}>SG</Text>
                </View>
              )}
              <View style={styles.formHeaderText}>
                <Text style={[styles.formTitle, { color: colors.text }]}>New Study Group</Text>
                <TouchableOpacity onPress={uploadGroupDp}>
                  <Text style={[styles.linkText, { color: colors.accent }]}>{form.avatarUrl ? "Change group DP" : "Add group DP"}</Text>
                </TouchableOpacity>
              </View>
            </View>
            <TextInput style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]} placeholder="Group name, e.g. SSC 10 Maths Revision" placeholderTextColor={colors.textMuted} value={form.name} onChangeText={(name) => setForm((current) => ({ ...current, name }))} />
            <TextInput style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]} placeholder="Subject / domain" placeholderTextColor={colors.textMuted} value={form.domain} onChangeText={(domain) => setForm((current) => ({ ...current, domain }))} />
            <TextInput style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]} placeholder="Schedule, e.g. Mon-Wed 7 PM" placeholderTextColor={colors.textMuted} value={form.schedule} onChangeText={(schedule) => setForm((current) => ({ ...current, schedule }))} />
            <TextInput style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]} placeholder="Max students" placeholderTextColor={colors.textMuted} value={form.maxStudents} keyboardType="number-pad" onChangeText={(maxStudents) => setForm((current) => ({ ...current, maxStudents }))} />
            <TextInput style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]} placeholder="Tags, comma separated" placeholderTextColor={colors.textMuted} value={form.topicTags} onChangeText={(topicTags) => setForm((current) => ({ ...current, topicTags }))} />
            <TextInput style={[styles.input, styles.textArea, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]} placeholder="What will students do in this group?" placeholderTextColor={colors.textMuted} multiline value={form.description} onChangeText={(description) => setForm((current) => ({ ...current, description }))} />
            <TextInput style={[styles.input, styles.textArea, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]} placeholder="Group rules, homework policy, permissions" placeholderTextColor={colors.textMuted} multiline value={form.rules} onChangeText={(rules) => setForm((current) => ({ ...current, rules }))} />
            <View style={[styles.permissionBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {[
                ["joinApproval", "Approve join requests"],
                ["allowMemberMessages", "Students can send messages"],
                ["allowMemberMedia", "Students can send photos/files"],
                ["allowReactions", "Allow emoji reactions"]
              ].map(([key, label]) => (
                <View key={key} style={styles.permissionRow}>
                  <Text style={[styles.permissionLabel, { color: colors.text }]}>{label}</Text>
                  <Switch
                    value={Boolean((form as any)[key])}
                    onValueChange={(value) => setForm((current) => ({ ...current, [key]: value }))}
                    trackColor={{ false: colors.border, true: colors.accentSoft }}
                    thumbColor={Boolean((form as any)[key]) ? colors.accent : colors.textMuted}
                  />
                </View>
              ))}
            </View>
            <TouchableOpacity style={[styles.primaryButton, { backgroundColor: colors.accent }]} onPress={createGroup} disabled={creating}>
              <Text style={styles.primaryButtonText}>{creating ? "Creating..." : "Create Group"}</Text>
            </TouchableOpacity>
          </View>
        </CommunitySection>
      ) : null}

      {isMentor ? (
        <CommunitySection title="My Study Groups" subtitle="Open group chat and manage student join requests." icon="people">
          {managedGroups.length ? (
            managedGroups.map((group) => (
              <View key={`managed-${groupId(group)}`} style={styles.groupStack}>
                <AcademicCard
                  icon="chatbubbles-outline"
                  title={group.name}
                  meta={`${group.domain || "Study Group"} Â· ${group.membersCount || 0}/${group.maxStudents || 50} students Â· ${group.pendingRequestsCount || 0} requests`}
                  note={`${group.schedule || "Weekly guidance"} Â· ${(group.topicTags || []).slice(0, 3).join(", ") || group.description || "Academic discussion"}`}
                  badge="Managed"
                  badgeTone="success"
                  actionLabel="Open Chat"
                  onPress={() => openGroup(group)}
                />
                {(group.pendingRequests || []).length ? (
                  <View style={[styles.requestBox, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
                    {(group.pendingRequests || []).map((student) => {
                      const requestKey = `${groupId(group)}-${student.id}`;
                      return (
                        <View key={requestKey} style={styles.requestRow}>
                          <View style={styles.requestText}>
                            <Text style={[styles.requestName, { color: colors.text }]}>{student.name || "Student"}</Text>
                            <Text style={[styles.requestMeta, { color: colors.textMuted }]}>{student.email || "Join request"}</Text>
                          </View>
                          <TouchableOpacity style={[styles.smallButton, { borderColor: colors.accent }]} onPress={() => respondToRequest(group, student.id, "approve")} disabled={respondingId === requestKey}>
                            <Text style={[styles.smallButtonText, { color: colors.accent }]}>{respondingId === requestKey ? "..." : "Approve"}</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={[styles.smallButton, { borderColor: colors.danger }]} onPress={() => respondToRequest(group, student.id, "reject")} disabled={respondingId === requestKey}>
                            <Text style={[styles.smallButtonText, { color: colors.danger }]}>Reject</Text>
                          </TouchableOpacity>
                        </View>
                      );
                    })}
                  </View>
                ) : null}
              </View>
            ))
          ) : (
            <AcademicEmpty label="No study groups created yet." actionLabel="Create your first group" onAction={createGroup} />
          )}
        </CommunitySection>
      ) : null}

      {!isMentor ? <CommunitySection title="Joined Groups" subtitle="Tap to open real group chat." icon="chatbubbles">
        {joinedGroups.length ? (
          joinedGroups.map((group) => (
            <AcademicCard
              key={`joined-${groupId(group)}`}
              icon="chatbubbles-outline"
              title={group.name}
              meta={`${group.domain || "Study Group"} · Mentor: ${group.mentor?.name || "Guide"} · ${group.membersCount || 0} members`}
              note={`${group.schedule || "Weekly guidance"} · ${(group.topicTags || []).slice(0, 3).join(", ") || "Academic discussion"}`}
              badge="Joined"
              badgeTone="success"
              actionLabel="Open Chat"
              onPress={() => openGroup(group)}
            />
          ))
        ) : (
          <AcademicEmpty label="You have not joined any study group yet. Request a group below." />
        )}
      </CommunitySection> : null}

      <CommunitySection title={isMentor ? "All Active Study Groups" : "Recommended Subject & Exam Groups"} subtitle={isMentor ? "Browse active groups created by approved teachers and mentors." : "Uses the same mentor group backend. No fake group cards."} icon="people">
        {recommendedGroups.length ? (
          recommendedGroups.map((group) => {
            const id = groupId(group);
            return (
              <AcademicCard
                key={`recommended-${id}`}
                icon="school-outline"
                title={group.name}
                meta={`${group.domain || "Academic Group"} · Mentor: ${group.mentor?.name || "Guide"} · ${group.membersCount || 0} members`}
                note={group.description || (group.requestPending ? "Request already sent. Waiting for mentor approval." : "Request to join this study group.")}
                badge={isMentor ? "Active" : group.requestPending ? "Pending" : "Request"}
                badgeTone={group.requestPending ? "warning" : "primary"}
                actionLabel={isMentor ? "View" : joiningId === id ? "Requesting..." : group.requestPending ? "Pending" : "Request Join"}
                onPress={() => openGroup(group)}
              />
            );
          })
        ) : (
          <AcademicEmpty label="No recommended groups are available right now." />
        )}
      </CommunitySection>

      <CommunitySection title="School Feed Signals" subtitle="Institution posts that can guide group discussion." icon="newspaper">
        {posts.length ? (
          posts.slice(0, 5).map((post) => (
            <AcademicCard
              key={post._id}
              icon="megaphone-outline"
              title={post.authorId?.name || "School update"}
              meta={`${post.commentCount || 0} comments`}
              note={post.content}
              badge="Post"
              onPress={() => router.push("/network?section=institution" as never)}
            />
          ))
        ) : (
          <AcademicEmpty label="No school feed updates yet." />
        )}
      </CommunitySection>
    </HighSchoolCommunityShell>
  );
}

const styles = StyleSheet.create({
  formCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    gap: 10
  },
  formTitle: {
    fontSize: 16,
    fontWeight: "900"
  },
  formHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  formHeaderText: {
    flex: 1
  },
  groupDp: {
    width: 58,
    height: 58,
    borderRadius: 29
  },
  groupDpFallback: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  groupDpText: {
    fontSize: 18,
    fontWeight: "900"
  },
  linkText: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: "900"
  },
  input: {
    borderWidth: 1,
    borderRadius: 13,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontWeight: "700"
  },
  textArea: {
    minHeight: 82,
    textAlignVertical: "top"
  },
  primaryButton: {
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: "center"
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontWeight: "900"
  },
  permissionBox: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 6
  },
  permissionRow: {
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  permissionLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: "800"
  },
  groupStack: {
    gap: 8
  },
  requestBox: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 10,
    gap: 8
  },
  requestRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  requestText: {
    flex: 1
  },
  requestName: {
    fontWeight: "900"
  },
  requestMeta: {
    fontSize: 12,
    fontWeight: "700"
  },
  smallButton: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7
  },
  smallButtonText: {
    fontSize: 12,
    fontWeight: "900"
  }
});
