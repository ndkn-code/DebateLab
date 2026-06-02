"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { motion, useReducedMotion } from "framer-motion";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import {
  ChevronUp,
  CheckCircle2,
  Clock3,
  Crown,
  Info,
  Lock,
  Loader2,
  Medal,
  RotateCcw,
  ThumbsUp,
  TrendingDown,
  Trophy,
  UserPlus,
  Users2,
} from "@/components/ui/icons";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Link } from "@/i18n/navigation";
import { PageTransition } from "@/components/shared/page-motion";
import { PageContainer } from "@/components/shared/product-layout";
import { SeasonReplayDialog } from "@/components/leaderboards/season-replay-dialog";
import { sendLeaderboardKudos } from "@/app/actions/leaderboards";
import { requestProfileConnection } from "@/app/actions/profile-social";
import { trackAnalyticsEvent } from "@/lib/hooks/useAnalyticsEventTracker";
import { cn } from "@/lib/utils";
import {
  getSeasonReplayCopy,
  getLocalizedLeagueName,
  getSeasonReplayDismissalKey,
  isReplayableSeasonOutcome,
} from "@/lib/leaderboards/replay";
import { LEADERBOARD_LEAGUE_ASSETS } from "@/lib/leaderboards/league-assets";
import type {
  LeaderboardPageData,
  LeaderboardKudosTargetState,
  OrganizationBand,
  OrganizationLeaderboardRow,
  PersonalLeaderboardRow,
  PersonalLeagueTier,
  PromotionZone,
} from "@/lib/leaderboards/types";

type LeaderboardView = "personal" | "organizations";
type LeaderboardTranslator = (
  key: string,
  values?: Record<string, string | number>
) => string;

const PERSONAL_VISIBLE_ROWS = 12;
const ORGANIZATION_VISIBLE_ROWS = 10;

function formatXp(value: number, locale: string) {
  return `${new Intl.NumberFormat(locale === "vi" ? "vi-VN" : "en-US").format(
    value
  )} XP`;
}

function getRuleText(data: LeaderboardPageData, t: LeaderboardTranslator) {
  const { personal } = data;

  if (personal.league.id === "champion") {
    return t("rules.champion", { count: personal.championCount });
  }

  if (!personal.demotionEnabled) {
    return t("rules.promotionOnly", { count: personal.promotionCount });
  }

  return t("rules.promotionAndDemotion", {
    promoteCount: personal.promotionCount,
    demoteCount: personal.demotionCount,
  });
}

function RankBadge({ rank, highlighted = false }: { rank: number; highlighted?: boolean }) {
  const medalTone =
    rank === 1
      ? "text-[#d4a400]"
      : rank === 2
        ? "text-[#7c8da1]"
        : rank === 3
          ? "text-[#b56f30]"
          : highlighted
            ? "text-current"
            : "text-[#54b66d]";

  return (
    <span
      className={cn(
        "flex w-8 shrink-0 justify-end text-sm font-black tabular-nums sm:w-10",
        medalTone
      )}
      aria-label={`Rank ${rank}`}
    >
      {rank}
    </span>
  );
}

function currentUserRowTone(zone: PromotionZone) {
  if (zone === "champion" || zone === "promote") {
    return "bg-[#dff4e7] text-[#0B1424] shadow-[0_16px_44px_rgba(34,197,94,0.16)]";
  }

  if (zone === "demote") {
    return "bg-[#ffe1e8] text-[#0B1424] shadow-[0_16px_44px_rgba(244,63,94,0.16)]";
  }

  return "bg-[#eaf2ff] text-[#0B1424] shadow-[0_16px_44px_rgba(77,134,247,0.14)]";
}

function currentUserAvatarTone(zone: PromotionZone) {
  if (zone === "champion" || zone === "promote") {
    return "bg-[#35b86f] text-white";
  }

  if (zone === "demote") {
    return "bg-[#ef4d5f] text-white";
  }

  return "bg-[#4d86f7] text-white";
}

