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
  easy: "bg-[#E5F6EC] text-[#1E9E54] dark:bg-[#34C759]/15 dark:text-[#5DD984]",
  medium: "bg-[#FFF3DC] text-[#C98A1B] dark:bg-[#FFD166]/15 dark:text-[#FFD98A]",
  hard: "bg-[#FFEAEA] text-[#D6494E] dark:bg-[#FF5A5F]/15 dark:text-[#FF9398]",
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
        "group relative flex w-full cursor-pointer items-center gap-4 px-5 py-4 text-left outline-none transition-colors duration-150 sm:px-6 sm:py-[18px]",
        isSelected
          ? "bg-primary/[0.05] dark:bg-primary/[0.09]"
          : "hover:bg-surface-container focus-visible:bg-surface-container"
      )}
    >
      {isSelected ? (
        <motion.span
          layoutId="topic-row-indicator"
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="absolute left-0 top-1/2 h-9 w-[3px] -translate-y-1/2 rounded-r-full bg-primary"
        />
      ) : null}

      <CategoryVisual category={categoryKey} size="sm" />

      <div className="min-w-0 flex-1">
        <h3
          className={cn(
            "text-[15px] font-semibold leading-[1.4] text-on-surface line-clamp-2 transition-colors"
          )}
        >
          {display.topic.title}
        </h3>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="rounded-full bg-surface-container px-2.5 py-1 text-[11px] font-semibold leading-none text-on-surface-variant">
            {display.topic.category}
          </span>
          <span
            className={cn(
              "rounded-full px-2.5 py-1 text-[11px] font-semibold leading-none",
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
          "flex size-9 shrink-0 items-center justify-center rounded-full transition-all hover:bg-surface-container active:scale-90",
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
