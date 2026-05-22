import assert from "node:assert/strict";
import {
  buildCalicoImportPlan,
  detectMotionLanguage,
  hashMotionTitle,
  normalizeMotionTitle,
  parseCalicoMotionPage,
  type CalicoSource,
} from "./ingest-calico-motions";

const statisticsSource: CalicoSource = {
  slug: "fixture-stats",
  tournamentName: "Fixture Stats",
  url: "https://example.com/stats",
  pageType: "statistics",
};

const listSource: CalicoSource = {
  slug: "fixture-list",
  tournamentName: "Fixture List",
  url: "https://example.com/list",
  pageType: "motion_list",
};

const statsHtml = `
  <span class="badge badge-secondary">Round 1</span>
  <h4 class="mb-3 mt-1">
    This House would ban targeted political advertising
    <small>(Technology)</small>
  </h4>
  <button title="χ² statistic: balanced at p=0.12">Balance</button>
  <div class="modal-body lead"><p>Targeted political advertising uses personal data.</p></div>
  <span class="badge badge-secondary">Round 2</span>
  <h4 class="mb-3 mt-1">
    This House supports four-day school weeks
    <small>(Education)</small>
  </h4>
`;

const listHtml = `
  <div class="card mt-3">
    <h4 class="card-title">Grand Final</h4>
    <div class="mr-auto pr-3 lead">THBT cities should make all public transport free</div>
    <div class="modal-body lead"><p>Public transport includes buses and trains.</p></div>
  </div>
  <div class="card mt-3">
    <h4 class="card-title">Round 2</h4>
    <div class="mr-auto pr-3 lead">THW ban private cars in city centers</div>
  </div>
`;

const statsMotions = parseCalicoMotionPage(statisticsSource, statsHtml);
assert.equal(statsMotions.length, 2);
assert.equal(statsMotions[0]?.roundLabel, "Round 1");
assert.equal(statsMotions[0]?.sourceTag, "Technology");
assert.equal(
  statsMotions[0]?.infoSlide,
  "Targeted political advertising uses personal data."
);
assert.equal(statsMotions[0]?.stats.hasChiSquare, true);
assert.equal(statsMotions[1]?.sourceTag, "Education");

const listMotions = parseCalicoMotionPage(listSource, listHtml);
assert.equal(listMotions.length, 2);
assert.equal(listMotions[0]?.roundLabel, "Grand Final");
assert.equal(listMotions[0]?.infoSlide, "Public transport includes buses and trains.");
assert.equal(listMotions[1]?.roundLabel, "Round 2");

assert.equal(
  normalizeMotionTitle(" This  House -- would ban targeted advertising! "),
  "this house would ban targeted advertising"
);
assert.equal(
  hashMotionTitle("This House would ban targeted advertising."),
  hashMotionTitle("this house would ban targeted advertising")
);

assert.equal(detectMotionLanguage("This House would legalize assisted dying"), "en");
assert.equal(detectMotionLanguage("THBT Việt Nam nên cấm quảng cáo thuốc lá"), "vi");

const duplicatePlan = buildCalicoImportPlan([
  {
    ...statsMotions[0],
    sourceMotionIndex: 1,
  },
  {
    ...statsMotions[0],
    sourceSlug: "fixture-stats-two",
    tournamentName: "Fixture Stats Two",
    sourceMotionIndex: 2,
  },
]);
assert.equal(duplicatePlan.topics.length, 1);
assert.equal(duplicatePlan.sources.length, 2);
assert.deepEqual(duplicatePlan.topics[0]?.tournamentSlugs, [
  "fixture-stats",
  "fixture-stats-two",
]);

console.log("Calico motion importer tests passed.");
