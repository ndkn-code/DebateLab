import assert from "node:assert/strict";

import {
  NOTIFICATION_TOPICS,
  buildDefaultNotificationPreferences,
} from "./contracts";
import { getNotificationCopy } from "./copy";

const preferences = buildDefaultNotificationPreferences("Asia/Ho_Chi_Minh");

assert.equal(preferences.length, NOTIFICATION_TOPICS.length);
assert.equal(
  preferences.find((item) => item.topic === "account_security")?.messageClass,
  "essential",
);
assert.deepEqual(
  preferences.find((item) => item.topic === "account_security")?.channels,
  { in_app: true, email: true },
);
assert.ok(
  preferences
    .filter((item) => item.messageClass === "optional")
    .every((item) => item.emailDeliveryMode === "off"),
);
assert.equal(getNotificationCopy("en").inbox.filters.unread, "Unread");
assert.equal(getNotificationCopy("vi").inbox.filters.unread, "Chưa đọc");

console.log("notification UI contract tests passed");
