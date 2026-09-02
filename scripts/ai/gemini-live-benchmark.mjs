#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  appendZeroPreRoll,
  redactHumanTranscriptRows,
  readPcm16MonoWav,
  scoreTranscript,
  summarizeBenchmark,
  validateBenchmarkConsent,
} from "./gemini-live-benchmark-core.mjs";

const MODEL = "gemini-3.5-transcribe-live";
const LIVE_URL =
  "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent";

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

function keys() {
  const pooled = (process.env.GEMINI_API_KEYS ?? "")
    .split(",")
    .map((key) => key.trim())
    .filter(Boolean);
  const single = process.env.GEMINI_API_KEY?.trim();
  return [...new Set(pooled.length ? pooled : single ? [single] : [])];
}

async function runGemini({ pcm, reference, key }) {
  const audio = appendZeroPreRoll(pcm, 300);
  const connectedAt = Date.now();
  let audioStartAt = null;
  let audioEndAt = null;
  let setupMs = null;
  let firstInterimMs = null;
  let firstFinalMs = null;
  const transcriptSegments = [];
  return new Promise((resolveResult) => {
    let settled = false;
    let streamTimer = null;
    let finalizationTimer = null;
    const socket = new WebSocket(`${LIVE_URL}?key=${encodeURIComponent(key)}`);
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (streamTimer) clearTimeout(streamTimer);
      if (finalizationTimer) clearTimeout(finalizationTimer);
      try {
        socket.close();
      } catch {}
      resolveResult(result);
    };
    const timeout = setTimeout(
      () => finish({ status: "failed", error: "gemini_timeout" }),
      Math.max(20_000, audio.length / 32 + 10_000),
    );
    socket.addEventListener("open", () => {
      socket.send(
        JSON.stringify({
          setup: {
            model: `models/${MODEL}`,
            generationConfig: { responseModalities: ["TEXT"] },
            inputAudioTranscription: {
              languageCodes: ["en-US"],
              mode: "VERBATIM",
            },
          },
        }),
      );
    });
    socket.addEventListener("message", async (event) => {
      let raw = event.data;
      if (raw instanceof Blob) raw = await raw.text();
      else if (raw instanceof ArrayBuffer)
        raw = Buffer.from(raw).toString("utf8");
      const message = JSON.parse(String(raw));
      if (message.setupComplete) {
        setupMs = Date.now() - connectedAt;
        audioStartAt = Date.now();
        let offset = 0;
        const chunkBytes = 1_280; // 40 ms at 16 kHz PCM16.
        const send = () => {
          if (offset >= audio.length) {
            audioEndAt = Date.now();
            socket.send(
              JSON.stringify({ realtimeInput: { audioStreamEnd: true } }),
            );
            if (transcriptSegments.length > 0) {
              // A provider can finalize the last segment just before the local
              // audio-end timestamp. Give it a bounded grace period instead
              // of waiting until the global timeout.
              finalizationTimer = setTimeout(completeSuccess, 750);
            }
            return;
          }
          const chunk = audio.subarray(
            offset,
            Math.min(offset + chunkBytes, audio.length),
          );
          socket.send(
            JSON.stringify({
              realtimeInput: {
                audio: {
                  mimeType: "audio/pcm;rate=16000",
                  data: chunk.toString("base64"),
                },
              },
            }),
          );
          offset += chunkBytes;
          streamTimer = setTimeout(send, 40);
        };
        send();
      }
      const interim =
        message.serverContent?.interimInputTranscription?.text ??
        message.serverContent?.interim_input_transcription?.text;
      if (interim && audioStartAt && firstInterimMs === null) {
        firstInterimMs = Date.now() - audioStartAt;
      }
      const final = message.serverContent?.inputTranscription?.text;
      if (final) {
        transcriptSegments.push(final);
        if (audioStartAt && firstFinalMs === null)
          firstFinalMs = Date.now() - audioStartAt;
        if (audioEndAt) {
          completeSuccess();
        }
      }
    });
    socket.addEventListener("error", () =>
      finish({ status: "failed", error: "gemini_websocket" }),
    );
    socket.addEventListener("close", (event) => {
      if (!settled)
        finish({ status: "failed", error: `gemini_closed_${event.code}` });
    });

    function completeSuccess() {
      if (!audioEndAt || transcriptSegments.length === 0) return;
      const transcript = transcriptSegments.join(" ").trim();
      finish({
        status: "ok",
        model: MODEL,
        transcript,
        quality: scoreTranscript(reference, transcript),
        timing: {
          setupMs,
          firstInterimMs,
          firstFinalMs,
          finalAfterAudioEndMs: Date.now() - audioEndAt,
        },
      });
    }
  });
}

async function runDeepgram({ wavPath, reference, apiKey }) {
  const wav = await readFile(wavPath);
  const startedAt = Date.now();
  const url = new URL("https://api.deepgram.com/v1/listen");
  url.searchParams.set("model", "nova-3");
  url.searchParams.set("language", "en-US");
  url.searchParams.set("smart_format", "false");
  url.searchParams.set("filler_words", "true");
  const response = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Token ${apiKey}`, "Content-Type": "audio/wav" },
    body: wav,
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok)
    return { status: "failed", error: `deepgram_${response.status}` };
  const payload = await response.json();
  const transcript =
    payload.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? "";
  return {
    status: "ok",
    model: "nova-3",
    transcript,
    quality: scoreTranscript(reference, transcript),
    timing: { finalAfterAudioEndMs: Date.now() - startedAt },
  };
}

const manifestPath = argument("--manifest");
if (!manifestPath)
  throw new Error(
    "Usage: gemini-live-benchmark --manifest <json> [--output <json>]",
  );
const manifest = JSON.parse(await readFile(resolve(manifestPath), "utf8"));
if (!Array.isArray(manifest.cases) || manifest.cases.length === 0) {
  throw new Error("Benchmark manifest requires a non-empty cases array.");
}
const consent = validateBenchmarkConsent(manifest.consent);
const geminiKeys = keys();
if (geminiKeys.length === 0)
  throw new Error("GEMINI_API_KEY or GEMINI_API_KEYS is required.");
if (!process.env.DEEPGRAM_API_KEY)
  throw new Error("DEEPGRAM_API_KEY is required.");

const rows = [];
for (let index = 0; index < manifest.cases.length; index += 1) {
  const item = manifest.cases[index];
  const wavPath = resolve(item.audioPath);
  const { pcm, durationMs } = await readPcm16MonoWav(wavPath);
  const [gemini, deepgram] = await Promise.all([
    runGemini({
      pcm,
      reference: item.reference,
      key: geminiKeys[index % geminiKeys.length],
    }),
    runDeepgram({
      wavPath,
      reference: item.reference,
      apiKey: process.env.DEEPGRAM_API_KEY,
    }),
  ]);
  rows.push({
    id: String(item.id),
    status:
      gemini.status === "ok" && deepgram.status === "ok" ? "ok" : "failed",
    durationMs,
    providers: { gemini, deepgram },
  });
}

const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  consent,
  methodology: {
    geminiMode: "VERBATIM",
    geminiPreRollMs: 300,
    geminiChunkMs: 40,
    deepgramMode: "batch-after-recording",
  },
  summary: summarizeBenchmark(rows),
  cases: redactHumanTranscriptRows(rows, consent),
};
const serialized = `${JSON.stringify(report, null, 2)}\n`;
const output = argument("--output");
if (output) await writeFile(resolve(output), serialized, { mode: 0o600 });
process.stdout.write(serialized);
