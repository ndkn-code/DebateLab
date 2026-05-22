import { createClient as createSupabaseClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import { getDevAuthBypassUserFromRequest } from "@/lib/dev-auth-bypass";
import { createClient as createCookieClient } from "@/lib/supabase/server";

export type RequestAuthSource = "bearer" | "cookie" | "dev-bypass";

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

export function unauthorizedJson(message = "Unauthorized") {
  return NextResponse.json({ error: message }, { status: 401 });
}

export function unauthorizedTextResponse(message = "Unauthorized") {
  return new Response(message, { status: 401 });
}

export async function requireRequestAuth(
  request: NextRequest,
  options: { allowDevBypass?: boolean } = {}
): Promise<RequestAuthResult> {
  const { allowDevBypass = true } = options;
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
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return {
        ok: false,
        errorResponse: unauthorizedJson(),
        authSource: null,
      };
    }

    return {
      ok: true,
      supabase,
      user: { ...user, email: user.email ?? null },
      authSource: "bearer",
    };
  }

  const supabase = (await createCookieClient()) as SupabaseClient;
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    return {
      ok: true,
      supabase,
      user: { ...user, email: user.email ?? null },
      authSource: "cookie",
    };
  }

  const devUser = allowDevBypass ? getDevAuthBypassUserFromRequest(request) : null;
  if (devUser) {
    return {
      ok: true,
      supabase,
      user: devUser,
      authSource: "dev-bypass",
    };
  }

  return {
    ok: false,
    errorResponse: unauthorizedJson(),
    authSource: null,
  };
}

export function shouldConsumeUserRateLimit(auth: RequestAuthSuccess) {
  return auth.authSource !== "dev-bypass";
}
