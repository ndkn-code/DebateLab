import assert from "node:assert/strict";
import { decideCoachIntent } from "./intent";

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

test("routes normal chat to fast general coach", () => {
  const decision = decideCoachIntent({ message: "How should I warm up?" });
  assert.equal(decision.intent, "general");
  assert.equal(decision.corpusPurpose, null);
});

test("routes Trường Teen debate help to corpus prep helper", () => {
  const decision = decideCoachIntent({
    message: "Giải thích weighing trong Trường Teen cho em",
  });
  assert.equal(decision.intent, "corpus_debate_help");
  assert.equal(decision.corpusPurpose, "coach");
});

test("routes wording requests to phrase bank corpus", () => {
  const decision = decideCoachIntent({
    message: "Cho em câu chốt kiểu Trường Teen về motion truyền thông",
  });
  assert.equal(decision.intent, "corpus_debate_help");
  assert.equal(decision.corpusPurpose, "phrase_bank");
});

test("routes review requests to deep review", () => {
  const decision = decideCoachIntent({
    message: "So sánh 3 phiên gần nhất của tôi và cho bài tập tiếp theo",
  });
  assert.equal(decision.intent, "deep_review");
  assert.equal(decision.corpusPurpose, "coach");
});

test("routes visual requests to visual explainer", () => {
  const decision = decideCoachIntent({
    message: "Tôi không hiểu clash này, minh hoạ bằng sơ đồ được không?",
  });
  assert.equal(decision.intent, "visual_explainer");
  assert.equal(decision.corpusPurpose, "coach");
});

test("routes Vietnamese visual requests with debate terms to visual explainer", () => {
  const decision = decideCoachIntent({
    message: "Tôi vẫn chưa hiểu, hãy minh hoạ bằng sơ đồ về weighing",
  });
  assert.equal(decision.intent, "visual_explainer");
  assert.equal(decision.corpusPurpose, "coach");
});
