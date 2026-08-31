import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(
  resolve(process.cwd(), "src/components/dashboard/dashboard-sidebar-rail.tsx"),
  "utf8",
);
const en = JSON.parse(
  readFileSync(resolve(process.cwd(), "src/i18n/messages/en.json"), "utf8"),
) as { dashboard: { nav: Record<string, string> } };
const vi = JSON.parse(
  readFileSync(resolve(process.cwd(), "src/i18n/messages/vi.json"), "utf8"),
) as { dashboard: { nav: Record<string, string> } };

assert.match(
  source,
  /href=\{activeSubject === "ielts" \? "\/ielts\/settings" : "\/settings"\}/,
  "the dashboard rail must keep IELTS learners in IELTS settings",
);
assert.equal(en.dashboard.nav.ielts_coach, "IELTS Coach");
assert.equal(en.dashboard.nav.ielts_profile, "Performance");
assert.equal(vi.dashboard.nav.ielts_coach, "HLV IELTS");
assert.equal(vi.dashboard.nav.ielts_profile, "Hiệu suất");

console.log("dashboard sidebar contract tests passed");
