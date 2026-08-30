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

export function ieltsSignupHref(next: string = IELTS_ROUTES.onboarding): string {
  return `/auth/signup?next=${encodeURIComponent(next)}`;
}
