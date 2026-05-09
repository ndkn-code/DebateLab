"use client";

import type { ElementType, ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronDown,
  CircleHelp,
  ListFilter,
  Shuffle,
  Sparkles,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select } from "@/components/ui/select";
import { CategoryTabs } from "@/components/practice/category-tabs";
import {
  buildPracticeTopicDisplays,
  type PracticeTopicDisplay,
} from "@/components/practice/practice-topic-display";
import { SessionConfig } from "@/components/practice/session-config";
import { TopicCard } from "@/components/practice/topic-card";
import { PageTransition } from "@/components/shared/page-motion";
import { topics, CATEGORIES } from "@/lib/topics";
import { resolvePracticeTopic, readPracticePrefill } from "@/lib/practice-prefill";
import { normalizeSettingsPreferences } from "@/lib/settings";
import { createClient } from "@/lib/supabase/client";
import { useSessionStore } from "@/store/session-store";
import { cn } from "@/lib/utils";

type PracticeSortOption = "popular" | "newest" | "easiest" | "hardest";

const INITIAL_VISIBLE_TOPICS = 8;
const LOAD_MORE_STEP = 6;
const BOOKMARK_STORAGE_KEY = "practice-bookmarks";

function sortDisplays(
  source: PracticeTopicDisplay[],
  sort: PracticeSortOption
) {
  const difficultyRank = { easy: 0, medium: 1, hard: 2 };
  const sorted = [...source];

  sorted.sort((left, right) => {
    if (sort === "newest") {
      return left.popularityRank - right.popularityRank;
    }

    if (sort === "easiest") {
      return (
        difficultyRank[left.difficultyTone] - difficultyRank[right.difficultyTone] ||
        right.practiceCount - left.practiceCount
      );
    }

    if (sort === "hardest") {
      return (
        difficultyRank[right.difficultyTone] - difficultyRank[left.difficultyTone] ||
        right.practiceCount - left.practiceCount
      );
    }

    return right.practiceCount - left.practiceCount;
  });

  return sorted;
}

function TopPill({
  icon: Icon,
  children,
}: {
  icon: ElementType;
  children: ReactNode;
}) {
  return (
    <div className="inline-flex min-h-[40px] items-center gap-2 rounded-[10px] border border-[#e2eaf7] bg-white px-3.5 py-2 text-[13px] font-semibold text-[#263654]">
      <span className="flex h-[18px] w-[18px] items-center justify-center rounded-full bg-primary text-white">
        <Icon className="h-[10px] w-[10px]" />
      </span>
      <span className="inline-flex items-center gap-1">{children}</span>
    </div>
  );
}