function LeagueCrest({
  tier,
  prefersReducedMotion,
}: {
  tier: PersonalLeagueTier;
  prefersReducedMotion: boolean;
}) {
  const isCurrent = tier.status === "current";
  const isLocked = tier.status === "locked";
  const assetSrc = LEADERBOARD_LEAGUE_ASSETS[tier.id];

  return (
    <div className="flex min-w-0 flex-col items-center gap-2">
      <motion.div
        layout={!prefersReducedMotion}
        className={cn(
          "relative flex size-[70px] items-center justify-center transition-all sm:size-[88px]",
          isLocked ? "opacity-45 saturate-0" : "opacity-100",
          isCurrent
            ? "scale-110 drop-shadow-[0_20px_34px_rgba(59,130,246,0.22)]"
            : "drop-shadow-[0_10px_18px_rgba(15,23,42,0.12)]"
        )}
        aria-label={tier.name}
      >
        <Image
          src={assetSrc}
          alt=""
          width={176}
          height={176}
          className="size-full object-contain"
          draggable={false}
          priority={isCurrent}
        />
        {isCurrent ? (
          <span className="absolute inset-x-3 bottom-0 h-3 rounded-full bg-[#4d86f7]/18 blur-md" />
        ) : null}
        {isLocked ? (
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="flex size-8 items-center justify-center rounded-full bg-white/82 text-[#98a2b3] shadow-[0_8px_18px_rgba(15,23,42,0.12)] backdrop-blur-sm">
              <Lock className="size-4" />
            </span>
          </span>
        ) : null}
      </motion.div>
      <span
        className={cn(
          "hidden max-w-24 truncate text-xs font-semibold sm:block",
          isCurrent ? "text-[#0B1424]" : "text-[#9aa3b1]"
        )}
      >
        {tier.shortName}
      </span>
    </div>
  );
}

