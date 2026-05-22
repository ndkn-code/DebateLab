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

export function normalizeStructuredRebuttalResponse(
  rawText: string,
  fallbackHighlights: unknown = []
): NormalizedRebuttalResponse {
  const trimmed = rawText.trim();
  const fallback = normalizeAiHighlights(fallbackHighlights);

  if (!trimmed) {
    return { rebuttal: "", highlights: fallback, wasStructured: false };
  }

  try {
    const parsed = JSON.parse(getJsonCandidate(trimmed)) as unknown;
    if (parsed && typeof parsed === "object") {
      const source = parsed as Record<string, unknown>;
      const rebuttal =
        typeof source.rebuttal === "string" ? source.rebuttal.trim() : "";
      if (rebuttal) {
        const highlights = normalizeAiHighlights(source.highlights);
        return {
          rebuttal,
          highlights: highlights.length > 0 ? highlights : fallback,
          wasStructured: true,
        };
      }
    }
  } catch {
    // Keep the visible response usable even if a provider returns prose.
  }

  return { rebuttal: trimmed, highlights: fallback, wasStructured: false };
}

export function normalizeRebuttalText(rawText: string) {
  return normalizeStructuredRebuttalResponse(rawText).rebuttal;
}
