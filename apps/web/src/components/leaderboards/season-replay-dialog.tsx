"use client";

import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import { useLocale } from "next-intl";
import { type CSSProperties, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Link2,
  Moon,
  Pause,
  Play,
  Sun,
  X,
} from "@/components/ui/icons";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { LogoMark } from "@/components/landing/logo-mark";
import { cn } from "@/lib/utils";
import {
  formatSeasonReplayXp,
  getLocalizedLeagueName,
  getSeasonReplayCopy,
  getSeasonReplayStoryboard,
  normalizeSeasonReplayLocale,
  type SeasonReplayLocale,
  type SeasonReplayMovement,
  type SeasonReplayRow,
} from "@/lib/leaderboards/replay";
import { LEADERBOARD_LEAGUE_ASSETS } from "@/lib/leaderboards/league-assets";
import type {
  LeaderboardSeasonOutcome,
  LeagueTierId,
} from "@/lib/leaderboards/types";

type ReplayStepId = "league" | "climb" | "result";
type ReplayTheme = "dark" | "light";

const replaySteps: readonly ReplayStepId[] = ["league", "climb", "result"];
const REPLAY_ROW_SLOT_PX = 64;
const REPLAY_ROW_HEIGHT_PX = 56;
const REPLAY_VISIBLE_DISTANCE = 5;
const REPLAY_START_VIEWER_OFFSET = 1.08;
const REPLAY_MIN_CLIMB_DURATION_MS = 1900;
const REPLAY_MAX_CLIMB_DURATION_MS = 3100;

const uiCopy: Record<
  SeasonReplayLocale,
  {
    weeklyReplay: string;
    description: string;
    copyLink: string;
    copiedLink: string;
    close: string;
    currentLeague: string;
    previousLeague: string;
    previousWeek: string;
    climbTitle: string;
    resultTitle: string;
    leagueSubtitle: string;
    climbSubtitle: string;
    dropSubtitle: string;
    heldDropSubtitle: string;
    resultSubtitle: string;
    promotionResetSubtitle: string;
    demotionResultSubtitle: string;
    demotionResetSubtitle: string;
    heldDropResultSubtitle: string;
    promotionZone: string;
    championZone: string;
    demotionZone: string;
    holdZone: string;
    topAdvance: string;
    topChampion: string;
    bottomDemote: string;
    finalRank: string;
    seasonXp: string;
    you: string;
    viewerTitle: string;
    rankLabel: string;
    xpLabel: string;
    movedUp: string;
    movedDown: string;
    held: string;
    light: string;
    dark: string;
    theme: string;
    previousStep: string;
    nextStep: string;
    play: string;
    pause: string;
    continue: string;
    viewLeaderboard: string;
    startWeek: string;
    dropStep: string;
    heldStep: string;
    newLeagueStep: string;
    unrankedRank: string;
    unrankedViewerTitle: string;
    steps: Record<ReplayStepId, string>;
  }
