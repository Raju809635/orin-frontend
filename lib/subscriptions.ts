import { api } from "@/lib/api";

export type SubscriptionPlan = {
  id: "monthly_49" | "annual_499";
  productId: string;
  basePlanId: string;
  title: string;
  priceLabel: string;
  billingPeriod: string;
  recommended?: boolean;
  badge?: string;
  features: string[];
};

export type SubscriptionEntitlement = {
  isPremium: boolean;
  planId: string;
  productId: string;
  basePlanId: string;
  source: string;
  expiresAt: string | null;
  aiChatDailyLimit: number;
};

export type SubscriptionStatus = {
  entitlement: SubscriptionEntitlement;
  latestSubscription?: {
    planId: string;
    productId: string;
    basePlanId: string;
    status: string;
    source: string;
    expiresAt: string | null;
    autoRenewing: boolean;
    verificationStatus: string;
    verificationMessage?: string;
    updatedAt?: string;
  } | null;
};

export async function getSubscriptionPlans() {
  const { data } = await api.get<{ productId: string; plans: SubscriptionPlan[] }>("/api/subscriptions/plans");
  return data;
}

export async function getMySubscription() {
  const { data } = await api.get<SubscriptionStatus>("/api/subscriptions/me");
  return data;
}

export async function recordGooglePlayPurchase(payload: {
  productId: string;
  basePlanId: string;
  planId: string;
  purchaseToken: string;
  orderId?: string;
  packageName?: string;
  transactionDate?: string;
  acknowledged?: boolean;
}) {
  const { data } = await api.post<SubscriptionStatus & { message: string }>("/api/subscriptions/google-play/purchase", payload);
  return data;
}
