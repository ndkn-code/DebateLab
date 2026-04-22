"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { motion, AnimatePresence } from "framer-motion";
import { Shuffle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CategoryTabs } from "@/components/practice/category-tabs";
import { TopicCard } from "@/components/practice/topic-card";
import { SessionConfig } from "@/components/practice/session-config";
import { topics, CATEGORIES } from "@/lib/topics";
import { resolvePracticeTopic, readPracticePrefill } from "@/lib/practice-prefill";
import { useSessionStore } from "@/store/session-store";
import type { DebateTopic } from "@/types";

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
  const [selectedTopic, setSelectedTopic] = useState<DebateTopic | null>(
    () => initialTopic
  );
  const [highlightId, setHighlightId] = useState<string | null>(
    () => initialTopic?.id ?? null
  );
  const { setPracticeTrack, setMode, setAiDifficulty, setSide } =
    useSessionStore();

  const filteredTopics = useMemo(
    () => {
      const visibleTopics =
        activeCategory === "All"
          ? topics
          : topics.filter((topic) => topic.category === activeCategory);

      if (
        selectedTopic &&
        !visibleTopics.some((topic) => topic.id === selectedTopic.id) &&
        (activeCategory === "All" || selectedTopic.category === activeCategory)
      ) {
        return [selectedTopic, ...visibleTopics];
      }

      return visibleTopics;
    },
    [activeCategory, selectedTopic]
  );

  const handleSurprise = useCallback(() => {
    const pool =
      activeCategory === "All"
        ? topics
        : topics.filter((t) => t.category === activeCategory);
    const random = pool[Math.floor(Math.random() * pool.length)];
    setSelectedTopic(random);
    setHighlightId(random.id);
    setTimeout(() => setHighlightId(null), 1500);
  }, [activeCategory]);

  const handleSelectTopic = useCallback((topic: DebateTopic) => {
    setSelectedTopic((prev) => (prev?.id === topic.id ? null : topic));
  }, []);

  useEffect(() => {
    if (!initialTopic) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setHighlightId((current) => (current === initialTopic.id ? null : current));
    }, 1500);

    return () => window.clearTimeout(timeoutId);
  }, [initialTopic]);

  useEffect(() => {
    const prefillKey = searchParams.toString();
    if (!prefillKey || appliedPrefillRef.current === prefillKey) {
      return;
    }

    if (!initialPrefill) {
      return;
    }

    appliedPrefillRef.current = prefillKey;
    const practiceTrack = initialPrefill.practiceTrack ?? "debate";
    setPracticeTrack(practiceTrack);
    setAiDifficulty(initialPrefill.aiDifficulty ?? "medium");
    setSide(initialPrefill.side ?? "random");

    if (practiceTrack === "debate") {
      setMode(initialPrefill.mode ?? "quick");
    }
  }, [
    initialPrefill,
    setAiDifficulty,
    setMode,
    setPracticeTrack,
    setSide,
    searchParams,
  ]);

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-bold text-on-surface sm:text-4xl">
            {t("page_headline")}
          </h1>
          <p className="mt-2 text-on-surface-variant">
            {t("page_subtitle")}
          </p>
        </motion.div>

        {/* Category Tabs + Surprise Button */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <CategoryTabs
            categories={CATEGORIES}
            active={activeCategory}
            onSelect={setActiveCategory}
          />
          <Button
            onClick={handleSurprise}
            variant="outline"
            className="shrink-0 gap-2 border-outline-variant/30 bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
          >
            <Shuffle className="h-4 w-4" />
            {t("surprise_me")}
          </Button>
        </motion.div>

        {/* Topics Grid + Config Panel */}
        <div className="relative flex gap-6">
          <div
            className={`flex-1 transition-all duration-300 ${
              selectedTopic ? "lg:pr-[416px]" : ""
            }`}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={activeCategory}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
              >
                {filteredTopics.map((topic, i) => (
                  <TopicCard
                    key={topic.id}
                    topic={topic}
                    isSelected={
                      selectedTopic?.id === topic.id ||
                      highlightId === topic.id
                    }
                    onSelect={handleSelectTopic}
                    index={i}
                  />
                ))}
              </motion.div>
            </AnimatePresence>

            {filteredTopics.length === 0 && (
              <div className="flex h-64 items-center justify-center text-on-surface-variant">
                {t("no_topics")}
              </div>
            )}
          </div>

          {/* Config Panel — desktop sidebar */}
          <AnimatePresence>
            {selectedTopic && (
              <div className="hidden lg:block">
                <SessionConfig
                  topic={selectedTopic}
                  onClose={() => setSelectedTopic(null)}
                />
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Config Panel — mobile bottom sheet */}
      <AnimatePresence>
        {selectedTopic && (
          <div className="lg:hidden">
            <SessionConfig
              topic={selectedTopic}
              onClose={() => setSelectedTopic(null)}
            />
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
