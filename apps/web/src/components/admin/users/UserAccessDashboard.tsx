"use client";

import { useMemo, useState, useTransition } from "react";
import { motion } from "framer-motion";
import {
  Award,
  BarChart3,
  CalendarClock,
  Crown,
  GraduationCap,
  Loader2,
  MoreHorizontal,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  UserRound,
  XCircle,
} from "@/components/ui/icons";
import { useRouter } from "@/i18n/navigation";
import {
  cancelUserSubscription,
  grantUserSubscription,
  updateUserRole,
} from "@/app/actions/admin-users";
import { FadeInItem, PageTransition, StaggeredContainer } from "@/components/shared/page-motion";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { EntitlementSource, PlanType, SubscriptionRecord } from "@/lib/entitlements";

type UserRole = "student" | "teacher" | "admin";

export interface AdminUserAccessRow {
  id: string;
  email: string | null;
  displayName: string;
  avatarUrl: string | null;
  role: UserRole;
  orbBalance: number;
  xp: number;
  level: number;
  createdAt: string;
  lastOnlineAt: string | null;
  subscriptions: SubscriptionRecord[];
  latestSubscription: SubscriptionRecord | null;
  entitlement: {
    planType: PlanType;
    source: EntitlementSource;
    hasPremiumAccess: boolean;
    hasEnterpriseAccess: boolean;
    reason: string;
  };
}

interface Props {
  users: AdminUserAccessRow[];
  betaAllAccess: boolean;
  loadError?: string | null;
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function formatLastOnline(value?: string | null) {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  const diffMs = date.getTime() - Date.now();
  const absMs = Math.abs(diffMs);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (absMs < 60_000) return "Just now";
  if (absMs < 3_600_000) return rtf.format(Math.round(diffMs / 60_000), "minute");
  if (absMs < 86_400_000) return rtf.format(Math.round(diffMs / 3_600_000), "hour");
  if (absMs < 30 * 86_400_000) return rtf.format(Math.round(diffMs / 86_400_000), "day");
  return formatDate(value);
}

function daysUntil(value?: string | null) {
  if (!value) return null;
  const end = new Date(value).getTime();
  if (Number.isNaN(end)) return null;
  return Math.ceil((end - Date.now()) / 86_400_000);
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "U";
}

function sourceLabel(source: EntitlementSource) {
  if (source === "beta_all_access") return "Beta all-access";
  if (source === "subscription") return "Premium";
  return "Free";
}

function entitlementTone(source: EntitlementSource) {
  if (source === "free") return "border-slate-200 bg-slate-50 text-slate-600";
  if (source === "subscription") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

function subscriptionIsActive(subscription: SubscriptionRecord | null) {
  return subscription?.status === "active" || subscription?.status === "trial";
}

export function UserAccessDashboard({ users, betaAllAccess, loadError }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<UserRole | "all">("all");
  const [planFilter, setPlanFilter] = useState<PlanType | "all">("all");
  const [entitlementFilter, setEntitlementFilter] = useState<EntitlementSource | "all">("all");
  const [selectedUserId, setSelectedUserId] = useState(users[0]?.id ?? "");
  const [grantPlan, setGrantPlan] = useState<PlanType>("premium");
  const [grantMonths, setGrantMonths] = useState(12);
  const [isPending, startTransition] = useTransition();

  const filteredUsers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return users.filter((user) => {
      const matchesQuery =
        !normalizedQuery ||
        user.displayName.toLowerCase().includes(normalizedQuery) ||
        (user.email ?? "").toLowerCase().includes(normalizedQuery) ||
        user.id.toLowerCase().includes(normalizedQuery);
      const matchesRole = roleFilter === "all" || user.role === roleFilter;
      const matchesPlan = planFilter === "all" || user.entitlement.planType === planFilter;
      const matchesEntitlement =
        entitlementFilter === "all" || user.entitlement.source === entitlementFilter;
      return matchesQuery && matchesRole && matchesPlan && matchesEntitlement;
    });
  }, [entitlementFilter, planFilter, query, roleFilter, users]);

