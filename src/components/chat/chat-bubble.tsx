"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  BookOpen,
  Check,
  ChevronDown,
  CircleAlert,
  CircleHelp,
  Copy,
  Dumbbell,
  Lightbulb,
  ListChecks,
  PenLine,
  RotateCcw,
  Sparkles,
  Target,
  ThumbsDown,
  ThumbsUp,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  CoachMessageMetadata,
  CoachResponseBlock,
  CoachResponseBlockType,
} from "@/types";
import type { ChatMessageLocal } from "./chat-shell";

interface ChatBubbleProps {
  message: ChatMessageLocal;
  isStreaming?: boolean;
  onSendMessage?: (text: string) => void;
  onDraftMessage?: (text: string) => void;
  actionsDisabled?: boolean;
}

const BLOCK_STYLES: Record<
  CoachResponseBlockType,
  {
    label: string;
    icon: typeof Sparkles;
    className: string;
    iconClassName: string;
  }
> = {
  opening_formula: {
    label: "Opening Formula",
    icon: Target,
    className: "border-primary/18 bg-[#F8FBFF]",
    iconClassName: "bg-primary/10 text-primary",
  },
  template: {
    label: "Try This Template",
    icon: PenLine,
    className: "border-primary/18 bg-white",
    iconClassName: "bg-[#EEF4FF] text-primary-dim",
  },
  coach_tip: {
    label: "Coach Tip",
    icon: Lightbulb,
    className: "border-[#F5B942]/35 bg-[#FFFBF1]",
    iconClassName: "bg-[#FFF4D9] text-[#B87900]",
  },
  common_mistake: {
    label: "Common Mistake",
    icon: CircleAlert,
    className: "border-error/30 bg-[#FFF8F8]",
    iconClassName: "bg-error-container text-error",
  },
  example: {
    label: "Example",
    icon: BookOpen,
    className: "border-primary-fixed/45 bg-[#FBFDFF]",
    iconClassName: "bg-primary-container text-primary",
  },
  drill: {
    label: "Practice Drill",
    icon: Dumbbell,
    className: "border-secondary/25 bg-[#F7FEF9]",
    iconClassName: "bg-secondary-container text-secondary-dim",
  },
  next_steps: {
    label: "Next Steps",
    icon: ListChecks,
    className: "border-secondary/25 bg-white",
    iconClassName: "bg-secondary-container text-secondary-dim",
  },
  clarifying_question: {
    label: "Question",
    icon: CircleHelp,
    className: "border-primary/18 bg-primary/5",
    iconClassName: "bg-white text-primary",
  },
};

