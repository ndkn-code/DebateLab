/**
 * RevenueCat app_user_id → canonical user resolution (WS-4.1, scaffold).
 *
 * Anti-spoof: only UUID-shaped ids are eligible candidates — a compromised
 * mobile client must not be able to activate premium for an arbitrary id. Actual
 * existence is verified against `profiles` in the repository (injected), so this
 * stays pure and unit-testable.
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuidShaped(id: string | null | undefined): id is string {
  return typeof id === "string" && UUID_RE.test(id);
}

/**
 * UUID-shaped candidate user ids from a RevenueCat event, in priority order
 * (app_user_id before original_app_user_id), de-duplicated. Each must still be
 * confirmed to exist before it is trusted.
 */
export function candidateUserIds(
  appUserId: string | null | undefined,
  originalAppUserId: string | null | undefined,
): string[] {
  const out: string[] = [];
  for (const id of [appUserId, originalAppUserId]) {
    if (isUuidShaped(id) && !out.includes(id)) {
      out.push(id);
    }
  }
  return out;
}
