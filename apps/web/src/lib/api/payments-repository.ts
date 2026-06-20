import "server-only";

import { createTypedAdminClient } from "@/lib/supabase/admin";
import type { PaymentRepository } from "@/lib/payments/repository.types";
import { SupabasePaymentRepository } from "@/lib/payments/supabase-repository";

/**
 * Composition root (WS-4.1): a service-role-backed payment repository for the
 * webhook + checkout routes. The payment SQL functions are service-role-only, so
 * the webhook/server path uses the admin client (writes also bypass RLS here).
 */
export function createPaymentRepository(): PaymentRepository {
  return new SupabasePaymentRepository(createTypedAdminClient());
}
