import type {
  PracticeTranscriptionNormalizationHint,
  PracticeTranscriptionWarning,
} from "@thinkfy/shared/practice";
import type { MotionBrief, PracticeLanguage } from "@/types";
import { buildSttKeyterms } from "./keyterms";

type NormalizationRule = {
  pattern: RegExp;
  normalized: string;
  confidence: number;
  reason: string;
  preserveCase?: boolean;
};

const STATIC_RULES: NormalizationRule[] = [
  {
    pattern: /\b(?:s[\s.-]?cows?|e[\s.-]?cows?|scows|e cowas|e co was)\b/gi,
    normalized: "ECOWAS",
    confidence: 0.92,
    reason: "Likely code-switched acronym for the West African bloc.",
  },
  {
    pattern: /\b(?:a[\s.-]?e[\s.-]?s|a e s|aes)\b/gi,
    normalized: "AES",
    confidence: 0.9,
    reason: "Likely acronym for Alliance of Sahel States.",
  },
  {
    pattern: /\b(?:vupali|vúpali|bu[r]?kina\s+faso|burkina\s+pha\s+so)\b/gi,
    normalized: "Burkina Faso",
    confidence: 0.78,
    reason: "Likely proper noun distorted by Vietnamese ASR.",
  },
  {
    pattern: /\b(?:nigiê|ni-?giê|ni ge|neejer)\b/gi,
    normalized: "Niger",
    confidence: 0.78,
    reason: "Likely country name in an ECOWAS/AES debate context.",
  },
  {
    pattern: /\b(?:sahen|sa hen|sahel)\b/gi,
    normalized: "Sahel",
    confidence: 0.82,
    reason: "Likely region name in an ECOWAS/AES debate context.",
  },
  {
    pattern: /\b(?:quai-?sdc|wsdc|double\s+u\s+s\s+d\s+c)\b/gi,
    normalized: "WSDC",
    confidence: 0.85,
    reason: "Likely debate format acronym.",
  },
  {
    pattern: /\b(?:coas|cô\s*át|cơ\s*át)\b/gi,
    normalized: "clash",
    confidence: 0.72,
    reason: "Likely code-switched debate term distorted by ASR.",
    preserveCase: false,
  },
  {
    pattern: /\bcla\s+Faso\b/gi,
    normalized: "clash về Burkina Faso",
    confidence: 0.7,
    reason: "Likely collapsed ASR artifact for the phrase 'clash về Burkina Faso'.",
    preserveCase: false,
  },
];

function getWordCount(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function preserveCaseReplacement(match: string, normalized: string) {
  if (match === match.toUpperCase()) return normalized.toUpperCase();
  return normalized;
}

function recordHint(
  hints: PracticeTranscriptionNormalizationHint[],
  raw: string,
  normalized: string,
  reason: string,
  confidence: number,
  source: PracticeTranscriptionNormalizationHint["source"] = "static_glossary"
) {
  const key = `${raw.toLocaleLowerCase("vi")}=>${normalized.toLocaleLowerCase("vi")}`;
  if (
    hints.some(
      (hint) =>
        `${hint.raw.toLocaleLowerCase("vi")}=>${hint.normalized.toLocaleLowerCase(
          "vi"
        )}` === key
    )
  ) {
    return;
  }
  hints.push({ raw, normalized, reason, confidence, source });
}

function applyStaticRules(text: string) {
  let normalizedText = text;
  const hints: PracticeTranscriptionNormalizationHint[] = [];

  for (const rule of STATIC_RULES) {
    normalizedText = normalizedText.replace(rule.pattern, (match) => {
      recordHint(hints, match, rule.normalized, rule.reason, rule.confidence);
      return rule.preserveCase === false
        ? rule.normalized
        : preserveCaseReplacement(match, rule.normalized);
    });
  }

  return { normalizedText, hints };
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function normalizeTranscriptionText(input: {
  transcript: string;
  practiceLanguage: PracticeLanguage;
  topic?: string | null;
  motionBrief?: MotionBrief | null;
  prepNotes?: string | null;
}) {
  const { normalizedText, hints } = applyStaticRules(input.transcript);
  const contextTerms = buildSttKeyterms({
    practiceLanguage: input.practiceLanguage,
    topic: input.topic,
    motionBrief: input.motionBrief,
    prepNotes: input.prepNotes,
  });

  for (const term of contextTerms) {
    if (term.length < 3) continue;
    const compact = term.replace(/\s+/g, "");
    if (compact.length < 4) continue;
    const termRegex = new RegExp(`\\b${escapeRegExp(compact)}\\b`, "i");
    if (
      termRegex.test(input.transcript) &&
      !new RegExp(`\\b${escapeRegExp(term)}\\b`, "i").test(input.transcript)
    ) {
      recordHint(
        hints,
        compact,
        term,
        "Matches a motion/context keyterm without spacing.",
        0.7,
        "motion_context"
      );
    }
  }

  const warnings: PracticeTranscriptionWarning[] = [];
  const wordCount = getWordCount(normalizedText);
  if (!normalizedText.trim()) warnings.push("no_speech_detected");
  if (normalizedText.trim() && wordCount < 20) warnings.push("short_transcript");
  if (hints.length > 0) warnings.push("possible_stt_artifacts");

  return {
    normalizedTranscript: normalizedText.trim(),
    normalizationHints: hints.slice(0, 24),
    warnings,
    wordCount,
  };
}

export function mergeWarnings(
  ...warningGroups: Array<Array<PracticeTranscriptionWarning | undefined>>
) {
  return Array.from(
    new Set(warningGroups.flat().filter(Boolean) as PracticeTranscriptionWarning[])
  );
}
