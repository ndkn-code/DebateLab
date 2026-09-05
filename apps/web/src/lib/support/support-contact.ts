const DEFAULT_SUPPORT_EMAIL = "support@thinkfy.net";

function isSupportedEmail(value: string) {
  return /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(value);
}

export function getConfiguredSupportEmail() {
  const configured = [
    process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim(),
    process.env.NEXT_PUBLIC_PRIVACY_EMAIL?.trim(),
  ].find((value): value is string => Boolean(value && isSupportedEmail(value)));

  return configured ?? DEFAULT_SUPPORT_EMAIL;
}

export function buildSupportMailtoUrl({
  locale,
  route,
}: {
  locale?: string;
  route?: string;
}) {
  const subject = locale?.toLowerCase().startsWith("vi")
    ? "Hỗ trợ Thinkfy"
    : "Thinkfy support request";
  const body = route
    ? locale?.toLowerCase().startsWith("vi")
      ? `Trang gặp vấn đề: ${route}\n\nMô tả vấn đề của bạn:`
      : `Page where this happened: ${route}\n\nPlease describe the issue:`
    : undefined;
  const params = new URLSearchParams({ subject });

  if (body) params.set("body", body);

  return `mailto:${getConfiguredSupportEmail()}?${params.toString()}`;
}
