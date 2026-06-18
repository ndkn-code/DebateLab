import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

let cachedClient: SupabaseClient | null = null;
let cachedTypedClient: SupabaseClient<Database> | null = null;

export function getAdminClientConfigStatus() {
  return {
    hasUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    hasServiceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
  };
}

export function hasAdminClientConfig() {
  const status = getAdminClientConfigStatus();
  return status.hasUrl && status.hasServiceRoleKey;
}

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("Missing Supabase service role configuration.");
  }

  cachedClient ??= createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return cachedClient;
}

export function tryCreateAdminClient() {
  return hasAdminClientConfig() ? createAdminClient() : null;
}

/**
 * Typed service-role client (WS-0.1 quality bar). New server-only code MUST use
 * this so reads/writes are checked against the generated `Database` schema. The
 * untyped `createAdminClient` above is retained for existing call-sites pending
 * lazy migration (see docs/ielts/data-access.md).
 */
export function createTypedAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("Missing Supabase service role configuration.");
  }

  cachedTypedClient ??= createClient<Database>(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return cachedTypedClient;
}

export function tryCreateTypedAdminClient() {
  return hasAdminClientConfig() ? createTypedAdminClient() : null;
}
