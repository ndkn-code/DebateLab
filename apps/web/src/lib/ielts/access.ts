import "server-only";

import { IELTS_ENABLED } from "@/lib/features";
import { isDevAdminBypassEnabled } from "@/lib/dev-admin-bypass";
import { createTypedServerClient } from "@/lib/supabase/server";

interface IeltsViewer {
  userId: string | null;
  isAdmin: boolean;
}

/**
 * Load the current request's viewer (id + admin flag) for IELTS gating.
 *
 * Never throws — a transient auth/profile error resolves to an anonymous,
 * non-admin viewer, so a gate evaluation can only ever *deny* access, never
 * crash the page it guards.
 */
async function loadIeltsViewer(): Promise<IeltsViewer> {
  try {
    const supabase = await createTypedServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { userId: null, isAdmin: false };
    const { data } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    return { userId: user.id, isAdmin: data?.role === "admin" };
  } catch {
    return { userId: null, isAdmin: false };
  }
}

/**
 * Whether the IELTS track is reachable for the current request: launched for
 * everyone via `IELTS_ENABLED`, or the viewer is an admin (pre-launch preview
 * in production). Used by the `/ielts` layout guard.
 *
 * The hot-path subject resolver (`getActiveSubject`) does NOT call this — it
 * threads the same predicate in from a role the protected layout has already
 * loaded, so the common protected request adds no extra auth round-trip while
 * the flag is off. Flipping `IELTS_ENABLED` on short-circuits both paths.
 */
export async function isIeltsAccessible(): Promise<boolean> {
  if (IELTS_ENABLED) return true;
  // Local dev admin bypass renders the shell as an admin without a real
  // session; honour it here so `/ielts/**` is previewable in dev (no-op in
  // production, where the bypass is always disabled).
  if (isDevAdminBypassEnabled()) return true;
  return (await loadIeltsViewer()).isAdmin;
}

/**
 * Resolve the signed-in user id for an IELTS server action, enforcing the
 * launch gate (flag on, or admin preview). Throws otherwise. Centralises the
 * gate so every IELTS action shares one definition of "may use IELTS".
 */
export async function requireIeltsUserId(): Promise<string> {
  const { userId, isAdmin } = await loadIeltsViewer();
  if (!userId) throw new Error("Not authenticated");
  if (!IELTS_ENABLED && !isAdmin) throw new Error("IELTS is not available.");
  return userId;
}
