"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { useLocale, useTranslations } from "next-intl";

import {
  blockProfile,
  cancelProfileConnection,
  getProfileConnectionCenter,
  getProfileDiscoverySuggestions,
  removeProfileConnection,
  reportProfile,
  requestProfileConnection,
  respondToProfileConnection,
  rotateProfileFriendCode,
  searchProfileDiscovery,
} from "@/app/actions/profile-social";
import { Link, useRouter } from "@/i18n/navigation";
import {
  Award,
  BarChart3,
  Building2,
  Check,
  CheckCircle2,
  Clock3,
  Copy,
  Eye,
  ListChecks,
  Loader2,
  MoreHorizontal,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  UserPlus,
  UserRoundPlus,
  UsersRound,
  X,
} from "@/components/ui/icons";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AchievementMedallion } from "@/components/profile/achievement-medallion";
import { ProfileAchievementsTab } from "@/components/profile/profile-achievements-tab";
import { ProfileActivitiesTab } from "@/components/profile/profile-activities-tab";
import {
  ProfileAnalyticsTab,
  PublicProfileAnalyticsTab,
} from "@/components/profile/profile-analytics-tab";
import {
  coerceLeagueTierId,
  LEADERBOARD_LEAGUE_ASSETS,
} from "@/lib/leaderboards/league-assets";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { showToast } from "@/components/shared/toast";
import { cn } from "@/lib/utils";
import {
  coerceProfileConnectionStatus,
  getProfileConnectionCta,
  PROFILE_SOCIAL_TABS,
  type ProfileSocialTab,
} from "@/lib/profile-social/ui-model";
import { coerceProfileAchievementItem } from "@/lib/profile-social/tab-model";
import type {
  ProfileConnectionStatus,
  ProfileConnectionCenterData,
  ProfileDiscoveryResult,
  ProfileDiscoveryShell,
  ProfileDiscoverySuggestionsData,
  PublicProfileConnection,
  PublicProfileData,
  PublicProfileShell,
} from "@/lib/profile-social/model";
import type {
  ProfileAchievementItem,
  ProfileAchievementsData,
  ProfileActivityFeedData,
  ProfileAnalyticsTabData,
} from "@/lib/profile-social/tab-model";
import type { AnalyticsPageData, AnalyticsRangePreset } from "@/types";

interface SocialProfilePageProps {
  publicProfile: PublicProfileData;
  analyticsData?: AnalyticsPageData | null;
  publicAnalyticsData?: ProfileAnalyticsTabData | null;
  activityFeedData?: ProfileActivityFeedData | null;
  achievementsData?: ProfileAchievementsData | null;
  activeTab: ProfileSocialTab;
  baseHref: string;
  range: AnalyticsRangePreset;
  privacyPreview?: boolean;
}

const TAB_ICONS: Record<ProfileSocialTab, ReactNode> = {
  analytics: <BarChart3 className="h-5 w-5" />,
  activities: <ListChecks className="h-5 w-5" />,
  achievements: <Award className="h-5 w-5" />,
};

function getInitials(name: string | null | undefined) {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((token) => token[0]?.toUpperCase() ?? "")
    .join("");
}

function formatNumber(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  return new Intl.NumberFormat("en-US").format(value);
}

