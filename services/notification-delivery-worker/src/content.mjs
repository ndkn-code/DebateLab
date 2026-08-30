const TEMPLATE_KEYS = new Set([
  "welcome",
  "onboarding_nudge",
  "practice_reminder",
  "streak_rescue",
  "winback",
  "weekly_progress",
  "achievement",
  "course_nudge",
  "club_invitation",
]);

const CATEGORIES = new Set([
  "onboarding",
  "practice",
  "streak",
  "progress",
  "achievement",
  "course",
  "system",
]);
const TEMPLATE_CATEGORIES = Object.freeze({
  welcome: "onboarding",
  onboarding_nudge: "onboarding",
  practice_reminder: "practice",
  streak_rescue: "streak",
  winback: "practice",
  weekly_progress: "progress",
  achievement: "achievement",
  course_nudge: "course",
  club_invitation: "system",
});

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function safeUrl(value, fallback) {
  if (typeof value !== "string" || value.trim() === "") return fallback;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return fallback;
    return url.toString();
  } catch {
    return fallback;
  }
}

function localeFor(recipient) {
  return recipient.preferences?.preferred_locale === "en" ? "en" : "vi";
}

export function buildEmailContent(event, recipient, job, appBaseUrl) {
  const payload = event.payload && typeof event.payload === "object" ? event.payload : {};
  const locale = localeFor(recipient);
  const templateKey = TEMPLATE_KEYS.has(payload.templateKey)
    ? payload.templateKey
    : TEMPLATE_KEYS.has(event.event_type)
      ? event.event_type
      : null;
  if (!templateKey) {
    throw new Error(`Notification event ${event.event_type} has no supported email template.`);
  }
  const category = CATEGORIES.has(payload.category)
    ? payload.category
    : TEMPLATE_CATEGORIES[templateKey] || "system";
  const variables =
    payload.variables && typeof payload.variables === "object" && !Array.isArray(payload.variables)
      ? payload.variables
      : {};
  const fallbackAppUrl = `${appBaseUrl.replace(/\/$/, "")}/${locale === "en" ? "en/" : ""}dashboard`;
  const ctaUrl = safeUrl(variables.ctaUrl, fallbackAppUrl);
  const ctaLabel = typeof variables.ctaLabel === "string" && variables.ctaLabel.trim()
    ? variables.ctaLabel.trim()
    : locale === "en" ? "Open Thinkfy" : "Mở Thinkfy";
  const userName = recipient.display_name?.trim() || recipient.email?.split("@")[0] || (locale === "en" ? "debater" : "bạn");
  const headline = typeof variables.headline === "string" && variables.headline.trim() ? variables.headline : event.title;
  const body = typeof variables.body === "string" && variables.body.trim() ? variables.body : event.body;
  const preheader = typeof variables.preheader === "string" && variables.preheader.trim() ? variables.preheader : body;
  const unsubscribeUrl = event.message_class === "lifecycle" || event.message_class === "marketing"
    ? safeUrl(variables.unsubscribeUrl, `${appBaseUrl.replace(/\/$/, "")}/${locale === "en" ? "en/" : ""}settings`)
    : null;
  const oneClickUnsubscribeUrl = event.message_class === "lifecycle" || event.message_class === "marketing"
    ? safeUrl(variables.oneClickUnsubscribeUrl, null)
    : null;
  const subject = event.title;
  const html = `<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(subject)}</title></head><body style="margin:0;background:#f3fcfe;color:#102936;font-family:Arial,sans-serif"><div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(preheader)}</div><main style="max-width:600px;margin:0 auto;padding:32px 20px"><section style="background:#fff;border:1px solid #cdecf3;border-radius:12px;padding:28px"><p style="font-size:13px;color:#0788a0;font-weight:700">THINKFY</p><h1 style="font-size:25px;line-height:1.25">${escapeHtml(headline)}</h1><p style="font-size:16px;line-height:1.6">${escapeHtml(body).replaceAll("\n", "<br>")}</p><p><a href="${escapeHtml(ctaUrl)}" style="display:inline-block;background:#0788a0;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none">${escapeHtml(ctaLabel)}</a></p></section><footer style="padding:20px 4px;color:#657b84;font-size:12px;line-height:1.5"><p>${escapeHtml(locale === "en" ? `You received this because you use Thinkfy, ${userName}.` : `Bạn nhận được email này vì đang sử dụng Thinkfy, ${userName}.`)}</p>${unsubscribeUrl ? `<p><a href="${escapeHtml(unsubscribeUrl)}">${escapeHtml(locale === "en" ? "Manage email preferences" : "Quản lý email")}</a></p>` : ""}</footer></main></body></html>`;
  const text = `${headline}\n\n${body}\n\n${ctaLabel}: ${ctaUrl}${unsubscribeUrl ? `\n\nManage email preferences: ${unsubscribeUrl}` : ""}`;
  return {
    templateKey,
    category,
    locale,
    subject,
    html,
    text,
    ctaUrl,
    unsubscribeUrl,
    oneClickUnsubscribeUrl,
  };
}

export function senderStreamForMessageClass(messageClass) {
  return messageClass === "lifecycle" || messageClass === "marketing" ? "updates" : "notifications";
}

export function isEmailAllowed({ event, settings, preference, emailSendingEnabled = true, updatesSendingEnabled = true }) {
  if (!emailSendingEnabled) return false;
  if (preference?.enabled === false) return false;
  if (event.message_class === "transactional") return true;
  if (!updatesSendingEnabled) return false;
  return settings?.email_enabled === true;
}
