import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { EmailMonitorDashboard } from "@/components/admin/emails/EmailMonitorDashboard";
import { getEmailAdminFixtureData } from "@/lib/email/dev-fixtures";
import { addDaysToDateKey } from "@/lib/email/time";
import { EMAIL_TEMPLATE_KEYS, type EmailStreakDot, type EmailTemplateKey } from "@/lib/email/types";
import { buildTemplateVariables, renderThinkfyEmail } from "@/lib/email/templates";

type Props = {
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

const atRiskDots = makeDots("2026-05-16", [-6, -5, -4, -3, -2, -1]);
const activeDots = makeDots("2026-05-16", [-5, -4, -3, -2, -1, 0]);
const zeroDots = makeDots("2026-05-16", []);
const repairedDots = makeDots("2026-05-16", [-3, -2, -1]);

async function emailPreview(templateKey: EmailTemplateKey) {
  const variables = buildTemplateVariables(templateKey, {
    locale: "vi",
    userName: "Minh",
    sessionsLast7Days: 4,
    minutesLast7Days: 72,
    xpLast7Days: 860,
    bestScoreLast7Days: 88,
    streakCurrent: 6,
    streakDots: atRiskDots,
    level: 7,
    totalSessions: 28,
    latestCourseTitle: "Phan bien nhu doi tuyen debate",
    latestAchievementLabel: "Streak 7 ngày sắp vào tầm ngắm.",
  });
  const rendered = await renderThinkfyEmail({
    subject: variables.subject,
    variables,
  });

  return {
    templateKey,
    subject: rendered.subject,
    html: rendered.html,
  };
}

async function streakCasePreview(input: {
  key: string;
  label: string;
  streakCurrent: number;
  dots: EmailStreakDot[];
  note: string;
}) {
  const variables = buildTemplateVariables("streak_rescue", {
    locale: "vi",
    userName: "Minh",
    streakCurrent: input.streakCurrent,
    streakDots: input.dots,
  });
  variables.badgeLabel = input.label;
  variables.body = input.note;

  const rendered = await renderThinkfyEmail({
    subject: variables.subject,
    variables,
  });

  return {
    key: input.key,
    label: input.label,
    subject: rendered.subject,
    html: rendered.html,
  };
}

export default async function Page({ params }: Props) {
  const [{ locale }, hostHeader] = await Promise.all([params, headers()]);
  const host = hostHeader.get("host") ?? "";

  if (process.env.NODE_ENV !== "development" || !isLocalhostHost(host)) {
    notFound();
  }

  setRequestLocale(locale);

  const [previews, streakCases] = await Promise.all([
    Promise.all(EMAIL_TEMPLATE_KEYS.map((templateKey) => emailPreview(templateKey))),
    Promise.all([
      streakCasePreview({
        key: "active",
        label: "Active streak",
        streakCurrent: 6,
        dots: activeDots,
        note: "Bạn đã luyện hôm nay. Email streak rescue sẽ không được gửi trong case này.",
      }),
      streakCasePreview({
        key: "at-risk",
        label: "At risk",
        streakCurrent: 6,
        dots: atRiskDots,
        note: "Hoạt động cuối là hôm qua theo giờ Việt Nam. Đây là case được phép gửi streak rescue.",
      }),
      streakCasePreview({
        key: "zero",
        label: "Zero streak",
        streakCurrent: 0,
        dots: zeroDots,
        note: "Không có streak hiện tại, nên hệ thống không được gửi streak rescue tự động.",
      }),
      streakCasePreview({
        key: "repaired",
        label: "Profile repaired",
        streakCurrent: 3,
        dots: repairedDots,
        note: "Profile cũ có thể sai, nhưng email hiển thị streak đã tính lại từ activity thật.",
      }),
    ]),
  ]);

  return (
    <main className="min-h-screen overflow-x-hidden bg-background text-on-surface">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <p className="text-sm font-bold uppercase tracking-[0.12em] text-primary-dim">Thinkfy email QA</p>
          <h1 className="mt-2 text-3xl font-extrabold text-[#0B1424]">Email system preview</h1>
          <p className="mt-2 w-full max-w-[calc(100vw-2rem)] text-sm leading-6 text-on-surface-variant sm:max-w-3xl">
            Development-only fixture page for visual QA of rendered lifecycle emails and the admin email monitor.
          </p>
        </div>
      </div>

      <EmailMonitorDashboard data={getEmailAdminFixtureData()} />

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-extrabold text-[#0B1424]">Rendered email templates</h2>
            <p className="mt-1 w-full max-w-[calc(100vw-2rem)] text-sm text-on-surface-variant sm:max-w-none">
              These iframes use the production renderer and Vietnamese default copy.
            </p>
          </div>
        </div>

        <div className="grid min-w-0 grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {previews.map((preview) => (
            <article
              key={preview.templateKey}
              className="mx-auto w-full min-w-0 max-w-full overflow-hidden rounded-3xl border border-outline-variant/40 bg-surface-container-lowest shadow-[0_18px_42px_-34px_rgba(11,20,36,0.35)] sm:max-w-[430px]"
            >
              <div className="border-b border-outline-variant/40 px-5 py-4">
                <h3 className="text-base font-bold text-[#0B1424]">
                  {preview.templateKey.replaceAll("_", " ")}
                </h3>
                <p className="mt-1 truncate text-xs text-muted-foreground">{preview.subject}</p>
              </div>
              <iframe
                title={`${preview.templateKey} email preview`}
                srcDoc={preview.html}
                className="h-[760px] w-full bg-[#F7FAFE]"
              />
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-10 sm:px-6 lg:px-8">
        <div className="mb-5">
          <h2 className="text-2xl font-extrabold text-[#0B1424]">Streak correctness fixtures</h2>
          <p className="mt-1 w-full max-w-[calc(100vw-2rem)] text-sm text-on-surface-variant sm:max-w-none">
            Mobile Gmail-style previews for active, at-risk, zero, and repaired streak states.
          </p>
        </div>

        <div className="grid min-w-0 grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
          {streakCases.map((preview) => (
            <article
              key={preview.key}
              className="mx-auto w-full min-w-0 max-w-full overflow-hidden rounded-3xl border border-outline-variant/40 bg-surface-container-lowest shadow-[0_18px_42px_-34px_rgba(11,20,36,0.35)] sm:max-w-[390px]"
            >
              <div className="border-b border-outline-variant/40 px-5 py-4">
                <h3 className="text-base font-bold text-[#0B1424]">{preview.label}</h3>
                <p className="mt-1 truncate text-xs text-muted-foreground">{preview.subject}</p>
              </div>
              <iframe
                title={`${preview.key} streak email preview`}
                srcDoc={preview.html}
                className="h-[720px] w-full bg-[#F7FAFE]"
              />
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
