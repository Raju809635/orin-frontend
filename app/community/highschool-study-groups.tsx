import React, { useCallback, useMemo, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { api } from "@/lib/api";
import { getAppErrorMessage, handleAppError } from "@/lib/appError";
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
  membersCount?: number;
  mentor?: { name?: string } | null;
  topicTags?: string[];
  schedule?: string;
  joined?: boolean;
  requestPending?: boolean;
};

function groupId(group: MentorGroupItem) {
  return String(group.id || group._id || "");
}

export default function HighSchoolStudyGroupsScreen() {
  const router = useRouter();
  const [groups, setGroups] = useState<MentorGroupItem[]>([]);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [joiningId, setJoiningId] = useState<string | null>(null);

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
  const recommendedGroups = useMemo(() => groups.filter((item) => !item.joined).slice(0, 6), [groups]);

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
    if (group.joined) {
      router.push(`/mentor-group-chat/${id}` as never);
      return;
    }
    joinGroup(group);
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
      <CommunitySection title="Joined Groups" subtitle="Tap to open real group chat." icon="chatbubbles">
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
      </CommunitySection>

      <CommunitySection title="Recommended Subject & Exam Groups" subtitle="Uses the same mentor group backend. No fake group cards." icon="people">
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
                badge={group.requestPending ? "Pending" : "Request"}
                badgeTone={group.requestPending ? "warning" : "primary"}
                actionLabel={joiningId === id ? "Requesting..." : group.requestPending ? "Pending" : "Request Join"}
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
