import React, { useCallback, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { api } from "@/lib/api";
import { getAppErrorMessage } from "@/lib/appError";
import { EmptyState, StageCommunityScaffold, StageListCard, StageSection, StageStatRow } from "@/components/community/stage-community-data-ui";

type FeedPost = { _id: string; content: string; authorId?: { name?: string } | null; commentCount?: number };
type MentorGroupItem = { id: string; name: string; membersCount?: number; mentor?: { name?: string } };

export default function HighSchoolStudyGroupsScreen() {
  const router = useRouter();
  const [groups, setGroups] = useState<MentorGroupItem[]>([]);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    try {
      if (refresh) setRefreshing(true); else setLoading(true);
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

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <StageCommunityScaffold
      eyebrow="High School Community"
      title="Study Groups"
      subtitle="Keep the same collaboration engine, but guide learners into school-focused groups and institution-first discussion."
      loading={loading}
      error={error}
      refreshing={refreshing}
      onRefresh={() => load(true)}
    >
      <StageStatRow items={[
        { label: "Groups", value: String(groups.length) },
        { label: "School posts", value: String(posts.length) }
      ]} />
      <StageSection title="Study Groups" icon="people" actionLabel="Open full" onAction={() => router.push("/community/collaboration" as never)}>
        {groups.length ? groups.slice(0, 5).map((group) => (
          <StageListCard
            key={group.id}
            title={group.name}
            meta={`Mentor: ${group.mentor?.name || "Guide"} · Members: ${group.membersCount || 0}`}
            tone="highschool"
          />
        )) : <EmptyState label="No study groups yet." />}
      </StageSection>
      <StageSection title="School Feed" icon="newspaper" actionLabel="Open full" onAction={() => router.push("/network?section=institution" as never)}>
        {posts.length ? posts.slice(0, 4).map((post) => (
          <StageListCard
            key={post._id}
            title={post.authorId?.name || "School update"}
            meta={`${post.commentCount || 0} comments`}
            note={post.content}
            tone="highschool"
          />
        )) : <EmptyState label="No school feed updates yet." />}
      </StageSection>
    </StageCommunityScaffold>
  );
}
