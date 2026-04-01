import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { useRouter } from "expo-router";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useAppTheme } from "@/context/ThemeContext";
import { notify } from "@/utils/notify";

type Preferences = {
  notificationPreferences: {
    email: boolean;
    push: boolean;
    sms: boolean;
  };
  privacySettings: {
    profileVisibility: "public" | "private";
    showEmail: boolean;
    showSessionHistory: boolean;
  };
};

const defaultPrefs: Preferences = {
  notificationPreferences: { email: true, push: true, sms: false },
  privacySettings: { profileVisibility: "public", showEmail: false, showSessionHistory: true }
};

export default function SettingsScreen() {
  const router = useRouter();
  const { logout, user } = useAuth();
  const { mode, isDark, colors, setMode } = useAppTheme();
  const [prefs, setPrefs] = useState<Preferences>(defaultPrefs);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data } = await api.get<Preferences>("/api/settings/preferences");
        if (mounted) setPrefs(data);
      } catch (e: any) {
        if (mounted) setError(e?.response?.data?.message || "Failed to load settings");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  async function savePreferences() {
    try {
      setSaving(true);
      setError(null);
      await api.patch("/api/settings/preferences", prefs);
      notify("Preferences updated");
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to update preferences");
    } finally {
      setSaving(false);
    }
  }

  async function changePassword() {
    if (!currentPassword || !newPassword || !confirmNewPassword) {
      setError("Please fill current password, new password, and confirm password.");
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setError("New password and confirm password do not match.");
      return;
    }

    if (currentPassword === newPassword) {
      setError("New password must be different from your current password.");
      return;
    }

    try {
      setChangingPassword(true);
      setError(null);
      await api.post("/api/auth/change-password", { currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
      notify("Password changed. Please login again.");
      await logout();
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to change password");
    } finally {
      setChangingPassword(false);
    }
  }

  function confirmDeleteAccount() {
    Alert.alert(
      "Delete Account",
      "This will delete your account, log you out, and release your email so you can register again later. Continue?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await api.delete("/api/account/me");
              notify("Account deleted. You can sign up again later with the same email.");
              await logout();
            } catch (e: any) {
              setError(e?.response?.data?.message || "Failed to delete account");
            }
          }
        }
      ]
    );
  }

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.text }]}>Settings</Text>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.section, { color: colors.text }]}>Display</Text>
        <RowSwitch
          label="Dark Mode"
          value={isDark}
          labelColor={colors.text}
          onValueChange={(value) => setMode(value ? "dark" : "light")}
        />
        <Text style={[styles.helperText, { color: colors.textMuted }]}>
          Current theme: {mode === "dark" ? "Dark" : "Light"}
        </Text>
      </View>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.section, { color: colors.text }]}>Notification Preferences</Text>
        <RowSwitch
          label="Email Notifications"
          labelColor={colors.text}
          value={prefs.notificationPreferences.email}
          onValueChange={(value) =>
            setPrefs((p) => ({ ...p, notificationPreferences: { ...p.notificationPreferences, email: value } }))
          }
        />
        <RowSwitch
          label="Push Notifications"
          labelColor={colors.text}
          value={prefs.notificationPreferences.push}
          onValueChange={(value) =>
            setPrefs((p) => ({ ...p, notificationPreferences: { ...p.notificationPreferences, push: value } }))
          }
        />
        <RowSwitch
          label="SMS Notifications"
          labelColor={colors.text}
          value={prefs.notificationPreferences.sms}
          onValueChange={(value) =>
            setPrefs((p) => ({ ...p, notificationPreferences: { ...p.notificationPreferences, sms: value } }))
          }
        />
      </View>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.section, { color: colors.text }]}>Privacy Settings</Text>
        <Text style={[styles.label, { color: colors.text }]}>Profile Visibility</Text>
        <View style={styles.row}>
          <TouchableOpacity
            style={[styles.tag, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }, prefs.privacySettings.profileVisibility === "public" && [styles.tagActive, { borderColor: colors.accent, backgroundColor: colors.accentSoft }]]}
            onPress={() =>
              setPrefs((p) => ({ ...p, privacySettings: { ...p.privacySettings, profileVisibility: "public" } }))
            }
          >
            <Text
              style={[styles.tagText, { color: colors.text }, prefs.privacySettings.profileVisibility === "public" && [styles.tagTextActive, { color: colors.accent }]]}
            >
              Public
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tag, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }, prefs.privacySettings.profileVisibility === "private" && [styles.tagActive, { borderColor: colors.accent, backgroundColor: colors.accentSoft }]]}
            onPress={() =>
              setPrefs((p) => ({ ...p, privacySettings: { ...p.privacySettings, profileVisibility: "private" } }))
            }
          >
            <Text
              style={[styles.tagText, { color: colors.text }, prefs.privacySettings.profileVisibility === "private" && [styles.tagTextActive, { color: colors.accent }]]}
            >
              Private
            </Text>
          </TouchableOpacity>
        </View>
        <RowSwitch
          label="Show Email on Profile"
          labelColor={colors.text}
          value={prefs.privacySettings.showEmail}
          onValueChange={(value) =>
            setPrefs((p) => ({ ...p, privacySettings: { ...p.privacySettings, showEmail: value } }))
          }
        />
        <RowSwitch
          label="Show Session History"
          labelColor={colors.text}
          value={prefs.privacySettings.showSessionHistory}
          onValueChange={(value) =>
            setPrefs((p) => ({ ...p, privacySettings: { ...p.privacySettings, showSessionHistory: value } }))
          }
        />
      </View>

      <TouchableOpacity style={[styles.saveButton, { backgroundColor: colors.accent }]} onPress={savePreferences} disabled={saving}>
        <Text style={[styles.saveButtonText, { color: colors.accentText }]}>{saving ? "Saving..." : "Save Preferences"}</Text>
      </TouchableOpacity>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.section, { color: colors.text }]}>Account</Text>
        <TouchableOpacity
          style={[styles.linkRow, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}
          onPress={() => router.push((user?.role === "mentor" ? "/mentor-profile" : "/student-profile") as never)}
        >
          <Text style={[styles.linkText, { color: colors.text }]}>My Profile</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.section, { color: colors.text }]}>Preferences</Text>
        <TouchableOpacity style={[styles.linkRow, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }]} onPress={() => router.push("/notifications" as never)}>
          <Text style={[styles.linkText, { color: colors.text }]}>Notifications</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.linkRow, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }]} onPress={() => router.push("/saved-ai" as never)}>
          <Text style={[styles.linkText, { color: colors.text }]}>Saved AI</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.linkRow, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }]} onPress={() => router.push("/saved-posts" as never)}>
          <Text style={[styles.linkText, { color: colors.text }]}>Saved Posts</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.section, { color: colors.text }]}>Support & Legal</Text>
        {user?.role === "student" ? (
          <TouchableOpacity style={[styles.linkRow, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }]} onPress={() => router.push("/complaints" as never)}>
            <Text style={[styles.linkText, { color: colors.text }]}>Complaints</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity style={[styles.linkRow, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }]} onPress={() => router.push("/help" as never)}>
          <Text style={[styles.linkText, { color: colors.text }]}>Help & Support</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.linkRow, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }]} onPress={() => router.push("/privacy" as never)}>
          <Text style={[styles.linkText, { color: colors.text }]}>Privacy Policy</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.linkRow, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }]} onPress={() => router.push("/terms" as never)}>
          <Text style={[styles.linkText, { color: colors.text }]}>Terms of Use</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.linkRow, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }]} onPress={() => router.push("/mentor-policy" as never)}>
          <Text style={[styles.linkText, { color: colors.text }]}>Mentor Policy</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.section, { color: colors.text }]}>About</Text>
        <TouchableOpacity style={[styles.linkRow, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }]} onPress={() => router.push("/about" as never)}>
          <Text style={[styles.linkText, { color: colors.text }]}>About ORIN</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.section, { color: colors.text }]}>Change Password</Text>
        <TextInput
          style={[styles.input, { borderColor: colors.border, backgroundColor: colors.surfaceAlt, color: colors.text }]}
          placeholder="Current password"
          placeholderTextColor={colors.textMuted}
          secureTextEntry
          value={currentPassword}
          onChangeText={setCurrentPassword}
        />
        <TextInput
          style={[styles.input, { borderColor: colors.border, backgroundColor: colors.surfaceAlt, color: colors.text }]}
          placeholder="New password"
          placeholderTextColor={colors.textMuted}
          secureTextEntry
          value={newPassword}
          onChangeText={setNewPassword}
        />
        <TextInput
          style={[styles.input, { borderColor: colors.border, backgroundColor: colors.surfaceAlt, color: colors.text }]}
          placeholder="Confirm new password"
          placeholderTextColor={colors.textMuted}
          secureTextEntry
          value={confirmNewPassword}
          onChangeText={setConfirmNewPassword}
        />
        <TouchableOpacity style={[styles.darkButton, { backgroundColor: colors.text }]} onPress={changePassword} disabled={changingPassword}>
          <Text style={[styles.darkButtonText, { color: colors.surface }]}>{changingPassword ? "Updating..." : "Change Password"}</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={[styles.logoutButton, { backgroundColor: colors.surfaceAlt }]} onPress={logout}>
        <Text style={[styles.logoutButtonText, { color: colors.text }]}>Logout</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.deleteButton, { backgroundColor: isDark ? "#3A1F1F" : "#FEE4E2" }]} onPress={confirmDeleteAccount}>
        <Text style={styles.deleteButtonText}>Delete Account</Text>
      </TouchableOpacity>

      {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
    </ScrollView>
  );
}

