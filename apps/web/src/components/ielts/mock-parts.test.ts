import assert from "node:assert/strict";
import type { Tables } from "@/types/supabase";
import type { MockStructure } from "@/lib/api/ielts/mock-repository";
import type { IeltsQuestionView } from "@/lib/ielts/question-contract";
import type { IeltsQuestionGroupView } from "@/lib/ielts/question-types/groups";
import { assignQuestionNumbers } from "@/lib/ielts/question-groups";
import { buildSectionParts } from "./mock-parts";

const SUPABASE_URL = "https://demo.supabase.co";

function asset(over: Partial<Tables<"audio_assets">>): Tables<"audio_assets"> {
  return {
    id: "asset-1",
    status: "ready",
    storage_path: "sections/sec-1.mp3",
    version: 3,
    ...over,
  } as unknown as Tables<"audio_assets">;
}

function section(
  over: Partial<Tables<"listening_sections">>,
): Tables<"listening_sections"> {
  return {
    id: "sec-1",
    section_number: 1,
    title: "Section 1",
    audio_asset_id: null,
    ...over,
  } as unknown as Tables<"listening_sections">;
}

function listeningQuestion(id: string, sectionId: string): IeltsQuestionView {
  return { id, skill: "listening", listeningSectionId: sectionId } as unknown as IeltsQuestionView;
}

function speakingQuestion(
  id: string,
  questionType: IeltsQuestionView["questionType"],
): IeltsQuestionView {
  return { id, skill: "speaking", questionType } as unknown as IeltsQuestionView;
}

function readingQuestion(
  id: string,
  passageId: string,
  extra: Record<string, unknown> = {},
): IeltsQuestionView {
  return { id, skill: "reading", passageId, ...extra } as unknown as IeltsQuestionView;
}

function group(over: Partial<IeltsQuestionGroupView>): IeltsQuestionGroupView {
  return {
    id: "g1",
    groupKey: "g1",
    skill: "reading",
    passageId: null,
    listeningSectionId: null,
    orderIndex: 0,
    title: null,
    instructions: null,
    stimulus: null,
    bank: [],
    bankReuse: false,
    answerMode: null,
    anyOrder: false,
    questionIds: [],
    slotByQuestionId: {},
    ...over,
  };
}

function structure(over: Partial<MockStructure>): MockStructure {
  return {
    test: {} as Tables<"ielts_tests">,
    passages: [],
    listeningSections: [],
    audioAssets: [],
    questions: [],
    questionGroups: [],
    ...over,
  } as MockStructure;
}

