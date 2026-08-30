import React from "react";
import { render, toPlainText } from "@react-email/render";
import {
  getCoursesUrl,
  getDashboardUrl,
  getEmailSettingsUrl,
  getPracticeUrl,
  getPublicAssetUrl,
  getSupportEmailAddress,
} from "@/lib/email/config";
import type {
  EmailCategory,
  EmailLocale,
  EmailStreakDot,
  EmailTemplateKey,
  EmailTemplateVariables,
  RenderedEmail,
} from "@/lib/email/types";

export const EMAIL_TEMPLATE_META: Record<
  EmailTemplateKey,
  {
    category: EmailCategory;
    preference: "practice" | "streak" | "achievement" | "global";
  }
> = {
  welcome: { category: "onboarding", preference: "global" },
  onboarding_nudge: { category: "onboarding", preference: "global" },
  practice_reminder: { category: "practice", preference: "practice" },
  streak_rescue: { category: "streak", preference: "streak" },
  winback: { category: "practice", preference: "practice" },
  weekly_progress: { category: "progress", preference: "achievement" },
  achievement: { category: "achievement", preference: "achievement" },
  course_nudge: { category: "course", preference: "practice" },
  club_invitation: { category: "system", preference: "global" },
};

const palette = {
  background: "#F5F5F2",
  surface: "#FFFFFF",
  surfaceAlt: "#F1F1EE",
  border: "#D9D9D4",
  primary: "#333333",
  primaryDark: "#111111",
  primarySoft: "#E9F3FF",
  link: "#005EA8",
  heading: "#333333",
  text: "#555555",
  muted: "#666666",
  success: "#157A32",
  warning: "#A85B00",
  coral: "#A12B20",
};

export const EMAIL_ACCESSIBLE_PALETTE = palette;

function whyReceivedCopy(templateKey: EmailTemplateKey, locale: EmailLocale) {
  const en: Record<EmailTemplateKey, string> = {
    welcome: "You receive this because you created a Thinkfy account.",
    onboarding_nudge:
      "You receive this because your Thinkfy setup is not complete.",
    practice_reminder:
      "You receive this because practice reminder emails are on.",
    streak_rescue: "You receive this because study consistency emails are on.",
    winback: "You receive this because practice reminder emails are on.",
    weekly_progress: "You receive this because weekly progress emails are on.",
    achievement: "You receive this because milestone emails are on.",
    course_nudge: "You receive this because course reminder emails are on.",
    club_invitation:
      "You receive this because a teacher or club invited this email address.",
  };
  const vi: Record<EmailTemplateKey, string> = {
    welcome: "Bạn nhận email này vì đã tạo tài khoản Thinkfy.",
    onboarding_nudge: "Bạn nhận email này vì chưa hoàn tất thiết lập Thinkfy.",
    practice_reminder: "Bạn nhận email này vì email nhắc luyện tập đang bật.",
    streak_rescue: "Bạn nhận email này vì email nhắc nhịp học đang bật.",
    winback: "Bạn nhận email này vì email nhắc luyện tập đang bật.",
    weekly_progress: "Bạn nhận email này vì email tổng kết tuần đang bật.",
    achievement: "Bạn nhận email này vì email cột mốc đang bật.",
    course_nudge: "Bạn nhận email này vì email nhắc khóa học đang bật.",
    club_invitation:
      "Bạn nhận email này vì giáo viên hoặc câu lạc bộ đã mời địa chỉ email này.",
  };
  return locale === "vi" ? vi[templateKey] : en[templateKey];
}

export interface TemplateContext {
  userName: string;
  locale: EmailLocale;
  sessionsLast7Days?: number;
  minutesLast7Days?: number;
  xpLast7Days?: number;
  bestScoreLast7Days?: number | null;
  streakCurrent?: number;
  streakDots?: EmailStreakDot[];
  level?: number;
  totalSessions?: number;
  latestCourseTitle?: string | null;
  latestAchievementLabel?: string | null;
  ctaUrl?: string | null;
  clubName?: string | null;
  clubRole?: string | null;
  inviterName?: string | null;
  city?: string | null;
}

function numberFormat(locale: EmailLocale) {
  return new Intl.NumberFormat(locale === "en" ? "en-US" : "vi-VN");
}

