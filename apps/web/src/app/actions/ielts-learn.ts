"use server";

import { createTypedServerClient } from "@/lib/supabase/server";
import { loadSubskillMasteryForUser } from "@/lib/api/ielts/learn-path-repository";
import type { SubskillMastery } from "@/lib/ielts/learner/learn-path";

const MAX_SUBSKILL_KEYS = 16;

/**
 * Read the current learner's own mastery snapshot for a lesson's subskills
 * (WS-6.2.3). Called by the lesson completion screen right after
 * `completeActivity` has written evidence + refreshed `ielts_skill_states`, so it
 * reflects the post-lesson state. RLS-own SELECT: a learner only ever reads their
 * own skill states. Keys are public taxonomy, but we still bound the request.
 */
export async function loadIeltsSubskillMasterySnapshot(
  subskillKeys: string[],
): Promise<SubskillMastery[]> {
  const keys = [
    ...new Set(
      (Array.isArray(subskillKeys) ? subskillKeys : [])
        .filter((key): key is string => typeof key === "string" && key.length > 0)
        .slice(0, MAX_SUBSKILL_KEYS),
    ),
  ];
  if (keys.length === 0) return [];

  const supabase = await createTypedServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  return loadSubskillMasteryForUser(user.id, keys, supabase);
}
