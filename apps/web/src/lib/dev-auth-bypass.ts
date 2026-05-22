import type { NextRequest } from "next/server";
import { cookies, headers } from "next/headers";
import {
  getString,
  isPlainRecord,
  type JsonRecord,
} from "@/lib/api/request-validation";
import { DEV_ADMIN_PROFILE } from "@/lib/dev-admin-bypass";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);
export const DEV_AUTH_BYPASS_COOKIE = "debate_dev_auth_bypass";
export const DEV_AUTH_BYPASS_COOKIE_VALUE = "enabled";

function getHostName(host: string | null | undefined) {
  return host?.split(":")[0]?.toLowerCase() ?? null;
}

function isLocalDevHost(host: string | null | undefined) {
  const hostName = getHostName(host);
  return Boolean(hostName && LOCAL_HOSTS.has(hostName));
}

export function isLocalDevAuthBypassAllowed(request: NextRequest) {
  if (process.env.NODE_ENV === "production") return false;

  if (!isLocalDevHost(request.headers.get("host") ?? request.nextUrl.hostname)) {
    return false;
  }

  return true;
}

function isDevAuthBypassCookieValue(value: string | null | undefined) {
  return value === DEV_AUTH_BYPASS_COOKIE_VALUE;
}

export function getDevAuthBypassUserFromRequest(request: NextRequest) {
  if (!isLocalDevAuthBypassAllowed(request)) return null;
  if (!isDevAuthBypassCookieValue(request.cookies.get(DEV_AUTH_BYPASS_COOKIE)?.value)) {
    return null;
  }

  return {
    id: DEV_ADMIN_PROFILE.id,
    email: DEV_ADMIN_PROFILE.email,
  };
}

export async function getDevAuthBypassUserFromServerContext() {
  if (process.env.NODE_ENV === "production") return null;

  const [cookieStore, headerStore] = await Promise.all([cookies(), headers()]);
  if (!isLocalDevHost(headerStore.get("host"))) return null;
  if (!isDevAuthBypassCookieValue(cookieStore.get(DEV_AUTH_BYPASS_COOKIE)?.value)) {
    return null;
  }

  return {
    id: DEV_ADMIN_PROFILE.id,
    email: DEV_ADMIN_PROFILE.email,
  };
}

export function normalizeDevAuthNext(value: string | null | undefined) {
  if (!value) return "/en/settings";
  if (!value.startsWith("/") || value.startsWith("//")) return "/en/settings";
  if (value.includes("://")) return "/en/settings";
  return value;
}

export async function readOptionalJsonObject(request: NextRequest) {
  const contentLength = request.headers.get("content-length");
  if (!contentLength || Number(contentLength) === 0) {
    return {};
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return {};
  }

  try {
    const body: unknown = await request.json();
    return isPlainRecord(body) ? body : {};
  } catch {
    return {};
  }
}

export function getDevAuthCredentials(body: JsonRecord) {
  const email =
    getString(body, "email", { maxLength: 320 }) ??
    process.env.DEV_AUTH_EMAIL ??
    process.env.E2E_TEST_EMAIL;
  const password =
    getString(body, "password", { maxLength: 512 }) ??
    process.env.DEV_AUTH_PASSWORD ??
    process.env.E2E_TEST_PASSWORD;

  return {
    email,
    password,
  };
}