  const selectedUser =
    users.find((user) => user.id === selectedUserId) ?? filteredUsers[0] ?? users[0] ?? null;

  const storedPremiumGrants = users.filter((user) =>
    user.subscriptions.some(
      (subscription) =>
        ["premium", "enterprise"].includes(subscription.plan_type) &&
        subscriptionIsActive(subscription)
    )
  ).length;
  const freeUsers = users.filter((user) => user.entitlement.planType === "free").length;
  const expiringSoon = users.filter((user) => {
    const days = daysUntil(user.latestSubscription?.current_period_end);
    return days !== null && days >= 0 && days <= 30 && subscriptionIsActive(user.latestSubscription);
  }).length;

  const handleRoleChange = (userId: string, role: UserRole) => {
    startTransition(async () => {
      await updateUserRole(userId, role);
      router.refresh();
    });
  };

  const handleGrant = (userId: string) => {
    startTransition(async () => {
      await grantUserSubscription(userId, grantPlan, grantMonths);
      router.refresh();
    });
  };

  const handleCancel = (subscriptionId: string) => {
    startTransition(async () => {
      await cancelUserSubscription(subscriptionId);
      router.refresh();
    });
  };

  return (
    <PageTransition className="min-h-full bg-[#f8fbff] text-[#0f1c35]">
      <header className="border-b border-[#dce7f7] bg-white/90 px-5 py-5 backdrop-blur md:px-7">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-normal text-[#0b1730] md:text-3xl">
              Users & Access
            </h1>
            <p className="mt-1 text-sm text-[#53647f]">
              Manage user accounts, roles, and beta entitlements.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button className="h-9 gap-2 rounded-lg bg-[#0b63f6] px-4 text-white shadow-[0_14px_28px_-20px_rgba(11,99,246,0.7)] transition-all hover:-translate-y-0.5 hover:bg-[#0755d7] hover:shadow-[0_18px_34px_-22px_rgba(11,99,246,0.78)] active:scale-[0.98]">
              <Sparkles className="h-4 w-4" />
              Invite User
            </Button>
            <Button variant="outline" className="h-9 gap-2 rounded-lg border-[#d2dff0] bg-white px-4 transition-all hover:-translate-y-0.5 hover:bg-[#f6f9ff] active:scale-[0.98]">
              <SlidersHorizontal className="h-4 w-4" />
              Export
            </Button>
          </div>
        </div>
      </header>

      <main className="grid gap-6 px-5 py-5 2xl:grid-cols-[minmax(0,1fr)_350px] md:px-7">
        <section className="min-w-0 space-y-5">
          {loadError ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {loadError}
            </div>
          ) : null}

          <StaggeredContainer className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[
              {
                icon: Crown,
                value: betaAllAccess ? users.length : storedPremiumGrants,
                label: betaAllAccess ? "Beta all-access active" : "Premium access active",
                detail: betaAllAccess ? "Server flag is enabled" : "Subscription-backed users",
                tone: "blue" as const,
              },
              {
                icon: Award,
                value: storedPremiumGrants,
                label: "Stored premium grants",
                detail: "Manual records in subscriptions",
                tone: "green" as const,
              },
              {
                icon: UserRound,
                value: freeUsers,
                label: "Free users",
                detail: "Effective plan after flags",
                tone: "slate" as const,
              },
              {
                icon: CalendarClock,
                value: expiringSoon,
                label: "Expiring soon",
                detail: "Within 30 days",
                tone: "amber" as const,
              },
            ].map((metric) => (
              <FadeInItem key={metric.label}>
                <MetricCard {...metric} />
              </FadeInItem>
            ))}
          </StaggeredContainer>

