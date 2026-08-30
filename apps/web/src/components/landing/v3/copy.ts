export type LandingLocale = "en" | "vi";

/** Compatibility DTO for the current route. The shared marketing shell owns copy. */
export interface LandingV3Copy {
  locale: LandingLocale;
}

export function getLandingV3Copy(locale: LandingLocale): LandingV3Copy {
  return { locale };
}
