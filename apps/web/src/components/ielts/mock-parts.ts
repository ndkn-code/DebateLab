/**
 * Build the navigable "parts" of a timed section (WS-2.1). Reading splits by
 * passage, Listening by listening-section (each with its audio); Writing/
 * Speaking expose their prompts directly. Pure — no React — so it is trivially
 * checkable and reused by the section view.
 */
import type { MockStructure } from "@/lib/api/ielts/mock-repository";
import type {
  IeltsQuestionView,
  IeltsSkill,
} from "@/lib/ielts/question-contract";
import { publicListeningAudioUrl } from "@/lib/ielts/listening-audio/storage-paths";
import type { ListeningAudioTrack } from "./ListeningAudioPlayer";

export interface MockPart {
  id: string;
  title: string;
  body: string | null;
  audio: ListeningAudioTrack[];
  questions: IeltsQuestionView[];
}

function questionsFor(
  structure: MockStructure,
  predicate: (question: IeltsQuestionView) => boolean,
): IeltsQuestionView[] {
  return structure.questions.filter(predicate);
}

function readingParts(structure: MockStructure): MockPart[] {
  return structure.passages.map((passage) => ({
    id: passage.id,
    title: passage.title,
    body: passage.body,
    audio: [],
    questions: questionsFor(structure, (q) => q.passageId === passage.id),
  }));
}

function listeningParts(
  structure: MockStructure,
  supabaseUrl: string | undefined,
): MockPart[] {
  const audioById = new Map(structure.audioAssets.map((asset) => [asset.id, asset]));
  return structure.listeningSections.map((listening) => {
    const asset = listening.audio_asset_id
      ? audioById.get(listening.audio_asset_id)
      : undefined;
    // Play only a READY asset, and resolve its bucket path to a public,
    // cache-busted URL — `storage_path` alone is bucket-relative (not playable).
    const src =
      asset && asset.status === "ready"
        ? publicListeningAudioUrl(supabaseUrl, asset.storage_path, asset.version)
        : null;
    const track: ListeningAudioTrack = {
      id: listening.id,
      label: listening.title ?? `Section ${listening.section_number}`,
      src,
    };
    return {
      id: listening.id,
      title: listening.title ?? `Section ${listening.section_number}`,
      body: null,
      audio: [track],
      questions: questionsFor(structure, (q) => q.listeningSectionId === listening.id),
    };
  });
}

const SPEAKING_PART_DEFINITIONS: Array<{
  id: string;
  title: string;
  questionType: IeltsQuestionView["questionType"];
}> = [
  { id: "speaking-part-1", title: "Part 1: Interview", questionType: "speaking_part1" },
  { id: "speaking-part-2", title: "Part 2: Cue card", questionType: "speaking_part2_cuecard" },
  { id: "speaking-part-3", title: "Part 3: Discussion", questionType: "speaking_part3" },
];

function speakingParts(structure: MockStructure): MockPart[] {
  return SPEAKING_PART_DEFINITIONS.map((part) => ({
    id: part.id,
    title: part.title,
    body: null,
    audio: [],
    questions: questionsFor(
      structure,
      (q) => q.skill === "speaking" && q.questionType === part.questionType,
    ),
  }));
}

function unlinkedPart(
  structure: MockStructure,
  skill: IeltsSkill,
  used: Set<string>,
): MockPart | null {
  const leftovers = questionsFor(
    structure,
    (q) => q.skill === skill && !used.has(q.id),
  );
  if (leftovers.length === 0) return null;
  return {
    id: `${skill}-unlinked`,
    title: skill === "writing" || skill === "speaking" ? "Tasks" : "More questions",
    body: null,
    audio: [],
    questions: leftovers,
  };
}

/**
 * Ordered, navigable parts for the given skill section. `supabaseUrl`
 * (`NEXT_PUBLIC_SUPABASE_URL`) resolves Listening audio storage paths to public
 * URLs; pass it from the caller so this stays pure + testable.
 */
export function buildSectionParts(
  structure: MockStructure,
  skill: IeltsSkill,
  supabaseUrl?: string,
): MockPart[] {
  const parts =
    skill === "reading"
      ? readingParts(structure)
      : skill === "listening"
        ? listeningParts(structure, supabaseUrl)
        : skill === "speaking"
          ? speakingParts(structure)
          : [];
  const used = new Set(parts.flatMap((part) => part.questions.map((q) => q.id)));
  const trailing = unlinkedPart(structure, skill, used);
  return trailing ? [...parts, trailing] : parts;
}