function normalizeSystemCopyKey(value: string | null | undefined) {
  return value
    ?.trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

const SYSTEM_TITLE_KEYS: Record<string, true> = {
  constructive_climber: true,
  evidence_builder: true,
  crossfire_ready: true,
  rebuttal_streak: true,
  newcomer: true,
  speed_demon: true,
  weekly_warrior: true,
  near_perfect: true,
  super_admin: true,
};

const SYSTEM_STATUS_KEYS: Record<string, true> = {
  reviewing_argument_maps: true,
  practicing_rebuttals: true,
};

const SYSTEM_ACHIEVEMENT_KEYS: Record<string, true> = {
  constructive_climber: true,
  evidence_builder: true,
  crossfire_ready: true,
  rebuttal_streak: true,
  newcomer: true,
  speed_demon: true,
  weekly_warrior: true,
  near_perfect: true,
};

function getKnownSystemKey(
  value: string | null | undefined,
  knownKeys: Record<string, true>
) {
  const key = normalizeSystemCopyKey(value);
  return key && knownKeys[key] ? key : null;
}

function getKnownAchievementKey(achievement: ProfileAchievementItem) {
  const slugKey = getKnownSystemKey(achievement.slug, SYSTEM_ACHIEVEMENT_KEYS);
  if (slugKey) return slugKey;
  return getKnownSystemKey(achievement.title, SYSTEM_ACHIEVEMENT_KEYS);
}

function localizeAchievementItem(
  achievement: ProfileAchievementItem,
  t: ReturnType<typeof useTranslations<"profileSocial">>
): ProfileAchievementItem {
  const key = getKnownAchievementKey(achievement);
  if (!key) return achievement;

  return {
    ...achievement,
    title: t(`system_achievements.${key}.title`),
    description: t(`system_achievements.${key}.description`),
    titleReward: achievement.titleReward
      ? t(`system_achievements.${key}.title_reward`)
      : achievement.titleReward,
  };
}

function localizeAchievementsData(
  data: ProfileAchievementsData | null | undefined,
  t: ReturnType<typeof useTranslations<"profileSocial">>
) {
  if (!data) return data;

  const localizedAchievements = data.achievements.map((achievement) =>
    localizeAchievementItem(achievement, t)
  );
  const localizedById = new Map(
    localizedAchievements.map((achievement) => [achievement.id, achievement])
  );

  return {
    ...data,
    achievements: localizedAchievements,
    featured: data.featured.map((achievement) => {
      return localizedById.get(achievement.id) ?? localizeAchievementItem(achievement, t);
    }),
  };
}

function localizePublicProfileData(
  data: PublicProfileData,
  t: ReturnType<typeof useTranslations<"profileSocial">>
): PublicProfileData {
  if (!data.profile) return data;

  const selectedTitleKey = getKnownSystemKey(
    data.profile.selectedTitle,
    SYSTEM_TITLE_KEYS
  );
  const profileStatusKey = getKnownSystemKey(
    data.profile.profileStatus,
    SYSTEM_STATUS_KEYS
  );

  return {
    ...data,
    profile: {
      ...data.profile,
      selectedTitle: selectedTitleKey
        ? t(`system_titles.${selectedTitleKey}`)
        : data.profile.selectedTitle,
      profileStatus: profileStatusKey
        ? t(`system_statuses.${profileStatusKey}`)
        : data.profile.profileStatus,
    },
  };
}

function buildTabHref(
  baseHref: string,
  tab: ProfileSocialTab,
  range: AnalyticsRangePreset
) {
  const [path, query = ""] = baseHref.split("?");
  const params = new URLSearchParams(query);
  params.set("tab", tab);
  if (tab === "analytics") {
    params.set("range", range);
  } else {
    params.delete("range");
  }

  return `${path}?${params.toString()}`;
}

function buildAnalyticsRangeHref(
  baseHref: string,
  range: AnalyticsRangePreset
) {
  const [path, query = ""] = baseHref.split("?");
  const params = new URLSearchParams(query);
  params.set("tab", "analytics");
  params.set("range", range);
  return `${path}?${params.toString()}`;
}

const STAT_TILE_ART = {
  level: "/images/rewards/level-up.webp",
  seasonXp: "/images/rewards/xp-bolt.webp",
} as const;

function ProfileStatTile({
  art,
  icon,
  value,
  label,
}: {
  art?: string;
  icon?: ReactNode;
  value: ReactNode;
  label: string;
}) {
  return (
    <div
      aria-label={`${label}: ${typeof value === "string" || typeof value === "number" ? value : ""}`}
      className="flex min-w-0 items-center gap-3.5 rounded-2xl border border-outline-variant bg-surface-container-lowest px-4 py-3.5 shadow-token-card transition-transform duration-200 hover:-translate-y-0.5"
    >
      {art ? (
        <Image
          src={art}
          alt=""
          width={80}
          height={80}
          unoptimized
          draggable={false}
          aria-hidden="true"
          className="size-11 shrink-0 object-contain drop-shadow-token-card"
        />
      ) : (
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[#EFEAFE] text-[#6D4FD0] dark:bg-[#8B5CF6]/15 dark:text-[#B49AFC]">
          {icon}
        </span>
      )}
      <div className="min-w-0">
        <p className="truncate text-[1.2rem] font-extrabold leading-6 tabular-nums text-on-surface">
          {value}
        </p>
        <p className="truncate text-[12px] font-semibold text-on-surface-variant">
          {label}
        </p>
      </div>
    </div>
  );
}

function ProfileActionButton({
  children,
  className,
  disabled,
  onClick,
}: {
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-outline-variant bg-white px-4 text-sm font-semibold text-on-surface shadow-token-card transition hover:border-outline-variant hover:bg-background disabled:cursor-not-allowed disabled:opacity-60",
        className
      )}
    >
      {children}
    </button>
  );
}

function getDiscoveryProfileHref(shell: ProfileDiscoveryShell) {
  if (shell.connection.status === "self") return "/profile";
  return shell.profile.handle && !shell.profile.isPrivate
    ? `/profile/${shell.profile.handle}`
    : null;
}

function DiscoveryAvatar({ shell }: { shell: ProfileDiscoveryShell }) {
  return (
    <Avatar className="h-11 w-11 shrink-0 border border-outline-variant bg-surface-container">
      {shell.profile.avatarUrl ? (
        <AvatarImage src={shell.profile.avatarUrl} alt={shell.profile.displayName} />
      ) : null}
      <AvatarFallback className="bg-surface-container text-sm font-semibold text-on-surface">
        {getInitials(shell.profile.displayName)}
      </AvatarFallback>
    </Avatar>
  );
}

