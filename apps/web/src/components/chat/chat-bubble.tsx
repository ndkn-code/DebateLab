"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useLocale, useTranslations } from "next-intl";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  BeautifulFollowUps,
  BeautifulStreamingText,
  BeautifulToolChip,
} from "@/components/beautifului";
import {
  BookOpen,
  Check,
  CircleAlert,
  CircleHelp,
  Copy,
  Dumbbell,
  Lightbulb,
  ListChecks,
  PenLine,
  Play,
  Radar,
  RotateCcw,
  Sparkles,
  Target,
  ThumbsDown,
  ThumbsUp,
  User,
} from "@/components/ui/icons";
import {
  isCoachBlockRepeatedInText,
  pruneCoachMetadata,
} from "@/lib/coach/metadata";
import { cn } from "@/lib/utils";
import type {
  CoachMessageMetadata,
  CoachResponseBlock,
  CoachResponseBlockType,
  CoachVisualExplainerSpec,
} from "@/types";
import type { ChatMessageLocal } from "./chat-shell";

interface ChatBubbleProps {
  message: ChatMessageLocal;
  isStreaming?: boolean;
  onSendMessage?: (text: string) => void;
  onDraftMessage?: (text: string) => void;
  actionsDisabled?: boolean;
  renderStructuredMetadata?: boolean;
  isVisualizing?: boolean;
  onRequestVisualize?: (messageId: string) => void;
}

const BLOCK_STYLES: Record<
  CoachResponseBlockType,
  {
    icon: typeof Sparkles;
    className: string;
    iconClassName: string;
  }
> = {
  opening_formula: {
    icon: Target,
    className: "border-l-primary/45",
    iconClassName: "text-primary",
  },
  template: {
    icon: PenLine,
    className: "border-l-primary/35",
    iconClassName: "text-primary-dim",
  },
  diagnosis: {
    icon: Radar,
    className: "border-l-primary/35",
    iconClassName: "text-primary",
  },
  coach_tip: {
    icon: Lightbulb,
    className: "border-l-warning/45",
    iconClassName: "text-warning",
  },
  common_mistake: {
    icon: CircleAlert,
    className: "border-l-error/35",
    iconClassName: "text-error",
  },
  example: {
    icon: BookOpen,
    className: "border-l-primary/35",
    iconClassName: "text-primary",
  },
  drill: {
    icon: Dumbbell,
    className: "border-l-secondary/35",
    iconClassName: "text-secondary-dim",
  },
  next_steps: {
    icon: ListChecks,
    className: "border-l-secondary/35",
    iconClassName: "text-secondary-dim",
  },
  clarifying_question: {
    icon: CircleHelp,
    className: "border-l-primary/35",
    iconClassName: "text-primary",
  },
};

const CHAT_BUBBLE_COPY = {
  en: {
    blockLabels: {
      opening_formula: "Try this",
      template: "Try this",
      diagnosis: "Note",
      coach_tip: "Tip",
      common_mistake: "Common mistake",
      example: "Example",
      drill: "Drill",
      next_steps: "Next move",
      clarifying_question: "Question",
    },
    openingStepTitles: ["Motion", "Stance", "Thesis", "Roadmap"],
    step: "Step",
    openingBlueprint: "Opening blueprint",
    part: "part",
    parts: "parts",
    tryTemplate: "Try this template",
    useTemplate: "Use template",
    coachTip: "Coach tip",
    watchOut: "Watch out",
    exampleOpening: "Example opening",
    addMotionDetails: "Add motion details",
    takeaway: "Takeaway",
    replayAnimation: "Replay animation",
    buildingVisual: "Building visual…",
    showVisual: "Show visual explainer",
    copyResponse: "Copy response",
    helpful: "Helpful",
    notHelpful: "Not helpful",
    responseStopped: "Response stopped early.",
    continue: "Continue",
    continuePrompt: "Please continue your last answer.",
    visualPreparing: "Building visual explainer",
    visualPreparingDetail: "The diagram will appear here automatically.",
    openingTemplateDraft:
      "Today, we are debating whether [motion]. Our side believes [stance]. We support this because [reason 1] and [reason 2]. By the end of this debate, we will show that [main claim].",
    motionDetailsDraft: "Motion:\nSide:",
  },
  vi: {
    blockLabels: {
      opening_formula: "Thử cách này",
      template: "Thử cách này",
      diagnosis: "Lưu ý",
      coach_tip: "Mẹo",
      common_mistake: "Lỗi thường gặp",
      example: "Ví dụ",
      drill: "Bài luyện",
      next_steps: "Bước tiếp theo",
      clarifying_question: "Câu hỏi",
    },
    openingStepTitles: ["Kiến nghị", "Lập trường", "Luận đề", "Lộ trình"],
    step: "Bước",
    openingBlueprint: "Khung mở bài",
    part: "phần",
    parts: "phần",
    tryTemplate: "Thử mẫu này",
    useTemplate: "Dùng mẫu",
    coachTip: "Mẹo từ HLV",
    watchOut: "Cần tránh",
    exampleOpening: "Ví dụ mở bài",
    addMotionDetails: "Thêm kiến nghị và phe",
    takeaway: "Điểm cần nhớ",
    replayAnimation: "Xem lại minh họa",
    buildingVisual: "Đang tạo minh họa…",
    showVisual: "Xem minh họa",
    copyResponse: "Sao chép phản hồi",
    helpful: "Hữu ích",
    notHelpful: "Không hữu ích",
    responseStopped: "Phản hồi đã dừng sớm.",
    continue: "Tiếp tục",
    continuePrompt: "Vui lòng tiếp tục câu trả lời vừa rồi.",
    visualPreparing: "Đang tạo sơ đồ giải thích",
    visualPreparingDetail: "Sơ đồ sẽ tự động xuất hiện tại đây.",
    openingTemplateDraft:
      "Hôm nay, chúng ta tranh biện về [kiến nghị]. Phe của chúng ta cho rằng [lập trường]. Chúng ta bảo vệ lập trường này vì [lý do 1] và [lý do 2]. Cuối bài, chúng ta sẽ chứng minh [luận điểm chính].",
    motionDetailsDraft: "Kiến nghị:\nPhe:",
  },
} satisfies Record<
  "en" | "vi",
  {
    blockLabels: Record<CoachResponseBlockType, string>;
    openingStepTitles: string[];
    step: string;
    openingBlueprint: string;
    part: string;
    parts: string;
    tryTemplate: string;
    useTemplate: string;
    coachTip: string;
    watchOut: string;
    exampleOpening: string;
    addMotionDetails: string;
    takeaway: string;
    replayAnimation: string;
    buildingVisual: string;
    showVisual: string;
    copyResponse: string;
    helpful: string;
    notHelpful: string;
    responseStopped: string;
    continue: string;
    continuePrompt: string;
    visualPreparing: string;
    visualPreparingDetail: string;
    openingTemplateDraft: string;
    motionDetailsDraft: string;
  }
