import { NextRequest, NextResponse } from "next/server";
import {
  DEV_AUTH_BYPASS_COOKIE,
  DEV_AUTH_BYPASS_COOKIE_VALUE,
  getDevAuthCredentials,
  isLocalDevAuthBypassAllowed,
  normalizeDevAuthNext,
  readOptionalJsonObject,
} from "@/lib/dev-auth-bypass";
import { createClient } from "@/lib/supabase/server";

function setBypassCookie(response: NextResponse) {
  response.cookies.set(DEV_AUTH_BYPASS_COOKIE, DEV_AUTH_BYPASS_COOKIE_VALUE, {
    httpOnly: true,
    maxAge: 60 * 60,
    path: "/",
    sameSite: "lax",
    secure: false,
  });
  return response;
}

function clearBypassCookie(response: NextResponse) {
  response.cookies.set(DEV_AUTH_BYPASS_COOKIE, "", {
    httpOnly: true,
    maxAge: 0,
    path: "/",
    sameSite: "lax",
    secure: false,
  });
  return response;
}

export async function POST(request: NextRequest) {
  if (!isLocalDevAuthBypassAllowed(request)) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  const body = await readOptionalJsonObject(request);
  const strategy =
    typeof body.strategy === "string"
      ? body.strategy
      : request.nextUrl.searchParams.get("strategy");
  const { email, password } = getDevAuthCredentials(body);
  const next = normalizeDevAuthNext(
    typeof body.next === "string"
      ? body.next
      : request.nextUrl.searchParams.get("next")
  );

  if (strategy === "cookie") {
    return setBypassCookie(NextResponse.json({ ok: true, strategy, next }));
  }

  if (!email || !password) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Missing dev auth credentials. Provide email/password in the JSON body or set DEV_AUTH_EMAIL and DEV_AUTH_PASSWORD.",
      },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.session || !data.user) {
    return NextResponse.json(
      { ok: false, error: "Dev sign-in failed." },
      { status: 401 }
    );
  }

  return NextResponse.json({
    ok: true,
    next,
    user: {
      id: data.user.id,
      email: data.user.email,
    },
  });
}

export async function GET(request: NextRequest) {
  if (!isLocalDevAuthBypassAllowed(request)) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  const strategy = request.nextUrl.searchParams.get("strategy");
  const next = normalizeDevAuthNext(request.nextUrl.searchParams.get("next"));
  if (strategy === "cookie") {
    return setBypassCookie(NextResponse.redirect(new URL(next, request.url)));
  }

  const { email, password } = getDevAuthCredentials({});
  if (!email || !password) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Missing DEV_AUTH_EMAIL and DEV_AUTH_PASSWORD for GET dev sign-in.",
      },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.session || !data.user) {
    return NextResponse.json(
      { ok: false, error: "Dev sign-in failed." },
      { status: 401 }
    );
  }

  return NextResponse.redirect(
    new URL(next, request.url)
  );
}

export async function DELETE(request: NextRequest) {
  if (!isLocalDevAuthBypassAllowed(request)) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  const supabase = await createClient();
  await supabase.auth.signOut();

  return clearBypassCookie(NextResponse.json({ ok: true }));
}
