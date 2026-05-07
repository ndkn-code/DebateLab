import { createClient } from "@/lib/supabase/server";
import {
  isBetaAllAccessEnabled,
  resolveEntitlementFromSubscriptions,
  type SubscriptionRecord,
} from "@/lib/entitlements";
import {
  UserAccessDashboard,
  type AdminUserAccessRow,
} from "@/components/admin/users/UserAccessDashboard";
import { getDevAdminUsers, isDevAdminBypassEnabled } from "@/lib/dev-admin-bypass";

type ProfileRow = {
  id: string;
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
  role: "student" | "teacher" | "admin";
  orb_balance?: number | null;
  xp?: number | null;
  level?: number | null;
  created_at: string;
};

export default async function AdminUsersPage() {
  const supabase = await createClient();
  const betaAllAccess = isBetaAllAccessEnabled();
  const devAdminBypass = isDevAdminBypassEnabled();

  const [profilesRes, subscriptionsRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, email, display_name, avatar_url, role, orb_balance, xp, level, created_at")
      .order("created_at", { ascending: false })
      .limit(250),
    supabase
      .from("subscriptions")
      .select("*")
      .order("created_at", { ascending: false }),
  ]);

  const subscriptionsByUser = new Map<string, SubscriptionRecord[]>();
  for (const subscription of (subscriptionsRes.data ?? []) as SubscriptionRecord[]) {
    const userId = subscription.user_id;
    if (!userId) continue;
    const list = subscriptionsByUser.get(userId) ?? [];
    list.push(subscription);
    subscriptionsByUser.set(userId, list);
  }

  const databaseRows: AdminUserAccessRow[] = ((profilesRes.data ?? []) as ProfileRow[]).map(
    (profile) => {
      const subscriptions = subscriptionsByUser.get(profile.id) ?? [];
      const entitlement = resolveEntitlementFromSubscriptions(subscriptions, {
        betaAllAccess,
      });

      return {
        id: profile.id,
        email: profile.email,
        displayName: profile.display_name || profile.email?.split("@")[0] || "Unnamed user",
        avatarUrl: profile.avatar_url,
        role: profile.role,
        orbBalance: profile.orb_balance ?? 0,
        xp: profile.xp ?? 0,
        level: profile.level ?? 1,
        createdAt: profile.created_at,
        subscriptions,
        latestSubscription: subscriptions[0] ?? null,
        entitlement: {
          planType: entitlement.planType,
          source: entitlement.source,
          hasPremiumAccess: entitlement.hasPremiumAccess,
          hasEnterpriseAccess: entitlement.hasEnterpriseAccess,
          reason: entitlement.reason,
        },
      };
    }
  );
  const rows = databaseRows.length > 0 || !devAdminBypass
    ? databaseRows
    : getDevAdminUsers();
  const loadError = devAdminBypass
    ? null
    : profilesRes.error?.message ?? subscriptionsRes.error?.message ?? null;

  return (
    <UserAccessDashboard
      users={rows}
      betaAllAccess={betaAllAccess}
      loadError={loadError}
    />
  );
}
