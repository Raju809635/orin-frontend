import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { api } from "@/lib/api";
import { getAppErrorMessage, handleAppError } from "@/lib/appError";
import { EmptyState, StageCommunityScaffold, StageListCard, StageSection, StageStatRow } from "@/components/community/stage-community-data-ui";
import { useAppTheme } from "@/context/ThemeContext";

type QuizBattlePlayer = { rank: number; userId: string; name: string; score: number };
type QuizBattleRoomState = {
  roomId: string;
  roomCode: string;
  subject: string;
  topic?: string;
  status: "waiting" | "live" | "completed";
  questionIndex: number;
  totalQuestions: number;
  question?: {
    id: string;
    text: string;
    options: string[];
    durationSec: number;
    startedAt?: string;
  } | null;
  participantsCount: number;
  leaderboard: QuizBattlePlayer[];
  me?: QuizBattlePlayer | null;
};

const SUBJECT_OPTIONS = ["Mathematics", "Science", "English", "Social", "General Studies"];

export default function HighSchoolQuizBattleScreen() {
  const { colors } = useAppTheme();
  const [subject, setSubject] = useState("Mathematics");
  const [topic, setTopic] = useState("");
  const [roomInput, setRoomInput] = useState("");
  const [room, setRoom] = useState<QuizBattleRoomState | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittingAnswer, setSubmittingAnswer] = useState(false);

  const questionTimerLeft = useMemo(() => {
    if (!room?.question?.startedAt || !room.question.durationSec) return null;
    const elapsedSec = Math.floor((Date.now() - new Date(room.question.startedAt).getTime()) / 1000);
    return Math.max(0, room.question.durationSec - elapsedSec);
  }, [room]);

  const loadState = useCallback(
    async (roomId: string, refresh = false) => {
      try {
        if (refresh) setRefreshing(true);
        else setLoading(true);
        const { data } = await api.get<QuizBattleRoomState>(`/api/network/highschool-quiz-battle/rooms/${roomId}/state`);
        setRoom(data || null);
      } catch (e) {
        setError(getAppErrorMessage(e, "Unable to load quiz battle state."));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    []
  );

  useEffect(() => {
    if (!room?.roomId || room.status === "completed") return;
    const interval = setInterval(() => {
      loadState(room.roomId, true);
    }, 2500);
    return () => clearInterval(interval);
  }, [loadState, room?.roomId, room?.status]);

  useFocusEffect(
    useCallback(() => {
      if (room?.roomId) loadState(room.roomId, true);
    }, [loadState, room?.roomId])
  );

  async function createRoom() {
    try {
      setError(null);
      setLoading(true);
      const { data } = await api.post<{ room: QuizBattleRoomState }>("/api/network/highschool-quiz-battle/rooms", {
        subject,
        topic
      });
      setRoom(data?.room || null);
      if (data?.room?.roomCode) setRoomInput(data.room.roomCode);
    } catch (e) {
      setError(getAppErrorMessage(e, "Unable to create quiz room."));
    } finally {
      setLoading(false);
    }
  }

  async function joinRoom() {
    try {
      const roomId = roomInput.trim();
      if (!roomId) {
        Alert.alert("Room required", "Enter a room ID to join.");
        return;
      }
      setError(null);
      setLoading(true);
      const { data } = await api.post<{ room: QuizBattleRoomState }>(`/api/network/highschool-quiz-battle/rooms/${roomId}/join`);
      setRoom(data?.room || null);
    } catch (e) {
      setError(getAppErrorMessage(e, "Unable to join room."));
    } finally {
      setLoading(false);
    }
  }

  async function submitAnswer(option: string) {
    if (!room?.roomId || !room.question || submittingAnswer) return;
    try {
      setSubmittingAnswer(true);
      const { data } = await api.post<{
        isCorrect: boolean;
        awardedScore: number;
        explanation?: string;
        room: QuizBattleRoomState;
      }>(`/api/network/highschool-quiz-battle/rooms/${room.roomId}/answer`, {
        selectedOption: option
      });
      setRoom(data?.room || room);
      if (data?.isCorrect) {
        Alert.alert("Correct", `Great! +${data.awardedScore} points.`);
      }
    } catch (e) {
      handleAppError(e, {
        mode: "alert",
        title: "Quiz Battle",
        fallbackMessage: "Unable to submit answer."
      });
    } finally {
      setSubmittingAnswer(false);
    }
  }

  return (
    <StageCommunityScaffold
      eyebrow="High School Community"
      title="Quiz Battle"
      subtitle="Join a live room, answer fast, and climb the battle leaderboard. First correct answer gets top points."
      loading={loading}
      error={error}
      refreshing={refreshing}
      onRefresh={() => {
        if (room?.roomId) loadState(room.roomId, true);
      }}
    >
      <StageStatRow
        items={[
          { label: "Room", value: room?.roomCode || "-" },
          { label: "Players", value: String(room?.participantsCount || 0) },
          { label: "Score", value: String(room?.me?.score || 0) }
        ]}
      />

      <StageSection title="Start or Join Battle" icon="game-controller">
        <View style={styles.subjectRow}>
          {SUBJECT_OPTIONS.map((item) => {
            const active = item === subject;
            return (
              <TouchableOpacity
                key={item}
                style={[
                  styles.subjectChip,
                  { borderColor: active ? colors.accent : colors.border, backgroundColor: active ? colors.accentSoft : colors.surfaceAlt }
                ]}
                onPress={() => setSubject(item)}
              >
                <Text style={[styles.subjectChipText, { color: active ? colors.accent : colors.textMuted }]}>{item}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <TextInput
          style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}
          placeholder="Optional topic (e.g., Algebra)"
          placeholderTextColor={colors.textMuted}
          value={topic}
          onChangeText={setTopic}
        />

        <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.accent }]} onPress={createRoom}>
          <Text style={styles.actionBtnText}>Create Battle Room</Text>
        </TouchableOpacity>

        <TextInput
          style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}
          placeholder="Enter room ID/code to join"
          placeholderTextColor={colors.textMuted}
          value={roomInput}
          onChangeText={setRoomInput}
        />
        <TouchableOpacity style={[styles.actionBtn, { backgroundColor: "#155EEF" }]} onPress={joinRoom}>
          <Text style={styles.actionBtnText}>Join Room</Text>
        </TouchableOpacity>
      </StageSection>

      <StageSection title="Live Question" icon="flash">
        {room?.question ? (
          <>
            <StageListCard
              title={`Q${room.questionIndex + 1}/${room.totalQuestions}`}
              meta={questionTimerLeft != null ? `Time left: ${questionTimerLeft}s` : "Live question"}
              note={room.question.text}
              tone="highschool"
            />
            {(room.question.options || []).map((option) => (
              <TouchableOpacity
                key={option}
                style={[styles.optionBtn, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}
                onPress={() => submitAnswer(option)}
                disabled={submittingAnswer}
              >
                <Text style={[styles.optionText, { color: colors.text }]}>{option}</Text>
              </TouchableOpacity>
            ))}
          </>
        ) : (
          <EmptyState label={room ? "Waiting for battle to start." : "Create or join a room to begin."} />
        )}
      </StageSection>

      <StageSection title="Leaderboard" icon="podium">
        {(room?.leaderboard || []).length ? (
          (room?.leaderboard || []).map((entry) => (
            <StageListCard
              key={`${entry.userId}-${entry.rank}`}
              title={`#${entry.rank} ${entry.name}`}
              meta={`${entry.score} points`}
              tone="highschool"
            />
          ))
        ) : (
          <EmptyState label="Leaderboard appears when players join." />
        )}
      </StageSection>
    </StageCommunityScaffold>
  );
}

const styles = StyleSheet.create({
  subjectRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  subjectChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7 },
  subjectChipText: { fontWeight: "800", fontSize: 12 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  actionBtn: { borderRadius: 12, paddingVertical: 11, alignItems: "center" },
  actionBtnText: { color: "#fff", fontWeight: "900" },
  optionBtn: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  optionText: { fontWeight: "700" }
});
