import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/supabase";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

/**
 * Typed browser client (WS-0.1 quality bar). New code MUST use this so all
 * reads/writes are checked against the generated `Database` schema. The untyped
 * `createClient` above is retained for existing call-sites pending lazy
 * migration (see docs/ielts/data-access.md).
 */
export function createTypedBrowserClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
