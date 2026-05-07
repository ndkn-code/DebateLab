"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { DEV_ADMIN_PROFILE, isDevAdminBypassEnabled } from "@/lib/dev-admin-bypass";
import type { PlanType } from "@/lib/entitlements";
import { recordAnalyticsEvent } from "@/lib/analytics/server-events";

type UserRole = "student" | "teacher" | "admin";

const USER_ROLES = new Set<UserRole>(["student", "teacher", "admin"]);
const PLAN_TYPES = new Set<PlanType>(["free", "premium", "enterprise"]);

async function verifyAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const devAdminBypass = isDevAdminBypassEnabled();

  if (!user) {
    if (devAdminBypass) return DEV_ADMIN_PROFILE.id;
    throw new Error("Unauthorized");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    if (devAdminBypass) return user.id;
    throw new Error("Forbidden");
  }

  return user.id;
}

function isDevMockId(id: string) {
  return isDevAdminBypassEnabled() && id.startsWith("00000000-0000-4000-8000-");
}

async function logAdminAction(
  supabase: Awaited<ReturnType<typeof createClient>>,
  adminId: string,
  action: string,
  entityType: string,
  entityId: string,
  changes: Record<string, unknown>
) {
  await supabase.from("admin_activity_log").insert({
    admin_user_id: adminId,
    action,
    entity_type: entityType,
    entity_id: entityId,
    changes,
  });
}

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

export async function updateUserRole(userId: string, role: UserRole) {
  if (!USER_ROLES.has(role)) throw new Error("Invalid role");

  const supabase = await createClient();
  const adminId = await verifyAdmin(supabase);

  if (isDevMockId(userId)) {
    revalidatePath("/dashboard/admin/users");
    return;
  }

  const { error } = await supabase
    .from("profiles")
    .update({ role, updated_at: new Date().toISOString() })
    .eq("id", userId);

  if (error) throw new Error(error.message);

  await logAdminAction(supabase, adminId, "update_user_role", "profile", userId, {
    role,
  });
  revalidatePath("/dashboard/admin/users");
}

export async function grantUserSubscription(
  userId: string,
  planType: PlanType,
  durationMonths = 12
) {
  if (!PLAN_TYPES.has(planType)) throw new Error("Invalid plan");
  if (durationMonths < 1 || durationMonths > 60) throw new Error("Invalid duration");

  const supabase = await createClient();
  const adminId = await verifyAdmin(supabase);
  const now = new Date();
  const periodEnd = addMonths(now, durationMonths);

  if (isDevMockId(userId)) {
    revalidatePath("/dashboard/admin/users");
    return;
  }

  await supabase
    .from("subscriptions")
    .update({
      status: "cancelled",
      cancel_at_period_end: false,
      cancelled_at: now.toISOString(),
      ended_at: now.toISOString(),
      updated_at: now.toISOString(),
    })
    .eq("user_id", userId)
    .in("status", ["active", "trial", "pending", "past_due"]);

  const { data: subscription, error } = await supabase
    .from("subscriptions")
    .insert({
      user_id: userId,
      plan_type: planType,
      status: planType === "free" ? "active" : "active",
      current_period_start: now.toISOString(),
      current_period_end: periodEnd.toISOString(),
      cancel_at_period_end: false,
      metadata: {
        source: "admin_manual_grant",
        granted_by: adminId,
        duration_months: durationMonths,
      },
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  await logAdminAction(
    supabase,
    adminId,
    "grant_subscription",
    "subscription",
    subscription.id,
    {
      user_id: userId,
      plan_type: planType,
      duration_months: durationMonths,
    }
  );
  await recordAnalyticsEvent(
    supabase,
    userId,
    {
      eventName: "admin_grant_created",
      featureArea: "admin",
      metadata: {
        admin_id: adminId,
        plan_type: planType,
        duration_months: durationMonths,
        subscription_id: subscription.id,
      },
    },
    "admin"
  );
  revalidatePath("/dashboard/admin/users");
}

export async function cancelUserSubscription(subscriptionId: string) {
  const supabase = await createClient();
  const adminId = await verifyAdmin(supabase);
  const now = new Date().toISOString();

  if (isDevMockId(subscriptionId)) {
    revalidatePath("/dashboard/admin/users");
    return;
  }

  const { data: subscription, error: fetchError } = await supabase
    .from("subscriptions")
    .select("id, user_id, plan_type, status")
    .eq("id", subscriptionId)
    .single();

  if (fetchError || !subscription) {
    throw new Error(fetchError?.message ?? "Subscription not found");
  }

  const { error } = await supabase
    .from("subscriptions")
    .update({
      status: "cancelled",
      cancel_at_period_end: false,
      cancelled_at: now,
      ended_at: now,
      updated_at: now,
    })
    .eq("id", subscriptionId);

  if (error) throw new Error(error.message);

  await logAdminAction(
    supabase,
    adminId,
    "cancel_subscription",
    "subscription",
    subscriptionId,
    subscription
  );
  await recordAnalyticsEvent(
    supabase,
    subscription.user_id,
    {
      eventName: "admin_grant_cancelled",
      featureArea: "admin",
      metadata: {
        admin_id: adminId,
        plan_type: subscription.plan_type,
        subscription_id: subscriptionId,
      },
    },
    "admin"
  );
  revalidatePath("/dashboard/admin/users");
}
