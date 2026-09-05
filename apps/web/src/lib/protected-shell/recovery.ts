import { resolveAuthRedirect } from "@/lib/auth/redirects";

export function recoveryDestination(next: string | null | undefined, locale: string) {
  const local = locale === "vi" ? "vi" : "en";
  const unlocalized = (next ?? "").replace(/^\/(?:en|vi)(?=\/|$)/, "") || "/dashboard";
  return `/${local}${resolveAuthRedirect(unlocalized)}`;
}

export function shellRecoveryUrl(path: string, locale: string) {
  return `/${locale === "vi" ? "vi" : "en"}/auth/recovery?${new URLSearchParams({ next: recoveryDestination(path, locale) })}`;
}
