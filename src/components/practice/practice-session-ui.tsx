"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ClipboardEvent, ReactNode } from "react";
import {
  ArrowRight,
  Bold,
  Expand,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Minimize2,
  Pause,
  Underline,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const MAX_NOTES_LENGTH = 1000;

const ALLOWED_NOTE_TAGS = new Set([
  "a",
  "b",
  "br",
  "div",
  "em",
  "i",
  "li",
  "ol",
  "p",
  "strong",
  "u",
  "ul",
]);

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function plainTextToRichNotes(value: string) {
  return escapeHtml(value).replace(/\n/g, "<br>");
}

function hasRichNoteMarkup(value: string) {
  return /<\/?(a|b|br|div|em|i|li|ol|p|strong|u|ul)\b/i.test(value);
}

function normalizeLegacyNoteFormatting(value: string) {
  return value
    .replace(
      /\[([^\]]+)\]\((https?:\/\/[^)\s]+|mailto:[^)\s]+)\)/g,
      '<a href="$2">$1</a>'
    )
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/_([^_]+)_/g, "<em>$1</em>");
}

export function sanitizeRichNotes(value: string) {
  if (typeof document === "undefined") return value;

  const template = document.createElement("template");
  template.innerHTML = value;

  function cleanNode(node: Node): Node | DocumentFragment | null {
    if (node.nodeType === Node.TEXT_NODE) {
      return document.createTextNode(node.textContent ?? "");
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return null;

    const element = node as HTMLElement;
    const tagName = element.tagName.toLowerCase();

    if (tagName === "script" || tagName === "style") return null;

    const cleanedChildren = Array.from(element.childNodes)
      .map(cleanNode)
      .filter(Boolean) as Array<Node | DocumentFragment>;

    if (!ALLOWED_NOTE_TAGS.has(tagName)) {
      const fragment = document.createDocumentFragment();
      cleanedChildren.forEach((child) => fragment.appendChild(child));
      return fragment;
    }

    const cleanElement = document.createElement(tagName);
    if (tagName === "a") {
      const href = element.getAttribute("href") ?? "";
      if (/^(https?:|mailto:)/i.test(href)) {
        cleanElement.setAttribute("href", href);
        cleanElement.setAttribute("target", "_blank");
        cleanElement.setAttribute("rel", "noopener noreferrer");
      }
    }

    cleanedChildren.forEach((child) => cleanElement.appendChild(child));
    return cleanElement;
  }

  const wrapper = document.createElement("div");
  Array.from(template.content.childNodes).forEach((node) => {
    const cleaned = cleanNode(node);
    if (cleaned) wrapper.appendChild(cleaned);
  });

  return wrapper.innerHTML;
}

export function toRichNotesHtml(value: string) {
  if (!value) return "";
  const html = hasRichNoteMarkup(value) ? value : plainTextToRichNotes(value);
  return sanitizeRichNotes(normalizeLegacyNoteFormatting(html));
}

export function richNotesToPlainText(value: string) {
  if (!value) return "";

  const withBreaks = value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(div|p|li)>/gi, "\n");

  if (typeof document !== "undefined") {
    const element = document.createElement("div");
    element.innerHTML = sanitizeRichNotes(withBreaks);
    return (element.textContent ?? "").replace(/\n{3,}/g, "\n\n").trimEnd();
  }

  return withBreaks.replace(/<[^>]*>/g, "").replace(/\n{3,}/g, "\n\n").trimEnd();
}

export function appendPlainTextBlockToRichNotes(
  currentValue: string,
  block: string,
  maxLength = MAX_NOTES_LENGTH
) {
  const currentPlainText = richNotesToPlainText(currentValue);
  const separator = currentPlainText.trim().length > 0 ? "\n\n" : "";
  const remainingLength = maxLength - currentPlainText.length - separator.length;

  if (remainingLength <= 0) return toRichNotesHtml(currentValue);

  const trimmedBlock = block.slice(0, remainingLength);
  return sanitizeRichNotes(
    `${toRichNotesHtml(currentValue)}${plainTextToRichNotes(
      `${separator}${trimmedBlock}`
    )}`
  );
}

