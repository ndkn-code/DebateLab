import assert from "node:assert/strict";

import {
  computeEffectiveStreakState,
  dateKeyInTimezone,
  isQualifyingStreakActivity,
  normalizeStreakTimezone,
} from "./model";

const profile = {
  streak_current: 2,
  streak_last_active_date: "2026-05-26",
};

{
  const state = computeEffectiveStreakState({
    profile,
    activities: [
      {
        activity_type: "debate_completed",
        reference_type: "debate_session",
        created_at: "2026-06-13T10:00:00.000Z",
      },
      {
        activity_type: "duel_completed",
        reference_type: "debate_duel",
        created_at: "2026-06-12T10:00:00.000Z",
      },
    ],
    timezone: "UTC",
    now: new Date("2026-06-13T18:00:00.000Z"),
  });

  assert.equal(state.current, 2);
  assert.equal(state.activeToday, true);
  assert.equal(state.atRiskToday, false);
}

{
  const state = computeEffectiveStreakState({
    profile,
    activities: [
      {
        activity_type: "debate_completed",
        reference_type: "debate_session",
        created_at: "2026-06-12T10:00:00.000Z",
      },
    ],
    timezone: "UTC",
    now: new Date("2026-06-13T18:00:00.000Z"),
  });

  assert.equal(state.current, 1);
  assert.equal(state.activeToday, false);
  assert.equal(state.atRiskToday, true);
}

{
  const state = computeEffectiveStreakState({
    profile,
    activities: [
      {
        activity_type: "debate_completed",
        reference_type: "debate_session",
        created_at: "2026-05-26T20:31:36.000Z",
      },
    ],
    timezone: "UTC",
    now: new Date("2026-06-13T18:00:00.000Z"),
  });

  assert.equal(state.current, 0);
  assert.equal(state.lastActiveDate, "2026-05-26");
}

{
  const state = computeEffectiveStreakState({
    profile: {
      streak_current: 9,
      streak_last_active_date: "2026-06-14",
    },
    activities: undefined,
    timezone: "UTC",
    now: new Date("2026-06-13T18:00:00.000Z"),
  });

  assert.equal(state.current, 9);
}

{
  const timestamp = "2026-05-15T17:05:00.000Z";
  assert.equal(dateKeyInTimezone(timestamp, "UTC"), "2026-05-15");
  assert.equal(dateKeyInTimezone(timestamp, "Asia/Ho_Chi_Minh"), "2026-05-16");
}

{
  assert.equal(normalizeStreakTimezone("Not/A_Zone"), "Asia/Ho_Chi_Minh");
  assert.equal(normalizeStreakTimezone("America/New_York"), "America/New_York");
}

{
  assert.equal(
    isQualifyingStreakActivity({
      activity_type: "anything",
      reference_type: "debate_duel",
      created_at: "2026-06-13T00:00:00.000Z",
    }),
    true
  );
  assert.equal(
    isQualifyingStreakActivity({
      activity_type: "page_view",
      reference_type: "analytics_event",
      created_at: "2026-06-13T00:00:00.000Z",
    }),
    false
  );
}

console.info("streak model tests passed");
