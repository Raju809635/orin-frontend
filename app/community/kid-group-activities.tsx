import React, { useCallback, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { api } from "@/lib/api";
import { getAppErrorMessage } from "@/lib/appError";
import { EmptyState, StageCommunityScaffold, StageListCard, StageSection, StageStatRow } from "@/components/community/stage-community-data-ui";

type FeedPost = { _id: string; content: string; commentCount?: number; likeCount?: number; authorId?: { name?: string } | null };
type MentorGroupItem = { id: string; name: string; membersCount?: number; mentor?: { name?: string } };

export default function KidGroupActivitiesScreen() {
  const router = useRouter();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [groups, setGroups] = useState<MentorGroupItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    try {
      if (refresh) setRefreshing(true); else setLoading(true);
      setError(null);
      const [feedRes, groupsRes] = await Promise.allSettled([
        api.get<FeedPost[]>("/api/network/feed/institution"),
        api.get<MentorGroupItem[]>("/api/network/mentor-groups")
      ]);
      setPosts(feedRes.status === "fulfilled" ? feedRes.value.data || [] : []);
      setGroups(groupsRes.status === "fulfilled" ? groupsRes.value.data || [] : []);
    } catch (e) {
      setError(getAppErrorMessage(e, "Failed to load group activities."));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <StageCommunityScaffold
      title="Group Activities"
      subtitle="Safer group participation and school-first interaction without the full open community complexity."
      loading={loading}
      error={error}
      refreshing={refreshing}
      onRefresh={() => load(true)}
    >
      <StageStatRow items={[
        { label: "School posts", value: String(posts.length) },
        { label: "Teacher groups", value: String(groups.length) }
      ]} />
      <StageSection title="School Feed" icon="newspaper" actionLabel="Open full" onAction={() => router.push("/network?section=institution" as never)}>
        {posts.length ? posts.slice(0, 4).map((post) => (
          <StageListCard
            key={post._id}
            title={post.authorId?.name || "School update"}
            meta={`${post.likeCount || 0} reactions · ${post.commentCount || 0} comments`}
            note={post.content}
            tone="kid"
          />
        )) : <EmptyState label="No school updates yet." />}
      </StageSection>
      <StageSection title="Teacher Groups" icon="people" actionLabel="Open full" onAction={() => router.push("/community/collaboration" as never)}>
        {groups.length ? groups.slice(0, 4).map((group) => (
          <StageListCard
            key={group.id}
            title={group.name}
            meta={`Mentor: ${group.mentor?.name || "Teacher"} · Members: ${group.membersCount || 0}`}
            tone="kid"
          />
        )) : <EmptyState label="No teacher groups yet." />}
      </StageSection>
    </StageCommunityScaffold>
  );
}