export function formatPracticeTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${remainingSeconds
    .toString()
    .padStart(2, "0")}`;
}

export function PracticePanel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-[1.35rem] border border-outline-variant/70 bg-surface-container-lowest shadow-[0_24px_70px_-58px_rgba(22,39,91,0.55)]",
        className
      )}
    >
      {children}
    </section>
  );
}

export function PhasePill({
  children,
  tone = "blue",
  icon,
}: {
  children: ReactNode;
  tone?: "blue" | "red" | "ai" | "mint";
  icon?: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-10 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-semibold",
        tone === "blue" && "bg-primary-container text-primary",
        tone === "red" && "bg-error-container text-error",
        tone === "ai" && "bg-primary-container text-primary",
        tone === "mint" && "bg-secondary-container text-secondary-dim"
      )}
    >
      {icon}
      {children}
    </span>
  );
}

export function PracticeTimerDial({
  timeLeft,
  progress,
  tone = "blue",
  size = "lg",
}: {
  timeLeft: number;
  totalTime: number;
  progress: number;
  tone?: "blue" | "red";
  size?: "sm" | "md" | "lg" | "xl";
}) {
  const svgNumber = (value: number) => Number(value.toFixed(4));
  const radius = 118;
  const circumference = svgNumber(2 * Math.PI * radius);
  const strokeDashoffset = svgNumber(circumference * (1 - progress));
  const markerAngle = progress * 2 * Math.PI;
  const markerX = svgNumber(140 + radius * Math.cos(markerAngle));
  const markerY = svgNumber(140 + radius * Math.sin(markerAngle));
  const strokeColor = tone === "red" ? "#EF6A6A" : "#4D86F7";

  return (
    <div
      role="timer"
      aria-live="polite"
      aria-label={`${formatPracticeTime(timeLeft)} remaining`}
      className={cn(
        "relative mx-auto flex items-center justify-center",
        size === "xl"
          ? "h-[390px] w-[390px]"
          : size === "lg"
            ? "h-[330px] w-[330px]"
            : size === "md"
              ? "h-[292px] w-[292px]"
              : "h-[238px] w-[238px]"
      )}
    >
      <svg className="absolute h-full w-full -rotate-90" viewBox="0 0 280 280">
        <circle
          cx="140"
          cy="140"
          r={radius}
          fill="none"
          stroke="#E8F0FD"
          strokeWidth="9"
        />
        <circle
          cx="140"
          cy="140"
          r={radius}
          fill="none"
          stroke={strokeColor}
          strokeLinecap="round"
          strokeWidth="9"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="transition-[stroke-dashoffset] duration-500"
        />
        <circle
          cx={markerX}
          cy={markerY}
          r="9"
          fill="#ffffff"
          stroke={strokeColor}
          strokeWidth="5"
          className="drop-shadow-sm"
        />
      </svg>
      <div className="relative text-center">
        <div
          className={cn(
            "font-mono font-bold leading-none tracking-normal text-on-surface",
            size === "sm" ? "text-[3.55rem]" : "text-[4.65rem]"
          )}
        >
          {formatPracticeTime(timeLeft)}
        </div>
      </div>
    </div>
  );
}

export function QuickNotesEditor({
  value,
  onChange,
  label = "Quick Notes",
  helper,
  minHeightClassName = "min-h-[290px]",
  className,
  footer,
  compact = false,
}: {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  helper?: ReactNode;
  minHeightClassName?: string;
  className?: string;
  footer?: ReactNode;
  compact?: boolean;
}) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [activeFormats, setActiveFormats] = useState<Set<string>>(
    () => new Set()
  );
  const editorHtml = useMemo(() => toRichNotesHtml(value), [value]);
  const plainTextLength = useMemo(() => richNotesToPlainText(value).length, [value]);
  const isOverLimit = plainTextLength > MAX_NOTES_LENGTH;
  const toolbarItems = [
    { icon: Bold, label: "Bold", action: "bold" },
    { icon: Italic, label: "Italic", action: "italic" },
    { icon: Underline, label: "Underline", action: "underline" },
    { icon: List, label: "Bulleted list", action: "bullet" },
    { icon: ListOrdered, label: "Numbered list", action: "numbered" },
    { icon: LinkIcon, label: "Link", action: "link" },
  ] as const;

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || isFocused || editor.innerHTML === editorHtml) return;
    editor.innerHTML = editorHtml;
  }, [editorHtml, isFocused]);

  function syncEditorValue() {
    const editor = editorRef.current;
    if (!editor) return;
    onChange(sanitizeRichNotes(editor.innerHTML));
  }

  function updateActiveFormats() {
    if (typeof document === "undefined") return;

    const nextActiveFormats = new Set<string>();
    const commandStateByAction = {
      bold: "bold",
      italic: "italic",
      underline: "underline",
      bullet: "insertUnorderedList",
      numbered: "insertOrderedList",
    } as const;

    Object.entries(commandStateByAction).forEach(([action, command]) => {
      if (document.queryCommandState(command)) {
        nextActiveFormats.add(action);
      }
    });

    const selection = window.getSelection();
    const selectedNode = selection?.anchorNode;
    const selectedElement =
      selectedNode?.nodeType === Node.ELEMENT_NODE
        ? (selectedNode as Element)
        : selectedNode?.parentElement;

    if (selectedElement?.closest("a")) {
      nextActiveFormats.add("link");
    }

    setActiveFormats(nextActiveFormats);
  }

  function applyToolbarAction(action: (typeof toolbarItems)[number]["action"]) {
    const editor = editorRef.current;
    if (!editor) return;

    editor.focus();

    if (action === "link") {
      const url = window.prompt("Paste a link URL", "https://");
      if (!url) return;
      const safeUrl = /^(https?:|mailto:)/i.test(url) ? url : `https://${url}`;
      document.execCommand("createLink", false, safeUrl);
      syncEditorValue();
      updateActiveFormats();
      return;
    }

    const commandByAction = {
      bold: "bold",
      italic: "italic",
      underline: "underline",
      bullet: "insertUnorderedList",
      numbered: "insertOrderedList",
    } as const;

    document.execCommand(commandByAction[action], false);
    syncEditorValue();
    updateActiveFormats();
  }

  function handlePaste(event: ClipboardEvent<HTMLDivElement>) {
    event.preventDefault();
    const text = event.clipboardData
      .getData("text/plain")
      .slice(0, Math.max(0, MAX_NOTES_LENGTH - plainTextLength));
    document.execCommand("insertText", false, text);
    syncEditorValue();
  }

  return (
    <PracticePanel className={cn("p-8", className)}>
      <div
        className={cn(
          "flex items-center justify-between gap-4",
          compact ? "mb-4" : "mb-7"
        )}
      >
        <div>
          <h2 className="text-xl font-semibold tracking-normal text-on-surface">
            {label}
          </h2>
          {helper ? (
            <div className="mt-1 text-sm font-medium text-on-surface-variant">
              {helper}
            </div>
          ) : null}
        </div>
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "text-sm font-medium",
              isOverLimit ? "text-error" : "text-on-surface-variant"
            )}
          >
            {plainTextLength}/{MAX_NOTES_LENGTH}
          </span>
          <button
            type="button"
            aria-label="Expand notes"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-outline-variant/70 bg-surface text-primary transition-colors hover:bg-primary-container"
          >
            <Expand className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-outline-variant/80 bg-surface">
        <div
          className={cn(
            "flex items-center gap-4 border-b border-outline-variant/70 px-5 text-on-surface-variant",
            compact ? "h-11" : "h-14"
          )}
        >
          {toolbarItems.map(({ icon: Icon, label, action }) => (
            <button
              key={label}
              type="button"
            aria-label={label}
              aria-pressed={activeFormats.has(action)}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => applyToolbarAction(action)}
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:bg-primary-container hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45",
                activeFormats.has(action) && "bg-primary-container text-primary"
              )}
            >
              <Icon className="h-4 w-4" />
            </button>
          ))}
        </div>
        <div className="relative">
          {plainTextLength === 0 && !isFocused ? (
            <span className="pointer-events-none absolute left-5 top-5 text-base leading-8 text-outline">
              Jot down your key arguments...
            </span>
          ) : null}
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            role="textbox"
            aria-multiline="true"
            onFocus={() => setIsFocused(true)}
            onBlur={() => {
              setIsFocused(false);
              syncEditorValue();
              setActiveFormats(new Set());
            }}
            onInput={syncEditorValue}
            onKeyUp={updateActiveFormats}
            onMouseUp={updateActiveFormats}
            onPaste={handlePaste}
            data-placeholder="Jot down your key arguments..."
            className={cn(
              "w-full overflow-y-auto bg-transparent px-5 py-5 text-base leading-8 text-on-surface outline-none empty:before:text-outline",
              "[&_a]:text-primary [&_a]:underline [&_ol]:list-decimal [&_ol]:pl-6 [&_ul]:list-disc [&_ul]:pl-6",
              minHeightClassName
            )}
          />
        </div>
      </div>

      {footer ? <div className={cn(compact ? "mt-4" : "mt-7")}>{footer}</div> : null}
    </PracticePanel>
  );
}

