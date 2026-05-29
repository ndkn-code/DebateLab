export type LeaderboardDataSource = "mock" | "ledger";

export type LeaderboardDataStatus = "ready" | "empty" | "unavailable";

export type LeaderboardRolloutStage = "off" | "internal" | "clubs" | "public";

export type LeaderboardDisplayMode = "public_name" | "initials_only" | "hidden";

export type LeaderboardKudosKind =
  | "keep_going"
  | "great_round"
  | "strong_improvement";

export type LeaderboardXpEventFlagStatus =
  | "allowed"
  | "flagged_pending_review"
  | "suppressed_from_leaderboards"
  | "resolved_allowed";

export type LeaderboardXpEventFlagType =
  | "duplicate_submission"
  | "low_duration"
  | "duel_integrity"
  | "organization_hopping"
  | "missing_quality_metadata"
  | "manual_review";

export type LeagueTierId =
  | "novice"
  | "constructive"
  | "rebuttal"
  | "whip"
  | "champion";

export type LeagueTierStatus = "completed" | "current" | "locked";

export interface PersonalLeagueTier {
  id: LeagueTierId;
  name: string;
  shortName: string;
  order: number;
  status: LeagueTierStatus;
}

export type PromotionZone = "champion" | "promote" | "hold" | "demote" | "inactive";

export interface LeaderboardSeasonSummary {
  id: string;
  label: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  daysRemaining: number;
}

export interface LeaderboardCohortSummary {
  seasonId: string;
  leagueTier: LeagueTierId;
  cohortIndex: number;
  cohortSize: number;
}

export interface LeaderboardSeasonOutcome {
  seasonId: string;
  finalRank: number;
  finalZone: PromotionZone;
  seasonXp: number;
  fromLeagueTier: LeagueTierId;
  nextLeagueTier: LeagueTierId;
  outcome: "champion" | "promoted" | "held" | "demoted" | "inactive";
  resolvedAt: string;
  replayStartRank?: number;
  replayCohortSize?: number;
}

export interface LeaderboardPrivacySettings {
  userId: string;
  displayMode: LeaderboardDisplayMode;
  allowKudos: boolean;
  showOrganization: boolean;
  participateInLeaderboards: boolean;
  isDefault?: boolean;
  updatedAt: string;
}

export interface LeaderboardKudosTargetState {
  targetUserId: string;
  viewerCanSend: boolean;
  viewerHasSent: boolean;
}

export interface LeaderboardKudosSummary {
  receivedThisSeason: number;
  sentThisSeason: number;
  availableKinds: LeaderboardKudosKind[];
  byUserId: Record<string, LeaderboardKudosTargetState>;
}

export interface LeaderboardScoreExplanationItem {
  id: string;
  category: string;
  label: string;
  seasonXp: number;
  lifetimeXp: number;
  status: "counted" | "capped" | "suppressed" | "ineligible";
  reason: string | null;
  occurredAt: string;
}

export interface LeaderboardSocialTrustSummary {
  privacy: LeaderboardPrivacySettings;
  kudos: LeaderboardKudosSummary;
  scoreExplanation: LeaderboardScoreExplanationItem[];
}

export interface LeaderboardXpEventFlag {
  id: string;
  xpEventId: string;
  seasonId: string;
  userId: string;
  displayName?: string;
  flagType: LeaderboardXpEventFlagType;
  severity: "low" | "medium" | "high";
  status: LeaderboardXpEventFlagStatus;
  reason: string | null;
  source: "system" | "admin" | "coach";
  createdAt: string;
  resolvedAt: string | null;
}

export interface LeaderboardAuditEvent {
  id: string;
  eventType: string;
  actorUserId: string | null;
  targetUserId: string | null;
  clubId: string | null;
  xpEventId: string | null;
  flagId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface LeaderboardGuardrailMetric {
  key: string;
  label: string;
  value: number;
  threshold: number | null;
  status: "ok" | "watch" | "stop";
}

export interface LeaderboardSafetyAuditData {
  flags: LeaderboardXpEventFlag[];
  audit: LeaderboardAuditEvent[];
  guardrails: LeaderboardGuardrailMetric[];
  loadError: string | null;
}

export interface PersonalLeaderboardRow {
  userId: string;
  rank: number;
  displayName: string;
  avatarUrl: string | null;
  initials: string;
  title: string | null;
  seasonXp: number;
  averageScore: number | null;
  previousRank: number | null;
  rankDelta: number;
  lastEventAt: string | null;
  zone: PromotionZone;
  isCurrentUser: boolean;
}

export type PersonalLeaderboardCandidate = Omit<
  PersonalLeaderboardRow,
  "rank" | "zone" | "rankDelta"
> &
  Partial<Pick<PersonalLeaderboardRow, "rank" | "zone" | "rankDelta">>;

export type OrganizationType = "club" | "class";

export type OrganizationBand = "small" | "medium" | "large";

export interface OrganizationLeaderboardRow {
  organizationId: string;
  organizationType: OrganizationType;
  rank: number;
  name: string;
  subtitle: string;
  seasonXp: number;
  activeMembers: number;
  contributingMembers: number;
  previousRank: number | null;
  rankDelta: number;
  lastEventAt: string | null;
  band: OrganizationBand;
  isCurrentOrganization: boolean;
  logoUrl?: string | null;
}

export type OrganizationLeaderboardCandidate = Omit<
  OrganizationLeaderboardRow,
  "rank" | "band" | "rankDelta"
> &
  Partial<Pick<OrganizationLeaderboardRow, "rank" | "band" | "rankDelta">>;

export interface PersonalLeaderboardData {
  league: PersonalLeagueTier;
  tiers: PersonalLeagueTier[];
  cohort?: LeaderboardCohortSummary;
  cohortSize: number;
  activeCount: number;
  promotionCount: number;
  demotionCount: number;
  demotionEnabled: boolean;
  championCount: number;
  outcome?: LeaderboardSeasonOutcome | null;
  rows: PersonalLeaderboardRow[];
  currentUser: PersonalLeaderboardRow | null;
}

export interface OrganizationLeaderboardData {
  bands: OrganizationBand[];
  affiliation?: OrganizationAffiliationSummary | null;
  rows: OrganizationLeaderboardRow[];
  currentOrganization: OrganizationLeaderboardRow | null;
}

export type OrganizationJoinCodeStatus =
  | "pending"
  | "redeemed"
  | "revoked"
  | "expired";

export interface OrganizationAffiliationSummary {
  organizationId: string;
  organizationType: "club";
  name: string;
  subtitle: string;
  logoUrl: string | null;
  role: "student" | "coach" | "owner";
  joinedAt: string;
  verificationMethod: "join_code" | "invitation" | "admin" | string;
}

export interface LeaderboardPageData {
  source: LeaderboardDataSource;
  status: LeaderboardDataStatus;
  reason: string | null;
  season: LeaderboardSeasonSummary;
  personal: PersonalLeaderboardData;
  organizations: OrganizationLeaderboardData;
  socialTrust?: LeaderboardSocialTrustSummary;
}
