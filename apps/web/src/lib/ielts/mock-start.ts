interface StartableAttemptState {
  attempt: { id: string };
  sections: Array<{ id: string; started_at: string | null }>;
}

interface PrepareMockAttemptStartInput<T extends StartableAttemptState> {
  retainedAttempt: T | null;
  createAttempt: () => Promise<T>;
  retainAttempt: (attempt: T) => void;
  enterFirstSection: (input: {
    attemptId: string;
    sectionId: string;
  }) => Promise<T>;
}

/**
 * Creates an attempt at most once and retains it before entering its first
 * section. If section entry fails, the caller can retry with retainedAttempt
 * instead of creating a duplicate sitting.
 */
export async function prepareMockAttemptStart<T extends StartableAttemptState>({
  retainedAttempt,
  createAttempt,
  retainAttempt,
  enterFirstSection,
}: PrepareMockAttemptStartInput<T>): Promise<{
  startedAttempt: T;
  readyAttempt: T;
}> {
  const startedAttempt = retainedAttempt ?? (await createAttempt());
  retainAttempt(startedAttempt);

  const firstSection = startedAttempt.sections[0];
  const readyAttempt =
    firstSection && firstSection.started_at === null
      ? await enterFirstSection({
          attemptId: startedAttempt.attempt.id,
          sectionId: firstSection.id,
        })
      : startedAttempt;

  return { startedAttempt, readyAttempt };
}
