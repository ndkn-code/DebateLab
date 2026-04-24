import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Plus_Jakarta_Sans, Geist_Mono } from "next/font/google";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/react";
import { Toaster } from "@/components/ui/sonner";
import { ANALYTICS_COOKIE_NAME, isAnalyticsEnabled } from "@/lib/settings";
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
    default: "DebateLab — Master the Art of Debate",
    template: "%s | DebateLab",
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
    title: "DebateLab — Master the Art of Debate",
    description:
      "Practice solo, get AI-powered feedback, and sharpen your argumentation skills — all in English.",
    type: "website",
    siteName: "DebateLab",
  },
  twitter: {
    card: "summary_large_image",
    title: "DebateLab — Master the Art of Debate",
    description:
      "Practice solo, get AI-powered feedback, and sharpen your argumentation skills.",
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const analyticsEnabled = isAnalyticsEnabled(
    cookieStore.get(ANALYTICS_COOKIE_NAME)?.value
  );

  return (
    <html className="scroll-smooth" suppressHydrationWarning>
      <body
        className={`${jakarta.variable} ${geistMono.variable} bg-background font-sans antialiased`}
      >
        {children}
        <Toaster position="top-right" richColors />
        {analyticsEnabled ? (
          <>
            <SpeedInsights />
            <Analytics />
          </>
        ) : null}
      </body>
    </html>
  );
}
