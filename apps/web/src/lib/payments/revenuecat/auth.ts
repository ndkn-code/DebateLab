/**
 * RevenueCat webhook auth (WS-4.1, scaffold) — constant-time shared-secret check
 * on the Authorization header, accepting bare or `Bearer `-prefixed values.
 * Fail-closed when the secret is unset (mirrors Lumist).
 */

import { timingSafeEqual } from "node:crypto";

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export function isAuthorizedRevenueCat(
  authHeader: string | null | undefined,
  secret: string | undefined,
): boolean {
  if (!secret || !authHeader) return false;
  return safeEqual(authHeader, secret) || safeEqual(authHeader, `Bearer ${secret}`);
}