> = {
  en: {
    weeklyReplay: "Weekly league replay",
    description:
      "Review your league leaderboard movement, final rank, and next week target.",
    copyLink: "Copy result link",
    copiedLink: "Copied result link",
    close: "Close season replay",
    currentLeague: "Current league",
    previousLeague: "Previous league",
    previousWeek: "Last week's leaderboard",
    climbTitle: "Leaderboard climb",
    resultTitle: "Result locked",
    leagueSubtitle: "Your league opens here. Watch where the week began.",
    climbSubtitle: "Your highlighted row moves into its final rank.",
    dropSubtitle: "Your highlighted row drops into its final rank.",
    heldDropSubtitle: "Your row drops, but stays above the demotion zone.",
    resultSubtitle: "The outcome is based on where your row landed.",
    promotionResetSubtitle:
      "Promotion earned. Your new league starts fresh at 0 XP.",
    demotionResultSubtitle: "The bottom-five finish moved you down a league.",
    demotionResetSubtitle:
      "Demotion applied. Your new league starts fresh at 0 XP.",
    heldDropResultSubtitle: "Your rank fell, but your league stayed intact.",
    promotionZone: "Promotion zone",
    championZone: "Champion zone",
    demotionZone: "Demotion zone",
    holdZone: "Hold zone",
    topAdvance: "Top 8 advance",
    topChampion: "Top 3 finish",
    bottomDemote: "Bottom 5 demote",
    finalRank: "Final rank",
    seasonXp: "Season XP",
    you: "You",
    viewerTitle: "Debate climber",
    rankLabel: "Rank",
    xpLabel: "XP",
    movedUp: "moved up",
    movedDown: "moved down",
    held: "held",
    light: "Light",
    dark: "Dark",
    theme: "Replay theme",
    previousStep: "Previous replay step",
    nextStep: "Next replay step",
    play: "Play replay",
    pause: "Pause replay",
    continue: "Continue",
    viewLeaderboard: "View leaderboard",
    startWeek: "Start week",
    dropStep: "Drop",
    heldStep: "Held",
    newLeagueStep: "New league",
    unrankedRank: "—",
    unrankedViewerTitle: "Unranked this week",
    steps: {
      league: "League",
      climb: "Climb",
      result: "Result",
    },
  },
  vi: {
    weeklyReplay: "Replay bảng hạng tuần",
    description:
      "Xem lại chuyển động trên bảng hạng, thứ hạng cuối cùng, và mục tiêu tuần mới.",
    copyLink: "Sao chép link kết quả",
    copiedLink: "Đã sao chép link",
    close: "Đóng replay mùa giải",
    currentLeague: "Giải hiện tại",
    previousLeague: "Giải tuần trước",
    previousWeek: "Bảng hạng tuần trước",
    climbTitle: "Leo bảng xếp hạng",
    resultTitle: "Kết quả đã chốt",
    leagueSubtitle: "Giải của bạn mở ra ở đây. Xem tuần trước bắt đầu ra sao.",
    climbSubtitle: "Hàng được tô sáng sẽ di chuyển tới thứ hạng cuối.",
    dropSubtitle: "Hàng được tô sáng sẽ tụt xuống thứ hạng cuối.",
    heldDropSubtitle: "Hàng của bạn tụt xuống, nhưng vẫn ngoài vùng xuống hạng.",
    resultSubtitle: "Kết quả dựa trên vị trí cuối cùng của bạn trên bảng.",
    promotionResetSubtitle:
      "Bạn đã thăng hạng. Giải mới bắt đầu lại ở 0 XP.",
    demotionResultSubtitle: "Kết quả bottom 5 khiến bạn xuống một giải.",
    demotionResetSubtitle:
      "Bạn đã xuống hạng. Giải mới bắt đầu lại ở 0 XP.",
    heldDropResultSubtitle: "Thứ hạng tụt xuống, nhưng bạn vẫn giữ được giải.",
    promotionZone: "Vùng thăng hạng",
    championZone: "Vùng Champion",
    demotionZone: "Vùng xuống hạng",
    holdZone: "Vùng giữ hạng",
    topAdvance: "Top 8 thăng hạng",
    topChampion: "Top 3 Champion",
    bottomDemote: "Bottom 5 xuống hạng",
    finalRank: "Hạng cuối",
    seasonXp: "XP mùa",
    you: "Bạn",
    viewerTitle: "Người leo bảng",
    rankLabel: "Hạng",
    xpLabel: "XP",
    movedUp: "leo lên",
    movedDown: "tụt xuống",
    held: "giữ hạng",
    light: "Sáng",
    dark: "Tối",
    theme: "Giao diện replay",
    previousStep: "Bước replay trước",
    nextStep: "Bước replay tiếp theo",
    play: "Phát replay",
    pause: "Tạm dừng replay",
    continue: "Tiếp tục",
    viewLeaderboard: "Xem bảng hạng",
    startWeek: "Bắt đầu tuần",
    dropStep: "Tụt hạng",
    heldStep: "Giữ hạng",
    newLeagueStep: "Giải mới",
    unrankedRank: "—",
    unrankedViewerTitle: "Chưa có hạng tuần này",
    steps: {
      league: "Giải",
      climb: "Leo bảng",
      result: "Kết quả",
    },
  },
};

function getMovementText(
  movement: SeasonReplayMovement,
  copy: (typeof uiCopy)[SeasonReplayLocale]
) {
  if (movement === "up") return copy.movedUp;
  if (movement === "down") return copy.movedDown;
  return copy.held;
}

function didLeagueChange(outcome: LeaderboardSeasonOutcome) {
  return outcome.fromLeagueTier !== outcome.nextLeagueTier;
}

function isLeagueResetResult(
  outcome: LeaderboardSeasonOutcome,
  currentStep: ReplayStepId
) {
  return currentStep === "result" && didLeagueChange(outcome);
}

function isHeldDownReplay(
  outcome: LeaderboardSeasonOutcome,
  movement: SeasonReplayMovement
) {
  return outcome.outcome === "held" && movement === "down";
}

function getLeagueEyebrow({
  currentStep,
  outcome,
  ui,
  resultEyebrow,
}: {
  currentStep: ReplayStepId;
  outcome: LeaderboardSeasonOutcome;
  ui: (typeof uiCopy)[SeasonReplayLocale];
  resultEyebrow: string;
}) {
  if (currentStep === "result") return resultEyebrow;
  return didLeagueChange(outcome) ? ui.previousLeague : ui.currentLeague;
}

function getStepSubtitle({
  currentStep,
  outcome,
  movement,
  ui,
}: {
  currentStep: ReplayStepId;
  outcome: LeaderboardSeasonOutcome;
  movement: SeasonReplayMovement;
  ui: (typeof uiCopy)[SeasonReplayLocale];
}) {
  if (currentStep === "league") return ui.leagueSubtitle;

  if (currentStep === "climb") {
    if (isHeldDownReplay(outcome, movement)) return ui.heldDropSubtitle;
    if (movement === "down") return ui.dropSubtitle;
    return ui.climbSubtitle;
  }

  if (outcome.outcome === "promoted") return ui.promotionResetSubtitle;
  if (outcome.outcome === "demoted") return ui.demotionResetSubtitle;
  if (isHeldDownReplay(outcome, movement)) return ui.heldDropResultSubtitle;
  return ui.resultSubtitle;
}

function getReplayStepLabel({
  step,
  outcome,
  movement,
  ui,
}: {
  step: ReplayStepId;
  outcome: LeaderboardSeasonOutcome;
  movement: SeasonReplayMovement;
  ui: (typeof uiCopy)[SeasonReplayLocale];
}) {
  if (step === "climb" && movement === "down") return ui.dropStep;
  if (step === "result" && didLeagueChange(outcome)) return ui.newLeagueStep;
  if (step === "result" && outcome.outcome === "held") return ui.heldStep;
  return ui.steps[step];
}

const viewerRowTone: Record<
  SeasonReplayMovement,
  { row: string; avatar: string; subtitle: string }
