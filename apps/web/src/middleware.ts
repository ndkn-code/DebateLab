import createIntlMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";
import { updateSession } from "@/lib/supabase/middleware";
import { getMaintenanceGateResponse } from "@/lib/maintenance/middleware";
import { NextRequest } from "next/server";

const intlMiddleware = createIntlMiddleware(routing);

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const maintenanceResponse = await getMaintenanceGateResponse(request);
  if (maintenanceResponse) return maintenanceResponse;

  // Skip intl middleware for API routes, auth callback, and join referral route
  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/auth/callback") ||
    pathname.startsWith("/email/unsubscribe") ||
    pathname.startsWith("/ingest/") ||
    pathname.startsWith("/join/")
  ) {
    return await updateSession(request);
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-thinkfy-pathname", pathname);
  const requestWithPath = new NextRequest(request, { headers: requestHeaders });

  // Run intl middleware first (handles locale detection, redirects, rewrites).
  // The path header lets the protected shell preserve the intended return URL
  // without trusting a client-provided query parameter.
  const intlResponse = intlMiddleware(requestWithPath);

  // Then run Supabase session update, passing the intl response to preserve
  // locale cookies/headers while adding Supabase session cookies
  return await updateSession(requestWithPath, intlResponse);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.well-known/workflow/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|json|lottie)$).*)",
  ],
};
