import assert from "node:assert/strict";
import test from "node:test";
import { startGoogleConnection } from "./transport";

test("unverified existing-calendar requests stop before the cloud or auth boundary", async () => {
  const prior = process.env.CENTER_GOOGLE_EXISTING_CALENDARS_ENABLED;
  try {
    for (const value of [undefined, "false", "TRUE", "1"]) {
      if (value === undefined)
        delete process.env.CENTER_GOOGLE_EXISTING_CALENDARS_ENABLED;
      else process.env.CENTER_GOOGLE_EXISTING_CALENDARS_ENABLED = value;
      await assert.rejects(
        startGoogleConnection("untrusted-client-input", true),
        /awaiting Google verification/,
      );
    }
  } finally {
    if (prior === undefined)
      delete process.env.CENTER_GOOGLE_EXISTING_CALENDARS_ENABLED;
    else process.env.CENTER_GOOGLE_EXISTING_CALENDARS_ENABLED = prior;
  }
});
