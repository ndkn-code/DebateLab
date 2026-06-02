import assert from "node:assert/strict";
import {
  buildSavedSettingsDraft,
  buildSettingsDraft,
  type SettingsProfilePrivacy,
} from "@/lib/settings";

const privacy = {
  profile_visibility: "public",
  analytics_visibility: "connections",
  activities_visibility: "private",
  achievements_visibility: "trusted",
  organization_visibility: "connections",
  allow_connection_requests: false,
  searchable_by_handle: false,
  friend_code_discovery_enabled: false,
} as unknown as SettingsProfilePrivacy;

const draft = buildSettingsDraft({
  displayName: "Dev Admin",
  handle: "dev.admin",
  profileStatus: "Reviewing arguments",
  avatarUrl: null,
  profilePrivacy: privacy,
  preferences: {},
  currentLocale: "en",
});

assert.equal(draft.profileVisibility, "public");
assert.equal(draft.analyticsVisibility, "connections");
assert.equal(draft.activitiesVisibility, "private");
assert.equal(draft.achievementsVisibility, "connections");
assert.equal(draft.organizationVisibility, "connections");
assert.equal(draft.allowConnectionRequests, false);
assert.equal(draft.searchableByHandle, false);
assert.equal(draft.friendCodeDiscoveryEnabled, true);
assert.equal(draft.analyticsCookiesEnabled, true);

const savedDraft = buildSavedSettingsDraft({
  profilePrivacy: null,
  preferences: {},
  currentLocale: "en",
});

assert.equal(savedDraft.profileVisibility, "connections");
assert.equal(savedDraft.analyticsVisibility, "private");
assert.equal(savedDraft.activitiesVisibility, "connections");
assert.equal(savedDraft.achievementsVisibility, "connections");
assert.equal(savedDraft.organizationVisibility, "connections");
assert.equal(savedDraft.friendCodeDiscoveryEnabled, true);
assert.equal(savedDraft.analyticsCookiesEnabled, true);

console.log("Settings model tests passed");
