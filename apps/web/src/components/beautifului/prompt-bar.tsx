"use client";

import { useEffect, useRef } from "react";
import type { KeyboardEvent, ReactNode } from "react";
import { Send } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

/**
 * Adapted from Beautiful UI's Prompt Bar.
 * Original source Copyright (c) 2026 Shane Levine, MIT License.
 */
export function BeautifulPromptBar({
  value,
  onValueChange,
  onSubmit,
  placeholder,
  submitLabel,
  disabled = false,
  autoFocus = false,
  leading,
  footer,
  className,
}: {
  value: string;
  onValueChange: (value: string) => void;
  onSubmit: (value: string) => void;
  placeholder: string;
  submitLabel: string;
  disabled?: boolean;
  autoFocus?: boolean;
  leading?: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const canSubmit = value.trim().length > 0 && !disabled;

  const resize = () => {
    const input = inputRef.current;
    if (!input) return;
    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, 160)}px`;
  };

  useEffect(resize, [value]);

  const submit = () => {
    if (!canSubmit) return;
    onSubmit(value.trim());
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault();
      submit();
    }
  };

  return (
    <div
      role="presentation"
      onClick={() => inputRef.current?.focus()}
      className={cn(
        "cursor-text rounded-control border border-outline-variant bg-surface px-2.5 py-2 shadow-token-card transition-[border-color,box-shadow] duration-150 focus-within:border-primary/45 focus-within:ring-2 focus-within:ring-ring/20",
        className,
      )}
    >
      {leading ? (
        <div className="mb-2 flex items-center gap-1.5">{leading}</div>
      ) : null}
      <textarea
        ref={inputRef}
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        onKeyDown={handleKeyDown}
        aria-label={placeholder}
        placeholder={placeholder}
        disabled={disabled}
        autoFocus={autoFocus}
        rows={1}
        className="block min-h-7 w-full resize-none bg-transparent px-1 py-1 type-body text-on-surface outline-none placeholder:text-on-surface-variant/60 disabled:cursor-not-allowed"
        style={{ maxHeight: 160 }}
      />
      <div className="mt-1 flex min-h-8 items-end justify-between gap-2">
        <div className="min-w-0 flex-1">{footer}</div>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            submit();
          }}
          disabled={!canSubmit}
          aria-label={submitLabel}
          className="flex size-8 shrink-0 items-center justify-center rounded-control bg-primary text-on-primary transition-[background-color,transform,opacity] duration-150 hover:bg-primary-dim active:scale-[0.96] disabled:cursor-not-allowed disabled:bg-surface-container-high disabled:text-on-surface-variant disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
        >
          <Send className="size-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
