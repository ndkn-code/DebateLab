import assert from "node:assert/strict";
import {
  buildFeedbackPopupAdminHealth,
  createEmptyFeedbackPopupAdminData,
} from "@/lib/smart-popups/admin";

function testHealthyServiceRoleState() {
  const health = buildFeedbackPopupAdminHealth({
    dataSource: "service_role",
    serviceRoleConfigured: true,
    campaignCount: 1,
    surveyVersionCount: 1,
    responseCount: 3,
    cronRunCount: 1,
  });

  assert.equal(health.status, "ok");
  assert.equal(health.serviceRoleConfigured, true);
  assert.equal(health.dataSource, "service_role");
}

function testSessionFallbackWarning() {
  const health = buildFeedbackPopupAdminHealth({
    dataSource: "session",
    serviceRoleConfigured: false,
    campaignCount: 1,
    surveyVersionCount: 1,
  });

  assert.equal(health.status, "warning");
  assert.equal(health.serviceRoleConfigured, false);
  assert.match(health.message, /SUPABASE_SERVICE_ROLE_KEY/);
}

function testEmptyDataPreservesFallbackContext() {
  const data = createEmptyFeedbackPopupAdminData({
    status: "error",
    message: "Data API read failed.",
    dataSource: "session",
    serviceRoleConfigured: true,
  });

  assert.deepEqual(data.campaigns, []);
  assert.deepEqual(data.systemCampaigns, []);
  assert.deepEqual(data.responses, []);
  assert.deepEqual(data.cronRuns, []);
  assert.equal(data.health.status, "error");
  assert.equal(data.health.message, "Data API read failed.");
  assert.equal(data.health.dataSource, "session");
  assert.equal(data.health.serviceRoleConfigured, true);
  assert.equal(
    data.health.checks.find((check) => check.key === "service-role")?.status,
    "ok"
  );
}

testHealthyServiceRoleState();
testSessionFallbackWarning();
testEmptyDataPreservesFallbackContext();

console.log("smart-popup admin health tests passed");
