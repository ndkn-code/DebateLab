import assert from "node:assert/strict";
import {
  buildPopupSegments,
  createSmartPopupPayload,
  rankSmartPopupCandidates,
  updateCampaignStateForEvent,
} from "@/lib/smart-popups/rules";
import type {
  SmartPopupCampaign,
  SmartPopupImpressionCounts,
  SmartPopupUserTraits,
} from "@/lib/smart-popups/types";

function campaign(
  key: string,
  priority: number,
  rules: SmartPopupCampaign["rules"],
  overrides: Partial<SmartPopupCampaign> = {}
): SmartPopupCampaign {
  return {
    key,
    surface: "dashboard",
    status: "active",
    campaign_type: "feature_nudge",
    delivery_mode: "targeted",
    priority,
    starts_at: null,
    ends_at: null,
    cooldown_hours: 72,
    max_impressions_per_user: 3,
    daily_cap_per_user: 1,
    weekly_cap_per_user: 3,
    reward_credits: 0,
    response_goal: null,
    cta_href: "/practice",
    image_path: `/images/smart-popups/${key}.webp`,
    copy_en: {
      title: key,
      body: key,
      ctaLabel: "Go",
      dismissLabel: "Later",
      dontShowLabel: "Do not show again",
      alt: key,
    },
    copy_vi: {
      title: key,
      body: key,
      ctaLabel: "Go",
      dismissLabel: "Later",
      dontShowLabel: "Do not show again",
      alt: key,
    },
    rules,
    ...overrides,
  };
}

const campaigns = [
  campaign("first-practice", 10, {
    segments: ["first_time_user"],
    maxSessions: 0,
  }),
  campaign("resume-streak", 20, {
    segments: ["returning_user"],
    minSessions: 1,
    minDaysSinceLastPractice: 3,
  }),
  campaign("weakest-skill", 30, {
    segments: ["skill_focus"],
    minSessions: 2,
    requiresWeakestSkill: true,
  }),
  campaign("try-courses", 40, {
    segments: ["course_discovery"],
    minSessions: 1,
    maxCourseProgressCount: 0,
  }),
];

function traits(
  overrides: Partial<Omit<SmartPopupUserTraits, "segments">> = {}
): SmartPopupUserTraits {
  const base = {
    role: "student",
    onboardingCompleted: true,
    smartFeaturePopupsEnabled: true,
    firstDashboardVisit: false,
    totalSessionsCompleted: 0,
    daysSinceSignup: 0,
    daysSinceLastPractice: null,
    currentStreak: 0,
    courseProgressCount: 0,
    coachEventCount: 0,
    weakestSkill: null,
    lastScoredSessionScore: null,
    lastPracticeMinutes: null,
    ...overrides,
  };

  return {
    ...base,
    segments: buildPopupSegments(base),
  };
}

function zeroCounts(): SmartPopupImpressionCounts {
  return {
    userDaily: 0,
    userWeekly: 0,
    campaignDaily: 0,
    campaignWeekly: 0,
  };
}

function run(name: string, fn: () => void) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

run("segments first-time users and ranks first practice first", () => {
  const user = traits({ totalSessionsCompleted: 0 });
  const [candidate] = rankSmartPopupCandidates({
    campaigns,
    traits: user,
    impressionCountsByCampaign: Object.fromEntries(
      campaigns.map((item) => [item.key, zeroCounts()])
    ),
  });

  assert.deepEqual(user.segments, ["first_time_user"]);
  assert.equal(candidate?.key, "first-practice");
});

run("ranks returning user reminder ahead of lower-priority opportunities", () => {
  const user = traits({
    totalSessionsCompleted: 3,
    daysSinceLastPractice: 4,
    weakestSkill: "logic",
    courseProgressCount: 0,
  });
  const [candidate] = rankSmartPopupCandidates({
    campaigns,
    traits: user,
    impressionCountsByCampaign: Object.fromEntries(
      campaigns.map((item) => [item.key, zeroCounts()])
    ),
  });

  assert.deepEqual(user.segments, [
    "returning_user",
    "skill_focus",
    "course_discovery",
    "coach_candidate",
  ]);
  assert.equal(candidate?.key, "resume-streak");
});

run("blocks all campaigns after the daily user cap is reached", () => {
  const user = traits({ totalSessionsCompleted: 0 });
  const ranked = rankSmartPopupCandidates({
    campaigns,
    traits: user,
    impressionCountsByCampaign: Object.fromEntries(
      campaigns.map((item) => [
        item.key,
        { ...zeroCounts(), userDaily: 1, userWeekly: 1 },
      ])
    ),
  });

  assert.equal(ranked.length, 0);
});

