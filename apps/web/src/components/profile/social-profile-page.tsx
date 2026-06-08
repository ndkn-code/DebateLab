"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
  type ReactNode,
} from "react";
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
  ChevronRight,
  Clock3,
  Copy,
  Eye,
  ListChecks,
  Loader2,
  Medal,
  MoreHorizontal,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Star,
  Target,
  Trophy,
  UserPlus,
  UserRoundPlus,
  UsersRound,
  X,
} from "@/components/ui/icons";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ProfileAchievementsTab } from "@/components/profile/profile-achievements-tab";
import { ProfileActivitiesTab } from "@/components/profile/profile-activities-tab";
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
import type {
  AnalyticsInsightCard,
  AnalyticsPageData,
  AnalyticsRangePreset,
} from "@/types";

type PracticeMinutesInsight = Extract<
  AnalyticsInsightCard,
  { key: "practice-minutes" }
>;
type AverageScoreInsight = Extract<
  AnalyticsInsightCard,
  { key: "recent-average-score" }
>;
type MixInsight = Extract<
  AnalyticsInsightCard,
  { key: "speaking-vs-debate" }
>;
type StrongestFocusInsight = Extract<
  AnalyticsInsightCard,
  { key: "strongest-focus" }
>;

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

function titleCase(value: string | null | undefined) {
  if (!value) return "Novice";
  return value
    .split(/[_-]/g)
    .filter(Boolean)
    .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
    .join(" ");
}

