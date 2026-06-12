"use client";

import Image from "next/image";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import {
  ChevronDown,
  CircleHelp,
  Scale,
  Search,
  Shuffle,
} from "@/components/ui/icons";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  CreditsPopover,
  CREDIT_ICON_SRC,
  formatDashboardNumber,
  StatCounter,
} from "@/components/dashboard/dashboard-stats-panel";
import {
  buildPracticeTopicDisplays,
  type PracticeTopicDisplay,
} from "@/components/practice/practice-topic-display";
import {
  PracticeFilterPopover,
  type PracticeDifficultyFilter,
  type PracticeSortOption,
} from "@/components/practice/practice-filter-popover";
import { SessionConfig } from "@/components/practice/session-config";
import { TopicRow } from "@/components/practice/topic-row";
import { PageTransition } from "@/components/shared/page-motion";
import {
  PageContainer,
  ProductPageHeader,
  ProductPageShell,
} from "@/components/shared/product-layout";
import { ReferralCreditsDialog } from "@/components/shared/referral-credits-dialog";
import {
  getLocalizedCategoryOptions,
  getTopicCategoryKey,
  type CategoryFilterKey,
} from "@/lib/topics";
import {
  buildLegacyPracticeLanguageRedirect,
  resolvePracticeTopic,
  readPracticePrefill,
} from "@/lib/practice-prefill";
import { REFERRAL_REWARD_CREDITS } from "@/lib/referrals/constants";
import { normalizeSettingsPreferences } from "@/lib/settings";
import { createClient } from "@/lib/supabase/client";
import { useSessionStore } from "@/store/session-store";
import { usePathname } from "@/i18n/navigation";
import { coercePracticeLanguage } from "@/lib/practice-language";
import { cn } from "@/lib/utils";
import type { DebateTopic } from "@/types";

type PracticeTab = "all" | "saved";

const INITIAL_VISIBLE_TOPICS = 10;
const LOAD_MORE_STEP = 10;
const BOOKMARK_STORAGE_KEY = "practice-bookmarks";
const BOOKMARK_CHANGE_EVENT = "practice-bookmarks-changed";
const EMPTY_STATE_IMAGE = "/images/empty/no-results.webp";

// Bookmarks live in localStorage, exposed through useSyncExternalStore so
// SSR and the first client render agree (no hydration mismatch) and other
// tabs stay in sync via the native storage event.
const EMPTY_BOOKMARKS_SNAPSHOT = "[]";

function subscribeToBookmarks(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(BOOKMARK_CHANGE_EVENT, callback);

  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(BOOKMARK_CHANGE_EVENT, callback);
  };
}

function getBookmarksSnapshot() {
  try {
    return (
      window.localStorage.getItem(BOOKMARK_STORAGE_KEY) ??
      EMPTY_BOOKMARKS_SNAPSHOT
    );
  } catch {
    return EMPTY_BOOKMARKS_SNAPSHOT;
  }
}

function getBookmarksServerSnapshot() {
  return EMPTY_BOOKMARKS_SNAPSHOT;
}

function parseBookmarks(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((value) => typeof value === "string")
      : [];
  } catch {
    return [];
  }
}

function foldSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .toLowerCase();
}

