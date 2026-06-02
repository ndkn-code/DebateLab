import assert from "node:assert/strict";

import {
  canViewProfileSection,
  coerceProfileConnectionCenterData,
  coerceProfileDiscoveryResult,
  coercePublicProfileData,
  getAllowedProfileConnectionTransition,
  isPublicProfileData,
  normalizeProfileFriendCode,
  isValidProfileHandle,
  normalizeProfileHandle,
  normalizeProfileReportReason,
  normalizeProfileVisibility,
} from "@/lib/profile-social/model";
import {
  coerceProfileAchievementsData,
  coerceProfileActivityFeedData,
  coerceProfileAnalyticsTabData,
  getAchievementProgressPercent,
  normalizeFeaturedAchievementIds,
} from "@/lib/profile-social/tab-model";

assert.equal(normalizeProfileHandle(" @Maya.Tran_09 "), "maya.tran_09");
assert.equal(normalizeProfileHandle("Ma"), null);
assert.equal(normalizeProfileHandle("maya-tran"), null);
assert.equal(normalizeProfileHandle("maya tran"), null);
assert.equal(isValidProfileHandle("maya.tran_09"), true);
assert.equal(isValidProfileHandle("Maya.Tran_09"), false);
assert.equal(normalizeProfileFriendCode("dbt-7k2m-q8r4"), "DBT-7K2M-Q8R4");
assert.equal(normalizeProfileFriendCode("DBT 7K2M Q8R4"), "DBT-7K2M-Q8R4");
assert.equal(normalizeProfileFriendCode("7K2M-Q8R4"), null);

assert.equal(normalizeProfileVisibility("trusted"), "connections");
assert.equal(normalizeProfileVisibility("nope", "connections"), "connections");
assert.equal(normalizeProfileReportReason("privacy"), "privacy");
assert.equal(normalizeProfileReportReason("weird"), "other");

assert.equal(
  canViewProfileSection({
    visibility: "private",
    isSelf: true,
  }),
  true
);
assert.equal(
  canViewProfileSection({
    visibility: "public",
    isBlocked: true,
  }),
  false
);
assert.equal(
  canViewProfileSection({
    visibility: "connections",
    isConnection: true,
  }),
  true
);
assert.equal(
  canViewProfileSection({
    visibility: "connections",
    isConnection: false,
  }),
  false
);
assert.equal(
  canViewProfileSection({
    visibility: "connections",
    isConnection: true,
  }),
  true
);

assert.equal(
  getAllowedProfileConnectionTransition({
    currentStatus: "pending",
    action: "accept",
    actorUserId: "recipient",
    requesterUserId: "requester",
    recipientUserId: "recipient",
  }),
  "accepted"
);
assert.equal(
  getAllowedProfileConnectionTransition({
    currentStatus: "pending",
    action: "accept",
    actorUserId: "requester",
    requesterUserId: "requester",
    recipientUserId: "recipient",
  }),
  null
);
assert.equal(
  getAllowedProfileConnectionTransition({
    currentStatus: "pending",
    action: "cancel",
    actorUserId: "requester",
    requesterUserId: "requester",
    recipientUserId: "recipient",
  }),
  "cancelled"
);
assert.equal(
  getAllowedProfileConnectionTransition({
    currentStatus: "accepted",
    action: "remove",
    actorUserId: "recipient",
    requesterUserId: "requester",
    recipientUserId: "recipient",
  }),
  "removed"
);
assert.equal(
  getAllowedProfileConnectionTransition({
    currentStatus: "declined",
    action: "remove",
    actorUserId: "recipient",
    requesterUserId: "requester",
    recipientUserId: "recipient",
  }),
  null
);

const visiblePayload = {
  state: "visible",
  visibleSections: {
    analytics: true,
    activities: true,
    achievements: true,
    organization: true,
  },
  connection: {
    status: "accepted",
    viewerCanRequest: false,
  },
  profile: {
    userId: "target",
    handle: "maya.tran",
    displayName: "Maya Tran",
    avatarUrl: null,
    selectedTitle: "Constructive Climber",
    profileStatus: "prepping case notes",
    level: 4,
    lifetimeXp: 1200,
    season: {
      language: "en",
      seasonXp: 400,
      rank: 3,
      leagueTier: "constructive",
      cohortIndex: 0,
    },
    organization: null,
    friendCounts: {
      friends: 9,
    },
    featuredAchievements: [],
  },
};

assert.equal(isPublicProfileData(visiblePayload), true);
assert.deepEqual(coercePublicProfileData({ wat: true }), {
  state: "not_found",
  connection: null,
  profile: null,
});

assert.deepEqual(
  normalizeFeaturedAchievementIds([" a ", "b", "a", "", "c", "d", "e"]),
  ["a", "b", "c", "d"]
);
assert.equal(
  getAchievementProgressPercent({
    progressValue: 3,
    progressTarget: 5,
  }),
  60
);
assert.equal(
  getAchievementProgressPercent({
    progressValue: 0,
    progressTarget: 5,
    unlocked: true,
  }),
  100
);

assert.deepEqual(coerceProfileAnalyticsTabData({ state: "visible" }), {
  state: "visible",
  viewerMode: "public",
  range: "30d",
  practiceLanguage: "en",
  totalPracticeMinutes: 0,
  totalSessions: 0,
  averageScore: null,
  speakingCount: 0,
  debateCount: 0,
  level: null,
  lifetimeXp: null,
});

assert.equal(
  coerceProfileActivityFeedData({
    state: "visible",
    viewerMode: "self",
    items: [
      {
        id: "practice-1",
        kind: "practice",
        title: "Practice",
        createdAt: "2026-05-31T00:00:00.000Z",
        xpEarned: 10,
        score: 88,
        durationMinutes: 12,
        href: "/history/practice-1",
      },
    ],
  }).items[0]?.kind,
  "practice"
);

const achievementData = coerceProfileAchievementsData({
  state: "visible",
  viewerMode: "self",
  categories: ["debate"],
  unlockedCount: 1,
  totalCount: 2,
  maxFeatured: 4,
  achievements: [
    {
      id: "a1",
      slug: "first_debate",
      title: "First Debate",
      category: "debate",
      unlocked: true,
      isFeatured: true,
    },
  ],
});

assert.equal(achievementData.featured[0]?.id, "a1");
assert.equal(achievementData.achievements[0]?.progressPercent, null);

const discovery = coerceProfileDiscoveryResult({
  status: "found",
  queryKind: "friend_code",
  result: {
    state: "visible",
    connection: {
      status: "none",
      viewerCanRequest: true,
    },
    profile: {
      userId: "target",
      handle: "maya.tran",
      displayName: "Maya Tran",
      avatarUrl: null,
      selectedTitle: null,
      profileStatus: null,
      organization: null,
      friendCounts: { friends: 2 },
      isPrivate: false,
    },
  },
});
assert.equal(discovery.result?.connection.viewerCanRequest, true);
assert.equal(discovery.result?.profile.handle, "maya.tran");

const center = coerceProfileConnectionCenterData({
  status: "ok",
  friendCode: {
    code: "DBT-7K2M-Q8R4",
    discoveryEnabled: false,
  },
  incoming: [discovery.result],
});
assert.equal(center.friendCode.discoveryEnabled, false);
assert.equal(center.incoming.length, 1);
