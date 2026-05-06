import React, { useCallback, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { api } from "@/lib/api";
import { getAppErrorMessage, handleAppError } from "@/lib/appError";
import { EmptyState, StageCommunityScaffold, StageListCard, StageSection, StageStatRow } from "@/components/community/stage-community-data-ui";

type FeedPost = {
  _id: string;
  content: string;
  authorId?: { name?: string } | null;
  commentCount?: number;
};

type MentorGroupItem = {
  id: string;
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

export default function HighSchoolStudyGroupsScreen() {
  const router = useRouter();
  const [groups, setGroups] = useState<MentorGroupItem[]>([]);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  async function joinGroup(groupId: string) {
    try {
      await api.post(`/api/network/mentor-groups/${groupId}/join`);
      await load(true);
    } catch (e) {
      handleAppError(e, {
        mode: "alert",
        title: "Study Groups",
        fallbackMessage: "Unable to send group join request right now."
      });
    }
  }

  function openGroup(group: MentorGroupItem) {
    if (group.joined) {
      router.push(`/mentor-group-chat/${group.id}` as never);
      return;
    }
    if (group.requestPending) return;
    joinGroup(group.id);
  }

  const joinedGroups = groups.filter((item) => item.joined);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return (
    <StageCommunityScaffold
      eyebrow="High School Community"
      title="Study Groups"
      subtitle="Join mentor-led academic groups and chat directly in each group like a focused study circle."
      loading={loading}
      error={error}
      refreshing={refreshing}
      onRefresh={() => load(true)}
    >
      <StageStatRow
        items={[
          { label: "Groups", value: String(groups.length) },
          { label: "Joined", value: String(joinedGroups.length) },
          { label: "School posts", value: String(posts.length) }
        ]}
      />

      <StageSection title="Joined Groups" icon="chatbubbles">
        {joinedGroups.length ? (
          joinedGroups.slice(0, 5).map((group) => (
            <StageListCard
              key={`joined-${group.id}`}
              title={group.name}
              meta={`${group.domain || "Study Group"} · Mentor: ${group.mentor?.name || "Guide"} · Members: ${group.membersCount || 0}`}
              note={`${group.schedule || "Weekly"} · Tap to open group chat`}
              tone="highschool"
              onPress={() => router.push(`/mentor-group-chat/${group.id}` as never)}
            />
          ))
        ) : (
          <EmptyState label="You have not joined any study group yet." />
        )}
      </StageSection>

      <StageSection title="Available Study Groups" icon="people" actionLabel="Open full" onAction={() => router.push("/community/collaboration" as never)}>
        {groups.length ? (
          groups.slice(0, 8).map((group) => (
            <StageListCard
              key={`all-${group.id}`}
              title={group.name}
              meta={`${group.domain || "Academic Group"} · Mentor: ${group.mentor?.name || "Guide"} · Members: ${group.membersCount || 0}`}
              note={
                group.joined
                  ? "Joined · Tap to open chat"
                  : group.requestPending
                    ? "Request sent · Awaiting mentor approval"
                    : "Tap to request join"
              }
              tone="highschool"
              onPress={() => openGroup(group)}
            />
          ))
        ) : (
          <EmptyState label="No study groups yet." />
        )}
      </StageSection>

      <StageSection title="School Feed" icon="newspaper" actionLabel="Open full" onAction={() => router.push("/network?section=institution" as never)}>
        {posts.length ? (
          posts.slice(0, 4).map((post) => (
            <StageListCard
              key={post._id}
              title={post.authorId?.name || "School update"}
              meta={`${post.commentCount || 0} comments`}
              note={post.content}
              tone="highschool"
            />
          ))
        ) : (
          <EmptyState label="No school feed updates yet." />
        )}
      </StageSection>
    </StageCommunityScaffold>
  );
}
