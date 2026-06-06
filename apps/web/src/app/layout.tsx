import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Geist_Mono } from "next/font/google";
import { ThinkfyThemeVariables } from "@/components/shared/theme-variables";
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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html className="light scroll-smooth" suppressHydrationWarning>
      <head>
        <ThinkfyThemeVariables />
      </head>
      <body
        className={`${jakarta.variable} ${geistMono.variable} bg-background font-sans antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
