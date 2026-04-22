import { CATEGORIES, topics } from "@/lib/topics";
import type { AiDifficulty, DebateTopic, PracticeTrack } from "@/types";

export type PracticeMode = "quick" | "full";
export type PracticeSide = "proposition" | "opposition" | "random";

export interface PracticePrefill {
  topicTitle: string;
  topicCategory?: string;
  topicDescription?: string;
  practiceTrack?: PracticeTrack;
  mode?: PracticeMode;
  aiDifficulty?: AiDifficulty;
  side?: PracticeSide;
}

export interface PracticeQueryPrefill {
  topicTitle?: string;
  topicCategory?: string;
  topicDescription?: string;
  practiceTrack?: PracticeTrack;
  mode?: PracticeMode;
  aiDifficulty?: AiDifficulty;
  side?: PracticeSide;
}

const CATEGORY_SET = new Set<string>(CATEGORIES);
const DEFAULT_CATEGORY = CATEGORIES[0];

function normalizeText(value: string) {
  return value.trim().toLowerCase();
}

function isCategory(value?: string | null): value is (typeof CATEGORIES)[number] {
  return !!value && CATEGORY_SET.has(value);
}

function parsePracticeTrack(value?: string | null): PracticeTrack | undefined {
  return value === "speaking" || value === "debate" ? value : undefined;
}

function parseMode(value?: string | null): PracticeMode | undefined {
  return value === "quick" || value === "full" ? value : undefined;
}

function parseAiDifficulty(value?: string | null): AiDifficulty | undefined {
  return value === "easy" || value === "medium" || value === "hard"
    ? value
    : undefined;
}

function parseSide(value?: string | null): PracticeSide | undefined {
  return value === "proposition" ||
    value === "opposition" ||
    value === "random"
    ? value
    : undefined;
}

function toTopicDifficulty(
  aiDifficulty?: AiDifficulty
): DebateTopic["difficulty"] {
  if (aiDifficulty === "hard") return "advanced";
  if (aiDifficulty === "medium") return "intermediate";
  return "beginner";
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function findPracticeTopicByTitle(title?: string | null) {
  if (!title) return undefined;
  const normalizedTitle = normalizeText(title);
  return topics.find((topic) => normalizeText(topic.title) === normalizedTitle);
}

export function resolvePracticeTopic(prefill: PracticePrefill): DebateTopic {
  const existingTopic = findPracticeTopicByTitle(prefill.topicTitle);
  if (existingTopic) return existingTopic;

  const category = isCategory(prefill.topicCategory)
    ? prefill.topicCategory
    : DEFAULT_CATEGORY;

  return {
    id: `prefill-${slugify(prefill.topicTitle)}`,
    title: prefill.topicTitle,
    category,
    difficulty: toTopicDifficulty(prefill.aiDifficulty),
    context: prefill.topicDescription,
  };
}

export function readPracticePrefill(
  searchParams: URLSearchParams
): PracticeQueryPrefill | null {
  const topicTitle = searchParams.get("topic");
  const topicCategory = searchParams.get("category") ?? undefined;
  const topicDescription = searchParams.get("description") ?? undefined;
  const practiceTrack = parsePracticeTrack(searchParams.get("track"));
  const mode = parseMode(searchParams.get("mode"));
  const aiDifficulty = parseAiDifficulty(searchParams.get("difficulty"));
  const side = parseSide(searchParams.get("side"));

  if (
    !topicTitle &&
    !topicCategory &&
    !topicDescription &&
    !practiceTrack &&
    !mode &&
    !aiDifficulty &&
    !side
  ) {
    return null;
  }

  return {
    topicTitle: topicTitle ?? undefined,
    topicCategory,
    topicDescription,
    practiceTrack,
    mode,
    aiDifficulty,
    side,
  };
}

export function buildPracticeHref(prefill: PracticePrefill) {
  const searchParams = new URLSearchParams();
  searchParams.set("topic", prefill.topicTitle);

  if (prefill.topicCategory) {
    searchParams.set("category", prefill.topicCategory);
  }

  if (prefill.topicDescription) {
    searchParams.set("description", prefill.topicDescription);
  }

  if (prefill.practiceTrack) {
    searchParams.set("track", prefill.practiceTrack);
  }

  if (prefill.mode) {
    searchParams.set("mode", prefill.mode);
  }

  if (prefill.aiDifficulty) {
    searchParams.set("difficulty", prefill.aiDifficulty);
  }

  if (prefill.side) {
    searchParams.set("side", prefill.side);
  }

  return `/practice?${searchParams.toString()}`;
}
