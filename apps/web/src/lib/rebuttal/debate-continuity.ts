import { getMotionBrief } from "@/lib/motion-brief";
import { normalizeRebuttalText } from "@/lib/rebuttal/structured-response";
import type {
  AiHighlight,
  DebateMemory,
  DebateRound,
  DebateTopic,
  MotionBrief,
  PracticeLanguage,
} from "@/types";

export interface RebuttalWordTarget {
  min: number;
  max: number;
  label: string;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function getRebuttalWordTarget(
  speechTimeSeconds: number | null | undefined,
  roundLabel = ""
): RebuttalWordTarget {
  const seconds =
    typeof speechTimeSeconds === "number" && Number.isFinite(speechTimeSeconds)
      ? clamp(speechTimeSeconds, 120, 420)
      : 180;
  const isClosing = roundLabel.toLowerCase().includes("closing");

  if (seconds >= 420) {
    return {
      min: isClosing ? 760 : 850,
      max: isClosing ? 960 : 1100,
      label: "7-minute",
    };
  }

  if (seconds >= 300) {
    return {
      min: isClosing ? 560 : 650,
      max: isClosing ? 720 : 800,
      label: "5-minute",
    };
  }

  if (seconds >= 180) {
    return {
      min: isClosing ? 320 : 360,
      max: isClosing ? 420 : 480,
      label: "3-minute",
    };
  }

  return {
    min: isClosing ? 200 : 240,
    max: isClosing ? 280 : 320,
    label: "2-minute",
  };
}

export function getRebuttalMaxOutputTokens(target: RebuttalWordTarget) {
  return clamp(Math.ceil(target.max * 2.2), 900, 2600);
}

function firstSentence(value: string) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  const match = normalized.match(/^(.{24,220}?[.!?。]|.{24,180})(\s|$)/);
  return (match?.[1] ?? normalized.slice(0, 180)).trim();
}

function uniqLimited(values: string[], limit: number) {
  const seen = new Set<string>();
  const result: string[] = [];
  values.forEach((value) => {
    const text = value.trim();
    const key = text.toLowerCase();
    if (!text || seen.has(key)) return;
    seen.add(key);
    result.push(text);
  });
  return result.slice(-limit);
}

export function createInitialDebateMemory(params: {
  topic: DebateTopic;
  side: "proposition" | "opposition";
  practiceLanguage: PracticeLanguage;
}): DebateMemory {
  const motionBrief = getMotionBrief(params.topic, params.practiceLanguage);
  const aiSide = params.side === "proposition" ? "opposition" : "proposition";

  return {
    aiSide,
    studentSide: params.side,
    policyModel: motionBrief.modelClarification,
    priorAiClaims: [],
    concessions: [],
    activeClashes: [
      params.side === "proposition"
        ? motionBrief.oppositionBurden
        : motionBrief.propositionBurden,
    ],
    droppedClaims: [],
  };
}

export function updateDebateMemoryFromUserSpeech(
  memory: DebateMemory | null,
  round: Pick<DebateRound, "roundNumber" | "label">,
  transcript: string
): DebateMemory | null {
  if (!memory) return null;
  const claim = firstSentence(transcript);
  if (!claim) return memory;

  return {
    ...memory,
    activeClashes: uniqLimited(
      [...memory.activeClashes, `Round ${round.roundNumber} ${round.label}: ${claim}`],
      8
    ),
  };
}

export function updateDebateMemoryFromAiSpeech(
  memory: DebateMemory | null,
  round: Pick<DebateRound, "roundNumber" | "label">,
  aiResponse: string,
  highlights: AiHighlight[] = []
): DebateMemory | null {
  if (!memory) return null;
  const normalizedResponse = normalizeRebuttalText(aiResponse);
  const highlightedClaims = highlights
    .filter((highlight) => highlight.type === "claim" || highlight.type === "impact")
    .map((highlight) => highlight.quote);
  const fallbackClaim = firstSentence(normalizedResponse);

  return {
    ...memory,
    priorAiClaims: uniqLimited(
      [
        ...memory.priorAiClaims,
        ...highlightedClaims,
        fallbackClaim
          ? `Round ${round.roundNumber} ${round.label}: ${fallbackClaim}`
          : "",
      ],
      10
    ),
  };
}

export function formatDebateMemoryForPrompt(
  memory: DebateMemory | null | undefined,
  motionBrief?: MotionBrief | null
) {
  if (!memory) return "";

  const sideLabel =
    memory.aiSide === "proposition" ? "Proposition/FOR" : "Opposition/AGAINST";
  const briefLine = motionBrief
    ? `\n- Motion model to preserve: ${motionBrief.modelClarification}`
    : "";

  return `## Debate Memory
- AI side to preserve: ${sideLabel}
- Student side: ${
    memory.studentSide === "proposition" ? "Proposition/FOR" : "Opposition/AGAINST"
  }
- Policy/model commitment: ${memory.policyModel}${briefLine}
- Prior AI claims:
${(memory.priorAiClaims.length ? memory.priorAiClaims : ["None yet."])
  .map((claim) => `  - ${claim}`)
  .join("\n")}
- Active clashes to track:
${(memory.activeClashes.length ? memory.activeClashes : ["No tracked clashes yet."])
  .map((claim) => `  - ${claim}`)
  .join("\n")}
- Concessions to preserve:
${(memory.concessions.length ? memory.concessions : ["Do not invent concessions."])
  .map((claim) => `  - ${claim}`)
  .join("\n")}
- Dropped claims to punish if still unanswered:
${(memory.droppedClaims.length ? memory.droppedClaims : ["None tracked yet."])
  .map((claim) => `  - ${claim}`)
  .join("\n")}`;
}
