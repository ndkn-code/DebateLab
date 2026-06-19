/**
 * ZaloPay IPN callback (WS-4.1).
 *
 * Verifies the key2 MAC, then grants premium via the shared apply-first core
 * (idempotent under replay + concurrent delivery). The plan/user come from the
 * MAC-protected embed_data. Returns ZaloPay's expected ack codes: 1 = handled
 * (don't retry), anything else = retry.
 */

import { addMonths } from "../dates";
import { toApplyParams, type NormalizedSubscriptionEvent } from "../entitlement";
import { grantSubscription } from "../grant";
import { cycleMonths } from "../plans";
import { isBillingCycle, type BillingCycle } from "../types";
import type { PaymentRepository } from "../repository.types";
import { loadZaloPayConfig, type ZaloPayConfig } from "./config";
import { verifyCallbackMac } from "./signing";

export interface CallbackResult {
  return_code: number;
  return_message: string;
}

interface ZaloEmbed {
  userId?: string;
  billingCycle?: string;
}

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
  const now = deps.now ?? new Date();
  const event: NormalizedSubscriptionEvent = {
    userId: embed.userId,
    provider: "zalopay",
    providerSubscriptionId: null,
    providerCustomerId: null,
    planType: "premium",
    status: "active",
    currentPeriodStart: now,
    currentPeriodEnd: addMonths(now, cycleMonths(billingCycle)),
    trialEndDate: null,
    cancelAtPeriodEnd: false,
    billingCycle,
    amountPaid: data.amount,
    currency: "VND",
    eventAt: now,
  };

  try {
    const result = await grantSubscription(
      repo,
      {
        provider: "zalopay",
        idempotencyKey: data.app_trans_id,
        userId: embed.userId,
        kind: "order",
        amount: data.amount,
        currency: "VND",
        planType: "premium",
        billingCycle,
        providerRef: String(data.zp_trans_id ?? ""),
      },
      toApplyParams(event),
    );
    return {
      return_code: 1,
      return_message: result.alreadyProcessed ? "already processed" : "success",
    };
  } catch {
    // Transient failure before anything was recorded — ask ZaloPay to retry.
    return { return_code: 0, return_message: "processing" };
  }
}
