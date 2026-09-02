export const IELTS_ROUTES = {
  marketing: "/ielts",
  home: "/ielts/home",
  onboarding: "/ielts/onboarding",
  speakingRehearsal: "/ielts/speaking-rehearsal",
  teacherWorkspace: "/dashboard/teacher",
} as const;

export function ieltsLoginHref(next: string = IELTS_ROUTES.onboarding): string {
  return `/auth/login?next=${encodeURIComponent(next)}`;
}

export function ieltsSignupHref(
  next: string = IELTS_ROUTES.onboarding,
): string {
  return `/auth/signup?next=${encodeURIComponent(next)}`;
}

/** Query params the mock page (`/ielts/mock/[slug]`) reads from `searchParams`. */
export interface IeltsMockQuery {
  experience?: string;
  returnTo?: string;
  assignment?: string;
  attempt?: string;
}

function withQuery(path: string, query: Record<string, string | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== "") params.set(key, value);
  }
  const encoded = params.toString();
  return encoded ? `${path}?${encoded}` : path;
}

/** Locale-less learner paths; wrap with {@link localizedPath} for an href. */
export const ieltsPaths = {
  home: IELTS_ROUTES.home,
  tests: "/ielts/tests",
  review: "/ielts/review",
  studyPlan: "/ielts/study-plan",
  mock(slug: string, q?: IeltsMockQuery): string {
    return withQuery(`/ielts/mock/${encodeURIComponent(slug)}`, {
      experience: q?.experience,
      returnTo: q?.returnTo,
      assignment: q?.assignment,
      attempt: q?.attempt,
    });
  },
  results(attemptId: string): string {
    return `/ielts/attempts/${encodeURIComponent(attemptId)}/results`;
  },
} as const;

/** Prefix a locale-less path (`localePrefix: "always"` routing). */
export function localizedPath(locale: string, path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `/${locale}${normalized}`;
}
