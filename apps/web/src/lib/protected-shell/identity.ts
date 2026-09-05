import type { User } from "@supabase/supabase-js";
import { classifyAuthError } from "@/lib/supabase/request-policy";
import { withinDeadline } from "./deadline";

type IdentityResponse = { data: { user: User | null }; error: unknown };
export type VerifiedIdentity =
  | { status: "authenticated"; user: User }
  | { status: "anonymous" }
  | { status: "unavailable" };

/** Adapted from Lumist lib/supabase/utils.ts:141-180. Never trust a session payload. */
export async function verifyIdentity(
  getUser: () => PromiseLike<IdentityResponse>,
  timeoutMs = 4_000,
): Promise<VerifiedIdentity> {
  try {
    const { data, error } = await withinDeadline(getUser, timeoutMs);
    if (error) {
      const missing = (error as { name?: string }).name === "AuthSessionMissingError";
      return { status: missing || classifyAuthError(error) === "invalid" ? "anonymous" : "unavailable" };
    }
    return data.user ? { status: "authenticated", user: data.user } : { status: "anonymous" };
  } catch {
    return { status: "unavailable" };
  }
}
