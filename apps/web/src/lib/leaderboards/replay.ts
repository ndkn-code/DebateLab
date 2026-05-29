import type {
  LeaderboardSeasonOutcome,
  LeagueTierId,
  PromotionZone,
} from "@/lib/leaderboards/types";
import {
  CHAMPION_RECOGNITION_COUNT,
  PERSONAL_DEMOTION_COUNT,
  PERSONAL_PROMOTION_COUNT,
} from "@/lib/leaderboards/model";

export type SeasonReplayTone = "positive" | "steady" | "negative";
export type SeasonReplayLocale = "en" | "vi";
export type SeasonReplayMovement = "up" | "down" | "steady";

export interface SeasonReplayCopy {
  eyebrow: string;
  title: string;
  summary: string;
  transition: string;
  nextStep: string;
  tone: SeasonReplayTone;
}

export interface SeasonReplayRow {
  id: string;
  displayName: string;
  initials: string;
  title: string;
  seasonXp: number;
  startRank: number;
  finalRank: number;
  zone: PromotionZone;
  isViewer: boolean;
}

export interface SeasonReplayStoryboard {
  rows: SeasonReplayRow[];
  startRank: number;
  finalRank: number;
  cohortSize: number;
  promotionCutoff: number;
  demotionCutoff: number;
  movement: SeasonReplayMovement;
}

const REPLAY_NAMES = [
  ["Maya Tran", "MT", "Rebuttal tactician"],
  ["Noah Chen", "NC", "Case builder"],
  ["Aisha Patel", "AP", "Evidence hunter"],
  ["Leo Morgan", "LM", "Crossfire lead"],
  ["Sofia Reyes", "SR", "Delivery specialist"],
  ["Jensen Nguyen", "JN", "Thinkfy debater"],
  ["Ethan Brooks", "EB", "Impact weigher"],
  ["Lina Park", "LP", "POI striker"],
  ["Arun Shah", "AS", "Framework lead"],
  ["Camille Duong", "CD", "Clash mapper"],
  ["Iris Williams", "IW", "Prep room captain"],
  ["Minh Le", "ML", "Whip speaker"],
  ["Omar Hassan", "OH", "Logic grinder"],
  ["Priya Menon", "PM", "Policy scout"],
  ["Hannah Kim", "HK", "Summary closer"],
] as const;

const LEAGUE_NAMES: Record<
  SeasonReplayLocale,
  Record<LeagueTierId, { name: string; shortName: string }>
> = {
  en: {
    novice: { name: "Novice League", shortName: "Novice" },
    constructive: { name: "Constructive League", shortName: "Constructive" },
    rebuttal: { name: "Rebuttal League", shortName: "Rebuttal" },
    whip: { name: "Whip League", shortName: "Whip" },
    champion: { name: "Champion League", shortName: "Champion" },
  },
  vi: {
    novice: { name: "Giải Tân binh", shortName: "Tân binh" },
    constructive: { name: "Giải Xây dựng luận điểm", shortName: "Xây dựng" },
    rebuttal: { name: "Giải Phản biện", shortName: "Phản biện" },
    whip: { name: "Giải Tổng kết", shortName: "Tổng kết" },
    champion: { name: "Giải Vô địch", shortName: "Vô địch" },
  },
};

export function isReplayableSeasonOutcome(
  outcome: LeaderboardSeasonOutcome | null | undefined
) {
  return Boolean(outcome && outcome.outcome !== "inactive");
}

export function getSeasonReplayDismissalKey(
  viewerUserId: string,
  outcome: LeaderboardSeasonOutcome
) {
  return [
    "leaderboard-season-replay",
    viewerUserId,
    outcome.seasonId,
    outcome.resolvedAt,
    outcome.outcome,
  ].join(":");
}

export function normalizeSeasonReplayLocale(locale: string | undefined) {
  return locale?.toLowerCase().startsWith("vi") ? "vi" : "en";
}

export function getLocalizedLeagueName(
  tierId: LeagueTierId,
  locale: string | undefined
) {
  const replayLocale = normalizeSeasonReplayLocale(locale);
  return LEAGUE_NAMES[replayLocale][tierId] ?? LEAGUE_NAMES.en[tierId];
}

export function formatSeasonReplayXp(value: number, locale: string | undefined) {
  const replayLocale = normalizeSeasonReplayLocale(locale);
  return `${new Intl.NumberFormat(replayLocale === "vi" ? "vi-VN" : "en-US").format(
    value
  )} XP`;
}