          <FadeInItem className="grid gap-3 rounded-lg border border-[#dce7f7] bg-white p-4 shadow-[0_22px_70px_-58px_rgba(15,28,53,0.35)] md:grid-cols-2 2xl:grid-cols-[minmax(240px,1fr)_130px_130px_170px_96px]">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7f8da5]" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="h-10 rounded-lg border-[#d2dff0] bg-white pl-9 text-sm"
                placeholder="Search users by name or email..."
              />
            </label>
            <Select
              value={roleFilter}
              onChange={(event) => setRoleFilter(event.target.value as UserRole | "all")}
              className="h-10 rounded-lg border-[#d2dff0] bg-white transition-all hover:-translate-y-0.5 hover:bg-[#f6f9ff] active:scale-[0.99]"
            >
              <option value="all">Role: All</option>
              <option value="student">Student</option>
              <option value="teacher">Teacher</option>
              <option value="admin">Admin</option>
            </Select>
            <Select
              value={planFilter}
              onChange={(event) => setPlanFilter(event.target.value as PlanType | "all")}
              className="h-10 rounded-lg border-[#d2dff0] bg-white transition-all hover:-translate-y-0.5 hover:bg-[#f6f9ff] active:scale-[0.99]"
            >
              <option value="all">Plan: All</option>
              <option value="free">Free</option>
              <option value="premium">Premium</option>
              <option value="enterprise">Enterprise</option>
            </Select>
            <Select
              value={entitlementFilter}
              onChange={(event) =>
                setEntitlementFilter(event.target.value as EntitlementSource | "all")
              }
              className="h-10 rounded-lg border-[#d2dff0] bg-white transition-all hover:-translate-y-0.5 hover:bg-[#f6f9ff] active:scale-[0.99]"
            >
              <option value="all">Entitlement: All</option>
              <option value="beta_all_access">Beta all-access</option>
              <option value="subscription">Subscription</option>
              <option value="free">Free</option>
            </Select>
            <Button variant="outline" className="h-10 rounded-lg border-[#d2dff0] bg-white transition-all hover:-translate-y-0.5 hover:bg-[#f6f9ff] active:scale-[0.98]">
              Filters
            </Button>
          </FadeInItem>

          <FadeInItem className="overflow-hidden rounded-lg border border-[#dce7f7] bg-white shadow-[0_22px_70px_-58px_rgba(15,28,53,0.35)]">
            <div className="overflow-x-auto">
              <div className="min-w-[820px] 2xl:min-w-[980px]">
                <div className="grid grid-cols-[minmax(200px,1fr)_112px_90px_140px_70px_108px_56px] border-b border-[#e6edf7] bg-[#fbfdff] px-3 py-3 text-xs font-semibold text-[#17233b] 2xl:grid-cols-[minmax(240px,1.4fr)_130px_110px_150px_100px_140px_72px] 2xl:px-4">
                  <span>User</span>
                  <span>Last Online</span>
                  <span>Role</span>
                  <span>Entitlement</span>
                  <span>Plan</span>
                  <span>Expires</span>
                  <span>Actions</span>
                </div>
                <div className="divide-y divide-[#e6edf7]">
                {filteredUsers.map((user) => {
                  const selected = selectedUser?.id === user.id;
                  const expiresIn = daysUntil(user.latestSubscription?.current_period_end);
                  return (
                    <motion.button
                      key={user.id}
                      type="button"
                      onClick={() => setSelectedUserId(user.id)}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.18, ease: "easeOut" }}
                      whileHover={{ y: -1 }}
                      whileTap={{ scale: 0.995 }}
                      className={cn(
                        "grid w-full grid-cols-[minmax(200px,1fr)_112px_90px_140px_70px_108px_56px] items-center px-3 py-3 text-left text-sm transition-colors hover:bg-[#f3f8ff] 2xl:grid-cols-[minmax(240px,1.4fr)_130px_110px_150px_100px_140px_72px] 2xl:px-4",
                        selected && "bg-[#edf6ff]"
                      )}
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        <Avatar size="lg" className="h-10 w-10 bg-[#dceaff] text-[#0b63f6]">
                          {user.avatarUrl ? (
                            <AvatarImage src={user.avatarUrl} alt={user.displayName} />
                          ) : null}
                          <AvatarFallback className="bg-[#dceaff] text-sm font-bold text-[#0b63f6]">
                            {initials(user.displayName)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="min-w-0">
                          <span className="block truncate font-semibold text-[#14213d]">
                            {user.displayName}
                          </span>
                          <span className="block truncate text-xs text-[#5d6c84]">
                            {user.email ?? user.id}
                          </span>
                        </span>
                      </span>
                      <span className="truncate text-xs font-medium text-[#53647f]">
                        {formatLastOnline(user.lastOnlineAt)}
                      </span>
                      <span>
                        <Badge className="gap-1 rounded-md border border-[#cfe2ff] bg-[#eef6ff] text-[#0b63f6]">
                          <GraduationCap className="h-3 w-3" />
                          {user.role}
                        </Badge>
                      </span>
                      <span>
                        <Badge className={cn("gap-1 rounded-md border", entitlementTone(user.entitlement.source))}>
                          {user.entitlement.source === "free" ? (
                            <UserRound className="h-3 w-3" />
                          ) : (
                            <Crown className="h-3 w-3" />
                          )}
                          {sourceLabel(user.entitlement.source)}
                        </Badge>
                      </span>
                      <span className="truncate text-xs capitalize text-[#1d2b46]">{user.entitlement.planType}</span>
                      <span className="text-[#1d2b46]">
                        {user.latestSubscription?.current_period_end ? (
                          <>
                            <span className={cn(expiresIn !== null && expiresIn <= 30 && "text-orange-600")}>
                              {formatDate(user.latestSubscription.current_period_end)}
                            </span>
                            <span className="block text-xs text-[#6d7c94]">
                              {expiresIn !== null ? `In ${Math.max(expiresIn, 0)} days` : "-"}
                            </span>
                          </>
                        ) : (
                          "-"
                        )}
                      </span>
                      <span className="flex justify-end pr-2 text-[#10213f]">
                        <MoreHorizontal className="h-4 w-4" />
                      </span>
                    </motion.button>
                  );
                })}
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between border-t border-[#e6edf7] px-4 py-3 text-sm text-[#53647f]">
              <span>
                Showing {filteredUsers.length === 0 ? 0 : 1} to {filteredUsers.length} of {users.length} users
              </span>
              <span className="rounded-lg border border-[#d2dff0] bg-white px-3 py-1 text-xs">
                250 / page
              </span>
            </div>
          </FadeInItem>
        </section>

        <FadeInItem className="rounded-lg border border-[#dce7f7] bg-white p-5 shadow-[0_22px_70px_-58px_rgba(15,28,53,0.35)] 2xl:sticky 2xl:top-5 2xl:self-start">
          {selectedUser ? (
            <div className="space-y-5">
              <div className="flex items-start gap-4">
                <Avatar className="h-16 w-16 bg-[#dceaff] text-[#0b63f6]">
                  {selectedUser.avatarUrl ? (
                    <AvatarImage src={selectedUser.avatarUrl} alt={selectedUser.displayName} />
                  ) : null}
                  <AvatarFallback className="bg-[#dceaff] text-lg font-bold text-[#0b63f6]">
                    {initials(selectedUser.displayName)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-lg font-bold text-[#12213c]">
                    {selectedUser.displayName}
                  </h2>
                  <p className="truncate text-sm text-[#53647f]">{selectedUser.email ?? selectedUser.id}</p>
                  <p className="mt-1 text-xs text-[#6d7c94]">
                    Joined {formatDate(selectedUser.createdAt)}
                  </p>
                  <p className="mt-1 text-xs text-[#6d7c94]">
                    Last online {formatLastOnline(selectedUser.lastOnlineAt)}
                  </p>
                </div>
              </div>

              <Button
                type="button"
                onClick={() =>
                  router.push(`/dashboard/admin/users/${selectedUser.id}/analytics`)
                }
                className="h-10 w-full justify-center gap-2 rounded-lg bg-[#0b63f6] text-white transition-all hover:-translate-y-0.5 hover:bg-[#0755d7] active:scale-[0.98]"
              >
                <BarChart3 className="h-4 w-4" />
                View Analytics
              </Button>

              <div>
                <label className="mb-2 block text-xs font-semibold uppercase text-[#53647f]">
                  Role
                </label>
                <Select
                  value={selectedUser.role}
                  onChange={(event) =>
                    handleRoleChange(selectedUser.id, event.target.value as UserRole)
                  }
                  disabled={isPending}
                  className="rounded-lg border-[#d2dff0] bg-white transition-all hover:-translate-y-0.5 hover:bg-[#f6f9ff] active:scale-[0.99]"
                >
                  <option value="student">Student</option>
                  <option value="teacher">Teacher</option>
                  <option value="admin">Admin</option>
                </Select>
                <p className="mt-2 text-xs text-[#6d7c94]">
                  Profiles keep Thinkfy&apos;s current single-role model for v1.
                </p>
              </div>

              <div className="rounded-lg border border-[#dce7f7] bg-[#fbfdff] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-[#152441]">Premium Access</p>
                    <p className="mt-1 text-xs text-[#6d7c94]">
                      {selectedUser.entitlement.reason}
                    </p>
                  </div>
                  <Badge
                    className={cn(
                      "rounded-md",
                      selectedUser.entitlement.hasPremiumAccess
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-slate-100 text-slate-600"
                    )}
                  >
                    {selectedUser.entitlement.hasPremiumAccess ? "Active" : "Free"}
                  </Badge>
                </div>
                <div className="mt-4 flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                    <Crown className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#152441]">
                      {sourceLabel(selectedUser.entitlement.source)}
                    </p>
                    <p className="text-xs text-[#6d7c94]">
                      {selectedUser.latestSubscription?.current_period_end
                        ? `Expires ${formatDate(selectedUser.latestSubscription.current_period_end)}`
                        : betaAllAccess
                          ? "No subscription required during beta"
                          : "No active subscription record"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-[#dce7f7] bg-white p-4">
                <p className="text-sm font-bold text-[#152441]">Manual Grant</p>
                <div className="mt-3 grid grid-cols-[1fr_92px] gap-2">
                  <Select
                    value={grantPlan}
                    onChange={(event) => setGrantPlan(event.target.value as PlanType)}
                    disabled={isPending}
                    className="rounded-lg border-[#d2dff0] bg-white transition-all hover:-translate-y-0.5 hover:bg-[#f6f9ff] active:scale-[0.99]"
                  >
                    <option value="premium">Premium</option>
                    <option value="enterprise">Enterprise</option>
                    <option value="free">Free</option>
                  </Select>
                  <Select
                    value={String(grantMonths)}
                    onChange={(event) => setGrantMonths(Number(event.target.value))}
                    disabled={isPending}
                    className="rounded-lg border-[#d2dff0] bg-white transition-all hover:-translate-y-0.5 hover:bg-[#f6f9ff] active:scale-[0.99]"
                  >
                    <option value="1">1 mo</option>
                    <option value="3">3 mo</option>
                    <option value="12">12 mo</option>
                    <option value="24">24 mo</option>
                  </Select>
                </div>
                <Button
                  onClick={() => handleGrant(selectedUser.id)}
                  disabled={isPending}
                  className="mt-3 h-10 w-full rounded-lg bg-[#0b63f6] text-white transition-all hover:-translate-y-0.5 hover:bg-[#0755d7] active:scale-[0.98]"
                >
                  {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                  Manage Access
                </Button>
              </div>

              <div className="rounded-lg border border-[#dce7f7] bg-white p-4">
                <p className="text-sm font-bold text-[#152441]">Subscription Records</p>
                <div className="mt-3 space-y-3">
                  {selectedUser.subscriptions.length > 0 ? (
                    selectedUser.subscriptions.slice(0, 4).map((subscription) => (
                      <div key={subscription.id} className="rounded-lg border border-[#e6edf7] p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold capitalize text-[#152441]">
                              {subscription.plan_type} / {subscription.status}
                            </p>
                            <p className="text-xs text-[#6d7c94]">
                              {formatDate(subscription.current_period_start)} to{" "}
                              {formatDate(subscription.current_period_end)}
                            </p>
                          </div>
                          <Badge variant="outline" className="rounded-md capitalize">
                            {subscription.status}
                          </Badge>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="rounded-lg bg-[#f5f8fc] px-3 py-3 text-sm text-[#6d7c94]">
                      No subscription records yet.
                    </p>
                  )}
                </div>
              </div>

              <div className="rounded-lg border border-[#dce7f7] bg-white p-4">
                <p className="text-sm font-bold text-[#152441]">Feature Access</p>
                <div className="mt-3 space-y-2 text-sm">
                  {["AI Feedback", "Advanced Analytics", "Custom Rubrics", "Premium Courses"].map((feature) => (
                    <div key={feature} className="flex items-center justify-between">
                      <span className="text-[#53647f]">{feature}</span>
                      <Badge className="rounded-md bg-emerald-100 text-emerald-700">
                        {selectedUser.entitlement.hasPremiumAccess ? "Included" : "Free"}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>

              <Button
                variant="destructive"
                disabled={!selectedUser.latestSubscription?.id || isPending}
                onClick={() =>
                  selectedUser.latestSubscription?.id &&
                  handleCancel(selectedUser.latestSubscription.id)
                }
                className="h-11 w-full justify-center gap-2 rounded-lg border border-red-200 bg-red-50 text-red-700 transition-all hover:-translate-y-0.5 hover:bg-red-100 active:scale-[0.98]"
              >
                <XCircle className="h-4 w-4" />
                Revoke Access
              </Button>
            </div>
          ) : (
            <div className="rounded-lg bg-[#f5f8fc] p-4 text-sm text-[#6d7c94]">
              No users found.
            </div>
          )}
        </FadeInItem>
      </main>
    </PageTransition>
  );
}

function MetricCard({
  icon: Icon,
  value,
  label,
  detail,
  tone,
}: {
  icon: typeof Crown;
  value: number;
  label: string;
  detail: string;
  tone: "blue" | "green" | "slate" | "amber";
}) {
  const toneClasses = {
    blue: "bg-[#e8f2ff] text-[#0b63f6]",
    green: "bg-emerald-50 text-emerald-700",
    slate: "bg-slate-100 text-slate-600",
    amber: "bg-amber-50 text-amber-700",
  } satisfies Record<typeof tone, string>;

  return (
    <div className="flex items-center gap-4 rounded-lg border border-[#dce7f7] bg-white p-5 shadow-[0_22px_70px_-58px_rgba(15,28,53,0.35)] transition-all duration-200 hover:-translate-y-1 hover:border-[#c9dcf5] hover:shadow-[0_24px_60px_-46px_rgba(15,28,53,0.45)]">
      <div className={cn("flex h-14 w-14 shrink-0 items-center justify-center rounded-full", toneClasses[tone])}>
        <Icon className="h-6 w-6" />
      </div>
      <div>
        <p className="text-2xl font-bold text-[#0b1730]">{value}</p>
        <p className="text-sm font-semibold text-[#1d2b46]">{label}</p>
        <p className="mt-1 text-xs text-[#6d7c94]">{detail}</p>
      </div>
    </div>
  );
}
