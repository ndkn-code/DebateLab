import type { SupabaseClient } from "@supabase/supabase-js";
import type { CourseVisibility, ModuleAccessLevel } from "@/lib/types/admin";

export type PlanType = "free" | "premium" | "enterprise";
export type SubscriptionStatus =
  | "active"
  | "trial"
  | "cancelled"
  | "expired"
  | "past_due"
  | "pending";

export type EntitlementSource = "beta_all_access" | "subscription" | "free";

export interface SubscriptionRecord {
  id?: string;
  user_id?: string;
  plan_type: PlanType;
  status: SubscriptionStatus;
  current_period_start?: string | null;
  current_period_end?: string | null;
  trial_start_date?: string | null;
  trial_end_date?: string | null;
  cancel_at_period_end?: boolean | null;
  cancelled_at?: string | null;
  ended_at?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface EntitlementState {
  planType: PlanType;
  source: EntitlementSource;
  hasPremiumAccess: boolean;
  hasEnterpriseAccess: boolean;
  betaAllAccess: boolean;
  activeSubscription: SubscriptionRecord | null;
  reason: string;
}

export interface EntitlementOptions {
  betaAllAccess?: boolean;
  now?: Date;
}

const DISABLED_BETA_VALUES = new Set(["false", "0", "off", "no"]);

export function isBetaAllAccessEnabled(env?: { BETA_ALL_ACCESS?: string }) {
  const raw = env?.BETA_ALL_ACCESS ?? process.env.BETA_ALL_ACCESS;
  if (raw == null || raw.trim() === "") return true;
  return !DISABLED_BETA_VALUES.has(raw.trim().toLowerCase());
}

function toDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isFuture(value: string | null | undefined, now: Date) {
  const date = toDate(value);
  return !date || date.getTime() > now.getTime();
}

function isPast(value: string | null | undefined, now: Date) {
  const date = toDate(value);
  return !!date && date.getTime() <= now.getTime();
}

export function isSubscriptionCurrentlyActive(
  subscription: SubscriptionRecord,
  now = new Date()
) {
  if (!["premium", "enterprise"].includes(subscription.plan_type)) {
    return false;
  }

  if (subscription.status === "cancelled" || subscription.status === "expired") {
    return false;
  }

  if (isPast(subscription.ended_at, now)) {
    return false;
  }

  if (subscription.status === "trial") {
    return (
      isFuture(subscription.trial_end_date, now) &&
      isFuture(subscription.current_period_end, now)
    );
  }

  if (subscription.status !== "active") {
    return false;
  }

  return isFuture(subscription.current_period_end, now);
}

export function resolveEntitlementFromSubscriptions(
  subscriptions: SubscriptionRecord[],
  options: EntitlementOptions = {}
): EntitlementState {
  const betaAllAccess = options.betaAllAccess ?? isBetaAllAccessEnabled();
  const now = options.now ?? new Date();

  if (betaAllAccess) {
    return {
      planType: "premium",
      source: "beta_all_access",
      hasPremiumAccess: true,
      hasEnterpriseAccess: false,
      betaAllAccess,
      activeSubscription: null,
      reason: "Beta all-access is enabled",
    };
  }

  const activeSubscription =
    subscriptions.find((subscription) =>
      isSubscriptionCurrentlyActive(subscription, now)
    ) ?? null;

  if (activeSubscription) {
    const planType = activeSubscription.plan_type;
    return {
      planType,
      source: "subscription",
      hasPremiumAccess: planType === "premium" || planType === "enterprise",
      hasEnterpriseAccess: planType === "enterprise",
      betaAllAccess,
      activeSubscription,
      reason: `${planType} subscription is ${activeSubscription.status}`,
    };
  }

  return {
    planType: "free",
    source: "free",
    hasPremiumAccess: false,
    hasEnterpriseAccess: false,
    betaAllAccess,
    activeSubscription: null,
    reason: "No active premium or enterprise subscription",
  };
}

export async function getUserEntitlement(
  supabase: SupabaseClient,
  userId: string,
  options: EntitlementOptions = {}
): Promise<EntitlementState> {
  const betaAllAccess = options.betaAllAccess ?? isBetaAllAccessEnabled();

  if (betaAllAccess) {
    return resolveEntitlementFromSubscriptions([], {
      ...options,
      betaAllAccess,
    });
  }

  const { data, error } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    return resolveEntitlementFromSubscriptions([], {
      ...options,
      betaAllAccess,
    });
  }

  return resolveEntitlementFromSubscriptions(
    (data ?? []) as SubscriptionRecord[],
    {
      ...options,
      betaAllAccess,
    }
  );
}

export async function hasPremiumAccess(
  supabase: SupabaseClient,
  userId: string,
  options: EntitlementOptions = {}
) {
  const entitlement = await getUserEntitlement(supabase, userId, options);
  return entitlement.hasPremiumAccess;
}

export function canAccessCourseRecord({
  role,
  visibility,
  entitlement,
  hasAccessRule = false,
  hasClassAccess = false,
}: {
  role?: string | null;
  visibility?: CourseVisibility | string | null;
  entitlement: EntitlementState;
  hasAccessRule?: boolean;
  hasClassAccess?: boolean;
}) {
  if (role === "admin") return true;
  const resolvedVisibility = visibility ?? "public";
  if (resolvedVisibility === "public") return true;
  if (resolvedVisibility === "premium") return entitlement.hasPremiumAccess;
  if (resolvedVisibility === "class_restricted") return hasAccessRule || hasClassAccess;
  return false;
}

export function canAccessModuleRecord({
  role,
  accessLevel,
  entitlement,
}: {
  role?: string | null;
  accessLevel?: ModuleAccessLevel | string | null;
  entitlement: EntitlementState;
}) {
  if (role === "admin") return true;
  const resolvedAccessLevel = accessLevel ?? "locked";
  if (resolvedAccessLevel === "free") return true;
  if (resolvedAccessLevel === "premium" || resolvedAccessLevel === "locked") {
    return entitlement.hasPremiumAccess;
  }
  return false;
}
