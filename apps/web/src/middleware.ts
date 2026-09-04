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
  const securedRequest = new NextRequest(request, { headers: requestHeaders });

  const withCsp = (response: Awaited<ReturnType<typeof updateSession>>) => {
    setContentSecurityPolicyResponseHeader(response.headers, csp.value);
    return response;
  };

  const maintenanceResponse = await getMaintenanceGateResponse(securedRequest);
  if (maintenanceResponse) return withCsp(maintenanceResponse);

  // Skip intl middleware for API routes, auth callback, and join referral route
  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/auth/callback") ||
    pathname.startsWith("/email/unsubscribe") ||
    pathname.startsWith("/ingest/") ||
    pathname.startsWith("/join/")
  ) {
    return withCsp(await updateSession(securedRequest));
  }

  // The body was transferred to securedRequest above; constructing from the
  // original request again throws for server-action POSTs. Reuse this request.
  securedRequest.headers.set("x-thinkfy-pathname", pathname);

  // Run intl middleware first (handles locale detection, redirects, rewrites).
  // The path header lets the protected shell preserve the intended return URL
  // without trusting a client-provided query parameter.
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