function sortDisplays(
  source: PracticeTopicDisplay[],
  sort: PracticeSortOption
) {
  const difficultyRank = { easy: 0, medium: 1, hard: 2 };
  const sorted = [...source];
  const comparePriority = (
    left: PracticeTopicDisplay,
    right: PracticeTopicDisplay
  ) => left.priorityRank - right.priorityRank;
  const compareCatalogOrder = (
    left: PracticeTopicDisplay,
    right: PracticeTopicDisplay
  ) => left.popularityRank - right.popularityRank;
  const comparePracticeCount = (
    left: PracticeTopicDisplay,
    right: PracticeTopicDisplay
  ) =>
    comparePriority(left, right) ||
    right.practiceCount - left.practiceCount ||
    compareCatalogOrder(left, right);

  sorted.sort((left, right) => {
    if (sort === "newest") {
      return comparePriority(left, right) || compareCatalogOrder(left, right);
    }

    if (sort === "easiest") {
      return (
        difficultyRank[left.difficultyTone] -
          difficultyRank[right.difficultyTone] ||
        comparePriority(left, right) ||
        comparePracticeCount(left, right)
      );
    }

    if (sort === "hardest") {
      return (
        difficultyRank[right.difficultyTone] -
          difficultyRank[left.difficultyTone] ||
        comparePriority(left, right) ||
        comparePracticeCount(left, right)
      );
    }

    return comparePracticeCount(left, right);
  });

  return sorted;
}

