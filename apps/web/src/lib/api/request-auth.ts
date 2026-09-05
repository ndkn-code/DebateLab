import {
  createClient as createSupabaseClient,
  type SupabaseClient,
  type User,
} from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import { createClient as createCookieClient } from "@/lib/supabase/server";
import { boundedAuthFetch } from "@/lib/protected-shell/deadline";
import { verifyIdentity } from "@/lib/protected-shell/identity";
import { withServerRequestBudget } from "@/lib/supabase/request-budget";

export type RequestAuthSource = "bearer" | "cookie";

export type RequestAuthUser = Pick<User, "id"> & {
  email?: string | null;
};

export type RequestAuthSuccess = {
  ok: true;
  supabase: SupabaseClient;
  user: RequestAuthUser;
  authSource: RequestAuthSource;
};

export type RequestAuthFailure = {
  ok: false;
  errorResponse: NextResponse;
  authSource: null;
};

export type RequestAuthResult = RequestAuthSuccess | RequestAuthFailure;

function createBearerClient(accessToken: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing Supabase public server configuration.");
  }

  return createSupabaseClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
    global: {
      fetch: boundedAuthFetch(3_000),
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
}

function readBearerToken(request: NextRequest) {
  const authorization = request.headers.get("authorization");
  if (!authorization) return { present: false as const, token: null };

  const [scheme, token, ...rest] = authorization.trim().split(/\s+/);
  if (scheme?.toLowerCase() !== "bearer" || !token || rest.length > 0) {
    return { present: true as const, token: null };
  }

  return { present: true as const, token };
}

export function authUnavailableJson() {
  return NextResponse.json(
    { error: "auth_unavailable", message: "Access could not be verified. Please try again shortly." },
    { status: 503, headers: { "Cache-Control": "private, no-store", "Retry-After": "30" } },
  );
}

export function unauthorizedJson(message = "Unauthorized") {
  return NextResponse.json({ error: message }, { status: 401 });
}

export function unauthorizedTextResponse(message = "Unauthorized") {
  return new Response(message, { status: 401 });
}

export async function requireRequestAuth(
  request: NextRequest,
): Promise<RequestAuthResult> {
  const bearer = readBearerToken(request);

  if (bearer.present) {
    if (!bearer.token) {
      return {
        ok: false,
        errorResponse: unauthorizedJson(),
        authSource: null,
      };
    }

    const supabase = createBearerClient(bearer.token);
    const identity = await verifyIdentity(() => supabase.auth.getUser(bearer.token!));
    if (identity.status !== "authenticated") {
      return {
        ok: false,
        errorResponse: identity.status === "unavailable" ? authUnavailableJson() : unauthorizedJson(),
        authSource: null,
      };
    }
    const user = identity.user;

    return {
      ok: true,
      supabase,
      user: { ...user, email: user.email ?? null },
      authSource: "bearer",
    };
  }

  const identity = await withServerRequestBudget(async () => {
    const authClient = await createCookieClient();
    return verifyIdentity(() => authClient.auth.getUser());
  }, 4_000).catch(() => ({ status: "unavailable" as const }));
  if (identity.status === "unavailable") {
    return { ok: false, errorResponse: authUnavailableJson(), authSource: null };
  }
  if (identity.status === "authenticated") {
    const user = identity.user;
    // The auth budget is now closed. A separate client preserves ordinary
    // handler query budgets and observes any completed refresh cookies.
    const supabase = (await createCookieClient()) as SupabaseClient;
    return {
      ok: true,
      supabase,
      user: { ...user, email: user.email ?? null },
      authSource: "cookie",
    };
  }

  return {
    ok: false,
    errorResponse: unauthorizedJson(),
    authSource: null,
  };
}

export function shouldConsumeUserRateLimit(auth: RequestAuthSuccess) {
  return auth.authSource === "bearer" || auth.authSource === "cookie";
}
