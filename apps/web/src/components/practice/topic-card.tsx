"use client";

import { motion } from "framer-motion";
import { Bookmark, BookmarkCheck, Check } from "@/components/ui/icons";
import { useTranslations } from "next-intl";
import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
} from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import {
  formatPracticeCountLabel,
  type PracticeTopicDisplay,
} from "@/components/practice/practice-topic-display";

interface TopicCardProps {
  display: PracticeTopicDisplay;
  isSelected: boolean;
  isBookmarked: boolean;
  onSelect: (topicId: string) => void;
  onToggleBookmark: (topicId: string) => void;
  index: number;
}

const CATEGORY_TONE_STYLES = {
  blue: "bg-primary-container text-on-surface-variant",
  green: "bg-surface-container text-on-surface-variant",
  teal: "bg-surface-container text-on-surface-variant",
  violet: "bg-surface-container text-on-surface-variant",
  amber: "bg-surface-container text-on-surface-variant",
  indigo: "bg-surface-container text-on-surface-variant",
} as const;

const DIFFICULTY_TONE_STYLES = {
  easy: "bg-surface-container text-on-surface-variant",
  medium: "bg-surface-container text-on-surface-variant",
  hard: "bg-error-container text-on-surface-variant",
} as const;

const PRIORITY_BADGE_STYLES = {
  blue: "border-outline-variant bg-surface-container text-primary",
  green: "border-outline-variant bg-surface-container text-on-surface-variant",
  amber: "border-outline-variant bg-surface-container text-on-surface-variant",
} as const;

const AVATAR_RING_STYLE =
  "border border-white/90 shadow-token-card";

export function TopicCard({
  display,
  isSelected,
  isBookmarked,
  onSelect,
  onToggleBookmark,
  index,
}: TopicCardProps) {
  const t = useTranslations("dashboard.practice");

  const difficultyLabel =
    display.difficultyTone === "easy"
      ? t("card_easy")
      : display.difficultyTone === "medium"
        ? t("card_medium")
        : t("card_hard");

  return (
    <motion.div
      initial={{ opacity: 0, y: 22 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, delay: index * 0.03 }}
      onClick={() => onSelect(display.topic.id)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(display.topic.id);
        }
      }}
      role="button"
      tabIndex={0}
      className={cn(
        "group relative flex h-full min-h-[174px] w-full flex-col rounded-[14px] border bg-surface-container-lowest p-4 text-left transition-all duration-200",
        isSelected
          ? "border-primary shadow-token-primary"
          : "border-outline-variant hover:border-outline-variant hover:shadow-token-card"
      )}
    >
      {isSelected && (
        <span className="absolute right-4 top-4 flex h-[22px] w-[22px] items-center justify-center rounded-full bg-primary text-on-primary">
          <Check className="h-[13px] w-[13px]" />
        </span>
      )}

      <div className="flex flex-wrap items-center gap-2 pr-8">
        <span
          className={cn(
            "rounded-full px-2.5 py-[4px] text-[10px] font-semibold leading-none",
            CATEGORY_TONE_STYLES[display.categoryTone]
          )}
        >
          {display.topic.category}
        </span>
        <span
          className={cn(
            "rounded-full px-2.5 py-[4px] text-[10px] font-semibold leading-none",
            DIFFICULTY_TONE_STYLES[display.difficultyTone]
          )}
        >
          {difficultyLabel}
        </span>
        {display.priorityBadges.map((badge) => (
          <span
            key={`${display.topic.id}-${badge.label}`}
            className={cn(
              "rounded-full border px-2.5 py-[3px] text-[10px] font-semibold leading-none",
              PRIORITY_BADGE_STYLES[badge.tone]
            )}
          >
            {badge.label}
          </span>
        ))}
      </div>

      <div className="mt-3 flex-1">
        <h3 className="text-[0.98rem] font-semibold leading-[1.33] text-on-surface line-clamp-3">
          {display.topic.title}
        </h3>
        <p className="mt-2 text-[12.5px] leading-[1.58] text-on-surface-variant line-clamp-3">
          {display.summary}
        </p>
      </div>

      <div className="mt-auto flex items-center justify-between gap-3 pt-4">
        <div className="flex items-center gap-2.5">
          <AvatarGroup className="-space-x-1.5">
            {display.avatars.map((avatar) => (
              <Avatar
                key={`${display.topic.id}-${avatar.initials}`}
                size="sm"
                className={cn("size-6", AVATAR_RING_STYLE)}
              >
                <AvatarFallback
                  className={cn("text-[10px] font-bold", avatar.toneClassName)}
                >
                  {avatar.initials}
                </AvatarFallback>
              </Avatar>
            ))}
          </AvatarGroup>
          <span className="text-[12.5px] text-on-surface-variant">
            {formatPracticeCountLabel(
              display.practiceCount,
              t("practice_count_label")
            )}
          </span>
        </div>

        <button
          type="button"
          aria-label={
            isBookmarked ? t("remove_bookmark") : t("save_topic")
          }
          onClick={(event) => {
            event.stopPropagation();
            onToggleBookmark(display.topic.id);
          }}
          className={cn(
            "flex h-7 w-7 items-center justify-center text-on-surface-variant transition-colors",
            isBookmarked
              ? "text-primary"
              : "hover:text-primary"
          )}
        >
          {isBookmarked ? (
            <BookmarkCheck className="h-[17px] w-[17px]" />
          ) : (
            <Bookmark className="h-[17px] w-[17px]" />
          )}
        </button>
      </div>
    </motion.div>
  );
}
