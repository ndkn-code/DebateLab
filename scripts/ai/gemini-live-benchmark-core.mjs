import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const FILLERS = new Set(["ah", "er", "erm", "hmm", "uh", "um"]);

export function normalizeTranscript(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[^\p{L}\p{N}']+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function transcriptTokens(value) {
  const normalized = normalizeTranscript(value);
  return normalized ? normalized.split(" ") : [];
}

export function editDistance(left, right) {
  const previous = Array.from(
    { length: right.length + 1 },
    (_, index) => index,
  );
  for (let row = 1; row <= left.length; row += 1) {
    const current = [row];
    for (let column = 1; column <= right.length; column += 1) {
      current[column] = Math.min(
        current[column - 1] + 1,
        previous[column] + 1,
        previous[column - 1] + (left[row - 1] === right[column - 1] ? 0 : 1),
      );
    }
    previous.splice(0, previous.length, ...current);
  }
  return previous[right.length] ?? left.length;
}

export function scoreTranscript(reference, hypothesis) {
  const expected = transcriptTokens(reference);
  const actual = transcriptTokens(hypothesis);
  const expectedFillers = expected.filter((token) => FILLERS.has(token));
  const actualFillerCounts = new Map();
  for (const token of actual) {
    if (FILLERS.has(token)) {
      actualFillerCounts.set(token, (actualFillerCounts.get(token) ?? 0) + 1);
    }
  }
  let matchedFillers = 0;
  for (const token of expectedFillers) {
    const available = actualFillerCounts.get(token) ?? 0;
    if (available > 0) {
      matchedFillers += 1;
      actualFillerCounts.set(token, available - 1);
    }
  }
  return {
    referenceWords: expected.length,
    edits: editDistance(expected, actual),
    wordErrorRate:
      expected.length === 0
        ? actual.length === 0
          ? 0
          : 1
        : editDistance(expected, actual) / expected.length,
    fillerExpected: expectedFillers.length,
    fillerMatched: matchedFillers,
    fillerRecall:
      expectedFillers.length === 0
        ? null
        : matchedFillers / expectedFillers.length,
  };
}

export function summarizeBenchmark(rows) {
  const successful = rows.filter((row) => row.status === "ok");
  const mean = (values) =>
    values.length === 0
      ? null
      : values.reduce((sum, value) => sum + value, 0) / values.length;
  const aggregate = (provider) => {
    // Provider completion and quality are independent. Do not erase one
    // provider's success merely because its paired request failed.
    const providerRows = rows
      .map((row) => row.providers?.[provider])
      .filter((row) => row?.status === "ok");
    return {
      completed: providerRows.length,
      meanWordErrorRate: mean(
        providerRows.map((row) => row.quality.wordErrorRate),
      ),
      meanFillerRecall: mean(
        providerRows
          .map((row) => row.quality.fillerRecall)
          .filter((value) => value !== null),
      ),
      meanFinalAfterAudioEndMs: mean(
        providerRows
          .map((row) => row.timing.finalAfterAudioEndMs)
          .filter(Number.isFinite),
      ),
    };
  };
  return {
    cases: rows.length,
    completedCases: successful.length,
    gemini: aggregate("gemini"),
    deepgram: aggregate("deepgram"),
  };
}

export function validateBenchmarkConsent(consent) {
  const validSynthetic =
    consent?.dataClass === "synthetic" &&
    consent.containsPersonalData === false &&
    typeof consent.speaker === "string" &&
    consent.speaker.trim().length > 0;
  const validHuman =
    consent?.dataClass === "human_adult_consented" &&
    consent.containsPersonalData === true &&
    typeof consent.speaker === "string" &&
    consent.speaker.trim().length > 0 &&
    typeof consent.consentReference === "string" &&
    consent.consentReference.trim().length > 0;
  if (!validSynthetic && !validHuman) {
    throw new Error(
      "Benchmark manifest requires explicit synthetic or consented-adult data classification.",
    );
  }
  return consent;
}

export function redactHumanTranscriptRows(rows, consent) {
  if (consent.dataClass !== "human_adult_consented") return rows;
  return rows.map((row) => ({
    ...row,
    providers: Object.fromEntries(
      Object.entries(row.providers).map(([provider, result]) => {
        if (result.status !== "ok") return [provider, result];
        const { transcript, ...safeResult } = result;
        return [
          provider,
          {
            ...safeResult,
            transcriptSha256: createHash("sha256")
              .update(transcript, "utf8")
              .digest("hex"),
          },
        ];
      }),
    ),
  }));
}

function readAscii(buffer, offset, size) {
  return buffer.subarray(offset, offset + size).toString("ascii");
}

export async function readPcm16MonoWav(path) {
  const wav = await readFile(path);
  if (
    wav.length < 44 ||
    readAscii(wav, 0, 4) !== "RIFF" ||
    readAscii(wav, 8, 4) !== "WAVE"
  ) {
    throw new Error(`Unsupported WAV container: ${path}`);
  }
  let offset = 12;
  let format = null;
  let pcm = null;
  while (offset + 8 <= wav.length) {
    const id = readAscii(wav, offset, 4);
    const size = wav.readUInt32LE(offset + 4);
    const body = offset + 8;
    if (body + size > wav.length)
      throw new Error(`Truncated WAV chunk: ${path}`);
    if (id === "fmt ") {
      format = {
        encoding: wav.readUInt16LE(body),
        channels: wav.readUInt16LE(body + 2),
        sampleRate: wav.readUInt32LE(body + 4),
        bitsPerSample: wav.readUInt16LE(body + 14),
      };
    } else if (id === "data") {
      pcm = wav.subarray(body, body + size);
    }
    offset = body + size + (size % 2);
  }
  if (
    !format ||
    format.encoding !== 1 ||
    format.channels !== 1 ||
    format.sampleRate !== 16_000 ||
    format.bitsPerSample !== 16 ||
    !pcm
  ) {
    throw new Error(
      `Benchmark audio must be 16-bit PCM, mono, 16 kHz: ${path}`,
    );
  }
  return { pcm, durationMs: (pcm.length / 2 / format.sampleRate) * 1000 };
}

export function appendZeroPreRoll(pcm, milliseconds = 300) {
  const bytes = Math.round((16_000 * 2 * milliseconds) / 1000);
  return Buffer.concat([Buffer.alloc(bytes), pcm]);
}
