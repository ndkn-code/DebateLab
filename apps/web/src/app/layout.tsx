import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Plus_Jakarta_Sans, Geist_Mono } from "next/font/google";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/react";
import { Toaster } from "@/components/ui/sonner";
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
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin", "vietnamese"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Thinkfy — Master the Art of Debate",
    template: "%s | Thinkfy",
  },
  description:
    "Practice solo, get AI-powered feedback, and sharpen your argumentation skills — all in English. Built for Vietnamese high school students.",
  keywords: [
    "debate practice",
    "AI feedback",
    "English speaking",
    "Vietnamese students",
    "debate training",
    "speech practice",
  ],
  openGraph: {
    title: "Thinkfy — Master the Art of Debate",
    description:
      "Practice solo, get AI-powered feedback, and sharpen your argumentation skills — all in English.",
    type: "website",
    siteName: "Thinkfy",
    images: [
      {
        url: "/brand/thinkfy/thinkfy-logo-light.png",
        width: 640,
        height: 226,
        alt: "Thinkfy",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Thinkfy — Master the Art of Debate",
    description:
      "Practice solo, get AI-powered feedback, and sharpen your argumentation skills.",
    images: ["/brand/thinkfy/thinkfy-logo-light.png"],
  },
  icons: {
    icon: [
      { url: "/brand/thinkfy/thinkfy-favicon.png", type: "image/png" },
    ],
    apple: [{ url: "/brand/thinkfy/thinkfy-favicon.png", type: "image/png" }],
  },
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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const initialTheme = await resolveInitialTheme();
  const analyticsEnabled = isAnalyticsEnabled(
    cookieStore.get(ANALYTICS_COOKIE_NAME)?.value
  );

  return (
    <html className={`${initialTheme} scroll-smooth`} suppressHydrationWarning>
      <body
        className={`${jakarta.variable} ${geistMono.variable} bg-background font-sans antialiased`}
      >
        <script
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: themeSyncScript(initialTheme) }}
        />
        <AppThemeProvider initialTheme={initialTheme}>
          {children}
          <Toaster position="top-right" richColors />
          {analyticsEnabled ? (
            <>
              <WebVitalsReporter />
              <SpeedInsights />
              <Analytics />
            </>
          ) : null}
        </AppThemeProvider>
      </body>
    </html>
  );
}
