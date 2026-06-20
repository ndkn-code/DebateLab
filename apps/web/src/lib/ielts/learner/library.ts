/**
 * Pure test-library helpers for the IELTS learner shell (WS-5.1).
 *
 * Maps a published `ielts_tests` row into a serialisable card the library + home
 * render, and the (client-side) filter over those cards. No DB or React here.
 */
import type { Database, Tables } from "@/types/supabase";

type IeltsModule = Database["public"]["Enums"]["ielts_module"];
type IeltsTestKind = Database["public"]["Enums"]["ielts_test_kind"];
type IeltsSkill = Database["public"]["Enums"]["ielts_skill"];

export type LibraryTestRow = Pick<
  Tables<"ielts_tests">,
  "id" | "title" | "slug" | "description" | "module" | "kind" | "skill" | "time_limit_seconds"
>;

export interface IeltsTestCard {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  module: IeltsModule;
  kind: IeltsTestKind;
  /** Skills the card advertises (all four for a full mock; the lone skill otherwise). */
  skills: IeltsSkill[];
  durationMinutes: number | null;
  startHref: string;
}

const FULL_MOCK_SKILLS: readonly IeltsSkill[] = [
  "listening",
  "reading",
  "writing",
  "speaking",
];

/** Skills to advertise for a test: the four for a full mock, else its lone skill. */
export function testCardSkills(
  test: Pick<LibraryTestRow, "kind" | "skill">,
): IeltsSkill[] {
  if (test.kind === "full_mock") return [...FULL_MOCK_SKILLS];
  return test.skill ? [test.skill] : [];
}

export function toTestCard(test: LibraryTestRow): IeltsTestCard {
  return {
    id: test.id,
    title: test.title,
    slug: test.slug,
    description: test.description,
    module: test.module,
    kind: test.kind,
    skills: testCardSkills(test),
    durationMinutes:
      test.time_limit_seconds && test.time_limit_seconds > 0
        ? Math.round(test.time_limit_seconds / 60)
        : null,
    // The mock player owns attempt creation; the library just links into it.
    startHref: `/ielts/mock/${test.slug}`,
  };
}

/** Filter axis for the library: everything, full mocks, or by a single skill. */
export type IeltsLibraryFilter = "all" | "full_mock" | IeltsSkill;

/** Ordered filter chips for the library UI (labels are resolved via i18n). */
export const IELTS_LIBRARY_FILTERS: readonly IeltsLibraryFilter[] = [
  "all",
  "full_mock",
  "listening",
  "reading",
  "writing",
  "speaking",
];

export function filterTestCards(
  cards: IeltsTestCard[],
  filter: IeltsLibraryFilter,
): IeltsTestCard[] {
  if (filter === "all") return cards;
  if (filter === "full_mock") return cards.filter((card) => card.kind === "full_mock");
  return cards.filter((card) => card.skills.includes(filter));
}

/** Filters that actually match ≥1 card — so the UI never shows a dead chip. */
export function availableLibraryFilters(
  cards: IeltsTestCard[],
): IeltsLibraryFilter[] {
  return IELTS_LIBRARY_FILTERS.filter(
    (filter) => filter === "all" || filterTestCards(cards, filter).length > 0,
  );
}