function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: string; helper?: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div
      aria-label={label}
      className="inline-flex max-w-full rounded-full border border-[#e2e7ef] bg-[#f6f8fb] p-1"
    >
      {options.map((option) => {
        const active = value === option.value;

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            title={option.helper}
            className={cn(
              "min-h-9 rounded-full px-4 text-sm font-bold transition-all",
              active
                ? "bg-white text-[#0B1424] shadow-[0_8px_22px_rgba(15,23,42,0.10)]"
                : "text-[#718096] hover:text-[#0B1424]"
            )}
            aria-pressed={active}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function PersonalRow({
  row,
  prefersReducedMotion,
  locale,
  kudosState,
  onSendKudos,
  kudosPending,
  onRequestConnection,
  connectionPending,
  connectionRequested,
}: {
  row: PersonalLeaderboardRow;
  prefersReducedMotion: boolean;
  locale: string;
  kudosState?: LeaderboardKudosTargetState;
  onSendKudos?: (row: PersonalLeaderboardRow) => void;
  kudosPending?: boolean;
  onRequestConnection?: (row: PersonalLeaderboardRow) => void;
  connectionPending?: boolean;
  connectionRequested?: boolean;
}) {
  const canRequestConnection =
    !row.isCurrentUser &&
    (connectionRequested ||
      row.connection?.status === "pending_sent" ||
      row.connection?.status === "accepted" ||
      row.viewerCanRequest ||
      row.connection?.viewerCanRequest);
  const profileContent = (
    <>
      <Avatar className="size-10 shrink-0 bg-[#eef2f7] sm:size-11">
        {row.avatarUrl ? <AvatarImage src={row.avatarUrl} alt={row.displayName} /> : null}
        <AvatarFallback
          className={cn(
            "text-sm font-black",
            row.isCurrentUser
              ? currentUserAvatarTone(row.zone)
              : "bg-[#eef2f7] text-[#566170]"
          )}
        >
          {row.initials}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1 text-left">
        <div className="flex min-w-0 flex-nowrap items-center gap-x-2 gap-y-1">
          <p className="min-w-0 flex-1 truncate text-sm font-black sm:text-base">
            {row.displayName}
          </p>
        </div>
        {row.handle ? (
          <p className="mt-0.5 truncate text-xs font-semibold text-[#8a92a0]">
            @{row.handle}
          </p>
        ) : null}
      </div>
    </>
  );

  return (
    <motion.li
      layout={!prefersReducedMotion}
      initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: prefersReducedMotion ? 0 : 0.2, ease: "easeOut" }}
      data-testid="leaderboard-row"
      className={cn(
        "flex min-h-[64px] items-center gap-3 rounded-md px-3 py-2.5 text-[#202633] transition-colors sm:min-h-[70px] sm:gap-4 sm:px-4",
        row.isCurrentUser
          ? currentUserRowTone(row.zone)
          : "bg-transparent hover:bg-white/60"
      )}
    >
      <RankBadge rank={row.rank} highlighted={row.isCurrentUser} />
      {row.profileHref ? (
        <Link
          href={row.profileHref}
          onClick={() =>
            trackAnalyticsEvent({
              eventName: "leaderboard_profile_clicked",
              featureArea: "leaderboards",
              route: typeof window !== "undefined" ? window.location.pathname : "/leaderboards",
              metadata: {
                targetUserId: row.userId,
                rank: row.rank,
                source: "personal_row",
              },
            })
          }
          className="flex min-w-0 flex-1 items-center gap-3 rounded-md outline-none transition hover:text-[#0B1424] focus-visible:ring-2 focus-visible:ring-[#4D86F7]/35 sm:gap-4"
        >
          {profileContent}
        </Link>
      ) : (
        <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
          {profileContent}
        </div>
      )}
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className="whitespace-nowrap text-sm font-black tabular-nums sm:text-base">
          {formatXp(row.seasonXp, locale)}
        </span>
        <div className="flex items-center gap-2">
          {canRequestConnection ? (
            <button
              type="button"
              title={
                row.connection?.status === "accepted"
                  ? "Friends"
                  : connectionRequested || row.connection?.status === "pending_sent"
                    ? "Friend request sent"
                    : "Add friend"
              }
              aria-label={
                row.connection?.status === "accepted"
                  ? `${row.displayName} is already your friend`
                  : connectionRequested || row.connection?.status === "pending_sent"
                    ? `Friend request already sent to ${row.displayName}`
                    : `Add ${row.displayName} as a friend`
              }
              disabled={
                connectionPending ||
                connectionRequested ||
                row.connection?.status === "pending_sent" ||
                row.connection?.status === "accepted"
              }
              onClick={() => onRequestConnection?.(row)}
              className={cn(
                "inline-flex size-7 items-center justify-center rounded-full border transition",
                row.connection?.status === "accepted"
                  ? "border-[#bfe8ca] bg-[#eafbf0] text-[#159947]"
                  : connectionRequested || row.connection?.status === "pending_sent"
                    ? "border-[#D9E5F4] bg-white text-[#4D86F7]"
                    : "border-[#D9E5F4] bg-white text-[#667795] hover:border-[#A9C6FB] hover:text-[#3E78EC]",
                (connectionPending ||
                  connectionRequested ||
                  row.connection?.status === "pending_sent" ||
                  row.connection?.status === "accepted") &&
                  "cursor-not-allowed opacity-70"
              )}
            >
              {connectionPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : row.connection?.status === "accepted" ? (
                <CheckCircle2 className="size-3.5" />
              ) : (
                <UserPlus className="size-3.5" />
              )}
            </button>
          ) : null}
          {kudosState && !row.isCurrentUser ? (
            <button
              type="button"
              title={
                kudosState.viewerHasSent
                  ? "Encouragement sent"
                  : kudosState.viewerCanSend
                    ? "Send encouragement"
                    : "Encouragement unavailable"
              }
              aria-label={
                kudosState.viewerHasSent
                  ? `Encouragement already sent to ${row.displayName}`
                  : `Send encouragement to ${row.displayName}`
              }
              disabled={!kudosState.viewerCanSend || kudosPending}
              onClick={() => onSendKudos?.(row)}
              className={cn(
                "inline-flex size-7 items-center justify-center rounded-full border transition",
                kudosState.viewerHasSent
                  ? "border-[#bfe8ca] bg-[#eafbf0] text-[#159947]"
                  : "border-[#D9E5F4] bg-white text-[#667795] hover:border-[#bfe8ca] hover:text-[#159947]",
                (!kudosState.viewerCanSend || kudosPending) &&
                  "cursor-not-allowed opacity-60"
              )}
            >
              {kudosPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <ThumbsUp className="size-3.5" />
              )}
            </button>
          ) : null}
        </div>
      </div>
    </motion.li>
  );
}