function RowSwitch({
  label,
  value,
  labelColor,
  onValueChange
}: {
  label: string;
  value: boolean;
  labelColor?: string;
  onValueChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.rowBetween}>
      <Text style={[styles.label, labelColor ? { color: labelColor } : null]}>{label}</Text>
      <Switch value={value} onValueChange={onValueChange} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: "#F4F9F6", padding: 20 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#F4F9F6" },
  title: { fontSize: 28, fontWeight: "700", color: "#0B3D2E", marginBottom: 12 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E4E7EC",
    padding: 14,
    marginBottom: 12
  },
  section: { fontSize: 18, fontWeight: "700", marginBottom: 10, color: "#1E2B24" },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  row: { flexDirection: "row", gap: 8, marginBottom: 12 },
  label: { color: "#344054", fontWeight: "600" },
  tag: {
    borderColor: "#D0D5DD",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  tagActive: { borderColor: "#0B3D2E", backgroundColor: "#E8F5EE" },
  tagText: { color: "#344054", fontWeight: "600" },
  tagTextActive: { color: "#0B3D2E" },
  input: {
    borderColor: "#D0D5DD",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10
  },
  saveButton: {
    backgroundColor: "#1F7A4C",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    marginBottom: 12
  },
  saveButtonText: { color: "#fff", fontWeight: "700" },
  darkButton: { backgroundColor: "#0B3D2E", borderRadius: 12, paddingVertical: 12, alignItems: "center" },
  darkButtonText: { color: "#fff", fontWeight: "700" },
  logoutButton: { backgroundColor: "#EEF4F2", borderRadius: 12, paddingVertical: 12, alignItems: "center", marginBottom: 10 },
  logoutButtonText: { color: "#1E2B24", fontWeight: "700" },
  deleteButton: { backgroundColor: "#FEE4E2", borderRadius: 12, paddingVertical: 12, alignItems: "center" },
  deleteButtonText: { color: "#B42318", fontWeight: "700" },
  error: { marginTop: 10, color: "#B42318", textAlign: "center" },
  helperText: { marginTop: -2, marginBottom: 2, fontSize: 12, fontWeight: "600" },
  linkRow: {
    borderWidth: 1,
    borderColor: "#E4E7EC",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
    backgroundColor: "#F9FAFB"
  },
  linkText: { color: "#1E2B24", fontWeight: "600" }
});
