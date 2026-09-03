import type { CookieOptions } from "@supabase/ssr";

/** Shared cookie attributes for the Supabase browser, server, and middleware clients. */
export function getSupabaseCookieOptions(
  options: CookieOptions = {},
  nodeEnv = process.env.NODE_ENV,
): CookieOptions {
  return {
    ...options,
    path: "/",
    sameSite: "lax",
    ...(nodeEnv === "production" ? { secure: true } : {}),
  };
}
