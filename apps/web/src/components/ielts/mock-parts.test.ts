import assert from "node:assert/strict";
import type { Tables } from "@/types/supabase";
import type { MockStructure } from "@/lib/api/ielts/mock-repository";
import type { IeltsQuestionView } from "@/lib/ielts/question-contract";
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

function structure(over: Partial<MockStructure>): MockStructure {
  return {
    test: {} as Tables<"ielts_tests">,
    passages: [],
    listeningSections: [],
    audioAssets: [],
    questions: [],
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

  // --- PENDING/queued asset → no src (player shows "being prepared") ---------
  const pending = structure({
    listeningSections: [section({ id: "sec-1", audio_asset_id: "asset-1" })],
    audioAssets: [asset({ id: "asset-1", status: "pending", version: 1, storage_path: null })],
  });
  assert.equal(buildSectionParts(pending, "listening", SUPABASE_URL)[0].audio[0].src, null);

  // --- section with no linked asset → no src --------------------------------
  const none = structure({
    listeningSections: [section({ id: "sec-1", audio_asset_id: null })],
  });
  assert.equal(buildSectionParts(none, "listening", SUPABASE_URL)[0].audio[0].src, null);

  // --- missing supabaseUrl → no src even when ready (can't build a URL) ------
  assert.equal(buildSectionParts(ready, "listening", undefined)[0].audio[0].src, null);

  console.log("ielts/components/mock-parts tests passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
