"use client";

import { useEffect, useRef, type KeyboardEvent } from "react";
import { Send, Square } from "@/components/ui/icons";
import { Button } from "@/components/ui/button";
import { getTeacherAssistantCopy, type TeacherAssistantLocale } from "./copy";

const MAX_LENGTH = 4000;

export interface TeacherComposerProps {
  locale: TeacherAssistantLocale;
  draft: string;
  onDraftChange: (value: string) => void;
  onSend: () => void;
  onStop: () => void;
  running: boolean;
  stopping: boolean;
}

export function TeacherComposer({
  locale,
  draft,
  onDraftChange,
  onSend,
  onStop,
  running,
  stopping,
}: TeacherComposerProps) {
  const copy = getTeacherAssistantCopy(locale);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const canSend = draft.trim().length > 0 && !running;

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, window.innerHeight * 0.2)}px`;
  }, [draft]);

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault();
      if (canSend) onSend();
    }
  }

  return (
    <footer className="shrink-0 border-t border-outline-variant bg-surface px-3 py-3 sm:px-5">
      <form
        className="mx-auto w-full max-w-3xl"
        onSubmit={(event) => {
          event.preventDefault();
          if (canSend) onSend();
        }}
      >
        <label className="sr-only" htmlFor="teacher-assistant-composer">
          {copy.composerLabel}
        </label>
        <div className="rounded-control border border-outline-variant bg-surface-container-low p-2 transition-[border-color,box-shadow] focus-within:border-primary focus-within:ring-2 focus-within:ring-ring">
          <textarea
            ref={inputRef}
            id="teacher-assistant-composer"
            value={draft}
            maxLength={MAX_LENGTH}
            onChange={(event) => onDraftChange(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={copy.placeholder}
            rows={1}
            aria-describedby="teacher-assistant-composer-hint"
            className="block max-h-[20dvh] min-h-10 w-full resize-none bg-transparent px-2 py-2 type-body text-on-surface outline-none placeholder:text-on-surface-variant disabled:cursor-not-allowed"
          />
          <div className="mt-1 flex items-center justify-between gap-2 px-1">
            <span
              id="teacher-assistant-composer-hint"
              className="type-caption text-on-surface-variant"
            >
              {draft.length}/{MAX_LENGTH} {copy.characters}
            </span>
            {running ? (
              <Button
                type="button"
                variant="outline"
                onClick={onStop}
                disabled={stopping}
                aria-label={copy.stop}
                className="gap-1.5"
              >
                <Square className="size-3.5" aria-hidden="true" />
                {stopping ? copy.stopping : copy.stop}
              </Button>
            ) : (
              <Button
                type="submit"
                variant="primary"
                disabled={!canSend}
                aria-label={copy.send}
                className="gap-1.5"
              >
                <Send className="size-3.5" aria-hidden="true" />
                {copy.send}
              </Button>
            )}
          </div>
          <p className="mt-2 px-1 type-caption text-on-surface-variant">{copy.reviewNotice}</p>
        </div>
      </form>
    </footer>
  );
}
