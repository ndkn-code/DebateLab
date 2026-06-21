import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { AiProviderRequestInput } from "@/lib/ai/provider-requests";
import {
  encodeWavPcm16,
  IELTS_PRONUNCIATION_SAMPLE_RATE,
} from "@/lib/ielts/audio/wav-encoder";
import { extractPronunciationSignal } from "@/lib/ielts/speaking-scorer/phoneme-contract";
import { buildSpeakingScorerPrompt } from "@/lib/ielts/speaking-scorer/prompt";
import {
  AZURE_PRONUNCIATION_WAV_CONTENT_TYPE,
  azurePronunciationContentType,
} from "./audio-format";
import { assessPronunciation } from "./service";

const fixture = JSON.parse(
  readFileSync(
    new URL(
      "../../scoring/ielts-pronunciation/__fixtures__/azure-pronunciation-response.json",
      import.meta.url,
    ),
    "utf8",
  ),
) as unknown;

function wavView(): { audio: ArrayBuffer; view: DataView } {
  const samples = new Float32Array([0, 0.15, -0.25, 0.4]);
  const audio = encodeWavPcm16(samples, IELTS_PRONUNCIATION_SAMPLE_RATE);
  return { audio, view: new DataView(audio) };
}

function requireCapturedRequest(
  value: { url: string; init: RequestInit } | null,
): { url: string; init: RequestInit } {
  if (!value) throw new Error("expected Azure request to be captured");
  return value;
}

async function main() {
  const { audio, view } = wavView();
  assert.equal(view.getUint16(20, true), 1, "WAV is PCM");
  assert.equal(view.getUint16(22, true), 1, "WAV is mono");
  assert.equal(view.getUint32(24, true), 16000, "WAV is 16 kHz");
  assert.equal(view.getUint16(34, true), 16, "WAV is 16-bit");

  const audioContentType = azurePronunciationContentType("audio/wav");
  assert.equal(audioContentType, AZURE_PRONUNCIATION_WAV_CONTENT_TYPE);

  const recorded: AiProviderRequestInput[] = [];
  const capturedRequests: Array<{ url: string; init: RequestInit }> = [];
  const times = [1000, 1125];
  const outcome = await assessPronunciation(
    {
      audio,
      audioContentType,
      referenceText: "A good answer uses clear examples.",
      userId: "user-1",
      speakingResponseId: "sr-e2e",
      practiceAttemptId: "attempt-1",
    },
    {
      getConfig: () => ({ apiKey: "test-key", region: "eastus" }),
      fetchImpl: async (url, init) => {
        capturedRequests.push({ url: String(url), init: init ?? {} });
        return new Response(JSON.stringify(fixture), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
      recordRequest: async (input) => {
        recorded.push(input);
        return "provider-request-1";
      },
      now: () => times.shift() ?? 1125,
      logger: { info: () => {}, warn: () => {} },
    },
  );

  assert.equal(outcome.status, "ok");
  if (outcome.status !== "ok") throw new Error("expected ok pronunciation");
  assert.equal(outcome.report.status, "scored");
  assert.equal(outcome.report.overall?.pronunciation, 86);
  assert.equal(outcome.pronunciationBand, 7.5);

  const request = requireCapturedRequest(capturedRequests[0] ?? null);
  assert.ok(request.url.includes("language=en-US"));
  const headers = request.init.headers as Record<string, string>;
  assert.equal(headers["Content-Type"], AZURE_PRONUNCIATION_WAV_CONTENT_TYPE);
  assert.equal(headers["Ocp-Apim-Subscription-Key"], "test-key");
  assert.equal(request.init.body, audio);

  const providerLog = recorded[0];
  assert.equal(providerLog?.status, "success");
  assert.equal(providerLog?.latencyMs, 125);
  assert.equal(providerLog?.sourceRoute, "ielts_speaking_pronunciation");

  const signal = extractPronunciationSignal(outcome.report);
  assert.equal(signal?.pronunciationScore, 86);
  assert.deepEqual(signal?.mispronouncedWords, ["answer"]);

  const prompt = buildSpeakingScorerPrompt({
    partNumber: 2,
    questionType: "speaking_part2_cuecard",
    questionPrompt: "Describe a useful skill you learned.",
    transcript: "A good answer uses clear examples.",
    wordCount: 6,
    feedbackLanguage: "en",
    grounding: {
      questionSampleAnswer: null,
      examinerNotes: [],
      peerSampleAnswers: [],
    },
    pronunciation: signal,
  });
  assert.match(prompt, /PHONEME ASSESSMENT/);
  assert.match(prompt, /overall 86\/100/);
  assert.match(prompt, /Flagged words: answer/);
  assert.match(prompt, /weight it together with the transcript/);
}

main()
  .then(() => console.log("ielts/pronunciation/e2e-contract tests passed"))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
