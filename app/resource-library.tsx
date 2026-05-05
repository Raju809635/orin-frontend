import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { router } from "expo-router";
import { api } from "@/lib/api";

type SubjectSummary = {
  slug: string;
  name: string;
  verificationStatus: string;
  chapterCount: number;
};

type LibraryClass = {
  class: number;
  subjects: SubjectSummary[];
};

type LibraryBoard = {
  board: string;
  classes: LibraryClass[];
};

type AcademicRecord = {
  metadata: {
    board: string;
    class: number;
    subject: string;
    verification_status?: string;
    verification_scope?: string;
  };
  chapters: {
    chapter_no: number;
    chapter_name: string;
    topics: { topic_name: string; subtopics: string[] }[];
  }[];
};

function Chip({
  label,
  active,
  onPress
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={[styles.chip, active && styles.chipActive]} onPress={onPress}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function ResourceLibraryScreen() {
  const [boards, setBoards] = useState<LibraryBoard[]>([]);
  const [board, setBoard] = useState("CBSE");
  const [classNumber, setClassNumber] = useState(10);
  const [subject, setSubject] = useState("mathematics");
  const [record, setRecord] = useState<AcademicRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const activeBoard = useMemo(() => boards.find((item) => item.board === board), [boards, board]);
  const activeClass = useMemo(
    () => activeBoard?.classes.find((item) => item.class === classNumber),
    [activeBoard, classNumber]
  );

  useEffect(() => {
    let mounted = true;
    async function loadLibrary() {
      try {
        const { data } = await api.get<{ boards: LibraryBoard[] }>("/api/academics/library");
        if (!mounted) return;
        setBoards(data.boards);
        const cbse = data.boards.find((item) => item.board === "CBSE") || data.boards[0];
        const demoClass = cbse?.classes.find((item) => item.class === 10) || cbse?.classes[0];
        const demoSubject =
          demoClass?.subjects.find((item) => item.slug === "mathematics") || demoClass?.subjects[0];
        if (cbse) setBoard(cbse.board);
        if (demoClass) setClassNumber(demoClass.class);
        if (demoSubject) setSubject(demoSubject.slug);
      } catch (e: any) {
        if (mounted) setError(e?.response?.data?.message || "Failed to load academic library.");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadLibrary();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!board || !classNumber || !subject) return;
    let mounted = true;
    async function loadSubject() {
      setError(null);
      try {
        const { data } = await api.get<AcademicRecord>(
          `/api/academics/${board}/class/${classNumber}/subject/${subject}`
        );
        if (mounted) setRecord(data);
      } catch (e: any) {
        if (mounted) setError(e?.response?.data?.message || "Failed to load subject.");
      }
    }
    loadSubject();
    return () => {
      mounted = false;
    };
  }, [board, classNumber, subject]);

  function openMergedPlan() {
    const subjectName = record?.metadata.subject || subject;
    router.push({
      pathname: "/ai-assistant",
      params: {
        board,
        classNumber: String(classNumber),
        subject,
        prompt: `Create a study plan and roadmap for ${board} Class ${classNumber} ${subjectName}. Use chapters from the academic resource library.`
      }
    } as never);
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#1F7A4C" />
        <Text style={styles.muted}>Loading resources...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Resource Library</Text>
      <Text style={styles.subheading}>Board-wise syllabus, chapters, topics, and study planning.</Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.row}>
        {boards.map((item) => (
          <Chip
            key={item.board}
            label={item.board}
            active={item.board === board}
            onPress={() => {
              setBoard(item.board);
              const nextClass = item.classes.find((entry) => entry.class === 10) || item.classes[0];
              setClassNumber(nextClass?.class || 10);
              setSubject(nextClass?.subjects[0]?.slug || "mathematics");
            }}
          />
        ))}
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.row}>
        {activeBoard?.classes.map((item) => (
          <Chip
            key={item.class}
            label={`Class ${item.class}`}
            active={item.class === classNumber}
            onPress={() => {
              setClassNumber(item.class);
              setSubject(item.subjects[0]?.slug || subject);
            }}
          />
        ))}
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.row}>
        {activeClass?.subjects.map((item) => (
          <Chip key={item.slug} label={item.name} active={item.slug === subject} onPress={() => setSubject(item.slug)} />
        ))}
      </ScrollView>

      <View style={styles.summary}>
        <View>
          <Text style={styles.subjectTitle}>
            {record?.metadata.board || board} Class {record?.metadata.class || classNumber}
          </Text>
          <Text style={styles.subjectName}>{record?.metadata.subject || subject}</Text>
          <Text style={styles.status}>{record?.metadata.verification_status || "Loading status"}</Text>
        </View>
        <TouchableOpacity style={styles.planButton} onPress={openMergedPlan}>
          <Text style={styles.planButtonText}>Study Plan + Roadmap</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={record?.chapters || []}
        keyExtractor={(item) => String(item.chapter_no)}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={styles.chapter}>
            <Text style={styles.chapterTitle}>
              {item.chapter_no}. {item.chapter_name}
            </Text>
            {item.topics.slice(0, 3).map((topic) => (
              <View key={topic.topic_name} style={styles.topic}>
                <Text style={styles.topicName}>{topic.topic_name}</Text>
                <Text style={styles.topicMeta}>{topic.subtopics.slice(0, 3).join(" • ")}</Text>
              </View>
            ))}
          </View>
        )}
        ListEmptyComponent={<Text style={styles.muted}>No chapters found for this subject.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F4F9F6", padding: 16 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#F4F9F6" },
  heading: { fontSize: 24, fontWeight: "800", color: "#1E2B24" },
  subheading: { color: "#475467", marginTop: 4, marginBottom: 12 },
  row: { flexGrow: 0, marginBottom: 10 },
  chip: {
    backgroundColor: "#FFFFFF",
    borderColor: "#D0D5DD",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8
  },
  chipActive: { backgroundColor: "#1F7A4C", borderColor: "#1F7A4C" },
  chipText: { color: "#344054", fontWeight: "700" },
  chipTextActive: { color: "#FFFFFF" },
  summary: {
    backgroundColor: "#FFFFFF",
    borderColor: "#E4E7EC",
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12
  },
  subjectTitle: { color: "#667085", fontWeight: "700" },
  subjectName: { color: "#1E2B24", fontSize: 18, fontWeight: "800", marginTop: 2 },
  status: { color: "#1F7A4C", marginTop: 4, fontSize: 12, fontWeight: "700" },
  planButton: {
    alignSelf: "center",
    backgroundColor: "#EAF6EF",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  planButtonText: { color: "#1F7A4C", fontWeight: "800", textAlign: "center" },
  list: { paddingBottom: 24 },
  chapter: {
    backgroundColor: "#FFFFFF",
    borderColor: "#E4E7EC",
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 10
  },
  chapterTitle: { color: "#1E2B24", fontWeight: "800", fontSize: 16, marginBottom: 8 },
  topic: { borderTopColor: "#F2F4F7", borderTopWidth: 1, paddingTop: 8, marginTop: 8 },
  topicName: { color: "#344054", fontWeight: "700" },
  topicMeta: { color: "#667085", marginTop: 3, lineHeight: 18 },
  muted: { color: "#667085", marginTop: 10 },
  error: { color: "#B42318", marginBottom: 8 }
});
