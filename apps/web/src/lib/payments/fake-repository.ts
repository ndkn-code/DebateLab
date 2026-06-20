/**
 * In-memory PaymentRepository (WS-4.1) mirroring the SQL function semantics
 * (claim insert-first, out-of-order guard, supersede-on-activation, atomic
 * metering). The SQL itself is validated by the postgres:17 harness; this lets
 * the provider handlers be unit-tested against the same guarantees with no DB.
 *
 * It is real, fully-tested test infrastructure (imported only by tests, so it is
 * tree-shaken from the production bundle).
 */

import type {
  ApplySubscriptionParams,
  BillingCycle,
  ClaimResult,
  PlanType,
  Provider,
  SubscriptionStatus,
} from "./types";
import type {
  ClaimTransactionInput,
  PaymentRepository,
  StoredTransaction,
  UsageResult,
} from "./repository.types";

interface SubRecord {
  id: string;
  userId: string;
  provider: Provider;
  providerSubscriptionId: string | null;
  providerCustomerId: string | null;
  planType: PlanType;
  status: SubscriptionStatus;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  billingCycle: BillingCycle | null;
  endedAt: string | null;
  lastWebhookEventAt: string | null;
}

interface TxnRecord extends StoredTransaction {
  providerRef: string | null;
}

function olderThan(a: string | null, b: string): boolean {
  return a !== null && new Date(b).getTime() < new Date(a).getTime();
}

export class FakeRepository implements PaymentRepository {
  private txns = new Map<string, TxnRecord>();
  private events = new Map<string, string>();
  private subs: SubRecord[] = [];
  private usage = new Map<string, { used: number; limit: number | null }>();
  private users: Set<string>;
  private seq = 0;

  constructor(existingUsers: string[] = []) {
    this.users = new Set(existingUsers);
  }

  private txnKey(provider: Provider, key: string): string {
    return `${provider}|${key}`;
  }

  async isWebhookProcessed(provider: Provider, eventId: string): Promise<boolean> {
    return this.events.get(`${provider}|${eventId}`) === "processed";
  }

  async recordWebhookEvent(
    provider: Provider,
    eventId: string,
    _eventType: string,
    _payload: Record<string, unknown>,
    _userId: string | null,
    status: "processed" | "error" | "skipped",
  ): Promise<void> {
    this.events.set(`${provider}|${eventId}`, status);
  }

  async claimTransaction(input: ClaimTransactionInput): Promise<ClaimResult> {
    const key = this.txnKey(input.provider, input.idempotencyKey);
    const existing = this.txns.get(key);
    if (existing) return existing.processed ? "duplicate_done" : "in_flight";
    this.txns.set(key, {
      userId: input.userId,
      provider: input.provider,
      idempotencyKey: input.idempotencyKey,
      amount: input.amount,
      currency: input.currency ?? "USD",
      planType: input.planType,
      billingCycle: input.billingCycle,
      status: "pending",
      processed: false,
      subscriptionId: null,
      providerRef: input.providerRef,
    });
    return "claimed";
  }

  async finalizeTransaction(
    provider: Provider,
    idempotencyKey: string,
    status: string,
    subscriptionId: string | null,
    providerRef: string | null,
  ): Promise<void> {
    const txn = this.txns.get(this.txnKey(provider, idempotencyKey));
    if (!txn) return;
    txn.processed = true;
    txn.status = status;
    txn.subscriptionId = subscriptionId ?? txn.subscriptionId;
    txn.providerRef = providerRef ?? txn.providerRef;
  }

  async releaseTransaction(
    provider: Provider,
    idempotencyKey: string,
  ): Promise<void> {
    const txn = this.txns.get(this.txnKey(provider, idempotencyKey));
    if (!txn) return;
    txn.processed = false;
    txn.status = "pending";
  }

  async getTransaction(
    provider: Provider,
    idempotencyKey: string,
  ): Promise<StoredTransaction | null> {
    const txn = this.txns.get(this.txnKey(provider, idempotencyKey));
    return txn ? { ...txn } : null;
  }

  async applySubscription(params: ApplySubscriptionParams): Promise<string> {
    const existing = this.findSub(params);
    if (existing) {
      if (olderThan(existing.lastWebhookEventAt, params.eventAt)) {
        return existing.id; // stale event dropped
      }
      this.updateSub(existing, params);
      return existing.id;
    }
    if (params.status === "active" || params.status === "trial") {
      this.supersedeActive(params.userId);
    }
    const id = `sub_${++this.seq}`;
    this.subs.push({
      id,
      userId: params.userId,
      provider: params.provider,
      providerSubscriptionId: params.providerSubscriptionId,
      providerCustomerId: params.providerCustomerId,
      planType: params.planType,
      status: params.status,
      currentPeriodEnd: params.currentPeriodEnd,
      cancelAtPeriodEnd: params.cancelAtPeriodEnd,
      billingCycle: params.billingCycle,
      endedAt: null,
      lastWebhookEventAt: params.eventAt,
    });
    return id;
  }

  private findSub(params: ApplySubscriptionParams): SubRecord | undefined {
    for (let i = this.subs.length - 1; i >= 0; i--) {
      const s = this.subs[i];
      if (
        s.userId === params.userId &&
        s.provider === params.provider &&
        s.providerSubscriptionId === params.providerSubscriptionId
      ) {
        return s;
      }
    }
    return undefined;
  }

  private updateSub(sub: SubRecord, params: ApplySubscriptionParams): void {
    sub.planType = params.planType;
    sub.status = params.status;
    sub.currentPeriodEnd = params.currentPeriodEnd ?? sub.currentPeriodEnd;
    sub.cancelAtPeriodEnd = params.cancelAtPeriodEnd;
    sub.billingCycle = params.billingCycle ?? sub.billingCycle;
    if (params.status === "cancelled" || params.status === "expired") {
      sub.endedAt = sub.endedAt ?? new Date().toISOString();
    }
    // Reached only past the stale guard, so eventAt >= the stored timestamp.
    sub.lastWebhookEventAt = params.eventAt;
  }

  private supersedeActive(userId: string): void {
    for (const s of this.subs) {
      if (s.userId === userId && (s.status === "active" || s.status === "trial")) {
        s.status = "expired";
        s.endedAt = s.endedAt ?? new Date().toISOString();
      }
    }
  }

  async incrementFeatureUsage(
    userId: string,
    feature: string,
    periodStart: string,
    _periodEnd: string,
    amount: number,
    limit: number | null,
  ): Promise<UsageResult> {
    const key = `${userId}|${feature}|${periodStart}`;
    const row = this.usage.get(key) ?? { used: 0, limit };
    if (limit !== null && row.used + amount > limit) {
      this.usage.set(key, row);
      return { allowed: false, usedCount: row.used, limitCount: limit };
    }
    row.used += amount;
    row.limit = limit;
    this.usage.set(key, row);
    return { allowed: true, usedCount: row.used, limitCount: limit };
  }

  async userExists(userId: string): Promise<boolean> {
    return this.users.has(userId);
  }

  // ── test inspection helpers ───────────────────────────────────────────────
  subscriptionById(id: string): SubRecord | undefined {
    return this.subs.find((s) => s.id === id);
  }
  subscriptionCount(): number {
    return this.subs.length;
  }
  webhookStatus(provider: Provider, eventId: string): string | undefined {
    return this.events.get(`${provider}|${eventId}`);
  }
}
