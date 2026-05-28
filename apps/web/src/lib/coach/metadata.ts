import type {
  CoachMessageMetadata,
  CoachResponseBlock,
  CoachRouteIntent,
} from "@/types";

export interface CoachMetadataPruneAudit {
  originalBlockCount: number;
  keptBlockCount: number;
  rejectedBlockCount: number;
  reasons: Record<string, number>;
  keptBlockTypes: string[];
}

const STOPWORDS = new Set([
  "and",
  "are",
  "ban",
  "bang",
  "bao",
  "been",
  "cac",
  "can",
  "cho",
  "cua",
  "duoc",
  "for",
  "hay",
  "hon",
  "mot",
  "nhu",
  "not",
  "the",
  "thi",
  "this",
  "toi",
  "trong",
  "voi",
  "you",
]);

const GENERIC_BLOCK_PATTERNS = [
  /\bthi[eế]u kinh nghi[eệ]m\b/i,
  /\bch[uư]a hi[eể]u r[oõ]\b/i,
  /\bkh[oó] kh[aă]n trong vi[eệ]c\b/i,
  /\bc[aầ]n t[aậ]p trung v[aà]o\b/i,
  /\bx[aâ]y d[uự]ng l[aậ]p lu[aậ]n\b.{0,80}\br[oõ] r[aà]ng\b/i,
  /\bs[uử] d[uụ]ng c[aá]c k[yỹ] thu[aậ]t\b/i,
  /\bchi[eế]n thu[aậ]t\b.{0,80}\bhi[eệ]u qu[aả]\b/i,
  /\bpractice more\b/i,
  /\bimprove your (rebuttal|argument|debate)\b/i,
  /\black of (practice|experience|understanding)\b/i,
  /\buse effective (techniques|strategies)\b/i,
];