>;

function useChatBubbleCopy() {
  const locale = useLocale();
  return locale.startsWith("vi") ? CHAT_BUBBLE_COPY.vi : CHAT_BUBBLE_COPY.en;
}

function isCoachMessageMetadata(
  metadata: ChatMessageLocal["metadata"],
): metadata is CoachMessageMetadata {
  return (
    Boolean(metadata) &&
    metadata?.renderVersion === 1 &&
    Array.isArray(metadata.blocks) &&
    (metadata.blocks.length > 0 ||
      Boolean(metadata.visualizable) ||
      Boolean(metadata.visualExplainer))
  );
}

function blockText(block: CoachResponseBlock) {
  return [block.title, block.body, ...(block.items ?? [])]
    .filter(Boolean)
    .join(" ");
}

function isUsefulTemplate(block: CoachResponseBlock) {
  return Boolean(
    block.body &&
    block.body.length > 48 &&
    TEMPLATE_PLACEHOLDER_PATTERN.test(block.body),
  );
}

function isMissingContextBlock(block: CoachResponseBlock) {
  return MISSING_CONTEXT_PATTERN.test(blockText(block));
}

function getOpeningPart(item: string) {
  const cleaned = plainTextFromMarkdown(item).toLowerCase();
  const separatorIndex = cleaned.indexOf(":");
  if (separatorIndex < 0) return null;

  const label = cleaned.slice(0, separatorIndex).trim();
  const body = cleaned.slice(separatorIndex + 1).trim();

  if (label.includes("motion")) return { key: "motion", body };
  if (label.includes("stance") || label.includes("side")) {
    return { key: "stance", body };
  }
  if (label.includes("thesis") || label.includes("team line")) {
    return { key: "thesis", body };
  }
  if (label.includes("roadmap") || label.includes("preview")) {
    return { key: "roadmap", body };
  }

  return null;
}

function isUsefulOpeningFormula(block: CoachResponseBlock) {
  const items = block.items ?? [];
  if (items.length !== 4) return false;

  const parts = items.map(getOpeningPart);
  const partMap = new Map(
    parts.flatMap((part) => (part ? [[part.key, part.body]] : [])),
  );

  return (
    /\b(motion|topic)\b/.test(partMap.get("motion") ?? "") &&
    /\b(stance|side|support|oppose|position|proposition|opposition)\b/.test(
      partMap.get("stance") ?? "",
    ) &&
    /\b(reason|claim|because|mechanism|why|main)\b/.test(
      partMap.get("thesis") ?? "",
    ) &&
    /\b(preview|argument|point|roadmap|show)\b/.test(
      partMap.get("roadmap") ?? "",
    )
  );
}

function isUsefulClarifyingQuestion(block: CoachResponseBlock) {
  const text = blockText(block);
  return (
    text.length >= 20 &&
    (MISSING_CONTEXT_PATTERN.test(text) || text.includes("?"))
  );
}

