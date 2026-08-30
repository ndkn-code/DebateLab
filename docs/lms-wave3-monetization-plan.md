# LMS Wave-3 — Monetization (execution-ready plan)

**STATUS: DEFERRED for execution.** Do NOT build until Thinkfy actually flips to charging. This doc makes Wave-3 paste-and-go the moment that decision lands — it is planning, not a build order. Waves 0–2 shipped; Wave-3 was intentionally held (`docs/lms-masterplan.md §4/§6`: premature for a free, pre-launch, admin-gated product). Content remains the parallel #1 lever; monetization must not displace it.

## Execution prerequisites (all must be true before starting)
1. Founder has decided to charge (a concrete pricing model + at least one paid plan defined).
2. IELTS launch flag is on / product is user-facing (paid tiers need real users).
3. Billing provider(s) chosen for checkout of one-off/catalog items (today's rails handle *subscriptions* via Stripe/ZaloPay/RevenueCat; a catalog/one-time-purchase flow may need a checkout-session path).

## Verified existing rails (Wave-3 builds ON these — do not rebuild)
- `subscriptions`: multi-provider (`provider`, `provider_customer_id`, `provider_subscription_id`), `plan_type` (text — **plans are hardcoded enums in code, no catalog table**), `status`, `billing_cycle`, `amount_paid`, `currency`, trial + cancel lifecycle, `metadata`. Mature.
- `payment_transactions` + payment webhook tables (Stripe/ZaloPay/RevenueCat webhooks already wired — see WS-4.1 payments port).
- `referrals` (id/referrer_id/referee_id/status/orbs) + ORB ledger (`orb_transactions`) + `qualify_and_credit_referral` RPC — the affiliate program **extends** this, doesn't replace it. Admin referrals view already shipped (WS-L2).
- Admin surfaces under `dashboard/admin/**`; `AdminSidebar.tsx` flat list; `verifyAdmin` + typed client + `private.is_admin` RLS pattern; ChartKit + motion kit polish bar. All the same conventions as Waves 0–2.

## Workstreams (sequence: WS-L7 → WS-L8 → WS-L9)

### WS-L7 · Store / product catalog (do first — the others reference it)
Replace hardcoded plan enums with a real catalog so plans/products are data, not code.
- **DATA**: `products` (id, kind `subscription|one_time|bundle`, name, description, subject, `plan_type` link, `price_amount` numeric, `currency`, `billing_cycle` nullable, `provider_price_ids jsonb` (Stripe/ZaloPay/RevenueCat price ids), `active` bool, `sort_order`, timestamps). RLS: public SELECT of `active` products (pricing page), admin-only writes via `private.is_admin`. Keep `subscriptions.plan_type` as the join key (migration is additive — existing subs unaffected).
- **BUILD**: `lib/api/products.ts` (admin CRUD + public `listActiveProducts`); admin route `dashboard/admin/store`; a public pricing surface reads the catalog. Checkout continues via the existing provider paths, now driven by `provider_price_ids`.
- **Care**: don't break existing subscription tracking; the catalog is a source-of-truth for *display + checkout params*, webhooks still reconcile `subscriptions`.

### WS-L8 · Discount codes (depends on WS-L7 catalog + checkout)
- **DATA**: `discount_codes` (id, code unique-ci, `kind` percent|fixed, `value` numeric, `currency` nullable, `applies_to` (all|product_ids jsonb), `max_redemptions` nullable, `redeemed_count`, `per_user_limit`, `starts_at`/`expires_at`, `active`, created_by, timestamps) + `discount_redemptions` (code_id, user_id, order/txn ref, redeemed_at) for tracking + per-user limits. RLS: admin-only writes; validation/redemption via a `SECURITY INVOKER` server action (never trust client-applied discounts — server recomputes price).
- **BUILD**: `lib/api/discount-codes.ts` (admin CRUD, `validateCode({code,userId,productId})` server-side, `redeemCode` atomic on successful payment); admin route `dashboard/admin/discounts` (CRUD + redemption stats); checkout hook applies a validated code server-side before creating the provider checkout session.
- **Care**: redemption must be atomic + idempotent (tie to the payment webhook, not the client), respect max/per-user limits under concurrency.

### WS-L9 · Affiliate program (extends referrals; do last)
- **DATA**: `affiliates` (id, user_id, `code` unique, `commission_kind` percent|fixed, `commission_value`, `status` pending|active|suspended, payout details ref, created_at) + `affiliate_conversions` (affiliate_id, referred_user_id, order/txn ref, `commission_amount`, `status` pending|approved|paid, timestamps). Reuse the `referrals`/ORB machinery where it overlaps; affiliates differ from referrals by paying **cash commission on paid conversions** (not ORBs on signup). RLS: admin-only writes; affiliate can read own stats.
- **BUILD**: `lib/api/affiliates.ts` (admin approve/suspend + payout tracking; affiliate self-serve dashboard of clicks/conversions/earnings); admin route `dashboard/admin/affiliates` (extend the existing referrals view or a sibling); attribution hook credits a conversion on a paid transaction that carries an affiliate code.
- **Care**: payout is real money — the admin surface *tracks* payouts; **do not auto-execute transfers** (matches the no-auto-financial-action rule). Commission only on *approved paid* conversions (refund clawback path).

## Cross-cutting (every Wave-3 card, same as Waves 0–2)
- Admin-gated + RLS from day one; `get_advisors(security)` after every migration.
- Polish bar: design-system tokens + ChartKit + motion kit; light+dark+mobile; opacity-token dark gotcha.
- Full 8 gates + real-browser before/after; register surfaces in `AdminSidebar.tsx` + EN/VI.
- **Money-safety**: server-authoritative pricing (never trust client), atomic/idempotent redemption tied to webhooks, and NO automated fund transfers (track, don't execute).

## When founder greenlights execution
Expand each WS above into a full paste-ready Codex card (the Waves 0–2 card template), verify the billing landscape hasn't drifted (re-check `subscriptions`/`payment_transactions`/provider price-id shape), then run WS-L7 → WS-L8 → WS-L9 serially (each depends on the prior). Serialize anything touching checkout.
