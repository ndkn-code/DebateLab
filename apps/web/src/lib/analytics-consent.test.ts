import assert from "node:assert/strict";

import {
  captureWithAnalyticsConsent,
  isAnalyticsEnabled,
  readAnalyticsConsentFromCookieHeader,
  syncAnalyticsConsent,
} from "./analytics-consent";

assert.equal(readAnalyticsConsentFromCookieHeader(""), null);
assert.equal(
  readAnalyticsConsentFromCookieHeader(
    "theme=dark; debatelab_analytics_consent=granted; locale=en"
  ),
  "granted"
);
assert.equal(
  readAnalyticsConsentFromCookieHeader(
    "debatelab_analytics_consent=denied; session=private"
  ),
  "denied"
);
assert.equal(
  readAnalyticsConsentFromCookieHeader(
    "other_debatelab_analytics_consent=granted; debatelab_analytics_consent=invalid"
  ),
  null
);
assert.equal(isAnalyticsEnabled("granted"), true);
assert.equal(isAnalyticsEnabled("denied"), false);
assert.equal(isAnalyticsEnabled(null), false);

let initialized = 0;
let paused = 0;
let cleared = 0;
assert.equal(
  syncAnalyticsConsent(
    false,
    () => {
      initialized += 1;
    },
    () => {
      paused += 1;
      cleared += 1;
    }
  ),
  false
);
assert.equal(initialized, 0, "Faro must not initialize without consent");
assert.equal(paused, 1, "Faro must pause and clear when consent is denied");
assert.equal(cleared, 1, "denial clears the active Faro user context");

const granted = isAnalyticsEnabled(
  readAnalyticsConsentFromCookieHeader("debatelab_analytics_consent=granted")
);
assert.equal(
  syncAnalyticsConsent(
    granted,
    () => {
      initialized += 1;
    },
    () => {
      paused += 1;
    }
  ),
  true
);
assert.equal(initialized, 1, "Faro initializes after consent is granted");

let capturedErrors = 0;
captureWithAnalyticsConsent(true, () => {
  capturedErrors += 1;
});
captureWithAnalyticsConsent(false, () => {
  capturedErrors += 1;
});
assert.equal(capturedErrors, 1, "ordinary errors capture once enabled");

console.log("analytics consent tests passed");