function baseVariables(context: TemplateContext) {
  return {
    userName: context.userName || (context.locale === "en" ? "debater" : "bạn"),
    appUrl: getDashboardUrl(context.locale),
    settingsUrl: getEmailSettingsUrl(context.locale),
    supportEmail: getSupportEmailAddress(),
    locale: context.locale,
  };
}

export function buildTemplateVariables(
  templateKey: EmailTemplateKey,
  context: TemplateContext,
): EmailTemplateVariables & { subject: string } {
  const base = baseVariables(context);
  const formatter = numberFormat(context.locale);
  const practiceUrl = getPracticeUrl(context.locale);
  const coursesUrl = getCoursesUrl(context.locale);
  const sessions = context.sessionsLast7Days ?? 0;
  const minutes = context.minutesLast7Days ?? 0;
  const xp = context.xpLast7Days ?? 0;
  const bestScore = context.bestScoreLast7Days;
  const streak = Math.max(0, context.streakCurrent ?? 0);
  const totalSessions = context.totalSessions ?? 0;
  const level = context.level ?? 1;
  const courseTitle =
    context.latestCourseTitle ||
    (context.locale === "en" ? "your course" : "khóa học của bạn");
  const achievement =
    context.latestAchievementLabel ||
    (context.locale === "en"
      ? "New milestone unlocked"
      : "Cột mốc mới đã mở khóa");
  const clubName =
    context.clubName || (context.locale === "en" ? "your club" : "CLB của bạn");
  const clubRole =
    context.clubRole || (context.locale === "en" ? "member" : "thành viên");
  const inviterName = context.inviterName || "Thinkfy";
  const clubCity = context.city || "Vietnam";
  const clubInviteUrl = context.ctaUrl || base.appUrl;

  if (context.locale === "en") {
    const en: Record<
      EmailTemplateKey,
      EmailTemplateVariables & { subject: string }
    > = {
      welcome: {
        ...base,
        subject: "Win from your first practice",
        ctaUrl: practiceUrl,
        ctaLabel: "Start first practice",
        headline: "Your debate plan starts here.",
        body: "Take one short round today. Thinkfy will turn the messy parts into your next clear step.",
        preheader: "Your first useful debate rep is waiting.",
        mascotMood: "welcome",
        badgeLabel: "Day 1",
        stat1Label: "Goal",
        stat1Value: "10 min",
        stat2Label: "Mode",
        stat2Value: "Practice",
      },
      onboarding_nudge: {
        ...base,
        subject: "One step until Thinkfy knows you better",
        ctaUrl: base.appUrl,
        ctaLabel: "Finish setup",
        headline: "Finish setup so practice hits the right weak spot.",
        body: "Tell Thinkfy where you are starting. The next practice will feel less random and more useful.",
        preheader: "Personalized debate practice is one setup step away.",
        mascotMood: "nudge",
        badgeLabel: "Setup",
        stat1Label: "Needed",
        stat1Value: "1 step",
      },
      practice_reminder: {
        ...base,
        subject: "10 minutes today still counts",
        ctaUrl: practiceUrl,
        ctaLabel: "Practice 10 minutes",
        headline: "Do not let your debate skills cool off.",
        body: "A quick round keeps your argument muscles warm and gives Thinkfy fresh feedback to work with.",
        preheader: "Take one short practice round today.",
        mascotMood: "nudge",
        badgeLabel: "Tiny win",
        stat1Label: "This week",
        stat1Value: `${formatter.format(sessions)} sessions`,
        stat2Label: "Minutes",
        stat2Value: formatter.format(minutes),
      },
      streak_rescue: {
        ...base,
        subject: "Your streak can still be saved today",
        ctaUrl: practiceUrl,
        ctaLabel: "Keep streak",
        headline: "Keep the practice chain alive before the day ends.",
        body: "One focused round today keeps your streak moving. Small rep, real momentum.",
        preheader: `${formatter.format(streak)}-day streak. One practice keeps it alive.`,
        mascotMood: "warning",
        badgeLabel: "At risk",
        stat1Label: "Streak",
        stat1Value: formatter.format(streak),
        stat2Label: "Needed",
        stat2Value: "1 round",
        streakDots: context.streakDots,
      },
      winback: {
        ...base,
        subject: "Not goodbye",
        ctaUrl: practiceUrl,
        ctaLabel: "Resume practice",
        headline: "Your next practice is still waiting.",
        body: "You do not need a grand comeback. Five focused minutes is enough to restart the loop.",
        preheader: "Pick up with one small round.",
        mascotMood: "winback",
        badgeLabel: "Comeback",
        stat1Label: "Start",
        stat1Value: "5 min",
      },
      weekly_progress: {
        ...base,
        subject: "How much sharper did you get this week?",
        ctaUrl: base.appUrl,
        ctaLabel: "View progress",
        headline: "Here is your weekly progress board.",
        body: "Sessions, minutes, XP, and best score. Enough signal to know what to train next.",
        preheader: `${formatter.format(sessions)} sessions, ${formatter.format(minutes)} minutes, ${formatter.format(xp)} XP.`,
        mascotMood: "celebrate",
        badgeLabel: "Weekly",
        stat1Label: "Sessions",
        stat1Value: formatter.format(sessions),
        stat2Label: "Minutes",
        stat2Value: formatter.format(minutes),
        stat3Label: "Best score",
        stat3Value: bestScore == null ? "-" : formatter.format(bestScore),
      },
      achievement: {
        ...base,
        subject: "You just unlocked a new milestone",
        ctaUrl: base.appUrl,
        ctaLabel: "See achievement",
        headline: achievement,
        body: `Level ${formatter.format(level)} and ${formatter.format(totalSessions)} completed practices. That is progress you can point at.`,
        preheader: "A real Thinkfy milestone just landed.",
        mascotMood: "celebrate",
        badgeLabel: "Unlocked",
        stat1Label: "Level",
        stat1Value: formatter.format(level),
        stat2Label: "Sessions",
        stat2Value: formatter.format(totalSessions),
      },
      course_nudge: {
        ...base,
        subject: "That course is still mid-argument",
        ctaUrl: coursesUrl,
        ctaLabel: "Continue course",
        headline: "Continue exactly where you stopped.",
        body: `${courseTitle} is still open. One lesson today keeps the thread from going cold.`,
        preheader: "Your next course lesson is ready.",
        mascotMood: "nudge",
        badgeLabel: "Course",
        stat1Label: "Next step",
        stat1Value: "1 lesson",
      },
      club_invitation: {
        ...base,
        subject: `Join ${clubName} on Thinkfy`,
        ctaUrl: clubInviteUrl,
        ctaLabel: "Accept invitation",
        headline: `${clubName} invited you to Thinkfy.`,
        body: `${inviterName} added you as ${clubRole}. Accept the invitation with the same email address to join the club workspace.`,
        preheader: `Accept your ${clubName} club invitation.`,
        mascotMood: "welcome",
        badgeLabel: "Club invite",
        stat1Label: "Role",
        stat1Value: clubRole,
        stat2Label: "City",
        stat2Value: clubCity,
      },
    };

    return {
      ...en[templateKey],
      whyReceived: whyReceivedCopy(templateKey, context.locale),
    };
  }

  const vi: Record<
    EmailTemplateKey,
    EmailTemplateVariables & { subject: string }
  > = {
    welcome: {
      ...base,
      subject: "Bắt đầu thắng từ bài luyện đầu tiên",
      ctaUrl: practiceUrl,
      ctaLabel: "Luyện bài đầu tiên",
      headline: "Kế hoạch debate của bạn bắt đầu ở đây.",
      body: "Làm một round ngắn hôm nay. Thinkfy sẽ biến phần còn lộn xộn thành bước luyện tiếp theo.",
      preheader: "Bài luyện debate đầu tiên đang chờ bạn.",
      mascotMood: "welcome",
      badgeLabel: "Ngày 1",
      stat1Label: "Mục tiêu",
      stat1Value: "10 phút",
      stat2Label: "Chế độ",
      stat2Value: "Luyện tập",
    },
    onboarding_nudge: {
      ...base,
      subject: "Còn 1 bước là Thinkfy hiểu bạn hơn",
      ctaUrl: base.appUrl,
      ctaLabel: "Hoàn tất setup",
      headline: "Setup nốt để luyện đúng điểm yếu.",
      body: "Cho Thinkfy biết bạn đang ở đâu. Bài luyện tiếp theo sẽ bớt đoán mò và hữu ích hơn.",
      preheader: "Cá nhân hóa lộ trình chỉ còn một bước.",
      mascotMood: "nudge",
      badgeLabel: "Setup",
      stat1Label: "Còn lại",
      stat1Value: "1 bước",
    },
    practice_reminder: {
      ...base,
      subject: "10 phút hôm nay vẫn tính là tiến bộ",
      ctaUrl: practiceUrl,
      ctaLabel: "Luyện 10 phút",
      headline: "Đừng để kỹ năng debate nguội đi.",
      body: "Một round nhanh giữ nhịp lập luận và cho Thinkfy dữ liệu mới để phản hồi đúng hơn.",
      preheader: "Làm một bài luyện ngắn hôm nay.",
      mascotMood: "nudge",
      badgeLabel: "Thắng nhỏ",
      stat1Label: "Tuần này",
      stat1Value: `${formatter.format(sessions)} buổi`,
      stat2Label: "Số phút",
      stat2Value: formatter.format(minutes),
    },
    streak_rescue: {
      ...base,
      subject: "Streak còn cứu được hôm nay",
      ctaUrl: practiceUrl,
      ctaLabel: "Giữ streak",
      headline: "Giữ mạch luyện trước khi hết ngày.",
      body: "Một round tập trung hôm nay là đủ để giữ streak chạy tiếp. Nhỏ thôi, nhưng có lực.",
      preheader: `${formatter.format(streak)} ngày streak. Một bài luyện là giữ được.`,
      mascotMood: "warning",
      badgeLabel: "Đang nguy hiểm",
      stat1Label: "Streak",
      stat1Value: formatter.format(streak),
      stat2Label: "Cần hôm nay",
      stat2Value: "1 bài",
      streakDots: context.streakDots,
    },
    winback: {
      ...base,
      subject: "Không phải tạm biệt đâu",
      ctaUrl: practiceUrl,
      ctaLabel: "Quay lại luyện",
      headline: "Bài luyện của bạn vẫn đang chờ.",
      body: "Không cần comeback hoành tráng. Năm phút tập trung là đủ để khởi động lại nhịp luyện.",
      preheader: "Quay lại bằng một round nhỏ.",
      mascotMood: "winback",
      badgeLabel: "Comeback",
      stat1Label: "Bắt đầu",
      stat1Value: "5 phút",
    },
    weekly_progress: {
      ...base,
      subject: "Tuần này bạn đã lên tay thế nào?",
      ctaUrl: base.appUrl,
      ctaLabel: "Xem tiến độ",
      headline: "Bảng tiến bộ tuần này đây.",
      body: "Số buổi, số phút, XP và điểm tốt nhất. Đủ tín hiệu để biết nên luyện gì tiếp.",
      preheader: `${formatter.format(sessions)} buổi, ${formatter.format(minutes)} phút, ${formatter.format(xp)} XP.`,
      mascotMood: "celebrate",
      badgeLabel: "Tuần này",
      stat1Label: "Số buổi",
      stat1Value: formatter.format(sessions),
      stat2Label: "Số phút",
      stat2Value: formatter.format(minutes),
      stat3Label: "Điểm tốt nhất",
      stat3Value: bestScore == null ? "-" : formatter.format(bestScore),
    },
    achievement: {
      ...base,
      subject: "Bạn vừa mở khóa một cột mốc mới",
      ctaUrl: base.appUrl,
      ctaLabel: "Xem thành tích",
      headline: achievement,
      body: `Level ${formatter.format(level)}, ${formatter.format(totalSessions)} buổi luyện đã xong. Đây là tiến bộ nhìn thấy được.`,
      preheader: "Một cột mốc Thinkfy mới vừa xuất hiện.",
      mascotMood: "celebrate",
      badgeLabel: "Mở khóa",
      stat1Label: "Level",
      stat1Value: formatter.format(level),
      stat2Label: "Số buổi",
      stat2Value: formatter.format(totalSessions),
    },
    course_nudge: {
      ...base,
      subject: "Khóa học còn dang dở kìa",
      ctaUrl: coursesUrl,
      ctaLabel: "Học tiếp",
      headline: "Tiếp tục đúng nơi bạn đã dừng.",
      body: `${courseTitle} vẫn đang mở. Một bài hôm nay giữ mạch học khỏi nguội.`,
      preheader: "Bài học tiếp theo đã sẵn sàng.",
      mascotMood: "nudge",
      badgeLabel: "Khóa học",
      stat1Label: "Bước tiếp",
      stat1Value: "1 bài",
    },
    club_invitation: {
      ...base,
      subject: `Tham gia ${clubName} trên Thinkfy`,
      ctaUrl: clubInviteUrl,
      ctaLabel: "Nhận lời mời",
      headline: `${clubName} đã mời bạn vào Thinkfy.`,
      body: `${inviterName} đã thêm bạn với vai trò ${clubRole}. Hãy nhận lời mời bằng đúng email này để vào workspace của câu lạc bộ.`,
      preheader: `Nhận lời mời tham gia ${clubName}.`,
      mascotMood: "welcome",
      badgeLabel: "Lời mời CLB",
      stat1Label: "Vai trò",
      stat1Value: clubRole,
      stat2Label: "Thành phố",
      stat2Value: clubCity,
    },
  };

  return {
    ...vi[templateKey],
    whyReceived: whyReceivedCopy(templateKey, context.locale),
  };
}