function getRenderableMetadata(
  metadata: ChatMessageLocal["metadata"],
  assistantContent = "",
): CoachMessageMetadata | null {
  if (!isCoachMessageMetadata(metadata)) return null;
  const prunedMetadata = pruneCoachMetadata(metadata, {
    assistantText: assistantContent,
    intent: metadata.coachIntent,
  }).metadata;
  if (!prunedMetadata) return null;

  const filteredBlocks = prunedMetadata.blocks.filter((block) => {
    if (block.type === "opening_formula") return isUsefulOpeningFormula(block);
    if (block.type === "template") return isUsefulTemplate(block);
    if (block.type === "clarifying_question") {
      return isUsefulClarifyingQuestion(block);
    }
    if (isMissingContextBlock(block)) {
      return false;
    }
    return true;
  });

  if (prunedMetadata.visualExplainer) {
    return {
      ...prunedMetadata,
      blocks: [],
      suggestedActions: prunedMetadata.suggestedActions ?? [],
    };
  }

  const visibleBlocks = filteredBlocks
    .filter((block) => {
      const text = plainTextFromMarkdown(blockText(block)).toLowerCase();
      const content = plainTextFromMarkdown(assistantContent).toLowerCase();
      if (text.length < 36 || content.length < 80) return true;
      return (
        !content.includes(text.slice(0, Math.min(text.length, 120))) &&
        !isCoachBlockRepeatedInText(block, assistantContent)
      );
    })
    .slice(0, 2);

  const clarifyingBlocks = visibleBlocks.filter(
    (block) => block.type === "clarifying_question",
  );
  const hasOpeningBlueprint = visibleBlocks.some(
    (block) => block.type === "opening_formula",
  );

  if (clarifyingBlocks.length > 0 && !hasOpeningBlueprint) {
    return {
      ...prunedMetadata,
      blocks: clarifyingBlocks,
      suggestedActions: [],
    };
  }

  if (
    visibleBlocks.length === 0 &&
    !prunedMetadata.visualizable &&
    !prunedMetadata.visualExplainer
  ) {
    return null;
  }

  return {
    ...prunedMetadata,
    blocks: visibleBlocks,
    suggestedActions: prunedMetadata.suggestedActions ?? [],
  };
}

function MiniMarkdown({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "prose prose-sm max-w-none prose-p:my-0 prose-p:leading-6 prose-strong:text-on-surface prose-a:text-primary prose-ul:my-0 prose-ol:my-0 prose-li:my-0",
        className,
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  );
}

function OpeningBlueprintIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M7 4.75h7.25L17 7.5v11.75H7V4.75Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path
        d="M14.25 4.75V7.5H17"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path
        d="M9.25 10.25h5.5M9.25 13h5.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
      <path
        d="M9.5 16.25h5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
      <path
        d="M4.25 8.25v-2.5c0-.83.67-1.5 1.5-1.5H8M19.75 15.75v2.5c0 .83-.67 1.5-1.5 1.5H16"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <circle cx="12" cy="16.25" fill="currentColor" r="1" />
    </svg>
  );
}

const OPENING_STEP_ICONS = [Target, User, Lightbulb, ListChecks];
const TEMPLATE_PLACEHOLDER_PATTERN =
  /\[(motion|stance|side|reason|claim|argument|impact)[^\]]*\]/i;
const MISSING_CONTEXT_PATTERN =
  /\b(send|share|provide|tell me|complete|add)\b[\s\S]{0,80}\b(motion|side|topic|transcript|score|details)\b|\b(complete your thought|get started|once i know|before i can)\b/i;

