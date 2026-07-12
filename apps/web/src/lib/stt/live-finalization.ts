export type FinalizedSpeechStatus =
  | "finalized"
  | "interim_fallback"
  | "timeout"
  | "no_speech";

export interface FinalizedSpeech {
  transcript: string;
  status: FinalizedSpeechStatus;
  metadata: {
    finalizedLength: number;
    interimLength: number;
    usedInterimFallback: boolean;
    timedOut: boolean;
  };
}

export function normalizeLiveTranscript(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function appendTranscriptSegment(transcript: string, segment: string) {
  const current = normalizeLiveTranscript(transcript);
  const next = normalizeLiveTranscript(segment);
  if (!next) return current;
  if (!current) return next;
  if (current === next || current.endsWith(` ${next}`)) return current;
  return `${current} ${next}`;
}

export function buildFinalizedSpeech(params: {
  finalizedTranscript: string;
  interimTranscript: string;
  finalizedByProvider: boolean;
  timedOut: boolean;
}): FinalizedSpeech {
  const finalized = normalizeLiveTranscript(params.finalizedTranscript);
  const interim = normalizeLiveTranscript(params.interimTranscript);
  const transcript = appendTranscriptSegment(finalized, interim);
  const usedInterimFallback = Boolean(interim) && transcript !== finalized;

  let status: FinalizedSpeechStatus;
  if (!transcript) status = "no_speech";
  else if (usedInterimFallback) status = "interim_fallback";
  else if (params.timedOut) status = "timeout";
  else status = "finalized";

  return {
    transcript,
    status,
    metadata: {
      finalizedLength: finalized.length,
      interimLength: interim.length,
      usedInterimFallback,
      timedOut: params.timedOut,
    },
  };
}
