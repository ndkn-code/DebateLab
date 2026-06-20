/**
 * Shared typed-client plumbing for the IELTS authoring repositories (WS-1.1).
 *
 * Every repository defaults to the cookie-bound admin session
 * (`createTypedServerClient`) so RLS ("Admins manage IELTS …") authorizes the
 * write. Batch callers (the bulk importer) inject a service-role
 * `createTypedAdminClient` instead. Both are `SupabaseClient<Database>`, so the
 * `<Database>` generic keeps every `.from()/.rpc()` schema-checked.
 */
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { createTypedServerClient } from "@/lib/supabase/server";

export type IeltsDbClient = SupabaseClient<Database>;

export async function resolveIeltsClient(client?: IeltsDbClient): Promise<IeltsDbClient> {
  return client ?? (await createTypedServerClient());
}