run("blocks campaigns during cooldown", () => {
  const user = traits({ totalSessionsCompleted: 0 });
  const ranked = rankSmartPopupCandidates({
    campaigns,
    traits: user,
    campaignState: {
      "first-practice": {
        impressions: 1,
        lastShownAt: "2026-05-10T08:00:00.000Z",
      },
    },
    impressionCountsByCampaign: Object.fromEntries(
      campaigns.map((item) => [item.key, zeroCounts()])
    ),
    now: new Date("2026-05-10T10:00:00.000Z"),
  });

  assert.equal(ranked.some((item) => item.key === "first-practice"), false);
});

run("honors don't-show-again opt-out state", () => {
  const user = traits({ totalSessionsCompleted: 0 });
  const ranked = rankSmartPopupCandidates({
    campaigns,
    traits: user,
    campaignState: {
      "first-practice": {
        hidden: true,
      },
    },
    impressionCountsByCampaign: Object.fromEntries(
      campaigns.map((item) => [item.key, zeroCounts()])
    ),
  });

  assert.equal(ranked.some((item) => item.key === "first-practice"), false);
});

run("preview ranking does not mutate state, commit impression does", () => {
  const initialState = {};
  const user = traits({ totalSessionsCompleted: 0 });
  const [candidate] = rankSmartPopupCandidates({
    campaigns,
    traits: user,
    campaignState: initialState,
    impressionCountsByCampaign: Object.fromEntries(
      campaigns.map((item) => [item.key, zeroCounts()])
    ),
  });

  assert.equal(candidate?.key, "first-practice");
  assert.deepEqual(initialState, {});

  const nextState = updateCampaignStateForEvent({
    campaignState: initialState,
    campaignKey: "first-practice",
    eventType: "impression",
    occurredAt: "2026-05-10T09:00:00.000Z",
  });

  assert.equal(nextState["first-practice"]?.impressions, 1);
  assert.equal(
    nextState["first-practice"]?.lastShownAt,
    "2026-05-10T09:00:00.000Z"
  );
});

run("send-now feedback surveys rank ahead of ordinary nudges", () => {
  const user = traits({ totalSessionsCompleted: 3 });
  const feedbackCampaign = campaign(
    "app-experience-feedback",
    99,
    { maxSubmissionsPerUser: 1 },
    {
      campaign_type: "feedback_survey",
      delivery_mode: "send_now",
      surface: "global",
      reward_credits: 50,
      max_impressions_per_user: 1,
    }
  );
  const [candidate] = rankSmartPopupCandidates({
    campaigns: [...campaigns, feedbackCampaign],
    traits: user,
    surface: "global",
    impressionCountsByCampaign: Object.fromEntries(
      [...campaigns, feedbackCampaign].map((item) => [item.key, zeroCounts()])
    ),
  });

  assert.equal(candidate?.key, "app-experience-feedback");
});

run("feedback surveys do not repeat after one submission by default", () => {
  const user = traits({ totalSessionsCompleted: 3 });
  const feedbackCampaign = campaign(
    "app-experience-feedback",
    10,
    { maxSubmissionsPerUser: 1 },
    {
      campaign_type: "feedback_survey",
      surface: "global",
      reward_credits: 50,
    }
  );
  const ranked = rankSmartPopupCandidates({
    campaigns: [feedbackCampaign],
    traits: user,
    surface: "global",
    campaignState: {
      "app-experience-feedback": {
        submissions: 1,
        submittedAt: "2026-05-15T09:00:00.000Z",
      },
    },
    impressionCountsByCampaign: {
      "app-experience-feedback": zeroCounts(),
    },
  });

  assert.equal(ranked.length, 0);
});

run("formats smart popup facts and new copy templates", () => {
  const user = traits({
    totalSessionsCompleted: 4,
    weakestSkill: "rebuttal",
    lastScoredSessionScore: 63,
    lastPracticeMinutes: 12,
  });
  const popup = createSmartPopupPayload({
    campaign: campaign(
      "weakest-skill",
      30,
      {
        segments: ["skill_focus"],
        minSessions: 2,
        requiresWeakestSkill: true,
      },
      {
        copy_en: {
          eyebrow: "Next best step",
          title: "Drill {skillFocus} for {durationMinutes} minutes.",
          body: "Fastest improvement from your recent rounds.",
          ctaLabel: "Start {skillFocus} drill",
          dismissLabel: "Later",
          dontShowLabel: "Don't show again",
          alt: "Skill nudge",
        },
        metadata: {
          facts: {
            en: [
              { icon: "target", label: "Weakest skill", value: "{skillFocus}" },
              { icon: "chart", label: "Last score", value: "{lastScore}/100" },
            ],
          },
        },
      }
    ),
    traits: user,
    locale: "en",
  });

  assert.equal(popup.title, "Drill rebuttal for 12 minutes.");
  assert.equal(popup.ctaLabel, "Start rebuttal drill");
  assert.deepEqual(popup.facts, [
    { icon: "target", label: "Weakest skill", value: "rebuttal" },
    { icon: "chart", label: "Last score", value: "63/100" },
  ]);
});
