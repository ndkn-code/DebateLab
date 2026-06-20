/**
 * Inline-blank parsing for completion prompts (WS-1.2). A completion stem embeds
 * blanks as `__BLANK_<id>__` markers (mirroring the debate fill_blank
 * convention); renderers split the prompt into text + blank segments and place a
 * control at each blank. Pure — unit-tested in the contract suite.
 */
export type PromptSegment =
  | { type: "text"; text: string }
  | { type: "blank"; id: string };

const BLANK_PATTERN = /__BLANK_([A-Za-z0-9_]+)__/g;

/** Split a prompt into ordered text and blank segments. */
export function parsePromptSegments(prompt: string): PromptSegment[] {
  const segments: PromptSegment[] = [];
  let lastIndex = 0;
  for (const match of prompt.matchAll(BLANK_PATTERN)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      segments.push({ type: "text", text: prompt.slice(lastIndex, index) });
    }
    segments.push({ type: "blank", id: match[1] });
    lastIndex = index + match[0].length;
  }
  if (lastIndex < prompt.length) {
    segments.push({ type: "text", text: prompt.slice(lastIndex) });
  }
  return segments;
}

/** Ordered blank ids found in a prompt. */
export function promptBlankIds(prompt: string): string[] {
  return [...prompt.matchAll(BLANK_PATTERN)].map((match) => match[1]);
}

/** Whether a prompt contains any inline blanks. */
export function hasPromptBlanks(prompt: string): boolean {
  return promptBlankIds(prompt).length > 0;
}
