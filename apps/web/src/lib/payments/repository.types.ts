/**
 * PaymentRepository port (WS-4.1).
 *
 * The provider handlers depend on this interface, not on Supabase — so all
 * orchestration is unit-testable with the in-memory FakeRepository. Only the
 * thin SupabasePaymentRepository adapter binds it to the typed client + the 7
 * SQL functions (and is the one piece that needs the regenerated `Database`).
 */

import type { ApplySubscriptionParams, ClaimResult, Provider } from "./types";

export interface ClaimTransactionInput {
  provider: Provider;
  idempotencyKey: string;
  userId: string;
  kind: string;
  amount: number | null;
  currency: string | null;
  planType: string | null;
  billingCycle: string | null;
  providerRef: string | null;
  metadata?: Record<string, unknown>;
}

export interface UsageResult {
  allowed: boolean;
  usedCount: number;
  limitCount: number | null;
}

export interface StoredTransaction {
  userId: string;
  provider: Provider;
  idempotencyKey: string;
  amount: number | null;
  currency: string;
  planType: string | null;
  billingCycle: string | null;
  status: string;
  processed: boolean;
  subscriptionId: string | null;
}

export interface PaymentRepository {
  /** True only when a prior delivery of this event fully processed (cheap dedup). */
  isWebhookProcessed(provider: Provider, eventId: string): Promise<boolean>;
  /**
   * Upsert the webhook event with a terminal status — written AFTER processing
   * (success) or on failure (audit). A non-`processed` row is re-processable, so
   * a crashed/in-flight attempt is retried (the claim guarantees idempotency).
   */
  recordWebhookEvent(
    provider: Provider,
    eventId: string,
    eventType: string,
    payload: Record<string, unknown>,
    userId: string | null,
    status: "processed" | "error" | "skipped",
  ): Promise<void>;
  claimTransaction(input: ClaimTransactionInput): Promise<ClaimResult>;
  finalizeTransaction(
    provider: Provider,
    idempotencyKey: string,
    status: string,
    subscriptionId: string | null,
    providerRef: string | null,
  ): Promise<void>;
  releaseTransaction(provider: Provider, idempotencyKey: string): Promise<void>;
  getTransaction(
    provider: Provider,
    idempotencyKey: string,
  ): Promise<StoredTransaction | null>;
  applySubscription(params: ApplySubscriptionParams): Promise<string>;
  incrementFeatureUsage(
    userId: string,
    feature: string,
    periodStart: string,
    periodEnd: string,
    amount: number,
    limit: number | null,
  ): Promise<UsageResult>;
  userExists(userId: string): Promise<boolean>;
}