export function ActionRail({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative rounded-[1.35rem] border border-outline-variant/70 bg-surface-container-lowest/95 p-4 shadow-[0_20px_55px_-48px_rgba(22,39,91,0.7)] backdrop-blur-xl",
        className
      )}
    >
      <div className="flex flex-wrap items-center justify-center gap-4">
        {children}
      </div>
    </div>
  );
}

export function PrimaryActionButton({
  children,
  className,
  disabled,
  onClick,
}: {
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <Button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "h-14 min-w-[260px] gap-3 rounded-2xl bg-primary px-8 text-base font-semibold text-on-primary shadow-[inset_0_-4px_0_rgba(12,57,146,0.22),0_16px_28px_-18px_rgba(77,134,247,0.95)] hover:bg-primary-dim",
        className
      )}
    >
      {children}
      <ArrowRight className="h-5 w-5" />
    </Button>
  );
}

export function PauseButton({
  isPaused,
  onClick,
  className,
}: {
  isPaused?: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <Button
      type="button"
      onClick={onClick}
      variant="outline"
      className={cn(
        "h-14 min-w-[160px] gap-3 rounded-2xl border-[#D7E4F8] bg-white text-base font-semibold text-[#0B1424] shadow-[inset_0_-4px_0_rgba(184,202,232,0.45),0_16px_28px_-22px_rgba(22,39,91,0.55)] hover:bg-[#F7FAFE]",
        className
      )}
    >
      {isPaused ? <Minimize2 className="h-5 w-5" /> : <Pause className="h-5 w-5" />}
      {isPaused ? "Resume" : "Pause"}
    </Button>
  );
}
