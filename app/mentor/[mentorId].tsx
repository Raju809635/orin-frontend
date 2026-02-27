import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { api } from "@/lib/api";
import { notify } from "@/utils/notify";

type MentorProfileResponse = {
  user: {
    _id: string;
    name: string;
    email: string;
    primaryCategory?: string;
    subCategory?: string;
    specializations?: string[];
    sessionPrice?: number;
  };
  profile: {
    profilePhotoUrl?: string;
    title?: string;
    company?: string;
    about?: string;
    expertiseDomains?: string[];
    achievements?: string[];
    linkedInUrl?: string;
    verifiedBadge?: boolean;
    rankingTier?: string;
  } | null;
};

function avatarInitial(name: string) {
  return name?.trim()?.charAt(0)?.toUpperCase() || "M";
}

type TimeSlot = {
  label: string;
  iso: string;
};

function buildTimeSlots(): TimeSlot[] {
  const slots: TimeSlot[] = [];
  const offsets = [1, 2, 3, 4, 5];
  const hours = [10, 14, 18];

  offsets.forEach((dayOffset) => {
    hours.forEach((hour) => {
      const date = new Date();
      date.setDate(date.getDate() + dayOffset);
      date.setHours(hour, 0, 0, 0);
      slots.push({
        label: date.toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "numeric" }),
        iso: date.toISOString()
      });
    });
  });

  return slots;
}

export default function MentorProfileScreen() {
  const params = useLocalSearchParams<{ mentorId?: string }>();
  const mentorId = useMemo(() => (params.mentorId || "").trim(), [params.mentorId]);
  const slots = useMemo(() => buildTimeSlots(), []);

  const [mentor, setMentor] = useState<MentorProfileResponse | null>(null);
  const [selectedSlot, setSelectedSlot] = useState(slots[0]?.iso || "");
  const [notes, setNotes] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        const { data } = await api.get<MentorProfileResponse>(`/api/profiles/mentor/${mentorId}`);
        if (mounted) {
          setMentor(data);
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
      await api.post("/api/bookings", {
        mentorId,
        scheduledAt: selectedSlot,
        notes
      });
      setNotes("");
      notify("Booking request sent.");
    } catch (e: any) {
      const apiMessage = e?.response?.data?.message || "Booking failed.";
      setError(apiMessage);
      notify(apiMessage);
    } finally {
      setIsSubmitting(false);
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
      {mentor.profile?.profilePhotoUrl ? (
        <Image source={{ uri: mentor.profile.profilePhotoUrl }} style={styles.profileImage} />
      ) : (
        <View style={styles.profileImageFallback}>
          <Text style={styles.profileImageInitial}>{avatarInitial(mentor.user.name)}</Text>
        </View>
      )}
      <Text style={styles.heading}>{mentor.user.name}</Text>
      <Text style={styles.meta}>{mentor.user.email}</Text>
      <Text style={styles.domain}>{mentor.user.subCategory || mentor.user.primaryCategory || "General"}</Text>
      {mentor.user.sessionPrice ? <Text style={styles.meta}>Session Price: INR {mentor.user.sessionPrice}</Text> : null}
      <Text style={styles.meta}>{mentor.profile?.title || "Mentor"}</Text>
      <Text style={styles.bio}>{mentor.profile?.about?.trim() || "No bio added yet."}</Text>

      <Text style={styles.sectionTitle}>Expertise</Text>
      <View style={styles.chipWrap}>
        {(mentor.profile?.expertiseDomains?.length ? mentor.profile.expertiseDomains : ["Mentorship"]).map((item) => (
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
              style={[styles.slotButton, isSelected && styles.slotButtonSelected]}
              onPress={() => setSelectedSlot(slot.iso)}
            >
              <Text style={[styles.slotText, isSelected && styles.slotTextSelected]}>{slot.label}</Text>
            </TouchableOpacity>
          );
        })}
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
  profileImage: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 2,
    borderColor: "#D0D5DD",
    marginBottom: 12
  },
  profileImageFallback: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "#E6F4ED",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12
  },
  profileImageInitial: {
    color: "#0B3D2E",
    fontSize: 34,
    fontWeight: "700"
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
  slotText: {
    color: "#344054",
    fontWeight: "500"
  },
  slotTextSelected: {
    color: "#1F7A4C",
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
  error: {
    marginTop: 10,
    color: "#B42318",
    textAlign: "center"
  }
});
