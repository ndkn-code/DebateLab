const TEMPLATE_KEYS = new Set([
  "welcome", "onboarding_nudge", "practice_reminder", "streak_rescue", "winback",
  "weekly_progress", "achievement", "course_nudge", "club_invitation",
]);

const CATEGORIES = new Set([
  "onboarding", "practice", "streak", "progress", "achievement", "course", "system",
]);

const TEMPLATE_CATEGORIES = Object.freeze({
  welcome: "onboarding", onboarding_nudge: "onboarding", practice_reminder: "practice",
  streak_rescue: "streak", winback: "practice", weekly_progress: "progress",
  achievement: "achievement", course_nudge: "course", club_invitation: "system",
});

const EMAIL_COPY = Object.freeze({
  en: {
    greeting: (name) => `Hi ${name},`,
    open: "Open Thinkfy",
    manage: "Manage email preferences",
    why: "You received this message because it relates to your Thinkfy account or learning activity.",
  },
  vi: {
    greeting: (name) => `Chào ${name},`,
    open: "Mở Thinkfy",
    manage: "Quản lý tùy chọn email",
    why: "Bạn nhận được thông báo này vì nội dung liên quan đến tài khoản hoặc hoạt động học tập trên Thinkfy.",
  },
});

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

function safeUrl(value, fallback) {
  if (typeof value !== "string" || value.trim() === "") return fallback;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : fallback;
  } catch {
    return fallback;
  }
}

function localeFor(recipient) {
  return recipient.preferences?.preferred_locale === "en" ? "en" : "vi";
}

export function buildEmailContent(event, recipient, _job, appBaseUrl) {
  const payload = event.payload && typeof event.payload === "object" ? event.payload : {};
  const locale = localeFor(recipient);
  const copy = EMAIL_COPY[locale];
  const templateKey = TEMPLATE_KEYS.has(payload.templateKey)
    ? payload.templateKey
    : TEMPLATE_KEYS.has(event.event_type) ? event.event_type : null;
  if (!templateKey) throw new Error(`Notification event ${event.event_type} has no supported email template.`);
  const category = CATEGORIES.has(payload.category) ? payload.category : TEMPLATE_CATEGORIES[templateKey] || "system";
  const variables = payload.variables && typeof payload.variables === "object" && !Array.isArray(payload.variables)
    ? payload.variables : {};
  const localizedPrefix = locale === "en" ? "en/" : "";
  const baseUrl = appBaseUrl.replace(/\/$/, "");
  const ctaUrl = safeUrl(variables.ctaUrl, `${baseUrl}/${localizedPrefix}dashboard`);
  const ctaLabel = typeof variables.ctaLabel === "string" && variables.ctaLabel.trim() ? variables.ctaLabel.trim() : copy.open;
  const userName = recipient.display_name?.trim() || recipient.email?.split("@")[0] || (locale === "en" ? "there" : "bạn");
  const headline = typeof variables.headline === "string" && variables.headline.trim() ? variables.headline : event.title;
  const body = typeof variables.body === "string" && variables.body.trim() ? variables.body : event.body;
  const preheader = typeof variables.preheader === "string" && variables.preheader.trim() ? variables.preheader : body;
  const optionalMessage = event.message_class === "lifecycle" || event.message_class === "marketing";
  const unsubscribeUrl = optionalMessage ? safeUrl(variables.unsubscribeUrl, `${baseUrl}/${localizedPrefix}settings`) : null;
  const oneClickUnsubscribeUrl = optionalMessage ? safeUrl(variables.oneClickUnsubscribeUrl, null) : null;
  const subject = event.title;
  const escapedBody = escapeHtml(body).replaceAll("\n", "<br>");

  const html = `<!doctype html>
<html lang="${locale}" dir="ltr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <meta name="theme-color" content="#f5f5f2">
  <title>${escapeHtml(subject)}</title>
  <style>
    @media (prefers-color-scheme: dark) {
      .email-body { background: #111111 !important; }
      .email-card { background: #1b1b1b !important; border-color: #3a3a3a !important; }
      .email-heading, .email-copy { color: #f5f5f2 !important; }
      .email-footer { color: #c7c7c7 !important; }
      .email-link { color: #78b9ff !important; }
    }
  </style>
</head>
<body class="email-body" style="margin:0;background:#f5f5f2;color:#333333;font-family:Inter,Arial,sans-serif">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${escapeHtml(preheader)}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background:#f5f5f2">
    <tr><td align="center" style="padding:32px 16px">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px">
        <tr><td class="email-card" style="background:#ffffff;border:1px solid #d8d8d4;border-radius:12px;padding:28px">
          <p style="margin:0 0 20px;font-size:13px;line-height:16px;color:#333333;font-weight:700;letter-spacing:.08em">THINKFY</p>
          <p class="email-copy" style="margin:0 0 12px;font-size:14px;line-height:20px;color:#333333">${escapeHtml(copy.greeting(userName))}</p>
          <h1 class="email-heading" style="margin:0 0 12px;font-size:24px;line-height:30px;font-weight:600;color:#333333">${escapeHtml(headline)}</h1>
          <p class="email-copy" style="margin:0 0 24px;font-size:16px;line-height:25px;color:#333333">${escapedBody}</p>
          <table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr>
            <td style="border-radius:10px;background:#222222"><a href="${escapeHtml(ctaUrl)}" style="display:inline-block;padding:11px 18px;color:#ffffff;font-size:14px;line-height:20px;font-weight:600;text-decoration:none;border-radius:10px">${escapeHtml(ctaLabel)}</a></td>
          </tr></table>
        </td></tr>
        <tr><td class="email-footer" style="padding:20px 4px;color:#595959;font-size:13px;line-height:20px">
          <p style="margin:0 0 8px">${escapeHtml(copy.why)}</p>
          ${unsubscribeUrl ? `<p style="margin:0"><a class="email-link" href="${escapeHtml(unsubscribeUrl)}" style="color:#005fb8;text-decoration:underline">${escapeHtml(copy.manage)}</a></p>` : ""}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const text = `${copy.greeting(userName)}\n\n${headline}\n\n${body}\n\n${ctaLabel}: ${ctaUrl}\n\n${copy.why}${unsubscribeUrl ? `\n\n${copy.manage}: ${unsubscribeUrl}` : ""}`;
  return { templateKey, category, locale, subject, html, text, ctaUrl, unsubscribeUrl, oneClickUnsubscribeUrl };
}

export function senderStreamForMessageClass(messageClass) {
  return messageClass === "lifecycle" || messageClass === "marketing" ? "updates" : "notifications";
}

export function isEmailAllowed({ event, settings, preference, emailSendingEnabled = true, updatesSendingEnabled = true }) {
  if (!emailSendingEnabled || preference?.enabled === false) return false;
  if (event.message_class === "transactional") return true;
  if (!updatesSendingEnabled) return false;
  return settings?.email_enabled === true;
}