function DiscoveryConnectionButton({
  shell,
  onChanged,
  onConnectionChange,
}: {
  shell: ProfileDiscoveryShell;
  onChanged: () => void;
  onConnectionChange?: (connection: PublicProfileConnection) => void;
}) {
  const t = useTranslations("profileSocial.actions");
  const [isPending, startTransition] = useTransition();
  const cta = getProfileConnectionCta(shell.connection);

  function deriveConnection(result: unknown): PublicProfileConnection {
    const rawStatus =
      typeof result === "object" && result !== null && "status" in result
        ? String((result as { status?: unknown }).status ?? "")
        : "";

    if (rawStatus === "cancelled" || rawStatus === "removed" || rawStatus === "declined") {
      return { status: "none", viewerCanRequest: true };
    }

    if (rawStatus === "disabled" || rawStatus === "not_found" || rawStatus === "rate_limited") {
      return shell.connection;
    }

    const status = coerceProfileConnectionStatus(rawStatus, shell.connection.status);
    return {
      status,
      viewerCanRequest: status === "none",
    };
  }

  function runAction(action: () => Promise<unknown>, message: string) {
    startTransition(async () => {
      try {
        const result = await action();
        onConnectionChange?.(deriveConnection(result));
        showToast(message, "success");
        onChanged();
      } catch (error) {
        showToast(error instanceof Error ? error.message : t("error"), "error");
      }
    });
  }

  if (cta === "self") {
    return (
      <span className="inline-flex h-9 items-center rounded-lg bg-surface-container px-3 text-xs font-semibold text-on-surface-variant">
        {t("you")}
      </span>
    );
  }

  if (cta === "friends") {
    return (
      <button
        type="button"
        disabled={isPending}
        onClick={() =>
          runAction(
            () => removeProfileConnection({ targetUserId: shell.profile.userId }),
            t("removed_toast")
          )
        }
        className="inline-flex h-9 items-center gap-2 rounded-lg border border-outline-variant bg-surface-container px-3 text-xs font-semibold text-on-surface-variant disabled:opacity-60"
      >
        <CheckCircle2 className="h-3.5 w-3.5" />
        {t("friends")}
      </button>
    );
  }

  if (cta === "requested") {
    return (
      <button
        type="button"
        disabled={isPending}
        onClick={() =>
          runAction(
            () => cancelProfileConnection({ targetUserId: shell.profile.userId }),
            t("cancelled_toast")
          )
        }
        className="inline-flex h-9 items-center gap-2 rounded-lg border border-outline-variant bg-white px-3 text-xs font-semibold text-on-surface-variant disabled:opacity-60"
      >
        {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Clock3 className="h-3.5 w-3.5" />}
        {t("requested")}
      </button>
    );
  }

  if (cta === "respond") {
    return (
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={isPending}
          onClick={() =>
            runAction(
              () =>
                respondToProfileConnection({
                  requesterUserId: shell.profile.userId,
                  response: "accept",
                }),
              t("accepted_toast")
            )
          }
          className="inline-flex h-9 items-center rounded-lg bg-primary px-3 text-xs font-semibold text-white disabled:opacity-60"
        >
          {t("accept")}
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() =>
            runAction(
              () =>
                respondToProfileConnection({
                  requesterUserId: shell.profile.userId,
                  response: "decline",
                }),
              t("declined_toast")
            )
          }
          className="inline-flex h-9 items-center rounded-lg border border-outline-variant bg-white px-3 text-xs font-semibold text-on-surface-variant disabled:opacity-60"
        >
          {t("decline")}
        </button>
      </div>
    );
  }

  if (cta === "add") {
    return (
      <button
        type="button"
        disabled={isPending}
        onClick={() =>
          runAction(
            () => requestProfileConnection({ targetUserId: shell.profile.userId }),
            t("requested_toast")
          )
        }
        className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3 text-xs font-semibold text-white disabled:opacity-60"
      >
        {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
        {t("add_friend")}
      </button>
    );
  }

  return (
    <span className="inline-flex h-9 items-center rounded-lg bg-surface-container px-3 text-xs font-semibold text-on-surface-variant">
      {t("unavailable")}
    </span>
  );
}

function DiscoveryPersonCard({
  shell,
  onChanged,
}: {
  shell: ProfileDiscoveryShell;
  onChanged: () => void;
}) {
  const t = useTranslations("profileSocial.discovery");
  const [connection, setConnection] = useState(shell.connection);
  const localShell = useMemo(
    () => ({
      ...shell,
      connection,
    }),
    [connection, shell]
  );

  const href = getDiscoveryProfileHref(shell);
  const content = (
    <>
      <DiscoveryAvatar shell={shell} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-on-surface">
          {shell.profile.displayName}
        </p>
        <p className="mt-0.5 truncate text-xs font-medium text-on-surface-variant">
          {shell.profile.handle ? `@${shell.profile.handle}` : t("private_profile")}
        </p>
        {shell.profile.organization ? (
          <p className="mt-1 truncate text-xs text-on-surface-variant">
            {shell.profile.organization.name}
          </p>
        ) : null}
      </div>
    </>
  );

  return (
    <div className="flex items-center gap-3 rounded-lg border border-outline-variant bg-white p-3 shadow-token-card">
      {href ? (
        <Link href={href} className="flex min-w-0 flex-1 items-center gap-3">
          {content}
        </Link>
      ) : (
        <div className="flex min-w-0 flex-1 items-center gap-3">{content}</div>
      )}
      <DiscoveryConnectionButton
        shell={localShell}
        onChanged={onChanged}
        onConnectionChange={setConnection}
      />
    </div>
  );
}

