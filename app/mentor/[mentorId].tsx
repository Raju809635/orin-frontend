import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { api } from "@/lib/api";
import { notify } from "@/utils/notify";
import { useAuth } from "@/context/AuthContext";

let RazorpayCheckout: any = null;
if (Platform.OS !== "web") {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    RazorpayCheckout = require("react-native-razorpay").default;
  } catch {
    RazorpayCheckout = null;
  }
}

type MentorProfileResponse = {
  user: {
    _id: string;
    name: string;
    email: string;
  };
  profile: {
    title?: string;
    company?: string;
    about?: string;
    expertiseDomains?: string[];
    achievements?: string[];
    linkedInUrl?: string;
    primaryCategory?: string;
    subCategory?: string;
    specializations?: string[];
    verifiedBadge?: boolean;
    rankingTier?: string;
  } | null;
};

type ManualPaymentInstructions = {
  upiId: string;
  qrImageUrl: string;
  amount: number;
  currency: string;
  dueAt: string;
};

type CreateOrderResponse = {
  mode: "manual" | "razorpay";
  message: string;
  session: {
    _id: string;
  };
  order?: {
    id: string;
    amount: number;
    currency: string;
  };
  razorpayKeyId?: string;
  paymentInstructions?: ManualPaymentInstructions;
};

type TimeSlot = {
  label: string;
  iso: string;
  date: string;
  time: string;
  isBooked: boolean;
};

