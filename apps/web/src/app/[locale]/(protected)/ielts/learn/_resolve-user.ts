import "server-only";

import type { User } from "@supabase/supabase-js";
import { notFound, redirect } from "next/navigation";
import { createTypedServerClient } from "@/lib/supabase/server";
import type { IeltsDbClient } from "@/lib/api/ielts/client";
import { isEnrolledStudent } from "@/lib/ielts/enrollment";

function pickDisplayName(user: User | null): string {
  const fromMeta = user?.user_metadata?.display_name;
  if (typeof fromMeta === "string" && fromMeta.length > 0) return fromMeta;
  return user?.email?.split("@")[0] || "there";
}

export interface IeltsLearnContext {
  userId: string;
  displayName: string;
  /**
   * Own-scoped reads use the RLS cookie client and are filtered by user id.
   */
  client?: IeltsDbClient;
}

/**
 * Resolve the learner for the IELTS Learn pages, mirroring the WS-5.1 home
 * (`/ielts`) resolution: require a real Supabase user and redirect to login
 * when no session is present.
 */
export async function resolveIeltsLearnContext(): Promise<IeltsLearnContext> {
  const supabase = await createTypedServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const userId = user?.id;
  if (!userId) redirect("/auth/login");
  const enrolled = await isEnrolledStudent(userId, supabase);
  if (!enrolled) notFound();

  return {
    userId,
    displayName: pickDisplayName(user),
    client: supabase,
  };
}
