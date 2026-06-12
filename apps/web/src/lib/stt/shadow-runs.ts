import "server-only";

import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PracticeTranscriptionArtifact } from "@thinkfy/shared/practice";
import type { DebateScore, PracticeLanguage, PracticeTrack } from "@/types";

function hashText(value: string | null | undefined) {
  return createHash("sha256").update(value ?? "").digest("hex");
}

function compactWarnings(value: readonly string[] | null | undefined) {
  return Array.from(new Set(value ?? [])).slice(0, 24);
}

export async function recordSttRepairShadowRun(
  supabase: SupabaseClient,
  input: {
    userId: string;
    sourceRoute: string;
    transcription: PracticeTranscriptionArtifact | null | undefined;
    transcript: string;
    feedback?: DebateScore | null;
    practiceAttemptId?: string | null;
    analysisJobId?: string | null;
    debateSessionId?: string | null;
    practiceTrack?: PracticeTrack | null;
    practiceLanguage?: PracticeLanguage | null;
    topicTitle?: string | null;
    side?: "proposition" | "opposition" | null;
    audioStoragePath?: string | null;
    scoreBefore?: number | null;
    scoreAfter?: number | null;
    softCapReasons?: string[];
    metrics?: Record<string, unknown>;
  }
) {
  const repair = input.transcription?.repair;
  if (!repair) return null;

  const rawTranscript = input.transcription?.rawTranscript ?? input.transcript;
  const judgeTranscript = input.transcription?.judgeTranscript ?? null;
  const scoreBefore = input.scoreBefore ?? input.feedback?.totalScore ?? null;
  const scoreAfter = input.scoreAfter ?? null;

  try {
    const { data, error } = await supabase
      .from("stt_repair_shadow_runs")
      .upsert(
        {
          user_id: input.userId,
          practice_attempt_id: input.practiceAttemptId ?? null,
          analysis_job_id: input.analysisJobId ?? null,
          debate_session_id: input.debateSessionId ?? null,
          source_route: input.sourceRoute,
          practice_track: input.practiceTrack ?? "debate",
          practice_language: input.practiceLanguage ?? input.transcription?.language ?? "vi",
          topic_title: input.topicTitle ?? null,
          side: input.side ?? null,
          audio_storage_path:
            input.audioStoragePath ?? input.transcription?.audioStoragePath ?? null,
          raw_transcript_hash: repair.rawTranscriptHash || hashText(rawTranscript),
          baseline_transcript_hash: hashText(input.transcript),
          judge_transcript_hash: judgeTranscript ? hashText(judgeTranscript) : null,
          judge_transcript: judgeTranscript,
          repair_status: repair.status,
          repair_mode: repair.mode,
          repair_provider: repair.provider,
          repair_model: repair.model,
          repair_version: repair.version,
          repair_latency_ms: repair.latencyMs,
          edits: repair.edits,
          uncertain_spans: repair.uncertainSpans,
          warnings: compactWarnings(repair.warnings),
          hallucination_risk: repair.hallucinationRisk,
          score_before: scoreBefore,
          score_after: scoreAfter,
          score_delta:
            scoreBefore != null && scoreAfter != null ? scoreAfter - scoreBefore : null,
          soft_cap_reasons: compactWarnings(input.softCapReasons),
          metrics: input.metrics ?? {},
          updated_at: new Date().toISOString(),
        },
        input.practiceAttemptId
          ? { onConflict: "practice_attempt_id,raw_transcript_hash,repair_version" }
          : undefined
      )
      .select("id")
      .single();

    if (error) {
      if (process.env.NODE_ENV === "development") {
        console.warn("STT repair shadow run insert skipped:", error.message);
      }
      return null;
    }

    return (data as { id: string }).id;
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "STT repair shadow run skipped:",
        error instanceof Error ? error.message : error
      );
    }
    return null;
  }
}
