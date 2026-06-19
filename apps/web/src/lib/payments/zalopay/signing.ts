/**
 * ZaloPay HMAC signing + verification (WS-4.1) — pure, no env, fully unit-tested.
 *
 * key1 (mac key) signs OUTBOUND create-order requests; key2 (callback key)
 * verifies INBOUND IPN callbacks. The create-order MAC field order is fixed by
 * ZaloPay and must match byte-for-byte: app_id|app_trans_id|app_user|amount|
 * app_time|embed_data|item over the *stringified* embed_data/item.
 */

import { createHmac, randomInt, timingSafeEqual } from "node:crypto";

export function hmacSha256Hex(data: string, key: string): string {
  return createHmac("sha256", key).update(data).digest("hex");
}

export interface CreateOrderMacFields {
  appId: string;
  appTransId: string;
  appUser: string;
  amount: number;
  appTime: number;
  embedData: string;
  item: string;
}

export function buildCreateOrderMac(
  fields: CreateOrderMacFields,
  key1: string,
): string {
  const data = [
    fields.appId,
    fields.appTransId,
    fields.appUser,
    String(fields.amount),
    String(fields.appTime),
    fields.embedData,
    fields.item,
  ].join("|");
  return hmacSha256Hex(data, key1);
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

/** Verify a ZaloPay callback: HMAC-SHA256(rawData, key2) == mac (constant-time). */
export function verifyCallbackMac(
  rawData: string,
  mac: string,
  key2: string,
): boolean {
  return constantTimeEqual(hmacSha256Hex(rawData, key2), mac);
}

/** `yymmdd` date prefix in VN time (GMT+7) — ZaloPay rejects stale-date ids. */
export function appTransDatePrefix(now: Date): string {
  const vn = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  const yy = String(vn.getUTCFullYear()).slice(-2);
  const mm = String(vn.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(vn.getUTCDate()).padStart(2, "0");
  return `${yy}${mm}${dd}`;
}

/** `yymmdd_<9-digit>` app_trans_id; rng injectable for deterministic tests. */
export function generateAppTransId(
  now: Date,
  rng: () => number = () => randomInt(0, 1_000_000_000),
): string {
  const rand = String(rng()).padStart(9, "0").slice(0, 9);
  return `${appTransDatePrefix(now)}_${rand}`;
}
