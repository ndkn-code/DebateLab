import { cookies } from "next/headers";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { PostHogPageview, PostHogProvider } from "@/app/posthog-provider";
import { Toaster } from "@/components/ui/sonner";
import { ToastProvider } from "@/components/shared/toast-provider";
import { WebVitalsReporter } from "@/components/shared/web-vitals-reporter";
import { AppThemeProvider } from "@/components/shared/theme-provider";
import { ANALYTICS_COOKIE_NAME, isAnalyticsEnabled } from "@/lib/settings";
import { createClient } from "@/lib/supabase/server";
import {
  APP_THEME_COOKIE_NAME,
  APP_THEME_STORAGE_KEY,
  coerceAppTheme,
  type AppTheme,
} from "@/lib/theme";

type LocalizedAppProvidersProps = {
  children: React.ReactNode;
};

async function resolveInitialTheme(): Promise<AppTheme> {
  const cookieStore = await cookies();
  const cookieTheme = coerceAppTheme(
    cookieStore.get(APP_THEME_COOKIE_NAME)?.value,
    "light"
  );

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return cookieTheme;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("preferences")
      .eq("id", user.id)
      .single();

    return coerceAppTheme(
      (profile?.preferences as Record<string, unknown> | null | undefined)
        ?.theme,
      cookieTheme
    );
  } catch {
    return cookieTheme;
  }
}

function themeSyncScript(theme: AppTheme) {
  return `
    try {
      var theme = ${JSON.stringify(theme)};
      var storageKey = ${JSON.stringify(APP_THEME_STORAGE_KEY)};
      var root = document.documentElement;
      root.classList.remove("light", "dark");
      root.classList.add(theme);
      root.style.colorScheme = theme;
      window.localStorage.setItem(storageKey, theme);
    } catch (_) {}
  `;
}

export async function LocalizedAppProviders({
  children,
}: LocalizedAppProvidersProps) {
  const cookieStore = await cookies();
  const messages = await getMessages();
  const initialTheme = await resolveInitialTheme();
  const analyticsEnabled = isAnalyticsEnabled(
    cookieStore.get(ANALYTICS_COOKIE_NAME)?.value
  );

  const content = analyticsEnabled ? (
    <PostHogProvider enabled>
      <PostHogPageview enabled />
      {children}
    </PostHogProvider>
  ) : (
    children
  );

  return (
    <>
      <script
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: themeSyncScript(initialTheme) }}
      />
      <AppThemeProvider initialTheme={initialTheme}>
        <NextIntlClientProvider messages={messages}>
          {content}
          <ToastProvider />
          <Toaster position="top-right" richColors />
          {analyticsEnabled ? (
            <>
              <WebVitalsReporter />
              <SpeedInsights />
              <Analytics />
            </>
          ) : null}
        </NextIntlClientProvider>
      </AppThemeProvider>
    </>
  );
}