const CONCRETE_SIGNAL_PATTERNS = [
  /\b(30|45|60|90)\s*(gi[aâ]y|seconds?|ph[uú]t|minutes?)\b/i,
  /\b(vi[eế]t l[aạ]i|rewrite|draft|say this|n[oó]i th[eế] n[aà]y)\b/i,
  /\b(c[oơ] ch[eế]|mechanism|clash|weighing|impact|burden|motion link)\b/i,
  /\b(v[ií] d[uụ]|example|before\/after|template|drill)\b/i,
  /["“”'‘’].{8,}["“”'‘’]/,
  /[:：]\s*.{12,}/,
];

const NORMAL_CARD_TYPES = new Set(["diagnosis", "next_steps"]);
const ACTIONABLE_CARD_TYPES = new Set([
  "coach_tip",
  "common_mistake",
  "example",
  "drill",
  "opening_formula",
  "template",
  "clarifying_question",
]);

export function coachPlainText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\*\*/g, "")
    .replace(/`/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function coachBlockText(block: CoachResponseBlock) {
  return [block.title, block.body, ...(block.items ?? [])]
    .filter(Boolean)
    .join(" ");
}

function tokenize(value: string) {
  const normalized = coachPlainText(value);
  return normalized
    .match(/[\p{L}\p{N}]+/gu)
    ?.filter((word) => word.length > 2 && !STOPWORDS.has(word)) ?? [];
}

function tokenRecall(candidate: string, source: string) {
  const candidateTokens = Array.from(new Set(tokenize(candidate)));
  if (candidateTokens.length < 5) return 0;

  const sourceTokens = new Set(tokenize(source));
  const overlap = candidateTokens.filter((word) => sourceTokens.has(word)).length;
  return overlap / candidateTokens.length;
}

function addReason(audit: CoachMetadataPruneAudit, reason: string) {
  audit.reasons[reason] = (audit.reasons[reason] ?? 0) + 1;
  audit.rejectedBlockCount += 1;
}

export function isLowSignalCoachBlock(block: CoachResponseBlock) {
  const text = coachBlockText(block);
  const normalized = coachPlainText(text);
  if (normalized.length < 32) return true;

  const matchesGenericPattern = GENERIC_BLOCK_PATTERNS.some((pattern) =>
    pattern.test(text)
  );
  if (!matchesGenericPattern) return false;

  const hasConcreteSignal = CONCRETE_SIGNAL_PATTERNS.some((pattern) =>
    pattern.test(text)
  );
  return !hasConcreteSignal;
}

export function isCoachBlockRepeatedInText(
  block: CoachResponseBlock,
  assistantText: string
) {
  const blockTextValue = coachBlockText(block);
  const normalizedBlock = coachPlainText(blockTextValue);
  const normalizedAssistant = coachPlainText(assistantText);

  if (!normalizedBlock || !normalizedAssistant) return false;
  if (
    normalizedBlock.length >= 36 &&
    normalizedAssistant.includes(normalizedBlock.slice(0, 140))
  ) {
    return true;
  }

  return tokenRecall(blockTextValue, assistantText) >= 0.68;
}

function isConcreteNormalCard(block: CoachResponseBlock) {
  if (!NORMAL_CARD_TYPES.has(block.type)) return true;
  const text = coachBlockText(block);
  return CONCRETE_SIGNAL_PATTERNS.some((pattern) => pattern.test(text));
}

function shouldForceNoCards(intent?: CoachRouteIntent, metadata?: CoachMessageMetadata) {
  return (
    intent === "visual_explainer" ||
    Boolean(metadata?.visualExplainer) ||
    Boolean(metadata?.visualizable)
  );
}

export function pruneCoachMetadata(
  metadata: CoachMessageMetadata,
  context: {
    assistantText?: string;
    studentMessage?: string;
    intent?: CoachRouteIntent;
  } = {}
): { metadata: CoachMessageMetadata | null; audit: CoachMetadataPruneAudit } {
  const audit: CoachMetadataPruneAudit = {
    originalBlockCount: metadata.blocks.length,
    keptBlockCount: 0,
    rejectedBlockCount: 0,
    reasons: {},
    keptBlockTypes: [],
  };

  if (shouldForceNoCards(context.intent, metadata)) {
    if (metadata.blocks.length > 0) {
      audit.rejectedBlockCount = metadata.blocks.length;
      audit.reasons.visual_explainer_no_extra_cards = metadata.blocks.length;
    }
    return {
      metadata: {
        ...metadata,
        blocks: [],
        suggestedActions: metadata.suggestedActions ?? [],
      },
      audit,
    };
  }

  const clarifyingBlocks = metadata.blocks.filter(
    (block) => block.type === "clarifying_question"
  );
  if (clarifyingBlocks.length > 0) {
    const kept = clarifyingBlocks.slice(0, 1);
    const rejectedCount = metadata.blocks.length - kept.length;
    if (rejectedCount > 0) {
      audit.rejectedBlockCount = rejectedCount;
      audit.reasons.clarifying_question_only = rejectedCount;
    }
    audit.keptBlockCount = kept.length;
    audit.keptBlockTypes = kept.map((block) => block.type);
    return {
      metadata: {
        ...metadata,
        blocks: kept,
        suggestedActions: [],
      },
      audit,
    };
  }

  const kept: CoachResponseBlock[] = [];
  let normalCardKept = false;

  for (const block of metadata.blocks) {
    const duplicate =
      context.assistantText &&
      isCoachBlockRepeatedInText(block, context.assistantText);
    const lowSignal = isLowSignalCoachBlock(block);
    const isNormalCard = NORMAL_CARD_TYPES.has(block.type);
    const isActionable = ACTIONABLE_CARD_TYPES.has(block.type);

    if (lowSignal && !isActionable) {
      addReason(audit, "low_signal");
      continue;
    }

    if (duplicate && !["drill", "example", "template", "opening_formula"].includes(block.type)) {
      addReason(audit, "duplicates_answer");
      continue;
    }

    if (isNormalCard && !isConcreteNormalCard(block)) {
      addReason(audit, "normal_card_not_concrete");
      continue;
    }

    if (isNormalCard) {
      if (normalCardKept || kept.some((item) => ["drill", "example"].includes(item.type))) {
        addReason(audit, "normal_card_limit");
        continue;
      }
      normalCardKept = true;
    }

    kept.push(block);
  }

  const finalBlocks = kept.slice(0, kept.some((block) => block.type === "opening_formula") ? 3 : 1);
  const trimmedCount = kept.length - finalBlocks.length;
  if (trimmedCount > 0) {
    audit.rejectedBlockCount += trimmedCount;
    audit.reasons.card_limit = (audit.reasons.card_limit ?? 0) + trimmedCount;
  }

  audit.keptBlockCount = finalBlocks.length;
  audit.keptBlockTypes = finalBlocks.map((block) => block.type);

  if (
    finalBlocks.length === 0 &&
    !metadata.visualizable &&
    !metadata.visualExplainer &&
    (metadata.suggestedActions ?? []).length === 0
  ) {
    return { metadata: null, audit };
  }

  return {
    metadata: {
      ...metadata,
      summary:
        metadata.summary &&
        context.assistantText &&
        tokenRecall(metadata.summary, context.assistantText) >= 0.72
          ? undefined
          : metadata.summary,
      blocks: finalBlocks,
      suggestedActions: metadata.suggestedActions ?? [],
    },
    audit,
  };
}