function FindFriendsDrawer({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("profileSocial.discovery");
  const [activeView, setActiveView] = useState<"search" | "requests" | "friends">("search");
  const [center, setCenter] = useState<ProfileConnectionCenterData | null>(null);
  const [suggestions, setSuggestions] = useState<ProfileDiscoverySuggestionsData | null>(null);
  const [query, setQuery] = useState("");
  const [searchResult, setSearchResult] = useState<ProfileDiscoveryResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSearching, startSearchTransition] = useTransition();
  const [isRotating, startRotateTransition] = useTransition();

  const refreshCenter = useCallback(() => {
    void (async () => {
      await Promise.resolve();
      setIsLoading(true);
      try {
        const [nextCenter, nextSuggestions] = await Promise.all([
          getProfileConnectionCenter(),
          getProfileDiscoverySuggestions(),
        ]);
        setCenter(nextCenter);
        setSuggestions(nextSuggestions);
      } catch (error) {
        showToast(error instanceof Error ? error.message : t("load_error"), "error");
      } finally {
        setIsLoading(false);
      }
    })();
  }, [t]);

  useEffect(() => {
    if (!open) return;
    refreshCenter();
  }, [open, refreshCenter]);

  function handleSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startSearchTransition(async () => {
      try {
        const result = await searchProfileDiscovery({ query });
        setSearchResult(result);
      } catch (error) {
        showToast(error instanceof Error ? error.message : t("search_error"), "error");
      }
    });
  }

  function handleCopyCode() {
    const code = center?.friendCode.code;
    if (!code) return;
    if (!navigator.clipboard) {
      showToast(t("copy_unavailable"), "warning");
      return;
    }
    void navigator.clipboard.writeText(code).then(
      () => showToast(t("copy_success"), "success"),
      () => showToast(t("copy_failed"), "warning")
    );
  }

  function handleRotateCode() {
    startRotateTransition(async () => {
      try {
        const result = await rotateProfileFriendCode();
        if (result.status === "rate_limited") {
          showToast(t("rotate_limited"), "warning");
          return;
        }
        showToast(t("rotate_success"), "success");
        refreshCenter();
      } catch (error) {
        showToast(error instanceof Error ? error.message : t("rotate_error"), "error");
      }
    });
  }

  if (!open) return null;

  const requestCount = (center?.incoming.length ?? 0) + (center?.outgoing.length ?? 0);

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={t("dialog_label")}>
      <button
        type="button"
        aria-label={t("close_find_friends")}
        className="absolute inset-0 bg-surface-container-high/35 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />
      <aside className="absolute right-0 top-0 flex h-full w-full max-w-[440px] flex-col border-l border-outline-variant bg-background shadow-token-card">
        <div className="flex items-center justify-between border-b border-outline-variant px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase text-on-surface-variant">{t("eyebrow")}</p>
            <h2 className="text-xl font-semibold text-on-surface">{t("title")}</h2>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-outline-variant bg-white text-on-surface"
            aria-label={t("close")}
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        <div className="grid grid-cols-3 border-b border-outline-variant bg-white">
          {[
            { value: "search", label: t("tab_search"), count: 0 },
            {
              value: "requests",
              label: t("tab_requests", { count: 0 }),
              count: requestCount,
            },
            {
              value: "friends",
              label: t("tab_friends", { count: 0 }),
              count: center?.friends.length ?? 0,
            },
          ].map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setActiveView(tab.value as "search" | "requests" | "friends")}
              className={cn(
                "relative inline-flex h-12 items-center justify-center gap-1.5 text-sm font-semibold transition",
                activeView === tab.value ? "text-primary-dim" : "text-on-surface-variant"
              )}
            >
              <span>{tab.label}</span>
              {tab.count > 0 ? (
                <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-surface-container px-1.5 text-[11px] leading-5 text-primary-dim">
                  {tab.count}
                </span>
              ) : null}
              {activeView === tab.value ? (
                <span className="absolute bottom-0 left-5 right-5 h-0.5 rounded-full bg-primary" />
              ) : null}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          {isLoading ? (
            <div className="flex h-32 items-center justify-center text-on-surface-variant">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : null}

          {activeView === "search" ? (
            <div className="space-y-5">
              <form onSubmit={handleSearch} className="space-y-3">
                <label className="text-sm font-semibold text-on-surface" htmlFor="profile-discovery-search">
                  {t("search_label")}
                </label>
                <div className="flex h-11 items-center gap-2 rounded-lg border border-outline-variant bg-white px-3 focus-within:border-primary">
                  <Search className="h-4 w-4 text-on-surface-variant" />
                  <input
                    id="profile-discovery-search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="@maya.tran or DBT-7K2M-Q8R4"
                    className="min-w-0 flex-1 bg-transparent text-sm font-medium text-on-surface outline-none placeholder:text-muted-foreground"
                  />
                  <button
                    type="submit"
                    disabled={isSearching}
                    className="inline-flex h-8 items-center rounded-md bg-primary px-3 text-xs font-semibold text-white disabled:opacity-60"
                  >
                    {isSearching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : t("search_button")}
                  </button>
                </div>
              </form>

              <div className="rounded-lg border border-outline-variant bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase text-on-surface-variant">{t("friend_code_label")}</p>
                    <p className="mt-1 font-mono text-lg font-semibold tracking-[0.08em] text-on-surface">
                      {center?.friendCode.code ?? t("loading")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCopyCode}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-outline-variant bg-background text-on-surface"
                      aria-label={t("copy_friend_code")}
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={handleRotateCode}
                      disabled={isRotating}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-outline-variant bg-background text-on-surface disabled:opacity-60"
                      aria-label={t("rotate_friend_code")}
                    >
                      {isRotating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                {!center?.friendCode.discoveryEnabled ? (
                  <p className="mt-3 text-xs leading-5 text-on-surface-variant">
                    {t("friend_code_off")}
                  </p>
                ) : null}
              </div>

              {searchResult?.result ? (
                <DiscoveryPersonCard
                  key={searchResult.result.profile.userId}
                  shell={searchResult.result}
                  onChanged={refreshCenter}
                />
              ) : searchResult && searchResult.status !== "empty" ? (
                <div className="rounded-lg border border-dashed border-outline-variant bg-white px-4 py-8 text-center text-sm text-on-surface-variant">
                  {searchResult.status === "rate_limited"
                    ? t("search_rate_limited")
                    : searchResult.status === "blocked"
                      ? t("search_blocked")
                      : t("search_empty")}
                </div>
              ) : null}

              {suggestions?.suggestions.length ? (
                <div>
                  <h3 className="mb-3 text-sm font-semibold text-on-surface">{t("suggestions_title")}</h3>
                  <div className="space-y-2">
                    {suggestions.suggestions.map((shell) => (
                      <DiscoveryPersonCard
                        key={shell.profile.userId}
                        shell={shell}
                        onChanged={refreshCenter}
                      />
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {activeView === "requests" ? (
            <div className="space-y-5">
              <div>
                <h3 className="mb-3 text-sm font-semibold text-on-surface">{t("incoming")}</h3>
                <div className="space-y-2">
                  {center?.incoming.length ? (
                    center.incoming.map((shell) => (
                      <DiscoveryPersonCard
                        key={shell.profile.userId}
                        shell={shell}
                        onChanged={refreshCenter}
                      />
                    ))
                  ) : (
                    <p className="rounded-lg border border-dashed border-outline-variant bg-white px-4 py-6 text-center text-sm text-on-surface-variant">
                      {t("no_incoming")}
                    </p>
                  )}
                </div>
              </div>
              <div>
                <h3 className="mb-3 text-sm font-semibold text-on-surface">{t("outgoing")}</h3>
                <div className="space-y-2">
                  {center?.outgoing.length ? (
                    center.outgoing.map((shell) => (
                      <DiscoveryPersonCard
                        key={shell.profile.userId}
                        shell={shell}
                        onChanged={refreshCenter}
                      />
                    ))
                  ) : (
                    <p className="rounded-lg border border-dashed border-outline-variant bg-white px-4 py-6 text-center text-sm text-on-surface-variant">
                      {t("no_outgoing")}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ) : null}

          {activeView === "friends" ? (
            <div className="space-y-2">
              {center?.friends.length ? (
                center.friends.map((shell) => (
                  <DiscoveryPersonCard
                    key={shell.profile.userId}
                    shell={shell}
                    onChanged={refreshCenter}
                  />
                ))
              ) : (
                <div className="rounded-lg border border-dashed border-outline-variant bg-white px-4 py-12 text-center">
                  <UserRoundPlus className="mx-auto h-8 w-8 text-muted-foreground" />
                  <p className="mt-3 text-sm font-semibold text-on-surface">{t("no_friends_title")}</p>
                  <p className="mt-1 text-sm text-on-surface-variant">{t("no_friends_body")}</p>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </aside>
    </div>
  );
}

function ProfileConnectionActions({
  profile,
  initialConnection,
  isPreview = false,
}: {
  profile: PublicProfileShell;
  initialConnection: PublicProfileConnection | null;
  isPreview?: boolean;
}) {
  const t = useTranslations("profileSocial");
  const [findFriendsOpen, setFindFriendsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [connection, setConnection] = useState<PublicProfileConnection>(
    initialConnection ?? { status: "none", viewerCanRequest: false }
  );
  const cta = getProfileConnectionCta(connection);

  if (isPreview) {
    return (
      <Link
        href="/settings#privacy"
        className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-outline-variant bg-white px-4 text-sm font-semibold text-on-surface transition hover:bg-background"
      >
        <Settings className="h-4 w-4" />
        {t("actions.edit_visibility")}
      </Link>
    );
  }

  function updateConnection(nextStatus: unknown) {
    const status = coerceProfileConnectionStatus(nextStatus);
    setConnection({
      status,
      viewerCanRequest: status === "none",
    });
  }

  function runAction(
    action: () => Promise<unknown>,
    successMessage: string,
    options: { updateConnection?: boolean } = { updateConnection: true }
  ) {
    startTransition(async () => {
      try {
        const result = (await action()) as { status?: ProfileConnectionStatus };
        if (options.updateConnection ?? true) {
          updateConnection(result?.status);
        }
        showToast(successMessage, "success");
      } catch (error) {
        showToast(
          error instanceof Error ? error.message : t("actions.error"),
          "error"
        );
      }
    });
  }

  if (cta === "self") {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <ProfileActionButton
          onClick={() => setFindFriendsOpen(true)}
          className="border-outline-variant bg-white text-on-surface"
        >
          <UserPlus className="h-4 w-4" />
          {t("actions.find_friends")}
        </ProfileActionButton>
        <Link
          href="/settings"
          className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-5 text-sm font-semibold text-white shadow-token-primary transition hover:bg-primary-dim"
        >
          {t("actions.edit_profile")}
        </Link>
        <Link
          href="/settings"
          aria-label={t("actions.settings")}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-outline-variant bg-white text-on-surface transition hover:bg-background"
        >
          <Settings className="h-4.5 w-4.5" />
        </Link>
        <FindFriendsDrawer
          open={findFriendsOpen}
          onOpenChange={setFindFriendsOpen}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {cta === "add" ? (
        <ProfileActionButton
          disabled={isPending}
          onClick={() =>
            runAction(
              () => requestProfileConnection({ targetUserId: profile.userId }),
              t("actions.requested_toast")
            )
          }
          className="border-transparent bg-primary text-white hover:bg-primary-dim"
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
          {t("actions.add_friend")}
        </ProfileActionButton>
      ) : null}

      {cta === "requested" ? (
        <ProfileActionButton
          disabled={isPending}
          onClick={() =>
            runAction(
              () => cancelProfileConnection({ targetUserId: profile.userId }),
              t("actions.cancelled_toast")
            )
          }
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clock3 className="h-4 w-4" />}
          {t("actions.requested")}
        </ProfileActionButton>
      ) : null}

      {cta === "respond" ? (
        <>
          <ProfileActionButton
            disabled={isPending}
            onClick={() =>
              runAction(
                () =>
                  respondToProfileConnection({
                    requesterUserId: profile.userId,
                    response: "accept",
                  }),
                t("actions.accepted_toast")
              )
            }
            className="border-transparent bg-primary text-white hover:bg-primary-dim"
          >
            <Check className="h-4 w-4" />
            {t("actions.accept")}
          </ProfileActionButton>
          <ProfileActionButton
            disabled={isPending}
            onClick={() =>
              runAction(
                () =>
                  respondToProfileConnection({
                    requesterUserId: profile.userId,
                    response: "decline",
                  }),
                t("actions.declined_toast")
              )
            }
          >
            <X className="h-4 w-4" />
            {t("actions.decline")}
          </ProfileActionButton>
        </>
      ) : null}

      {cta === "friends" ? (
        <ProfileActionButton
          disabled={isPending}
          onClick={() =>
            runAction(
              () => removeProfileConnection({ targetUserId: profile.userId }),
              t("actions.removed_toast")
            )
          }
        >
          <CheckCircle2 className="h-4 w-4 text-success" />
          {t("actions.friends")}
        </ProfileActionButton>
      ) : null}

      <DropdownMenu>
        <DropdownMenuTrigger className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-outline-variant bg-white text-on-surface transition hover:bg-background">
          <MoreHorizontal className="h-4.5 w-4.5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onClick={() =>
              runAction(
                () =>
                  reportProfile({
                    targetUserId: profile.userId,
                    reason: "other",
                  }),
                t("actions.reported_toast"),
                { updateConnection: false }
              )
            }
          >
            <ShieldCheck className="h-4 w-4" />
            {t("actions.report")}
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            onClick={() =>
              runAction(
                () => blockProfile({ targetUserId: profile.userId }),
                t("actions.blocked_toast")
              )
            }
          >
            <X className="h-4 w-4" />
            {t("actions.block")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

const FEATURED_CHIP_TONES = [
  "bg-[#E3F3FF] text-[#1D7FD6] dark:bg-[#3B9EFF]/15 dark:text-[#6FB9FF]",
  "bg-[#EFEAFE] text-[#6D4FD0] dark:bg-[#8B5CF6]/15 dark:text-[#B49AFC]",
  "bg-[#FFF3DC] text-[#C98A1B] dark:bg-[#FFD166]/15 dark:text-[#FFD98A]",
] as const;

function HeaderFeaturedAchievements({
  achievements,
}: {
  achievements: ProfileAchievementItem[];
}) {
  const t = useTranslations("profileSocial.achievements");

  if (achievements.length === 0) return null;

  return (
    <div className="mt-4 flex flex-wrap items-center justify-center gap-2 lg:justify-start">
      {achievements.slice(0, 3).map((achievement, index) => (
        <span
          key={achievement.id}
          className={cn(
            "inline-flex h-9 items-center gap-2 rounded-full py-1 pl-1.5 pr-3.5 text-[13px] font-bold",
            FEATURED_CHIP_TONES[index % FEATURED_CHIP_TONES.length]
          )}
          title={achievement.title}
        >
          <AchievementMedallion
            achievement={achievement}
            size="sm"
            showFeaturedStar={false}
            className="!size-6"
          />
          <span className="max-w-[9.5rem] truncate">{achievement.title}</span>
        </span>
      ))}
      <span className="sr-only">{t("featured")}</span>
    </div>
  );
}

function ProfileHeader({
  data,
  featuredAchievements,
  isPrivacyPreview = false,
}: {
  data: PublicProfileData;
  featuredAchievements: ProfileAchievementItem[];
  isPrivacyPreview?: boolean;
}) {
  const t = useTranslations("profileSocial");
  const profile = data.profile;

  if (!profile) return null;

  const handleLabel = profile.handle ? `@${profile.handle}` : t("header.no_handle");
  const seasonXp = profile.season?.seasonXp ?? 0;
  const statusLine = profile.profileStatus ?? t("header.default_status");
  const leagueTierId = coerceLeagueTierId(profile.season?.leagueTier);

  return (
    <header className="grid gap-8 pb-9 lg:grid-cols-[250px_minmax(0,1fr)] lg:gap-10">
      <div className="flex items-start justify-center lg:justify-end">
        <span className="inline-flex rounded-full bg-[conic-gradient(from_140deg,#00B8D9,#8BE8F7,#FFD166,#00B8D9)] p-[4px] shadow-token-card">
          <span className="inline-flex rounded-full bg-background p-[5px]">
            <Avatar className="h-40 w-40 bg-surface-container sm:h-44 sm:w-44 lg:h-52 lg:w-52">
              {profile.avatarUrl ? (
                <AvatarImage src={profile.avatarUrl} alt={profile.displayName} />
              ) : null}
              <AvatarFallback className="bg-[radial-gradient(circle_at_50%_22%,#FFFFFF_0%,#E5F8FC_52%,#CDECF3_100%)] text-5xl font-semibold text-[#102936]">
                {getInitials(profile.displayName)}
              </AvatarFallback>
            </Avatar>
          </span>
        </span>
      </div>

      <div className="min-w-0 pt-1 text-center lg:text-left">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-on-surface-variant">{handleLabel}</p>
            <h1 className="mt-2 text-balance text-[2.45rem] font-extrabold leading-none text-on-surface sm:text-[3rem]">
              {profile.displayName}
            </h1>
          </div>

          <ProfileConnectionActions
            profile={profile}
            initialConnection={data.connection}
            isPreview={isPrivacyPreview}
          />
        </div>

        <HeaderFeaturedAchievements achievements={featuredAchievements} />

        <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-sm font-medium text-on-surface-variant lg:justify-start">
          {profile.organization ? (
            <span className="inline-flex items-center gap-2">
              <Building2 className="h-4.5 w-4.5 text-on-surface-variant" />
              {profile.organization.name}
            </span>
          ) : null}
          <span className="inline-flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-success" />
            {statusLine}
          </span>
        </div>

        <div className="mt-7 grid grid-cols-2 gap-3 xl:grid-cols-4">
          <ProfileStatTile
            art={LEADERBOARD_LEAGUE_ASSETS[leagueTierId]}
            value={profile.season?.rank ? `#${profile.season.rank}` : "—"}
            label={
              profile.season?.rank
                ? t("header.rank_label")
                : t("header.unranked")
            }
          />
          <ProfileStatTile
            icon={<UsersRound className="size-5" />}
            value={formatNumber(profile.friendCounts.friends)}
            label={t("header.friends_label")}
          />
          <ProfileStatTile
            art={STAT_TILE_ART.level}
            value={
              profile.level != null
                ? t("header.level_value", { level: profile.level })
                : t("header.hidden")
            }
            label={t("header.level_label")}
          />
          <ProfileStatTile
            art={STAT_TILE_ART.seasonXp}
            value={formatNumber(seasonXp)}
            label={t("header.season_xp_label")}
          />
        </div>
      </div>
    </header>
  );
}

function ProfileTabs({
  activeTab,
  baseHref,
  range,
  pendingTab,
  onTabChange,
  onTabPrefetch,
}: {
  activeTab: ProfileSocialTab;
  baseHref: string;
  range: AnalyticsRangePreset;
  onTabChange: (tab: ProfileSocialTab) => void;
  onTabPrefetch: (tab: ProfileSocialTab) => void;
  pendingTab?: ProfileSocialTab | null;
}) {
  const t = useTranslations("profileSocial.tabs");

  return (
    <nav className="flex justify-center border-b border-outline-variant" aria-label={t("label")}>
      <div className="flex w-full max-w-[560px] items-center justify-center gap-4 sm:gap-10">
        {PROFILE_SOCIAL_TABS.map((tab) => {
          const isActive = activeTab === tab;
          const isPending = pendingTab === tab;
          const href = buildTabHref(baseHref, tab, range);
          return (
            <button
              key={tab}
              type="button"
              onClick={() => onTabChange(tab)}
              onFocus={() => onTabPrefetch(tab)}
              onPointerEnter={() => onTabPrefetch(tab)}
              aria-current={isActive ? "page" : undefined}
              aria-busy={isPending ? true : undefined}
              data-href={href}
              className={cn(
                "relative inline-flex h-[3.75rem] min-w-[7.5rem] items-center justify-center gap-2 text-sm font-bold transition-colors",
                isActive
                  ? "text-primary-dim"
                  : "text-on-surface-variant hover:text-on-surface"
              )}
            >
              {isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : TAB_ICONS[tab]}
              {t(tab)}
              {isActive ? (
                <motion.span
                  layoutId="profile-tab-underline"
                  transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                  className="absolute bottom-0 left-3 right-3 h-[2.5px] rounded-full bg-primary"
                />
              ) : null}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function coerceShellFeaturedAchievements(
  value: PublicProfileShell["featuredAchievements"],
  t: ReturnType<typeof useTranslations<"profileSocial">>
) {
  if (!Array.isArray(value)) return [];

  return value
    .map(coerceProfileAchievementItem)
    .filter((achievement): achievement is ProfileAchievementItem => Boolean(achievement))
    .map((achievement) => localizeAchievementItem(achievement, t));
}

function PrivacyPanel({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <section className="rounded-xl border border-dashed border-outline-variant bg-white px-6 py-16 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-surface-container text-on-surface-variant">
        <ShieldCheck className="h-6 w-6" />
      </div>
      <h2 className="mt-5 text-xl font-semibold text-on-surface">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-on-surface-variant">{body}</p>
    </section>
  );
}

function TabBody({
  tab,
  data,
  analyticsData,
  publicAnalyticsData,
  activityFeedData,
  achievementsData,
  range,
  isRangePending,
  onRangeChange,
}: {
  tab: ProfileSocialTab;
  data: PublicProfileData;
  analyticsData?: AnalyticsPageData | null;
  publicAnalyticsData?: ProfileAnalyticsTabData | null;
  activityFeedData?: ProfileActivityFeedData | null;
  achievementsData?: ProfileAchievementsData | null;
  range: AnalyticsRangePreset;
  isRangePending?: boolean;
  onRangeChange: (range: AnalyticsRangePreset) => void;
}) {
  const t = useTranslations("profileSocial");
  const profile = data.profile;
  const visible = data.visibleSections ?? {};

  if (!profile) {
    return (
      <PrivacyPanel
        title={t(`states.${data.state}.title`)}
        body={t(`states.${data.state}.body`)}
      />
    );
  }

  if (tab === "analytics") {
    if (analyticsData) {
      return (
        <ProfileAnalyticsTab
          analyticsData={analyticsData}
          profile={profile}
          range={range}
          isRangePending={isRangePending}
          onRangeChange={onRangeChange}
        />
      );
    }

    if (visible.analytics && publicAnalyticsData?.state === "visible") {
      return (
        <PublicProfileAnalyticsTab
          profile={profile}
          data={publicAnalyticsData}
          range={range}
          isRangePending={isRangePending}
          onRangeChange={onRangeChange}
        />
      );
    }

    return (
      <PrivacyPanel
        title={t("states.analytics_private.title")}
        body={t("states.analytics_private.body")}
      />
    );
  }

  if (tab === "activities") {
    if ((!visible.activities && data.state !== "self") || activityFeedData?.state === "private") {
      return (
        <PrivacyPanel
          title={t("states.activities_private.title")}
          body={t("states.activities_private.body")}
        />
      );
    }

    return <ProfileActivitiesTab data={activityFeedData} />;
  }

  if (
    (!visible.achievements && data.state !== "self") ||
    achievementsData?.state === "private"
  ) {
    return (
      <PrivacyPanel
        title={t("states.achievements_private.title")}
        body={t("states.achievements_private.body")}
      />
    );
  }

  return <ProfileAchievementsTab data={achievementsData} />;
}

export function SocialProfilePage({
  publicProfile,
  analyticsData,
  publicAnalyticsData,
  activityFeedData,
  achievementsData,
  activeTab,
  baseHref,
  range,
  privacyPreview = false,
}: SocialProfilePageProps) {
  const t = useTranslations("profileSocial");
  const locale = useLocale();
  const router = useRouter();
  const localizedPublicProfile = useMemo(
    () => localizePublicProfileData(publicProfile, t),
    [publicProfile, t]
  );
  const localizedAchievementsData = useMemo(
    () => localizeAchievementsData(achievementsData, t),
    [achievementsData, t]
  );
  const shellFeaturedAchievements = useMemo(
    () =>
      coerceShellFeaturedAchievements(
        localizedPublicProfile.profile?.featuredAchievements ?? null,
        t
      ),
    [localizedPublicProfile.profile?.featuredAchievements, t]
  );
  const profile = localizedPublicProfile.profile;
  const pageTitle = profile?.displayName ?? t("title");
  const [currentRange, setCurrentRange] = useState(range);
  const [pendingTab, setPendingTab] = useState<ProfileSocialTab | null>(null);
  const [isTabPending, startTabTransition] = useTransition();
  const [isRangePending, startRangeTransition] = useTransition();

  const localeKey = useMemo(() => locale, [locale]);

  useEffect(() => {
    setCurrentRange(range);
  }, [range]);

  useEffect(() => {
    setPendingTab(null);
  }, [activeTab]);

  const handleTabChange = useCallback(
    (nextTab: ProfileSocialTab) => {
      if (nextTab === activeTab) {
        return;
      }

      setPendingTab(nextTab);
      startTabTransition(() => {
        router.push(buildTabHref(baseHref, nextTab, currentRange), {
          scroll: false,
        });
      });
    },
    [activeTab, baseHref, currentRange, router]
  );

  const handleTabPrefetch = useCallback(
    (nextTab: ProfileSocialTab) => {
      if (nextTab === activeTab) {
        return;
      }

      router.prefetch(buildTabHref(baseHref, nextTab, currentRange));
    },
    [activeTab, baseHref, currentRange, router]
  );

  const handleRangeChange = useCallback(
    (nextRange: AnalyticsRangePreset) => {
      if (nextRange === currentRange) {
        return;
      }

      setCurrentRange(nextRange);
      startRangeTransition(() => {
        router.replace(buildAnalyticsRangeHref(baseHref, nextRange), {
          scroll: false,
        });
      });
    },
    [baseHref, currentRange, router]
  );

  return (
    <main
      className="min-h-full bg-background text-on-surface"
      data-testid="profile-social-page"
      data-locale={localeKey}
    >
      <div className="mx-auto w-full max-w-[1180px] px-4 py-7 sm:px-6 lg:px-8">
        <div className="sr-only">
          <h1>{pageTitle}</h1>
        </div>

        {profile ? (
          <>
            {privacyPreview ? (
              <div className="mb-5 flex items-center gap-3 rounded-lg border border-outline-variant bg-white px-4 py-3 text-sm text-on-surface-variant">
                <Eye className="h-4 w-4 shrink-0 text-primary" />
                <span>{t("privacy_preview")}</span>
              </div>
            ) : null}
            <ProfileHeader
              data={localizedPublicProfile}
              featuredAchievements={
                localizedAchievementsData?.featured ?? shellFeaturedAchievements
              }
              isPrivacyPreview={privacyPreview}
            />
            <div className="mt-7">
              <ProfileTabs
                activeTab={activeTab}
                baseHref={baseHref}
                range={currentRange}
                pendingTab={isTabPending ? pendingTab : null}
                onTabChange={handleTabChange}
                onTabPrefetch={handleTabPrefetch}
              />
            </div>
            <div className="mt-5">
              <TabBody
                tab={activeTab}
                data={localizedPublicProfile}
                analyticsData={analyticsData}
                publicAnalyticsData={publicAnalyticsData}
                activityFeedData={activityFeedData}
                achievementsData={localizedAchievementsData}
                range={currentRange}
                isRangePending={isRangePending}
                onRangeChange={handleRangeChange}
              />
            </div>
          </>
        ) : (
          <>
            {privacyPreview ? (
              <div className="mb-5 flex items-center gap-3 rounded-lg border border-outline-variant bg-white px-4 py-3 text-sm text-on-surface-variant">
                <Eye className="h-4 w-4 shrink-0 text-primary" />
                <span>{t("privacy_preview")}</span>
              </div>
            ) : null}
            <PrivacyPanel
              title={t(`states.${localizedPublicProfile.state}.title`)}
              body={t(`states.${localizedPublicProfile.state}.body`)}
            />
          </>
        )}
      </div>
    </main>
  );
}
