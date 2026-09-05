import { ieltsPaths, localizedPath } from "@/lib/ielts/routes";

export interface ResultsAssignmentContext {
  assignmentId: string;
  title: string;
  className: string | null;
}

export interface ResultsNextStep {
  kind: "assigned" | "studyPlan";
  href: string;
  context: string | null;
}

/** Adapted from Lumist's result destination priority; see results/README.md. */
export function resultsNextStep(
  locale: string,
  assignment: ResultsAssignmentContext | null = null,
): ResultsNextStep {
  if (assignment) {
    return {
      kind: "assigned",
      // A fragment preserves the card without the assigned route redirecting
      // ?assignment= straight back to this result.
      href: localizedPath(
        locale,
        `/ielts/assigned#assignment-${encodeURIComponent(assignment.assignmentId)}`,
      ),
      context: [assignment.className, assignment.title]
        .filter(Boolean)
        .join(" · "),
    };
  }
  return {
    kind: "studyPlan",
    href: localizedPath(locale, ieltsPaths.studyPlan),
    context: null,
  };
}