function OrganizationRow({
  row,
  prefersReducedMotion,
  locale,
  t,
}: {
  row: OrganizationLeaderboardRow;
  prefersReducedMotion: boolean;
  locale: string;
  t: LeaderboardTranslator;
}) {
  return (
    <motion.li
      layout={!prefersReducedMotion}
      initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: prefersReducedMotion ? 0 : 0.2, ease: "easeOut" }}
      data-testid="organization-leaderboard-row"
      className={cn(
        "flex min-h-[64px] items-center gap-3 rounded-md px-3 py-2.5 text-[#202633] transition-colors sm:min-h-[70px] sm:gap-4 sm:px-4",
        row.isCurrentOrganization
          ? "bg-[#dff4e7] text-[#0B1424] shadow-[0_16px_44px_rgba(34,197,94,0.16)]"
          : "bg-transparent hover:bg-white/60"
      )}
    >
      <RankBadge rank={row.rank} highlighted={row.isCurrentOrganization} />
      <div
        className={cn(
          "flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full text-[#566170] sm:size-11",
          row.isCurrentOrganization ? "bg-[#35b86f] text-white" : "bg-[#eef2f7]"
        )}
      >
        {row.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={row.logoUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <Users2 className="size-5" />
        )}
      </div>
      <div className="min-w-0 flex-1 text-left">
        <div className="flex min-w-0 flex-nowrap items-center gap-x-2 gap-y-1">
          <p className="min-w-0 flex-1 truncate text-sm font-black sm:text-base">
          {row.name}
          </p>
        </div>
        <p
          className={cn(
            "mt-1 truncate text-xs font-semibold sm:text-sm",
            row.isCurrentOrganization ? "text-current/68" : "text-[#8a92a0]"
          )}
        >
          {t("organizations.rowSubtitle", {
            subtitle: row.subtitle,
            contributors: row.contributingMembers,
            active: row.activeMembers,
          })}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className="whitespace-nowrap text-sm font-black tabular-nums sm:text-base">
          {formatXp(row.seasonXp, locale)}
        </span>
      </div>
    </motion.li>
  );
}

function SeasonOutcomeBanner({
  data,
  prefersReducedMotion,
  locale,
  t,
  onReplay,
}: {
  data: LeaderboardPageData;
  prefersReducedMotion: boolean;
  locale: string;
  t: LeaderboardTranslator;
  onReplay?: () => void;
}) {
  const outcome = data.personal.outcome;
  if (!outcome || outcome.outcome === "inactive") {
    return null;
  }

  const isPositive = outcome.outcome === "promoted" || outcome.outcome === "champion";
  const isNegative = outcome.outcome === "demoted";
  const replayCopy = getSeasonReplayCopy(outcome, locale);
  const title = t(`outcome.${outcome.outcome}`);
  const body = replayCopy.transition;

  return (
    <motion.div
      initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "mt-5 flex w-full flex-col gap-3 rounded-lg border px-4 py-3 text-left shadow-[0_12px_32px_rgba(15,23,42,0.08)] sm:flex-row sm:items-center",
        isPositive
          ? "border-[#bfe8ca] bg-[#f0fbf4] text-[#145c35]"
          : isNegative
            ? "border-[#f4c7c7] bg-[#fff5f5] text-[#9a3131]"
            : "border-[#cfe0ff] bg-[#f4f8ff] text-[#1f4f99]"
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-full",
          isPositive && "bg-[#dff7e7] text-[#177245]",
          isNegative && "bg-[#ffe1e1] text-[#b94848]",
          !isPositive && !isNegative && "bg-[#e9f2ff] text-[#1f5fc9]"
        )}>
          {isPositive ? (
            <Trophy className="size-5" />
          ) : isNegative ? (
            <TrendingDown className="size-5" />
          ) : (
            <Medal className="size-5" />
          )}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-black">{title}</p>
          <p className="mt-0.5 text-sm font-medium leading-5 opacity-80">{body}</p>
        </div>
      </div>
      {onReplay ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="self-start border-current/25 bg-white/70 text-current hover:bg-white sm:self-center"
          onClick={onReplay}
        >
          <RotateCcw className="size-3.5" />
          {t("replay")}
        </Button>
      ) : null}
    </motion.div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex min-h-[260px] flex-col items-center justify-center px-6 py-12 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-[#f3f6fb] text-[#8a96a8]">
        <Trophy className="size-6" />
      </div>
      <h2 className="mt-4 text-lg font-black text-[#0B1424]">{title}</h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-[#718096]">{body}</p>
    </div>
  );
}

