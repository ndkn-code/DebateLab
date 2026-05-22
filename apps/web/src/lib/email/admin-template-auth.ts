import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { isAdminUser } from "@/lib/auth/admin";
import { DEV_ADMIN_PROFILE, isDevAdminBypassEnabled } from "@/lib/dev-admin-bypass";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export class EmailAdminAuthError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export interface EmailAdminRequestContext {
  supabase: SupabaseClient | null;
  actorId: string | null;
  canWrite: boolean;
  devBypass: boolean;
}

function tryCreateServiceClient() {
  try {
    return createAdminClient();
  } catch {
    return null;
  }
}

export async function requireEmailAdminContext(): Promise<EmailAdminRequestContext> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user && (await isAdminUser(supabase, user.id))) {
    return {
      supabase,
      actorId: user.id,
      canWrite: true,
      devBypass: false,
    };
  }

  if (isDevAdminBypassEnabled()) {
    const serviceClient = tryCreateServiceClient();
    return {
      supabase: serviceClient,
      actorId: DEV_ADMIN_PROFILE.id,
      canWrite: Boolean(serviceClient),
      devBypass: true,
    };
  }

  throw new EmailAdminAuthError(user ? "Forbidden" : "Unauthorized", user ? 403 : 401);
}

export function assertCanWriteEmailTemplates(context: EmailAdminRequestContext) {
  if (!context.canWrite || !context.supabase) {
    throw new EmailAdminAuthError(
      "Template saving requires an admin session or Supabase service role configuration.",
      503
    );
  }
}
