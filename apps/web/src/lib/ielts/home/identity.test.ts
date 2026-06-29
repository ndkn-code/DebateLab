import assert from "node:assert/strict";
import { ieltsHomeFirstName } from "./identity";

assert.equal(
  ieltsHomeFirstName({ displayName: "Jensen Huang", email: "jensen@example.com" }),
  "Jensen",
);
assert.equal(
  ieltsHomeFirstName({ displayName: "  Maya   Kim  ", email: "maya.kim@example.com" }),
  "Maya",
);
assert.equal(
  ieltsHomeFirstName({ displayName: "ndkn.work", email: "ndkn.work@example.com" }),
  null,
);
assert.equal(
  ieltsHomeFirstName({ displayName: "ndkn", email: "ndkn@example.com" }),
  null,
);
assert.equal(
  ieltsHomeFirstName({ displayName: "ndkn.work@example.com", email: "ndkn.work@example.com" }),
  null,
);
assert.equal(ieltsHomeFirstName({ displayName: "", email: "learner@example.com" }), null);
assert.equal(
  ieltsHomeFirstName({ displayName: "Linh", email: "ndkn.work@example.com" }),
  "Linh",
);

console.log("identity.test.ts: all assertions passed");
