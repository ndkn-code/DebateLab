import type { Attributes } from "@opentelemetry/api";

const SENSITIVE_KEY =
  /(authorization|cookie|password|secret|token|body|content|prompt|transcript|essay)/i;

export type SafeSpanAttributes = Record<
  string,
  string | number | boolean | null | undefined
>;

export function sanitizeServerSpanAttributes(
  attributes: SafeSpanAttributes,
): Attributes {
  const safe: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(attributes)) {
      if (
        !/^[a-zA-Z0-9_.-]{1,80}$/.test(key) ||
        SENSITIVE_KEY.test(key) ||
        value === null ||
        value === undefined
      ) {
        continue;
      }
      if (typeof value === "string") {
        safe[key] = value.slice(0, 200);
        continue;
      }
      if (typeof value === "number" && Number.isFinite(value)) {
        safe[key] = value;
        continue;
      }
      if (typeof value === "boolean") safe[key] = value;
  }
  return safe;
}
