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
  searchParams: URLSearchParams
) {
  const nextParams = new URLSearchParams(searchParams.toString());
  nextParams.delete("language");

  const pathWithoutLocale = stripAppLocalePrefix(pathname);
  const pathSuffix = nextParams.toString() ? `?${nextParams.toString()}` : "";

  return `${pathWithoutLocale}${pathSuffix}`;
}

export function buildLocalizedLocaleSwitchHref(
  pathname: string,
  nextLocale: AppLocale,
  searchParams: URLSearchParams
) {
  const nextPath = buildLocaleSwitchPath(pathname, searchParams);
  const [pathOnly, query = ""] = nextPath.split("?", 2);
  const localizedPath =
    pathOnly === "/" ? `/${nextLocale}` : `/${nextLocale}${pathOnly}`;

  return query ? `${localizedPath}?${query}` : localizedPath;
}
