import assert from "node:assert/strict";
import {
  buildHighlightSegments,
  MOCK_ANNOTATION_PERSIST_DEBOUNCE_MS,
  mockAnnotationKey,
  useMockAnnotationsStore,
  type Highlight,
} from "./mockAnnotationsStore";

class MemoryLocalStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  clear(): void {
    this.values.clear();
  }
}

const localStorage = new MemoryLocalStorage();

Object.defineProperty(globalThis, "window", {
  value: { localStorage },
  configurable: true,
});

function resetStore(): void {
  useMockAnnotationsStore.setState({
    activeAttemptId: null,
    highlights: {},
    eliminations: {},
  });
  localStorage.clear();
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function main() {
  const overlapping: Highlight[] = [
    { id: "h1", start: 1, end: 4, color: "yellow" },
    { id: "h2", start: 2, end: 5, color: "blue" },
  ];
  assert.deepEqual(
    buildHighlightSegments("abcdef", overlapping).map((segment) => [
      segment.text,
      segment.highlight?.id ?? null,
    ]),
    [
      ["a", null],
      ["b", "h1"],
      ["cd", "h2"],
      ["e", "h2"],
      ["f", null],
    ],
  );

  resetStore();
  const attemptId = "attempt-1";
  const passageKey = "passage-1";
  const questionId = "question-1";
  const optionId = "choice-a";
  const highlightKey = mockAnnotationKey(attemptId, passageKey);
  const eliminationKey = mockAnnotationKey(attemptId, questionId);

  useMockAnnotationsStore.getState().hydrateAttempt(attemptId);
  const added = useMockAnnotationsStore
    .getState()
    .addHighlight(passageKey, 8, 3, "green");
  assert.ok(added);
  assert.equal(added.start, 3);
  assert.equal(added.end, 8);

  useMockAnnotationsStore.getState().toggleElimination(questionId, optionId);
  assert.equal(
    useMockAnnotationsStore.getState().eliminations[eliminationKey]?.has(optionId),
    true,
  );

  await delay(MOCK_ANNOTATION_PERSIST_DEBOUNCE_MS + 25);
  const persisted = JSON.parse(
    localStorage.getItem(`ielts-mock-annotations-${attemptId}`) ?? "{}",
  ) as { highlights?: Record<string, Highlight[]> };
  assert.equal(persisted.highlights?.[highlightKey]?.length, 1);
  assert.equal(JSON.stringify(persisted).includes(optionId), false);

  useMockAnnotationsStore.getState().clearActiveAttempt();
  assert.equal(useMockAnnotationsStore.getState().activeAttemptId, null);
  assert.equal(useMockAnnotationsStore.getState().eliminations[eliminationKey], undefined);

  useMockAnnotationsStore.setState({
    activeAttemptId: null,
    highlights: {},
    eliminations: {},
  });
  useMockAnnotationsStore.getState().hydrateAttempt(attemptId);
  assert.equal(useMockAnnotationsStore.getState().highlights[highlightKey]?.length, 1);
  assert.equal(useMockAnnotationsStore.getState().eliminations[eliminationKey], undefined);

  useMockAnnotationsStore.getState().clearHighlights(passageKey);
  await delay(MOCK_ANNOTATION_PERSIST_DEBOUNCE_MS + 25);
  assert.equal(localStorage.getItem(`ielts-mock-annotations-${attemptId}`), null);

  console.log("mockAnnotationsStore tests passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
