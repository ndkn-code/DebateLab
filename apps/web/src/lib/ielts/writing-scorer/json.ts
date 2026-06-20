/**
 * Tolerant JSON-object extraction for model output. Models sometimes wrap their
 * JSON in prose or markdown fences even when asked for raw JSON; this mirrors
 * the debate judge's `parseJsonObject` so the Writing scorer degrades the same
 * way before Zod validation.
 */
export function extractJsonObject(text: string, sourceLabel: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error(`Invalid response: could not find JSON in ${sourceLabel}`);
    }
    return JSON.parse(match[0]);
  }
}
