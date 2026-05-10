import { NextRequest, NextResponse } from "next/server";
import { getString, readJsonObject } from "@/lib/api/request-validation";
import { consumeRateLimit } from "@/lib/rate-limit";
import { getNextSmartPopup } from "@/lib/smart-popups/service";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function getAuthenticatedUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { supabase, user };
}

async function guardRateLimit(
  supabase: Awaited<ReturnType<typeof createClient>>
) {
  const rateLimit = await consumeRateLimit(supabase, {
    scope: "smart-popups-next",
    limit: 40,
    windowSeconds: 60,
  });

  if (!rateLimit.success) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a moment." },
      {
        status: 429,
        headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
      }
    );
  }

  return null;
}

export async function GET(request: NextRequest) {
  const { supabase, user } = await getAuthenticatedUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = await guardRateLimit(supabase);
  if (limited) return limited;

  try {
    const admin = createAdminClient();
    const searchParams = request.nextUrl.searchParams;
    const result = await getNextSmartPopup({
      supabase: admin,
      userId: user.id,
      locale: searchParams.get("locale"),
      surface: searchParams.get("surface"),
      route: searchParams.get("route"),
      commit: false,
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to preview popup.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const { supabase, user } = await getAuthenticatedUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = await guardRateLimit(supabase);
  if (limited) return limited;

  try {
    const body = await readJsonObject(request, { maxBytes: 8 * 1024 });
    const admin = createAdminClient();
    const result = await getNextSmartPopup({
      supabase: admin,
      userId: user.id,
      locale: getString(body, "locale", { maxLength: 8 }),
      surface: getString(body, "surface", { maxLength: 32 }),
      route: getString(body, "route", { maxLength: 500 }),
      commit: true,
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to commit popup.",
      },
      { status: 500 }
    );
  }
}
