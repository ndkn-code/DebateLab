import createIntlMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";
import { updateSession } from "@/lib/supabase/middleware";
import { type NextRequest } from "next/server";

const intlMiddleware = createIntlMiddleware(routing);

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip intl middleware for API routes, auth callback, and join referral route
  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/auth/callback") ||
    pathname.startsWith("/join/")
  ) {
    return await updateSession(request);
  }

  // Run intl middleware first (handles locale detection, redirects, rewrites)
  const intlResponse = intlMiddleware(request);

  // Then run Supabase session update, passing the intl response to preserve
  // locale cookies/headers while adding Supabase session cookies
  return await updateSession(request, intlResponse);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|json|lottie)$).*)",
  ],
};
