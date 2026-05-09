import React from "react";
import { ActivityIndicator, Alert, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useIAP, type ProductSubscription, type Purchase } from "expo-iap";
import { useAppTheme } from "@/context/ThemeContext";
import { getMySubscription, getSubscriptionPlans, recordGooglePlayPurchase, SubscriptionPlan, SubscriptionStatus } from "@/lib/subscriptions";

const PREMIUM_FEATURES = [
  "Subject Gap Analyzer full reports",
  "Exam Strategy Builder and Study Roadmap",
  "Higher Ask ORIN daily AI limit",
  "Premium quiz battles and Summer Bridge challenges",
  "Certificates, badges, and premium resources"
];

export default function PremiumScreen() {
  const router = useRouter();
  const { colors, isDark } = useAppTheme();
  const [plans, setPlans] = React.useState<SubscriptionPlan[]>([]);
  const [status, setStatus] = React.useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [purchaseLoading, setPurchaseLoading] = React.useState("");
  const [error, setError] = React.useState("");
  const selectedPlanRef = React.useRef<SubscriptionPlan | null>(null);
  const productId = plans[0]?.productId || "orin_premium";

  const {
    connected,
    subscriptions,
    fetchProducts,
    requestPurchase,
    finishTransaction,
    getAvailablePurchases,
    availablePurchases,
    reconnect
  } = useIAP({
    onPurchaseSuccess: (purchase) => {
      void handlePurchaseSuccess(purchase);
    },
    onPurchaseError: (purchaseError) => {
      setPurchaseLoading("");
      const message = purchaseError?.message || "Purchase could not be completed.";
      if (!/cancel/i.test(message)) {
        Alert.alert("Purchase failed", message);
      }
    },
    onError: (iapError) => {
      setPurchaseLoading("");
      setError(iapError?.message || "Google Play Billing is unavailable right now.");
    }
  });

  const load = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [planData, statusData] = await Promise.all([getSubscriptionPlans(), getMySubscription()]);
      setPlans(planData.plans || []);
      setStatus(statusData);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || "Unable to load premium details");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  React.useEffect(() => {
    if (!connected || !productId) return;
    fetchProducts({ skus: [productId], type: "subs" }).catch((err) => {
      setError(err?.message || "Could not load Google Play subscription offers.");
    });
  }, [connected, fetchProducts, productId]);

  React.useEffect(() => {
    if (!availablePurchases.length || !plans.length) return;
    const purchase = availablePurchases.find((item) => item.productId === productId && item.purchaseToken);
    if (purchase) {
      void handlePurchaseSuccess(purchase, { silent: true });
    }
    // Restore runs from the latest store callback state; including the handler recreates the effect around purchase events.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availablePurchases, plans.length, productId]);

  function findStoreSubscription() {
    return subscriptions.find((item) => item.id === productId || item.productId === productId) as ProductSubscription | undefined;
  }

  function findOfferToken(plan: SubscriptionPlan) {
    const subscription = findStoreSubscription();
    const offers = subscription?.subscriptionOffers || [];
    const legacyOffers = (subscription?.platform === "android" ? subscription.subscriptionOfferDetailsAndroid : []) || [];
    const modernOffer = offers.find((offer) => offer.basePlanIdAndroid === plan.basePlanId || offer.basePlanIdAndroid === plan.id);
    if (modernOffer?.offerTokenAndroid) return modernOffer.offerTokenAndroid;
    const legacyOffer = legacyOffers.find((offer) => offer.basePlanId === plan.basePlanId || offer.basePlanId === plan.id);
    return legacyOffer?.offerToken || "";
  }

  async function handlePurchaseSuccess(purchase: Purchase, options?: { silent?: boolean }) {
    const plan = selectedPlanRef.current || plans.find((item) => item.id === purchase.currentPlanId || item.basePlanId === purchase.currentPlanId) || plans[0];
    const purchaseToken = String(purchase.purchaseToken || "").trim();
    if (!purchaseToken || !plan) {
      setPurchaseLoading("");
      if (!options?.silent) Alert.alert("Purchase pending", "Google Play did not return a purchase token yet. Please try restore purchases in a moment.");
      return;
    }

    try {
      await recordGooglePlayPurchase({
        productId: purchase.productId || plan.productId,
        basePlanId: String(purchase.currentPlanId || plan.basePlanId || plan.id),
        planId: plan.id,
        purchaseToken,
        orderId: purchase.transactionId || "",
        packageName: (purchase as any)?.packageNameAndroid || "com.orin.app",
        transactionDate: purchase.transactionDate ? String(purchase.transactionDate) : "",
        acknowledged: Boolean((purchase as any)?.isAcknowledgedAndroid)
      });
      await finishTransaction({ purchase, isConsumable: false });
      const nextStatus = await getMySubscription();
      setStatus(nextStatus);
      if (!options?.silent) {
        Alert.alert("Purchase received", "Your Google Play purchase was captured. Premium unlocks after server verification.");
      }
    } catch (err: any) {
      Alert.alert("Verification failed", err?.response?.data?.message || err?.message || "Could not send purchase to ORIN.");
    } finally {
      setPurchaseLoading("");
    }
  }

  async function startPurchase(plan: SubscriptionPlan) {
    if (Platform.OS !== "android") {
      Alert.alert("Google Play Billing", "Premium subscriptions are sold through Google Play Billing on Android.");
      return;
    }

    setPurchaseLoading(plan.id);
    selectedPlanRef.current = plan;
    try {
      if (!connected) {
        const didReconnect = await reconnect();
        if (!didReconnect) throw new Error("Google Play Billing is not connected. Install a development/Play build and try again.");
      }

      if (!subscriptions.length) {
        await fetchProducts({ skus: [plan.productId], type: "subs" });
      }

      const offerToken = findOfferToken(plan);
      if (!offerToken) {
        throw new Error(`No Google Play offer token found for ${plan.basePlanId}. Confirm the base plan is active in Play Console.`);
      }

      await requestPurchase({
        type: "subs",
        request: {
          google: {
            skus: [plan.productId],
            subscriptionOffers: [{ sku: plan.productId, offerToken }]
          }
        }
      });
    } catch (err: any) {
      setPurchaseLoading("");
      Alert.alert("Purchase unavailable", err?.message || "Could not open Google Play Billing.");
    }
  }

  async function restorePurchases() {
    if (Platform.OS !== "android") {
      Alert.alert("Restore purchases", "Restore is available in the Android Play Store build.");
      return;
    }
    setPurchaseLoading("restore");
    try {
      if (!connected) await reconnect();
      await getAvailablePurchases();
    } catch (err: any) {
      setPurchaseLoading("");
      Alert.alert("Restore failed", err?.message || "Could not restore Google Play purchases.");
    }
  }

  const entitlement = status?.entitlement;
  const isPremium = Boolean(entitlement?.isPremium);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={styles.container}>
      <View style={styles.headerRow}>
        <TouchableOpacity style={[styles.iconButton, { borderColor: colors.border, backgroundColor: colors.surface }]} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>ORIN Premium</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={[styles.hero, { backgroundColor: isDark ? "#14251D" : "#EAFBF1", borderColor: colors.border }]}>
        <View style={styles.heroText}>
          <Text style={[styles.eyebrow, { color: colors.accent }]}>Mission Vishnu</Text>
          <Text style={[styles.title, { color: colors.text }]}>Full academic year support</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            Premium unlocks the ORIN AI study suite, community growth tools, certificates, and higher daily AI support.
          </Text>
        </View>
        <View style={[styles.sparkBadge, { backgroundColor: colors.accent }]}>
          <Ionicons name="sparkles" size={22} color={colors.accentText} />
        </View>
      </View>

      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator color={colors.accent} />
          <Text style={[styles.stateText, { color: colors.textMuted }]}>Loading premium plans...</Text>
        </View>
      ) : null}

      {!loading && error ? (
        <View style={[styles.notice, { borderColor: colors.border, backgroundColor: colors.surface }]}>
          <Text style={[styles.noticeTitle, { color: colors.text }]}>Could not load plans</Text>
          <Text style={[styles.noticeText, { color: colors.textMuted }]}>{error}</Text>
          <TouchableOpacity style={[styles.primaryButton, { backgroundColor: colors.accent }]} onPress={load}>
            <Text style={[styles.primaryButtonText, { color: colors.accentText }]}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {!loading && !error ? (
        <>
          <View style={[styles.statusCard, { borderColor: colors.border, backgroundColor: colors.surface }]}>
            <Ionicons name={isPremium ? "shield-checkmark" : "lock-open"} size={22} color={isPremium ? "#16A34A" : colors.textMuted} />
            <View style={styles.statusTextWrap}>
              <Text style={[styles.statusTitle, { color: colors.text }]}>{isPremium ? "Premium active" : "Free plan"}</Text>
              <Text style={[styles.statusSub, { color: colors.textMuted }]}>
                {isPremium
                  ? `Plan ${entitlement?.planId || "premium"} unlocks ${entitlement?.aiChatDailyLimit || 120} AI chats per day.`
                  : `Free AI limit is ${entitlement?.aiChatDailyLimit || 40} chats per day. Upgrade for more AI and community tools.`}
              </Text>
            </View>
          </View>

          <View style={styles.planStack}>
            {plans.map((plan) => (
              <View
                key={plan.id}
                style={[
                  styles.planCard,
                  {
                    borderColor: plan.recommended ? colors.accent : colors.border,
                    backgroundColor: colors.surface
                  }
                ]}
              >
                <View style={styles.planHead}>
                  <View style={styles.planTitleWrap}>
                    <Text style={[styles.planTitle, { color: colors.text }]}>{plan.title}</Text>
                    <Text style={[styles.planPrice, { color: colors.accent }]}>{plan.priceLabel}</Text>
                  </View>
                  {plan.badge ? (
                    <View style={[styles.badge, { backgroundColor: colors.accentSoft }]}>
                      <Text style={[styles.badgeText, { color: colors.accent }]}>{plan.badge}</Text>
                    </View>
                  ) : null}
                </View>
                {plan.features.map((feature) => (
                  <View key={feature} style={styles.featureRow}>
                    <Ionicons name="checkmark-circle" size={17} color={colors.accent} />
                    <Text style={[styles.featureText, { color: colors.text }]}>{feature}</Text>
                  </View>
                ))}
                <TouchableOpacity style={[styles.primaryButton, { backgroundColor: colors.accent }]} onPress={() => startPurchase(plan)}>
                  {purchaseLoading === plan.id ? (
                    <ActivityIndicator color={colors.accentText} />
                  ) : (
                    <Text style={[styles.primaryButtonText, { color: colors.accentText }]}>
                      {plan.recommended ? "Choose annual plan" : "Choose monthly plan"}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            ))}
          </View>

          <TouchableOpacity style={[styles.restoreButton, { borderColor: colors.border, backgroundColor: colors.surface }]} onPress={restorePurchases}>
            {purchaseLoading === "restore" ? (
              <ActivityIndicator color={colors.accent} />
            ) : (
              <>
                <Ionicons name="refresh" size={16} color={colors.accent} />
                <Text style={[styles.restoreButtonText, { color: colors.accent }]}>Restore Google Play purchase</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={[styles.featureCard, { borderColor: colors.border, backgroundColor: colors.surface }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Premium unlocks</Text>
            {PREMIUM_FEATURES.map((feature) => (
              <View key={feature} style={styles.featureRow}>
                <Ionicons name="star" size={15} color="#F59E0B" />
                <Text style={[styles.featureText, { color: colors.text }]}>{feature}</Text>
              </View>
            ))}
          </View>

          <Text style={[styles.termsText, { color: colors.textMuted }]}>
            Subscriptions renew through Google Play. You can manage or cancel anytime in your Google Play account. Prices shown in ORIN must match the Google Play purchase sheet.
          </Text>
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 32, gap: 14 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  iconButton: { width: 40, height: 40, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 18, fontWeight: "900" },
  headerSpacer: { width: 40 },
  hero: { borderWidth: 1, borderRadius: 18, padding: 16, flexDirection: "row", gap: 12, alignItems: "center" },
  heroText: { flex: 1, gap: 5 },
  eyebrow: { fontSize: 12, fontWeight: "900", textTransform: "uppercase" },
  title: { fontSize: 27, lineHeight: 33, fontWeight: "900" },
  subtitle: { fontSize: 14, lineHeight: 21, fontWeight: "600" },
  sparkBadge: { width: 48, height: 48, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  centerState: { alignItems: "center", paddingVertical: 28, gap: 10 },
  stateText: { fontWeight: "700" },
  notice: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 8 },
  noticeTitle: { fontSize: 16, fontWeight: "900" },
  noticeText: { fontSize: 13, lineHeight: 19, fontWeight: "600" },
  statusCard: { borderWidth: 1, borderRadius: 14, padding: 14, flexDirection: "row", gap: 10 },
  statusTextWrap: { flex: 1, gap: 3 },
  statusTitle: { fontSize: 16, fontWeight: "900" },
  statusSub: { fontSize: 13, lineHeight: 19, fontWeight: "600" },
  planStack: { gap: 12 },
  planCard: { borderWidth: 1.5, borderRadius: 16, padding: 14, gap: 10 },
  planHead: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 },
  planTitleWrap: { flex: 1, gap: 4 },
  planTitle: { fontSize: 17, fontWeight: "900" },
  planPrice: { fontSize: 24, fontWeight: "900" },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  badgeText: { fontSize: 12, fontWeight: "900" },
  featureRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  featureText: { flex: 1, fontSize: 13, lineHeight: 19, fontWeight: "700" },
  primaryButton: { borderRadius: 12, paddingVertical: 12, alignItems: "center", justifyContent: "center", marginTop: 4 },
  primaryButtonText: { fontSize: 14, fontWeight: "900" },
  restoreButton: { borderRadius: 12, borderWidth: 1, paddingVertical: 12, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 },
  restoreButtonText: { fontSize: 14, fontWeight: "900" },
  featureCard: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 10 },
  sectionTitle: { fontSize: 16, fontWeight: "900" },
  termsText: { fontSize: 12, lineHeight: 18, fontWeight: "600", textAlign: "center" }
});
