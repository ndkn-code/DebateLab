import createIntlMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";
import { updateSession } from "@/lib/supabase/middleware";
import { getMaintenanceGateResponse } from "@/lib/maintenance/middleware";
import { NextRequest } from "next/server";
import {
  createContentSecurityPolicyContext,
  setContentSecurityPolicyResponseHeader,
} from "@/lib/security/content-security-policy";

const intlMiddleware = createIntlMiddleware(routing);

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const csp = createContentSecurityPolicyContext(request.headers, {
    isDevelopment: process.env.NODE_ENV === "development",
    grafanaFaroCollectorUrl: process.env.NEXT_PUBLIC_GRAFANA_FARO_COLLECTOR_URL,
  });
  const requestHeaders = csp.requestHeaders;

  // Skip intl middleware for API routes, auth callback, and join referral route
  const skipIntl =
    pathname.startsWith("/api") ||
    pathname.startsWith("/auth/callback") ||
    pathname.startsWith("/email/unsubscribe") ||
    pathname.startsWith("/ingest/") ||
    pathname.startsWith("/join/");

  // The path header lets the protected shell preserve the intended return URL
  // without trusting a client-provided query parameter.
  if (!skipIntl) requestHeaders.set("x-thinkfy-pathname", `${pathname}${request.nextUrl.search}`);

  // Derive the forwarded request exactly once. A request body can be adopted
  // by only one derived Request: a second `new NextRequest(request, …)` on a
  // POST throws "Cannot construct a Request with a Request object that has
  // already been used", which turns every server action into a 500.
  const securedRequest = new NextRequest(request, { headers: requestHeaders });

  const withCsp = (response: Awaited<ReturnType<typeof updateSession>>) => {
    setContentSecurityPolicyResponseHeader(response.headers, csp.value);
    return response;
  };

  const maintenanceResponse = await getMaintenanceGateResponse(securedRequest);
  if (maintenanceResponse) return withCsp(maintenanceResponse);

  if (skipIntl) {
    return withCsp(await updateSession(securedRequest));
  }

  // Run intl middleware first (handles locale detection, redirects, rewrites).
  const intlResponse = intlMiddleware(securedRequest);

  // Then run Supabase session update, passing the intl response to preserve
  // locale cookies/headers while adding Supabase session cookies
  return withCsp(await updateSession(securedRequest, intlResponse));
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|json|lottie)$).*)",
  ],
};
