import assert from "node:assert/strict";
import { runListeningAudioBackfill } from "./backfill-core";
import type { GenerateListeningAudioResult } from "./generate";
import { isMissingProviderConfigError } from "./provider-availability";

function result(
  over: Partial<GenerateListeningAudioResult>,
): GenerateListeningAudioResult {
  return {
    assetId: "a",
    status: "ready",
    url: "https://x/a.mp3",
    version: 1,
    skipped: false,
    queued: false,
    missingProviders: [],
    ...over,
  };
}

async function main() {
  // --- classifies each section by its generator result ----------------------
  const byId: Record<string, GenerateListeningAudioResult> = {
    gen: result({ status: "ready" }),
    skip: result({ skipped: true }),
    queue: result({ status: "pending", url: null, queued: true, missingProviders: ["google"] }),
  };
  const order: string[] = [];
  const summary = await runListeningAudioBackfill({
    sections: [{ id: "gen" }, { id: "skip" }, { id: "queue" }],
    generate: async (id) => {
      order.push(id);
      return byId[id];
    },
  });

  assert.deepEqual(order, ["gen", "skip", "queue"]); // runs in order
  assert.equal(summary.total, 3);
  assert.equal(summary.generated, 1);
  assert.equal(summary.skipped, 1);
  assert.equal(summary.queued, 1);
  assert.equal(summary.failed, 0);
  assert.deepEqual(summary.missingProviders, ["google"]);
  assert.equal(summary.sections.find((s) => s.sectionId === "queue")?.outcome, "queued");

  // --- a thrown missing-creds fault is QUEUED, not failed (never aborts) -----
  const recovered = await runListeningAudioBackfill({
    sections: [{ id: "ok" }, { id: "aus" }, { id: "ok2" }],
    isQueueError: isMissingProviderConfigError,
    generate: async (id) => {
      if (id === "aus") throw new Error("GOOGLE_TTS_MISSING_CONFIG");
      return result({});
    },
  });
  assert.equal(recovered.generated, 2);
  assert.equal(recovered.queued, 1);
  assert.equal(recovered.failed, 0);
  const aus = recovered.sections.find((s) => s.sectionId === "aus");
  assert.equal(aus?.outcome, "queued");
  assert.match(aus?.error ?? "", /GOOGLE_TTS_MISSING_CONFIG/);

  // --- a real fault is FAILED but does not abort the rest -------------------
  const partial = await runListeningAudioBackfill({
    sections: [{ id: "a" }, { id: "boom" }, { id: "c" }],
    isQueueError: isMissingProviderConfigError,
    generate: async (id) => {
      if (id === "boom") throw new Error("DEEPGRAM_TTS_FAILED");
      return result({});
    },
  });
  assert.equal(partial.total, 3);
  assert.equal(partial.generated, 2); // c still ran after boom failed
  assert.equal(partial.failed, 1);
  assert.equal(partial.queued, 0);

  // --- empty target list is a clean no-op -----------------------------------
  const empty = await runListeningAudioBackfill({ sections: [], generate: async () => result({}) });
  assert.deepEqual(empty, {
    total: 0,
    generated: 0,
    skipped: 0,
    queued: 0,
    failed: 0,
    missingProviders: [],
    sections: [],
  });

  console.log("ielts/listening-audio/backfill-core tests passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