> = {
  up: {
    row: "bg-surface-container-high shadow-token-card",
    avatar: "bg-surface-container-high text-white",
    subtitle: "text-on-surface-variant",
  },
  down: {
    row: "bg-surface-container shadow-token-card",
    avatar: "bg-surface-container text-white",
    subtitle: "text-on-surface-variant",
  },
  steady: {
    row: "bg-surface-container shadow-token-card",
    avatar: "bg-surface-container-high text-white",
    subtitle: "text-on-surface-variant",
  },
};

function getReplayClimbDuration(startRank: number, finalRank: number) {
  return Math.max(
    REPLAY_MIN_CLIMB_DURATION_MS,
    Math.min(
      REPLAY_MAX_CLIMB_DURATION_MS,
      REPLAY_MIN_CLIMB_DURATION_MS + Math.abs(startRank - finalRank) * 14
    )
  );
}

function easeOutCubic(value: number) {
  const clampedValue = Math.max(0, Math.min(1, value));
  return 1 - (1 - clampedValue) ** 3;
}

function LeagueReplayCrest({
  tierId,
  active,
  prefersReducedMotion,
}: {
  tierId: LeagueTierId;
  active?: boolean;
  prefersReducedMotion: boolean;
}) {
  const assetSrc = LEADERBOARD_LEAGUE_ASSETS[tierId];

  return (
    <motion.div
      initial={false}
      animate={
        prefersReducedMotion
          ? false
          : {
              scale: active ? [1, 1.07, 1] : 1,
              y: active ? [0, -4, 0] : 0,
            }
      }
      transition={{ duration: 0.62, ease: "easeOut" }}
      className={cn(
        "relative flex size-[82px] items-center justify-center drop-shadow-token-card sm:size-24",
        active && "drop-shadow-token-card"
      )}
      aria-hidden
    >
      <Image
        src={assetSrc}
        alt=""
        width={192}
        height={192}
        className="size-full object-contain"
        draggable={false}
        priority={active}
      />
      {active ? (
        <span className="absolute inset-x-3 bottom-0 h-3 rounded-full bg-primary/18 blur-md" />
      ) : null}
    </motion.div>
  );
}

function RankBadge({
  rank,
}: {
  rank: number | string;
}) {
  return (
    <span className="flex w-8 shrink-0 items-center justify-end text-xs font-semibold tabular-nums text-on-surface-variant">
      {rank}
    </span>
  );
}

function ReplayContextRankRow({
  row,
  rank,
  locale,
  offset,
  traveling,
  prefersReducedMotion,
}: {
  row: SeasonReplayRow;
  rank: number;
  locale: SeasonReplayLocale;
  offset: number;
  traveling: boolean;
  prefersReducedMotion: boolean;
}) {
  const distance = Math.abs(offset);

  return (
    <motion.li
      data-testid="season-replay-context-row"
      className="absolute left-0 right-0 top-1/2 z-10 mx-auto flex h-14 w-[calc(100%-32px)] max-w-[430px] items-center gap-3 rounded-md bg-transparent px-3 text-on-surface-variant opacity-72 sm:w-full sm:max-w-[480px] sm:gap-4 sm:px-4"
      initial={
        prefersReducedMotion
          ? false
          : { opacity: 0, y: offset * REPLAY_ROW_SLOT_PX - REPLAY_ROW_HEIGHT_PX / 2 }
      }
      animate={{
        opacity:
          distance > REPLAY_VISIBLE_DISTANCE
            ? 0
            : distance > 3
              ? 0.24
              : distance > 2
                ? 0.42
                : 0.72,
        y: offset * REPLAY_ROW_SLOT_PX - REPLAY_ROW_HEIGHT_PX / 2,
      }}
      exit={
        prefersReducedMotion
          ? undefined
          : {
              opacity: 0,
              y: offset * REPLAY_ROW_SLOT_PX - REPLAY_ROW_HEIGHT_PX / 2,
            }
      }
      transition={{
        duration: prefersReducedMotion ? 0 : traveling ? 0.04 : 0.46,
        ease: traveling ? "linear" : [0.18, 1, 0.24, 1],
      }}
      style={{ willChange: "transform, opacity" }}
    >
      <RankBadge rank={rank} />
      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-container text-xs font-black text-on-surface-variant sm:size-10">
        {row.initials}
      </div>

      <div className="min-w-0 flex-1 text-left">
        <div className="flex min-w-0 items-center gap-2">
          <p className="truncate text-sm font-black sm:text-base">
            {row.displayName}
          </p>
        </div>
        <p className="truncate text-xs font-semibold text-on-surface-variant sm:text-sm">
          {row.title}
        </p>
      </div>

      <div className="min-w-[74px] text-right sm:min-w-[96px]">
        <p className="text-sm font-black tabular-nums sm:text-base">
          {formatSeasonReplayXp(row.seasonXp, locale)}
        </p>
      </div>
    </motion.li>
  );
}

