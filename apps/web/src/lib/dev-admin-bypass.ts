import type { Profile } from "@/types/database";
import type { AdminUserAccessRow } from "@/components/admin/users/UserAccessDashboard";
import type { SubscriptionRecord } from "@/lib/entitlements";

export function isDevAdminBypassEnabled() {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.DEV_ADMIN_BYPASS === "true"
  );
}

export const DEV_ADMIN_PROFILE: Profile = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "dev-admin@debate.local",
  display_name: "Dev Admin",
  avatar_url: null,
  handle: "dev.admin",
  profile_status: "Reviewing argument maps",
  role: "admin",
  streak_current: 0,
  streak_longest: 0,
  streak_last_active_date: null,
  total_practice_minutes: 0,
  total_sessions_completed: 0,
  xp: 1200,
  level: 4,
  onboarding_completed: true,
  preferences: {},
  selected_title: "Super Admin",
  unlocked_titles: ["Super Admin"],
  banner_color: "#00B8D9",
  referral_code: "QA-DEBATE",
  orb_balance: 600,
  referred_by: null,
  created_at: "2026-05-01T00:00:00.000Z",
  updated_at: "2026-05-01T00:00:00.000Z",
};

const BASE_USERS = [
  ["Ava Chen", "ava.chen@riverside.edu", "beta_all_access", "premium", "2026-06-12T00:00:00.000Z"],
  ["Liam Patel", "liam.patel@riverside.edu", "subscription", "premium", "2026-07-28T00:00:00.000Z"],
  ["Emma Rodriguez", "emma.rodriguez@riverside.edu", "free", "free", null],
  ["Noah Kim", "noah.kim@riverside.edu", "beta_all_access", "premium", "2026-06-01T00:00:00.000Z"],
  ["Olivia Thompson", "olivia.thompson@riverside.edu", "subscription", "premium", "2026-07-15T00:00:00.000Z"],
  ["Ethan Johnson", "ethan.johnson@riverside.edu", "free", "free", null],
  ["Sophia Martinez", "sophia.martinez@riverside.edu", "subscription", "premium", "2026-06-30T00:00:00.000Z"],
  ["Mason Lee", "mason.lee@riverside.edu", "free", "free", null],
  ["Isabella Clark", "isabella.clark@riverside.edu", "beta_all_access", "premium", "2026-06-05T00:00:00.000Z"],
] as const;

export function getDevAdminUsers(): AdminUserAccessRow[] {
  return BASE_USERS.map(([displayName, email, source, planType, periodEnd], index) => {
    const hasSubscription = planType !== "free" && periodEnd;
    const subscription: SubscriptionRecord | null = hasSubscription
      ? {
          id: `00000000-0000-4000-8000-${String(index + 10).padStart(12, "0")}`,
          user_id: `00000000-0000-4000-8000-${String(index + 100).padStart(12, "0")}`,
          plan_type: planType,
          status: "active",
          current_period_start: "2026-05-12T00:00:00.000Z",
          current_period_end: periodEnd,
          trial_start_date: null,
          trial_end_date: null,
          cancel_at_period_end: false,
          cancelled_at: null,
          ended_at: null,
          metadata: {
            source: source === "beta_all_access" ? "beta_admin_seed" : "manual_grant",
          },
          created_at: "2026-05-12T00:00:00.000Z",
          updated_at: "2026-05-12T00:00:00.000Z",
        }
      : null;

    return {
      id: `00000000-0000-4000-8000-${String(index + 100).padStart(12, "0")}`,
      email,
      displayName,
      avatarUrl: null,
      role: "student",
      orbBalance: 600,
      xp: 800 + index * 135,
      level: 2 + (index % 4),
      createdAt: `2026-04-${String(10 + index).padStart(2, "0")}T00:00:00.000Z`,
      lastOnlineAt: new Date(Date.now() - (index + 1) * 36 * 60 * 1000).toISOString(),
      subscriptions: subscription ? [subscription] : [],
      latestSubscription: subscription,
      entitlement: {
        planType,
        source,
        hasPremiumAccess: planType !== "free",
        hasEnterpriseAccess: false,
        reason:
          source === "beta_all_access"
            ? "Beta all-access is enabled"
            : source === "subscription"
              ? "premium subscription is active"
              : "No active premium or enterprise subscription",
      },
    } satisfies AdminUserAccessRow;
  });
}
