import assert from "node:assert/strict";
import { buildPrepStarterBlock } from "@/lib/practice-prep-helpers";
import type { DebateTopic } from "@/types";
import {
  TRUONG_TEEN_EVAL_MOMENTS,
  TRUONG_TEEN_PHRASE_BANK,
  TRUONG_TEEN_PROMPT_VERSION,
  TRUONG_TEEN_REBUTTAL_ARCHETYPES,
  buildFuzzyEvidenceHintBlock,
  buildTruongTeenJudgingPromptAddendum,
  buildTruongTeenRebuttalPromptAddendum,
  buildTruongTeenRoundInstructions,
  findFuzzyEvidenceHints,
  getTruongTeenWordTarget,
  shouldUseTruongTeenPrompt,
} from "./debate-dna";

assert.equal(TRUONG_TEEN_PROMPT_VERSION, "truong-teen-2025-v3");
assert.ok(TRUONG_TEEN_REBUTTAL_ARCHETYPES.length >= 10);
assert.ok(
  TRUONG_TEEN_REBUTTAL_ARCHETYPES.some(
    (archetype) => archetype.key === "goodhart_incentive_toxicity"
  )
);
assert.ok(TRUONG_TEEN_PHRASE_BANK.some((phrase) => phrase.vi.includes("Gánh nặng")));
assert.equal(TRUONG_TEEN_EVAL_MOMENTS.length, 25);

assert.equal(
  shouldUseTruongTeenPrompt({
    practiceLanguage: "vi",
    practiceTrack: "debate",
  }),
  true
);
assert.equal(
  shouldUseTruongTeenPrompt({
    practiceLanguage: "en",
    practiceTrack: "debate",
  }),
  false
);
assert.equal(
  shouldUseTruongTeenPrompt({
    practiceLanguage: "vi",
    practiceTrack: "speaking",
  }),
  false
);

const hardTarget = getTruongTeenWordTarget({
  enabled: true,
  difficulty: "hard",
  target: { min: 850, max: 1100, label: "7-minute" },
});
assert.deepEqual(hardTarget, { min: 800, max: 1200, label: "7-minute" });

const rebuttalAddendum = buildTruongTeenRebuttalPromptAddendum({
  difficulty: "hard",
  wordTarget: hardTarget,
  debateFormat: "rebuttal",
});
assert.match(rebuttalAddendum, /2-3 macro clash axes/);
assert.match(rebuttalAddendum, /standalone, answerable claim/);
assert.match(rebuttalAddendum, /800-1200 Vietnamese words/);
assert.match(rebuttalAddendum, /Goodhart|Độc tính chỉ số/);

const closingAddendum = buildTruongTeenRebuttalPromptAddendum({
  difficulty: "hard",
  wordTarget: hardTarget,
  debateFormat: "closing",
});
assert.match(closingAddendum, /do not introduce any new LD/);
assert.match(closingAddendum, /deeper weighing and impact comparison/);

const closingInstructions = buildTruongTeenRoundInstructions({
  debateFormat: "closing",
  speechTimeSeconds: 420,
  wordTarget: hardTarget,
});
assert.match(closingInstructions, /Do not introduce a new LD/);
assert.match(closingInstructions, /never add extra new arguments/);

const judgingAddendum = buildTruongTeenJudgingPromptAddendum();
assert.match(judgingAddendum, /Assertion dumping/);
assert.match(judgingAddendum, /Missing mechanism/);
assert.match(judgingAddendum, /Generic or translated Vietnamese/);

const evidenceHints = findFuzzyEvidenceHints(
  "Bạn nhắc tới Malale Yusfi và Gitan Chor Ground trong ví dụ."
);
assert.deepEqual(
  evidenceHints.map((hint) => hint.normalized),
  ["Malala Yousafzai", "Gitanjali Rao"]
);
assert.match(
  buildFuzzyEvidenceHintBlock("cc Sanders khởi nghiệp muộn"),
  /Colonel Sanders/
);

const topic: DebateTopic = {
  id: "vn-test",
  title: "Việt Nam quá chú trọng học thuộc lòng",
  category: "Education",
  difficulty: "intermediate",
  suggestedPoints: {
    proposition: ["Học thuộc làm học sinh sợ sai"],
    opposition: ["Nền tảng kiến thức giúp sáng tạo"],
  },
};

assert.match(
  buildPrepStarterBlock("burden", topic, "proposition", "vi"),
  /Chốt gánh nặng/
);
assert.match(
  buildPrepStarterBlock("clash", topic, "proposition", "vi"),
  /Tạo trục va chạm/
);
assert.match(
  buildPrepStarterBlock("mechanism", topic, "opposition", "en"),
  /Deepen the mechanism/
);
