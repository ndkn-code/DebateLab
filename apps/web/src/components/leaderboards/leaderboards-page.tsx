"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  ChevronUp,
  Clock3,
  Crown,
  Info,
  Lock,
  Loader2,
  Medal,
  Minus,
  RotateCcw,
  ShieldCheck,
  ThumbsUp,
  TrendingDown,
  TrendingUp,
  Trophy,
  Users2,
} from "@/components/ui/icons";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { PageTransition } from "@/components/shared/page-motion";
import { PageContainer } from "@/components/shared/product-layout";
import { SeasonReplayDialog } from "@/components/leaderboards/season-replay-dialog";
import { sendLeaderboardKudos } from "@/app/actions/leaderboards";
import { trackAnalyticsEvent } from "@/lib/hooks/useAnalyticsEventTracker";
import { summarizeLeaderboardScoreExplanation } from "@/lib/leaderboards/social-trust";
import { cn } from "@/lib/utils";
import {
  getLocalizedLeagueName,
  getSeasonReplayDismissalKey,
  isReplayableSeasonOutcome,
} from "@/lib/leaderboards/replay";
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

const PERSONAL_VISIBLE_ROWS = 12;
const ORGANIZATION_VISIBLE_ROWS = 10;

const leagueTone: Record<
  PersonalLeagueTier["id"],
  { bg: string; text: string; ring: string; icon: string }
> = {
  novice: {
    bg: "bg-[#f4d7bc]",
    text: "text-[#7a451e]",
    ring: "ring-[#e3a66d]/45",
    icon: "N",
  },
  constructive: {
    bg: "bg-[#9fe3d3]",
    text: "text-[#075c50]",
    ring: "ring-[#4bbda7]/40",
    icon: "C",
  },
  rebuttal: {
    bg: "bg-[#f7a7ce]",
    text: "text-[#8a2155]",
    ring: "ring-[#ec6ba9]/40",
    icon: "R",
  },
  whip: {
    bg: "bg-[#9db7ff]",
    text: "text-[#183b91]",
    ring: "ring-[#668bf4]/40",
    icon: "W",
  },
  champion: {
    bg: "bg-[#f5cf56]",
    text: "text-[#6b4b00]",
    ring: "ring-[#d2a912]/45",
    icon: "Ch",
  },
};

const bandLabels: Record<OrganizationBand, string> = {
  small: "Small",
  medium: "Medium",
  large: "Large",
};

const bandDescriptions: Record<OrganizationBand, string> = {
  small: "1-10 active members",
  medium: "11-30 active members",
  large: "31+ active members",
};

function formatXp(value: number) {
  return `${new Intl.NumberFormat("en-US").format(value)} XP`;
}

function getRuleText(data: LeaderboardPageData) {
  const { personal } = data;

  if (personal.league.id === "champion") {
    return `Top ${personal.championCount} finish as season champions`;
  }

  if (!personal.demotionEnabled) {
    return `Top ${personal.promotionCount} advance to the next league`;
  }

  return `Top ${personal.promotionCount} advance, bottom ${personal.demotionCount} drop`;
}

function zoneLabel(zone: PromotionZone, isChampionLeague: boolean) {
  if (zone === "champion") return "Champion";
  if (zone === "promote") return isChampionLeague ? "Top" : "Advance";
  if (zone === "demote") return "Drop";
  if (zone === "inactive") return "Inactive";
  return "Hold";
}

function zoneClassName(zone: PromotionZone) {
  if (zone === "champion") {
    return "border-[#e9be2c] bg-[#fff7d6] text-[#7a5500]";
  }

  if (zone === "promote") {
    return "border-[#65d7ad] bg-[#eafaf2] text-[#13724d]";
  }

  if (zone === "demote") {
    return "border-[#f0a0a0] bg-[#fff0f0] text-[#a33b3b]";
  }

  return "border-[#e3e7ee] bg-[#f7f9fc] text-[#657184]";
}

function RankBadge({ rank }: { rank: number }) {
  if (rank <= 3) {
    const medalTone =
      rank === 1
        ? "border-[#f0c744] bg-[#ffd84d] text-[#7b5700]"
        : rank === 2
          ? "border-[#b9c9d8] bg-[#dce9f5] text-[#52697d]"
          : "border-[#d79a5e] bg-[#e7a76a] text-[#744118]";

    return (
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-full border text-sm font-bold shadow-[inset_0_-2px_0_rgba(0,0,0,0.08)]",
          medalTone
        )}
        aria-label={`Rank ${rank}`}
      >
        {rank}
      </span>
    );
  }

  return (
    <span className="flex size-9 shrink-0 items-center justify-center text-sm font-bold text-[#35a451]">
      {rank}
    </span>
  );
}