function formatLeagueTier(
  value: string | null | undefined,
  t: ReturnType<typeof useTranslations<"profileSocial.analytics">>
) {
  const key = normalizeSystemCopyKey(value);
  if (!key) return t("league_novice");
  if (key === "constructive") return t("league_gold_iii");
  if (key === "novice") return t("league_novice");
  return titleCase(value);
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

function findInsight<T extends AnalyticsInsightCard["key"]>(
  insights: AnalyticsInsightCard[],
  key: T
) {
  return insights.find((insight) => insight.key === key) as
    | Extract<AnalyticsInsightCard, { key: T }>
    | undefined;
}

function ProfileMetric({
  icon,
  value,
  label,
}: {
  icon: ReactNode;
  value: ReactNode;
  label: string;
}) {
  const accessibilityLabel =
    typeof value === "string" || typeof value === "number"
      ? `${value} ${label}`
      : label;

  return (
    <div
      aria-label={accessibilityLabel}
      className="flex min-w-[8.5rem] items-center justify-center gap-3 border-outline-variant/70 px-4 last:border-r-0 sm:border-r"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center text-primary">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[1.05rem] font-semibold leading-5 text-on-surface">
          {value}
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

function HeaderFeaturedAchievements({
  achievements,
}: {
  achievements: ProfileAchievementItem[];
}) {
  const t = useTranslations("profileSocial.achievements");

  if (achievements.length === 0) return null;

  return (
    <div className="mt-4 flex flex-wrap items-center justify-center gap-2 lg:justify-start">
      {achievements.slice(0, 3).map((achievement) => (
        <span
          key={achievement.id}
          className="inline-flex h-8 items-center gap-2 rounded-lg border border-outline-variant bg-white px-2.5 text-xs font-semibold text-on-surface-variant shadow-token-card"
          title={achievement.title}
        >
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-surface-container text-[11px] text-primary-dim">
            {achievement.icon}
          </span>
          <span className="max-w-[8.5rem] truncate">{achievement.title}</span>
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
  const rankLabel = profile.season?.rank ? `#${profile.season.rank}` : t("header.unranked");
  const statusLine = profile.profileStatus ?? t("header.default_status");

  return (
    <header className="grid gap-8 pb-9 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-10">
      <div className="flex justify-center lg:justify-end">
        <Avatar className="h-40 w-40 border border-outline-variant bg-surface-container shadow-token-card sm:h-48 sm:w-48 lg:h-56 lg:w-56">
          {profile.avatarUrl ? (
            <AvatarImage src={profile.avatarUrl} alt={profile.displayName} />
          ) : null}
          <AvatarFallback className="bg-[radial-gradient(circle_at_50%_22%,#FFFFFF_0%,#E5F8FC_52%,#CDECF3_100%)] text-5xl font-semibold text-on-surface">
            {getInitials(profile.displayName)}
          </AvatarFallback>
        </Avatar>
      </div>

      <div className="min-w-0 pt-1 text-center lg:text-left">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-on-surface-variant">{handleLabel}</p>
            <h1 className="mt-2 text-balance text-[2.45rem] font-semibold leading-none text-on-surface sm:text-[3rem]">
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

        <div className="mt-7 flex flex-wrap items-center justify-center gap-4 text-sm text-on-surface-variant lg:justify-start">
          {profile.organization ? (
            <span className="inline-flex items-center gap-2">
              <Building2 className="h-4.5 w-4.5 text-on-surface-variant" />
              {profile.organization.name}
            </span>
          ) : null}
          {profile.organization ? <span className="text-on-surface-variant">.</span> : null}
          <span className="inline-flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-success" />
            {statusLine}
          </span>
        </div>

        <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <ProfileMetric
            icon={<Trophy className="h-5 w-5" />}
            value={t("header.rank_value", { rank: rankLabel })}
            label={t("header.rank_label")}
          />
          <ProfileMetric
            icon={<UsersRound className="h-5 w-5" />}
            value={t("header.friends_value", {
              count: profile.friendCounts.friends,
            })}
            label={t("header.friends_label")}
          />
          <ProfileMetric
            icon={<BarChart3 className="h-5 w-5" />}
            value={
              profile.level != null
                ? t("header.level_value", { level: profile.level })
                : t("header.hidden")
            }
            label={t("header.level_label")}
          />
          <ProfileMetric
            icon={<Star className="h-5 w-5" />}
            value={t("header.season_xp_value", { count: seasonXp })}
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
                "relative inline-flex h-[3.75rem] min-w-[7.5rem] items-center justify-center gap-2 text-sm font-semibold transition-colors",
                isActive
                  ? "text-primary-dim"
                  : "text-on-surface-variant hover:text-on-surface"
              )}
            >
              {isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : TAB_ICONS[tab]}
              {t(tab)}
              {isActive ? (
                <span className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full bg-primary" />
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

function AnalyticsRangeControl({
  range,
  isPending,
  onRangeChange,
}: {
  range: AnalyticsRangePreset;
  isPending?: boolean;
  onRangeChange: (range: AnalyticsRangePreset) => void;
}) {
  const t = useTranslations("analyticsPage");
  const ranges: AnalyticsRangePreset[] = ["7d", "30d", "90d"];

  return (
    <div
      className={cn(
        "inline-flex h-10 rounded-lg border border-outline-variant bg-white p-1 transition-opacity duration-200",
        isPending ? "opacity-90" : "opacity-100"
      )}
      aria-label={t("range_label")}
      aria-busy={isPending ? "true" : undefined}
    >
      {ranges.map((item) => {
        const active = item === range;
        return (
          <button
            key={item}
            type="button"
            aria-pressed={active}
            onClick={() => onRangeChange(item)}
            className={cn(
              "inline-flex min-w-12 items-center justify-center rounded-md px-3 text-sm font-semibold transition-all duration-200 ease-out",
              active
                ? "bg-primary text-white shadow-token-primary"
                : "text-on-surface-variant hover:bg-background hover:text-on-surface"
            )}
          >
            {t(`range_${item}`)}
          </button>
        );
      })}
    </div>
  );
}

function Card({
  title,
  action,
  children,
  className,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "min-w-0 rounded-xl border border-outline-variant bg-white p-5 shadow-token-card",
        className
      )}
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-on-surface">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function RadarChart({
  data,
}: {
  data: AnalyticsPageData["skillSnapshot"];
}) {
  const t = useTranslations("analyticsPage.skills");
  const metrics = data.metrics.slice(0, 5);
  const center = 112;
  const radius = 70;

  function point(index: number, value: number, extra = 0) {
    const angle = -Math.PI / 2 + (index * Math.PI * 2) / Math.max(metrics.length, 1);
    const scaled = radius * (value / 100) + extra;
    return {
      x: center + Math.cos(angle) * scaled,
      y: center + Math.sin(angle) * scaled,
    };
  }

  const polygon = metrics
    .map((metric, index) => {
      const p = point(index, metric.coverage > 0 ? metric.value : 0);
      return `${p.x},${p.y}`;
    })
    .join(" ");

  return (
    <div className="flex justify-center">
      <svg viewBox="0 0 224 224" className="h-[224px] w-full max-w-[284px]" aria-hidden="true">
        {[20, 40, 60, 80, 100].map((value) => (
          <polygon
            key={value}
            points={metrics
              .map((_, index) => {
                const p = point(index, value);
                return `${p.x},${p.y}`;
              })
              .join(" ")}
            fill={value === 100 ? "transparent" : "rgba(0,184,217,0.035)"}
            stroke="rgba(65,80,105,0.20)"
            strokeWidth="1"
          />
        ))}
        {metrics.map((_, index) => {
          const p = point(index, 100);
          return (
            <line
              key={index}
              x1={center}
              y1={center}
              x2={p.x}
              y2={p.y}
              stroke="rgba(65,80,105,0.16)"
            />
          );
        })}
        <polygon
          points={polygon}
          fill="rgba(0,184,217,0.16)"
          stroke="#0788A0"
          strokeWidth="2"
        />
        {metrics.map((metric, index) => {
          const labelPoint = point(index, 100, 26);
          const anchor =
            Math.abs(labelPoint.x - center) < 8
              ? "middle"
              : labelPoint.x > center
                ? "start"
                : "end";
          return (
            <g key={metric.key}>
              <text
                x={labelPoint.x}
                y={labelPoint.y}
                textAnchor={anchor}
                dominantBaseline="central"
              >
                <tspan
                  x={labelPoint.x}
                  dy="-0.35em"
                  className="fill-primary text-[10px] font-medium"
                >
                  {t(metric.key)}
                </tspan>
                <tspan
                  x={labelPoint.x}
                  dy="1.35em"
                  className="fill-primary text-[11px] font-semibold"
                >
                  {Math.round(metric.value)}
                </tspan>
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function MiniBars({ insight }: { insight: PracticeMinutesInsight | undefined }) {
  const visibleSeries = insight?.series.slice(-7) ?? [];
  const values =
    visibleSeries.length > 0
      ? visibleSeries.map((point) => point.value)
      : [0, 0, 0, 0, 0, 0, 0];
  const max = Math.max(...values, 1);

  return (
    <div className="mt-7 flex h-[152px] items-end gap-4 border-b border-dashed border-outline-variant px-1">
      {values.slice(-7).map((value, index) => (
        <div key={`${value}-${index}`} className="flex flex-1 flex-col items-center gap-2">
          <div
            className="w-full max-w-[18px] rounded-t-md bg-[linear-gradient(180deg,#8BE8F7_0%,#00B8D9_100%)]"
            style={{ height: `${Math.max(16, (value / max) * 128)}px` }}
          />
          <span className="text-[11px] font-medium text-on-surface-variant">
            {visibleSeries[index]?.label ?? ""}
          </span>
        </div>
      ))}
    </div>
  );
}

function InlineCardLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="mt-5 flex h-10 items-center justify-between rounded-lg border border-outline-variant bg-background px-3 text-sm font-medium text-on-surface-variant transition hover:border-outline-variant hover:text-on-surface"
    >
      {children}
      <ChevronRight className="h-4 w-4" />
    </Link>
  );
}

function SeasonPerformanceCard({ profile }: { profile: PublicProfileShell }) {
  const t = useTranslations("profileSocial.analytics");
  const seasonXp = profile.season?.seasonXp ?? 0;
  const nextTarget = Math.max(1000, Math.ceil((seasonXp + 1) / 1000) * 1000);
  const remaining = Math.max(0, nextTarget - seasonXp);
  const progress = Math.min(100, Math.round((seasonXp / nextTarget) * 100));

  return (
    <Card title={t("season_performance")}>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-5">
        <div>
          <p className="text-2xl font-semibold leading-none text-primary-dim">
            {formatNumber(seasonXp)}
          </p>
          <p className="mt-1 text-sm text-on-surface-variant">{t("season_xp")}</p>
        </div>
        <div className="h-12 w-px bg-surface-container-high" />
        <div>
          <p className="text-2xl font-semibold leading-none text-on-surface">
            {profile.season?.rank ? `#${profile.season.rank}` : "-"}
          </p>
          <p className="mt-1 text-sm text-on-surface-variant">{t("in_your_league")}</p>
        </div>
      </div>

      <div className="mt-7">
        <div className="h-2 overflow-hidden rounded-full bg-surface-container-high">
          <div
            className="h-full rounded-full bg-primary"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="mt-3 text-sm text-on-surface-variant">
          {t("xp_to_next_rank", { count: remaining })}
        </p>
      </div>

      <div className="mt-7 flex items-center justify-between rounded-lg border border-outline-variant bg-background px-4 py-4">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-warning bg-surface-container text-warning">
            <Medal className="h-6 w-6" />
          </span>
          <div>
            <p className="text-xs font-medium text-on-surface-variant">{t("current_league")}</p>
            <p className="text-base font-semibold text-on-surface">
              {formatLeagueTier(profile.season?.leagueTier, t)}
            </p>
          </div>
        </div>
        <ChevronRight className="h-5 w-5 text-on-surface" />
      </div>

      <InlineCardLink href="/leaderboards">{t("view_leaderboard")}</InlineCardLink>
    </Card>
  );
}

function ProfileAnalyticsOverview({
  analyticsData,
  profile,
  baseHref,
  range,
  isRangePending,
  onRangeChange,
}: {
  analyticsData: AnalyticsPageData;
  profile: PublicProfileShell;
  baseHref: string;
  range: AnalyticsRangePreset;
  isRangePending?: boolean;
  onRangeChange: (range: AnalyticsRangePreset) => void;
}) {
  const t = useTranslations("profileSocial.analytics");
  const tAnalytics = useTranslations("analyticsPage");
  const practiceMinutes = findInsight(
    analyticsData.insights,
    "practice-minutes"
  ) as PracticeMinutesInsight | undefined;
  const averageScore = findInsight(
    analyticsData.insights,
    "recent-average-score"
  ) as AverageScoreInsight | undefined;
  const strongestFocus = findInsight(
    analyticsData.insights,
    "strongest-focus"
  ) as StrongestFocusInsight | undefined;
  const mix = findInsight(analyticsData.insights, "speaking-vs-debate") as
    | MixInsight
    | undefined;
  const totalMix = (mix?.speakingCount ?? 0) + (mix?.debateCount ?? 0);

  return (
    <div className="grid gap-5">
      <div className="flex justify-end">
        <AnalyticsRangeControl
          range={range}
          isPending={isRangePending}
          onRangeChange={onRangeChange}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <Card title={t("skill_snapshot")}>
          <RadarChart data={analyticsData.skillSnapshot} />
          <InlineCardLink href={buildTabHref(baseHref, "analytics", range)}>
            {t("view_full_breakdown")}
          </InlineCardLink>
        </Card>

        <Card title={t("weekly_practice")}>
          <div className="flex items-end gap-2">
            <p className="text-[2rem] font-semibold leading-none text-on-surface">
              {formatNumber(practiceMinutes?.totalMinutes ?? 0)}
            </p>
            <p className="pb-1 text-sm text-on-surface-variant">{t("minutes")}</p>
          </div>
          <p
            className={cn(
              "mt-2 text-sm font-medium",
              practiceMinutes?.deltaPercent != null &&
                practiceMinutes.deltaPercent >= 0
                ? "text-success"
                : "text-on-surface-variant"
            )}
          >
            {practiceMinutes?.deltaPercent != null
              ? t("practice_delta", {
                  count: Math.abs(practiceMinutes.deltaPercent),
                })
              : tAnalytics("cards.practice_minutes.no_delta")}
          </p>
          <MiniBars insight={practiceMinutes} />
          <InlineCardLink href={buildTabHref(baseHref, "activities", range)}>
            {t("view_practice_history")}
          </InlineCardLink>
        </Card>

        <SeasonPerformanceCard profile={profile} />
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <Card title={t("practice_mix")}>
          <div className="grid gap-4 sm:grid-cols-[8rem_minmax(0,1fr)] sm:items-center">
            <div className="relative mx-auto flex h-28 w-28 items-center justify-center rounded-full border-[10px] border-outline-variant">
              <div
                className="absolute inset-[-10px] rounded-full"
                style={{
                  background: `conic-gradient(#00B8D9 ${mix?.debatePercent ?? 0}%, #8BE8F7 0)`,
                  WebkitMask:
                    "radial-gradient(circle, transparent 52%, #000 53%)",
                  mask: "radial-gradient(circle, transparent 52%, #000 53%)",
                }}
              />
              <div className="relative text-center">
                <p className="text-2xl font-semibold text-on-surface">
                  {totalMix}
                </p>
                <p className="text-xs font-medium text-on-surface-variant">
                  {t("sessions")}
                </p>
              </div>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between gap-4">
                <span className="inline-flex items-center gap-2 text-on-surface-variant">
                  <span className="h-2.5 w-2.5 rounded-full bg-primary" />
                  {tAnalytics("cards.mix.debate")}
                </span>
                <span className="font-semibold text-on-surface">
                  {mix?.debatePercent ?? 0}%
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="inline-flex items-center gap-2 text-on-surface-variant">
                  <span className="h-2.5 w-2.5 rounded-full bg-primary-fixed" />
                  {tAnalytics("cards.mix.speaking")}
                </span>
                <span className="font-semibold text-on-surface">
                  {mix?.speakingPercent ?? 0}%
                </span>
              </div>
            </div>
          </div>
          <InlineCardLink href={buildTabHref(baseHref, "activities", range)}>
            {t("view_activity_breakdown")}
          </InlineCardLink>
        </Card>

        <Card title={t("average_score")}>
          <div className="flex items-end gap-2">
            <p className="text-[2rem] font-semibold leading-none text-on-surface">
              {averageScore?.averageScore != null
                ? Math.round(averageScore.averageScore)
                : "-"}
            </p>
            <p className="pb-1 text-sm text-on-surface-variant">/100</p>
          </div>
          <p className="mt-2 text-sm text-on-surface-variant">
            {averageScore?.deltaPoints != null
              ? t("score_delta", {
                  count: Math.abs(Math.round(averageScore.deltaPoints)),
                })
              : tAnalytics("cards.average_score.no_delta")}
          </p>
        </Card>

        <Card title={t("strongest_focus")}>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-outline-variant bg-background p-4">
              <div className="flex items-center gap-3">
                <Target className="h-5 w-5 text-success" />
                <span className="text-sm font-medium text-on-surface-variant">
                  {tAnalytics("cards.strongest_focus.strongest")}
                </span>
              </div>
              <p className="mt-3 text-lg font-semibold text-on-surface">
                {strongestFocus?.strongestSkill
                  ? tAnalytics(`skills.${strongestFocus.strongestSkill}`)
                  : "-"}
              </p>
            </div>
            <div className="rounded-lg border border-outline-variant bg-background p-4">
              <div className="flex items-center gap-3">
                <Sparkles className="h-5 w-5 text-warning" />
                <span className="text-sm font-medium text-on-surface-variant">
                  {tAnalytics("cards.strongest_focus.focus_next")}
                </span>
              </div>
              <p className="mt-3 text-lg font-semibold text-on-surface">
                {strongestFocus?.focusSkill
                  ? tAnalytics(`skills.${strongestFocus.focusSkill}`)
                  : "-"}
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

function PublicAnalyticsSummary({
  profile,
  data,
  range,
  isRangePending,
  onRangeChange,
}: {
  profile: PublicProfileShell;
  data: ProfileAnalyticsTabData | null | undefined;
  range: AnalyticsRangePreset;
  isRangePending?: boolean;
  onRangeChange: (range: AnalyticsRangePreset) => void;
}) {
  const t = useTranslations("profileSocial.analytics");
  const tHeader = useTranslations("profileSocial.header");
  const totalMix = (data?.speakingCount ?? 0) + (data?.debateCount ?? 0);

  return (
    <div className="grid gap-5">
      <div className="flex justify-end">
        <AnalyticsRangeControl
          range={range}
          isPending={isRangePending}
          onRangeChange={onRangeChange}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <SeasonPerformanceCard profile={profile} />
        <Card title={t("weekly_practice")}>
          <p className="text-[2rem] font-semibold text-on-surface">
            {formatNumber(data?.totalPracticeMinutes ?? 0)}
          </p>
          <p className="mt-1 text-sm text-on-surface-variant">{t("minutes")}</p>
          <p className="mt-5 text-sm text-on-surface-variant">
            {t("sessions_in_range", { count: data?.totalSessions ?? 0 })}
          </p>
        </Card>
        <Card title={t("average_score")}>
          <div className="flex items-end gap-2">
            <p className="text-[2rem] font-semibold text-on-surface">
              {data?.averageScore != null ? Math.round(data.averageScore) : "-"}
            </p>
            <p className="pb-1 text-sm text-on-surface-variant">/100</p>
          </div>
          <p className="mt-2 text-sm text-on-surface-variant">
            {t("sessions_analyzed", { count: data?.totalSessions ?? 0 })}
          </p>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <Card title={t("practice_mix")}>
          <p className="text-[2rem] font-semibold text-on-surface">{totalMix}</p>
          <p className="mt-1 text-sm text-on-surface-variant">{t("sessions")}</p>
          <div className="mt-5 grid gap-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-on-surface-variant">{t("debate_sessions")}</span>
              <span className="font-semibold text-on-surface">
                {data?.debateCount ?? 0}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-on-surface-variant">{t("speaking_sessions")}</span>
              <span className="font-semibold text-on-surface">
                {data?.speakingCount ?? 0}
              </span>
            </div>
          </div>
        </Card>
        <Card title={t("profile_level")}>
          <p className="text-[2rem] font-semibold text-on-surface">
            {data?.level != null
              ? tHeader("level_value", { level: data.level })
              : tHeader("hidden")}
          </p>
          <p className="mt-2 text-sm text-on-surface-variant">
            {data?.lifetimeXp != null
              ? t("lifetime_xp", { count: data.lifetimeXp })
              : t("private_metric")}
          </p>
        </Card>
        <Card title={t("friend_network")}>
          <p className="text-[2rem] font-semibold text-on-surface">
            {profile.friendCounts.friends}
          </p>
          <p className="mt-2 text-sm text-on-surface-variant">{t("friends")}</p>
        </Card>
      </div>
    </div>
  );
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
  baseHref,
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
  baseHref: string;
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
        <ProfileAnalyticsOverview
          analyticsData={analyticsData}
          profile={profile}
          baseHref={baseHref}
          range={range}
          isRangePending={isRangePending}
          onRangeChange={onRangeChange}
        />
      );
    }

    if (visible.analytics && publicAnalyticsData?.state === "visible") {
      return (
        <PublicAnalyticsSummary
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
                baseHref={baseHref}
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
