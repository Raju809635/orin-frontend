import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useAppTheme } from "@/context/ThemeContext";
import { notify } from "@/utils/notify";

let RazorpayCheckout: any = null;
if (Platform.OS !== "web") {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    RazorpayCheckout = require("react-native-razorpay").default;
  } catch {
    RazorpayCheckout = null;
  }
}

type SprintDetail = {
  id: string;
  title: string;
  domain?: string;
  description?: string;
  posterImageUrl?: string;
  curriculumDocumentUrl?: string;
  curriculumFileType?: string;
  startDate: string;
  endDate: string;
  durationWeeks?: number;
  totalLiveSessions?: number;
  sessionSchedule?: Array<{ label?: string; startsAt?: string | null; durationMinutes?: number }>;
  weeklyPlan?: string[];
  outcomes?: string[];
  tools?: string[];
  meetingLink?: string;
  sessionMode?: "free" | "paid";
  price?: number;
  currency?: string;
  minParticipants?: number;
  maxParticipants?: number;
  participantCount?: number;
  paidEnrollmentCount?: number;
  seatsLeft?: number;
  isSoldOut?: boolean;
  minParticipantsMet?: boolean;
  hasStarted?: boolean;
  hasEnded?: boolean;
  adminReviewNote?: string;
  mentor?: {
    id?: string | null;
    name?: string;
    email?: string;
    title?: string;
    company?: string;
    about?: string;
    profilePhotoUrl?: string;
    rating?: number;
    verifiedBadge?: boolean;
    experienceYears?: number;
  };
  myEnrollment?: {
    id: string;
    paymentMode?: "free" | "razorpay";
    paymentStatus?: "pending" | "paid" | "failed" | "cancelled";
    enrollmentStatus?: "pending_payment" | "enrolled" | "cancelled";
    paymentDueAt?: string | null;
    amount?: number;
    mentorPayoutAmount?: number;
    platformFeeAmount?: number;
    payoutStatus?: "not_ready" | "pending" | "paid" | "issue_reported";
    mentorPayoutConfirmationStatus?: "not_ready" | "pending" | "confirmed" | "issue_reported";
  } | null;
};

type SprintOrderResponse = {
  mode: "free" | "razorpay";
  message: string;
  enrollment?: { _id: string };
  order?: { id: string; amount: number; currency: string } | null;
  razorpayKeyId?: string;
};