function RankDelta({ delta }: { delta: number }) {
  if (delta > 0) {
    return (
      <span
        title={`Moved up ${delta}`}
        className="inline-flex items-center gap-1 text-xs font-semibold text-[#15965d]"
      >
        <TrendingUp className="size-3.5" />
        {delta}
      </span>
    );
  }

  if (delta < 0) {
    return (
      <span
        title={`Moved down ${Math.abs(delta)}`}
        className="inline-flex items-center gap-1 text-xs font-semibold text-[#b94848]"
      >
        <TrendingDown className="size-3.5" />
        {Math.abs(delta)}
      </span>
    );
  }

  return (
    <span title="No rank change" className="inline-flex items-center text-[#9aa3b1]">
      <Minus className="size-3.5" />
    </span>
  );
}

function LeagueCrest({
  tier,
  prefersReducedMotion,
}: {
  tier: PersonalLeagueTier;
  prefersReducedMotion: boolean;
}) {
  const tone = leagueTone[tier.id];
  const isCurrent = tier.status === "current";
  const isLocked = tier.status === "locked";

  return (
    <div className="flex min-w-0 flex-col items-center gap-2">
      <motion.div
        layout={!prefersReducedMotion}
        className={cn(
          "relative flex size-16 items-center justify-center text-sm font-black transition-all sm:size-[72px]",
          isLocked
            ? "bg-[#e5e7eb] text-[#9ca3af] opacity-70"
            : `${tone.bg} ${tone.text}`,
          isCurrent
            ? `scale-110 ring-8 ${tone.ring} shadow-[0_18px_40px_rgba(15,23,42,0.12)]`
            : "shadow-[0_10px_26px_rgba(15,23,42,0.06)]"
        )}
        style={{
          clipPath:
            tier.id === "champion"
              ? "polygon(50% 0%, 91% 25%, 78% 100%, 22% 100%, 9% 25%)"
              : "polygon(50% 0%, 94% 31%, 78% 100%, 22% 100%, 6% 31%)",
        }}
        aria-label={tier.name}
      >
        {isLocked ? <Lock className="size-5" /> : tone.icon}
        {isCurrent ? (
          <span className="absolute left-3 top-2 h-2 w-8 rotate-[-34deg] rounded-full bg-white/35" />
        ) : null}
      </motion.div>
      <span
        className={cn(
          "hidden max-w-24 truncate text-xs font-semibold sm:block",
          isCurrent ? "text-[#111827]" : "text-[#9aa3b1]"
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
                ? "bg-white text-[#101827] shadow-[0_8px_22px_rgba(15,23,42,0.10)]"
                : "text-[#6b7280] hover:text-[#101827]"
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
  isChampionLeague,
  prefersReducedMotion,
  kudosState,
  onSendKudos,
  kudosPending,
}: {
  row: PersonalLeaderboardRow;
  isChampionLeague: boolean;
  prefersReducedMotion: boolean;
  kudosState?: LeaderboardKudosTargetState;
  onSendKudos?: (row: PersonalLeaderboardRow) => void;
  kudosPending?: boolean;
}) {
  return (
    <motion.li
      layout={!prefersReducedMotion}
      initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: prefersReducedMotion ? 0 : 0.2, ease: "easeOut" }}
      data-testid="leaderboard-row"
      className={cn(
        "grid min-h-[76px] grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-3 border-b border-[#e5e7eb] px-4 py-3 last:border-b-0 sm:min-h-[86px] sm:grid-cols-[52px_56px_minmax(0,1fr)_auto] sm:gap-4 sm:px-6",
        row.isCurrentUser && "bg-[#f7fbff] shadow-[inset_3px_0_0_#4d86f7]"
      )}
    >
      <RankBadge rank={row.rank} />
      <Avatar className="hidden size-12 bg-[#eef4ff] sm:flex">
        {row.avatarUrl ? <AvatarImage src={row.avatarUrl} alt={row.displayName} /> : null}
        <AvatarFallback className="bg-[#eef4ff] text-sm font-black text-[#1f5fc9]">
          {row.initials}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <div className="flex min-w-0 flex-nowrap items-center gap-x-2 gap-y-1">
          <p className="min-w-0 flex-1 truncate text-base font-black text-[#111827] sm:text-lg">
            {row.displayName}
          </p>
          {row.isCurrentUser ? (
            <span className="shrink-0 rounded-full bg-[#e9f2ff] px-2 py-0.5 text-[11px] font-bold text-[#1f5fc9]">
              You
            </span>
          ) : null}
        </div>
        <div className="mt-1 flex min-w-0 flex-nowrap items-center gap-2">
          {row.title ? (
            <p className="min-w-0 flex-1 truncate text-sm font-medium text-[#6b7280]">
              {row.title}
            </p>
          ) : null}
          <span
            className={cn(
              "inline-flex h-5 shrink-0 items-center rounded-full border px-2 text-[11px] font-bold",
              zoneClassName(row.zone)
            )}
          >
            {zoneLabel(row.zone, isChampionLeague)}
          </span>
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className="whitespace-nowrap text-sm font-semibold tabular-nums text-[#4b5563] sm:text-base">
          {formatXp(row.seasonXp)}
        </span>
        <div className="flex items-center gap-2">
          <RankDelta delta={row.rankDelta} />
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
                  : "border-[#dbe5fb] bg-white text-[#667795] hover:border-[#bfe8ca] hover:text-[#159947]",
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
}: {
  row: OrganizationLeaderboardRow;
  prefersReducedMotion: boolean;
}) {
  return (
    <motion.li
      layout={!prefersReducedMotion}
      initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: prefersReducedMotion ? 0 : 0.2, ease: "easeOut" }}
      data-testid="organization-leaderboard-row"
      className={cn(
        "grid min-h-[78px] grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-3 border-b border-[#e5e7eb] px-4 py-3 last:border-b-0 sm:min-h-[88px] sm:grid-cols-[52px_52px_minmax(0,1fr)_auto] sm:gap-4 sm:px-6",
        row.isCurrentOrganization && "bg-[#f8fff9] shadow-[inset_3px_0_0_#34a853]"
      )}
    >
      <RankBadge rank={row.rank} />
      <div className="hidden size-12 items-center justify-center overflow-hidden rounded-full bg-[#eef4ff] text-[#1f5fc9] sm:flex">
        {row.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={row.logoUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <Users2 className="size-5" />
        )}
      </div>
      <div className="min-w-0">
        <div className="flex min-w-0 flex-nowrap items-center gap-x-2 gap-y-1">
          <p className="min-w-0 flex-1 truncate text-base font-black text-[#111827] sm:text-lg">
            {row.name}
          </p>
          {row.isCurrentOrganization ? (
            <span className="shrink-0 rounded-full bg-[#e8f8ee] px-2 py-0.5 text-[11px] font-bold text-[#177245]">
              Yours
            </span>
          ) : null}
        </div>
        <p className="mt-1 truncate text-sm font-medium text-[#6b7280]">
          {row.subtitle} - {row.contributingMembers} contributors / {row.activeMembers} active
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className="whitespace-nowrap text-sm font-semibold tabular-nums text-[#4b5563] sm:text-base">
          {formatXp(row.seasonXp)}
        </span>
        <RankDelta delta={row.rankDelta} />
      </div>
    </motion.li>
  );
}

