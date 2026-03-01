import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { CATEGORY_OPTIONS } from "@/constants/categories";

export default function DomainScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Choose Your Domain</Text>
      <Text style={styles.subheading}>Explore approved mentors and book a session.</Text>
      <Text style={styles.sectionTitle}>Browse by Category</Text>
      {CATEGORY_OPTIONS.map((domain) => (
        <TouchableOpacity
          key={domain}
          style={styles.card}
          onPress={() => router.push(`/mentors?domain=${encodeURIComponent(domain)}` as never)}
        >
          <Text style={styles.text}>{domain}</Text>
        </TouchableOpacity>
      ))}

      <Text style={styles.sectionTitle}>All Mentors</Text>
      <TouchableOpacity style={styles.allCard} onPress={() => router.push("/mentors" as never)}>
        <Text style={styles.allTitle}>View All Mentor Profiles</Text>
        <Text style={styles.allSubtext}>See every approved mentor in one list.</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F4F9F6",
    padding: 20
  },
  heading: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1E2B24",
    marginBottom: 6
  },
  subheading: {
    color: "#475467",
    marginBottom: 16
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1E2B24",
    marginBottom: 8
  },
  card: {
    backgroundColor: "white",
    padding: 18,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E4E7EC"
  },
  text: {
    fontSize: 16,
    color: "#1E2B24",
    fontWeight: "600"
  },
  allCard: {
    marginTop: 2,
    backgroundColor: "#E8F5EE",
    borderColor: "#1F7A4C",
    borderWidth: 1,
    borderRadius: 16,
    padding: 18
  },
  allTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F5132"
  },
  allSubtext: {
    marginTop: 6,
    color: "#1E2B24"
  }
});
