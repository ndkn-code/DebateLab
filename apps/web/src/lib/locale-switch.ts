export const APP_LOCALES = ["vi", "en"] as const;
export type AppLocale = (typeof APP_LOCALES)[number];

export function coerceAppLocale(locale: unknown): AppLocale {
  return locale === "en" || locale === "vi" ? locale : "vi";
}

export function stripAppLocalePrefix(pathname: string) {
  const normalizedPathname = pathname.startsWith("/")
    ? pathname
    : `/${pathname}`;

  return normalizedPathname.replace(/^\/(en|vi)(?=\/|$)/, "") || "/";
}

export function buildLocaleSwitchPath(
  pathname: string,
  searchParams: URLSearchParams,
) {
  const nextParams = new URLSearchParams(searchParams.toString());
  nextParams.delete("language");

  const hashIndex = pathname.indexOf("#");
  const hash = hashIndex >= 0 ? pathname.slice(hashIndex) : "";
  const pathnameWithoutHash =
    hashIndex >= 0 ? pathname.slice(0, hashIndex) : pathname;
  const pathWithoutLocale = stripAppLocalePrefix(pathnameWithoutHash);
  const pathSuffix = nextParams.toString() ? `?${nextParams.toString()}` : "";

  return `${pathWithoutLocale}${pathSuffix}${hash}`;
}

export function buildLocalizedLocaleSwitchHref(
  pathname: string,
  nextLocale: AppLocale,
  searchParams: URLSearchParams,
) {
  const nextPath = buildLocaleSwitchPath(pathname, searchParams);
  const suffix =
    nextPath === "/"
      ? ""
      : /^\/[?#]/.test(nextPath)
        ? nextPath.slice(1)
        : nextPath;
  return `/${nextLocale}${suffix}`;
}
