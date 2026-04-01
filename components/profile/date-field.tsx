import React, { useMemo, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "@/context/ThemeContext";

type DateFieldProps = {
  label?: string;
  value?: string;
  placeholder?: string;
  mode?: "date" | "year";
  onChange: (value: string) => void;
};

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function formatDateValue(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parseInitialDate(value?: string) {
  if (!value) return new Date();
  if (/^\d{4}$/.test(value)) {
    return new Date(Number(value), 0, 1);
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return new Date();
  return date;
}

function monthStartGrid(date: Date) {
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
  const dayIndex = firstDay.getDay();
  const start = new Date(firstDay);
  start.setDate(firstDay.getDate() - dayIndex);
  return start;
}

export default function DateField({
  label,
  value,
  placeholder = "Select date",
  mode = "date",
  onChange
}: DateFieldProps) {
  const { colors, isDark } = useAppTheme();
  const [visible, setVisible] = useState(false);
  const [cursor, setCursor] = useState(() => parseInitialDate(value));

  const years = useMemo(() => {
    const baseYear = cursor.getFullYear();
    return Array.from({ length: 12 }, (_, index) => baseYear - 5 + index);
  }, [cursor]);

  const dayCells = useMemo(() => {
    const start = monthStartGrid(cursor);
    return Array.from({ length: 42 }, (_, index) => {
      const next = new Date(start);
      next.setDate(start.getDate() + index);
      return next;
    });
  }, [cursor]);

  function openPicker() {
    setCursor(parseInitialDate(value));
    setVisible(true);
  }

  function applyDate(date: Date) {
    onChange(mode === "year" ? String(date.getFullYear()) : formatDateValue(date));
    setVisible(false);
  }

  function shiftMonth(offset: number) {
    setCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() + offset, 1));
  }

  function shiftYearPage(offset: number) {
    setCursor((prev) => new Date(prev.getFullYear() + offset * 12, prev.getMonth(), 1));
  }

  const selectedDate = parseInitialDate(value);
  const selectedDateKey = mode === "date" ? formatDateValue(selectedDate) : String(selectedDate.getFullYear());

  return (
    <View style={styles.wrap}>
      {label ? <Text style={[styles.label, { color: colors.text }]}>{label}</Text> : null}
      <TouchableOpacity
        activeOpacity={0.9}
        style={[styles.field, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}
        onPress={openPicker}
      >
        <Text style={[styles.fieldText, { color: value ? colors.text : colors.textMuted }]}>
          {value || placeholder}
        </Text>
        <Ionicons name="calendar-outline" size={18} color={colors.textMuted} />
      </TouchableOpacity>

      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
        <Pressable style={styles.backdrop} onPress={() => setVisible(false)}>
          <Pressable
            style={[
              styles.modalCard,
              { backgroundColor: colors.surface, borderColor: colors.border, shadowColor: isDark ? "#000" : "#101828" }
            ]}
            onPress={(event) => event.stopPropagation()}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {mode === "year" ? "Choose Year" : "Choose Date"}
              </Text>
              <TouchableOpacity onPress={() => setVisible(false)}>
                <Ionicons name="close" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {mode === "year" ? (
              <>
                <View style={styles.navRow}>
                  <TouchableOpacity style={[styles.navBtn, { borderColor: colors.border }]} onPress={() => shiftYearPage(-1)}>
                    <Ionicons name="chevron-back" size={16} color={colors.text} />
                  </TouchableOpacity>
                  <Text style={[styles.navTitle, { color: colors.text }]}>{years[0]} - {years[years.length - 1]}</Text>
                  <TouchableOpacity style={[styles.navBtn, { borderColor: colors.border }]} onPress={() => shiftYearPage(1)}>
                    <Ionicons name="chevron-forward" size={16} color={colors.text} />
                  </TouchableOpacity>
                </View>
                <View style={styles.yearGrid}>
                  {years.map((year) => {
                    const active = selectedDateKey === String(year);
                    return (
                      <TouchableOpacity
                        key={year}
                        style={[
                          styles.yearChip,
                          { borderColor: colors.border, backgroundColor: colors.surfaceAlt },
                          active && { borderColor: colors.accent, backgroundColor: colors.accentSoft }
                        ]}
                        onPress={() => applyDate(new Date(year, 0, 1))}
                      >
                        <Text style={[styles.yearChipText, { color: active ? colors.accent : colors.text }]}>{year}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            ) : (
              <>
                <View style={styles.navRow}>
                  <TouchableOpacity style={[styles.navBtn, { borderColor: colors.border }]} onPress={() => shiftMonth(-1)}>
                    <Ionicons name="chevron-back" size={16} color={colors.text} />
                  </TouchableOpacity>
                  <Text style={[styles.navTitle, { color: colors.text }]}>
                    {cursor.toLocaleString("en-IN", { month: "long", year: "numeric" })}
                  </Text>
                  <TouchableOpacity style={[styles.navBtn, { borderColor: colors.border }]} onPress={() => shiftMonth(1)}>
                    <Ionicons name="chevron-forward" size={16} color={colors.text} />
                  </TouchableOpacity>
                </View>
                <View style={styles.weekRow}>
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                    <Text key={day} style={[styles.weekDay, { color: colors.textMuted }]}>{day}</Text>
                  ))}
                </View>
                <View style={styles.dayGrid}>
                  {dayCells.map((date, index) => {
                    const inMonth = date.getMonth() === cursor.getMonth();
                    const dateKey = formatDateValue(date);
                    const active = selectedDateKey === dateKey;
                    return (
                      <TouchableOpacity
                        key={`${dateKey}-${index}`}
                        style={[
                          styles.dayCell,
                          { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
                          active && { backgroundColor: colors.accentSoft, borderColor: colors.accent }
                        ]}
                        onPress={() => applyDate(date)}
                      >
                        <Text
                          style={[
                            styles.dayText,
                            { color: inMonth ? colors.text : colors.textMuted },
                            active && { color: colors.accent }
                          ]}
                        >
                          {date.getDate()}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 10 },
  label: { marginTop: 10, marginBottom: 6, fontWeight: "600" },
  field: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  fieldText: { fontSize: 15, fontWeight: "500" },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(16,24,40,0.52)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20
  },
  modalCard: {
    width: "100%",
    maxWidth: 380,
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    shadowOpacity: 0.16,
    shadowRadius: 18,
    elevation: 8
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14
  },
  modalTitle: { fontSize: 18, fontWeight: "800" },
  navRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12
  },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  navTitle: { fontSize: 15, fontWeight: "700" },
  weekRow: { flexDirection: "row", marginBottom: 8 },
  weekDay: { flex: 1, textAlign: "center", fontSize: 12, fontWeight: "700" },
  dayGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  dayCell: {
    width: "12.38%",
    aspectRatio: 1,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  dayText: { fontSize: 13, fontWeight: "700" },
  yearGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  yearChip: {
    width: "31%",
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 12,
    alignItems: "center"
  },
  yearChipText: { fontSize: 14, fontWeight: "700" }
});
