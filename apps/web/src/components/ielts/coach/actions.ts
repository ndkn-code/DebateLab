import type { IeltsCoachOutput } from "@/lib/coach/ielts-contract";

export interface IeltsCoachActionDestination {
  href: string;
  external: boolean;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Resolves only server-authorized resource identities to known product routes. */
export function resolveIeltsCoachActionDestination(params: {
  action: IeltsCoachOutput["action"];
  locale: "en" | "vi";
}): IeltsCoachActionDestination | null {
  const { action, locale } = params;
  const base = `/${locale}/ielts`;

  switch (action.kind) {
    case "start_assignment":
      return UUID_PATTERN.test(action.resourceId)
        ? {
            href: `${base}/assigned?assignment=${encodeURIComponent(action.resourceId)}`,
            external: false,
          }
        : null;
    case "review_feedback":
      return UUID_PATTERN.test(action.resourceId)
        ? {
            href: `${base}/attempts/${encodeURIComponent(action.resourceId)}/results`,
            external: false,
          }
        : null;
    case "start_practice":
      if (!action.resourceId.startsWith(`ielts-practice:${action.skill}:`)) {
        return null;
      }
      {
        const parts = action.resourceId.split(":");
        const testSlug = parts.length === 5 ? parts[3] : null;
        const questionId = parts.length === 5 ? parts[4] : null;
        if (testSlug && questionId) {
          if (!SLUG_PATTERN.test(testSlug) || !UUID_PATTERN.test(questionId)) {
            return null;
          }
          const search = new URLSearchParams({
            source: "ielts-coach",
            focusQuestion: questionId,
          });
          if (action.skill === "speaking") {
            search.set("experience", "speaking_rehearsal");
          }
          return {
            href: `${base}/mock/${encodeURIComponent(testSlug)}?${search.toString()}`,
            external: false,
          };
        }
        if (parts.length !== 3) return null;
      }
      return {
        href:
          action.skill === "speaking"
            ? `${base}/speaking-rehearsal`
            : `${base}/tests?skill=${encodeURIComponent(action.skill)}`,
        external: false,
      };
    case "open_study_plan":
      return action.resourceId === "ielts-study-plan"
        ? { href: `${base}/study-plan`, external: false }
        : null;
    case "seek_support":
      return action.resourceId === "ielts-support"
        ? {
            href: "mailto:support@thinkfy.net?subject=IELTS%20Coach%20support",
            external: true,
          }
        : null;
  }
}