export default function PracticePage({
  initialTopics,
}: {
  initialTopics: DebateTopic[];
}) {
  const t = useTranslations("dashboard.practice");
  const locale = useLocale();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const practiceLanguage = coercePracticeLanguage(locale);
  const appliedPrefillRef = useRef<string | null>(null);
  const initialPrefill = useMemo(
    () => readPracticePrefill(searchParams),
    [searchParams]
  );
  const localizedTopics = useMemo(
    () => initialTopics,
    [initialTopics]
  );
  const initialTopic = useMemo(
    () =>
      initialPrefill?.topicId || initialPrefill?.topicTitle
        ? resolvePracticeTopic({
            topicId: initialPrefill.topicId,
            topicTitle:
              initialPrefill.topicTitle ??
              initialPrefill.topicId ??
              t("selected_motion"),
            topicCategory: initialPrefill.topicCategory,
            topicDescription: initialPrefill.topicDescription,
            practiceTrack: initialPrefill.practiceTrack,
            practiceLanguage,
            mode: initialPrefill.mode,
            aiDifficulty: initialPrefill.aiDifficulty,
            side: initialPrefill.side,
          }, practiceLanguage, localizedTopics)
        : null,
    [initialPrefill, localizedTopics, practiceLanguage, t]
  );
  const [activeTab, setActiveTab] = useState<PracticeTab>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<CategoryFilterKey>(
    () => (initialTopic ? getTopicCategoryKey(initialTopic) : "all")
  );
  const [difficultyFilter, setDifficultyFilter] =
    useState<PracticeDifficultyFilter>("all");
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(
    () => initialTopic?.id ?? null
  );
  const [sortOption, setSortOption] = useState<PracticeSortOption>("popular");
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_TOPICS);
  const [mobileConfigOpen, setMobileConfigOpen] = useState(false);
  const [referralDialogOpen, setReferralDialogOpen] = useState(false);
  const bookmarksSnapshot = useSyncExternalStore(
    subscribeToBookmarks,
    getBookmarksSnapshot,
    getBookmarksServerSnapshot
  );
  const bookmarkedIds = useMemo(
    () => parseBookmarks(bookmarksSnapshot),
    [bookmarksSnapshot]
  );
  const [orbBalance, setOrbBalance] = useState<number | null>(null);
  const [referralCode, setReferralCode] = useState("");
  const {
    setPracticeTrack,
    setPracticeLanguage,
    setMode,
    setAiDifficulty,
    setSide,
    setPrepTime,
    setSpeechTime,
    setClubContext,
  } = useSessionStore();

  const categoryOptions = useMemo(
    () => getLocalizedCategoryOptions(practiceLanguage),
    [practiceLanguage]
  );
  const allDisplays = useMemo(
    () => buildPracticeTopicDisplays(localizedTopics, practiceLanguage),
    [localizedTopics, practiceLanguage]
  );
  const sortedDisplays = useMemo(
    () => sortDisplays(allDisplays, sortOption),
    [allDisplays, sortOption]
  );
  const filteredDisplays = useMemo(() => {
    const query = foldSearchText(searchQuery.trim());

    return sortedDisplays.filter((display) => {
      if (
        activeCategory !== "all" &&
        getTopicCategoryKey(display.topic) !== activeCategory
      ) {
        return false;
      }

      if (
        difficultyFilter !== "all" &&
        display.difficultyTone !== difficultyFilter
      ) {
        return false;
      }

      if (activeTab === "saved" && !bookmarkedIds.includes(display.topic.id)) {
        return false;
      }

      if (
        query &&
        !foldSearchText(
          `${display.topic.title} ${display.topic.category}`
        ).includes(query)
      ) {
        return false;
      }

      return true;
    });
  }, [
    activeCategory,
    activeTab,
    bookmarkedIds,
    difficultyFilter,
    searchQuery,
    sortedDisplays,
  ]);
  // Job-board behavior: the detail pane is never empty — fall back to the
  // first visible motion whenever the current selection leaves the list.
  const selectedDisplay = useMemo(
    () =>
      filteredDisplays.find(
        (display) => display.topic.id === selectedTopicId
      ) ??
      filteredDisplays[0] ??
      null,
    [filteredDisplays, selectedTopicId]
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
  const activeFilterCount =
    (activeCategory !== "all" ? 1 : 0) +
    (difficultyFilter !== "all" ? 1 : 0) +
    (sortOption !== "popular" ? 1 : 0);
  const hasNarrowedResults =
    activeFilterCount > 0 || searchQuery.trim().length > 0;

  useEffect(() => {
    if (!initialPrefill?.practiceLanguage) {
      return;
    }

    const legacyLanguage = initialPrefill.practiceLanguage;
    const { finalHref, switchHref } = buildLegacyPracticeLanguageRedirect(
      pathname,
      legacyLanguage,
      searchParams
    );

    if (legacyLanguage !== practiceLanguage) {
      window.location.replace(switchHref);
      return;
    }

    window.history.replaceState(window.history.state, "", finalHref);
  }, [
    initialPrefill?.practiceLanguage,
    pathname,
    practiceLanguage,
    searchParams,
  ]);

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
    setPracticeLanguage(practiceLanguage);
    setAiDifficulty(initialPrefill.aiDifficulty ?? "medium");
    setSide(initialPrefill.side ?? "proposition");
    setClubContext(initialPrefill.clubContext ?? null);

    if (practiceTrack === "debate") {
      setMode(initialPrefill.mode ?? "quick");
    }
  }, [
    initialPrefill,
    searchParams,
    setAiDifficulty,
    setMode,
    setPracticeLanguage,
    setPracticeTrack,
    setSide,
    setClubContext,
    practiceLanguage,
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
      setPracticeLanguage(practiceLanguage);
      setMode(initialPrefill?.mode ?? "quick");
      setPrepTime(defaults.defaultPrepTime);
      setSpeechTime(defaults.defaultSpeechTime);
      setAiDifficulty(initialPrefill?.aiDifficulty ?? defaults.defaultDifficulty);
      setSide(initialPrefill?.side ?? "proposition");
      setClubContext(initialPrefill?.clubContext ?? null);
      setOrbBalance(profile?.orb_balance ?? 0);
      setReferralCode(profile?.referral_code ?? "");
    }

    void loadPracticeDefaults();

    return () => {
      isMounted = false;
    };
  }, [
    initialPrefill?.aiDifficulty,
    initialPrefill?.clubContext,
    initialPrefill?.mode,
    initialPrefill?.practiceTrack,
    initialPrefill?.side,
    practiceLanguage,
    setAiDifficulty,
    setMode,
    setPracticeLanguage,
    setPracticeTrack,
    setPrepTime,
    setSide,
    setClubContext,
    setSpeechTime,
  ]);

  const openConfigOnMobile = () => {
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(max-width: 1023.5px)").matches
    ) {
      setMobileConfigOpen(true);
    }
  };

  const handleSelectTopic = (topicId: string) => {
    setSelectedTopicId(topicId);
    openConfigOnMobile();
  };

  const handleSurprise = () => {
    if (!filteredDisplays.length) {
      return;
    }

    const random =
      filteredDisplays[Math.floor(Math.random() * filteredDisplays.length)];

    handleSelectTopic(random.topic.id);
  };

  const handleToggleBookmark = (topicId: string) => {
    const next = bookmarkedIds.includes(topicId)
      ? bookmarkedIds.filter((id) => id !== topicId)
      : [...bookmarkedIds, topicId];

    try {
      window.localStorage.setItem(BOOKMARK_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Storage unavailable (private mode) — bookmarks won't persist.
    }

    window.dispatchEvent(new Event(BOOKMARK_CHANGE_EVENT));
  };

  const handleTabChange = (tab: PracticeTab) => {
    setActiveTab(tab);
    setVisibleCount(INITIAL_VISIBLE_TOPICS);
  };

  const handleCategoryChange = (category: CategoryFilterKey) => {
    setActiveCategory(category);
    setVisibleCount(INITIAL_VISIBLE_TOPICS);
  };

  const handleDifficultyChange = (difficulty: PracticeDifficultyFilter) => {
    setDifficultyFilter(difficulty);
    setVisibleCount(INITIAL_VISIBLE_TOPICS);
  };

  const handleSortChange = (nextSort: PracticeSortOption) => {
    setSortOption(nextSort);
    setVisibleCount(INITIAL_VISIBLE_TOPICS);
  };

  const handleResetFilters = () => {
    setActiveCategory("all");
    setDifficultyFilter("all");
    setSortOption("popular");
    setSearchQuery("");
    setVisibleCount(INITIAL_VISIBLE_TOPICS);
  };

  const tabs: Array<{ key: PracticeTab; label: string; count?: number }> = [
    { key: "all", label: t("tab_all") },
    { key: "saved", label: t("tab_saved"), count: bookmarkedIds.length },
  ];

  const sessionPanel = selectedDisplay ? (
    <SessionConfig
      topic={selectedDisplay.topic}
      isBookmarked={bookmarkedIds.includes(selectedDisplay.topic.id)}
      onToggleBookmark={handleToggleBookmark}
      orbBalance={orbBalance}
      referralCode={referralCode}
      onBalanceChange={setOrbBalance}
      layout="desktop"
    />
  ) : null;

  return (
    <PageTransition className="min-h-full bg-background lg:h-full">
      <ProductPageShell className="lg:flex lg:h-full lg:min-h-0 lg:flex-col">
        <PageContainer
          size="wide"
          className="py-6 sm:py-8 lg:flex lg:min-h-0 lg:flex-1 lg:flex-col"
        >
          <ProductPageHeader
            title={t("page_headline")}
            icon={<Scale />}
            actions={
              <>
                <StatCounter
                  ariaLabel={t("credits_label")}
                  dataTestId="practice-stats-credits"
                  iconSrc={CREDIT_ICON_SRC}
                  iconClassName="h-10 w-10 sm:h-11 sm:w-11"
                  value={formatDashboardNumber(orbBalance ?? 0)}
                >
                  <CreditsPopover
                    formattedBalance={formatDashboardNumber(orbBalance ?? 0)}
                    referralCode={referralCode || null}
                    onReferralOpen={() => setReferralDialogOpen(true)}
                  />
                </StatCounter>

                <Dialog>
                  <DialogTrigger
                    render={
                      <button
                        type="button"
                        aria-label={t("how_it_works")}
                        className="flex size-12 items-center justify-center rounded-full text-on-surface-variant transition-all hover:-translate-y-0.5 hover:bg-surface-container-low hover:shadow-token-card active:scale-95"
                      />
                    }
                  >
                    <CircleHelp className="h-[21px] w-[21px]" />
                  </DialogTrigger>
                  <DialogContent className="max-w-xl rounded-[1.4rem] border border-outline-variant bg-surface-container-lowest p-6">
                    <DialogHeader>
                      <DialogTitle className="text-xl font-semibold text-on-surface">
                        {t("how_it_works_title")}
                      </DialogTitle>
                      <DialogDescription className="text-sm leading-6 text-on-surface-variant">
                        {t("how_it_works_description")}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 pt-2">
                      {[1, 2, 3].map((step) => (
                        <div
                          key={step}
                          className="rounded-[1.2rem] border border-outline-variant bg-surface-container p-4"
                        >
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/75">
                            {t("how_it_works_step_kicker", { step })}
                          </p>
                          <p className="mt-2 text-base font-semibold text-on-surface">
                            {t(`how_it_works_step_${step}_title`)}
                          </p>
                          <p className="mt-2 text-sm leading-6 text-on-surface-variant">
                            {t(`how_it_works_step_${step}_body`)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </DialogContent>
                </Dialog>
              </>
            }
          />

          <div className="mt-2 flex items-center gap-3">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-[17px] w-[17px] -translate-y-1/2 text-on-surface-variant" />
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => {
                  setSearchQuery(event.currentTarget.value);
                  setVisibleCount(INITIAL_VISIBLE_TOPICS);
                }}
                placeholder={t("search_placeholder")}
                className="h-12 w-full rounded-2xl border border-outline-variant bg-surface-container-lowest pl-11 pr-4 text-[14.5px] font-medium text-on-surface outline-none transition-all placeholder:text-on-surface-variant/70 focus:border-primary/45 focus:ring-3 focus:ring-primary/15"
              />
            </div>

            <PracticeFilterPopover
              categories={categoryOptions}
              activeCategory={activeCategory}
              onCategoryChange={handleCategoryChange}
              difficulty={difficultyFilter}
              onDifficultyChange={handleDifficultyChange}
              sort={sortOption}
              onSortChange={handleSortChange}
              activeFilterCount={activeFilterCount}
              onReset={handleResetFilters}
            />
          </div>

          <div className="mt-6 flex items-center gap-7 border-b border-outline-variant">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.key;

              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => handleTabChange(tab.key)}
                  className={cn(
                    "relative flex items-center gap-2 pb-3 text-[14.5px] font-semibold transition-colors",
                    isActive
                      ? "text-on-surface"
                      : "text-on-surface-variant hover:text-on-surface"
                  )}
                >
                  {tab.label}
                  {tab.count ? (
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[11px] font-bold leading-none",
                        isActive
                          ? "bg-primary/10 text-primary"
                          : "bg-surface-container text-on-surface-variant"
                      )}
                    >
                      {tab.count}
                    </span>
                  ) : null}
                  {isActive ? (
                    <motion.span
                      layoutId="practice-tab-underline"
                      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                      className="absolute inset-x-0 -bottom-px h-[2.5px] rounded-full bg-primary"
                    />
                  ) : null}
                </button>
              );
            })}
          </div>

          <div className="mt-6 overflow-hidden rounded-[24px] border border-outline-variant bg-surface-container-lowest shadow-token-card lg:min-h-0 lg:flex-1">
            <div className="grid lg:h-full lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
              <div className="relative min-w-0 lg:min-h-0 lg:overflow-y-auto lg:border-r lg:border-outline-variant">
                <div className="flex items-center justify-between gap-3 px-5 pb-2 pt-5 sm:px-6">
                  <p className="text-[13px] font-semibold text-on-surface-variant">
                    {t("topic_count", { count: filteredDisplays.length })}
                  </p>
                  <button
                    type="button"
                    onClick={handleSurprise}
                    className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-semibold text-primary transition-all hover:bg-primary/[0.06] active:scale-95"
                  >
                    <Shuffle className="h-[13px] w-[13px]" />
                    {t("surprise_me")}
                  </button>
                </div>

                {visibleDisplays.length ? (
                  <LayoutGroup id="practice-topic-list">
                    <div className="divide-y divide-outline-variant/40 dark:divide-outline-variant">
                      <AnimatePresence initial={false} mode="popLayout">
                        {visibleDisplays.map((display, index) => (
                          <TopicRow
                            key={display.topic.id}
                            display={display}
                            isSelected={
                              selectedDisplay?.topic.id === display.topic.id
                            }
                            isBookmarked={bookmarkedIds.includes(
                              display.topic.id
                            )}
                            onSelect={handleSelectTopic}
                            onToggleBookmark={handleToggleBookmark}
                            index={index}
                          />
                        ))}
                      </AnimatePresence>
                    </div>

                    {requiredVisibleCount < filteredDisplays.length ? (
                      <div className="flex justify-center border-t border-outline-variant/40 px-5 py-4">
                        <button
                          type="button"
                          onClick={() =>
                            setVisibleCount(
                              Math.min(
                                requiredVisibleCount + LOAD_MORE_STEP,
                                filteredDisplays.length
                              )
                            )
                          }
                          className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[13.5px] font-semibold text-primary transition-all hover:bg-primary/[0.06] active:scale-95"
                        >
                          {t("load_more_topics")}
                          <ChevronDown className="h-[15px] w-[15px]" />
                        </button>
                      </div>
                    ) : null}
                  </LayoutGroup>
                ) : (
                  <div className="flex flex-col items-center px-6 py-14 text-center">
                    <Image
                      src={EMPTY_STATE_IMAGE}
                      alt=""
                      width={150}
                      height={150}
                      className="h-[120px] w-[120px] object-contain opacity-90"
                      unoptimized
                      aria-hidden="true"
                    />
                    <p className="mt-5 text-[15.5px] font-semibold text-on-surface">
                      {activeTab === "saved" && !bookmarkedIds.length
                        ? t("saved_empty_title")
                        : t("search_empty_title")}
                    </p>
                    {hasNarrowedResults ? (
                      <button
                        type="button"
                        onClick={handleResetFilters}
                        className="mt-3 rounded-full px-4 py-2 text-[13.5px] font-semibold text-primary transition-all hover:bg-primary/[0.06] active:scale-95"
                      >
                        {t("filter_clear")}
                      </button>
                    ) : null}
                  </div>
                )}
              </div>

              <div className="hidden min-w-0 lg:flex lg:min-h-0 lg:flex-col">
                {sessionPanel}
              </div>
            </div>
          </div>
        </PageContainer>
      </ProductPageShell>

      <Sheet open={mobileConfigOpen} onOpenChange={setMobileConfigOpen}>
        <SheetContent
          side="bottom"
          className="max-h-[90dvh] gap-0 rounded-t-[28px] border-t-0 p-0 lg:hidden"
        >
          <SheetTitle className="sr-only">{t("selected_motion")}</SheetTitle>
          <div className="mx-auto mt-3 h-1.5 w-11 shrink-0 rounded-full bg-outline-variant" />
          <div className="flex min-h-0 flex-1 flex-col">
            {selectedDisplay ? (
              <SessionConfig
                topic={selectedDisplay.topic}
                isBookmarked={bookmarkedIds.includes(selectedDisplay.topic.id)}
                onToggleBookmark={handleToggleBookmark}
                orbBalance={orbBalance}
                referralCode={referralCode}
                onBalanceChange={setOrbBalance}
                layout="mobile"
              />
            ) : null}
          </div>
        </SheetContent>
      </Sheet>

      <ReferralCreditsDialog
        open={referralDialogOpen}
        onOpenChange={setReferralDialogOpen}
        referralCode={referralCode || null}
        inviteReward={REFERRAL_REWARD_CREDITS}
      />
    </PageTransition>
  );
}
