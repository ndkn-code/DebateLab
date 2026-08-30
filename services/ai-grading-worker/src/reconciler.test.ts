import assert from "node:assert/strict";
import test from "node:test";
import { reconcileAiGradingRuns } from "./reconciler";

test("Scheduler reconciliation republishes only reference-only jobs", async () => {
  const previousProject = process.env.GCP_PROJECT_ID;
  const previousTopic = process.env.GCP_AI_GRADING_TOPIC;
  process.env.GCP_PROJECT_ID = "test-project";
  process.env.GCP_AI_GRADING_TOPIC = "test-ai-grading";
  const marked: Array<{ id: string; messageId: string }> = [];
  let publishedBody: unknown;
  try {
    const result = await reconcileAiGradingRuns({
      candidates: async () => [
        {
          schemaVersion: 1,
          kind: "ielts_speaking_score",
          sourceId: "00000000-0000-4000-8000-000000000001",
          workflowRunId: "00000000-0000-4000-8000-000000000002",
        },
      ],
      token: async () => "adc-token",
      fetch: async (_url, init) => {
        publishedBody = JSON.parse(String(init?.body));
        return new Response(JSON.stringify({ messageIds: ["republished-1"] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
      markPublished: async (params) => {
        marked.push(params);
      },
    });
    assert.deepEqual(result, { scanned: 1, published: 1 });
    assert.deepEqual(marked, [
      {
        id: "00000000-0000-4000-8000-000000000002",
        messageId: "republished-1",
      },
    ]);
    const message = (
      publishedBody as { messages: Array<{ data: string; attributes: object }> }
    ).messages[0]!;
    const decoded = JSON.parse(
      Buffer.from(message.data, "base64").toString("utf8"),
    );
    assert.deepEqual(decoded, {
      schemaVersion: 1,
      kind: "ielts_speaking_score",
      sourceId: "00000000-0000-4000-8000-000000000001",
      workflowRunId: "00000000-0000-4000-8000-000000000002",
    });
    assert.equal(JSON.stringify(publishedBody).includes("transcript"), false);
    assert.equal(JSON.stringify(publishedBody).includes("userId"), false);
  } finally {
    if (previousProject === undefined) delete process.env.GCP_PROJECT_ID;
    else process.env.GCP_PROJECT_ID = previousProject;
    if (previousTopic === undefined) delete process.env.GCP_AI_GRADING_TOPIC;
    else process.env.GCP_AI_GRADING_TOPIC = previousTopic;
  }
});