export function getSeasonReplayCopy(
  outcome: LeaderboardSeasonOutcome,
  locale = "en"
): SeasonReplayCopy {
  const replayLocale = normalizeSeasonReplayLocale(locale);
  const rankLine =
    replayLocale === "vi"
      ? `Bạn kết thúc ở hạng #${outcome.finalRank} với ${formatSeasonReplayXp(
          outcome.seasonXp,
          replayLocale
        )}.`
      : `You finished #${outcome.finalRank} with ${formatSeasonReplayXp(
          outcome.seasonXp,
          replayLocale
        )}.`;
  const nextLeague = getLocalizedLeagueName(outcome.nextLeagueTier, replayLocale).name;
  const fromLeague = getLocalizedLeagueName(outcome.fromLeagueTier, replayLocale).name;
  const movedDownWithinLeague =
    outcome.outcome === "held" &&
    typeof outcome.replayStartRank === "number" &&
    outcome.replayStartRank < outcome.finalRank;

  if (outcome.outcome === "champion") {
    return {
      eyebrow: replayLocale === "vi" ? "Tuần mới đã mở" : "New week unlocked",
      title: replayLocale === "vi" ? "Top Champion" : "Champion finish",
      summary: rankLine,
      transition:
        replayLocale === "vi"
          ? `Bạn giữ vững nhóm dẫn đầu ở ${fromLeague}.`
          : `You held the top zone in ${fromLeague}.`,
      nextStep:
        replayLocale === "vi"
          ? "Tuần này hãy giữ phong độ và bảo vệ vị trí."
          : "Stay sharp next week and defend the finish.",
      tone: "positive",
    };
  }

  if (outcome.outcome === "promoted") {
    return {
      eyebrow: replayLocale === "vi" ? "Tuần mới đã mở" : "New week unlocked",
      title: replayLocale === "vi" ? "Thăng hạng" : "Promoted",
      summary:
        replayLocale === "vi"
          ? "Tuần mới bắt đầu lại ở 0 XP."
          : "The new week starts fresh at 0 XP.",
      transition:
        replayLocale === "vi"
          ? `Bạn kết thúc hạng #${outcome.finalRank} ở ${fromLeague} và thăng lên ${nextLeague}.`
          : `You finished #${outcome.finalRank} in ${fromLeague} and advanced to ${nextLeague}.`,
      nextStep:
        replayLocale === "vi"
          ? `Kiếm XP trong tuần này để có thứ hạng ở ${nextLeague}.`
          : `Earn XP this week to place on the ${nextLeague} leaderboard.`,
      tone: "positive",
    };
  }

  if (outcome.outcome === "demoted") {
    return {
      eyebrow: replayLocale === "vi" ? "Tuần mới đã mở" : "New week unlocked",
      title: replayLocale === "vi" ? "Xuống hạng" : "Demoted",
      summary:
        replayLocale === "vi"
          ? "Tuần mới bắt đầu lại ở 0 XP."
          : "The new week starts fresh at 0 XP.",
      transition:
        replayLocale === "vi"
          ? `Bạn kết thúc hạng #${outcome.finalRank} ở ${fromLeague} và xuống ${nextLeague}.`
          : `You finished #${outcome.finalRank} in ${fromLeague} and dropped to ${nextLeague}.`,
      nextStep:
        replayLocale === "vi"
          ? "Bắt đầu tuần mới từ 0 XP và leo lại từng bước."
          : "Start from 0 XP this week and rebuild from there.",
      tone: "negative",
    };
  }

  return {
    eyebrow: replayLocale === "vi" ? "Tuần mới đã mở" : "New week unlocked",
    title: replayLocale === "vi" ? "Giữ hạng" : "League held",
    summary: rankLine,
    transition:
      movedDownWithinLeague
        ? replayLocale === "vi"
          ? `Bạn tụt xuống hạng #${outcome.finalRank} nhưng vẫn ở ${nextLeague}.`
          : `You moved down to #${outcome.finalRank} but stayed in ${nextLeague}.`
        : replayLocale === "vi"
          ? `Bạn tiếp tục ở ${nextLeague}.`
          : `You stayed in ${nextLeague}.`,
    nextStep:
      movedDownWithinLeague
        ? replayLocale === "vi"
          ? "Một tuần gọn hơn sẽ đưa bạn trở lại vùng thăng hạng."
          : "A cleaner week can move you back toward the advance zone."
        : replayLocale === "vi"
          ? "Tuần này nhích cao hơn một chút để vào vùng thăng hạng."
          : "Push a little higher this week to reach the advance zone.",
    tone: "steady",
  };
}

function getReplayCohortSize(outcome: LeaderboardSeasonOutcome) {
  return Math.max(30, Math.min(100, outcome.replayCohortSize ?? 30));
}

function clampRank(rank: number, maxRank = 30) {
  return Math.max(1, Math.min(maxRank, rank));
}