async function main() {
  // --- READY asset → src is the public, cache-busted URL (not the raw path) --
  const ready = structure({
    listeningSections: [section({ id: "sec-1", audio_asset_id: "asset-1" })],
    audioAssets: [asset({ id: "asset-1", status: "ready", version: 3, storage_path: "sections/sec-1.mp3" })],
    questions: [listeningQuestion("q1", "sec-1")],
  });
  const parts = buildSectionParts(ready, "listening", SUPABASE_URL);
  assert.equal(parts.length, 1);
  const track = parts[0].audio[0];
  assert.equal(
    track.src,
    `${SUPABASE_URL}/storage/v1/object/public/ielts-listening-audio/sections/sec-1.mp3?v=3`,
  );
  // The raw storage_path must never leak through as the src.
  assert.notEqual(track.src, "sections/sec-1.mp3");
  assert.equal(parts[0].questions.length, 1); // questions still wire to the section
  assert.equal(track.readiness, "ready");

  // --- PENDING/queued asset → no src (player shows "being prepared") ---------
  const pending = structure({
    listeningSections: [section({ id: "sec-1", audio_asset_id: "asset-1" })],
    audioAssets: [asset({ id: "asset-1", status: "pending", version: 1, storage_path: null })],
  });
  const pendingTrack = buildSectionParts(pending, "listening", SUPABASE_URL)[0].audio[0];
  assert.equal(pendingTrack.src, null);
  assert.equal(pendingTrack.readiness, "pending");

  // --- FAILED asset → unavailable (not "try again shortly") ------------------
  const failed = structure({
    listeningSections: [section({ id: "sec-1", audio_asset_id: "asset-1" })],
    audioAssets: [asset({ id: "asset-1", status: "failed", version: 1, storage_path: null })],
  });
  assert.equal(
    buildSectionParts(failed, "listening", SUPABASE_URL)[0].audio[0].readiness,
    "unavailable",
  );

  // --- section with no linked asset → no src --------------------------------
  const none = structure({
    listeningSections: [section({ id: "sec-1", audio_asset_id: null })],
  });
  const noneTrack = buildSectionParts(none, "listening", SUPABASE_URL)[0].audio[0];
  assert.equal(noneTrack.src, null);
  assert.equal(noneTrack.readiness, "unavailable");

  // --- missing supabaseUrl → no src even when ready (can't build a URL) ------
  assert.equal(buildSectionParts(ready, "listening", undefined)[0].audio[0].src, null);

  // --- Groups attach to their anchored part (passage / listening section) ---
  const grouped = structure({
    passages: [
      { id: "p1", title: "Passage 1", body: "…", order_index: 0 },
      { id: "p2", title: "Passage 2", body: "…", order_index: 1 },
    ],
    questions: [
      readingQuestion("r1", "p1"),
      readingQuestion("r2", "p1"),
      readingQuestion("r3", "p2"),
    ],
    questionGroups: [
      group({ id: "g-late", groupKey: "late", passageId: "p1", orderIndex: 5, questionIds: ["r2"] }),
      group({ id: "g-early", groupKey: "early", passageId: "p1", orderIndex: 1, questionIds: ["r1"] }),
      group({ id: "g-p2", groupKey: "p2", passageId: "p2", orderIndex: 0, questionIds: ["r3"] }),
    ],
  });
  const groupedParts = buildSectionParts(grouped, "reading", SUPABASE_URL);
  assert.deepEqual(
    groupedParts.map((part) => part.groups.map((g) => g.id)),
    [["g-early", "g-late"], ["g-p2"]],
  );
  // Listening groups anchor by listening section id.
  const listeningGrouped = structure({
    listeningSections: [section({ id: "sec-1" }), section({ id: "sec-2", section_number: 2 })],
    questions: [listeningQuestion("l1", "sec-1"), listeningQuestion("l2", "sec-2")],
    questionGroups: [
      group({ id: "lg-2", skill: "listening", listeningSectionId: "sec-2", questionIds: ["l2"] }),
      group({ id: "lg-1", skill: "listening", listeningSectionId: "sec-1", questionIds: ["l1"] }),
    ],
  });
  assert.deepEqual(
    buildSectionParts(listeningGrouped, "listening", SUPABASE_URL).map((part) =>
      part.groups.map((g) => g.id),
    ),
    [["lg-1"], ["lg-2"]],
  );
  // Legacy structure without the field → empty groups, no throw.
  const legacy = { ...structure({ passages: grouped.passages, questions: grouped.questions }) };
  delete (legacy as Partial<MockStructure>).questionGroups;
  assert.deepEqual(
    buildSectionParts(legacy, "reading", SUPABASE_URL).map((part) => part.groups),
    [[], []],
  );

  // --- Official numbering across parts: a numberSpan row is "21–22", next is 23
  const spanned = structure({
    listeningSections: [
      section({ id: "sec-1" }),
      section({ id: "sec-2", section_number: 2 }),
      section({ id: "sec-3", section_number: 3 }),
    ],
    questions: [
      ...Array.from({ length: 10 }, (_, i) => listeningQuestion(`s1-${i}`, "sec-1")),
      ...Array.from({ length: 10 }, (_, i) => listeningQuestion(`s2-${i}`, "sec-2")),
      { ...listeningQuestion("s3-multi", "sec-3"), metadata: { numberSpan: 2 } } as IeltsQuestionView,
      listeningQuestion("s3-next", "sec-3"),
    ],
  });
  const numbers = assignQuestionNumbers(buildSectionParts(spanned, "listening", SUPABASE_URL));
  assert.equal(numbers.get("s3-multi")?.label, "21–22");
  assert.equal(numbers.get("s3-next")?.label, "23");

  // --- Speaking splits into ordered IELTS parts before the fallback bucket ----
  const speaking = structure({
    questions: [
      speakingQuestion("p1-a", "speaking_part1"),
      speakingQuestion("p3", "speaking_part3"),
      speakingQuestion("p2", "speaking_part2_cuecard"),
      speakingQuestion("p1-b", "speaking_part1"),
      speakingQuestion("legacy", "short_answer"),
    ],
  });
  const speakingParts = buildSectionParts(speaking, "speaking", SUPABASE_URL);
  assert.deepEqual(
    speakingParts.map((part) => part.title),
    ["Part 1: Interview", "Part 2: Cue card", "Part 3: Discussion", "Tasks"],
  );
  assert.deepEqual(
    speakingParts.map((part) => part.questions.map((question) => question.id)),
    [["p1-a", "p1-b"], ["p2"], ["p3"], ["legacy"]],
  );

  console.log("ielts/components/mock-parts tests passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
