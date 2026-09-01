import { attemptSpeakingBand } from "@/lib/scoring/ielts-speaking/band-math";
import { writingOverallBand } from "@/lib/scoring/ielts-writing/band-math";

export interface StoredAttemptBands {
  listening_band?: number | null;
  reading_band?: number | null;
  writing_band?: number | null;
  speaking_band?: number | null;
}

export interface WritingBandResponse {
  id: string;
  task_number: number;
  revision: number;
  task_band: number | null;
}

export interface SpeakingBandResponse {
  id: string;
  part_number: number | null;
  revision: number;
  speaking_band: number | null;
}

export interface PublishedBandReview {
  review_kind: "writing" | "speaking";
  writing_response_id: string | null;
  speaking_response_id: string | null;
  revision: number;
  task_band: number | null;
  skill_band: number | null;
}

function latestBySlot<T extends { revision: number }>(
  rows: T[],
  slot: (row: T) => number | null,
): T[] {
  const latest = new Map<number, T>();
  for (const row of rows) {
    const key = slot(row);
    if (key === null) continue;
    const current = latest.get(key);
    if (!current || row.revision > current.revision) latest.set(key, row);
  }
  return [...latest.values()];
}

function reviewKey(responseId: string, revision: number): string {
  return `${responseId}:${revision}`;
}

function resolveWritingBand(
  responses: WritingBandResponse[],
  reviews: Map<string, PublishedBandReview>,
): { band: number | null; teacherApplied: boolean } {
  let teacherApplied = false;
  const rows = latestBySlot(responses, (row) => row.task_number).map(
    (response) => {
      const review = reviews.get(reviewKey(response.id, response.revision));
      if (review?.task_band !== null && review?.task_band !== undefined) {
        teacherApplied = true;
        return { taskNumber: response.task_number, band: review.task_band };
      }
      return { taskNumber: response.task_number, band: response.task_band };
    },
  );
  if (rows.length === 1) {
    return { band: rows[0]?.band ?? null, teacherApplied };
  }
  return {
    band: writingOverallBand({
      task1Band: rows.find((row) => row.taskNumber === 1)?.band ?? null,
      task2Band: rows.find((row) => row.taskNumber === 2)?.band ?? null,
    }),
    teacherApplied,
  };
}

function resolveSpeakingBand(
  responses: SpeakingBandResponse[],
  reviews: Map<string, PublishedBandReview>,
): { band: number | null; teacherApplied: boolean } {
  let teacherApplied = false;
  const rows = latestBySlot(responses, (row) => row.part_number).map(
    (response) => {
      const review = reviews.get(reviewKey(response.id, response.revision));
      if (review?.skill_band !== null && review?.skill_band !== undefined) {
        teacherApplied = true;
        return review.skill_band;
      }
      return response.speaking_band;
    },
  );
  const bands = rows.filter((band): band is number => band !== null);
  return {
    band:
      rows.length > 0 && bands.length === rows.length
        ? attemptSpeakingBand(bands)
        : null,
    teacherApplied,
  };
}

export function resolveTeacherAwareAttemptBands(params: {
  ai: StoredAttemptBands;
  reviews: PublishedBandReview[];
  writingResponses: WritingBandResponse[];
  speakingResponses: SpeakingBandResponse[];
}): {
  bands: {
    listening: number | null;
    reading: number | null;
    writing: number | null;
    speaking: number | null;
  };
  source: "ai" | "mixed";
} {
  const writingReviews = new Map(
    params.reviews
      .filter(
        (row) =>
          row.review_kind === "writing" && row.writing_response_id !== null,
      )
      .map((row) => [
        reviewKey(row.writing_response_id as string, row.revision),
        row,
      ]),
  );
  const speakingReviews = new Map(
    params.reviews
      .filter(
        (row) =>
          row.review_kind === "speaking" && row.speaking_response_id !== null,
      )
      .map((row) => [
        reviewKey(row.speaking_response_id as string, row.revision),
        row,
      ]),
  );

  const writing = resolveWritingBand(params.writingResponses, writingReviews);
  const speaking = resolveSpeakingBand(
    params.speakingResponses,
    speakingReviews,
  );
  const teacherApplied = writing.teacherApplied || speaking.teacherApplied;

  return {
    bands: {
      listening: params.ai.listening_band ?? null,
      reading: params.ai.reading_band ?? null,
      writing: writing.band ?? params.ai.writing_band ?? null,
      speaking: speaking.band ?? params.ai.speaking_band ?? null,
    },
    source: teacherApplied ? "mixed" : "ai",
  };
}
