import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { validateBenchmarkStudyManifest } from "./study-validation";

const templatePath = new URL(
  "../../../scripts/manifests/ielts-benchmark-study-manifest.template.json",
  import.meta.url,
);
const template = JSON.parse(readFileSync(templatePath, "utf8"));
const summary = validateBenchmarkStudyManifest(template, { mode: "draft" });

assert.equal(summary.valid, true);
assert.equal(summary.benchmarkCount, 1);
assert.equal(summary.sourceCount, 1);
assert.deepEqual(summary.skillCounts, {
  ielts_speaking: 0,
  ielts_writing: 1,
});
assert.equal(summary.splitCounts.holdout, 1);
assert.ok(summary.deficitCount > 0);
assert.ok(
  summary.deficits.every(
    (deficit) =>
      deficit.required === 15 && deficit.observed >= 0 && deficit.observed < 15,
  ),
);
assert.throws(
  () => validateBenchmarkStudyManifest(template),
  /release coverage is incomplete/,
);

const cli = readFileSync(
  new URL(
    "../../../scripts/ai-grading-benchmark-study-validate.ts",
    import.meta.url,
  ),
  "utf8",
);
assert.doesNotMatch(cli, /createAdminClient|generateStructured|fetch\(/);
assert.doesNotMatch(cli, /responseText|examinerRationale|raterKey/);
assert.match(cli, /validateBenchmarkStudyManifest/);
assert.match(cli, /--draft/);
assert.match(cli, /mode: draft \? "draft" : "release"/);
assert.match(cli, /JSON\.stringify\(summary/);

console.log("IELTS benchmark study validation tests passed");
