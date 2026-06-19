/**
 * ZaloPay create-order (WS-4.1). Builds the key1-signed order request and POSTs
 * it; `fetch` is injectable so the flow is unit-testable. The user/plan are
 * carried in embed_data (MAC-protected) and read back by the callback.
 */

import type { BillingCycle } from "../types";
import { loadZaloPayConfig, type ZaloPayConfig } from "./config";
import { buildCreateOrderMac, generateAppTransId } from "./signing";

export interface OrderInput {
  userId: string;
  billingCycle: BillingCycle;
  /** Whole-dong VND amount. */
  amount: number;
  returnUrl: string;
}

export interface ZaloOrderBody {
  app_id: string;
  app_trans_id: string;
  app_user: string;
  app_time: number;
  amount: number;
  item: string;
  embed_data: string;
  callback_url: string;
  description: string;
  mac: string;
}

export type ZaloFetch = (
  url: string,
  init: { method: string; headers: Record<string, string>; body: string },
) => Promise<{ json: () => Promise<unknown> }>;

export function buildOrderBody(
  config: ZaloPayConfig,
  input: OrderInput,
  appTransId: string,
  appTime: number,
): ZaloOrderBody {
  const embedData = JSON.stringify({
    redirecturl: input.returnUrl,
    userId: input.userId,
    billingCycle: input.billingCycle,
  });
  const item = JSON.stringify([
    { name: `Thinkfy Premium (${input.billingCycle})`, quantity: 1, price: input.amount },
  ]);
  const mac = buildCreateOrderMac(
    {
      appId: config.appId,
      appTransId,
      appUser: input.userId,
      amount: input.amount,
      appTime,
      embedData,
      item,
    },
    config.key1,
  );
  return {
    app_id: config.appId,
    app_trans_id: appTransId,
    app_user: input.userId,
    app_time: appTime,
    amount: input.amount,
    item,
    embed_data: embedData,
    callback_url: config.callbackUrl,
    description: `Thinkfy Premium - ${input.billingCycle}`,
    mac,
  };
}

function toForm(body: ZaloOrderBody): string {
  return new URLSearchParams(
    Object.entries(body).map(([k, v]) => [k, String(v)]),
  ).toString();
}

interface OrderDeps {
  config?: ZaloPayConfig;
  now?: Date;
  appTransId?: string;
  fetchFn?: ZaloFetch;
}

export async function createZaloPayOrder(
  input: OrderInput,
  deps: OrderDeps = {},
): Promise<{ appTransId: string; orderUrl: string }> {
  const config = deps.config ?? loadZaloPayConfig();
  const now = deps.now ?? new Date();
  const appTransId = deps.appTransId ?? generateAppTransId(now);
  const body = buildOrderBody(config, input, appTransId, now.getTime());
  const fetchFn: ZaloFetch = deps.fetchFn ?? ((url, init) => fetch(url, init));
  const res = await fetchFn(config.createEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: toForm(body),
  });
  const json = (await res.json()) as {
    return_code?: number;
    order_url?: string;
    sub_return_message?: string;
  };
  if (json.return_code !== 1 || !json.order_url) {
    throw new Error(
      `ZaloPay create-order failed: ${json.sub_return_message ?? "unknown"}`,
    );
  }
  return { appTransId, orderUrl: json.order_url };
}
