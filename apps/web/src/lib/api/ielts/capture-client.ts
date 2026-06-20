/**
 * Browser data-access for the in-mock Writing/Speaking capture surfaces (WS-5.2).
 *
 * Keeps fetch + storage calls out of the renderer components (the inline-query
 * ban): the components call these typed helpers, which submit to the existing
 * async scorers and poll for the band/criteria/feedback. Audio is uploaded
 * directly to the speaking-audio bucket (same path convention as practice),
 * already encoded as WAV PCM 16 kHz mono so STT + Azure assessment both work.
 */
import { createTypedBrowserClient } from "@/lib/supabase/client";
import { IELTS_SPEAKING_AUDIO_BUCKET } from "@/lib/ielts/speaking-scorer/constants";
import type { IeltsFeedbackLanguage } from "@/lib/api/ielts/schema";
// Type-only imports from the server-only repositories (erased at build time).
import type { WritingResponseView } from "@/lib/api/ielts/writing-responses-repository";
import type { SpeakingResponseView } from "@/lib/api/ielts/speaking-responses-repository";

/** Carries the HTTP status so the UI can distinguish the metered 402 cap. */
export class CaptureRequestError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "CaptureRequestError";
    this.status = status;
  }
}

export interface SubmitScoringResult {
  status: string;
  usage: { used: number; limit: number | null };
}

interface WritingSubmitResponse extends SubmitScoringResult {
  writingResponseId: string;
}

interface SpeakingSubmitResponse extends SubmitScoringResult {
  speakingResponseId: string;
}

async function readError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string };
    if (body?.error) return body.error;
  } catch {
    /* fall through to a generic message */
  }
  return `Request failed (${response.status}).`;
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new CaptureRequestError(await readError(response), response.status);
  }
  return (await response.json()) as T;
}

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new CaptureRequestError(await readError(response), response.status);
  }
  return (await response.json()) as T;
}

export interface SubmitWritingInput {
  attemptId: string;
  questionId: string;
  essay: string;
  feedbackLanguage: IeltsFeedbackLanguage;
}

export function submitWritingResponse(
  input: SubmitWritingInput,
): Promise<WritingSubmitResponse> {
  return postJson<WritingSubmitResponse>("/api/ielts/writing-responses", input);
}

export function pollWritingResponse(id: string): Promise<WritingResponseView> {
  return getJson<WritingResponseView>(`/api/ielts/writing-responses/${id}`);
}

/**
 * Upload the WAV recording to the speaking-audio bucket under the caller's own
 * path prefix and return the storage path to submit for scoring.
 */
export async function uploadSpeakingAudio(input: {
  attemptId: string;
  questionId: string;
  wav: Blob;
}): Promise<string> {
  const supabase = createTypedBrowserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new CaptureRequestError("Please sign in again to submit audio.", 401);
  }
  const path = `${user.id}/${input.attemptId}/speaking-${input.questionId}.wav`;
  const { error } = await supabase.storage
    .from(IELTS_SPEAKING_AUDIO_BUCKET)
    .upload(path, input.wav, { contentType: "audio/wav", upsert: true });
  if (error) {
    throw new CaptureRequestError(`Audio upload failed: ${error.message}`, 500);
  }
  return path;
}

export interface SubmitSpeakingInput {
  attemptId: string;
  questionId: string;
  audioStoragePath: string;
  durationSeconds: number;
  feedbackLanguage: IeltsFeedbackLanguage;
}

export function submitSpeakingResponse(
  input: SubmitSpeakingInput,
): Promise<SpeakingSubmitResponse> {
  return postJson<SpeakingSubmitResponse>(
    "/api/ielts/speaking-responses",
    input,
  );
}

export function pollSpeakingResponse(id: string): Promise<SpeakingResponseView> {
  return getJson<SpeakingResponseView>(`/api/ielts/speaking-responses/${id}`);
}