function ReplayViewerRankRow({
  row,
  rank,
  locale,
  offset,
  movement,
  displayTitle,
  xpOverride,
  fadeIn,
  settling,
  prefersReducedMotion,
}: {
  row: SeasonReplayRow;
  rank: number | string;
  locale: SeasonReplayLocale;
  offset: number;
  movement: SeasonReplayMovement;
  displayTitle?: string;
  xpOverride?: number;
  fadeIn: boolean;
  settling: boolean;
  prefersReducedMotion: boolean;
}) {
  const copy = uiCopy[locale];
  const rankDelta = row.startRank - row.finalRank;
  const y = offset * REPLAY_ROW_SLOT_PX - REPLAY_ROW_HEIGHT_PX / 2;
  const tone = viewerRowTone[movement];

  const viewerStyle = {
    transform: `translateY(${y}px)`,
    transition: prefersReducedMotion
      ? undefined
      : settling
        ? "transform 420ms cubic-bezier(0.22, 0.7, 0.2, 1)"
        : "transform 60ms linear",
    willChange: "transform",
  } as CSSProperties;

  return (
      <div
        data-testid="season-replay-viewer-row"
        data-replay-rank={rank}
        className="pointer-events-none absolute left-0 right-0 top-1/2 z-30 mx-auto h-14 w-[calc(100%-32px)] max-w-[430px] origin-center sm:w-full sm:max-w-[480px]"
        style={viewerStyle}
      >
      <motion.div
        className={cn(
          "flex h-full items-center gap-3 rounded-md px-3 text-on-surface sm:gap-4 sm:px-4",
          tone.row
        )}
        initial={
          prefersReducedMotion
            ? false
            : {
                opacity: fadeIn ? 0 : 1,
                scale: settling ? 1 : 1.08,
              }
        }
        animate={{
          opacity: 1,
          scale: settling ? 1 : 1.08,
        }}
        transition={{
          opacity: { duration: prefersReducedMotion ? 0 : 0.18, ease: "easeOut" },
          scale: {
            delay: prefersReducedMotion || !settling ? 0 : 0.08,
            duration: prefersReducedMotion ? 0 : 0.3,
            ease: "easeOut",
          },
        }}
        style={{ willChange: "transform, opacity" }}
      >
        <RankBadge rank={rank} />
        <div
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-black sm:size-10",
            tone.avatar
          )}
        >
          {row.initials}
        </div>

        <div className="min-w-0 flex-1 text-left">
          <p className="truncate text-sm font-black sm:text-base">{copy.you}</p>
          <p className={cn("truncate text-xs font-semibold sm:text-sm", tone.subtitle)}>
            {displayTitle ?? copy.viewerTitle}
          </p>
        </div>

        <div className="min-w-[74px] text-right sm:min-w-[96px]">
          <p className="text-sm font-black tabular-nums sm:text-base">
            {formatSeasonReplayXp(xpOverride ?? row.seasonXp, locale)}
          </p>
          <p className="sr-only">
            {getMovementText(
              rankDelta > 0 ? "up" : rankDelta < 0 ? "down" : "steady",
              copy
            )}
          </p>
        </div>
      </motion.div>
      </div>
  );
}

