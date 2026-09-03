/** ZaloPay IPN callback with server-authored order correlation. */

import { isBillingCycle, type BillingCycle } from "../types";
import type { PaymentRepository } from "../repository.types";
import { loadZaloPayConfig, type ZaloPayConfig } from "./config";
import { verifyCallbackMac } from "./signing";

export interface CallbackResult {
  return_code: number;
  return_message: string;
}
interface ZaloEmbed { userId?: string; billingCycle?: string }
interface ZaloCallbackData {
  app_trans_id: string;
  amount: number;
  zp_trans_id?: number | string;
  embed_data?: string;
}

function parseEmbed(raw: string | undefined): ZaloEmbed {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as ZaloEmbed;
  } catch {
    return {};
  }
}

export async function processZaloPayCallback(
  rawData: string,
  mac: string,
  repo: PaymentRepository,
  deps: { config?: ZaloPayConfig; now?: Date } = {},
): Promise<CallbackResult> {
  const config = deps.config ?? loadZaloPayConfig();
  if (!verifyCallbackMac(rawData, mac, config.key2)) {
    return { return_code: -1, return_message: "mac not equal" };
  }
  let data: ZaloCallbackData;
  try {
    data = JSON.parse(rawData) as ZaloCallbackData;
  } catch {
    return { return_code: 0, return_message: "invalid data" };
  }
  const embed = parseEmbed(data.embed_data);
  if (!embed.userId) {
    return { return_code: 0, return_message: "missing user" };
  }
  const billingCycle: BillingCycle = isBillingCycle(embed.billingCycle)
    ? embed.billingCycle
    : "monthly";
  try {
    const result = await repo.settleZaloPayCallback({
      appTransId: data.app_trans_id,
      userId: embed.userId,
      amount: data.amount,
      currency: "VND",
      billingCycle,
      providerRef: String(data.zp_trans_id ?? ""),
    });
    return {
      return_code: 1,
      return_message: result === "duplicate" ? "already processed" : "success",
    };
  } catch {
    return { return_code: 0, return_message: "invalid or unrecognized order" };
  }
}