function isCoachMessageMetadata(
  metadata: ChatMessageLocal["metadata"]
): metadata is CoachMessageMetadata {
  return (
    Boolean(metadata) &&
    metadata?.renderVersion === 1 &&
    Array.isArray(metadata.blocks) &&
    metadata.blocks.length > 0
  );
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
        className
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
const OPENING_STEP_TITLES = ["Motion", "Stance", "Thesis", "Roadmap"];
const OPENING_TEMPLATE_DRAFT =
  "Today, we are debating whether [motion]. Our side believes [stance]. We support this because [reason 1] and [reason 2]. By the end of this debate, we will show that [main claim].";
const MOTION_DETAILS_DRAFT = "Motion:\nSide:";

function plainTextFromMarkdown(value: string) {
  return value.replace(/\*\*/g, "").replace(/`/g, "").trim();
}

function sentenceCase(value: string) {
  if (!value) return value;
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

function parseOpeningStep(item: string, index: number) {
  const cleaned = plainTextFromMarkdown(item);
  const separatorIndex = cleaned.indexOf(":");

  if (separatorIndex > -1) {
    return {
      title: cleaned.slice(0, separatorIndex).trim(),
      body: sentenceCase(cleaned.slice(separatorIndex + 1).trim()),
    };
  }

  return {
    title: OPENING_STEP_TITLES[index] ?? `Step ${index + 1}`,
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
  const steps =
    formulaBlock.items && formulaBlock.items.length > 0
      ? formulaBlock.items.map(parseOpeningStep)
      : [
          {
            title: "Motion",
            body: "Name the exact debate topic.",
          },
          {
            title: "Stance",
            body: "Say whether you support or oppose it.",
          },
          {
            title: "Thesis",
            body: "Explain your main reason in one sentence.",
          },
          {
            title: "Roadmap",
            body: "Preview your strongest arguments.",
          },
        ];

  return (
    <section className="overflow-hidden rounded-[24px] border border-primary/18 bg-white shadow-[0_22px_54px_rgba(41,74,132,0.09)]">
      <div className="bg-gradient-to-r from-primary/5 via-white to-[#F7FAFE] px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-primary text-on-primary shadow-[0_12px_24px_rgba(77,134,247,0.26)]">
              <OpeningBlueprintIcon className="h-[19px] w-[19px]" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
                Opening Blueprint
              </div>
            </div>
          </div>
          <div className="rounded-full border border-primary/14 bg-white px-2.5 py-1 text-[11px] font-semibold text-primary">
            4 parts
          </div>
        </div>
      </div>

      <div className="grid gap-3 p-3 sm:p-4 lg:grid-cols-[0.94fr_1.06fr]">
        <div className="space-y-2.5">
          {steps.map((step, index) => {
            const StepIcon = OPENING_STEP_ICONS[index] ?? Target;

            return (
              <div
                key={`${formulaBlock.id}-step-${index}`}
                className="flex min-h-[74px] gap-3 rounded-[18px] border border-outline-variant/12 bg-[#FBFDFF] p-3 shadow-[0_10px_24px_rgba(41,74,132,0.045)]"
              >
                <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-on-primary shadow-[0_8px_16px_rgba(77,134,247,0.2)]">
                  {index + 1}
                </span>
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <StepIcon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-on-surface">
                    {step.title}
                  </div>
                  <p className="mt-1 text-sm leading-5 text-on-surface-variant">
                    {step.body}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="space-y-3">
          {templateBlock && (
            <div className="rounded-[20px] border border-primary/16 bg-primary/5 p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-white text-primary shadow-[0_8px_18px_rgba(77,134,247,0.14)]">
                  <PenLine className="h-[18px] w-[18px]" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.15em] text-primary">
                    Try This Template
                  </div>
                  {templateBlock.body && (
                    <p className="mt-2 text-sm leading-6 text-on-surface-variant">
                      {plainTextFromMarkdown(templateBlock.body)}
                    </p>
                  )}
                  {onDraftMessage && (
                    <button
                      type="button"
                      onClick={() => onDraftMessage(OPENING_TEMPLATE_DRAFT)}
                      disabled={actionsDisabled}
                      className="mt-3 inline-flex items-center gap-2 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-on-primary shadow-[0_10px_20px_rgba(77,134,247,0.18)] transition-colors hover:bg-primary-dim disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      Use template
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            {tipBlock && (
              <div className="rounded-[20px] border border-[#F5B942]/32 bg-[#FFFBF1] p-4">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-[#956300]">
                  <Lightbulb className="h-4 w-4" />
                  Coach Tip
                </div>
                <h4 className="mt-2 text-sm font-semibold leading-5 text-on-surface">
                  {tipBlock.title}
                </h4>
                {tipBlock.body && (
                  <p className="mt-2 text-sm leading-5 text-on-surface-variant">
                    {plainTextFromMarkdown(tipBlock.body)}
                  </p>
                )}
              </div>
            )}

            {mistakeBlock && (
              <div className="rounded-[20px] border border-error/24 bg-[#FFF8F8] p-4">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-error">
                  <CircleAlert className="h-4 w-4" />
                  Watch Out
                </div>
                <h4 className="mt-2 text-sm font-semibold leading-5 text-on-surface">
                  {mistakeBlock.title}
                </h4>
                {mistakeBlock.body && (
                  <p className="mt-2 text-sm leading-5 text-on-surface-variant">
                    {plainTextFromMarkdown(mistakeBlock.body)}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {exampleBlock && (
        <div className="bg-[#FBFDFF] px-3 pb-3 sm:px-4 sm:pb-4">
          <div className="flex items-start gap-3 rounded-[18px] border border-primary/12 bg-white p-3 shadow-[0_10px_24px_rgba(41,74,132,0.045)]">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-primary-container text-primary">
              <BookOpen className="h-[18px] w-[18px]" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-semibold uppercase tracking-[0.15em] text-primary">
                Example Opening
              </div>
              {exampleBlock.body && (
                <p className="mt-1 line-clamp-2 text-sm leading-5 text-on-surface-variant">
                  {plainTextFromMarkdown(exampleBlock.body)}
                </p>
              )}
            </div>
            <ChevronDown className="mt-2 h-4 w-4 shrink-0 text-on-surface-variant/70" />
          </div>
        </div>
      )}
    </section>
  );
}

function CoachBlockCard({
  block,
  onSendMessage,
  actionsDisabled,
}: {
  block: CoachResponseBlock;
  onSendMessage?: (text: string) => void;
  actionsDisabled?: boolean;
}) {
  const style = BLOCK_STYLES[block.type];
  const Icon = style.icon;

  return (
    <section
      className={cn(
        "rounded-[20px] border px-4 py-4 shadow-[0_14px_34px_rgba(11,20,36,0.045)]",
        style.className
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl",
            style.iconClassName
          )}
        >
          <Icon className="h-[18px] w-[18px]" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-on-surface-variant">
            {style.label}
          </div>
          <h3 className="mt-1 text-[15px] font-semibold leading-6 text-on-surface">
            {block.title}
          </h3>
          {block.body && (
            <MiniMarkdown className="mt-2 text-on-surface-variant">
              {block.body}
            </MiniMarkdown>
          )}
          {block.items && block.items.length > 0 && (
            <ul className="mt-3 space-y-2 text-sm leading-6 text-on-surface-variant">
              {block.items.map((item, itemIndex) => (
                <li key={`${block.id}-item-${itemIndex}`} className="flex gap-2">
                  <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-primary/70" />
                  <MiniMarkdown className="min-w-0 flex-1">{item}</MiniMarkdown>
                </li>
              ))}
            </ul>
          )}
          {block.prompt && onSendMessage && (
            <button
              type="button"
              onClick={() => onSendMessage(block.prompt!)}
              disabled={actionsDisabled}
              className="mt-3 inline-flex items-center gap-2 rounded-full border border-primary/18 bg-white px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Ask coach
            </button>
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
  const questionText = `${block.title} ${block.body ?? ""}`.toLowerCase();
  const canDraftMotionDetails =
    Boolean(onDraftMessage) &&
    (questionText.includes("motion") || questionText.includes("side"));

  return (
    <div className="mt-4 max-w-[720px] text-[15px] leading-7 text-on-surface-variant">
      {block.title && <MiniMarkdown>{block.title}</MiniMarkdown>}
      {block.body && <MiniMarkdown className="mt-1">{block.body}</MiniMarkdown>}
      {canDraftMotionDetails && onDraftMessage && (
        <button
          type="button"
          onClick={() => onDraftMessage(MOTION_DETAILS_DRAFT)}
          disabled={actionsDisabled}
          className="mt-2 inline-flex items-center gap-2 rounded-full border border-primary/18 bg-white px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Sparkles className="h-3.5 w-3.5" />
          Add motion details
        </button>
      )}
    </div>
  );
}

function AssistantActions({
  content,
  onSendMessage,
  actionsDisabled,
}: {
  content: string;
  onSendMessage?: (text: string) => void;
  actionsDisabled?: boolean;
}) {
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
        title="Copy response"
        aria-label="Copy response"
      >
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      </button>
      <button
        type="button"
        onClick={() => setVote(vote === "up" ? null : "up")}
        className={cn(iconButtonClass, vote === "up" && "bg-primary/10 text-primary")}
        title="Helpful"
        aria-label="Helpful"
      >
        <ThumbsUp className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => setVote(vote === "down" ? null : "down")}
        className={cn(iconButtonClass, vote === "down" && "bg-error/10 text-error")}
        title="Not helpful"
        aria-label="Not helpful"
      >
        <ThumbsDown className="h-4 w-4" />
      </button>
      {onSendMessage && (
        <button
          type="button"
          onClick={() =>
            onSendMessage("Please regenerate your last answer with a clearer coach structure.")
          }
          disabled={actionsDisabled}
          className={iconButtonClass}
          title="Regenerate"
          aria-label="Regenerate"
        >
          <RotateCcw className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

function AssistantMessage({
  message,
  isStreaming,
  onSendMessage,
  onDraftMessage,
  actionsDisabled,
}: ChatBubbleProps) {
  const metadata = isCoachMessageMetadata(message.metadata)
    ? message.metadata
    : null;
  const cardBlocks =
    metadata?.blocks.filter((block) => block.type !== "clarifying_question") ?? [];
  const followUpBlocks =
    metadata?.blocks.filter((block) => block.type === "clarifying_question") ?? [];
  const formulaBlock = cardBlocks.find(
    (block) => block.type === "opening_formula"
  );
  const templateBlock = cardBlocks.find((block) => block.type === "template");
  const tipBlock = cardBlocks.find((block) => block.type === "coach_tip");
  const mistakeBlock = cardBlocks.find(
    (block) => block.type === "common_mistake"
  );
  const exampleBlock = cardBlocks.find((block) => block.type === "example");
  const blueprintBlockIds = new Set(
    [formulaBlock, templateBlock, tipBlock, mistakeBlock, exampleBlock]
      .filter(Boolean)
      .map((block) => block!.id)
  );
  const fallbackBlocks = formulaBlock
    ? cardBlocks.filter((block) => !blueprintBlockIds.has(block.id))
    : cardBlocks;
  const showSuggestedActions =
    followUpBlocks.length === 0 &&
    Boolean(metadata?.suggestedActions.length) &&
    Boolean(onSendMessage);

  return (
    <div className="group flex gap-3 sm:gap-4">
      <div className="relative mt-1 h-10 w-10 shrink-0 overflow-hidden rounded-2xl border border-primary/12 bg-white shadow-[0_10px_22px_rgba(77,134,247,0.16)]">
        <Image
          src="/coach/coach-pet-clean.png"
          alt="DebateLab Coach"
          fill
          sizes="40px"
          className="object-cover"
        />
      </div>

      <div className="min-w-0 flex-1">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <div className="text-sm font-semibold text-on-surface">Coach</div>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/12 bg-primary/5 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">
            <Sparkles className="h-3 w-3" />
            AI Debate Coach
          </div>
          {isStreaming && (
            <span className="text-xs font-medium text-on-surface-variant">
              writing...
            </span>
          )}
        </div>

        {metadata ? (
          <div className="max-w-[880px]">
            {metadata.summary && (
              <div className="mb-3 max-w-[780px] px-0 text-[15px] leading-7 text-on-surface-variant">
                <MiniMarkdown>{metadata.summary}</MiniMarkdown>
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
                  onSendMessage={onSendMessage}
                  actionsDisabled={actionsDisabled}
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

            {showSuggestedActions && onSendMessage && (
              <div className="mt-3 flex flex-wrap gap-2">
                {metadata.suggestedActions.map((action) => (
                  <button
                    key={`${action.label}-${action.prompt}`}
                    type="button"
                    onClick={() => onSendMessage(action.prompt)}
                    disabled={actionsDisabled}
                    className={cn(
                      "rounded-full border px-3.5 py-2 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                      action.variant === "primary"
                        ? "border-primary bg-primary text-on-primary shadow-[0_10px_20px_rgba(77,134,247,0.22)]"
                        : "border-outline-variant/18 bg-white text-on-surface-variant hover:border-primary/25 hover:bg-primary/5 hover:text-primary"
                    )}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : message.content ? (
          <div className="max-w-[760px] rounded-[22px] border border-outline-variant/14 bg-white px-4 py-4 text-sm shadow-[0_16px_36px_rgba(11,20,36,0.045)] sm:px-5">
            <div className="prose prose-sm max-w-none prose-p:my-1.5 prose-p:leading-7 prose-li:my-0.5 prose-strong:text-primary prose-headings:text-on-surface prose-headings:mb-1 prose-headings:mt-3 prose-p:text-on-surface-variant prose-li:text-on-surface-variant prose-a:text-primary prose-code:rounded prose-code:bg-surface-container prose-code:px-1 prose-code:py-0.5 prose-code:text-primary prose-pre:rounded-xl prose-pre:bg-surface-container">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {message.content}
              </ReactMarkdown>
              {isStreaming && (
                <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-primary align-text-bottom" />
              )}
            </div>
          </div>
        ) : null}

        {message.content && !isStreaming && (
          <AssistantActions
            content={message.content}
            onSendMessage={onSendMessage}
            actionsDisabled={actionsDisabled}
          />
        )}
      </div>
    </div>
  );
}

function UserMessage({ message }: { message: ChatMessageLocal }) {
  return (
    <div className="flex flex-row-reverse items-start gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl bg-primary text-on-primary shadow-[0_10px_20px_rgba(77,134,247,0.22)]">
        <User className="h-4 w-4" />
      </div>
      <div className="max-w-[min(76%,680px)] rounded-[18px] rounded-tr-md bg-primary px-4 py-2.5 text-sm leading-6 text-on-primary shadow-[0_12px_24px_rgba(77,134,247,0.2)]">
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