export function SeasonReplayDialog({
  open,
  outcome,
  onOpenChange,
  onViewLeaderboard,
  prefersReducedMotion,
  reviewMode = false,
}: {
  open: boolean;
  outcome: LeaderboardSeasonOutcome;
  onOpenChange: (open: boolean) => void;
  onViewLeaderboard?: () => void;
  prefersReducedMotion: boolean;
  reviewMode?: boolean;
}) {
  const rawLocale = useLocale();
  const locale = normalizeSeasonReplayLocale(rawLocale);
  const copy = useMemo(() => getSeasonReplayCopy(outcome, locale), [outcome, locale]);
  const ui = uiCopy[locale];
  const story = useMemo(() => getSeasonReplayStoryboard(outcome), [outcome]);
  const [stepIndex, setStepIndex] = useState(0);
  const [showFinalRanks, setShowFinalRanks] = useState(false);
  const [viewerAnimatedOffset, setViewerAnimatedOffset] = useState<number | null>(
    null
  );
  const [viewerAnimatedRank, setViewerAnimatedRank] = useState<number | null>(null);
  const [viewerShowsFinalRank, setViewerShowsFinalRank] = useState(false);
  const [viewerSettled, setViewerSettled] = useState(false);
  const [cameraRank, setCameraRank] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);
  const [copied, setCopied] = useState(false);
  const [theme, setTheme] = useState<ReplayTheme>("dark");
  const isDark = reviewMode && theme === "dark";
  const currentStep = replaySteps[stepIndex] ?? replaySteps[0];
  const canGoBack = stepIndex > 0;
  const canGoForward = stepIndex < replaySteps.length - 1;
  const fromLeague = getLocalizedLeagueName(outcome.fromLeagueTier, locale);
  const nextLeague = getLocalizedLeagueName(outcome.nextLeagueTier, locale);
  const viewerRow = story.rows.find((row) => row.isViewer);
  const leagueResetResult = isLeagueResetResult(outcome, currentStep);
  const useFinalRanks = currentStep === "result" || showFinalRanks;
  const viewerRank =
    currentStep === "climb"
      ? viewerAnimatedRank ?? story.startRank
      : viewerShowsFinalRank || currentStep === "result"
        ? story.finalRank
        : story.startRank;
  const viewerStartOffset = prefersReducedMotion ? 0 : REPLAY_START_VIEWER_OFFSET;
  const viewerOffset =
    currentStep === "league"
      ? viewerStartOffset
      : currentStep === "climb"
        ? viewerAnimatedOffset ?? viewerStartOffset
        : 0;
  const contextCameraRank =
    cameraRank ??
    (useFinalRanks
      ? story.finalRank
      : currentStep === "league"
        ? story.startRank - viewerStartOffset
        : viewerRank - viewerOffset);
  const contextRows = useMemo(() => {
    return story.rows
      .filter((row) => !row.isViewer)
      .map((row) => {
        const rank = useFinalRanks ? row.finalRank : row.startRank;
        return {
          row,
          rank,
          offset: rank - contextCameraRank,
        };
      })
      .filter(({ rank }) => rank !== viewerRank)
      .sort((a, b) => a.offset - b.offset);
  }, [contextCameraRank, story.rows, useFinalRanks, viewerRank]);
  const visibleContextRows = leagueResetResult ? [] : contextRows;
  const viewerIsSettled =
    prefersReducedMotion || currentStep !== "climb" || viewerSettled;
  const viewerDisplayRank = leagueResetResult ? ui.unrankedRank : viewerRank;
  const viewerDisplayTitle = leagueResetResult ? ui.unrankedViewerTitle : undefined;
  const viewerXpOverride = leagueResetResult ? 0 : undefined;
  const title =
    currentStep === "league"
      ? fromLeague.name
      : currentStep === "climb"
        ? fromLeague.name
        : copy.title;
  const subtitle = getStepSubtitle({
    currentStep,
    outcome,
    movement: story.movement,
    ui,
  });
  const leagueEyebrow = getLeagueEyebrow({
    currentStep,
    outcome,
    ui,
    resultEyebrow: copy.eyebrow,
  });

  useEffect(() => {
    if (!open) return;

    const resetTimer = window.setTimeout(() => {
      setStepIndex(0);
      setShowFinalRanks(false);
      setViewerAnimatedOffset(null);
      setViewerAnimatedRank(null);
      setViewerShowsFinalRank(false);
      setViewerSettled(false);
      setCameraRank(null);
      setPaused(prefersReducedMotion);
      setCopied(false);

      try {
        const params = new URLSearchParams(window.location.search);
        const queryTheme = params.get("replayTheme");
        const storedTheme = window.localStorage.getItem("leaderboard-replay-theme");
        if (queryTheme === "light" || queryTheme === "dark") {
          setTheme(queryTheme);
          window.localStorage.setItem("leaderboard-replay-theme", queryTheme);
        } else if (storedTheme === "light" || storedTheme === "dark") {
          setTheme(storedTheme);
        }
      } catch {
        setTheme("dark");
      }
    }, 0);

    return () => window.clearTimeout(resetTimer);
  }, [open, outcome.resolvedAt, prefersReducedMotion]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (currentStep === "league") {
        setShowFinalRanks(false);
        setViewerAnimatedOffset(null);
        setViewerAnimatedRank(null);
        setViewerShowsFinalRank(false);
        setViewerSettled(false);
        setCameraRank(story.startRank - viewerStartOffset);
      }

      if (currentStep === "result") {
        setShowFinalRanks(true);
        setViewerAnimatedOffset(0);
        setViewerAnimatedRank(story.finalRank);
        setViewerShowsFinalRank(true);
        setViewerSettled(true);
        setCameraRank(story.finalRank);
      }

      if (currentStep === "climb") {
        setShowFinalRanks(false);
        setViewerAnimatedOffset(viewerStartOffset);
        setViewerAnimatedRank(story.startRank);
        setViewerShowsFinalRank(false);
        setViewerSettled(false);
        setCameraRank(story.startRank - viewerStartOffset);
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, [currentStep, story.finalRank, story.startRank, viewerStartOffset]);

  useEffect(() => {
    if (!open || currentStep !== "climb") return;

    if (prefersReducedMotion) {
      const reducedMotionTimer = window.setTimeout(() => {
        setShowFinalRanks(true);
        setViewerAnimatedOffset(0);
        setViewerAnimatedRank(story.finalRank);
        setViewerShowsFinalRank(true);
        setViewerSettled(true);
        setCameraRank(story.finalRank);
      }, 0);
      return () => window.clearTimeout(reducedMotionTimer);
    }

    const duration = getReplayClimbDuration(story.startRank, story.finalRank);
    const startTime = window.performance.now();
    let frameId = 0;
    const settleTimers: number[] = [];

    const tick = (now: number) => {
      const linearProgress = (now - startTime) / duration;
      const progress = easeOutCubic(linearProgress);
      const rankFloat =
        story.startRank + (story.finalRank - story.startRank) * progress;
      const viewerOffsetAtProgress = viewerStartOffset * (1 - progress);

      setViewerAnimatedOffset(viewerOffsetAtProgress);
      setCameraRank(rankFloat - viewerOffsetAtProgress);
      setViewerAnimatedRank(Math.max(1, Math.round(rankFloat)));

      if (linearProgress < 1) {
        frameId = window.requestAnimationFrame(tick);
        return;
      }

      setViewerAnimatedOffset(0);
      setCameraRank(story.finalRank);
      setViewerAnimatedRank(story.finalRank);
      setViewerShowsFinalRank(true);
      settleTimers.push(window.setTimeout(() => setViewerSettled(true), 260));
      settleTimers.push(window.setTimeout(() => setShowFinalRanks(true), 540));
    };

    const startTimer = window.setTimeout(() => {
      frameId = window.requestAnimationFrame(tick);
    }, 340);

    return () => {
      window.clearTimeout(startTimer);
      settleTimers.forEach((timer) => window.clearTimeout(timer));
      if (frameId) window.cancelAnimationFrame(frameId);
    };
  }, [
    currentStep,
    open,
    prefersReducedMotion,
    story.finalRank,
    story.startRank,
    viewerStartOffset,
  ]);

  useEffect(() => {
    if (
      !open ||
      prefersReducedMotion ||
      paused ||
      stepIndex >= replaySteps.length - 1
    ) {
      return;
    }

    const delay = currentStep === "climb" ? 5600 : 1900;
    const timer = window.setTimeout(() => {
      setStepIndex((value) => Math.min(replaySteps.length - 1, value + 1));
    }, delay);

    return () => window.clearTimeout(timer);
  }, [currentStep, open, paused, prefersReducedMotion, stepIndex]);

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onOpenChange(false);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (!open || process.env.NODE_ENV !== "development") return;

    const style = document.createElement("style");
    style.textContent = "nextjs-portal{display:none!important;}";
    document.head.appendChild(style);

    return () => style.remove();
  }, [open]);

  function setReplayTheme(nextTheme: ReplayTheme) {
    setTheme(nextTheme);
    try {
      window.localStorage.setItem("leaderboard-replay-theme", nextTheme);
    } catch {
      // Local replay display preference is best-effort only.
    }
  }

  function goToNext() {
    setPaused(true);
    if (currentStep === "climb" && !showFinalRanks) {
      setShowFinalRanks(true);
      setViewerAnimatedOffset(0);
      setViewerAnimatedRank(story.finalRank);
      setViewerShowsFinalRank(true);
      setViewerSettled(true);
      setCameraRank(story.finalRank);
      return;
    }

    setStepIndex((value) => Math.min(replaySteps.length - 1, value + 1));
  }

  function goToPrevious() {
    setPaused(true);
    setStepIndex((value) => Math.max(0, value - 1));
  }

  function finishReplay() {
    if (onViewLeaderboard) {
      onViewLeaderboard();
      return;
    }

    onOpenChange(false);
  }

  async function copyReplayLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        data-testid="season-replay-dialog"
        className={cn(
          "!fixed !inset-0 !left-0 !top-0 !z-[70] flex !h-dvh !max-h-dvh !w-screen !max-w-none !translate-x-0 !translate-y-0 !transform-none grid-cols-1 flex-col overflow-hidden !rounded-none !border-0 p-0 shadow-none ring-0 !duration-0 data-closed:!animate-none data-open:!animate-none sm:!max-w-none",
          reviewMode && isDark
            ? "bg-surface-container-high text-white"
            : "bg-background text-on-surface"
        )}
      >
        <DialogTitle className="sr-only">{copy.title}</DialogTitle>
        <DialogDescription className="sr-only">{ui.description}</DialogDescription>

        <div
          data-testid="season-replay-screen"
          data-replay-theme={reviewMode ? theme : "light"}
          className={cn(
            "relative flex h-full min-h-0 flex-col overflow-hidden",
            reviewMode && isDark ? "bg-surface-container-high" : "bg-background"
          )}
        >
          {reviewMode ? (
          <header className="relative z-20 flex h-16 shrink-0 items-center justify-between px-4 sm:h-20 sm:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <LogoMark
                size="sm"
                variant={isDark ? "dark" : "light"}
                className="h-8 w-[114px] sm:h-10 sm:w-[142px]"
                priority
              />
              <div className={cn("hidden h-7 w-px sm:block", isDark ? "bg-white/10" : "bg-surface-container-high")} />
              <span className={cn("hidden truncate text-sm font-bold sm:block", isDark ? "text-white/64" : "text-on-surface-variant")}>
                {ui.weeklyReplay}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <div
                aria-label={ui.theme}
                className={cn(
                  "hidden rounded-full p-1 sm:flex",
                  isDark ? "bg-white/[0.08]" : "bg-white shadow-sm"
                )}
              >
                {(["dark", "light"] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    aria-label={value === "dark" ? ui.dark : ui.light}
                    title={value === "dark" ? ui.dark : ui.light}
                    onClick={() => setReplayTheme(value)}
                    className={cn(
                      "flex size-8 items-center justify-center rounded-full transition",
                      theme === value
                        ? isDark
                          ? "bg-white text-on-surface-variant"
                          : "bg-surface-container-high text-white"
                        : isDark
                          ? "text-white/64 hover:bg-white/10 hover:text-white"
                          : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
                    )}
                  >
                    {value === "dark" ? <Moon className="size-4" /> : <Sun className="size-4" />}
                  </button>
                ))}
              </div>
              <button
                type="button"
                aria-label={copied ? ui.copiedLink : ui.copyLink}
                title={copied ? ui.copiedLink : ui.copyLink}
                onClick={copyReplayLink}
                className={cn(
                  "hidden size-9 items-center justify-center rounded-full transition sm:flex",
                  isDark
                    ? "bg-white/[0.08] text-white/72 hover:bg-white/[0.14] hover:text-white"
                    : "bg-white text-on-surface-variant shadow-sm hover:bg-surface-container hover:text-on-surface"
                )}
              >
                {copied ? <Check className="size-4" /> : <Link2 className="size-4" />}
              </button>
              <button
                type="button"
                aria-label={ui.close}
                title={ui.close}
                onClick={() => onOpenChange(false)}
                className={cn(
                  "flex size-10 items-center justify-center rounded-full transition",
                  isDark
                    ? "bg-white/[0.08] text-white/72 hover:bg-white/[0.16] hover:text-white"
                    : "bg-white text-on-surface-variant shadow-sm hover:bg-surface-container hover:text-on-surface"
                )}
              >
                <X className="size-5" />
              </button>
            </div>
          </header>
          ) : null}

          {reviewMode ? (
          <button
            type="button"
            aria-label={ui.previousStep}
            title={ui.previousStep}
            onClick={goToPrevious}
            disabled={!canGoBack}
            className={cn(
              "absolute left-5 top-1/2 z-20 hidden size-12 -translate-y-1/2 items-center justify-center rounded-full transition disabled:cursor-default disabled:opacity-30 lg:flex",
              isDark
                ? "bg-white/[0.08] text-white/78 hover:bg-white/[0.16] hover:text-white"
                : "bg-white text-on-surface-variant shadow-sm hover:bg-surface-container hover:text-on-surface"
            )}
          >
            <ArrowLeft className="size-5" />
          </button>
          ) : null}
          {reviewMode ? (
          <button
            type="button"
            aria-label={ui.nextStep}
            title={ui.nextStep}
            onClick={goToNext}
            disabled={!canGoForward}
            className={cn(
              "absolute right-5 top-1/2 z-20 hidden size-12 -translate-y-1/2 items-center justify-center rounded-full transition disabled:cursor-default disabled:opacity-30 lg:flex",
              isDark
                ? "bg-white/[0.08] text-white/78 hover:bg-white/[0.16] hover:text-white"
                : "bg-white text-on-surface-variant shadow-sm hover:bg-surface-container hover:text-on-surface"
            )}
          >
            <ArrowRight className="size-5" />
          </button>
          ) : null}

          <main
            className={cn(
              "relative z-10 flex min-h-0 flex-1 items-center justify-center",
              reviewMode ? "px-3 sm:px-16 lg:px-28" : "px-0"
            )}
          >
            <section
              className={cn(
                "relative flex w-full flex-col overflow-hidden",
                reviewMode
                  ? cn(
                      "h-full max-h-[760px] min-h-[520px] max-w-[960px] rounded-[18px] border shadow-token-card",
                      isDark ? "border-white/10 bg-white" : "border-outline-variant bg-white"
                    )
                  : "h-full min-h-0 max-w-none border-0 bg-background shadow-none"
              )}
            >
              <div
                className={cn(
                  "relative z-10 flex min-h-0 flex-1 flex-col items-center text-center",
                  reviewMode
                    ? "px-4 pb-5 pt-10 sm:px-8 sm:pb-8 sm:pt-12"
                    : "mx-auto w-full max-w-[820px] justify-center px-5 py-8 sm:px-8"
                )}
              >
                <div className="flex shrink-0 flex-col items-center text-center">
                  <div className="flex flex-col items-center justify-center gap-3">
                    <LeagueReplayCrest
                      tierId={currentStep === "result" ? outcome.nextLeagueTier : outcome.fromLeagueTier}
                      active={currentStep !== "league" || showFinalRanks}
                      prefersReducedMotion={prefersReducedMotion}
                    />
                    <div className="min-w-0 text-center">
	                      <p
	                        className="type-caption font-black uppercase text-on-surface-variant"
	                      >
	                        {leagueEyebrow}
	                      </p>
                      <h2
                        data-testid="season-replay-league-title"
                        className="mt-1 truncate type-heading-lg font-black text-on-surface-variant sm:type-heading-xl"
                      >
                        {currentStep === "result" ? nextLeague.name : title}
                      </h2>
                    </div>
                  </div>
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.p
                      key={`${currentStep}-${showFinalRanks ? "final" : "start"}`}
                      initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={prefersReducedMotion ? undefined : { opacity: 0, y: -8 }}
                      transition={{ duration: prefersReducedMotion ? 0 : 0.24 }}
                      className="mt-2 max-w-[420px] text-sm font-semibold leading-6 text-on-surface-variant sm:text-base"
                    >
                      {subtitle}
                    </motion.p>
                  </AnimatePresence>
                </div>

                <div
                  data-testid="season-replay-camera-stage"
                  className={cn(
                    "relative mt-6 w-full max-w-[560px] shrink-0 overflow-hidden",
                    reviewMode
                      ? "h-[min(386px,42dvh)] min-h-[312px]"
                      : "h-[min(430px,43dvh)] min-h-[330px]"
                  )}
                  data-replay-camera-rank={Math.round(contextCameraRank)}
                >
                  <ol className="absolute inset-0 [-webkit-mask-image:linear-gradient(to_bottom,transparent_0,black_14%,black_86%,transparent_100%)] [mask-image:linear-gradient(to_bottom,transparent_0,black_14%,black_86%,transparent_100%)]">
                    <AnimatePresence initial={false}>
                      {visibleContextRows.map(({ row, rank, offset }) => (
                        <ReplayContextRankRow
                          key={`${row.id}-${useFinalRanks ? "final" : "start"}`}
                          row={row}
                          rank={rank}
                          offset={offset}
                          locale={locale}
                          traveling={currentStep === "climb" && !viewerSettled}
                          prefersReducedMotion={prefersReducedMotion}
                        />
                      ))}
                    </AnimatePresence>
                  </ol>

                  {viewerRow ? (
                    <ReplayViewerRankRow
	                      key={`viewer-centered-row-${currentStep}`}
	                      row={viewerRow}
	                      rank={viewerDisplayRank}
	                      locale={locale}
	                      offset={viewerOffset}
	                      movement={story.movement}
	                      displayTitle={viewerDisplayTitle}
	                      xpOverride={viewerXpOverride}
	                      fadeIn={currentStep === "league"}
	                      settling={viewerIsSettled}
	                      prefersReducedMotion={prefersReducedMotion}
                    />
                  ) : null}
                </div>

                <AnimatePresence mode="wait" initial={false}>
                  {currentStep === "result" ? (
                    <motion.p
                      key="result-copy"
                      initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={prefersReducedMotion ? undefined : { opacity: 0, y: -8 }}
                      transition={{ duration: prefersReducedMotion ? 0 : 0.24 }}
                      className="mt-3 max-w-[520px] shrink-0 text-sm font-semibold leading-6 text-on-surface-variant"
                    >
                      {copy.transition} {copy.summary}
                    </motion.p>
                  ) : null}
                </AnimatePresence>
                {!reviewMode ? (
                  <button
                    type="button"
                    className="mt-5 h-14 w-full max-w-[420px] rounded-full bg-surface-container-high text-base font-black text-white shadow-token-card transition hover:bg-surface-container-high focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-outline-variant/20"
                    onClick={() => {
                      if (canGoForward) {
                        goToNext();
                        return;
                      }

                      finishReplay();
                    }}
                  >
                    {ui.continue}
                  </button>
                ) : null}
              </div>
            </section>
          </main>

          {reviewMode ? (
          <footer className="relative z-20 shrink-0 px-5 pb-5 pt-4 sm:px-8 sm:pb-7">
            <div className="mx-auto w-full max-w-[720px]">
              <div className="flex items-center gap-2">
                {replaySteps.map((step, index) => {
                  const complete = index < stepIndex;
                  const active = index === stepIndex;
                  const stepLabel = getReplayStepLabel({
                    step,
                    outcome,
                    movement: story.movement,
                    ui,
                  });

                  return (
                    <button
                      key={step}
                      type="button"
                      onClick={() => {
                        setPaused(true);
                        setStepIndex(index);
                      }}
                      className="group flex min-w-0 flex-1 flex-col items-stretch gap-2"
                      aria-label={`${stepLabel} replay step`}
                      aria-current={active ? "step" : undefined}
                    >
                      <span
                        className={cn(
                          "relative h-1.5 overflow-hidden rounded-full",
                          isDark ? "bg-white/14" : "bg-surface-container-high"
                        )}
                      >
                        <motion.span
                          className={cn(
                            "absolute inset-y-0 left-0 rounded-full",
                            isDark ? "bg-white" : "bg-surface-container-high"
                          )}
                          initial={false}
                          animate={{
                            width: complete || active ? "100%" : "0%",
                            opacity: active || complete ? 1 : 0.35,
                          }}
                          transition={{
                            duration: prefersReducedMotion ? 0 : active ? 1.2 : 0.18,
                            ease: "easeOut",
                          }}
                        />
                      </span>
                      <span
                        className={cn(
                          "truncate text-left type-caption font-black uppercase",
                          active
                            ? isDark
                              ? "text-white"
                              : "text-on-surface"
                            : isDark
                              ? "text-white/42"
                              : "text-on-surface-variant"
                        )}
                      >
                        {stepLabel}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-center">
                <div className="flex items-center justify-center gap-2">
                  <button
                    type="button"
                    aria-label={ui.previousStep}
                    title={ui.previousStep}
                    onClick={goToPrevious}
                    disabled={!canGoBack}
                    className={cn(
                      "flex size-10 items-center justify-center rounded-full transition disabled:cursor-default disabled:opacity-30",
                      isDark
                        ? "bg-white/[0.08] text-white/72 hover:bg-white/[0.16] hover:text-white"
                        : "bg-white text-on-surface-variant shadow-sm hover:bg-surface-container hover:text-on-surface"
                    )}
                  >
                    <ArrowLeft className="size-4" />
                  </button>
                  <button
                    type="button"
                    aria-label={paused ? ui.play : ui.pause}
                    title={paused ? ui.play : ui.pause}
                    onClick={() => setPaused((value) => !value)}
                    className={cn(
                      "flex size-10 items-center justify-center rounded-full transition",
                      isDark
                        ? "bg-white/[0.08] text-white/72 hover:bg-white/[0.16] hover:text-white"
                        : "bg-white text-on-surface-variant shadow-sm hover:bg-surface-container hover:text-on-surface"
                    )}
                  >
                    {paused ? <Play className="size-4" /> : <Pause className="size-4" />}
                  </button>
                  <button
                    type="button"
                    aria-label={ui.nextStep}
                    title={ui.nextStep}
                    onClick={goToNext}
                    disabled={!canGoForward}
                    className={cn(
                      "flex size-10 items-center justify-center rounded-full transition disabled:cursor-default disabled:opacity-30",
                      isDark
                        ? "bg-white/[0.08] text-white/72 hover:bg-white/[0.16] hover:text-white"
                        : "bg-white text-on-surface-variant shadow-sm hover:bg-surface-container hover:text-on-surface"
                    )}
                  >
                    <ArrowRight className="size-4" />
                  </button>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    className={cn(
                      isDark
                        ? "border-white/16 bg-white/[0.08] text-white hover:bg-white/[0.14]"
                        : "border-outline-variant bg-white text-on-surface hover:bg-surface-container"
                    )}
                    onClick={finishReplay}
                  >
                    {ui.viewLeaderboard}
                  </Button>
                  <Button
                    type="button"
                    size="lg"
                    className={cn(
                      isDark
                        ? "bg-white text-on-surface-variant hover:bg-white/90"
                        : "bg-surface-container-high text-white hover:bg-surface-container-high"
                    )}
                    onClick={() => {
                      if (canGoForward) {
                        goToNext();
                        return;
                      }

                      onOpenChange(false);
                    }}
                  >
                    {canGoForward ? ui.continue : ui.startWeek}
                  </Button>
                </div>
              </div>
            </div>
          </footer>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
