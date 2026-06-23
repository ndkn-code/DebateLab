import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { getDevAuthBypassUserFromServerContext } from "@/lib/dev-auth-bypass";
import { tryCreateAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  BASE_SESSION_SELECT,
  FULL_SESSION_SELECT,
  isSessionSchemaCompatibilityError,
  rowToDebateSession,
} from "@/lib/results/debate-session-row";
import type { DebateSession } from "@/types";

type SessionLoadResult =
  | { status: "loaded"; session: DebateSession }
  | { status: "not-found" }
  | { status: "error"; message: string };

async function queryOwnedSession(
  supabase: SupabaseClient,
  sessionId: string,
  userId: string
) {
  const initialResult = await supabase
    .from("debate_sessions")
    .select(FULL_SESSION_SELECT)
    .eq("id", sessionId)
    .eq("user_id", userId)
    .maybeSingle();

  let data: Record<string, unknown> | null = initialResult.data;
  let error = initialResult.error;

  if (isSessionSchemaCompatibilityError(error)) {
    const retry = await supabase
      .from("debate_sessions")
      .select(BASE_SESSION_SELECT)
      .eq("id", sessionId)
      .eq("user_id", userId)
      .maybeSingle();
    data = retry.data;
    error = retry.error;
  }

  if (error) {
    return { session: null, error };
  }

  if (!data) {
    return { session: null, error: null };
  }

  try {
    return { session: rowToDebateSession(data), error: null };
  } catch (error) {
    return {
      session: null,
      error:
        error instanceof Error
          ? error
          : new Error("Unable to normalize this session."),
    };
  }
}

export async function loadOwnedSessionResult(
  sessionId: string
): Promise<SessionLoadResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const devUser = user ? null : await getDevAuthBypassUserFromServerContext();
  const userId = user?.id ?? devUser?.id ?? null;

  if (!userId) {
    return { status: "not-found" };
  }

  const userClientResult = await queryOwnedSession(supabase, sessionId, userId);
  if (userClientResult.session) {
    return { status: "loaded", session: userClientResult.session };
  }

  const admin = tryCreateAdminClient();
  if (admin) {
    const adminResult = await queryOwnedSession(admin, sessionId, userId);
    if (adminResult.session) {
      return { status: "loaded", session: adminResult.session };
    }
    if (adminResult.error) {
      return { status: "error", message: adminResult.error.message };
    }
  }

  if (userClientResult.error) {
    return { status: "error", message: userClientResult.error.message };
  }

  return { status: "not-found" };
}