export default function MentorProfileScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ mentorId?: string }>();
  const mentorId = useMemo(() => (params.mentorId || "").trim(), [params.mentorId]);

  const [mentor, setMentor] = useState<MentorProfileResponse | null>(null);
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState("");
  const [notes, setNotes] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manualSessionId, setManualSessionId] = useState("");
  const [manualInstructions, setManualInstructions] = useState<ManualPaymentInstructions | null>(null);
  const [paymentScreenshotUrl, setPaymentScreenshotUrl] = useState("");
  const [transactionReference, setTransactionReference] = useState("");
  const [submittingProof, setSubmittingProof] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadMentor() {
      if (!mentorId) {
        setError("Missing mentor id.");
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);
        const [profileRes, availabilityRes] = await Promise.all([
          api.get<MentorProfileResponse>(`/api/profiles/mentor/${mentorId}`),
          api.get<{ upcomingSlots: TimeSlot[] }>(`/api/availability/mentor/${mentorId}`)
        ]);

        const nextSlots = (availabilityRes.data?.upcomingSlots || []).map((slot) => ({
          label: slot.label,
          iso: slot.iso,
          date: slot.date,
          time: slot.time,
          isBooked: Boolean(slot.isBooked)
        }));

        if (mounted) {
          setMentor(profileRes.data);
          setSlots(nextSlots);
          setSelectedSlot((prev) => {
            if (prev) return prev;
            const firstOpen = nextSlots.find((slot) => !slot.isBooked);
            return firstOpen?.iso || "";
          });
        }
      } catch (e: any) {
        if (mounted) {
          setError(e?.response?.data?.message || "Unable to load mentor profile.");
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    loadMentor();

    return () => {
      mounted = false;
    };
  }, [mentorId]);

  async function handleBookSession() {
    if (!mentorId || !selectedSlot) {
      setError("Please select a valid time slot.");
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      const dateObj = new Date(selectedSlot);
      const date = dateObj.toISOString().slice(0, 10);
      const time = dateObj.toISOString().slice(11, 16);

      const { data } = await api.post<CreateOrderResponse>("/api/sessions/create-order", {
        mentorId,
        date,
        time,
        durationMinutes: 60,
        notes
      });

      if (data.mode === "manual") {
        setManualSessionId(data.session._id);
        setManualInstructions(data.paymentInstructions || null);
        notify("Session created. Complete manual payment and submit screenshot.");
        return;
      }

      if (!RazorpayCheckout) {
        setError("Razorpay SDK unavailable. Build a dev/prod APK to use Razorpay.");
        return;
      }

      const options = {
        description: "ORIN Mentorship Session",
        image: "",
        currency: data.order?.currency || "INR",
        key: data.razorpayKeyId,
        amount: data.order?.amount || 0,
        name: "ORIN",
        order_id: data.order?.id,
        prefill: {
          email: "",
          contact: "",
          name: ""
        },
        theme: { color: "#1F7A4C" }
      };

      const paymentResult = await RazorpayCheckout.open(options);
      await api.post("/api/sessions/verify-payment", {
        sessionId: data.session._id,
        razorpay_order_id: paymentResult.razorpay_order_id,
        razorpay_payment_id: paymentResult.razorpay_payment_id,
        razorpay_signature: paymentResult.razorpay_signature
      });

      setNotes("");
      notify("Payment successful. Session confirmed.");
      Alert.alert("Session Confirmed", "Your payment is verified and session is confirmed.");
    } catch (e: any) {
      const apiMessage =
        e?.response?.data?.message ||
        e?.description ||
        "Payment or booking failed.";
      setError(apiMessage);
      notify(apiMessage);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function submitManualProof() {
    if (!manualSessionId || !paymentScreenshotUrl.trim()) {
      setError("Please provide payment screenshot URL.");
      return;
    }

    try {
      setSubmittingProof(true);
      setError(null);
      await api.post(`/api/sessions/${manualSessionId}/manual-payment`, {
        paymentScreenshot: paymentScreenshotUrl.trim(),
        transactionReference: transactionReference.trim()
      });
      notify("Payment submitted. Awaiting admin verification.");
      setPaymentScreenshotUrl("");
      setTransactionReference("");
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to submit payment screenshot.");
    } finally {
      setSubmittingProof(false);
    }
  }

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#1F7A4C" />
      </View>
    );
  }

  if (!mentor) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>{error || "Mentor not found."}</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.heading}>{mentor.user.name}</Text>
      <Text style={styles.meta}>{mentor.user.email}</Text>
      <Text style={styles.domain}>
        {[mentor.profile?.primaryCategory, mentor.profile?.subCategory].filter(Boolean).join(" > ") || "General"}
      </Text>
      <Text style={styles.meta}>{mentor.profile?.title || "Mentor"}</Text>
      <Text style={styles.bio}>{mentor.profile?.about?.trim() || "No bio added yet."}</Text>

      <Text style={styles.sectionTitle}>Expertise</Text>
      <View style={styles.chipWrap}>
        {(
          mentor.profile?.specializations?.length
            ? mentor.profile.specializations
            : mentor.profile?.expertiseDomains?.length
              ? mentor.profile.expertiseDomains
              : ["Mentorship"]
        ).map((item) => (
          <View key={item} style={styles.chip}>
            <Text style={styles.chipText}>{item}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.sectionTitle}>Select Session Slot</Text>
      <View style={styles.slotWrap}>
        {slots.map((slot) => {
          const isSelected = slot.iso === selectedSlot;
          return (
            <TouchableOpacity
              key={slot.iso}
              style={[
                styles.slotButton,
                isSelected && styles.slotButtonSelected,
                slot.isBooked && styles.slotButtonBooked
              ]}
              onPress={() => !slot.isBooked && setSelectedSlot(slot.iso)}
              disabled={slot.isBooked}
            >
              <Text
                style={[
                  styles.slotText,
                  isSelected && styles.slotTextSelected,
                  slot.isBooked && styles.slotTextBooked
                ]}
              >
                {slot.isBooked ? `${slot.label} (Booked)` : slot.label}
              </Text>
            </TouchableOpacity>
          );
        })}
        {slots.length === 0 ? <Text style={styles.meta}>Mentor has not set availability for next 7 days yet.</Text> : null}
      </View>

      <Text style={styles.sectionTitle}>Session Note (Optional)</Text>
      <TextInput
        style={styles.input}
        placeholder="What do you need help with?"
        value={notes}
        onChangeText={setNotes}
        multiline
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TouchableOpacity style={styles.button} onPress={handleBookSession} disabled={isSubmitting}>
        {isSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Book Session</Text>}
      </TouchableOpacity>

      {manualInstructions ? (
        <View style={styles.manualCard}>
          <Text style={styles.manualTitle}>Complete Your Payment</Text>
          <Text style={styles.meta}>
            Amount: {manualInstructions.currency} {manualInstructions.amount}
          </Text>
          <Text style={styles.meta}>UPI ID: {manualInstructions.upiId || "Not configured"}</Text>
          {manualInstructions.qrImageUrl ? (
            <Image source={{ uri: manualInstructions.qrImageUrl }} style={styles.qrImage} resizeMode="contain" />
          ) : (
            <Text style={styles.meta}>QR image not configured by admin.</Text>
          )}
          <Text style={styles.meta}>Pay before: {new Date(manualInstructions.dueAt).toLocaleString()}</Text>

          <TextInput
            style={[styles.input, { marginTop: 10 }]}
            placeholder="Payment screenshot URL"
            value={paymentScreenshotUrl}
            onChangeText={setPaymentScreenshotUrl}
          />
          <TextInput
            style={styles.input}
            placeholder="Transaction reference (optional)"
            value={transactionReference}
            onChangeText={setTransactionReference}
          />
          <TouchableOpacity style={styles.button} onPress={submitManualProof} disabled={submittingProof}>
            {submittingProof ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Upload Payment Screenshot</Text>
            )}
          </TouchableOpacity>
        </View>
      ) : null}

      {user?.role === "student" ? (
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => router.push(`/chat?userId=${mentorId}` as never)}
        >
          <Text style={styles.secondaryButtonText}>Message Mentor</Text>
        </TouchableOpacity>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: "#F4F9F6",
    padding: 20
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F4F9F6"
  },
  heading: {
    fontSize: 28,
    fontWeight: "700",
    color: "#1E2B24"
  },
  meta: {
    marginTop: 6,
    color: "#475467"
  },
  domain: {
    marginTop: 4,
    color: "#1F7A4C",
    fontWeight: "700"
  },
  bio: {
    marginTop: 12,
    color: "#344054",
    lineHeight: 20
  },
  sectionTitle: {
    marginTop: 20,
    marginBottom: 8,
    fontWeight: "700",
    color: "#1E2B24"
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  chip: {
    backgroundColor: "#E8F5EE",
    borderColor: "#1F7A4C",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  chipText: {
    color: "#1F7A4C",
    fontWeight: "600",
    fontSize: 12
  },
  slotWrap: {
    gap: 8
  },
  slotButton: {
    borderWidth: 1,
    borderColor: "#D0D5DD",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: "#fff"
  },
  slotButtonSelected: {
    borderColor: "#1F7A4C",
    backgroundColor: "#E8F5EE"
  },
  slotButtonBooked: {
    borderColor: "#B42318",
    backgroundColor: "#FEE4E2"
  },
  slotText: {
    color: "#344054",
    fontWeight: "500"
  },
  slotTextSelected: {
    color: "#1F7A4C",
    fontWeight: "700"
  },
  slotTextBooked: {
    color: "#B42318",
    fontWeight: "700"
  },
  input: {
    minHeight: 100,
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#D0D5DD",
    textAlignVertical: "top"
  },
  button: {
    marginTop: 16,
    backgroundColor: "#1F7A4C",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center"
  },
  buttonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16
  },
  secondaryButton: {
    marginTop: 10,
    borderColor: "#1F7A4C",
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center"
  },
  secondaryButtonText: {
    color: "#1F7A4C",
    fontWeight: "700",
    fontSize: 15
  },
  error: {
    marginTop: 10,
    color: "#B42318",
    textAlign: "center"
  },
  manualCard: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#1F7A4C",
    borderRadius: 12,
    backgroundColor: "#EEF8F2",
    padding: 12
  },
  manualTitle: {
    color: "#0F5132",
    fontWeight: "700",
    fontSize: 16
  },
  qrImage: {
    width: "100%",
    height: 220,
    marginTop: 10,
    backgroundColor: "#fff",
    borderRadius: 8
  }
});