function StatCell({
  label,
  value,
  width,
}: {
  label?: string;
  value?: string;
  width: string;
}) {
  if (!label || !value) return null;

  return (
    <td
      className="thinkfy-stat-cell"
      width={width}
      valign="top"
      style={{
        paddingTop: 6,
        paddingRight: 6,
        paddingBottom: 6,
        paddingLeft: 6,
      }}
    >
      <table
        role="presentation"
        width="100%"
        cellPadding="0"
        cellSpacing="0"
        border={0}
        style={{
          borderCollapse: "separate",
          backgroundColor: palette.surfaceAlt,
          borderColor: palette.border,
          borderStyle: "solid",
          borderWidth: 1,
          borderRadius: 14,
        }}
      >
        <tbody>
          <tr>
            <td
              align="center"
              style={{
                paddingTop: 14,
                paddingRight: 8,
                paddingBottom: 2,
                paddingLeft: 8,
                color: palette.heading,
                fontFamily: "Arial, Helvetica, sans-serif",
                fontSize: 24,
                fontWeight: 900,
                lineHeight: "30px",
              }}
            >
              {value}
            </td>
          </tr>
          <tr>
            <td
              align="center"
              style={{
                paddingTop: 0,
                paddingRight: 8,
                paddingBottom: 14,
                paddingLeft: 8,
                color: palette.muted,
                fontFamily: "Arial, Helvetica, sans-serif",
                fontSize: 12,
                fontWeight: 800,
                lineHeight: "16px",
                textTransform: "uppercase",
              }}
            >
              {label}
            </td>
          </tr>
        </tbody>
      </table>
    </td>
  );
}

