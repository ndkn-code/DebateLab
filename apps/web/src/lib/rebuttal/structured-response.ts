import type { AiHighlight, AiHighlightType } from "@/types";

export interface NormalizedRebuttalResponse {
  rebuttal: string;
  highlights: AiHighlight[];
  wasStructured: boolean;
}

function isHighlightType(value: unknown): value is AiHighlightType {
  return (
    value === "claim" ||
    value === "evidence" ||
    value === "impact" ||
    value === "assumption"
  );
}

export function normalizeAiHighlights(raw: unknown): AiHighlight[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const candidate = item as Record<string, unknown>;
      const quote = typeof candidate.quote === "string" ? candidate.quote.trim() : "";
      if (!quote || !isHighlightType(candidate.type)) return null;

      return {
        type: candidate.type,
        quote,
        note:
          typeof candidate.note === "string" && candidate.note.trim()
            ? candidate.note.trim()
            : undefined,
      };
    })
    .filter(Boolean) as AiHighlight[];
}

function extractJsonObjectFromText(text: string) {
  const start = text.indexOf("{");
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < text.length; index += 1) {
    const char = text[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === "\"") {
        inString = false;
      }
      continue;
    }

    if (char === "\"") {
      inString = true;
    } else if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return text.slice(start, index + 1);
      }
    }
  }

  return null;
}

function getJsonCandidate(rawText: string) {
  const trimmed = rawText.trim();
  return (
    trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim() ??
    extractJsonObjectFromText(trimmed) ??
    trimmed
  );
}

function extractJsonStringProperty(rawText: string, property: string) {
  const keyPattern = new RegExp(`${JSON.stringify(property)}\\s*:\\s*"`, "i");
  const match = keyPattern.exec(rawText);
  if (!match) return null;

  const valueStart = (match.index ?? 0) + match[0].length - 1;
  let escaped = false;
  for (let index = valueStart + 1; index < rawText.length; index += 1) {
    const char = rawText[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (char === "\"") {
      try {
        return JSON.parse(rawText.slice(valueStart, index + 1)) as string;
      } catch {
        return null;
      }
    }
  }

  return null;
}

function normalizeStructuredRebuttalResponseInner(
  rawText: string,
  fallbackHighlights: unknown,
  depth: number
): NormalizedRebuttalResponse {
  const trimmed = rawText.trim();
  const fallback = normalizeAiHighlights(fallbackHighlights);

  if (!trimmed) {
    return { rebuttal: "", highlights: fallback, wasStructured: false };
  }

  try {
    const candidate = getJsonCandidate(trimmed);
    const parsed = JSON.parse(candidate) as unknown;
    if (parsed && typeof parsed === "object") {
      const source = parsed as Record<string, unknown>;
      const rebuttal =
        typeof source.rebuttal === "string" ? source.rebuttal.trim() : "";
      if (rebuttal) {
        const highlights = normalizeAiHighlights(source.highlights);
        if (depth < 2) {
          const nested = normalizeStructuredRebuttalResponseInner(
            rebuttal,
            highlights.length > 0 ? highlights : fallback,
            depth + 1
          );
          if (nested.wasStructured) return nested;
        }

        return {
          rebuttal,
          highlights: highlights.length > 0 ? highlights : fallback,
          wasStructured: true,
        };
      }
    }
  } catch {
    const partialRebuttal = extractJsonStringProperty(trimmed, "rebuttal");
    if (partialRebuttal) {
      const nested =
        depth < 2
          ? normalizeStructuredRebuttalResponseInner(
              partialRebuttal,
              fallback,
              depth + 1
            )
          : null;
      return nested?.wasStructured
        ? nested
        : {
            rebuttal: partialRebuttal.trim(),
            highlights: fallback,
            wasStructured: true,
          };
    }
  }

  return { rebuttal: trimmed, highlights: fallback, wasStructured: false };
}

export function normalizeStructuredRebuttalResponse(
  rawText: string,
  fallbackHighlights: unknown = []
): NormalizedRebuttalResponse {
  return normalizeStructuredRebuttalResponseInner(rawText, fallbackHighlights, 0);
}

export function normalizeRebuttalText(rawText: string) {
  return normalizeStructuredRebuttalResponse(rawText).rebuttal;
}
