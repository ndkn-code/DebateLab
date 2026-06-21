import "server-only";

import type { User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { createTypedServerClient } from "@/lib/supabase/server";
import { createTypedAdminClient } from "@/lib/supabase/admin";
import { getDevAuthBypassUserFromServerContext } from "@/lib/dev-auth-bypass";
import type { IeltsDbClient } from "@/lib/api/ielts/client";

type DevAuthBypassUser = Awaited<ReturnType<typeof getDevAuthBypassUserFromServerContext>>;

function pickDisplayName(user: User | null, devAuthBypassUser: DevAuthBypassUser): string {
  const fromMeta = user?.user_metadata?.display_name;
  if (typeof fromMeta === "string" && fromMeta.length > 0) return fromMeta;
  return (
    user?.email?.split("@")[0] ||
    devAuthBypassUser?.email?.split("@")[0] ||
    "there"
  );
}

export interface IeltsLearnContext {
  userId: string;
  displayName: string;
  /**
   * A service-role client is supplied only under dev-auth bypass (no Supabase
   * session). In normal auth the repository falls back to the RLS cookie client,
   * so own-scoped reads stay RLS-enforced — the repo always filters by user id too.
   */
  client?: IeltsDbClient;
}

/**
 * Resolve the learner for the IELTS Learn pages, mirroring the WS-5.1 home
 * (`/ielts`) resolution: real Supabase user first, dev-auth bypass second, and a
 * redirect to login when neither is present.
 */
export async function resolveIeltsLearnContext(): Promise<IeltsLearnContext> {
  const supabase = await createTypedServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const devAuthBypassUser = user ? null : await getDevAuthBypassUserFromServerContext();

  const userId = user?.id ?? devAuthBypassUser?.id;
  if (!userId) redirect("/auth/login");

  return {
    userId,
    displayName: pickDisplayName(user, devAuthBypassUser),
    client: devAuthBypassUser ? createTypedAdminClient() : undefined,
  };
}
