import type {
  LeagueTierId,
  OrganizationBand,
  OrganizationLeaderboardCandidate,
  OrganizationLeaderboardRow,
  PersonalLeaderboardCandidate,
  PersonalLeaderboardRow,
  PersonalLeagueTier,
  PromotionZone,
} from "@/lib/leaderboards/types";

export const PERSONAL_COHORT_SIZE = 30;
export const PERSONAL_PROMOTION_COUNT = 8;
export const PERSONAL_DEMOTION_COUNT = 5;
export const PERSONAL_MIN_DEMOTION_ACTIVE_COUNT = 12;
export const CHAMPION_RECOGNITION_COUNT = 3;

export const LEAGUE_TIERS: readonly Omit<PersonalLeagueTier, "status">[] = [
  { id: "novice", name: "Novice League", shortName: "Novice", order: 0 },
  {
    id: "constructive",
    name: "Constructive League",
    shortName: "Constructive",
    order: 1,
  },
  { id: "rebuttal", name: "Rebuttal League", shortName: "Rebuttal", order: 2 },
  { id: "whip", name: "Whip League", shortName: "Whip", order: 3 },
  { id: "champion", name: "Champion League", shortName: "Champion", order: 4 },
] as const;

export const ORGANIZATION_BANDS: readonly OrganizationBand[] = [
  "small",
  "medium",
  "large",
] as const;

export function getLeagueTier(tierId: LeagueTierId) {
  return LEAGUE_TIERS.find((tier) => tier.id === tierId) ?? LEAGUE_TIERS[0];
}

export function buildTierProgress(currentTierId: LeagueTierId): PersonalLeagueTier[] {
  const currentTier = getLeagueTier(currentTierId);

  return LEAGUE_TIERS.map((tier) => ({
    ...tier,
    status:
      tier.order < currentTier.order
        ? "completed"
        : tier.order === currentTier.order
          ? "current"
          : "locked",
  }));
}

export function isDemotionEnabled(activeCount: number, currentTierId: LeagueTierId) {
  return (
    currentTierId !== "novice" &&
    activeCount >= PERSONAL_MIN_DEMOTION_ACTIVE_COUNT
  );
}

export function classifyPersonalZone({
  rank,
  activeCount,
  currentTierId,
}: {
  rank: number;
  activeCount: number;
  currentTierId: LeagueTierId;
}): PromotionZone {
  if (activeCount <= 0 || rank <= 0) {
    return "inactive";
  }

  if (currentTierId === "champion" && rank <= CHAMPION_RECOGNITION_COUNT) {
    return "champion";
  }

  if (currentTierId !== "champion" && rank <= PERSONAL_PROMOTION_COUNT) {
    return "promote";
  }

  if (
    isDemotionEnabled(activeCount, currentTierId) &&
    rank > activeCount - PERSONAL_DEMOTION_COUNT
  ) {
    return "demote";
  }

  return "hold";
}

export function comparePersonalRows(
  a: PersonalLeaderboardCandidate,
  b: PersonalLeaderboardCandidate
) {
  if (b.seasonXp !== a.seasonXp) {
    return b.seasonXp - a.seasonXp;
  }

  const aScore = a.averageScore ?? -1;
  const bScore = b.averageScore ?? -1;
  if (bScore !== aScore) {
    return bScore - aScore;
  }

  const aLastEvent = a.lastEventAt ?? "9999-12-31T23:59:59.999Z";
  const bLastEvent = b.lastEventAt ?? "9999-12-31T23:59:59.999Z";
  if (aLastEvent !== bLastEvent) {
    return aLastEvent.localeCompare(bLastEvent);
  }

  return a.userId.localeCompare(b.userId);
}

export function rankPersonalLeaderboardRows(
  candidates: readonly PersonalLeaderboardCandidate[],
  currentTierId: LeagueTierId
): PersonalLeaderboardRow[] {
  const sorted = [...candidates].sort(comparePersonalRows);
  const activeCount = sorted.length;

  return sorted.map((row, index) => {
    const rank = index + 1;
    return {
      ...row,
      rank,
      rankDelta: row.previousRank ? row.previousRank - rank : 0,
      zone: classifyPersonalZone({ rank, activeCount, currentTierId }),
    };
  });
}

export function classifyOrganizationBand(activeMembers: number): OrganizationBand {
  if (activeMembers <= 10) {
    return "small";
  }

  if (activeMembers <= 30) {
    return "medium";
  }

  return "large";
}

export function compareOrganizationRows(
  a: OrganizationLeaderboardCandidate,
  b: OrganizationLeaderboardCandidate
) {
  if (b.seasonXp !== a.seasonXp) {
    return b.seasonXp - a.seasonXp;
  }

  if (b.contributingMembers !== a.contributingMembers) {
    return b.contributingMembers - a.contributingMembers;
  }

  const aXpPerMember = a.activeMembers > 0 ? a.seasonXp / a.activeMembers : 0;
  const bXpPerMember = b.activeMembers > 0 ? b.seasonXp / b.activeMembers : 0;
  if (bXpPerMember !== aXpPerMember) {
    return bXpPerMember - aXpPerMember;
  }

  const aLastEvent = a.lastEventAt ?? "9999-12-31T23:59:59.999Z";
  const bLastEvent = b.lastEventAt ?? "9999-12-31T23:59:59.999Z";
  if (aLastEvent !== bLastEvent) {
    return aLastEvent.localeCompare(bLastEvent);
  }

  return a.organizationId.localeCompare(b.organizationId);
}

export function rankOrganizationLeaderboardRows(
  candidates: readonly OrganizationLeaderboardCandidate[],
  band: OrganizationBand
): OrganizationLeaderboardRow[] {
  const eligible = candidates
    .filter((row) => row.activeMembers > 0)
    .filter((row) => classifyOrganizationBand(row.activeMembers) === band)
    .sort(compareOrganizationRows);

  return eligible.map((row, index) => {
    const rank = index + 1;

    return {
      ...row,
      rank,
      band,
      rankDelta: row.previousRank ? row.previousRank - rank : 0,
    };
  });
}

export function getSeasonDaysRemaining(now: Date, endsAt: string) {
  const msRemaining = new Date(endsAt).getTime() - now.getTime();
  return Math.max(0, Math.ceil(msRemaining / 86_400_000));
}
