interface FrozenObjectiveBlueprintState {
  frozen: boolean;
  objectiveSectionCount: number;
  objectiveBlueprintCount: number;
}

/**
 * A frozen attempt is corrupt only when it contains an objective section but
 * none of that section's questions were snapshotted. Writing- or
 * Speaking-only practices legitimately have no Listening/Reading blueprint.
 */
export function isFrozenObjectiveBlueprintMissing(
  state: FrozenObjectiveBlueprintState,
): boolean {
  return (
    state.frozen &&
    state.objectiveSectionCount > 0 &&
    state.objectiveBlueprintCount === 0
  );
}
