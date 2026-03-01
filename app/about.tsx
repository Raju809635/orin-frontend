import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

export default function AboutScreen() {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>About ORIN</Text>
        <Text style={styles.text}>
          ORIN is a mentorship platform connecting students and mentors for structured learning sessions,
          chat support, and guided growth.
        </Text>
        <Text style={styles.subtitle}>What you can do</Text>
        <Text style={styles.text}>- Discover mentors by domain and category</Text>
        <Text style={styles.text}>- Book sessions and track payment status</Text>
        <Text style={styles.text}>- Chat with mentors and get personalized guidance</Text>
        <Text style={styles.text}>- Build your profile like professional networking apps</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: "#F4F9F6",
    padding: 20
  },
  card: {
    backgroundColor: "#fff",
    borderColor: "#E4E7EC",
    borderWidth: 1,
    borderRadius: 14,
    padding: 16
  },
  title: { fontSize: 24, fontWeight: "800", color: "#1E2B24", marginBottom: 8 },
  subtitle: { marginTop: 12, marginBottom: 4, fontSize: 16, fontWeight: "700", color: "#1F7A4C" },
  text: { color: "#475467", lineHeight: 22, marginBottom: 4 }
});
