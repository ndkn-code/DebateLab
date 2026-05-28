import assert from "node:assert/strict";
import {
  extractJsonObjectFromText,
  normalizeCoachVisualExplainerSpec,
} from "./visualization";

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

test("accepts a safe visual explainer spec", () => {
  const spec = normalizeCoachVisualExplainerSpec(
    {
      version: 1,
      template: "argument_chain",
      title: "Claim to Impact",
      steps: [
        { id: "claim", label: "Claim", text: "State the exact thing you prove." },
        { id: "mechanism", label: "Mechanism", text: "Explain how the harm happens." },
        { id: "impact", label: "Impact", text: "Show why the harm matters." },
      ],
      connectors: [{ from: "claim", to: "mechanism", label: "because" }],
      takeaway: "A claim wins only when the mechanism carries it.",
    },
    { sourceMessageId: "m1", plannerModel: "gemma-4-31b-it" }
  );
  assert.equal(spec?.template, "argument_chain");
  assert.equal(spec?.sourceMessageId, "m1");
  assert.equal(spec?.plannerModel, "gemma-4-31b-it");
});

test("rejects unknown templates and unsafe HTML-like text", () => {
  assert.equal(
    normalizeCoachVisualExplainerSpec({
      version: 1,
      template: "freeform_svg",
      title: "Bad",
      steps: [
        { id: "a", label: "A", text: "A" },
        { id: "b", label: "B", text: "B" },
        { id: "c", label: "C", text: "C" },
      ],
    }),
    null
  );

  assert.equal(
    normalizeCoachVisualExplainerSpec({
      version: 1,
      template: "argument_chain",
      title: "<script>alert(1)</script>",
      steps: [
        { id: "a", label: "A", text: "A" },
        { id: "b", label: "B", text: "B" },
        { id: "c", label: "C", text: "C" },
      ],
    }),
    null
  );
});

test("rejects unknown keys", () => {
  assert.equal(
    normalizeCoachVisualExplainerSpec({
      version: 1,
      template: "argument_chain",
      title: "Too much freedom",
      rawHtml: "<svg />",
      steps: [
        { id: "a", label: "A", text: "A" },
        { id: "b", label: "B", text: "B" },
        { id: "c", label: "C", text: "C" },
      ],
    }),
    null
  );
});

test("extracts fenced JSON planner output", () => {
  const parsed = extractJsonObjectFromText(
    '```json\n{"version":1,"template":"rebuttal_pivot","title":"Pivot","steps":[{"id":"a","label":"Assumption","text":"Name it."},{"id":"b","label":"Pivot","text":"Turn it."},{"id":"c","label":"Response","text":"Rebuild."}]}\n```'
  );
  assert.equal((parsed as { template: string }).template, "rebuttal_pivot");
});

