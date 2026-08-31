import { z } from "zod";

import { findProhibitedAuthorityClaims } from "./boundaries";
import { ieltsCoachOutputSchema, type IeltsCoachOutput } from "./contracts";

export interface IeltsCoachServerAuthorization {
  /** Canonical records, not just IDs: model-emitted bands/authority must match. */
  learnerEvidence: ReadonlyMap<string, IeltsCoachOutput["learnerEvidenceUsed"][number]>;
  approvedKnowledgeSources: ReadonlyMap<
    string,
    IeltsCoachOutput["sources"][number]
  >;
  learnerSources: ReadonlyMap<string, IeltsCoachOutput["sources"][number]>;
  actions: ReadonlyMap<
    string,
    Pick<IeltsCoachOutput["action"], "kind" | "skill" | "criterion">
  >;
}

function sameCanonicalValue(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

/**
 * Structural parser for generateStructured output. Before returning this to a
 * learner, call `validateAuthorizedIeltsCoachOutput` with server-owned IDs.
 */
export function parseIeltsCoachOutput(value: unknown): IeltsCoachOutput {
  const output = ieltsCoachOutputSchema.parse(value);
  const claims = findProhibitedAuthorityClaims(output);
  if (claims.length) {
    throw new z.ZodError(
      claims.map((claim) => ({
        code: "custom",
        path: [],
        message: `Prohibited score-authority claim: ${claim}`,
      })),
    );
  }
  return output;
}

/** Canonicalizes harmless model whitespace, then applies the strict contract. */
export function normalizeAndValidateIeltsCoachOutput(
  value: unknown,
): IeltsCoachOutput {
  return parseIeltsCoachOutput(
    trimStrings(normalizeNullableProviderOptionals(value)),
  );
}

/**
 * Required server-side validation after generation. Authorization is owned by
 * the request handler/repository, never by booleans emitted by the model.
 */
export function validateAuthorizedIeltsCoachOutput(
  value: unknown,
  authorization: IeltsCoachServerAuthorization,
): IeltsCoachOutput {
  const output = normalizeAndValidateIeltsCoachOutput(value);
  for (const evidence of output.learnerEvidenceUsed) {
    const canonical = authorization.learnerEvidence.get(evidence.evidenceId);
    if (!canonical) {
      throw new Error(
        `IELTS_COACH_UNAUTHORIZED_EVIDENCE:${evidence.evidenceId}`,
      );
    }
    if (!sameCanonicalValue(evidence, canonical)) {
      throw new Error(
        `IELTS_COACH_EVIDENCE_MISMATCH:${evidence.evidenceId}`,
      );
    }
  }
  for (const source of output.sources) {
    const canonical =
      source.sourceType === "approved_rubric" ||
      source.sourceType === "approved_exemplar"
        ? authorization.approvedKnowledgeSources.get(source.evidenceId)
        : authorization.learnerSources.get(source.evidenceId);
    if (!canonical) {
      throw new Error(`IELTS_COACH_UNAUTHORIZED_SOURCE:${source.evidenceId}`);
    }
    if (!sameCanonicalValue(source, canonical)) {
      throw new Error(`IELTS_COACH_SOURCE_MISMATCH:${source.evidenceId}`);
    }
  }
  const canonicalAction = authorization.actions.get(output.action.resourceId);
  if (!canonicalAction) {
    throw new Error(
      `IELTS_COACH_UNAUTHORIZED_ACTION:${output.action.resourceId}`,
    );
  }
  if (
    output.action.kind !== canonicalAction.kind ||
    output.action.skill !== canonicalAction.skill ||
    output.action.criterion !== canonicalAction.criterion
  ) {
    throw new Error(
      `IELTS_COACH_ACTION_MISMATCH:${output.action.resourceId}`,
    );
  }
  const current = output.bandCriterionGap.current;
  if (
    current &&
    !output.learnerEvidenceUsed.some(
      (evidence) =>
        evidence.score && sameCanonicalValue(evidence.score, current),
    )
  ) {
    throw new Error("IELTS_COACH_CURRENT_SCORE_NOT_EVIDENCED");
  }
  return output;
}

/** Lets the centralized core repair authorization-invalid model JSON once. */
export function createAuthorizedIeltsCoachOutputSchema(
  authorization: IeltsCoachServerAuthorization,
) {
  return ieltsCoachOutputSchema.superRefine((output, context) => {
    try {
      validateAuthorizedIeltsCoachOutput(output, authorization);
    } catch (error) {
      context.addIssue({
        code: "custom",
        path: [],
        message:
          error instanceof Error
            ? error.message
            : "IELTS_COACH_OUTPUT_NOT_AUTHORIZED",
      });
    }
  });
}

export function safeParseIeltsCoachOutput(value: unknown) {
  try {
    return { success: true as const, data: parseIeltsCoachOutput(value) };
  } catch (error) {
    return { success: false as const, error };
  }
}

function trimStrings(value: unknown): unknown {
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) return value.map(trimStrings);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, trimStrings(entry)]),
    );
  }
  return value;
}

/**
 * Strict provider JSON Schema represents optional fields as required nullable
 * properties. Convert only the contract's known optional transport fields
 * back to their canonical omitted form before Zod and authorization checks.
 */
function normalizeNullableProviderOptionals(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(normalizeNullableProviderOptionals);
  }
  if (!value || typeof value !== "object") return value;
  const output = Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      key,
      normalizeNullableProviderOptionals(entry),
    ]),
  );
  const looksLikeEvidence =
    typeof output.evidenceId === "string" &&
    typeof output.kind === "string" &&
    typeof output.summary === "string";
  if (looksLikeEvidence) {
    if (output.score === null) delete output.score;
    if (output.observedAt === null) delete output.observedAt;
  }
  const looksLikeAction =
    typeof output.resourceId === "string" &&
    typeof output.skill === "string" &&
    typeof output.label === "string";
  if (looksLikeAction && output.criterion === null) delete output.criterion;
  return output;
}
