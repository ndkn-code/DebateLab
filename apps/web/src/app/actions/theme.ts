"use server";

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import {
  APP_THEME_COOKIE_MAX_AGE,
  APP_THEME_COOKIE_NAME,
  coerceAppTheme,
  type AppTheme,
} from "@/lib/theme";
import { DEV_ADMIN_PROFILE } from "@/lib/dev-admin-bypass";
import { getDevAuthBypassUserFromServerContext } from "@/lib/dev-auth-bypass";

async function setThemeCookie(theme: AppTheme) {
  const cookieStore = await cookies();
  cookieStore.set(APP_THEME_COOKIE_NAME, theme, {
    httpOnly: false,
    maxAge: APP_THEME_COOKIE_MAX_AGE,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

export async function saveThemePreference(themeInput: AppTheme) {
  const theme = coerceAppTheme(themeInput);
  await setThemeCookie(theme);

  const supabase = await createClient();
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
        theme,
      };
    }

    return { theme };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("preferences")
    .eq("id", user.id)
    .single();

  if (profileError) {
    throw new Error(profileError.message);
  }

  const preferences = {
    ...((profile?.preferences as Record<string, unknown> | null | undefined) ??
      {}),
    theme,
  };

  const { error } = await supabase
    .from("profiles")
    .update({ preferences })
    .eq("id", user.id);

  if (error) {
    throw new Error(error.message);
  }

  return { theme };
}
