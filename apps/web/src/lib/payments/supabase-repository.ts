/**
 * SupabasePaymentRepository (WS-4.1) — the one adapter binding the PaymentRepository
 * port to the typed client + the 7 SECURITY DEFINER SQL functions. The client is
 * injected (so the class is pure + unit-testable); the service-role composition
 * root lives in `lib/api/payments-repository.ts` (server-only). The functions are
 * service-role-only, so callers pass the admin client.
 *
 * Supabase's type generator types function args as non-null; the SQL accepts null
 * for optional params, so nullable values are narrowed with `as` at the call site.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/supabase";
import type {
  ClaimTransactionInput,
  PaymentRepository,
  StoredTransaction,
  UsageResult,
} from "./repository.types";
import type { ApplySubscriptionParams, ClaimResult, Provider } from "./types";

type Db = SupabaseClient<Database>;

export class SupabasePaymentRepository implements PaymentRepository {
  constructor(private readonly db: Db) {}

  async isWebhookProcessed(provider: Provider, eventId: string): Promise<boolean> {
    const { data } = await this.db
      .from("payment_webhook_events")
      .select("status")
      .eq("provider", provider)
      .eq("event_id", eventId)
      .maybeSingle();
    return data?.status === "processed";
  }

  async recordWebhookEvent(
    provider: Provider,
    eventId: string,
    eventType: string,
    payload: Record<string, unknown>,
    userId: string | null,
    status: "processed" | "error" | "skipped",
  ): Promise<void> {
    await this.db.rpc("record_payment_webhook_event", {
      p_provider: provider,
      p_event_id: eventId,
      p_event_type: eventType,
      p_payload: payload as unknown as Json,
      p_user_id: userId as unknown as string,
    });
    const { error } = await this.db.rpc("mark_payment_webhook_event", {
      p_provider: provider,
      p_event_id: eventId,
      p_status: status,
      p_error: (status === "error" ? "handler error" : null) as unknown as string,
    });
    if (error) throw new Error(`recordWebhookEvent: ${error.message}`);
  }

  async claimTransaction(input: ClaimTransactionInput): Promise<ClaimResult> {
    const { data, error } = await this.db.rpc("claim_payment_transaction", {
      p_provider: input.provider,
      p_idempotency_key: input.idempotencyKey,
      p_user_id: input.userId,
      p_kind: input.kind,
      p_amount: input.amount as number,
      p_currency: input.currency as string,
      p_plan_type: input.planType as string,
      p_billing_cycle: input.billingCycle as string,
      p_provider_ref: input.providerRef as string,
      p_metadata: (input.metadata ?? {}) as unknown as Json,
    });
    if (error) throw new Error(`claimTransaction: ${error.message}`);
    return data as ClaimResult;
  }

  async finalizeTransaction(
    provider: Provider,
    idempotencyKey: string,
    status: string,
    subscriptionId: string | null,
    providerRef: string | null,
  ): Promise<void> {
    const { error } = await this.db.rpc("finalize_payment_transaction", {
      p_provider: provider,
      p_idempotency_key: idempotencyKey,
      p_status: status,
      p_subscription_id: subscriptionId as string,
      p_provider_ref: providerRef as string,
    });
    if (error) throw new Error(`finalizeTransaction: ${error.message}`);
  }

  async releaseTransaction(provider: Provider, idempotencyKey: string): Promise<void> {
    const { error } = await this.db.rpc("release_payment_transaction", {
      p_provider: provider,
      p_idempotency_key: idempotencyKey,
    });
    if (error) throw new Error(`releaseTransaction: ${error.message}`);
  }

  async getTransaction(
    provider: Provider,
    idempotencyKey: string,
  ): Promise<StoredTransaction | null> {
    const { data } = await this.db
      .from("payment_transactions")
      .select(
        "user_id, provider, idempotency_key, amount, currency, plan_type, billing_cycle, status, processed, subscription_id",
      )
      .eq("provider", provider)
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();
    if (!data) return null;
    return {
      userId: data.user_id,
      provider: data.provider as Provider,
      idempotencyKey: data.idempotency_key,
      amount: data.amount,
      currency: data.currency,
      planType: data.plan_type,
      billingCycle: data.billing_cycle,
      status: data.status,
      processed: data.processed,
      subscriptionId: data.subscription_id,
    };
  }

  async applySubscription(params: ApplySubscriptionParams): Promise<string> {
    const { data, error } = await this.db.rpc("apply_subscription_from_webhook", {
      p_user_id: params.userId,
      p_provider: params.provider,
      p_provider_subscription_id: params.providerSubscriptionId as string,
      p_provider_customer_id: params.providerCustomerId as string,
      p_plan_type: params.planType,
      p_status: params.status,
      p_current_period_start: params.currentPeriodStart as string,
      p_current_period_end: params.currentPeriodEnd as string,
      p_trial_end_date: params.trialEndDate as string,
      p_cancel_at_period_end: params.cancelAtPeriodEnd,
      p_billing_cycle: params.billingCycle as string,
      p_amount_paid: params.amountPaid as number,
      p_currency: params.currency as string,
      p_event_at: params.eventAt,
    });
    if (error) throw new Error(`applySubscription: ${error.message}`);
    return data as string;
  }

  async incrementFeatureUsage(
    userId: string,
    feature: string,
    periodStart: string,
    periodEnd: string,
    amount: number,
    limit: number | null,
  ): Promise<UsageResult> {
    const { data, error } = await this.db.rpc("increment_feature_usage", {
      p_user_id: userId,
      p_feature: feature,
      p_period_start: periodStart,
      p_period_end: periodEnd,
      p_amount: amount,
      p_limit: limit as number,
    });
    if (error) throw new Error(`incrementFeatureUsage: ${error.message}`);
    const row = data?.[0];
    if (!row) throw new Error("incrementFeatureUsage: no row returned");
    return {
      allowed: row.allowed,
      usedCount: row.used_count,
      limitCount: row.limit_count,
    };
  }

  async userExists(userId: string): Promise<boolean> {
    const { data } = await this.db
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .maybeSingle();
    return Boolean(data);
  }
}
