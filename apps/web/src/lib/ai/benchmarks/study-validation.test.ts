import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  assertBenchmarkStudyDesignIdentity,
  assertCurrentBenchmarkStudyDesignIdentity,
  IELTS_BENCHMARK_STUDY_DESIGN_CURRENT,
  IELTS_BENCHMARK_STUDY_DESIGN_V1,
} from "./study-design";
import "./study-design-v2-migration.test";
import {
  assertCurrentBenchmarkStudyDesignRows,
  validateBenchmarkStudyManifest,
} from "./study-validation";

assert.equal(IELTS_BENCHMARK_STUDY_DESIGN_CURRENT.version, 2);
assert.doesNotThrow(() =>
  assertCurrentBenchmarkStudyDesignRows([
    { benchmark_key: "v2", metadata: { studyDesignVersion: 2 } },
  ]),
);
assert.throws(
  () =>
    assertCurrentBenchmarkStudyDesignRows([
      { benchmark_key: "historical-v1", metadata: { studyDesignVersion: 1 } },
    ]),
  /IELTS_BENCHMARK_STUDY_DESIGN_MISMATCH:historical-v1/,
);
assert.deepEqual(
  IELTS_BENCHMARK_STUDY_DESIGN_CURRENT.strata.releaseAccentGroups,
  ["vi_north", "vi_central", "vi_south"],
);
assert.deepEqual(assertBenchmarkStudyDesignIdentity({
  id: IELTS_BENCHMARK_STUDY_DESIGN_V1.id,
  version: IELTS_BENCHMARK_STUDY_DESIGN_V1.version,
}), {
  id: IELTS_BENCHMARK_STUDY_DESIGN_V1.id,
  version: 1,
});
assert.throws(
  () => assertCurrentBenchmarkStudyDesignIdentity({
    id: IELTS_BENCHMARK_STUDY_DESIGN_V1.id,
    version: 1,
  }),
  /Invalid literal value|Invalid input/,
);

const templatePath = new URL(
  "../../../scripts/manifests/ielts-benchmark-study-manifest.template.json",
  import.meta.url,
);
const template = JSON.parse(readFileSync(templatePath, "utf8"));
const designManifest = JSON.parse(
  readFileSync(
    new URL(
      "../../../scripts/manifests/ielts-benchmark-study-design.v2.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
assert.equal(designManifest.version, IELTS_BENCHMARK_STUDY_DESIGN_CURRENT.version);
assert.deepEqual(
  designManifest.strata.releaseAccentGroups,
  IELTS_BENCHMARK_STUDY_DESIGN_CURRENT.strata.releaseAccentGroups,
);
const summary = validateBenchmarkStudyManifest(template, { mode: "draft" });

assert.equal(summary.valid, true);
assert.equal(summary.benchmarkCount, 1);
assert.equal(summary.sourceCount, 1);
assert.equal(summary.signatureVerified, false);
assert.deepEqual(summary.skillCounts, {
  ielts_speaking: 0,
  ielts_writing: 1,
});
assert.equal(summary.splitCounts.holdout, 1);
assert.ok(summary.deficitCount > 0);
for (const accentGroup of ["vi_north", "vi_central", "vi_south"]) {
  assert.ok(
    summary.deficits.some(
      (deficit) =>
        deficit.skill === "ielts_speaking" &&
        deficit.criterion === "pronunciation" &&
        deficit.accentGroup === accentGroup,
    ),
    `V2 must measure pronunciation coverage for ${accentGroup}`,
  );
}
assert.equal(
  summary.deficits.some(
    (deficit) =>
      deficit.skill === "ielts_speaking" &&
      deficit.criterion === "pronunciation" &&
      deficit.accentGroup === "vi_general",
  ),
  false,
  "legacy vi_general cannot satisfy or expand V2 release coverage",
);
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
assert.match(cli, /--trust-set=/);
assert.match(cli, /mode: draft \? "draft" : "release"/);
assert.match(cli, /JSON\.stringify\(summary/);

console.log("IELTS benchmark study validation tests passed");
