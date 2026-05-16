import { NextRequest, NextResponse } from "next/server";
import { addDaysToDateKey } from "@/lib/email/time";
import { EMAIL_TEMPLATE_KEYS, type EmailStreakDot, type EmailTemplateKey } from "@/lib/email/types";
import { buildTemplateVariables, renderThinkfyEmail } from "@/lib/email/templates";

type Context = {
  params: Promise<{ locale: string }>;
};

function isLocalhostHost(host: string) {
  const normalizedHost = host.toLowerCase();
  return (
    normalizedHost === "localhost" ||
    normalizedHost.startsWith("localhost:") ||
    normalizedHost === "127.0.0.1" ||
    normalizedHost.startsWith("127.0.0.1:") ||
    normalizedHost === "[::1]" ||
    normalizedHost.startsWith("[::1]:")
  );
}

function makeDots(today: string, activeOffsets: number[]) {
  const activeDates = new Set(activeOffsets.map((offset) => addDaysToDateKey(today, offset)));
  const labels = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

  return Array.from({ length: 7 }, (_, index): EmailStreakDot => {
    const date = addDaysToDateKey(today, index - 6);
    const weekday = new Date(`${date}T00:00:00.000Z`).getUTCDay();
    return {
      date,
      label: labels[weekday],
      active: activeDates.has(date),
      today: date === today,
    };
  });
}

function resolveTemplateKey(value: string | null): EmailTemplateKey {
  return EMAIL_TEMPLATE_KEYS.includes(value as EmailTemplateKey)
    ? (value as EmailTemplateKey)
    : "streak_rescue";
}

export async function GET(request: NextRequest, context: Context) {
  const [{ locale }] = await Promise.all([context.params]);
  const host = request.headers.get("host") ?? "";

  if (process.env.NODE_ENV !== "development" || !isLocalhostHost(host)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const templateKey = resolveTemplateKey(request.nextUrl.searchParams.get("template"));
  const variables = buildTemplateVariables(templateKey, {
    locale: locale === "en" ? "en" : "vi",
    userName: "Minh",
    sessionsLast7Days: 4,
    minutesLast7Days: 72,
    xpLast7Days: 860,
    bestScoreLast7Days: 88,
    streakCurrent: 6,
    streakDots: makeDots("2026-05-16", [-6, -5, -4, -3, -2, -1]),
    level: 7,
    totalSessions: 28,
    latestCourseTitle: "Phan bien nhu doi tuyen debate",
    latestAchievementLabel: "Streak 7 ngày sắp vào tầm ngắm.",
  });
  const rendered = await renderThinkfyEmail({ subject: variables.subject, variables });

  return new NextResponse(rendered.html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "x-robots-tag": "noindex",
    },
  });
}