function SeasonOutcomeBanner({
  data,
  prefersReducedMotion,
  onReplay,
}: {
  data: LeaderboardPageData;
  prefersReducedMotion: boolean;
  onReplay?: () => void;
}) {
  const outcome = data.personal.outcome;
  if (!outcome || outcome.outcome === "inactive") {
    return null;
  }

  const isPositive = outcome.outcome === "promoted" || outcome.outcome === "champion";
  const isNegative = outcome.outcome === "demoted";
  const fromLeague = getLocalizedLeagueName(outcome.fromLeagueTier, "en").name;
  const nextLeague = getLocalizedLeagueName(outcome.nextLeagueTier, "en").name;
  const movedDownWithinLeague =
    outcome.outcome === "held" &&
    typeof outcome.replayStartRank === "number" &&
    outcome.replayStartRank < outcome.finalRank;
  const title =
    outcome.outcome === "champion"
      ? "Season champion finish"
      : outcome.outcome === "promoted"
        ? "Promoted last season"
        : outcome.outcome === "demoted"
          ? "Demoted last season"
          : movedDownWithinLeague
            ? "Rank dropped, league held"
            : "Held your league";
  const body =
    outcome.outcome === "champion"
      ? `You finished #${outcome.finalRank} with ${formatXp(outcome.seasonXp)}.`
      : outcome.outcome === "promoted"
        ? `You finished #${outcome.finalRank} and advanced from ${fromLeague} to ${nextLeague}.`
        : outcome.outcome === "demoted"
          ? `You finished #${outcome.finalRank} and dropped from ${fromLeague} to ${nextLeague}.`
          : movedDownWithinLeague
            ? `You moved down to #${outcome.finalRank}, but stayed in ${nextLeague}.`
            : `You finished #${outcome.finalRank} and stayed in ${nextLeague}.`;

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
          Replay
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
      <h2 className="mt-4 text-lg font-black text-[#111827]">{title}</h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-[#6b7280]">{body}</p>
    </div>
  );
}

