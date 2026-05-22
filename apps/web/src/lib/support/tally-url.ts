export const TALLY_BUG_REPORT_HIDDEN_FIELDS = [
  "userId",
  "email",
  "locale",
  "route",
  "source",
  "userAgent",
  "viewport",
  "timestamp",
] as const;

export type TallyBugReportHiddenField =
  (typeof TALLY_BUG_REPORT_HIDDEN_FIELDS)[number];

export type TallyBugReportContext = Partial<
  Record<TallyBugReportHiddenField, string | null | undefined>
>;

const TALLY_EMBED_PARAMS: Record<string, string> = {
  alignLeft: "1",
  hideTitle: "1",
  transparentBackground: "1",
};

function isSupportedTallyUrl(url: URL) {
  return url.protocol === "https:" && (
    url.hostname === "tally.so" ||
    url.hostname.endsWith(".tally.so")
  );
}

export function getConfiguredTallyBugReportFormUrl(locale?: string) {
  if (locale?.toLowerCase().startsWith("vi")) {
    const vietnameseFormUrl =
      process.env.NEXT_PUBLIC_TALLY_BUG_REPORT_FORM_URL_VI?.trim();

    if (vietnameseFormUrl) {
      return vietnameseFormUrl;
    }
  }

  return process.env.NEXT_PUBLIC_TALLY_BUG_REPORT_FORM_URL?.trim() ?? "";
}

export function buildTallyBugReportUrl(
  formUrl: string,
  context: TallyBugReportContext
) {
  let url: URL;

  try {
    url = new URL(formUrl);
  } catch {
    return null;
  }

  if (!isSupportedTallyUrl(url)) {
    return null;
  }

  for (const [key, value] of Object.entries(TALLY_EMBED_PARAMS)) {
    if (!url.searchParams.has(key)) {
      url.searchParams.set(key, value);
    }
  }

  for (const key of TALLY_BUG_REPORT_HIDDEN_FIELDS) {
    const value = context[key];
    if (typeof value === "string" && value.trim()) {
      url.searchParams.set(key, value.trim());
    }
  }

  return url.toString();
}
