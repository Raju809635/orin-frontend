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
      {CATEGORY_OPTIONS.map((domain) => (
        <TouchableOpacity
          key={domain}
          style={styles.card}
          onPress={() => router.push(`/mentors?domain=${encodeURIComponent(domain)}` as never)}
        >
          <Text style={styles.text}>{domain}</Text>
        </TouchableOpacity>
      ))}
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
  }
});
