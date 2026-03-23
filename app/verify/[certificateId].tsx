import React, { useCallback, useState } from "react";
import { ActivityIndicator, Linking, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/lib/api";

type VerifyResponse = {
  valid: boolean;
  certificateId?: string;
  name?: string;
  title?: string;
  type?: string;
  date?: string;
  issuer?: string;
  level?: string;
  domain?: string;
  qrCodeUrl?: string;
  verificationUrl?: string;
};

export default function CertificateVerifyPage() {
  const params = useLocalSearchParams<{ certificateId?: string }>();
  const certificateId = String(params.certificateId || "");
  const [data, setData] = useState<VerifyResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (refresh = false) => {
      if (!certificateId) {
        setError("Certificate ID missing.");
        setLoading(false);
        setRefreshing(false);
        return;
      }
      try {
        if (refresh) setRefreshing(true);
        else setLoading(true);
        setError(null);
        const res = await api.get<VerifyResponse>(`/api/network/certifications/verify/${encodeURIComponent(certificateId)}`);
        setData(res.data || null);
      } catch (e: any) {
        setError(e?.response?.data?.message || "Unable to verify this certificate.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [certificateId]
  );

  React.useEffect(() => {
    load();
  }, [load]);

  return (
    <ScrollView
      contentContainerStyle={styles.page}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
    >
      <View style={styles.hero}>
        <View style={[styles.badgeWrap, data?.valid ? styles.badgeValid : styles.badgeInvalid]}>
          <Ionicons name={data?.valid ? "checkmark-circle" : "close-circle"} size={26} color="#FFFFFF" />
        </View>
        <Text style={styles.title}>{data?.valid ? "Certificate Verified" : "Verification Failed"}</Text>
        <Text style={styles.subtitle}>
          {data?.valid
            ? "This certificate is issued by ORIN and matches a valid record."
            : error || "We could not find a valid ORIN certificate for this ID."}
        </Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#1F7A4C" />
      ) : data?.valid ? (
        <View style={styles.card}>
          <Row label="Certificate ID" value={data.certificateId || certificateId} />
          <Row label="Name" value={data.name || "ORIN User"} />
          <Row label="Title" value={data.title || "ORIN Certificate"} />
          <Row label="Type" value={data.type || "certificate"} />
          <Row label="Issuer" value={data.issuer || "ORIN"} />
          <Row label="Issued On" value={formatDate(data.date)} />
          <Row label="Level" value={data.level || "Verified"} />
          <Row label="Domain" value={data.domain || "ORIN"} />

          {data.verificationUrl ? (
            <TouchableOpacity style={styles.linkButton} onPress={() => Linking.openURL(data.verificationUrl || "")}>
              <Ionicons name="open-outline" size={16} color="#155EEF" />
              <Text style={styles.linkText}>Open verification link</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : (
        <View style={styles.errorCard}>
          <Text style={styles.errorTitle}>No valid certificate found</Text>
          <Text style={styles.errorText}>Check the certificate ID and try again.</Text>
        </View>
      )}
    </ScrollView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

function formatDate(value?: string) {
  if (!value) return "Unknown";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}

const styles = StyleSheet.create({
  page: {
    padding: 16,
    gap: 14,
    backgroundColor: "#F4F7FB",
    flexGrow: 1
  },
  hero: {
    borderRadius: 20,
    padding: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E4E7EC",
    alignItems: "center",
    gap: 10
  },
  badgeWrap: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center"
  },
  badgeValid: { backgroundColor: "#16A34A" },
  badgeInvalid: { backgroundColor: "#DC2626" },
  title: {
    color: "#101828",
    fontSize: 24,
    fontWeight: "800"
  },
  subtitle: {
    color: "#667085",
    textAlign: "center",
    lineHeight: 21
  },
  card: {
    borderRadius: 20,
    padding: 16,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E4E7EC",
    gap: 12
  },
  row: {
    gap: 4,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F2F4F7"
  },
  rowLabel: {
    color: "#667085",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase"
  },
  rowValue: {
    color: "#101828",
    fontSize: 16,
    fontWeight: "700"
  },
  linkButton: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12
  },
  linkText: {
    color: "#155EEF",
    fontWeight: "700"
  },
  errorCard: {
    borderRadius: 20,
    padding: 18,
    backgroundColor: "#FFF1F3",
    borderWidth: 1,
    borderColor: "#FECDD3",
    gap: 6
  },
  errorTitle: {
    color: "#B42318",
    fontSize: 18,
    fontWeight: "800"
  },
  errorText: {
    color: "#912018",
    lineHeight: 20
  }
});
