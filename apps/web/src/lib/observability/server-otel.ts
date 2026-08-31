import "server-only";

import {
  SpanStatusCode,
  trace,
  type Span,
} from "@opentelemetry/api";
import {
  sanitizeServerSpanAttributes,
  type SafeSpanAttributes,
} from "./server-otel-sanitize";

const tracer = trace.getTracer("thinkfy-web.server");

export function recordServerException(error: unknown, span?: Span) {
  const activeSpan = span ?? trace.getActiveSpan();
  if (!activeSpan) return;
  const normalized = error instanceof Error ? error : new Error("Server operation failed");
  activeSpan.recordException(normalized);
  activeSpan.setStatus({ code: SpanStatusCode.ERROR });
}

export async function withServerSpan<T>(
  name: string,
  attributes: SafeSpanAttributes,
  operation: (span: Span) => T | Promise<T>,
): Promise<T> {
  return tracer.startActiveSpan(
    name,
    { attributes: sanitizeServerSpanAttributes(attributes) },
    async (span) => {
      try {
        return await operation(span);
      } catch (error) {
        recordServerException(error, span);
        throw error;
      } finally {
        span.end();
      }
    },
  );
}