export default function SprintDetailPage() {
  const { sprintId } = useLocalSearchParams<{ sprintId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const [sprint, setSprint] = useState<SprintDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    if (!sprintId) return;
    try {
      if (refresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      const { data } = await api.get<{ sprint: SprintDetail }>(`/api/network/sprints/${sprintId}`);
      setSprint(data?.sprint || null);
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to load sprint.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [sprintId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const joinLabel = useMemo(() => {
    if (!sprint) return "Join Sprint";
    if (sprint.myEnrollment?.enrollmentStatus === "enrolled") return "Joined";
    if (sprint.myEnrollment?.enrollmentStatus === "pending_payment") return "Pay Now";
    return sprint.sessionMode === "paid" ? "Join & Pay" : "Join Free";
  }, [sprint]);

  async function openJoinFlow() {
    if (!sprint || user?.role !== "student") return;

    try {
      setBusy(true);
      setError(null);

      if (sprint.myEnrollment?.enrollmentStatus === "enrolled") {
        notify("You are already enrolled in this sprint.");
        return;
      }

      if (sprint.myEnrollment?.enrollmentStatus === "pending_payment" && sprint.myEnrollment?.paymentMode === "razorpay") {
        if (!RazorpayCheckout) {
          Alert.alert("Unavailable", "Razorpay SDK is unavailable in this build.");
          return;
        }
        const retry = await api.post<SprintOrderResponse>(`/api/network/sprints/enrollments/${sprint.myEnrollment.id}/retry-order`);
        const paymentResult = await RazorpayCheckout.open({
          description: sprint.title || "ORIN Sprint",
          image: sprint.posterImageUrl || "",
          currency: retry.data.order?.currency || "INR",
          key: retry.data.razorpayKeyId,
          amount: retry.data.order?.amount || 0,
          name: "ORIN",
          order_id: retry.data.order?.id,
          theme: { color: "#1F7A4C" }
        });
        await api.post("/api/network/sprints/verify-payment", {
          enrollmentId: sprint.myEnrollment.id,
          razorpay_order_id: paymentResult.razorpay_order_id,
          razorpay_payment_id: paymentResult.razorpay_payment_id,
          razorpay_signature: paymentResult.razorpay_signature
        });
        notify("Sprint enrollment confirmed.");
        await load(true);
        return;
      }

      const { data } = await api.post<SprintOrderResponse>(`/api/network/sprints/${sprint.id}/book`);
      if (data.mode === "free") {
        notify("Sprint joined.");
        await load(true);
        return;
      }

      if (!RazorpayCheckout) {
        Alert.alert("Unavailable", "Razorpay SDK is unavailable in this build.");
        return;
      }

      const paymentResult = await RazorpayCheckout.open({
        description: sprint.title || "ORIN Sprint",
        image: sprint.posterImageUrl || "",
        currency: data.order?.currency || "INR",
        key: data.razorpayKeyId,
        amount: data.order?.amount || 0,
        name: "ORIN",
        order_id: data.order?.id,
        theme: { color: "#1F7A4C" }
      });
      await api.post("/api/network/sprints/verify-payment", {
        enrollmentId: data.enrollment?._id,
        razorpay_order_id: paymentResult.razorpay_order_id,
        razorpay_payment_id: paymentResult.razorpay_payment_id,
        razorpay_signature: paymentResult.razorpay_signature
      });
      notify("Sprint enrollment confirmed.");
      await load(true);
    } catch (e: any) {
      Alert.alert("Sprint", e?.response?.data?.message || e?.description || "Enrollment not completed.");
      await load(true);
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (!sprint) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <Text style={[styles.error, { color: colors.text }]}>Sprint not available.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.accent} />}
    >
      <View style={[styles.headerRow, { borderColor: colors.border }]}>
        <TouchableOpacity style={[styles.backBtn, { borderColor: colors.border, backgroundColor: colors.surface }]} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Sprint Detail</Text>
        <View style={styles.headerSpacer} />
      </View>

      {sprint.posterImageUrl ? <Image source={{ uri: sprint.posterImageUrl }} style={styles.poster} resizeMode="cover" /> : null}

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.domainTag, { color: colors.accent }]}>{sprint.domain || "Sprint Program"}</Text>
        <Text style={[styles.title, { color: colors.text }]}>{sprint.title}</Text>
        <Text style={[styles.meta, { color: colors.textMuted }]}>
          {new Date(sprint.startDate).toLocaleDateString()} - {new Date(sprint.endDate).toLocaleDateString()} | {sprint.durationWeeks || 1} weeks
        </Text>
        <Text style={[styles.meta, { color: colors.textMuted }]}>
          {sprint.sessionMode === "paid" ? `INR ${sprint.price || 0}` : "Free"} | Seats {sprint.participantCount || 0}/{sprint.maxParticipants || 20}
        </Text>
        {sprint.description ? <Text style={[styles.description, { color: colors.text }]}>{sprint.description}</Text> : null}
        <View style={styles.statusRow}>
          <View style={[styles.statusChip, { backgroundColor: colors.surfaceAlt }]}>
            <Text style={[styles.statusText, { color: colors.text }]}>{sprint.isSoldOut ? "Sold Out" : `Seats left ${sprint.seatsLeft ?? 0}`}</Text>
          </View>
          <View style={[styles.statusChip, { backgroundColor: colors.surfaceAlt }]}>
            <Text style={[styles.statusText, { color: colors.text }]}>{sprint.minParticipantsMet ? "Cohort viable" : "Cohort building"}</Text>
          </View>
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Mentor</Text>
        <View style={styles.mentorRow}>
          {sprint.mentor?.profilePhotoUrl ? <Image source={{ uri: sprint.mentor.profilePhotoUrl }} style={styles.avatar} /> : <View style={[styles.avatar, { backgroundColor: colors.surfaceAlt }]} />}
          <View style={{ flex: 1 }}>
            <Text style={[styles.mentorName, { color: colors.text }]}>{sprint.mentor?.name || "Mentor"}</Text>
            {sprint.mentor?.title ? <Text style={[styles.meta, { color: colors.textMuted }]}>{sprint.mentor.title}</Text> : null}
            {sprint.mentor?.company ? <Text style={[styles.meta, { color: colors.textMuted }]}>{sprint.mentor.company}</Text> : null}
          </View>
        </View>
        {sprint.mentor?.about ? <Text style={[styles.meta, { color: colors.textMuted }]}>{sprint.mentor.about}</Text> : null}
      </View>

      {(sprint.sessionSchedule?.length || sprint.weeklyPlan?.length || sprint.outcomes?.length || sprint.tools?.length) ? (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {sprint.sessionSchedule?.length ? (
            <>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Session Schedule</Text>
              {sprint.sessionSchedule.map((item, index) => (
                <Text key={`${item.label}-${index}`} style={[styles.listItem, { color: colors.textMuted }]}>
                  {item.label || `Session ${index + 1}`} {item.startsAt ? `• ${new Date(item.startsAt).toLocaleString()}` : ""}
                </Text>
              ))}
            </>
          ) : null}
          {sprint.weeklyPlan?.length ? (
            <>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Weekly Plan</Text>
              {sprint.weeklyPlan.map((item, index) => (
                <Text key={`${item}-${index}`} style={[styles.listItem, { color: colors.textMuted }]}>• {item}</Text>
              ))}
            </>
          ) : null}
          {sprint.outcomes?.length ? (
            <>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Outcomes</Text>
              {sprint.outcomes.map((item, index) => (
                <Text key={`${item}-${index}`} style={[styles.listItem, { color: colors.textMuted }]}>• {item}</Text>
              ))}
            </>
          ) : null}
          {sprint.tools?.length ? (
            <>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Tools</Text>
              {sprint.tools.map((item, index) => (
                <Text key={`${item}-${index}`} style={[styles.listItem, { color: colors.textMuted }]}>• {item}</Text>
              ))}
            </>
          ) : null}
        </View>
      ) : null}

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Materials</Text>
        {sprint.curriculumDocumentUrl ? (
          <TouchableOpacity style={[styles.secondaryBtn, { borderColor: colors.border }]} onPress={() => Linking.openURL(sprint.curriculumDocumentUrl || "")}>
            <Text style={[styles.secondaryBtnText, { color: colors.text }]}>View Full Curriculum</Text>
          </TouchableOpacity>
        ) : (
          <Text style={[styles.meta, { color: colors.textMuted }]}>Curriculum document not uploaded yet.</Text>
        )}
        {(user?.role === "mentor" || sprint.myEnrollment?.enrollmentStatus === "enrolled") ? (
          sprint.meetingLink ? (
            <TouchableOpacity style={[styles.secondaryBtn, { borderColor: colors.border }]} onPress={() => Linking.openURL(sprint.meetingLink || "")}>
              <Text style={[styles.secondaryBtnText, { color: colors.text }]}>Open Sprint Link</Text>
            </TouchableOpacity>
          ) : (
            <Text style={[styles.meta, { color: colors.textMuted }]}>Mentor has not added the sprint session link yet.</Text>
          )
        ) : null}
      </View>

      {error ? <Text style={[styles.error, { color: "#B42318" }]}>{error}</Text> : null}

      {user?.role === "student" ? (
        <TouchableOpacity
          style={[styles.primaryBtn, { backgroundColor: busy || sprint.isSoldOut ? colors.border : colors.accent }]}
          disabled={busy || Boolean(sprint.isSoldOut)}
          onPress={openJoinFlow}
        >
          <Text style={styles.primaryBtnText}>{busy ? "Please wait..." : joinLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 14
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6
  },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "800"
  },
  headerSpacer: {
    width: 42
  },
  poster: {
    width: "100%",
    height: 220,
    borderRadius: 18
  },
  card: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    gap: 8
  },
  domainTag: {
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase"
  },
  title: {
    fontSize: 24,
    fontWeight: "800"
  },
  meta: {
    fontSize: 14,
    lineHeight: 21
  },
  description: {
    fontSize: 15,
    lineHeight: 24
  },
  statusRow: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
    marginTop: 6
  },
  statusChip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  statusText: {
    fontSize: 12,
    fontWeight: "700"
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "800",
    marginTop: 2
  },
  mentorRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center"
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28
  },
  mentorName: {
    fontSize: 16,
    fontWeight: "800"
  },
  listItem: {
    fontSize: 14,
    lineHeight: 22
  },
  secondaryBtn: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14
  },
  secondaryBtnText: {
    fontSize: 14,
    fontWeight: "700"
  },
  primaryBtn: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2
  },
  primaryBtnText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "800"
  },
  error: {
    fontSize: 14,
    lineHeight: 22
  }
});
