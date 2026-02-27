import React from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { ORIN_CATEGORIES, PRIMARY_CATEGORIES } from "@/constants/categories";

export default function DomainScreen() {
  const router = useRouter();
  const [primary, setPrimary] = React.useState(PRIMARY_CATEGORIES[0]);
  const [sub, setSub] = React.useState(ORIN_CATEGORIES[PRIMARY_CATEGORIES[0]][0]);
  const [spec, setSpec] = React.useState("");

  const subCategories = ORIN_CATEGORIES[primary] || [];

  React.useEffect(() => {
    if (!subCategories.includes(sub)) {
      setSub(subCategories[0] || "");
    }
  }, [primary, sub, subCategories]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.heading}>Choose Your Domain</Text>
      <Text style={styles.subheading}>Filter mentors by category, subcategory and specialization.</Text>

      <Text style={styles.label}>Primary Category</Text>
      <View style={styles.chipWrap}>
        {PRIMARY_CATEGORIES.map((item) => (
          <TouchableOpacity
            key={item}
            style={[styles.chip, item === primary && styles.chipActive]}
            onPress={() => setPrimary(item)}
          >
            <Text style={[styles.chipText, item === primary && styles.chipTextActive]}>{item}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Subcategory</Text>
      <View style={styles.chipWrap}>
        {subCategories.map((item) => (
          <TouchableOpacity key={item} style={[styles.chip, item === sub && styles.chipActive]} onPress={() => setSub(item)}>
            <Text style={[styles.chipText, item === sub && styles.chipTextActive]}>{item}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Specialization (optional)</Text>
      <View style={styles.chipWrap}>
        <TouchableOpacity style={[styles.chip, !spec && styles.chipActive]} onPress={() => setSpec("")}>
          <Text style={[styles.chipText, !spec && styles.chipTextActive]}>Any</Text>
        </TouchableOpacity>
        {subCategories.map((item) => (
          <TouchableOpacity
            key={`spec-${item}`}
            style={[styles.chip, item === spec && styles.chipActive]}
            onPress={() => setSpec(item)}
          >
            <Text style={[styles.chipText, item === spec && styles.chipTextActive]}>{item}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        style={styles.searchButton}
        onPress={() =>
          router.push(
            `/mentors?primary=${encodeURIComponent(primary)}&sub=${encodeURIComponent(sub)}&spec=${encodeURIComponent(spec)}` as never
          )
        }
      >
        <Text style={styles.searchText}>Find Mentors</Text>
      </TouchableOpacity>
    </ScrollView>
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
  label: {
    color: "#344054",
    fontWeight: "700",
    marginBottom: 12,
    marginTop: 4
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 10
  },
  chip: {
    borderWidth: 1,
    borderColor: "#D0D5DD",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#fff"
  },
  chipActive: {
    backgroundColor: "#E8F5EE",
    borderColor: "#0B3D2E"
  },
  chipText: {
    color: "#344054",
    fontWeight: "600",
    fontSize: 13
  },
  chipTextActive: {
    color: "#0B3D2E"
  },
  searchButton: {
    marginTop: 12,
    backgroundColor: "#0B3D2E",
    borderRadius: 12,
    alignItems: "center",
    paddingVertical: 13
  },
  searchText: {
    color: "#fff",
    fontWeight: "600"
  }
});
