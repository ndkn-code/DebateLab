"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { Bookmark, BookmarkCheck } from "@/components/ui/icons";
import { CategoryVisual } from "@/components/practice/category-visual";
import type { PracticeTopicDisplay } from "@/components/practice/practice-topic-display";
import { getTopicCategoryKey } from "@/lib/topics";
import { cn } from "@/lib/utils";

interface TopicRowProps {
  display: PracticeTopicDisplay;
  isSelected: boolean;
  isBookmarked: boolean;
  onSelect: (topicId: string) => void;
  onToggleBookmark: (topicId: string) => void;
  index: number;
}

const DIFFICULTY_PILL_STYLES = {
  easy: "bg-success-container text-success-dim dark:text-success",
  medium: "bg-warning-container text-on-warning-container",
  hard: "bg-error-container text-error-dim dark:text-error",
} as const;

export function TopicRow({
  display,
  isSelected,
  isBookmarked,
  onSelect,
  onToggleBookmark,
  index,
}: TopicRowProps) {
  const t = useTranslations("dashboard.practice");
  const categoryKey = getTopicCategoryKey(display.topic);

  const difficultyLabel =
    display.difficultyTone === "easy"
      ? t("card_easy")
      : display.difficultyTone === "medium"
        ? t("card_medium")
        : t("card_hard");

  return (
    <motion.div
      layout="position"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{
        duration: 0.24,
        delay: Math.min(index * 0.025, 0.25),
        ease: [0.22, 1, 0.36, 1],
      }}
      onClick={() => onSelect(display.topic.id)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(display.topic.id);
        }
      }}
      role="button"
      tabIndex={0}
      aria-pressed={isSelected}
      className={cn(
        "group relative flex min-h-10 w-full cursor-pointer items-center gap-3 px-4 py-2 text-left outline-none transition-colors duration-150 sm:px-5",
        isSelected
          ? "bg-primary/[0.05] dark:bg-primary/[0.09]"
          : "hover:bg-surface-container focus-visible:bg-surface-container"
      )}
    >
      {isSelected ? (
        <motion.span
          layoutId="topic-row-indicator"
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r-full bg-tertiary"
        />
      ) : null}

      <CategoryVisual category={categoryKey} size="sm" />

      <div className="min-w-0 flex-1">
        <h3
          className={cn(
            "type-body font-semibold text-on-surface line-clamp-2 transition-colors"
          )}
        >
          {display.topic.title}
        </h3>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="inline-flex h-5 items-center rounded-[6px] bg-surface-container px-2 type-caption font-semibold leading-none text-on-surface-variant">
            {display.topic.category}
          </span>
          <span
            className={cn(
              "inline-flex h-5 items-center rounded-[6px] px-2 type-caption font-semibold leading-none",
              DIFFICULTY_PILL_STYLES[display.difficultyTone]
            )}
          >
            {difficultyLabel}
          </span>
        </div>
      </div>

      <button
        type="button"
        aria-label={isBookmarked ? t("remove_bookmark") : t("save_topic")}
        onClick={(event) => {
          event.stopPropagation();
          onToggleBookmark(display.topic.id);
        }}
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-[8px] transition-all hover:bg-surface-container active:scale-95 focus-visible:ring-2 focus-visible:ring-ring",
          isBookmarked
            ? "text-primary"
            : "text-on-surface-variant opacity-40 group-hover:opacity-100 hover:!text-primary"
        )}
      >
        {isBookmarked ? (
          <BookmarkCheck className="h-[18px] w-[18px]" />
        ) : (
          <Bookmark className="h-[18px] w-[18px]" />
        )}
      </button>
    </motion.div>
  );
}
