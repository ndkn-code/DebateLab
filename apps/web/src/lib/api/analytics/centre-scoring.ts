import "server-only";
import type { IeltsDbClient } from "@/lib/api/ielts/client";
import type {
  CentreEventFact,
  ReportingPeriod,
  IeltsSkill,
} from "@/lib/analytics/contracts";
import { readChunkedPages, requireRows } from "./query-pages";
import { projectEffectiveBands } from "@/lib/api/ielts/effective-score-contract";

/** Called only with class IDs resolved from an authorized centre and its pilot flags. */
export async function loadCentreIeltsEvents(
  db: IeltsDbClient,
  trusted: IeltsDbClient,
  clubId: string,
  classIds: string[],
  period: ReportingPeriod,
): Promise<CentreEventFact[]> {
  const attempts = requireRows(
    await readChunkedPages([classIds], (chunks, from, to) =>
      db
        .from("ielts_attempts")
        .select(
          "id,user_id,class_id,club_id,assignment_id,test_id,submitted_at,completed_at,status",
        )
        .eq("club_id", clubId)
        .in("class_id", chunks[0])
        .not("assignment_id", "is", null)
        .not("submitted_at", "is", null)
        .lte("submitted_at", period.end)
        .order("id")
        .range(from, to),
    ),
    "mock attempts",
  );
  const byAttempt = new Map(attempts.map((row) => [row.id, row]));
  const attemptIds = attempts.map((row) => row.id);
  const [
    writingResult,
    speakingResult,
    effectiveResult,
    aiResult,
    reviewsResult,
    testsResult,
  ] = await Promise.all([
    readChunkedPages([attemptIds], (chunks, from, to) =>
      db
        .from("writing_responses")
        .select(
          "id,attempt_id,user_id,revision,revision_consumed_at,task_number,scored_at,status,task_band,created_at",
        )
        .in("attempt_id", chunks[0])
        .order("id")
        .range(from, to),
    ),
    readChunkedPages([attemptIds], (chunks, from, to) =>
      db
        .from("speaking_responses")
        .select(
          "id,attempt_id,user_id,revision,revision_consumed_at,part_number,scored_at,status,speaking_band,created_at",
        )
        .in("attempt_id", chunks[0])
        .order("id")
        .range(from, to),
    ),
    readChunkedPages([attemptIds], (chunks, from, to) =>
      db
        .from("ielts_effective_attempt_scores")
        .select(
          "attempt_id,listening_band,reading_band,writing_band,speaking_band,overall_band,provisional_band,overall_is_provisional,score_source,computed_at",
        )
        .eq("club_id", clubId)
        .in("attempt_id", chunks[0])
        .order("attempt_id")
        .range(from, to),
    ),
    readChunkedPages([attemptIds], (chunks, from, to) =>
      db
        .from("attempt_band_scores")
        .select(
          "attempt_id,listening_band,reading_band,writing_band,speaking_band,overall_band,computed_at,created_at",
        )
        .in("attempt_id", chunks[0])
        .order("id")
        .range(from, to),
    ),
    readChunkedPages([attemptIds], (chunks, from, to) =>
      db
        .from("ielts_teacher_reviews")
        .select(
          "id,attempt_id,user_id,writing_response_id,speaking_response_id,revision,status",
        )
        .eq("club_id", clubId)
        .in("attempt_id", chunks[0])
        .order("id")
        .range(from, to),
    ),
    readChunkedPages([attempts.map((row) => row.test_id)], (chunks, from, to) =>
      db
        .from("ielts_tests")
        .select("id,kind,skill")
        .in("id", chunks[0])
        .order("id")
        .range(from, to),
    ),
  ]);
  const writing = requireRows(writingResult, "writing responses");
  const speaking = requireRows(speakingResult, "speaking responses");
  const effective = new Map(
    requireRows(effectiveResult, "effective scores").map((row) => [
      row.attempt_id,
      row,
    ]),
  );
  const ai = new Map(
    requireRows(aiResult, "AI scores").map((row) => [row.attempt_id, row]),
  );
  const reviews = requireRows(reviewsResult, "teacher reviews");
  const tests = new Map(
    requireRows(testsResult, "tests").map((row) => [row.id, row]),
  );
  const responses = [
    ...writing.map((row) => ({
      ...row,
      skill: "writing" as const,
      taskNumber: row.task_number,
      aiBand: row.task_band,
    })),
    ...speaking.map((row) => ({
      ...row,
      skill: "speaking" as const,
      taskNumber: undefined,
      aiBand: row.speaking_band,
    })),
  ].filter((row) => byAttempt.get(row.attempt_id)?.user_id === row.user_id);
  const responseIds = responses.map((row) => row.id);
  const [evidenceResult, reviewEventsResult] = await Promise.all([
    // The privileged table is never queried with caller-provided learner/response IDs.
    readChunkedPages([responseIds], (chunks, from, to) =>
      trusted
        .from("ielts_criterion_evidence")
        .select(
          "response_id,user_id,attempt_id,revision,source_response_revision,criterion,stage,run_id,created_at",
        )
        .in("response_id", chunks[0])
        .lte("created_at", period.end)
        .order("id")
        .range(from, to),
    ),
    readChunkedPages([reviews.map((row) => row.id)], (chunks, from, to) =>
      db
        .from("ielts_teacher_review_events")
        .select("id,review_id,revision,created_at,actor_id,to_status")
        .in("review_id", chunks[0])
        .eq("to_status", "published")
        .lte("created_at", period.end)
        .order("created_at")
        .order("id")
        .range(from, to),
    ),
  ]);
  const evidence = requireRows(evidenceResult, "AI grading evidence");
  const reviewEvents = requireRows(reviewEventsResult, "published reviews");
  const events: CentreEventFact[] = [];
  const gradeDatesByAttempt = new Map<string, string[]>();
  for (const response of responses) {
    const attempt = byAttempt.get(response.attempt_id)!;
    if (!attempt.class_id || !attempt.assignment_id) continue;
    const proofByRevisionStage = new Map<string, Map<string, string>>();
    for (const item of evidence.filter(
      (row) =>
        row.response_id === response.id &&
        row.user_id === response.user_id &&
        row.attempt_id === response.attempt_id &&
        row.source_response_revision === row.revision &&
        (row.stage === "provisional" || row.stage === "adjudicated"),
    )) {
      const key = `${item.revision}:${item.stage}:${item.run_id}`;
      const criteria =
        proofByRevisionStage.get(key) ?? new Map<string, string>();
      const prior = criteria.get(item.criterion);
      if (!prior || item.created_at < prior)
        criteria.set(item.criterion, item.created_at);
      proofByRevisionStage.set(key, criteria);
    }
    const completedProofs = [...proofByRevisionStage.entries()]
      .filter(([, criteria]) => criteria.size >= 4)
      .map(([key, criteria]) => ({
        key,
        at: [...criteria.values()].sort().at(-1)!,
      }));
    const firstAi =
      completedProofs.map((proof) => proof.at).sort()[0] ??
      (response.aiBand !== null ? response.scored_at : null);
    if (firstAi)
      events.push({
        id: response.id,
        kind: "ai-grading",
        occurredAt: firstAi,
        responseId: response.id,
        learnerId: response.user_id,
        classId: attempt.class_id,
        skill: response.skill,
        taskNumber: response.taskNumber,
        status: "scored",
      });
    const matchingReviews = new Set(
      reviews
        .filter(
          (review) =>
            review.user_id === response.user_id &&
            review.attempt_id === response.attempt_id &&
            (review.writing_response_id === response.id ||
              review.speaking_response_id === response.id),
        )
        .map((review) => review.id),
    );
    const publications = reviewEvents.filter((event) =>
      matchingReviews.has(event.review_id),
    );
    const revisions = new Set([
      response.revision,
      ...completedProofs.map((proof) => Number(proof.key.split(":")[0])),
      ...publications.map((event) => event.revision),
    ]);
    for (const revision of [...revisions]
      .filter((value) => value <= response.revision)
      .sort((a, b) => a - b)) {
      const revisionAi =
        completedProofs
          .filter((proof) => proof.key.startsWith(`${revision}:`))
          .map((proof) => proof.at)
          .sort()[0] ??
        (revision === response.revision &&
        response.aiBand !== null &&
        (response.status === "scored" || response.status === "overridden")
          ? response.scored_at
          : null);
      const firstTeacher = publications
        .filter((event) => event.revision === revision)
        .sort(
          (a, b) =>
            a.created_at.localeCompare(b.created_at) ||
            a.id.localeCompare(b.id),
        )[0];
      const feedbackAt = [revisionAi, firstTeacher?.created_at]
        .filter((value): value is string => Boolean(value))
        .sort()[0];
      // Earlier revised submission timestamps are not retained by the response table.
      const submittedAt =
        revision === 0
          ? attempt.submitted_at
          : revision === response.revision
            ? response.revision_consumed_at
            : null;
      const id = `ielts:${response.id}:${revision}`;
      events.push({
        id,
        kind: "feedback",
        revision,
        responseId: response.id,
        classId: attempt.class_id,
        learnerId: response.user_id,
        assignmentId: attempt.assignment_id,
        occurredAt: feedbackAt ?? period.end,
        status: feedbackAt ? "published" : "pending",
        turnedAroundHours:
          feedbackAt && submittedAt
            ? Math.max(
                0,
                (Date.parse(feedbackAt) - Date.parse(submittedAt)) / 3_600_000,
              )
            : null,
      });
      // Recorded teacher work remains visible when AI published the first feedback.
      if (firstTeacher)
        events.push({
          id,
          kind: "teacher-review",
          revision,
          responseId: response.id,
          classId: attempt.class_id,
          learnerId: response.user_id,
          teacherId: firstTeacher.actor_id,
          occurredAt: firstTeacher.created_at,
          status: "published",
        });
      if (revision === response.revision && feedbackAt)
        gradeDatesByAttempt.set(attempt.id, [
          ...(gradeDatesByAttempt.get(attempt.id) ?? []),
          feedbackAt,
        ]);
    }
  }
  for (const attempt of attempts) {
    if (!attempt.class_id || !attempt.assignment_id || !attempt.submitted_at)
      continue;
    events.push({
      id: attempt.id,
      kind: "activity",
      learnerId: attempt.user_id,
      classId: attempt.class_id,
      occurredAt: attempt.submitted_at,
    });
    const test = tests.get(attempt.test_id);
    if (!test || test.kind !== "full_mock") continue;
    const score = projectEffectiveBands(
      effective.get(attempt.id),
      ai.get(attempt.id),
    );
    const skillBands: Record<IeltsSkill, number | null> = {
      listening: score.listeningBand,
      reading: score.readingBand,
      writing: score.writingBand,
      speaking: score.speakingBand,
    };
    if (Object.values(skillBands).some((value) => value === null)) continue;
    const scoredAt = [
      ...(gradeDatesByAttempt.get(attempt.id) ?? []),
      ai.get(attempt.id)?.computed_at ??
        ai.get(attempt.id)?.created_at ??
        attempt.completed_at ??
        attempt.submitted_at,
    ]
      .sort()
      .at(-1)!;
    events.push({
      id: attempt.id,
      kind: "mock",
      classId: attempt.class_id,
      learnerId: attempt.user_id,
      assignmentId: attempt.assignment_id,
      occurredAt: scoredAt,
      status: "graded",
      stage:
        score.scoreSource === "teacher_confirmed" && !score.overallIsProvisional
          ? "confirmed"
          : "provisional",
    });
  }
  return events;
}
