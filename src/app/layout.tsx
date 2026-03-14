import type { Metadata } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import { ToastProvider } from "@/components/shared/toast-provider";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
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
    locale: "en_US",
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark scroll-smooth">
      <body
        className={`${inter.variable} ${geistMono.variable} bg-zinc-950 font-sans antialiased`}
      >
        {children}
        <ToastProvider />
      </body>
    </html>
  );
}
