import {
  getString,
  isUuid,
  RequestValidationError,
  type JsonRecord,
} from "@/lib/api/request-validation";

/** A queue timeout is never consent to start a paid AI duel. */
export function requireExplicitAiChoice(body: JsonRecord): string {
  const ticketId = getString(body, "ticketId", { required: true });
  if (
    !ticketId ||
    !isUuid(ticketId) ||
    body.opponent !== "ai" ||
    body.consent !== true
  ) {
    throw new RequestValidationError(
      "Choose the AI opponent explicitly for a valid queue ticket.",
    );
  }
  return ticketId;
}
