import assert from "node:assert/strict";

import {
  classifyOrganizationBand,
  classifyPersonalZone,
  comparePersonalRows,
  rankOrganizationLeaderboardRows,
  rankPersonalLeaderboardRows,
} from "@/lib/leaderboards/model";
import {
  getLeaderboardPageData,
  isMissingLeaderboardLedgerError,
  type LeaderboardSupabaseLikeClient,
} from "@/lib/leaderboards/data";
import { makeMockLeaderboardPageData } from "@/lib/leaderboards/fixtures";
import {
  getSeasonReplayCopy,
  getSeasonReplayDismissalKey,
  getSeasonReplayStoryboard,
  isReplayableSeasonOutcome,
} from "@/lib/leaderboards/replay";
import {
  applyLeaderboardPrivacyDisplay,
  canSendLeaderboardKudos,
  getDefaultLeaderboardPrivacySettings,
  getLeaderboardRolloutGuardrailStatus,
  getLeaderboardXpEventFlagStatus,
  sanitizeLeaderboardAnalyticsMetadata,
  summarizeLeaderboardScoreExplanation,
} from "@/lib/leaderboards/social-trust";

assert.equal(
  classifyPersonalZone({ rank: 1, activeCount: 30, currentTierId: "rebuttal" }),
  "promote"
);
assert.equal(
  classifyPersonalZone({ rank: 27, activeCount: 30, currentTierId: "rebuttal" }),
  "demote"
);
assert.equal(
  classifyPersonalZone({ rank: 29, activeCount: 30, currentTierId: "novice" }),
  "hold"
);
assert.equal(
  classifyPersonalZone({ rank: 10, activeCount: 10, currentTierId: "rebuttal" }),
  "hold"
);
assert.equal(
  classifyPersonalZone({ rank: 2, activeCount: 30, currentTierId: "champion" }),
  "champion"
);

const tieBreakerRows = rankPersonalLeaderboardRows(
  [
    {
      userId: "slow",
      displayName: "Slow",
      initials: "S",
      avatarUrl: null,
      title: null,
      seasonXp: 100,
      averageScore: 80,
      previousRank: null,
      lastEventAt: "2026-05-29T12:00:00.000Z",
      isCurrentUser: false,
    },
    {
      userId: "quality",
      displayName: "Quality",
      initials: "Q",
      avatarUrl: null,
      title: null,
      seasonXp: 100,
      averageScore: 91,
      previousRank: null,
      lastEventAt: "2026-05-29T13:00:00.000Z",
      isCurrentUser: false,
    },
  ],
  "constructive"
);
assert.equal(tieBreakerRows[0]?.userId, "quality");
assert.ok(comparePersonalRows(tieBreakerRows[0], tieBreakerRows[1]) < 0);

assert.equal(classifyOrganizationBand(1), "small");
assert.equal(classifyOrganizationBand(10), "small");
assert.equal(classifyOrganizationBand(11), "medium");
assert.equal(classifyOrganizationBand(30), "medium");
assert.equal(classifyOrganizationBand(31), "large");

assert.equal(
  getDefaultLeaderboardPrivacySettings({ userId: "student", isStudent: true })
    .displayMode,
  "initials_only"
);
assert.deepEqual(
  canSendLeaderboardKudos({
    viewerUserId: "viewer",
    targetUserId: "target",
    targetAllowsKudos: true,
    viewerHasSent: false,
    socialSignalsEnabled: true,
  }),
  {
    targetUserId: "target",
    viewerCanSend: true,
    viewerHasSent: false,
  }
);
assert.equal(
  canSendLeaderboardKudos({
    viewerUserId: "viewer",
    targetUserId: "viewer",
    targetAllowsKudos: true,
    viewerHasSent: false,
    socialSignalsEnabled: true,
  }).viewerCanSend,
  false
);
assert.deepEqual(
  applyLeaderboardPrivacyDisplay({
    displayName: "Maya Tran",
    initials: "MT",
    rank: 7,
    isViewer: false,
    privacy: {
      displayMode: "initials_only",
    },
  }),
  {
    displayName: "Debater #7",
    initials: "MT",
    avatarVisible: false,
    titleVisible: true,
  }
);
assert.equal(
  getLeaderboardXpEventFlagStatus({
    durationSeconds: 12,
    hasQualityMetadata: true,
  }).status,
  "suppressed_from_leaderboards"
);
assert.equal(
  getLeaderboardXpEventFlagStatus({
    sourceType: "duel",
    duelIntegrityScore: 0.3,
  }).flagType,
  "duel_integrity"
);
assert.deepEqual(
  sanitizeLeaderboardAnalyticsMetadata({
    route: "/leaderboards",
    email: "student@example.com",
    nested: { joinCode: "ABCD-1234" },
  }),
  {
    route: "/leaderboards",
    email: "[redacted]",
    nested: { joinCode: "[redacted]" },
  }
);
assert.deepEqual(
  summarizeLeaderboardScoreExplanation([
    {
      id: "counted",
      category: "practice",
      label: "Practice",
      seasonXp: 40,
      lifetimeXp: 40,
      status: "counted",
      reason: null,
      occurredAt: "2026-05-29T00:00:00.000Z",
    },
    {
      id: "suppressed",
      category: "practice",
      label: "Practice",
      seasonXp: 20,
      lifetimeXp: 20,
      status: "suppressed",
      reason: "Low effort",
      occurredAt: "2026-05-29T01:00:00.000Z",
    },
  ]),
  {
    visibleXp: 40,
    suppressedXp: 20,
    visibleEvents: 1,
    suppressedEvents: 1,
  }
);
assert.equal(
  getLeaderboardRolloutGuardrailStatus({
    suppressionRate: 0.13,
    optOutRate: 0.02,
    orgJoinAbuseRate: 0.01,
    churnRate: 0.05,
  })[0]?.status,
  "stop"
);

