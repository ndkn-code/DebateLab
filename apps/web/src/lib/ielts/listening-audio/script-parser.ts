/**
 * Parse an authored Listening-section script into ordered, accent-tagged turns
 * (WS-1.3). Pure + unit tested — no I/O, no provider calls.
 *
 * An authored script is plain text where each spoken turn starts with a speaker
 * label, e.g. `RECEPTIONIST: Good morning, how can I help?`. Unlabelled lines
 * continue the current speaker's turn (multi-line utterances); text before any
 * label is narration. Each line's accent is the labelled speaker's accent (from
 * the section's `speakers` array) or the section's primary accent as fallback.
 *
 * Square-bracketed cues (`[telephone rings]`, `[pause]`) are stage directions,
 * not spoken text, so they are stripped before synthesis.
 */
import type { Database } from "@/types/supabase";

export type IeltsAccent = Database["public"]["Enums"]["ielts_accent"];

/** A `listening_sections.speakers` entry: `{ name, accent }`. */
export interface SpeakerMeta {
  name: string;
  accent: IeltsAccent;
}

/** One synthesizable turn: who speaks, in which accent, and the spoken text. */
export interface ListeningTurn {
  /** The matched speaker label, or `null` for narration. */
  speaker: string | null;
  accent: IeltsAccent;
  text: string;
}

/** Leading `LABEL:` on a line — letters/digits/simple punctuation, ≤ 40 chars. */
const LABEL_PATTERN = /^\s*([A-Za-z][A-Za-z0-9 .'\-]{0,39}?):\s*(.*)$/;
const STAGE_DIRECTION_PATTERN = /\[[^\]]*\]/g;

function normalizeKey(name: string): string {
  return name.trim().toLowerCase();
}

/** Strip `[...]` stage cues and collapse whitespace; `""` if nothing spoken. */
function cleanSpokenText(raw: string): string {
  return raw.replace(STAGE_DIRECTION_PATTERN, " ").replace(/\s+/g, " ").trim();
}

function accentForSpeaker(
  label: string,
  accentByName: Map<string, IeltsAccent>,
  sectionAccent: IeltsAccent,
): IeltsAccent {
  return accentByName.get(normalizeKey(label)) ?? sectionAccent;
}

/**
 * Parse `script` into accent-tagged turns. `speakers` supplies per-speaker
 * accents (matched case-insensitively by label); `sectionAccent` is the
 * fallback for narration and unlisted speakers.
 */
export function parseListeningScript(
  script: string,
  speakers: readonly SpeakerMeta[],
  sectionAccent: IeltsAccent,
): ListeningTurn[] {
  const accentByName = new Map<string, IeltsAccent>(
    speakers.map((s) => [normalizeKey(s.name), s.accent]),
  );

  const turns: ListeningTurn[] = [];
  let current: ListeningTurn | null = null;

  const pushCurrent = () => {
    if (!current) return;
    const text = cleanSpokenText(current.text);
    if (text) turns.push({ ...current, text });
    current = null;
  };

  for (const line of script.split(/\r?\n/)) {
    if (!line.trim()) {
      pushCurrent();
      continue;
    }

    const match = LABEL_PATTERN.exec(line);
    if (match) {
      pushCurrent();
      const label = match[1].trim();
      current = {
        speaker: label,
        accent: accentForSpeaker(label, accentByName, sectionAccent),
        text: match[2] ?? "",
      };
      continue;
    }

    if (current) {
      current.text += ` ${line}`;
    } else {
      current = { speaker: null, accent: sectionAccent, text: line };
    }
  }
  pushCurrent();

  return turns;
}
