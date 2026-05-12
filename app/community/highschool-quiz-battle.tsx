import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Share, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import * as Linking from "expo-linking";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
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
  const params = useLocalSearchParams<{ room?: string }>();
  const { colors } = useAppTheme();
  const [subject, setSubject] = useState("Mathematics");
  const [topic, setTopic] = useState("");
  const [roomInput, setRoomInput] = useState("");
  const [room, setRoom] = useState<QuizBattleRoomState | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittingAnswer, setSubmittingAnswer] = useState(false);
  const [answerFeedback, setAnswerFeedback] = useState<{ correct: boolean; points: number; explanation?: string } | null>(null);

  const questionTimerLeft = useMemo(() => {
    if (!room?.question?.startedAt || !room.question.durationSec) return null;
    const elapsedSec = Math.floor((Date.now() - new Date(room.question.startedAt).getTime()) / 1000);
    return Math.max(0, room.question.durationSec - elapsedSec);
  }, [room]);
  const questionProgress = useMemo(() => {
    if (!room?.question?.durationSec || questionTimerLeft == null) return 0;
    return Math.max(0, Math.min(100, Math.round((questionTimerLeft / room.question.durationSec) * 100)));
  }, [questionTimerLeft, room?.question?.durationSec]);
  const battleLink = useMemo(() => room?.roomCode ? Linking.createURL(`/community/highschool-quiz-battle?room=${room.roomCode}`) : "", [room?.roomCode]);

  const loadState = useCallback(
    async (roomId: string, refresh = false) => {
      try {
        if (refresh) setRefreshing(true);
        else setLoading(true);
        const { data } = await api.get<QuizBattleRoomState>(`/api/network/highschool-quiz-battle/rooms/${roomId}/state`);
        setRoom(data || null);
        if (data?.question?.id !== room?.question?.id) setAnswerFeedback(null);
      } catch (e) {
        setError(getAppErrorMessage(e, "Unable to load quiz battle state."));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [room?.question?.id]
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

  useEffect(() => {
    const code = String(params.room || "").trim();
    if (code && !room) {
      setRoomInput(code);
      void (async () => {
        try {
          setLoading(true);
          const { data } = await api.post<{ room: QuizBattleRoomState }>(`/api/network/highschool-quiz-battle/rooms/${code}/join`);
          setRoom(data?.room || null);
        } catch (e) {
          setError(getAppErrorMessage(e, "Unable to open this battle link."));
        } finally {
          setLoading(false);
        }
      })();
    }
  }, [params.room, room]);

  async function shareBattle() {
    if (!room?.roomCode) return;
    const message = `Join my ORIN Quiz Battle room ${room.roomCode}: ${battleLink}`;
    try {
      await Share.share({ message });
    } catch {
      await Clipboard.setStringAsync(message);
      Alert.alert("Invite copied", "Battle invite copied to clipboard.");
    }
  }

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
      setAnswerFeedback({ correct: Boolean(data?.isCorrect), points: Number(data?.awardedScore || 0), explanation: data?.explanation || "" });
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

      {room?.roomCode ? (
        <StageSection title={room.status === "waiting" ? "Battle Lobby" : room.status === "completed" ? "Battle Complete" : "Battle Arena"} icon="share-social">
          <StageListCard
            title={`Room ${room.roomCode}`}
            meta={room.status === "waiting" ? "Share the link. Battle starts when another student joins." : `${room.subject}${room.topic ? ` | ${room.topic}` : ""}`}
            note={battleLink}
            tone="highschool"
          />
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: "#7C3AED" }]} onPress={shareBattle}>
            <Text style={styles.actionBtnText}>Share Battle Link</Text>
          </TouchableOpacity>
        </StageSection>
      ) : null}

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
              meta={questionTimerLeft != null ? `Time left: ${questionTimerLeft}s | Fast correct answers win bonus points` : "Live question"}
              note={room.question.text}
              tone="highschool"
            />
            <View style={[styles.timerTrack, { backgroundColor: colors.surfaceAlt }]}>
              <View style={[styles.timerFill, { width: `${Math.max(4, questionProgress)}%`, backgroundColor: questionProgress > 35 ? "#12B76A" : "#F97316" }]} />
            </View>
            {answerFeedback ? (
              <View style={[styles.feedbackCard, { borderColor: answerFeedback.correct ? "#12B76A" : "#F97316", backgroundColor: answerFeedback.correct ? "#ECFDF3" : "#FFF7ED" }]}>
                <Text style={[styles.feedbackTitle, { color: answerFeedback.correct ? "#027A48" : "#C2410C" }]}>
                  {answerFeedback.correct ? `Correct +${answerFeedback.points} XP` : "Answer locked"}
                </Text>
                {answerFeedback.explanation ? <Text style={styles.feedbackText}>{answerFeedback.explanation}</Text> : null}
              </View>
            ) : null}
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

      <StageSection title={room?.status === "completed" ? "Final Podium" : "Leaderboard"} icon="podium">
        {(room?.leaderboard || []).length ? (
          (room?.leaderboard || []).map((entry) => (
            <StageListCard
              key={`${entry.userId}-${entry.rank}`}
              title={`${entry.rank === 1 ? "Winner " : ""}#${entry.rank} ${entry.name}`}
              meta={`${entry.score} points${entry.rank === 1 ? " | Champion badge" : ""}`}
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
  optionText: { fontWeight: "700" },
  timerTrack: { height: 10, borderRadius: 999, overflow: "hidden" },
  timerFill: { height: "100%", borderRadius: 999 },
  feedbackCard: { borderWidth: 1, borderRadius: 14, padding: 10, gap: 4 },
  feedbackTitle: { fontWeight: "900" },
  feedbackText: { color: "#7C2D12", lineHeight: 18, fontWeight: "700" }
});