const smallOrgRows = rankOrganizationLeaderboardRows(
  [
    {
      organizationId: "large",
      organizationType: "club",
      name: "Large",
      subtitle: "Club",
      seasonXp: 10000,
      activeMembers: 31,
      contributingMembers: 24,
      previousRank: null,
      lastEventAt: "2026-05-29T12:00:00.000Z",
      isCurrentOrganization: false,
    },
    {
      organizationId: "small-active",
      organizationType: "class",
      name: "Small Active",
      subtitle: "Class",
      seasonXp: 900,
      activeMembers: 6,
      contributingMembers: 6,
      previousRank: 3,
      lastEventAt: "2026-05-29T11:00:00.000Z",
      isCurrentOrganization: true,
    },
    {
      organizationId: "inactive",
      organizationType: "club",
      name: "Inactive",
      subtitle: "Club",
      seasonXp: 99999,
      activeMembers: 0,
      contributingMembers: 0,
      previousRank: null,
      lastEventAt: null,
      isCurrentOrganization: false,
    },
  ],
  "small"
);
assert.equal(smallOrgRows.length, 1);
assert.equal(smallOrgRows[0]?.organizationId, "small-active");

assert.equal(
  isMissingLeaderboardLedgerError({
    code: "42P01",
    message: 'relation "public.xp_seasons" does not exist',
  }),
  true
);

const missingLedgerClient: LeaderboardSupabaseLikeClient = {
  from: () => ({
    select: () => ({
      limit: async () => ({
        data: null,
        error: {
          code: "42P01",
          message: 'relation "public.xp_seasons" does not exist',
        },
      }),
    }),
  }),
};

const reachableLedgerClient: LeaderboardSupabaseLikeClient = {
  from: () => ({
    select: () => ({
      limit: async () => ({
        data: [],
        error: null,
      }),
    }),
  }),
  rpc: async () => ({
    data: {
      ...makeMockLeaderboardPageData({ viewerUserId: "viewer" }),
      source: "ledger",
    },
    error: null,
  }),
};

