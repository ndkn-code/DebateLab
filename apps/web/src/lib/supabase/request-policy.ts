import type { NextRequest } from "next/server";
import { requestLocale } from "@/lib/maintenance/model";

const LOCALES = new Set(["en", "vi"]);
const PUBLIC_PREFIXES = [
  "/auth/login",
  "/auth/signup",
  "/auth/recovery",
  "/guides",
  "/terms",
  "/privacy",
  "/cookies",
  "/join",
  "/email/unsubscribe",
  "/maintenance",
  "/guardian-consent",
] as const;

function withoutLocale(pathname: string) {
  const first = pathname.split("/")[1];
  return first && LOCALES.has(first)
    ? pathname.slice(first.length + 1) || "/"
    : pathname;
}

export function isPublicPathname(pathname: string) {
  if (pathname.startsWith("/_next/") || /\.(?:css|js|map|ico|woff2?|ttf|otf|pdf|mp3|wav|mp4|webm|webmanifest)$/i.test(pathname)) return true;
  if (
    pathname.startsWith("/auth/callback") ||
    pathname.startsWith("/ingest/") ||
    pathname.startsWith("/api/public/") ||
    pathname === "/api/analytics/events" ||
    pathname.startsWith("/api/email/unsubscribe")
  ) {
    return true;
  }
  if (pathname.startsWith("/api/")) return false;

  const normalized = withoutLocale(pathname);
  if (normalized === "/" || normalized === "/ielts" || normalized === "/ielts-prep") {
    return true;
  }
  return PUBLIC_PREFIXES.some(
    (prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`),
  );
}

export function isPublicRequest(request: NextRequest) {
  return isPublicPathname(request.nextUrl.pathname);
}

export function isApiRequest(request: NextRequest) {
  return request.nextUrl.pathname.startsWith("/api/");
}

export function hasSupabaseAuthCookie(request: NextRequest) {
  return request.cookies.getAll().some(({ name }) =>
    /^sb-[^-]+-auth-token(?:\.\d+)?$/.test(name),
  );
}

export function hasAuthorizationHeader(request: NextRequest) {
  return Boolean(request.headers.get("authorization"));
}

export type AuthErrorKind = "invalid" | "unavailable" | "other";

export function classifyAuthError(error: unknown): AuthErrorKind {
  if (!error) return "other";
  const candidate = error as { name?: string; code?: string; status?: number; message?: string };
  const status = candidate.status;
  const code = typeof candidate.code === "string" ? candidate.code.toLowerCase() : "";
  const message = typeof candidate.message === "string" ? candidate.message.toLowerCase() : "";
  if (
    (typeof status === "number" && status >= 500) ||
    status === 408 ||
    status === 425 ||
    status === 429 ||
    candidate.name === "AbortError" ||
    message.includes("fetch") ||
    message.includes("timeout") ||
    message.includes("network")
  ) {
    return "unavailable";
  }
  if (
    candidate.name === "AuthSessionMissingError" ||
    ["refresh_token_not_found", "refresh_token_already_used", "session_not_found", "user_not_found", "bad_jwt"].includes(code) ||
    status === 401 ||
    status === 403 ||
    code.includes("invalid") ||
    code.includes("jwt") ||
    message.includes("invalid jwt") ||
    message.includes("token is expired") ||
    message.includes("invalid token")
  ) {
    return "invalid";
  }
  return "unavailable";
}

export function recoveryPath(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const locale = requestLocale(pathname, request.cookies.get("NEXT_LOCALE")?.value, request.headers.get("accept-language") ?? "");
  const next = `${pathname}${request.nextUrl.search}`;
  return `/${locale}/auth/recovery?${new URLSearchParams({ next }).toString()}`;
}