function Mascot({ mood }: { mood: EmailTemplateVariables["mascotMood"] }) {
  const borderColor =
    mood === "warning"
      ? palette.warning
      : mood === "winback"
        ? palette.coral
        : palette.primary;

  return (
    <table
      role="presentation"
      align="center"
      cellPadding="0"
      cellSpacing="0"
      border={0}
    >
      <tbody>
        <tr>
          <td
            align="center"
            valign="middle"
            style={{
              width: 116,
              height: 116,
              borderRadius: 30,
              backgroundColor: "#F3FCFE",
              borderColor,
              borderStyle: "solid",
              borderWidth: 2,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={getPublicAssetUrl("/coach/coach-pet-clean.png")}
              width="92"
              height="92"
              alt="Thinkfy coach"
              style={{
                display: "block",
                width: 92,
                height: 92,
                objectFit: "contain",
                marginTop: 8,
                marginRight: "auto",
                marginBottom: 0,
                marginLeft: "auto",
              }}
            />
          </td>
        </tr>
      </tbody>
    </table>
  );
}

function StreakDots({
  dots,
  isEnglish,
}: {
  dots?: EmailStreakDot[];
  isEnglish: boolean;
}) {
  if (!dots?.length) return null;

  return (
    <table
      role="presentation"
      width="100%"
      cellPadding="0"
      cellSpacing="0"
      border={0}
      style={{ marginTop: 14 }}
    >
      <tbody>
        <tr>
          {dots.map((dot) => (
            <td
              key={dot.date}
              align="center"
              style={{ width: "14.28%", paddingTop: 0, paddingBottom: 0 }}
            >
              <p
                style={{
                  marginTop: 0,
                  marginRight: 0,
                  marginBottom: 6,
                  marginLeft: 0,
                  color: dot.today ? palette.primaryDark : palette.muted,
                  fontFamily: "Arial, Helvetica, sans-serif",
                  fontSize: 11,
                  fontWeight: 800,
                  lineHeight: "14px",
                }}
              >
                {dot.label}
              </p>
              <span
                style={{
                  display: "inline-block",
                  width: 18,
                  height: 18,
                  borderRadius: 9,
                  backgroundColor: dot.active
                    ? palette.success
                    : palette.surfaceAlt,
                  borderColor: dot.today ? palette.warning : palette.border,
                  borderStyle: "solid",
                  borderWidth: 2,
                }}
              >
                <span
                  style={{
                    color: dot.active ? "#FFFFFF" : palette.muted,
                    fontFamily: "Arial, Helvetica, sans-serif",
                    fontSize: 11,
                    fontWeight: 900,
                    lineHeight: "14px",
                  }}
                >
                  {dot.active ? "✓" : "–"}
                </span>
              </span>
              <p
                style={{
                  marginTop: 4,
                  marginRight: 0,
                  marginBottom: 0,
                  marginLeft: 0,
                  color: palette.muted,
                  fontFamily: "Arial, Helvetica, sans-serif",
                  fontSize: 10,
                  fontWeight: 700,
                  lineHeight: "12px",
                }}
              >
                {dot.active
                  ? isEnglish
                    ? "Done"
                    : "Đã học"
                  : isEnglish
                    ? "Rest"
                    : "Nghỉ"}
              </p>
            </td>
          ))}
        </tr>
      </tbody>
    </table>
  );
}

function ThinkfyEmail({ variables }: { variables: EmailTemplateVariables }) {
  const isEnglish = variables.locale === "en";
  const stats = [
    { label: variables.stat1Label, value: variables.stat1Value },
    { label: variables.stat2Label, value: variables.stat2Value },
    { label: variables.stat3Label, value: variables.stat3Value },
  ].filter((stat): stat is { label: string; value: string } =>
    Boolean(stat.label && stat.value),
  );
  const statWidth = `${100 / Math.max(1, stats.length)}%`;

  return (
    <html lang={isEnglish ? "en" : "vi"} dir="ltr">
      {/* eslint-disable-next-line @next/next/no-head-element */}
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="color-scheme" content="light dark" />
        <meta name="supported-color-schemes" content="light dark" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <title>{variables.headline}</title>
        <style>
          {`
            body, table, td, p, h1, a { -webkit-text-size-adjust: 100%; }
            .thinkfy-container { max-width: 620px; }
            .thinkfy-headline { overflow-wrap: break-word; word-break: normal; }
            @media (prefers-color-scheme: dark) {
              .thinkfy-page { background-color: #000000 !important; }
              .thinkfy-container { background-color: #111111 !important; border-color: #333333 !important; }
              .thinkfy-footer, .thinkfy-stat-card { background-color: #1A1A1A !important; border-color: #333333 !important; }
              .thinkfy-container h1, .thinkfy-container p, .thinkfy-container td { color: #F5F5F2 !important; }
              .thinkfy-container a { color: #8EC5FF !important; }
              .thinkfy-cta { background-color: #F5F5F2 !important; color: #111111 !important; }
            }
            @media only screen and (max-width: 620px) {
              .thinkfy-outer-pad { padding-left: 12px !important; padding-right: 12px !important; }
              .thinkfy-container { width: 100% !important; max-width: 100% !important; border-radius: 22px !important; }
              .thinkfy-hero-pad { padding-left: 20px !important; padding-right: 20px !important; }
              .thinkfy-headline { font-size: 30px !important; line-height: 36px !important; }
              .thinkfy-stat-wrap { padding-left: 14px !important; padding-right: 14px !important; }
              .thinkfy-stat-cell { padding-left: 4px !important; padding-right: 4px !important; }
            }
            @media only screen and (max-width: 430px) {
              .thinkfy-headline { font-size: 28px !important; line-height: 34px !important; }
              .thinkfy-body { font-size: 15px !important; line-height: 24px !important; }
            }
          `}
        </style>
      </head>
      <body
        className="thinkfy-page"
        style={{ margin: 0, backgroundColor: palette.background }}
      >
        <div
          style={{
            display: "none",
            maxHeight: 0,
            overflow: "hidden",
            opacity: 0,
            color: palette.background,
            fontSize: 1,
            lineHeight: "1px",
          }}
        >
          {variables.preheader}
        </div>
        <table
          role="presentation"
          className="thinkfy-page"
          width="100%"
          cellPadding="0"
          cellSpacing="0"
          border={0}
          style={{ width: "100%", backgroundColor: palette.background }}
        >
          <tbody>
            <tr>
              <td
                className="thinkfy-outer-pad"
                align="center"
                style={{
                  paddingTop: 20,
                  paddingRight: 12,
                  paddingBottom: 24,
                  paddingLeft: 12,
                }}
              >
                <table
                  role="presentation"
                  className="thinkfy-container"
                  width="100%"
                  cellPadding="0"
                  cellSpacing="0"
                  border={0}
                  style={{
                    width: "100%",
                    maxWidth: 620,
                    backgroundColor: palette.surface,
                    borderColor: palette.border,
                    borderStyle: "solid",
                    borderWidth: 1,
                    borderRadius: 24,
                    overflow: "hidden",
                  }}
                >
                  <tbody>
                    <tr>
                      <td
                        className="thinkfy-hero-pad"
                        align="center"
                        style={{
                          paddingTop: 24,
                          paddingRight: 24,
                          paddingBottom: 10,
                          paddingLeft: 24,
                        }}
                      >
                        <p
                          style={{
                            marginTop: 0,
                            marginRight: 0,
                            marginBottom: 18,
                            marginLeft: 0,
                            color: palette.primaryDark,
                            fontFamily: "Arial, Helvetica, sans-serif",
                            fontSize: 22,
                            fontWeight: 900,
                            lineHeight: "28px",
                          }}
                        >
                          Thinkfy
                        </p>
                        <Mascot mood={variables.mascotMood} />
                        {variables.badgeLabel ? (
                          <p
                            style={{
                              display: "inline-block",
                              marginTop: 18,
                              marginRight: 0,
                              marginBottom: 12,
                              marginLeft: 0,
                              paddingTop: 6,
                              paddingRight: 12,
                              paddingBottom: 6,
                              paddingLeft: 12,
                              borderRadius: 999,
                              backgroundColor: palette.primarySoft,
                              color: palette.primaryDark,
                              fontFamily: "Arial, Helvetica, sans-serif",
                              fontSize: 12,
                              fontWeight: 900,
                              lineHeight: "16px",
                              textTransform: "uppercase",
                            }}
                          >
                            {variables.badgeLabel}
                          </p>
                        ) : null}
                        <h1
                          className="thinkfy-headline"
                          style={{
                            marginTop: 0,
                            marginRight: 0,
                            marginBottom: 12,
                            marginLeft: 0,
                            color: palette.heading,
                            fontFamily: "Arial, Helvetica, sans-serif",
                            fontSize: 32,
                            fontWeight: 900,
                            lineHeight: "38px",
                          }}
                        >
                          {variables.headline}
                        </h1>
                        <p
                          className="thinkfy-body"
                          style={{
                            marginTop: 0,
                            marginRight: "auto",
                            marginBottom: 22,
                            marginLeft: "auto",
                            maxWidth: 480,
                            color: palette.text,
                            fontFamily: "Arial, Helvetica, sans-serif",
                            fontSize: 16,
                            fontWeight: 500,
                            lineHeight: "25px",
                          }}
                        >
                          {variables.body}
                        </p>
                        <table
                          role="presentation"
                          align="center"
                          cellPadding="0"
                          cellSpacing="0"
                          border={0}
                        >
                          <tbody>
                            <tr>
                              <td
                                align="center"
                                style={{
                                  borderRadius: 16,
                                  backgroundColor: palette.primary,
                                  boxShadow: `0 4px 0 ${palette.primaryDark}`,
                                }}
                              >
                                <a
                                  href={variables.ctaUrl}
                                  className="thinkfy-cta"
                                  style={{
                                    display: "inline-block",
                                    paddingTop: 15,
                                    paddingRight: 24,
                                    paddingBottom: 15,
                                    paddingLeft: 24,
                                    minWidth: 190,
                                    color: palette.surface,
                                    fontFamily: "Arial, Helvetica, sans-serif",
                                    fontSize: 16,
                                    fontWeight: 900,
                                    lineHeight: "20px",
                                    textAlign: "center",
                                    textDecoration: "none",
                                  }}
                                >
                                  {variables.ctaLabel}
                                </a>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </td>
                    </tr>
                    <tr>
                      <td
                        className="thinkfy-stat-wrap"
                        style={{
                          paddingTop: 10,
                          paddingRight: 22,
                          paddingBottom: 28,
                          paddingLeft: 22,
                        }}
                      >
                        <table
                          role="presentation"
                          width="100%"
                          cellPadding="0"
                          cellSpacing="0"
                          border={0}
                        >
                          <tbody>
                            <tr>
                              {stats.map((stat) => (
                                <StatCell
                                  key={stat.label}
                                  label={stat.label}
                                  value={stat.value}
                                  width={statWidth}
                                />
                              ))}
                            </tr>
                          </tbody>
                        </table>
                        <StreakDots
                          dots={variables.streakDots}
                          isEnglish={isEnglish}
                        />
                      </td>
                    </tr>
                    <tr>
                      <td
                        className="thinkfy-footer"
                        style={{
                          paddingTop: 18,
                          paddingRight: 24,
                          paddingBottom: 22,
                          paddingLeft: 24,
                          backgroundColor: palette.surfaceAlt,
                          borderTopColor: palette.border,
                          borderTopStyle: "solid",
                          borderTopWidth: 1,
                        }}
                      >
                        <p
                          style={{
                            marginTop: 0,
                            marginRight: 0,
                            marginBottom: 8,
                            marginLeft: 0,
                            color: palette.muted,
                            fontFamily: "Arial, Helvetica, sans-serif",
                            fontSize: 12,
                            fontWeight: 500,
                            lineHeight: "18px",
                          }}
                        >
                          {variables.whyReceived ??
                            (isEnglish
                              ? "You receive this because Thinkfy email notifications are on."
                              : "Bạn nhận email này vì thông báo email Thinkfy đang bật.")}
                        </p>
                        <p
                          style={{
                            marginTop: 0,
                            marginRight: 0,
                            marginBottom: 0,
                            marginLeft: 0,
                            color: palette.muted,
                            fontFamily: "Arial, Helvetica, sans-serif",
                            fontSize: 12,
                            fontWeight: 500,
                            lineHeight: "18px",
                          }}
                        >
                          <a
                            href={variables.settingsUrl}
                            style={{
                              color: palette.link,
                              fontWeight: 800,
                              textDecoration: "underline",
                            }}
                          >
                            {isEnglish
                              ? "Manage email preferences"
                              : "Quản lý tuỳ chọn email"}
                          </a>
                          {variables.unsubscribeUrl ? (
                            <>
                              {" · "}
                              <a
                                href={variables.unsubscribeUrl}
                                style={{
                                  color: palette.link,
                                  fontWeight: 800,
                                  textDecoration: "underline",
                                }}
                              >
                                {isEnglish
                                  ? "Unsubscribe from this stream"
                                  : "Hủy nhận nhóm email này"}
                              </a>
                            </>
                          ) : null}
                          {" · "}
                          {isEnglish ? "Contact" : "Liên hệ"}:{" "}
                          {variables.supportEmail ?? "support@thinkfy.net"}
                        </p>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>
      </body>
    </html>
  );
}

export async function renderThinkfyEmail(input: {
  subject: string;
  variables: EmailTemplateVariables;
}): Promise<RenderedEmail> {
  const html = await render(<ThinkfyEmail variables={input.variables} />);
  const text = await toPlainText(html);

  return {
    subject: input.subject,
    html,
    text,
  };
}
