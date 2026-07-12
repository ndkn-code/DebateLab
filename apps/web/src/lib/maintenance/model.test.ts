import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_MAINTENANCE_STATE,
  evaluateMaintenanceGate,
  isMaintenanceBypassPath,
  maintenanceUpdateSchema,
  requestLocale,
} from "./model";

test("full mode requires a future expected completion time", () => {
  const base = {
    bannerMessage: DEFAULT_MAINTENANCE_STATE.bannerMessage,
    fullMessage: DEFAULT_MAINTENANCE_STATE.fullMessage,
  };
  assert.equal(
    maintenanceUpdateSchema.safeParse({ ...base, mode: "full", expectedDoneAt: null }).success,
    false,
  );
  assert.equal(
    maintenanceUpdateSchema.safeParse({
      ...base,
      mode: "full",
      expectedDoneAt: new Date(Date.now() + 60_000).toISOString(),
    }).success,
    true,
  );
});

test("the bypass allowlist is locale-aware", () => {
  assert.equal(isMaintenanceBypassPath("/vi/maintenance"), true);
  assert.equal(isMaintenanceBypassPath("/en/dashboard/admin/maintenance"), true);
  assert.equal(isMaintenanceBypassPath("/en/auth/login"), true);
  assert.equal(isMaintenanceBypassPath("/api/public/maintenance"), true);
  assert.equal(isMaintenanceBypassPath("/en/dashboard"), false);
  assert.equal(requestLocale("/vi/dashboard"), "vi");
  assert.equal(requestLocale("/api/health", "en", "vi-VN"), "en");
});

test("a production flag-read failure fails open", async () => {
  assert.equal(process.env.NODE_ENV, "production");
  const result = await evaluateMaintenanceGate({
    environment: process.env.NODE_ENV,
    bypass: false,
    readState: async () => {
      throw new Error("simulated flag API outage");
    },
  });
  assert.equal(result, null);
});

test("production full mode blocks, while non-production never does", async () => {
  const fullState = {
    ...DEFAULT_MAINTENANCE_STATE,
    mode: "full" as const,
    expectedDoneAt: new Date(Date.now() + 60_000).toISOString(),
  };
  assert.equal(
    await evaluateMaintenanceGate({ environment: "production", bypass: false, readState: async () => fullState }),
    fullState,
  );
  assert.equal(
    await evaluateMaintenanceGate({ environment: "development", bypass: false, readState: async () => fullState }),
    null,
  );
});
