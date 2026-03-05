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
  const [prefs, setPrefs] = useState<Preferences>(defaultPrefs);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

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
    try {
      setChangingPassword(true);
      setError(null);
      await api.post("/api/auth/change-password", { currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
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
      "This will soft-delete your account and log you out. Continue?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await api.delete("/api/account/me");
              notify("Account deleted");
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
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0B3D2E" />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Settings</Text>

      <View style={styles.card}>
        <Text style={styles.section}>Notification Preferences</Text>
        <RowSwitch
          label="Email Notifications"
          value={prefs.notificationPreferences.email}
          onValueChange={(value) =>
            setPrefs((p) => ({ ...p, notificationPreferences: { ...p.notificationPreferences, email: value } }))
          }
        />
        <RowSwitch
          label="Push Notifications"
          value={prefs.notificationPreferences.push}
          onValueChange={(value) =>
            setPrefs((p) => ({ ...p, notificationPreferences: { ...p.notificationPreferences, push: value } }))
          }
        />
        <RowSwitch
          label="SMS Notifications"
          value={prefs.notificationPreferences.sms}
          onValueChange={(value) =>
            setPrefs((p) => ({ ...p, notificationPreferences: { ...p.notificationPreferences, sms: value } }))
          }
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.section}>Privacy Settings</Text>
        <Text style={styles.label}>Profile Visibility</Text>
        <View style={styles.row}>
          <TouchableOpacity
            style={[styles.tag, prefs.privacySettings.profileVisibility === "public" && styles.tagActive]}
            onPress={() =>
              setPrefs((p) => ({ ...p, privacySettings: { ...p.privacySettings, profileVisibility: "public" } }))
            }
          >
            <Text
              style={[styles.tagText, prefs.privacySettings.profileVisibility === "public" && styles.tagTextActive]}
            >
              Public
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tag, prefs.privacySettings.profileVisibility === "private" && styles.tagActive]}
            onPress={() =>
              setPrefs((p) => ({ ...p, privacySettings: { ...p.privacySettings, profileVisibility: "private" } }))
            }
          >
            <Text
              style={[styles.tagText, prefs.privacySettings.profileVisibility === "private" && styles.tagTextActive]}
            >
              Private
            </Text>
          </TouchableOpacity>
        </View>
        <RowSwitch
          label="Show Email on Profile"
          value={prefs.privacySettings.showEmail}
          onValueChange={(value) =>
            setPrefs((p) => ({ ...p, privacySettings: { ...p.privacySettings, showEmail: value } }))
          }
        />
        <RowSwitch
          label="Show Session History"
          value={prefs.privacySettings.showSessionHistory}
          onValueChange={(value) =>
            setPrefs((p) => ({ ...p, privacySettings: { ...p.privacySettings, showSessionHistory: value } }))
          }
        />
      </View>

      <TouchableOpacity style={styles.saveButton} onPress={savePreferences} disabled={saving}>
        <Text style={styles.saveButtonText}>{saving ? "Saving..." : "Save Preferences"}</Text>
      </TouchableOpacity>

      <View style={styles.card}>
        <Text style={styles.section}>Account</Text>
        <TouchableOpacity
          style={styles.linkRow}
          onPress={() => router.push((user?.role === "mentor" ? "/mentor-profile" : "/student-profile") as never)}
        >
          <Text style={styles.linkText}>My Profile</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.section}>Preferences</Text>
        <TouchableOpacity style={styles.linkRow} onPress={() => router.push("/notifications" as never)}>
          <Text style={styles.linkText}>Notifications</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.linkRow} onPress={() => router.push("/saved-posts" as never)}>
          <Text style={styles.linkText}>Saved Posts</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.section}>Support & Legal</Text>
        {user?.role === "student" ? (
          <TouchableOpacity style={styles.linkRow} onPress={() => router.push("/complaints" as never)}>
            <Text style={styles.linkText}>Complaints</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity style={styles.linkRow} onPress={() => router.push("/help" as never)}>
          <Text style={styles.linkText}>Help & Support</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.linkRow} onPress={() => router.push("/privacy" as never)}>
          <Text style={styles.linkText}>Privacy Policy</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.linkRow} onPress={() => router.push("/terms" as never)}>
          <Text style={styles.linkText}>Terms of Use</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.linkRow} onPress={() => router.push("/mentor-policy" as never)}>
          <Text style={styles.linkText}>Mentor Policy</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.section}>About</Text>
        <TouchableOpacity style={styles.linkRow} onPress={() => router.push("/about" as never)}>
          <Text style={styles.linkText}>About ORIN</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.section}>Change Password</Text>
        <TextInput
          style={styles.input}
          placeholder="Current password"
          secureTextEntry
          value={currentPassword}
          onChangeText={setCurrentPassword}
        />
        <TextInput
          style={styles.input}
          placeholder="New password"
          secureTextEntry
          value={newPassword}
          onChangeText={setNewPassword}
        />
        <TouchableOpacity style={styles.darkButton} onPress={changePassword} disabled={changingPassword}>
          <Text style={styles.darkButtonText}>{changingPassword ? "Updating..." : "Change Password"}</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={logout}>
        <Text style={styles.logoutButtonText}>Logout</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.deleteButton} onPress={confirmDeleteAccount}>
        <Text style={styles.deleteButtonText}>Delete Account</Text>
      </TouchableOpacity>

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </ScrollView>
  );
}

function RowSwitch({
  label,
  value,
  onValueChange
}: {
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.rowBetween}>
      <Text style={styles.label}>{label}</Text>
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
