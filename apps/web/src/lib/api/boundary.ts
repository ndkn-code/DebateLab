import { z } from "zod";
import { RequestValidationError } from "./request-validation";

/**
 * Zod-at-the-boundary helper (WS-0.1 quality bar).
 *
 * Every server action and route handler that accepts external input MUST parse
 * it through a Zod schema before touching the data layer. This is the single
 * validated entry point: combined with "one canonical create path per entity"
 * (see docs/ielts/data-access.md), it guarantees no unvalidated / `any` payload
 * reaches a repository or the database.
 *
 * Usage (route handler):
 *   const body = await readJsonObject(request);
 *   const input = parseInput(CreateThingSchema, body); // typed or throws 400
 *
 * Usage (server action):
 *   const input = parseInput(CreateThingSchema, rawInput);
 */

export function formatZodIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.join(".");
      return path ? `${path}: ${issue.message}` : issue.message;
    })
    .join("; ");
}

/**
 * Parse and validate untrusted input. Throws `RequestValidationError` (HTTP 400)
 * with a readable message on failure — route handlers surface a 400, server
 * actions get a typed throw. Returns the fully-typed, parsed value.
 */
export function parseInput<TSchema extends z.ZodType>(
  schema: TSchema,
  data: unknown,
): z.infer<TSchema> {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new RequestValidationError(
      `Invalid input — ${formatZodIssues(result.error)}`,
    );
  }
  return result.data;
}

export type ParseResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

/**
 * Non-throwing variant for callers that prefer a result union over a throw.
 */
export function parseInputSafe<TSchema extends z.ZodType>(
  schema: TSchema,
  data: unknown,
): ParseResult<z.infer<TSchema>> {
  const result = schema.safeParse(data);
  return result.success
    ? { success: true, data: result.data }
    : { success: false, error: formatZodIssues(result.error) };
}
