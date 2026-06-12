import type { LeagueTierId } from "@/lib/leaderboards/types";

export const LEADERBOARD_LEAGUE_ASSETS: Record<LeagueTierId, string> = {
  novice: "/leaderboards/leagues/novice.webp",
  constructive: "/leaderboards/leagues/constructive.webp",
  rebuttal: "/leaderboards/leagues/rebuttal.webp",
  whip: "/leaderboards/leagues/whip.webp",
  champion: "/leaderboards/leagues/champion.webp",
};

export function coerceLeagueTierId(
  value: string | null | undefined
): LeagueTierId {
  const normalized = value?.trim().toLowerCase();
  return normalized && normalized in LEADERBOARD_LEAGUE_ASSETS
    ? (normalized as LeagueTierId)
    : "novice";
}
