import assert from "node:assert/strict";

import {
  isAnalyticsEnabled,
  readAnalyticsConsentFromCookieHeader,
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

console.log("analytics consent tests passed");
