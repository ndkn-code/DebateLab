"use server";

import { cookies } from "next/headers";
import { createTypedServerClient } from "@/lib/supabase/server";
import { parseInput } from "@/lib/api/boundary";
import {
  SUBJECT_COOKIE_NAME,
  SUBJECT_COOKIE_MAX_AGE,
  SubjectSchema,
  type Subject,
} from "@/lib/subject";
import type { Json } from "@/types/supabase";
import { DEV_ADMIN_PROFILE } from "@/lib/dev-admin-bypass";
import { getDevAuthBypassUserFromServerContext } from "@/lib/dev-auth-bypass";

async function setSubjectCookie(subject: Subject) {
  const cookieStore = await cookies();
  cookieStore.set(SUBJECT_COOKIE_NAME, subject, {
    httpOnly: false,
    maxAge: SUBJECT_COOKIE_MAX_AGE,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

/**
 * Persist the active subject (debate | ielts). Mirrors `saveThemePreference`:
 * a cookie for fast SSR reads + `profiles.preferences.subject` for cross-device
 * persistence — reusing the existing `preferences` jsonb bag, so no new profile
 * column is needed. Input is validated at the boundary via `parseInput`.
 */
export async function saveSubjectPreference(raw: unknown) {
  const subject = parseInput(SubjectSchema, raw);
  await setSubjectCookie(subject);

  const supabase = await createTypedServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const devAuthBypassUser = user
    ? null
    : await getDevAuthBypassUserFromServerContext();

  if (!user) {
    if (devAuthBypassUser) {
      DEV_ADMIN_PROFILE.preferences = {
        ...(DEV_ADMIN_PROFILE.preferences ?? {}),
        subject,
      };
    }

    return { subject };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("preferences")
    .eq("id", user.id)
    .single();

  if (profileError) {
    throw new Error(profileError.message);
  }

  const existing = (profile?.preferences ?? {}) as Record<string, Json>;
  const preferences: Json = { ...existing, subject };

  const { error } = await supabase
    .from("profiles")
    .update({ preferences })
    .eq("id", user.id);

  if (error) {
    throw new Error(error.message);
  }

  return { subject };
}