function plainTextFromMarkdown(value: string) {
  return value.replace(/\*\*/g, "").replace(/`/g, "").trim();
}

function isProbablyRepeatedText(summary: string, content: string) {
  const normalizedSummary = plainTextFromMarkdown(summary)
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
  const normalizedContent = plainTextFromMarkdown(content)
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

  if (!normalizedSummary || !normalizedContent) return false;
  if (normalizedContent.includes(normalizedSummary.slice(0, 80))) return true;

  const summaryWords = new Set(
    normalizedSummary.split(/\s+/).filter((word) => word.length > 3),
  );
  if (summaryWords.size < 4) return false;

  const contentWords = new Set(
    normalizedContent.split(/\s+/).filter((word) => word.length > 3),
  );
  const overlap = Array.from(summaryWords).filter((word) =>
    contentWords.has(word),
  ).length;
  return overlap / summaryWords.size > 0.72;
}

function sentenceCase(value: string) {
  if (!value) return value;
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

function parseOpeningStep(
  item: string,
  index: number,
  titles: string[],
  stepLabel: string,
) {
  const cleaned = plainTextFromMarkdown(item);
  const separatorIndex = cleaned.indexOf(":");

  if (separatorIndex > -1) {
    return {
      title: cleaned.slice(0, separatorIndex).trim(),
      body: sentenceCase(cleaned.slice(separatorIndex + 1).trim()),
    };
  }

  return {
    title: titles[index] ?? `${stepLabel} ${index + 1}`,
    body: sentenceCase(cleaned),
  };
}

function CoachOpeningBlueprint({
  formulaBlock,
  templateBlock,
  tipBlock,
  mistakeBlock,
  exampleBlock,
  onDraftMessage,
  actionsDisabled,
}: {
  formulaBlock: CoachResponseBlock;
  templateBlock?: CoachResponseBlock;
  tipBlock?: CoachResponseBlock;
  mistakeBlock?: CoachResponseBlock;
  exampleBlock?: CoachResponseBlock;
  onDraftMessage?: (text: string) => void;
  actionsDisabled?: boolean;
}) {
  const copy = useChatBubbleCopy();
  const steps =
    formulaBlock.items && formulaBlock.items.length > 0
      ? formulaBlock.items.map((item, index) =>
          parseOpeningStep(item, index, copy.openingStepTitles, copy.step),
        )
      : [];

  if (steps.length < 3 || steps.length > 4) return null;

  return (
    <section className="overflow-hidden rounded-control border border-outline-variant bg-surface">
      <div className="border-b border-outline-variant/12 bg-primary/5 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary">
              <OpeningBlueprintIcon className="h-[19px] w-[19px]" />
            </div>
            <div className="min-w-0">
              <div className="type-eyebrow text-primary">
                {copy.openingBlueprint}
              </div>
            </div>
          </div>
          <div className="rounded-md border border-primary/20 bg-surface px-2 py-1 type-caption font-semibold text-primary">
            {steps.length} {steps.length === 1 ? copy.part : copy.parts}
          </div>
        </div>
      </div>

      <div className="grid gap-2.5 p-3 lg:grid-cols-[0.94fr_1.06fr]">
        <div className="space-y-2.5">
          {steps.map((step, index) => {
            const StepIcon = OPENING_STEP_ICONS[index] ?? Target;

            return (
              <div
                key={`${formulaBlock.id}-step-${index}`}
                className="flex min-h-[66px] gap-3 rounded-control border border-outline-variant/12 bg-surface-container p-3"
              >
                <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary type-caption font-bold text-on-primary shadow-token-primary">
                  {index + 1}
                </span>
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <StepIcon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="type-label font-semibold text-on-surface">
                    {step.title}
                  </div>
                  <p className="mt-1 type-body-sm text-on-surface-variant">
                    {step.body}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="space-y-3">
          {templateBlock && (
            <div className="rounded-control border border-primary/16 bg-primary/5 p-3">
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface text-primary">
                  <PenLine className="h-[18px] w-[18px]" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="type-eyebrow text-primary">
                    {copy.tryTemplate}
                  </div>
                  {templateBlock.body && (
                    <p className="mt-2 type-body-sm text-on-surface-variant">
                      {plainTextFromMarkdown(templateBlock.body)}
                    </p>
                  )}
                  {onDraftMessage && (
                    <button
                      type="button"
                      onClick={() => onDraftMessage(copy.openingTemplateDraft)}
                      disabled={actionsDisabled}
                      className="mt-3 inline-flex items-center gap-2 rounded-full bg-primary px-3 py-1.5 type-caption font-semibold text-on-primary shadow-token-primary transition-colors hover:bg-primary-dim disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      {copy.useTemplate}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            {tipBlock && (
              <div className="rounded-control border border-warning/32 bg-surface-container p-3">
                <div className="flex items-center gap-2 type-eyebrow text-warning">
                  <Lightbulb className="h-4 w-4" />
                  {copy.coachTip}
                </div>
                <h4 className="mt-2 type-label font-semibold text-on-surface">
                  {tipBlock.title}
                </h4>
                {tipBlock.body && (
                  <p className="mt-2 type-body-sm text-on-surface-variant">
                    {plainTextFromMarkdown(tipBlock.body)}
                  </p>
                )}
              </div>
            )}

            {mistakeBlock && (
              <div className="rounded-control border border-error/24 bg-surface-container p-3">
                <div className="flex items-center gap-2 type-eyebrow text-error">
                  <CircleAlert className="h-4 w-4" />
                  {copy.watchOut}
                </div>
                <h4 className="mt-2 type-label font-semibold text-on-surface">
                  {mistakeBlock.title}
                </h4>
                {mistakeBlock.body && (
                  <p className="mt-2 type-body-sm text-on-surface-variant">
                    {plainTextFromMarkdown(mistakeBlock.body)}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {exampleBlock && (
        <div className="bg-surface-container px-3 pb-3 sm:px-4 sm:pb-4">
          <div className="flex items-start gap-3 rounded-lg border border-primary/20 bg-surface p-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-container text-primary">
              <BookOpen className="h-[18px] w-[18px]" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="type-eyebrow text-primary">
                {copy.exampleOpening}
              </div>
              {exampleBlock.body && (
                <p className="mt-1 type-body-sm text-on-surface-variant">
                  {plainTextFromMarkdown(exampleBlock.body)}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function CoachBlockCard({ block }: { block: CoachResponseBlock }) {
  const copy = useChatBubbleCopy();
  const style = BLOCK_STYLES[block.type];
  const Icon = style.icon;

  return (
    <section
      className={cn(
        "rounded-none border-0 border-l-2 bg-transparent py-2 pl-3 pr-2",
        style.className,
      )}
    >
      <div className="flex items-start gap-2.5">
        <Icon
          className={cn("mt-1 h-3.5 w-3.5 shrink-0", style.iconClassName)}
        />
        <div className="min-w-0 flex-1">
          <div className="type-eyebrow text-on-surface-variant">
            {copy.blockLabels[block.type]}
          </div>
          {block.title ? (
            <h3 className="mt-0.5 type-label font-semibold text-on-surface">
              {block.title}
            </h3>
          ) : null}
          {block.body && (
            <MiniMarkdown className="mt-1 text-on-surface-variant">
              {block.body}
            </MiniMarkdown>
          )}
          {block.items && block.items.length > 0 && (
            <ul className="mt-1.5 space-y-1 type-body-sm text-on-surface-variant">
              {block.items.map((item, itemIndex) => (
                <li
                  key={`${block.id}-item-${itemIndex}`}
                  className="flex gap-2"
                >
                  <span className="mt-[10px] h-1 w-1 shrink-0 rounded-full bg-primary/60" />
                  <MiniMarkdown className="min-w-0 flex-1">{item}</MiniMarkdown>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

function CoachFollowUpQuestion({
  block,
  onDraftMessage,
  actionsDisabled,
}: {
  block: CoachResponseBlock;
  onDraftMessage?: (text: string) => void;
  actionsDisabled?: boolean;
}) {
  const copy = useChatBubbleCopy();
  const questionText = `${block.title} ${block.body ?? ""}`.toLowerCase();
  const canDraftMotionDetails =
    Boolean(onDraftMessage) &&
    (questionText.includes("motion") ||
      questionText.includes("side") ||
      questionText.includes("kiến nghị") ||
      questionText.includes("phe"));

  return (
    <div className="mt-4 max-w-[720px] type-body text-on-surface-variant">
      {block.title && <MiniMarkdown>{block.title}</MiniMarkdown>}
      {block.body && <MiniMarkdown className="mt-1">{block.body}</MiniMarkdown>}
      {canDraftMotionDetails && onDraftMessage && (
        <button
          type="button"
          onClick={() => onDraftMessage(copy.motionDetailsDraft)}
          disabled={actionsDisabled}
          className="mt-2 inline-flex h-8 items-center gap-2 rounded-control border border-primary/20 bg-surface px-3 type-caption font-semibold text-primary transition-colors hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Sparkles className="h-3.5 w-3.5" />
          {copy.addMotionDetails}
        </button>
      )}
    </div>
  );
}

function visualConnectorSymbol(index: number, connectorLabel?: string) {
  if (connectorLabel && /^(vs|v|versus)$/i.test(connectorLabel.trim())) {
    return "vs";
  }
  return index === 0 ? "+" : "→";
}

function visualLineClass(accent?: string) {
  if (accent === "warning") return "bg-surface-container-high/70";
  if (accent === "danger") return "bg-surface-container-high/65";
  return "bg-primary/72";
}

function buildVisualExplanation(visual: CoachVisualExplainerSpec) {
  const sentences = visual.steps
    .map((step) => step.text.trim().replace(/[.!?]+$/, ""))
    .filter(Boolean)
    .slice(0, 4);

  if (sentences.length === 0) return visual.subtitle ?? "";
  return `${sentences.join(". ")}.`;
}

function normalizeFormulaText(value: string) {
  return value.toLowerCase().replace(/[\s+→\-–—:]+/g, "");
}

function CoachVisualExplainerCard({
  visual,
}: {
  visual: CoachVisualExplainerSpec;
}) {
  const copy = useChatBubbleCopy();
  const shouldReduceMotion = useReducedMotion();
  const [replayKey, setReplayKey] = useState(0);
  const explanation = buildVisualExplanation(visual);
  const connectorByStepId = new Map(
    (visual.connectors ?? []).map((connector) => [connector.from, connector]),
  );
  const formulaText = visual.steps
    .map((step, index) =>
      index === 0
        ? step.label
        : `${visualConnectorSymbol(
            index - 1,
            connectorByStepId.get(visual.steps[index - 1]?.id)?.label,
          )} ${step.label}`,
    )
    .join(" ");
  const titleIsFormula =
    normalizeFormulaText(visual.title) === normalizeFormulaText(formulaText);

  return (
    <section className="mt-5 max-w-[780px] overflow-hidden rounded-control border border-outline-variant bg-surface shadow-none">
      <div className="px-5 py-6 sm:px-8 sm:py-7">
        {titleIsFormula && !visual.subtitle ? null : (
          <motion.div
            key={`${replayKey}-title`}
            initial={shouldReduceMotion ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: shouldReduceMotion ? 0 : 0.28,
              ease: "easeOut",
            }}
            className="text-center"
          >
            {!titleIsFormula ? (
              <h3 className="type-heading-md text-on-surface">
                {visual.title}
              </h3>
            ) : null}
            {visual.subtitle ? (
              <p
                className={cn(
                  "mx-auto max-w-[560px] type-body-sm text-on-surface-variant",
                  titleIsFormula ? "mt-0" : "mt-1",
                )}
              >
                {visual.subtitle}
              </p>
            ) : null}
          </motion.div>
        )}

        <div
          className={cn(
            "mx-auto flex max-w-[680px] flex-wrap items-center justify-center gap-x-3 gap-y-4 text-center",
            titleIsFormula && !visual.subtitle ? "mt-1" : "mt-7",
          )}
        >
          {visual.steps.map((step, index) => {
            const connectorLabel = connectorByStepId.get(step.id)?.label;
            const symbol = visualConnectorSymbol(index, connectorLabel);
            const delay = 0.2 + index * 0.18;

            return (
              <div key={`${replayKey}-formula-${step.id}`} className="contents">
                <motion.span
                  initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    delay: shouldReduceMotion ? 0 : delay,
                    duration: shouldReduceMotion ? 0 : 0.32,
                    ease: "easeOut",
                  }}
                  className="relative inline-flex px-1 pb-2 type-heading-lg text-on-surface"
                >
                  {step.label}
                  <motion.span
                    initial={shouldReduceMotion ? false : { scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{
                      delay: shouldReduceMotion ? 0 : delay + 0.18,
                      duration: shouldReduceMotion ? 0 : 0.38,
                      ease: "easeOut",
                    }}
                    className={cn(
                      "absolute inset-x-1 bottom-0 h-[2px] origin-left rounded-full",
                      visualLineClass(step.accent),
                    )}
                  />
                </motion.span>
                {index < visual.steps.length - 1 ? (
                  <motion.span
                    initial={shouldReduceMotion ? false : { opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      delay: shouldReduceMotion ? 0 : delay + 0.12,
                      duration: shouldReduceMotion ? 0 : 0.22,
                      ease: "easeOut",
                    }}
                    className="pb-2 type-heading-md text-on-surface-variant"
                    aria-label={connectorLabel ?? symbol}
                  >
                    {symbol}
                  </motion.span>
                ) : null}
              </div>
            );
          })}
        </div>

        {explanation ? (
          <motion.p
            key={`${replayKey}-body`}
            initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              delay: shouldReduceMotion ? 0 : 0.34 + visual.steps.length * 0.18,
              duration: shouldReduceMotion ? 0 : 0.35,
              ease: "easeOut",
            }}
            className="mx-auto mt-8 max-w-[620px] type-body text-on-surface-variant"
          >
            {explanation}
          </motion.p>
        ) : null}

        {visual.takeaway ? (
          <motion.div
            key={`${replayKey}-takeaway`}
            initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              delay: shouldReduceMotion ? 0 : 0.48 + visual.steps.length * 0.18,
              duration: shouldReduceMotion ? 0 : 0.32,
              ease: "easeOut",
            }}
            className="mt-6 border-t border-outline-variant pt-4 type-body text-on-surface"
          >
            <span className="font-semibold">{copy.takeaway}: </span>
            <span className="text-on-surface-variant">{visual.takeaway}</span>
          </motion.div>
        ) : null}

        {!shouldReduceMotion ? (
          <button
            type="button"
            onClick={() => setReplayKey((key) => key + 1)}
            className="mt-6 inline-flex h-8 items-center gap-2 rounded-control border border-outline-variant bg-surface px-3 type-label font-semibold text-on-surface transition-colors hover:border-primary/30 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            {copy.replayAnimation}
          </button>
        ) : null}
      </div>
    </section>
  );
}

function VisualizeButton({
  onClick,
  disabled,
  loading,
}: {
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  const copy = useChatBubbleCopy();
  if (!onClick) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className="mt-4 inline-flex h-9 items-center gap-2 rounded-full border border-primary/18 bg-primary/5 px-3 type-label font-semibold text-primary transition-colors hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {loading ? (
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary/25 border-t-primary" />
      ) : (
        <Play className="h-3.5 w-3.5" />
      )}
      {loading ? copy.buildingVisual : copy.showVisual}
    </button>
  );
}

function CoachSuggestedActions({
  actions,
  onSendMessage,
  disabled,
}: {
  actions: CoachMessageMetadata["suggestedActions"];
  onSendMessage?: (text: string) => void;
  disabled?: boolean;
}) {
  const t = useTranslations("dashboard.chat.coach");
  if (!onSendMessage || actions.length === 0) return null;
  return (
    <BeautifulFollowUps
      label={t("recommended_next_steps")}
      items={actions.slice(0, 3).map((action, index) => ({
        id: `${action.label}-${index}`,
        label: action.label,
        value: action.prompt,
      }))}
      onSelect={(action) => onSendMessage(action.value)}
      disabled={disabled}
    />
  );
}

function AssistantActions({ content }: { content: string }) {
  const copy = useChatBubbleCopy();
  const [copied, setCopied] = useState(false);
  const [vote, setVote] = useState<"up" | "down" | null>(null);

  useEffect(() => {
    if (!copied) return;
    const timeout = window.setTimeout(() => setCopied(false), 1400);
    return () => window.clearTimeout(timeout);
  }, [copied]);

  const iconButtonClass =
    "inline-flex h-8 w-8 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-primary/10 hover:text-primary disabled:cursor-not-allowed disabled:opacity-45";

  const copyMessage = async () => {
    if (!content.trim()) return;
    await navigator.clipboard.writeText(content);
    setCopied(true);
  };

  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5">
      <button
        type="button"
        onClick={copyMessage}
        className={iconButtonClass}
        title={copy.copyResponse}
        aria-label={copy.copyResponse}
      >
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      </button>
      <button
        type="button"
        onClick={() => setVote(vote === "up" ? null : "up")}
        className={cn(
          iconButtonClass,
          vote === "up" && "bg-primary/10 text-primary",
        )}
        title={copy.helpful}
        aria-label={copy.helpful}
      >
        <ThumbsUp className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => setVote(vote === "down" ? null : "down")}
        className={cn(
          iconButtonClass,
          vote === "down" && "bg-error/10 text-error",
        )}
        title={copy.notHelpful}
        aria-label={copy.notHelpful}
      >
        <ThumbsDown className="h-4 w-4" />
      </button>
    </div>
  );
}

function AssistantMessage({
  message,
  isStreaming,
  onSendMessage,
  onDraftMessage,
  actionsDisabled,
  renderStructuredMetadata = false,
  isVisualizing = false,
  onRequestVisualize,
}: ChatBubbleProps) {
  const t = useTranslations("dashboard.chat");
  const copy = useChatBubbleCopy();
  const shouldReduceMotion = useReducedMotion();
  const metadata = renderStructuredMetadata
    ? getRenderableMetadata(message.metadata, message.content)
    : null;
  const cardBlocks =
    metadata?.blocks.filter((block) => block.type !== "clarifying_question") ??
    [];
  const followUpBlocks =
    metadata?.blocks.filter((block) => block.type === "clarifying_question") ??
    [];
  const formulaBlock = cardBlocks.find(
    (block) => block.type === "opening_formula",
  );
  const templateBlock = cardBlocks.find((block) => block.type === "template");
  const tipBlock = cardBlocks.find((block) => block.type === "coach_tip");
  const mistakeBlock = cardBlocks.find(
    (block) => block.type === "common_mistake",
  );
  const exampleBlock = cardBlocks.find((block) => block.type === "example");
  const blueprintBlockIds = new Set(
    [formulaBlock, templateBlock, tipBlock, mistakeBlock, exampleBlock]
      .filter(Boolean)
      .map((block) => block!.id),
  );
  const fallbackBlocks = formulaBlock
    ? cardBlocks.filter((block) => !blueprintBlockIds.has(block.id))
    : cardBlocks;
  const canRequestVisual =
    Boolean(metadata?.visualizable) &&
    !metadata?.autoVisualize &&
    !metadata?.visualExplainer &&
    !isStreaming &&
    !message.id.startsWith("temp-");
  const shouldShowVisualPreparing =
    Boolean(metadata?.autoVisualize) &&
    Boolean(metadata?.visualizable) &&
    !metadata?.visualExplainer &&
    !isStreaming &&
    !message.id.startsWith("temp-");
  const metadataSummary =
    metadata?.summary &&
    !metadata.visualExplainer &&
    !isProbablyRepeatedText(metadata.summary, message.content)
      ? metadata.summary
      : null;
  return (
    <motion.div
      layout={!shouldReduceMotion}
      initial={shouldReduceMotion ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: shouldReduceMotion ? 0 : 0.18,
        ease: "easeOut",
      }}
      className="group flex gap-3"
    >
      <div className="mt-3 h-2 w-2 shrink-0 rounded-full bg-primary" />

      <div className="min-w-0 flex-1">
        <div className="mb-1.5 flex flex-wrap items-center gap-2">
          <div className="type-label font-semibold text-on-surface">
            {t("header_title")}
          </div>
          {isStreaming && (
            <span className="type-caption font-medium text-on-surface-variant">
              {t("coach.pending")}
            </span>
          )}
        </div>

        {message.content ? (
          <motion.div
            layout={!shouldReduceMotion}
            transition={{
              duration: shouldReduceMotion ? 0 : 0.16,
              ease: "easeOut",
            }}
            className="max-w-[760px] px-0 py-1 type-body"
          >
            <BeautifulStreamingText streaming={isStreaming}>
              <div className="prose max-w-none prose-p:my-3 prose-p:leading-8 prose-ul:my-3 prose-ol:my-3 prose-li:my-1.5 prose-li:leading-7 prose-strong:font-semibold prose-strong:text-on-surface prose-headings:text-on-surface prose-headings:mb-2 prose-headings:mt-5 prose-p:text-on-surface prose-li:text-on-surface prose-a:text-primary prose-code:rounded prose-code:bg-surface-container prose-code:px-1 prose-code:py-0.5 prose-code:text-primary prose-pre:rounded-control prose-pre:bg-surface-container">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {message.content}
                </ReactMarkdown>
              </div>
            </BeautifulStreamingText>
          </motion.div>
        ) : null}

        {metadata ? (
          <div className="max-w-[880px]">
            {metadataSummary && (
              <div className="mb-3 max-w-[780px] px-0 type-body text-on-surface-variant">
                <MiniMarkdown>{metadataSummary}</MiniMarkdown>
              </div>
            )}

            <div className="space-y-3">
              {formulaBlock && (
                <CoachOpeningBlueprint
                  formulaBlock={formulaBlock}
                  templateBlock={templateBlock}
                  tipBlock={tipBlock}
                  mistakeBlock={mistakeBlock}
                  exampleBlock={exampleBlock}
                  onDraftMessage={onDraftMessage}
                  actionsDisabled={actionsDisabled}
                />
              )}

              {fallbackBlocks.map((block, blockIndex) => (
                <CoachBlockCard
                  key={`${block.id}-${blockIndex}`}
                  block={block}
                />
              ))}
            </div>

            {followUpBlocks.map((block) => (
              <CoachFollowUpQuestion
                key={block.id}
                block={block}
                onDraftMessage={onDraftMessage}
                actionsDisabled={actionsDisabled}
              />
            ))}

            {metadata.visualExplainer ? (
              <CoachVisualExplainerCard visual={metadata.visualExplainer} />
            ) : shouldShowVisualPreparing ? (
              <CoachVisualPreparingCard />
            ) : (
              <VisualizeButton
                onClick={
                  canRequestVisual && onRequestVisualize
                    ? () => onRequestVisualize(message.id)
                    : undefined
                }
                disabled={actionsDisabled}
                loading={isVisualizing}
              />
            )}

            <CoachSuggestedActions
              actions={metadata.suggestedActions ?? []}
              onSendMessage={onSendMessage}
              disabled={actionsDisabled}
            />
          </div>
        ) : null}

        {message.isTruncated && !isStreaming && (
          <div className="mt-2 flex flex-wrap items-center gap-2 type-caption text-on-surface-variant">
            <span>{copy.responseStopped}</span>
            {onSendMessage && (
              <button
                type="button"
                onClick={() => onSendMessage(copy.continuePrompt)}
                disabled={actionsDisabled}
                className="rounded-md border border-primary/20 bg-surface px-2.5 py-1 font-semibold text-primary transition-colors hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {copy.continue}
              </button>
            )}
          </div>
        )}

        {message.content && !isStreaming && (
          <AssistantActions content={message.content} />
        )}
      </div>
    </motion.div>
  );
}

function CoachVisualPreparingCard() {
  const [expanded, setExpanded] = useState(false);
  const copy = useChatBubbleCopy();
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.section
      initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: shouldReduceMotion ? 0 : 0.24,
        ease: "easeOut",
      }}
      className="mt-5 max-w-[820px] overflow-hidden rounded-control border border-outline-variant bg-surface shadow-none"
      aria-live="polite"
    >
      <div className="border-b border-outline-variant px-5 py-4">
        <BeautifulToolChip
          label={copy.visualPreparing}
          status="running"
          icon={<Sparkles className="size-3.5" aria-hidden="true" />}
          detail={copy.visualPreparingDetail}
          expanded={expanded}
          onExpandedChange={setExpanded}
        />
      </div>
      <div className="space-y-5 px-5 py-6">
        <div className="mx-auto h-5 w-3/5 animate-pulse rounded-full bg-surface-container motion-reduce:animate-none" />
        <div className="flex items-center justify-center gap-4">
          <div className="h-16 w-24 animate-pulse rounded-[18px] bg-surface-container motion-reduce:animate-none sm:w-32" />
          <div className="h-px w-6 bg-surface-container-high sm:w-8" />
          <div className="h-16 w-24 animate-pulse rounded-[18px] bg-surface-container motion-reduce:animate-none sm:w-32" />
          <div className="hidden h-px w-8 bg-surface-container-high sm:block" />
          <div className="hidden h-16 w-32 animate-pulse rounded-[18px] bg-surface-container motion-reduce:animate-none sm:block" />
        </div>
        <div className="mx-auto h-3 w-4/5 animate-pulse rounded-full bg-surface-container motion-reduce:animate-none" />
      </div>
    </motion.section>
  );
}

function UserMessage({ message }: { message: ChatMessageLocal }) {
  return (
    <div className="flex flex-row-reverse items-start gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary shadow-token-primary">
        <User className="h-4 w-4" />
      </div>
      <div className="max-w-[min(76%,680px)] rounded-xl rounded-tr-md bg-primary px-4 py-2.5 type-body text-on-primary shadow-none">
        <p className="whitespace-pre-wrap">{message.content}</p>
      </div>
    </div>
  );
}

export function ChatBubble(props: ChatBubbleProps) {
  if (props.message.role === "user") {
    return <UserMessage message={props.message} />;
  }

  return <AssistantMessage {...props} />;
}
