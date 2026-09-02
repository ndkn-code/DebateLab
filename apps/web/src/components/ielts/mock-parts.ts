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
import type { IeltsQuestionGroupView } from "@/lib/ielts/question-types/groups";
import { publicListeningAudioUrl } from "@/lib/ielts/listening-audio/storage-paths";
import type {
  ListeningAudioReadiness,
  ListeningAudioTrack,
} from "./ListeningAudioPlayer";

export interface MockPart {
  id: string;
  title: string;
  body: string | null;
  audio: ListeningAudioTrack[];
  questions: IeltsQuestionView[];
  /**
   * Set-level question groups (shared bank / summary / table / diagram) that
   * belong to this part, in `order_index` order. Empty for legacy content.
   */
  groups: IeltsQuestionGroupView[];
}

/** Groups declared on the structure — tolerant of legacy snapshots without the field. */
function structureGroups(structure: MockStructure): IeltsQuestionGroupView[] {
  return (structure as Partial<MockStructure>).questionGroups ?? [];
}

/**
 * Groups for a part: matched by anchor (`passageId` / `listeningSectionId`)
 * when the part has one, else by membership overlap (writing, speaking, and
 * the trailing "unlinked" bucket have no anchor column).
 */
function groupsFor(
  structure: MockStructure,
  questions: readonly IeltsQuestionView[],
  anchor: { passageId?: string; listeningSectionId?: string } = {},
): IeltsQuestionGroupView[] {
  const memberIds = new Set(questions.map((question) => question.id));
  return structureGroups(structure)
    .filter((group) => {
      if (anchor.passageId) return group.passageId === anchor.passageId;
      if (anchor.listeningSectionId) {
        return group.listeningSectionId === anchor.listeningSectionId;
      }
      return group.questionIds.some((id) => memberIds.has(id));
    })
    .sort((a, b) => a.orderIndex - b.orderIndex);
}

/** Frozen/live asset status → what the player should say when it cannot play. */
function audioReadiness(
  asset: MockStructure["audioAssets"][number] | undefined,
  src: string | null,
): ListeningAudioReadiness {
  if (src) return "ready";
  if (asset && (asset.status === "pending" || asset.status === "generating")) {
    return "pending";
  }
  return "unavailable";
}

function questionsFor(
  structure: MockStructure,
  predicate: (question: IeltsQuestionView) => boolean,
): IeltsQuestionView[] {
  return structure.questions.filter(predicate);
}

function readingParts(structure: MockStructure): MockPart[] {
  return structure.passages.map((passage) => {
    const questions = questionsFor(structure, (q) => q.passageId === passage.id);
    return {
      id: passage.id,
      title: passage.title,
      body: passage.body,
      audio: [],
      questions,
      groups: groupsFor(structure, questions, { passageId: passage.id }),
    };
  });
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
      readiness: audioReadiness(asset, src),
    };
    const questions = questionsFor(
      structure,
      (q) => q.listeningSectionId === listening.id,
    );
    return {
      id: listening.id,
      title: listening.title ?? `Section ${listening.section_number}`,
      body: null,
      audio: [track],
      questions,
      groups: groupsFor(structure, questions, { listeningSectionId: listening.id }),
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
  return SPEAKING_PART_DEFINITIONS.map((part) => {
    const questions = questionsFor(
      structure,
      (q) => q.skill === "speaking" && q.questionType === part.questionType,
    );
    return {
      id: part.id,
      title: part.title,
      body: null,
      audio: [],
      questions,
      groups: groupsFor(structure, questions),
    };
  });
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
    groups: groupsFor(structure, leftovers),
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