function ScoreExplanationPanel({
  data,
  open,
}: {
  data: LeaderboardPageData;
  open: boolean;
}) {
  const items = data.socialTrust?.scoreExplanation ?? [];
  const summary = summarizeLeaderboardScoreExplanation(items);

  if (!open) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      className="border-b border-[#e5e7eb] bg-[#fbfdff] px-4 py-4 sm:px-6"
      data-testid="leaderboard-score-explanation"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-black text-[#152238]">
            <ShieldCheck className="size-4 text-[#159947]" />
            XP explanation
          </div>
          <p className="mt-1 text-sm text-[#667795]">
            {formatXp(summary.visibleXp)} counted this season
            {summary.suppressedEvents > 0
              ? `, ${formatXp(summary.suppressedXp)} held for review`
              : ""}
            .
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs sm:w-[220px]">
          <div className="rounded-lg border border-[#dbe5fb] bg-white px-3 py-2">
            <p className="font-bold uppercase text-[#8b95a5]">Counted</p>
            <p className="mt-1 text-base font-black text-[#152238]">
              {summary.visibleEvents}
            </p>
          </div>
          <div className="rounded-lg border border-[#dbe5fb] bg-white px-3 py-2">
            <p className="font-bold uppercase text-[#8b95a5]">Reviewed</p>
            <p className="mt-1 text-base font-black text-[#152238]">
              {summary.suppressedEvents}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-2">
        {items.length ? (
          items.map((item) => (
            <div
              key={item.id}
              className="grid gap-2 rounded-lg border border-[#e5eaf4] bg-white px-3 py-3 text-sm sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
            >
              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-2">
                  <p className="truncate font-bold text-[#152238]">{item.label}</p>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold capitalize",
                      item.status === "suppressed" || item.status === "ineligible"
                        ? "bg-[#fff1f1] text-[#c43d3d]"
                        : item.status === "capped"
                          ? "bg-[#fff7e6] text-[#a96800]"
                          : "bg-[#eafbf0] text-[#159947]"
                    )}
                  >
                    {item.status}
                  </span>
                </div>
                {item.reason ? (
                  <p className="mt-1 text-xs font-medium text-[#667795]">
                    {item.reason}
                  </p>
                ) : null}
              </div>
              <span className="justify-self-start whitespace-nowrap font-black tabular-nums text-[#152238] sm:justify-self-end">
                {formatXp(item.seasonXp)}
              </span>
            </div>
          ))
        ) : (
          <div className="rounded-lg border border-dashed border-[#c8d7ef] bg-white px-4 py-8 text-center text-sm font-medium text-[#667795]">
            XP details will appear after your first counted leaderboard event.
          </div>
        )}
      </div>
    </motion.div>
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
  const detectedReducedMotion = useReducedMotion() ?? false;
  const prefersReducedMotion = reducedMotionOverride ?? detectedReducedMotion;
  const [view, setView] = useState<LeaderboardView>("personal");
  const [band, setBand] = useState<OrganizationBand>(
    data.organizations.currentOrganization?.band ?? "small"
  );
  const [seasonReplayOpen, setSeasonReplayOpen] = useState(false);
  const [scoreExplanationOpen, setScoreExplanationOpen] = useState(false);
  const [pendingKudosUserId, setPendingKudosUserId] = useState<string | null>(null);
  const [sentKudosUserIds, setSentKudosUserIds] = useState<string[]>([]);
  const [kudosActionError, setKudosActionError] = useState<string | null>(null);
  const [, startKudosTransition] = useTransition();
  const seasonOutcome = data.personal.outcome;
  const seasonReplayDismissalKey = useMemo(() => {
    if (!seasonOutcome) return null;
    return getSeasonReplayDismissalKey(viewerUserId, seasonOutcome);
  }, [seasonOutcome, viewerUserId]);
  const canShowSeasonReplay =
    seasonReplayEnabled && isReplayableSeasonOutcome(seasonOutcome);

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
        view,
      },
    });
  }, [analyticsEnabled, data.personal.league.id, data.source, data.status, view]);

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

  function handleScoreExplanationToggle() {
    setScoreExplanationOpen((current) => {
      const next = !current;

      if (next && analyticsEnabled) {
        trackAnalyticsEvent({
          eventName: "leaderboard_score_explanation_opened",
          featureArea: "leaderboards",
          route: typeof window !== "undefined" ? window.location.pathname : "/leaderboards",
          metadata: {
            seasonId: data.season.id,
            itemCount: data.socialTrust?.scoreExplanation.length ?? 0,
          },
        });
      }

      return next;
    });
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
            setKudosActionError(result.message ?? "Encouragement is unavailable.");
            return;
          }
        }

        setSentKudosUserIds((current) =>
          current.includes(row.userId) ? current : [...current, row.userId]
        );
      } catch {
        setKudosActionError("Encouragement could not be sent right now.");
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

  return (
    <PageTransition
      data-testid="leaderboard-page"
      className="min-h-full bg-[#fbfbfc] text-[#111827]"
    >
      <PageContainer size="wide" className="flex flex-col items-center py-6 sm:py-8">
        <section className="flex w-full max-w-[900px] flex-col items-center text-center">
          {data.status === "unavailable" ? (
            <div
              data-testid="leaderboard-setup-state"
              className="mb-6 w-full rounded-md border border-[#f1d7a5] bg-[#fff8e8] px-4 py-3 text-left text-sm font-semibold text-[#8a5a0a]"
            >
              {data.reason}
            </div>
          ) : null}

          <div className="flex w-full items-end justify-center gap-4 overflow-hidden px-2 pb-2 pt-10 sm:gap-8 sm:pt-14">
            {data.personal.tiers.map((tier) => (
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
            {data.personal.league.name}
          </h1>
          <p className="mt-2 text-base font-medium text-[#7a7f8a] sm:text-lg">
            {getRuleText(data)}
          </p>
          <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-base font-black text-[#111827] shadow-[0_8px_26px_rgba(15,23,42,0.08)]">
            <Clock3 className="size-5 text-[#f1c232]" />
            {data.season.daysRemaining} days left
          </div>
          <SeasonOutcomeBanner
            data={data}
            prefersReducedMotion={prefersReducedMotion}
            onReplay={
              canShowSeasonReplay ? () => setSeasonReplayOpen(true) : undefined
            }
          />
        </section>

        <section className="mt-9 flex w-full max-w-[900px] flex-col items-center gap-4">
          <SegmentedControl
            label="Leaderboard view"
            value={view}
            onChange={setView}
            options={[
              { value: "personal", label: "Personal" },
              { value: "organizations", label: "Organizations" },
            ]}
          />

          {view === "organizations" ? (
            <SegmentedControl
              label="Organization size band"
              value={band}
              onChange={setBand}
              options={data.organizations.bands.map((value) => ({
                value,
                label: bandLabels[value],
                helper: bandDescriptions[value],
              }))}
            />
          ) : null}

          {view === "organizations" && !data.organizations.affiliation ? (
            <div className="w-full rounded-lg border border-[#dbe7fb] bg-white px-4 py-3 text-center text-sm font-semibold text-[#4b5563] shadow-[0_10px_26px_rgba(15,23,42,0.06)]">
              Join a verified organization in{" "}
              <Link href="/settings" className="text-[#1f5fc9] hover:underline">
                Settings
              </Link>
              .
            </div>
          ) : null}
        </section>

        <section
          data-testid="leaderboard-card"
          className="mt-5 w-full max-w-[900px] overflow-hidden rounded-lg border border-[#dfe3ea] bg-white shadow-[0_18px_48px_rgba(15,23,42,0.08)]"
        >
          {view === "personal" ? (
            data.personal.rows.length > 0 ? (
              <>
                <div className="flex items-center justify-between gap-3 border-b border-[#e5e7eb] px-4 py-3 sm:px-6">
                  <div className="flex items-center gap-2 text-sm font-black text-[#111827]">
                    {isChampionLeague ? (
                      <Crown className="size-4 text-[#d0a000]" />
                    ) : (
                      <Medal className="size-4 text-[#4d86f7]" />
                    )}
                    Weekly XP
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <button
                      type="button"
                      onClick={handleScoreExplanationToggle}
                      className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[#dbe5fb] bg-white px-3 text-xs font-bold text-[#40516f] transition hover:border-[#4d86f7]/50 hover:text-[#1e63e9]"
                      aria-expanded={scoreExplanationOpen}
                    >
                      <Info className="size-3.5" />
                      XP details
                    </button>
                    <div className="hidden text-xs font-bold uppercase text-[#8b95a5] sm:block">
                      {data.season.label}
                    </div>
                  </div>
                </div>
                <ScoreExplanationPanel data={data} open={scoreExplanationOpen} />
                {kudosActionError ? (
                  <div
                    role="alert"
                    className="border-b border-[#ffd8d8] bg-[#fff6f6] px-4 py-2 text-sm font-semibold text-[#a43a3a] sm:px-6"
                  >
                    {kudosActionError}
                  </div>
                ) : null}
                <ul>
                  {visiblePersonalRows.map((row) => (
                    <PersonalRow
                      key={row.userId}
                      row={row}
                      isChampionLeague={isChampionLeague}
                      prefersReducedMotion={prefersReducedMotion}
                      kudosState={
                        socialSignalsEnabled
                          ? getKudosState(row.userId)
                          : undefined
                      }
                      onSendKudos={handleSendKudos}
                      kudosPending={pendingKudosUserId === row.userId}
                    />
                  ))}
                </ul>
              </>
            ) : (
              <EmptyState
                title="No personal rankings yet"
                body="Finish a scored practice session and this weekly league will start to fill in."
              />
            )
          ) : visibleOrganizationRows.length > 0 ? (
            <>
              <div className="flex flex-col gap-1 border-b border-[#e5e7eb] px-4 py-3 text-left sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <div className="flex items-center gap-2 text-sm font-black text-[#111827]">
                  <Users2 className="size-4 text-[#34a853]" />
                  {bandLabels[band]} Organizations
                </div>
                <div className="text-xs font-bold uppercase text-[#8b95a5]">
                  {bandDescriptions[band]}
                </div>
              </div>
              <ul>
                {visibleOrganizationRows.map((row) => (
                  <OrganizationRow
                    key={`${row.organizationType}-${row.organizationId}`}
                    row={row}
                    prefersReducedMotion={prefersReducedMotion}
                  />
                ))}
              </ul>
            </>
          ) : (
            <EmptyState
              title="No organizations in this band yet"
              body="Organizations appear here after members earn weekly XP inside this size band."
            />
          )}
        </section>

        {view === "personal" && currentUserPinned ? (
          <section
            data-testid="current-rank-pinned"
            className="mt-4 w-full max-w-[900px] overflow-hidden rounded-lg border border-[#cfe0ff] bg-white shadow-[0_12px_34px_rgba(77,134,247,0.13)]"
          >
            <div className="flex items-center gap-2 border-b border-[#e5eefc] px-4 py-3 text-sm font-black text-[#1f5fc9] sm:px-6">
              <ChevronUp className="size-4" />
              Your rank
            </div>
            <ul>
              <PersonalRow
                row={currentUserPinned}
                isChampionLeague={isChampionLeague}
                prefersReducedMotion={prefersReducedMotion}
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
            className="mt-4 w-full max-w-[900px] overflow-hidden rounded-lg border border-[#cfead7] bg-white shadow-[0_12px_34px_rgba(52,168,83,0.13)]"
          >
            <div className="flex items-center gap-2 border-b border-[#e5f4e9] px-4 py-3 text-sm font-black text-[#177245] sm:px-6">
              <ChevronUp className="size-4" />
              Your organization
            </div>
            <ul>
              <OrganizationRow
                row={currentOrgPinned}
                prefersReducedMotion={prefersReducedMotion}
              />
            </ul>
          </section>
        ) : null}
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