function getReplayStartRank(outcome: LeaderboardSeasonOutcome, maxRank: number) {
  if (typeof outcome.replayStartRank === "number") {
    return clampRank(outcome.replayStartRank, maxRank);
  }

  if (outcome.outcome === "promoted") {
    return clampRank(Math.max(outcome.finalRank + 5, 10), maxRank);
  }

  if (outcome.outcome === "champion") {
    return clampRank(Math.max(outcome.finalRank + 4, 6), maxRank);
  }

  if (outcome.outcome === "demoted") {
    return clampRank(Math.max(1, outcome.finalRank - 6), maxRank);
  }

  return clampRank(
    outcome.finalRank + (outcome.finalRank <= 15 ? 3 : -3),
    maxRank
  );
}

function getReplayRankWindow(startRank: number, finalRank: number, maxRank: number) {
  const low = Math.min(startRank, finalRank);
  const high = Math.max(startRank, finalRank);
  const desiredSize = 9;
  const paddedLow = Math.max(1, low - 2);
  const paddedHigh = Math.min(maxRank, high + 2);
  let windowStart = paddedLow;
  let windowEnd = paddedHigh;

  while (windowEnd - windowStart + 1 < desiredSize && windowStart > 1) {
    windowStart -= 1;
  }

  while (windowEnd - windowStart + 1 < desiredSize && windowEnd < maxRank) {
    windowEnd += 1;
  }

  return { windowStart, windowEnd };
}

function getReplayRowStartRank({
  finalRank,
  viewerStartRank,
  viewerFinalRank,
}: {
  finalRank: number;
  viewerStartRank: number;
  viewerFinalRank: number;
}) {
  if (viewerStartRank > viewerFinalRank) {
    if (finalRank > viewerFinalRank && finalRank <= viewerStartRank) {
      return finalRank - 1;
    }

    return finalRank;
  }

  if (viewerStartRank < viewerFinalRank) {
    if (finalRank >= viewerStartRank && finalRank < viewerFinalRank) {
      return finalRank + 1;
    }

    return finalRank;
  }

  return finalRank;
}

function getReplayDemotionCutoff(cohortSize: number) {
  return Math.max(1, cohortSize - PERSONAL_DEMOTION_COUNT + 1);
}

function classifyReplayZone(
  outcome: LeaderboardSeasonOutcome,
  finalRank: number,
  cohortSize: number
) {
  if (
    outcome.fromLeagueTier === "champion" &&
    finalRank <= CHAMPION_RECOGNITION_COUNT
  ) {
    return "champion" as const;
  }

  if (
    outcome.fromLeagueTier !== "champion" &&
    finalRank <= PERSONAL_PROMOTION_COUNT
  ) {
    return "promote" as const;
  }

  if (
    outcome.fromLeagueTier !== "novice" &&
    finalRank >= getReplayDemotionCutoff(cohortSize)
  ) {
    return "demote" as const;
  }

  return "hold" as const;
}

export function getSeasonReplayStoryboard(
  outcome: LeaderboardSeasonOutcome
): SeasonReplayStoryboard {
  const cohortSize = getReplayCohortSize(outcome);
  const startRank = getReplayStartRank(outcome, cohortSize);
  const finalRank = clampRank(outcome.finalRank, cohortSize);
  const { windowStart, windowEnd } = getReplayRankWindow(
    startRank,
    finalRank,
    cohortSize
  );
  const movement: SeasonReplayMovement =
    startRank > finalRank ? "up" : startRank < finalRank ? "down" : "steady";
  const rows: SeasonReplayRow[] = [];

  for (let rank = windowStart; rank <= windowEnd; rank += 1) {
    const isViewer = rank === finalRank;
    const [displayName, initials, title] =
      REPLAY_NAMES[(rank - 1) % REPLAY_NAMES.length] ?? REPLAY_NAMES[0];
    const xpOffset = (finalRank - rank) * 108;
    const seasonXp = isViewer
      ? outcome.seasonXp
      : Math.max(80, outcome.seasonXp + xpOffset + ((rank % 3) - 1) * 14);

    rows.push({
      id: isViewer ? "viewer" : `replay-row-${rank}`,
      displayName: isViewer ? "You" : displayName,
      initials: isViewer ? "YOU" : initials,
      title: isViewer ? "Debate climber" : title,
      seasonXp,
      startRank: isViewer
        ? startRank
        : getReplayRowStartRank({
            finalRank: rank,
            viewerStartRank: startRank,
            viewerFinalRank: finalRank,
          }),
      finalRank: rank,
      zone: classifyReplayZone(outcome, rank, cohortSize),
      isViewer,
    });
  }

  return {
    rows,
    startRank,
    finalRank,
    cohortSize,
    promotionCutoff:
      outcome.fromLeagueTier === "champion"
        ? CHAMPION_RECOGNITION_COUNT
        : PERSONAL_PROMOTION_COUNT,
    demotionCutoff: getReplayDemotionCutoff(cohortSize),
    movement,
  };
}
