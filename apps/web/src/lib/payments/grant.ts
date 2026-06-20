/**
 * Shared idempotent grant from a one-shot payment (WS-4.1).
 *
 * Apply-first: the entitlement STATE is applied via the out-of-order-guarded
 * `apply_subscription_from_webhook` (idempotent — a replay re-applies the same
 * state; a concurrent delivery is serialised by the per-user advisory lock), then
 * the payment is recorded ONCE via the insert-first claim. This needs no
 * compensating rollback: a transient failure during apply leaves nothing claimed,
 * so the provider's retry simply re-applies. Both the entitlement single-grant
 * and the receipt single-record idempotency guarantees are preserved.
 */

import { interpretClaim } from "./idempotency";
import type { ClaimTransactionInput, PaymentRepository } from "./repository.types";
import type { ApplySubscriptionParams } from "./types";

export interface GrantResult {
  /** We recorded the payment receipt on this delivery. */
  granted: boolean;
  /** A prior delivery already recorded the receipt. */
  alreadyProcessed: boolean;
  /** The entitlement row id (applied on every delivery). */
  subscriptionId: string;
}

export async function grantSubscription(
  repo: PaymentRepository,
  claim: ClaimTransactionInput,
  applyParams: ApplySubscriptionParams,
): Promise<GrantResult> {
  const subscriptionId = await repo.applySubscription(applyParams);
  const decision = interpretClaim(await repo.claimTransaction(claim));
  if (decision.proceed) {
    await repo.finalizeTransaction(
      claim.provider,
      claim.idempotencyKey,
      "success",
      subscriptionId,
      claim.providerRef,
    );
  }
  return {
    granted: decision.proceed,
    alreadyProcessed: decision.alreadyDone,
    subscriptionId,
  };
}
