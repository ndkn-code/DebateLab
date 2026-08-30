import type {
  CoachProductContext,
  CoachSubjectContext,
  PersistedCoachConversationContext,
  RequestedCoachConversationContext,
} from "./types";

export type CoachContextBoundaryErrorCode =
  | "COACH_CONTEXT_AMBIGUOUS"
  | "COACH_CONTEXT_MISMATCH";

export class CoachContextBoundaryError extends Error {
  readonly code: CoachContextBoundaryErrorCode;

  constructor(code: CoachContextBoundaryErrorCode) {
    super(code);
    this.name = "CoachContextBoundaryError";
    this.code = code;
  }
}

function isAlignedContext(value: {
  product: CoachProductContext;
  subject: CoachSubjectContext;
}): boolean {
  return value.product === value.subject;
}

/**
 * Resolves the immutable product identity of a coach conversation.
 *
 * Legacy rows with both fields null are Debate-only for compatibility. A
 * half-migrated row (only one field present), crossed product/subject, or a
 * request that differs from persistence is rejected rather than inferred.
 */
export function resolveCoachConversationContext(params: {
  requested: RequestedCoachConversationContext;
  persisted: PersistedCoachConversationContext;
}): RequestedCoachConversationContext {
  if (!isAlignedContext(params.requested)) {
    throw new CoachContextBoundaryError("COACH_CONTEXT_AMBIGUOUS");
  }

  const bothLegacy =
    params.persisted.product === null && params.persisted.subject === null;
  const oneMissing =
    (params.persisted.product === null) !== (params.persisted.subject === null);
  if (oneMissing) {
    throw new CoachContextBoundaryError("COACH_CONTEXT_AMBIGUOUS");
  }

  const persisted: RequestedCoachConversationContext = bothLegacy
    ? { product: "debate", subject: "debate" }
    : {
        product: params.persisted.product!,
        subject: params.persisted.subject!,
      };
  if (!isAlignedContext(persisted)) {
    throw new CoachContextBoundaryError("COACH_CONTEXT_AMBIGUOUS");
  }
  if (
    params.requested.product !== persisted.product ||
    params.requested.subject !== persisted.subject
  ) {
    throw new CoachContextBoundaryError("COACH_CONTEXT_MISMATCH");
  }
  return persisted;
}
