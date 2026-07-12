import { NextResponse, type NextRequest } from "next/server";
import {
  evaluateMaintenanceGate,
  isMaintenanceBypassPath,
  localizedMessage,
  maintenanceStateSchema,
  requestLocale,
  type MaintenanceState,
} from "./model";

const SUCCESS_TTL_MS = 5_000;
const FAILURE_TTL_MS = 15_000;
const FETCH_TIMEOUT_MS = 1_500;

let cache: { state: MaintenanceState | null; expiresAt: number } | null = null;

async function fetchMaintenanceState(request: NextRequest): Promise<MaintenanceState> {
  const now = Date.now();
  if (cache?.state && cache.expiresAt > now) return cache.state;
  if (cache && !cache.state && cache.expiresAt > now) {
    throw new Error("maintenance status failure is cached");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(new URL("/api/public/maintenance", request.url), {
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`maintenance status returned ${response.status}`);
    const payload: unknown = await response.json();
    if (!payload || typeof payload !== "object" || !("maintenance" in payload)) {
      throw new Error("maintenance status payload is invalid");
    }
    const state = maintenanceStateSchema.parse(payload.maintenance);
    cache = { state, expiresAt: now + SUCCESS_TTL_MS };
    return state;
  } catch (error) {
    cache = { state: null, expiresAt: Date.now() + FAILURE_TTL_MS };
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function retryAfterHeader(expectedDoneAt: string | null) {
  if (!expectedDoneAt) return null;
  const remainingSeconds = Math.ceil((Date.parse(expectedDoneAt) - Date.now()) / 1_000);
  return Number.isFinite(remainingSeconds) ? String(Math.max(60, remainingSeconds)) : null;
}

export async function getMaintenanceGateResponse(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const state = await evaluateMaintenanceGate({
    environment: process.env.NODE_ENV,
    bypass: isMaintenanceBypassPath(pathname),
    readState: () => fetchMaintenanceState(request),
  });
  if (!state) return null;

  const locale = requestLocale(
    pathname,
    request.cookies.get("NEXT_LOCALE")?.value,
    request.headers.get("accept-language") ?? "",
  );
  const retryAfter = retryAfterHeader(state.expectedDoneAt);
  const headers = retryAfter ? { "Retry-After": retryAfter } : undefined;

  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      {
        error: "maintenance",
        message: localizedMessage(state.fullMessage, locale),
        expectedDoneAt: state.expectedDoneAt,
      },
      { status: 503, headers },
    );
  }

  const destination = request.nextUrl.clone();
  destination.pathname = `/${locale}/maintenance`;
  destination.search = "";
  return NextResponse.redirect(destination, { headers });
}
