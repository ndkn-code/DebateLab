import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseCookieOptions } from "./cookie-options";
import {
  classifyAuthError,
  hasAuthorizationHeader,
  hasSupabaseAuthCookie,
  isApiRequest,
  isPublicRequest,
  recoveryPath,
} from "./request-policy";

const AUTH_DEADLINE_MS = 4_000;

type UpdateSessionOptions = { deadlineMs?: number };

function unavailableResponse(request: NextRequest) {
  if (isApiRequest(request) || request.method !== "GET") {
    return NextResponse.json(
      { error: "auth_unavailable", message: "Authentication is temporarily unavailable." },
      {
        status: 503,
        headers: { "Cache-Control": "no-store", "Retry-After": "30" },
      },
    );
  }
  const destination = request.nextUrl.clone();
  destination.pathname = recoveryPath(request).split("?")[0];
  destination.search = recoveryPath(request).split("?")[1] ?? "";
  return NextResponse.redirect(destination, { status: 307, headers: { "Cache-Control": "private, no-store", "Retry-After": "30" } });
}

function invalidResponse(request: NextRequest) {
  return isApiRequest(request)
    ? NextResponse.json({ error: "invalid_session" }, { status: 401, headers: { "Cache-Control": "no-store" } })
    : null;
}

export async function updateSession(
  request: NextRequest,
  response?: NextResponse,
  options: UpdateSessionOptions = {},
) {
  const baseResponse = response ?? NextResponse.next({ request });
  if (isPublicRequest(request)) return baseResponse;
  // Bearer, webhook, and cron routes authenticate in their handlers. Middleware
  // must not turn those credentials into a cookie-backed session check.
  if (hasAuthorizationHeader(request) && isApiRequest(request)) return baseResponse;
  if (!hasSupabaseAuthCookie(request)) return baseResponse;

  let supabaseResponse = baseResponse;
  const stagedCookies: Array<{ name: string; value: string; options?: Parameters<typeof getSupabaseCookieOptions>[0] }> = [];
  const deadlineMs = options.deadlineMs ?? AUTH_DEADLINE_MS;
  const controller = new AbortController();
  let rejectDeadline: (error: Error) => void = () => undefined;
  const deadline = new Promise<never>((_, reject) => {
    rejectDeadline = reject;
  });
  let settled = false;
  const timer = setTimeout(() => {
    controller.abort();
    rejectDeadline(Object.assign(new Error("authentication deadline exceeded"), { status: 504 }));
  }, deadlineMs);

  const unavailable = () => {
    const unavailable = unavailableResponse(request);
    // Keep locale negotiation even when access verification cannot complete.
    for (const cookie of baseResponse.cookies.getAll()) unavailable.cookies.set(cookie);
    // A completed refresh can rotate the old refresh token before getUser fails.
    // Persist that completed renewal, but never persist a transient sign-out.
    if (stagedCookies.some(({ value }) => value.length > 0)) {
      for (const { name, value, options: cookieOptions } of stagedCookies) {
        unavailable.cookies.set(name, value, getSupabaseCookieOptions(cookieOptions));
      }
    }
    return unavailable;
  };

  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookieOptions: getSupabaseCookieOptions(),
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            if (!settled) stagedCookies.push(...cookiesToSet);
          },
        },
        global: {
          fetch: (input, init) => {
            controller.signal.throwIfAborted();
            return fetch(input, { ...init, signal: controller.signal });
          },
        },
      }
    );

    const commit = () => {
      stagedCookies.forEach(({ name, value }) => request.cookies.set(name, value));
      if (!response) supabaseResponse = NextResponse.next({ request });
      else if (stagedCookies.length) {
        // Intl already created request-header overrides before the refresh. Update
        // its Cookie override without deriving/consuming a second POST request.
        const overrides = new Set((supabaseResponse.headers.get("x-middleware-override-headers") ?? "").split(",").map((name) => name.trim()).filter(Boolean));
        overrides.add("cookie");
        supabaseResponse.headers.set("x-middleware-override-headers", [...overrides].join(","));
        supabaseResponse.headers.set("x-middleware-request-cookie", request.headers.get("cookie") ?? "");
      }
      if (stagedCookies.length) supabaseResponse.headers.set("Cache-Control", "private, no-store");
      stagedCookies.forEach(({ name, value, options: cookieOptions }) =>
        supabaseResponse.cookies.set(name, value, getSupabaseCookieOptions(cookieOptions)),
      );
    };

    const result = await Promise.race([supabase.auth.getUser(), deadline]);
    clearTimeout(timer);
    if (result.error) {
      const kind = classifyAuthError(result.error);
      if (kind === "invalid") {
        commit();
        const invalid = invalidResponse(request);
        if (invalid) {
          for (const cookie of supabaseResponse.cookies.getAll()) invalid.cookies.set(cookie);
          return invalid;
        }
        return supabaseResponse;
      }
      if (kind === "unavailable") return unavailable();
    }
    commit();
    return supabaseResponse;
  } catch (error) {
    clearTimeout(timer);
    const kind = classifyAuthError(error);
    if (kind === "invalid") return invalidResponse(request) ?? supabaseResponse;
    return unavailable();
  } finally {
    settled = true;
    clearTimeout(timer);
    controller.abort();
  }
}