function LeaderboardInfoDialog({
  data,
  open,
  onOpenChange,
  t,
}: {
  data: LeaderboardPageData;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  t: LeaderboardTranslator;
}) {
  const language =
    data.leaderboardLanguage === "vi" ? t("languages.vi") : t("languages.en");
  const currentRule = getRuleText(data, t);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100vw-2rem)] gap-0 rounded-2xl border border-white/60 bg-white/90 p-0 text-[#0B1424] shadow-[0_28px_80px_rgba(15,23,42,0.20)] backdrop-blur-xl sm:max-w-[460px]">
        <div className="px-5 pb-4 pt-5 sm:px-6 sm:pb-5">
          <div className="flex items-start gap-3 pr-8">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#eef4ff] text-[#1f5fc9]">
              <Info className="size-5" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-lg font-black tracking-normal text-[#0B1424]">
                {t("info.title")}
              </DialogTitle>
              <DialogDescription className="mt-1 text-sm font-medium leading-6 text-[#667085]">
                {t("languageNote", { language })}
              </DialogDescription>
            </div>
          </div>

          <div className="mt-5 grid gap-3">
            <section className="rounded-xl bg-[#f6f8fb] px-4 py-3">
              <h3 className="text-sm font-black text-[#0B1424]">
                {t("info.xpTitle")}
              </h3>
              <p className="mt-1 text-sm font-medium leading-6 text-[#667085]">
                {t("info.xpBody")}
              </p>
            </section>
            <section className="rounded-xl bg-[#f6f8fb] px-4 py-3">
              <h3 className="text-sm font-black text-[#0B1424]">
                {t("info.rulesTitle")}
              </h3>
              <p className="mt-1 text-sm font-medium leading-6 text-[#667085]">
                {currentRule}
              </p>
              <p className="mt-2 text-sm font-medium leading-6 text-[#667085]">
                {t("info.orgRules")}
              </p>
            </section>
            <section className="rounded-xl bg-[#f6f8fb] px-4 py-3">
              <h3 className="text-sm font-black text-[#0B1424]">
                {t("info.capsTitle")}
              </h3>
              <p className="mt-1 text-sm font-medium leading-6 text-[#667085]">
                {t("info.capsBody")}
              </p>
            </section>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function LeaderboardsPage({
  data,
  viewerUserId,
  seasonReplayEnabled = false,
  autoOpenSeasonReplay = false,
  reducedMotionOverride,
  seasonReplayReviewMode = false,
  socialSignalsEnabled = false,
  analyticsEnabled = false,
  mockActionsEnabled = false,
}: {
  data: LeaderboardPageData;
  viewerUserId: string;
  seasonReplayEnabled?: boolean;
  autoOpenSeasonReplay?: boolean;
  reducedMotionOverride?: boolean;
  seasonReplayReviewMode?: boolean;
  socialSignalsEnabled?: boolean;
  analyticsEnabled?: boolean;
  mockActionsEnabled?: boolean;
}) {
  const rawLocale = useLocale();
  const locale = rawLocale === "vi" ? "vi" : "en";
  const t = useTranslations("leaderboards") as LeaderboardTranslator;
  const detectedReducedMotion = useReducedMotion() ?? false;
  const prefersReducedMotion = reducedMotionOverride ?? detectedReducedMotion;
  const [view, setView] = useState<LeaderboardView>("personal");
  const [band, setBand] = useState<OrganizationBand>(
    data.organizations.currentOrganization?.band ?? "small"
  );
  const [seasonReplayOpen, setSeasonReplayOpen] = useState(false);
  const [leaderboardInfoOpen, setLeaderboardInfoOpen] = useState(false);
  const [pendingKudosUserId, setPendingKudosUserId] = useState<string | null>(null);
  const [sentKudosUserIds, setSentKudosUserIds] = useState<string[]>([]);
  const [pendingConnectionUserId, setPendingConnectionUserId] = useState<string | null>(null);
  const [requestedConnectionUserIds, setRequestedConnectionUserIds] = useState<string[]>([]);
  const [kudosActionError, setKudosActionError] = useState<string | null>(null);
  const [, startKudosTransition] = useTransition();
  const seasonOutcome = data.personal.outcome;
  const seasonReplayDismissalKey = useMemo(() => {
    if (!seasonOutcome) return null;
    return getSeasonReplayDismissalKey(viewerUserId, seasonOutcome);
  }, [seasonOutcome, viewerUserId]);
  const canShowSeasonReplay =
    seasonReplayEnabled && isReplayableSeasonOutcome(seasonOutcome);
  const localizedLeague = getLocalizedLeagueName(data.personal.league.id, locale);
  const localizedTiers = data.personal.tiers.map((tier) => ({
    ...tier,
    ...getLocalizedLeagueName(tier.id, locale),
  }));

  const isChampionLeague = data.personal.league.id === "champion";
  const visiblePersonalRows = data.personal.rows.slice(0, PERSONAL_VISIBLE_ROWS);
  const currentUserPinned =
    data.personal.currentUser &&
    !visiblePersonalRows.some((row) => row.userId === data.personal.currentUser?.userId)
      ? data.personal.currentUser
      : null;

  const organizationRows = useMemo(
    () => data.organizations.rows.filter((row) => row.band === band),
    [band, data.organizations.rows]
  );
  const visibleOrganizationRows = organizationRows.slice(0, ORGANIZATION_VISIBLE_ROWS);
  const currentOrgPinned =
    data.organizations.currentOrganization &&
    data.organizations.currentOrganization.band === band &&
    !visibleOrganizationRows.some(
      (row) => row.organizationId === data.organizations.currentOrganization?.organizationId
    )
      ? data.organizations.currentOrganization
      : null;

  useEffect(() => {
    if (!autoOpenSeasonReplay || !canShowSeasonReplay || !seasonReplayDismissalKey) {
      return;
    }

    let openTimer: number | null = null;

    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get("resetReplay") === "1") {
        window.localStorage.removeItem(seasonReplayDismissalKey);
      }

      if (!window.localStorage.getItem(seasonReplayDismissalKey)) {
        openTimer = window.setTimeout(() => setSeasonReplayOpen(true), 0);
      }
    } catch {
      openTimer = window.setTimeout(() => setSeasonReplayOpen(true), 0);
    }

    return () => {
      if (openTimer) {
        window.clearTimeout(openTimer);
      }
    };
  }, [autoOpenSeasonReplay, canShowSeasonReplay, seasonReplayDismissalKey]);

  useEffect(() => {
    if (!analyticsEnabled) return;

    trackAnalyticsEvent({
      eventName: "leaderboard_viewed",
      featureArea: "leaderboards",
      route: typeof window !== "undefined" ? window.location.pathname : "/leaderboards",
        metadata: {
          source: data.source,
          status: data.status,
          league: data.personal.league.id,
          leaderboardLanguage: data.leaderboardLanguage,
          view,
        },
    });
  }, [
    analyticsEnabled,
    data.leaderboardLanguage,
    data.personal.league.id,
    data.source,
    data.status,
    view,
  ]);

  function handleSeasonReplayOpenChange(open: boolean) {
    setSeasonReplayOpen(open);

    if (open && analyticsEnabled && seasonOutcome) {
      trackAnalyticsEvent({
        eventName: "leaderboard_league_outcome_viewed",
        featureArea: "leaderboards",
        route: typeof window !== "undefined" ? window.location.pathname : "/leaderboards",
        metadata: {
          outcome: seasonOutcome.outcome,
          seasonId: seasonOutcome.seasonId,
          finalRank: seasonOutcome.finalRank,
          leaderboardLanguage: data.leaderboardLanguage,
        },
      });
    }

    if (!open && seasonReplayDismissalKey) {
      try {
        window.localStorage.setItem(seasonReplayDismissalKey, "dismissed");
      } catch {
        // Local replay dismissal is best-effort only.
      }
    }
  }

  function handleSendKudos(row: PersonalLeaderboardRow) {
    if (!data.socialTrust?.kudos.byUserId[row.userId]?.viewerCanSend) return;

    setPendingKudosUserId(row.userId);
    setKudosActionError(null);
    startKudosTransition(async () => {
      try {
        if (!mockActionsEnabled) {
          const result = await sendLeaderboardKudos({
            recipientUserId: row.userId,
            seasonId: data.season.id,
            kind: "keep_going",
          });

          if (result.status !== "sent") {
            setKudosActionError(t("kudos.unavailable"));
            return;
          }
        }

        setSentKudosUserIds((current) =>
          current.includes(row.userId) ? current : [...current, row.userId]
        );
      } catch {
        setKudosActionError(t("kudos.error"));
      } finally {
        setPendingKudosUserId(null);
      }
    });
  }

  function getKudosState(userId: string): LeaderboardKudosTargetState | undefined {
    const baseState = data.socialTrust?.kudos.byUserId[userId];
    if (!baseState || !sentKudosUserIds.includes(userId)) return baseState;

    return {
      ...baseState,
      viewerCanSend: false,
      viewerHasSent: true,
    };
  }

  function handleRequestConnection(row: PersonalLeaderboardRow) {
    if (!row.viewerCanRequest && !row.connection?.viewerCanRequest) return;

    setPendingConnectionUserId(row.userId);
    void requestProfileConnection({ targetUserId: row.userId })
      .then((result) => {
        const status =
          result && typeof result === "object" && "status" in result
            ? String((result as { status?: unknown }).status)
            : "pending_sent";
        if (status === "pending_sent" || status === "none") {
          setRequestedConnectionUserIds((current) =>
            current.includes(row.userId) ? current : [...current, row.userId]
          );
        }
      })
      .catch(() => {
        setKudosActionError("Unable to send friend request.");
      })
      .finally(() => setPendingConnectionUserId(null));
  }

  return (
    <PageTransition
      data-testid="leaderboard-page"
      className="min-h-full bg-[#fbfbfc] text-[#0B1424]"
    >
      <PageContainer size="wide" className="flex flex-col items-center py-6 sm:py-8">
        <section className="relative flex w-full max-w-[900px] flex-col items-center text-center">
          <button
            type="button"
            onClick={() => setLeaderboardInfoOpen(true)}
            aria-label={t("info.triggerLabel")}
            title={t("info.triggerLabel")}
            className="absolute right-0 top-0 inline-flex size-10 items-center justify-center rounded-full border border-[#dfe6f2] bg-white/80 text-[#64748b] shadow-[0_10px_26px_rgba(15,23,42,0.08)] backdrop-blur-md transition hover:border-[#4d86f7]/45 hover:text-[#1f5fc9]"
          >
            <Info className="size-5" />
          </button>
          {data.status === "unavailable" ? (
            <div
              data-testid="leaderboard-setup-state"
              className="mb-6 w-full rounded-md border border-[#f1d7a5] bg-[#fff8e8] px-4 py-3 text-left text-sm font-semibold text-[#8a5a0a]"
            >
              {data.reason}
            </div>
          ) : null}

          <div className="flex w-full items-end justify-center gap-4 overflow-hidden px-2 pb-2 pt-10 sm:gap-8 sm:pt-14">
            {localizedTiers.map((tier) => (
              <LeagueCrest
                key={tier.id}
                tier={tier}
                prefersReducedMotion={prefersReducedMotion}
              />
            ))}
          </div>

          <h1
            data-testid="league-title"
            className="mt-8 text-balance text-[32px] font-black leading-tight tracking-normal text-[#09090b] sm:text-[40px]"
          >
            {localizedLeague.name}
          </h1>
          <p className="mt-2 text-base font-medium text-[#7a7f8a] sm:text-lg">
            {getRuleText(data, t)}
          </p>
          <div className="mt-5 inline-flex items-center gap-2 text-base font-black text-[#0B1424]">
            <Clock3 className="size-5 text-[#f1c232]" />
            {t("daysLeft", { count: data.season.daysRemaining })}
          </div>
          <SeasonOutcomeBanner
            data={data}
            prefersReducedMotion={prefersReducedMotion}
            locale={locale}
            t={t}
            onReplay={
              canShowSeasonReplay ? () => setSeasonReplayOpen(true) : undefined
            }
          />
        </section>

        <section className="mt-9 flex w-full max-w-[900px] flex-col items-center gap-4">
          <SegmentedControl
            label={t("viewLabel")}
            value={view}
            onChange={setView}
            options={[
              { value: "personal", label: t("views.personal") },
              { value: "organizations", label: t("views.organizations") },
            ]}
          />

          {view === "organizations" ? (
            <SegmentedControl
              label={t("organizations.sizeBandLabel")}
              value={band}
              onChange={setBand}
              options={data.organizations.bands.map((value) => ({
                value,
                label: t(`organizations.bands.${value}`),
                helper: t(`organizations.bandDescriptions.${value}`),
              }))}
            />
          ) : null}

          {view === "organizations" && !data.organizations.affiliation ? (
            <div className="w-full rounded-lg border border-[#D9E5F4] bg-white px-4 py-3 text-center text-sm font-semibold text-[#415069] shadow-[0_10px_26px_rgba(15,23,42,0.06)]">
              {t("organizations.joinPrefix")}{" "}
              <Link href="/settings" className="text-[#1f5fc9] hover:underline">
                {t("organizations.settingsLink")}
              </Link>
              {t("organizations.joinSuffix")}
            </div>
          ) : null}
        </section>

        <section
          data-testid="leaderboard-card"
          className="mt-6 w-full max-w-[760px]"
        >
          {view === "personal" ? (
            data.personal.rows.length > 0 ? (
              <>
                <div className="flex items-center justify-between gap-3 px-1 pb-3 sm:px-2">
                <div className="flex items-center gap-2 text-sm font-black text-[#202633]">
                  {isChampionLeague ? (
                    <Crown className="size-4 text-[#d0a000]" />
                    ) : (
                      <Medal className="size-4 text-[#4d86f7]" />
                    )}
                    {t("weeklyXp")}
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <div className="hidden text-xs font-bold uppercase text-[#8b95a5] sm:block">
                      {data.season.label}
                    </div>
                  </div>
                </div>
                {kudosActionError ? (
                  <div
                    role="alert"
                    className="mb-3 rounded-xl border border-[#ffd8d8] bg-[#fff6f6] px-4 py-2 text-sm font-semibold text-[#a43a3a]"
                  >
                    {kudosActionError}
                  </div>
                ) : null}
                <ul className="space-y-2">
                  {visiblePersonalRows.map((row) => (
                    <PersonalRow
                      key={row.userId}
                      row={row}
                      prefersReducedMotion={prefersReducedMotion}
                      locale={locale}
                      kudosState={
                        socialSignalsEnabled
                          ? getKudosState(row.userId)
                          : undefined
                      }
                      onSendKudos={handleSendKudos}
                      kudosPending={pendingKudosUserId === row.userId}
                      onRequestConnection={handleRequestConnection}
                      connectionPending={pendingConnectionUserId === row.userId}
                      connectionRequested={requestedConnectionUserIds.includes(row.userId)}
                    />
                  ))}
                </ul>
              </>
            ) : (
              <EmptyState
                title={t("empty.personalTitle")}
                body={t("empty.personalBody")}
              />
            )
          ) : visibleOrganizationRows.length > 0 ? (
            <>
              <div className="flex flex-col gap-1 px-1 pb-3 text-left sm:flex-row sm:items-center sm:justify-between sm:px-2">
                <div className="flex items-center gap-2 text-sm font-black text-[#202633]">
                  <Users2 className="size-4 text-[#34a853]" />
                  {t("organizations.title", { band: t(`organizations.bands.${band}`) })}
                </div>
                <div className="text-xs font-bold uppercase text-[#8b95a5]">
                  {t(`organizations.bandDescriptions.${band}`)}
                </div>
              </div>
              <ul className="space-y-2">
                {visibleOrganizationRows.map((row) => (
                  <OrganizationRow
                    key={`${row.organizationType}-${row.organizationId}`}
                    row={row}
                    prefersReducedMotion={prefersReducedMotion}
                    locale={locale}
                    t={t}
                  />
                ))}
              </ul>
            </>
          ) : (
            <EmptyState
              title={t("empty.organizationsTitle")}
              body={t("empty.organizationsBody")}
            />
          )}
        </section>

        {view === "personal" && currentUserPinned ? (
          <section
            data-testid="current-rank-pinned"
            className="mt-5 w-full max-w-[760px]"
          >
            <div className="mb-2 flex items-center gap-2 px-1 text-sm font-black text-[#1f5fc9] sm:px-2">
              <ChevronUp className="size-4" />
              {t("pinned.yourRank")}
            </div>
            <ul className="space-y-2">
              <PersonalRow
                row={currentUserPinned}
                prefersReducedMotion={prefersReducedMotion}
                locale={locale}
                kudosState={
                  socialSignalsEnabled
                    ? getKudosState(currentUserPinned.userId)
                    : undefined
                }
                onSendKudos={handleSendKudos}
                kudosPending={pendingKudosUserId === currentUserPinned.userId}
              />
            </ul>
          </section>
        ) : null}

        {view === "organizations" && currentOrgPinned ? (
          <section
            data-testid="current-organization-pinned"
            className="mt-5 w-full max-w-[760px]"
          >
            <div className="mb-2 flex items-center gap-2 px-1 text-sm font-black text-[#177245] sm:px-2">
              <ChevronUp className="size-4" />
              {t("pinned.yourOrganization")}
            </div>
            <ul className="space-y-2">
              <OrganizationRow
                row={currentOrgPinned}
                prefersReducedMotion={prefersReducedMotion}
                locale={locale}
                t={t}
              />
            </ul>
          </section>
        ) : null}
        <LeaderboardInfoDialog
          data={data}
          open={leaderboardInfoOpen}
          onOpenChange={setLeaderboardInfoOpen}
          t={t}
        />
        {canShowSeasonReplay && seasonOutcome ? (
          <SeasonReplayDialog
            open={seasonReplayOpen}
            outcome={seasonOutcome}
            onOpenChange={handleSeasonReplayOpenChange}
            onViewLeaderboard={() => handleSeasonReplayOpenChange(false)}
            prefersReducedMotion={prefersReducedMotion}
            reviewMode={seasonReplayReviewMode}
          />
        ) : null}
      </PageContainer>
    </PageTransition>
  );
}
