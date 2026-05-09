import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "@/context/ThemeContext";

export type HighSchoolDrawerItem = {
  key: string;
  label: string;
  meta: string;
  icon: keyof typeof Ionicons.glyphMap;
  badge?: string;
  onPress: () => void;
};

export function HighSchoolSideDrawer({
  visible,
  title = "High School",
  subtitle = "Roadmaps, resources, challenges, programs and progress",
  activeKey,
  items,
  onClose
}: {
  visible: boolean;
  title?: string;
  subtitle?: string;
  activeKey?: string;
  items: HighSchoolDrawerItem[];
  onClose: () => void;
}) {
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.panel, { paddingTop: Math.max(insets.top, 16), backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
              <Text style={[styles.subtitle, { color: colors.textMuted }]}>{subtitle}</Text>
            </View>
            <TouchableOpacity style={[styles.closeBtn, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }]} onPress={onClose}>
              <Ionicons name="close" size={18} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.list}>
            {items.map((item) => {
              const active = item.key === activeKey;
              return (
                <TouchableOpacity
                  key={item.key}
                  activeOpacity={0.88}
                  style={[
                    styles.item,
                    {
                      borderColor: active ? "#16A34A" : colors.border,
                      backgroundColor: active ? (isDark ? "rgba(22,163,74,0.16)" : "#ECFDF3") : colors.surfaceAlt
                    }
                  ]}
                  onPress={() => {
                    onClose();
                    item.onPress();
                  }}
                >
                  <View style={[styles.iconBox, { backgroundColor: active ? "#DCFCE7" : colors.surface, borderColor: colors.border }]}>
                    <Ionicons name={item.icon} size={18} color={active ? "#15803D" : colors.textMuted} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.itemTitle, { color: active ? "#15803D" : colors.text }]} numberOfLines={1}>
                      {item.label}
                    </Text>
                    <Text style={[styles.itemMeta, { color: colors.textMuted }]} numberOfLines={2}>
                      {item.meta}
                    </Text>
                  </View>
                  {item.badge ? (
                    <View style={[styles.badge, { backgroundColor: active ? "#16A34A" : colors.surface, borderColor: colors.border }]}>
                      <Text style={[styles.badgeText, { color: active ? "#FFFFFF" : colors.textMuted }]}>{item.badge}</Text>
                    </View>
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, flexDirection: "row" },
  panel: { width: "88%", maxWidth: 420, height: "100%", borderRightWidth: 1, paddingHorizontal: 14, paddingBottom: 18 },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.24)" },
  header: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 14 },
  title: { fontSize: 20, fontWeight: "900" },
  subtitle: { marginTop: 3, fontSize: 12, lineHeight: 18, fontWeight: "700" },
  closeBtn: { width: 38, height: 38, borderRadius: 13, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  list: { gap: 10, paddingBottom: 18 },
  item: { borderWidth: 1, borderRadius: 18, padding: 12, flexDirection: "row", gap: 10, alignItems: "center" },
  iconBox: { width: 38, height: 38, borderRadius: 13, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  itemTitle: { fontSize: 14, fontWeight: "900" },
  itemMeta: { marginTop: 3, fontSize: 12, lineHeight: 17, fontWeight: "700" },
  badge: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 5 },
  badgeText: { fontSize: 10, fontWeight: "900", textTransform: "uppercase" }
});
