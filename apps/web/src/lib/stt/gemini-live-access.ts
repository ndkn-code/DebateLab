import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type GeminiLiveBenchmarkAccessResult =
  | { ok: true }
  | {
      ok: false;
      reason:
        | "disabled"
        | "allowlist_invalid"
        | "not_allowlisted"
        | "not_platform_admin"
        | "age_assurance_missing";
    };

function parseAllowlist(value: string | undefined) {
  if (!value?.trim()) return null;
  const ids = value
    .split(",")
    .map((id) => id.trim().toLowerCase())
    .filter(Boolean);
  if (ids.length === 0 || ids.some((id) => !UUID_PATTERN.test(id))) {
    return null;
  }
  return new Set(ids);
}

/** All gates are conjunctive. Missing configuration or DB evidence denies. */
export async function authorizeGeminiLiveBenchmark(params: {
  supabase: SupabaseClient;
  userId: string;
  enabled?: string;
  allowlist?: string;
}): Promise<GeminiLiveBenchmarkAccessResult> {
  if (params.enabled !== "true") return { ok: false, reason: "disabled" };
  const allowlist = parseAllowlist(params.allowlist);
  if (!allowlist) return { ok: false, reason: "allowlist_invalid" };
  if (
    !UUID_PATTERN.test(params.userId) ||
    !allowlist.has(params.userId.toLowerCase())
  ) {
    return { ok: false, reason: "not_allowlisted" };
  }

  const [profileResult, assuranceResult] = await Promise.all([
    params.supabase
      .from("profiles")
      .select("role")
      .eq("id", params.userId)
      .maybeSingle(),
    params.supabase
      .from("user_age_assurance")
      .select("age_band, consent_status")
      .eq("user_id", params.userId)
      .maybeSingle(),
  ]);
  if (profileResult.error || profileResult.data?.role !== "admin") {
    return { ok: false, reason: "not_platform_admin" };
  }
  if (
    assuranceResult.error ||
    assuranceResult.data?.age_band !== "adult" ||
    assuranceResult.data?.consent_status !== "adult_attested"
  ) {
    return { ok: false, reason: "age_assurance_missing" };
  }
  return { ok: true };
}