export default function PracticePage() {
  const t = useTranslations("dashboard.practice");
  const searchParams = useSearchParams();
  const appliedPrefillRef = useRef<string | null>(null);
  const initialPrefill = useMemo(
    () => readPracticePrefill(searchParams),
    [searchParams]
  );
  const initialTopic = useMemo(
    () =>
      initialPrefill?.topicTitle
        ? resolvePracticeTopic({
            topicTitle: initialPrefill.topicTitle,
            topicCategory: initialPrefill.topicCategory,
            topicDescription: initialPrefill.topicDescription,
            practiceTrack: initialPrefill.practiceTrack,
            mode: initialPrefill.mode,
            aiDifficulty: initialPrefill.aiDifficulty,
            side: initialPrefill.side,
          })
        : null,
    [initialPrefill]
  );
  const [activeCategory, setActiveCategory] = useState(
    () => initialTopic?.category ?? "All"
  );
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(
    () => initialTopic?.id ?? null
  );
  const [sortOption, setSortOption] = useState<PracticeSortOption>("popular");
  const [savedOnly, setSavedOnly] = useState(false);
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_TOPICS);
  const [bookmarkedIds, setBookmarkedIds] = useState<string[]>(() => {
    if (typeof window === "undefined") {
      return [];
    }

    try {
      const stored = window.localStorage.getItem(BOOKMARK_STORAGE_KEY);
      if (!stored) {
        return [];
      }

      const parsed = JSON.parse(stored);
      return Array.isArray(parsed)
        ? parsed.filter((value) => typeof value === "string")
        : [];
    } catch {
      return [];
    }
  });
  const [orbBalance, setOrbBalance] = useState<number | null>(null);
  const [referralCode, setReferralCode] = useState("");
  const {
    setPracticeTrack,
    setMode,
    setAiDifficulty,
    setSide,
    setPrepTime,
    setSpeechTime,
  } = useSessionStore();

  const allDisplays = useMemo(() => buildPracticeTopicDisplays(topics), []);
  const sortedDisplays = useMemo(
    () => sortDisplays(allDisplays, sortOption),
    [allDisplays, sortOption]
  );
  const filteredDisplays = useMemo(() => {
    const scoped =
      activeCategory === "All"
        ? sortedDisplays
        : sortedDisplays.filter((display) => display.topic.category === activeCategory);

    if (!savedOnly) {
      return scoped;
    }

    return scoped.filter((display) => bookmarkedIds.includes(display.topic.id));
  }, [activeCategory, bookmarkedIds, savedOnly, sortedDisplays]);
  const selectedDisplay = useMemo(
    () =>
      allDisplays.find((display) => display.topic.id === selectedTopicId) ?? null,
    [allDisplays, selectedTopicId]
  );
  const requiredVisibleCount = useMemo(() => {
    if (!selectedDisplay) {
      return visibleCount;
    }

    const selectedIndex = filteredDisplays.findIndex(
      (display) => display.topic.id === selectedDisplay.topic.id
    );

    if (selectedIndex === -1) {
      return visibleCount;
    }

    return Math.max(
      visibleCount,
      Math.ceil((selectedIndex + 1) / LOAD_MORE_STEP) * LOAD_MORE_STEP
    );
  }, [filteredDisplays, selectedDisplay, visibleCount]);
  const visibleDisplays = useMemo(
    () => filteredDisplays.slice(0, requiredVisibleCount),
    [filteredDisplays, requiredVisibleCount]
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(
      BOOKMARK_STORAGE_KEY,
      JSON.stringify(bookmarkedIds)
    );
  }, [bookmarkedIds]);

  useEffect(() => {
    const prefillKey = searchParams.toString();
    if (!prefillKey || appliedPrefillRef.current === prefillKey) {
      return;
    }

    if (!initialPrefill) {
      return;
    }

    appliedPrefillRef.current = prefillKey;
    const practiceTrack = initialPrefill.practiceTrack ?? "speaking";

    setPracticeTrack(practiceTrack);
    setAiDifficulty(initialPrefill.aiDifficulty ?? "medium");
    setSide(initialPrefill.side ?? "proposition");

    if (practiceTrack === "debate") {
      setMode(initialPrefill.mode ?? "quick");
    }
  }, [
    initialPrefill,
    searchParams,
    setAiDifficulty,
    setMode,
    setPracticeTrack,
    setSide,
  ]);

  useEffect(() => {
    let isMounted = true;

    async function loadPracticeDefaults() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("preferences, orb_balance, referral_code")
        .eq("id", user.id)
        .single();

      if (!isMounted) {
        return;
      }

      const defaults = normalizeSettingsPreferences(
        (profile?.preferences as Record<string, unknown> | null | undefined) ?? null
      );

      setPracticeTrack(initialPrefill?.practiceTrack ?? "speaking");
      setMode(initialPrefill?.mode ?? "quick");
      setPrepTime(defaults.defaultPrepTime);
      setSpeechTime(defaults.defaultSpeechTime);
      setAiDifficulty(initialPrefill?.aiDifficulty ?? defaults.defaultDifficulty);
      setSide(initialPrefill?.side ?? "proposition");
      setOrbBalance(profile?.orb_balance ?? 0);
      setReferralCode(profile?.referral_code ?? "");
    }

    void loadPracticeDefaults();

    return () => {
      isMounted = false;
    };
  }, [
    initialPrefill?.aiDifficulty,
    initialPrefill?.mode,
    initialPrefill?.practiceTrack,
    initialPrefill?.side,
    setAiDifficulty,
    setMode,
    setPracticeTrack,
    setPrepTime,
    setSide,
    setSpeechTime,
  ]);

  const handleSurprise = () => {
    if (!filteredDisplays.length) {
      return;
    }

    const random =
      filteredDisplays[Math.floor(Math.random() * filteredDisplays.length)];
    const randomIndex = filteredDisplays.findIndex(
      (display) => display.topic.id === random.topic.id
    );

    setSelectedTopicId(random.topic.id);
    setVisibleCount((current) =>
      Math.max(
        current,
        Math.ceil((randomIndex + 1) / LOAD_MORE_STEP) * LOAD_MORE_STEP
      )
    );
  };

  const handleSelectTopic = (topicId: string) => {
    setSelectedTopicId((current) => (current === topicId ? null : topicId));
  };

  const handleCategorySelect = (category: string) => {
    setActiveCategory(category);
    setVisibleCount(INITIAL_VISIBLE_TOPICS);
  };

  const handleToggleBookmark = (topicId: string) => {
    setBookmarkedIds((current) =>
      current.includes(topicId)
        ? current.filter((id) => id !== topicId)
        : [...current, topicId]
    );
  };

  const handleSortChange = (nextSort: PracticeSortOption) => {
    setSortOption(nextSort);
    setVisibleCount(INITIAL_VISIBLE_TOPICS);
  };

  const handleToggleSavedOnly = () => {
    setSavedOnly((current) => !current);
    setVisibleCount(INITIAL_VISIBLE_TOPICS);
  };

  return (
    <PageTransition className="min-h-screen bg-background px-4 py-7 sm:px-6 xl:px-8">
      <div
        className={cn(
          "relative mx-auto flex max-w-[1440px] flex-col gap-7",
          selectedDisplay && "xl:flex-row xl:items-start xl:gap-6"
        )}
      >
        <section className="min-w-0 flex-1 xl:max-w-[990px]">
          <div className="relative min-h-[88px] lg:static">
            <div className="max-w-[620px] pt-1">
              <h1 className="text-[1.75rem] font-semibold leading-[1.15] text-on-surface md:text-[1.9rem]">
                {t("page_headline")}
              </h1>
              <p className="mt-2 max-w-[590px] text-[0.96rem] leading-6 text-[#687997]">
                {t("page_subtitle")}
              </p>
            </div>

            <div className="mt-5 flex shrink-0 items-center gap-3 lg:absolute lg:right-0 lg:top-0 lg:mt-0">
              <TopPill icon={Sparkles}>
                <span>{t("credits_label")}:</span>
                <span className="text-primary">{orbBalance ?? 0}</span>
              </TopPill>

              <Dialog>
                <DialogTrigger
                  render={
                    <button
                      type="button"
                      className="inline-flex min-h-[40px] items-center gap-2 rounded-[10px] border border-[#e2eaf7] bg-white px-3.5 py-2 text-[13px] font-semibold text-[#5b6b86] transition-colors hover:bg-[#f8fbff]"
                    />
                  }
                >
                  <CircleHelp className="h-[15px] w-[15px] text-[#7c8db0]" />
                  {t("how_it_works")}
                </DialogTrigger>
                <DialogContent className="max-w-xl rounded-[1.4rem] border border-[#e5ecf8] bg-white p-6">
                  <DialogHeader>
                    <DialogTitle className="text-xl font-semibold text-on-surface">
                      {t("how_it_works_title")}
                    </DialogTitle>
                    <DialogDescription className="text-sm leading-6 text-[#697a97]">
                      {t("how_it_works_description")}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 pt-2">
                    {[1, 2, 3].map((step) => (
                      <div
                        key={step}
                        className="rounded-[1.2rem] border border-[#e8eef8] bg-[#f8fbff] p-4"
                      >
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/75">
                          {t("how_it_works_step_kicker", { step })}
                        </p>
                        <p className="mt-2 text-base font-semibold text-on-surface">
                          {t(`how_it_works_step_${step}_title`)}
                        </p>
                        <p className="mt-2 text-sm leading-6 text-[#697a97]">
                          {t(`how_it_works_step_${step}_body`)}
                        </p>
                      </div>
                    ))}
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <CategoryTabs
              categories={CATEGORIES}
              active={activeCategory}
              onSelect={handleCategorySelect}
            />
            <button
              type="button"
              onClick={handleSurprise}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-full border border-[#d5e3fe] bg-white px-4 py-2 text-[14px] font-medium text-primary transition-colors hover:bg-[#f8fbff]"
            >
              <Shuffle className="h-[14px] w-[14px]" />
              {t("surprise_me")}
            </button>
          </div>

          <div className="mt-7 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-[1.2rem] font-semibold leading-tight text-on-surface">
                {t("browse_topics")}
              </h2>
              <span className="rounded-full bg-[#f1f5fb] px-3 py-1.5 text-[13px] font-medium text-[#6f809e]">
                {t("topic_count", { count: filteredDisplays.length })}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-[170px]">
                <Select
                  value={sortOption}
                  onChange={(event) =>
                    handleSortChange(event.currentTarget.value as PracticeSortOption)
                  }
                  className="h-[44px] rounded-[0.95rem] border-[#e5ebf7] bg-white px-3.5 py-2 text-[15px] text-[#4c5c79]"
                >
                  <option value="popular">{t("sort_popular")}</option>
                  <option value="newest">{t("sort_newest_practice")}</option>
                  <option value="easiest">{t("sort_easiest")}</option>
                  <option value="hardest">{t("sort_hardest")}</option>
                </Select>
              </div>

              <button
                type="button"
                aria-pressed={savedOnly}
                aria-label={t("show_saved")}
                onClick={handleToggleSavedOnly}
                className={cn(
                  "flex h-[44px] w-[44px] items-center justify-center rounded-[0.95rem] border bg-white text-[#7183a4] transition-colors",
                  savedOnly
                    ? "border-primary/25 bg-primary/[0.04] text-primary"
                    : "border-[#e5ebf7] hover:border-[#cbd9f6] hover:bg-[#f8fbff]"
                )}
              >
                <ListFilter className="h-[17px] w-[17px]" />
              </button>
            </div>
          </div>

          {visibleDisplays.length ? (
            <>
              <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {visibleDisplays.map((display, index) => (
                  <TopicCard
                    key={display.topic.id}
                    display={display}
                    isSelected={selectedDisplay?.topic.id === display.topic.id}
                    isBookmarked={bookmarkedIds.includes(display.topic.id)}
                    onSelect={handleSelectTopic}
                    onToggleBookmark={handleToggleBookmark}
                    index={index}
                  />
                ))}
              </div>

              {visibleCount < filteredDisplays.length ? (
                <div className="mt-6 flex justify-center">
                  <button
                    type="button"
                    onClick={() =>
                      setVisibleCount((current) =>
                        Math.min(current + LOAD_MORE_STEP, filteredDisplays.length)
                      )
                    }
                    className="inline-flex min-h-[42px] items-center gap-2 rounded-[0.95rem] border border-[#e5ebf7] bg-white px-6 py-2 text-[15px] font-medium text-primary transition-colors hover:bg-[#f8fbff]"
                  >
                    {t("load_more_topics")}
                    <ChevronDown className="h-[16px] w-[16px]" />
                  </button>
                </div>
              ) : null}
            </>
          ) : (
            <div className="mt-8 rounded-[1.4rem] border border-dashed border-[#d6e0f3] bg-white p-8 text-center">
              <p className="text-lg font-semibold text-on-surface">
                {savedOnly ? t("saved_empty_title") : t("no_topics")}
              </p>
              <p className="mt-2 text-sm leading-6 text-[#6e7f9d]">
                {savedOnly ? t("saved_empty_body") : t("no_topics_body")}
              </p>
            </div>
          )}
        </section>

        <AnimatePresence mode="wait">
          {selectedDisplay ? (
            <motion.aside
              key={selectedDisplay.topic.id}
              initial={{ opacity: 0, x: 42 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 28 }}
              transition={{
                duration: 0.28,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="w-full xl:w-[424px] xl:flex-none xl:pt-[112px]"
            >
              <SessionConfig
                topic={selectedDisplay.topic}
                isBookmarked={bookmarkedIds.includes(selectedDisplay.topic.id)}
                onToggleBookmark={handleToggleBookmark}
                orbBalance={orbBalance}
                referralCode={referralCode}
                onBalanceChange={setOrbBalance}
                layout="desktop"
              />
            </motion.aside>
          ) : null}
        </AnimatePresence>
      </div>
    </PageTransition>
  );
}