async function main() {
  const missingLedgerData = await getLeaderboardPageData("viewer", {
    dataSource: "ledger",
    supabaseClient: missingLedgerClient,
  });
  assert.equal(missingLedgerData.status, "unavailable");
  assert.match(missingLedgerData.reason ?? "", /xp_seasons/);

  const mockData = await getLeaderboardPageData("viewer", {
    dataSource: "mock",
    fixtureState: "outside",
  });
  assert.equal(mockData.status, "ready");
  assert.equal(mockData.personal.currentUser?.rank, 24);
  assert.equal(mockData.organizations.rows.every((row) => row.organizationType === "club"), true);

  const promotionData = makeMockLeaderboardPageData({
    viewerUserId: "viewer",
    state: "promotion",
  });
  assert.equal(promotionData.personal.outcome?.outcome, "promoted");
  assert.equal(promotionData.personal.outcome?.fromLeagueTier, "novice");
  assert.equal(promotionData.personal.outcome?.nextLeagueTier, "constructive");
  assert.equal(isReplayableSeasonOutcome(promotionData.personal.outcome), true);
  const promotionReplay = getSeasonReplayStoryboard(promotionData.personal.outcome!);
  const promotionViewer = promotionReplay.rows.find((row) => row.isViewer);
  assert.ok(promotionViewer);
  assert.equal(promotionReplay.movement, "up");
  assert.equal(promotionViewer.finalRank, 5);
  assert.equal(promotionViewer.finalRank <= promotionReplay.promotionCutoff, true);
  assert.equal(
    getSeasonReplayCopy(promotionData.personal.outcome!, "vi").title,
    "Thăng hạng"
  );
  assert.match(
    getSeasonReplayCopy(promotionData.personal.outcome!).transition,
    /finished #5 in Novice League and advanced to Constructive League/
  );
  assert.match(
    getSeasonReplayCopy(promotionData.personal.outcome!).summary,
    /starts fresh at 0 XP/
  );

  const largePromotionData = makeMockLeaderboardPageData({
    viewerUserId: "viewer",
    state: "promotion-100",
  });
  assert.equal(largePromotionData.personal.activeCount, 100);
  assert.equal(largePromotionData.personal.cohortSize, 100);
  const largePromotionReplay = getSeasonReplayStoryboard(
    largePromotionData.personal.outcome!
  );
  const largePromotionViewer = largePromotionReplay.rows.find((row) => row.isViewer);
  assert.ok(largePromotionViewer);
  assert.equal(largePromotionReplay.cohortSize, 100);
  assert.equal(largePromotionViewer.startRank, 95);
  assert.equal(largePromotionViewer.finalRank, 5);

  const demotionData = makeMockLeaderboardPageData({
    viewerUserId: "viewer",
    state: "demotion",
  });
  assert.equal(demotionData.personal.outcome?.outcome, "demoted");
  assert.equal(demotionData.personal.outcome?.fromLeagueTier, "rebuttal");
  assert.equal(demotionData.personal.outcome?.nextLeagueTier, "constructive");
  const demotionReplay = getSeasonReplayStoryboard(demotionData.personal.outcome!);
  const demotionViewer = demotionReplay.rows.find((row) => row.isViewer);
  assert.ok(demotionViewer);
  assert.equal(demotionReplay.movement, "down");
  assert.equal(demotionViewer.startRank, 10);
  assert.equal(demotionViewer.finalRank, 27);
  assert.equal(demotionViewer.zone, "demote");
  assert.equal(getSeasonReplayCopy(demotionData.personal.outcome!).title, "Demoted");
  assert.match(
    getSeasonReplayCopy(demotionData.personal.outcome!).transition,
    /finished #27 in Rebuttal League and dropped to Constructive League/
  );
  assert.match(
    getSeasonReplayCopy(demotionData.personal.outcome!).summary,
    /starts fresh at 0 XP/
  );

  const largeDemotionData = makeMockLeaderboardPageData({
    viewerUserId: "viewer",
    state: "demotion-100",
  });
  assert.equal(largeDemotionData.personal.activeCount, 100);
  assert.equal(largeDemotionData.personal.outcome?.outcome, "demoted");
  const largeDemotionReplay = getSeasonReplayStoryboard(
    largeDemotionData.personal.outcome!
  );
  const largeDemotionViewer = largeDemotionReplay.rows.find((row) => row.isViewer);
  assert.ok(largeDemotionViewer);
  assert.equal(largeDemotionReplay.movement, "down");
  assert.equal(largeDemotionReplay.demotionCutoff, 96);
  assert.equal(largeDemotionViewer.startRank, 5);
  assert.equal(largeDemotionViewer.finalRank, 97);
  assert.equal(largeDemotionViewer.zone, "demote");

  const championData = makeMockLeaderboardPageData({
    viewerUserId: "viewer",
    state: "champion",
  });
  assert.equal(championData.personal.outcome?.outcome, "champion");
  assert.equal(championData.personal.outcome?.fromLeagueTier, "champion");
  assert.equal(championData.personal.outcome?.nextLeagueTier, "champion");

  const heldData = makeMockLeaderboardPageData({
    viewerUserId: "viewer",
    state: "held",
  });
  assert.equal(heldData.personal.outcome?.outcome, "held");
  assert.equal(heldData.personal.outcome?.fromLeagueTier, "rebuttal");
  assert.equal(heldData.personal.outcome?.nextLeagueTier, "rebuttal");
  assert.equal(
    getSeasonReplayCopy(heldData.personal.outcome!).title,
    "League held"
  );
  assert.match(
    getSeasonReplayDismissalKey("viewer", heldData.personal.outcome!),
    /^leaderboard-season-replay:viewer:weekly:2026-05-18:/
  );

  const heldDownData = makeMockLeaderboardPageData({
    viewerUserId: "viewer",
    state: "held-down",
  });
  assert.equal(heldDownData.personal.outcome?.outcome, "held");
  const heldDownReplay = getSeasonReplayStoryboard(heldDownData.personal.outcome!);
  const heldDownViewer = heldDownReplay.rows.find((row) => row.isViewer);
  assert.ok(heldDownViewer);
  assert.equal(heldDownReplay.movement, "down");
  assert.equal(heldDownViewer.startRank, 8);
  assert.equal(heldDownViewer.finalRank, 18);
  assert.equal(heldDownViewer.zone, "hold");
  assert.match(
    getSeasonReplayCopy(heldDownData.personal.outcome!).transition,
    /moved down to #18 but stayed/
  );

  const ledgerData = await getLeaderboardPageData("viewer", {
    dataSource: "ledger",
    supabaseClient: reachableLedgerClient,
  });
  assert.equal(ledgerData.source, "ledger");
  assert.equal(ledgerData.status, "ready");

  console.log("leaderboard model tests passed");
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
