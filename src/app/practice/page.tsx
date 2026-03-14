"use client";

import { useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Shuffle, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CategoryTabs } from "@/components/practice/category-tabs";
import { TopicCard } from "@/components/practice/topic-card";
import { SessionConfig } from "@/components/practice/session-config";
import { topics, CATEGORIES } from "@/lib/topics";
import type { DebateTopic } from "@/types";

export default function PracticePage() {
  const [activeCategory, setActiveCategory] = useState("All");
  const [selectedTopic, setSelectedTopic] = useState<DebateTopic | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);

  const filteredTopics = useMemo(
    () =>
      activeCategory === "All"
        ? topics
        : topics.filter((t) => t.category === activeCategory),
    [activeCategory]
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

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b border-zinc-800/50 bg-zinc-950/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="flex items-center gap-2 text-zinc-400 transition-colors hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            <MessageSquare className="h-5 w-5 text-blue-500" />
            <span className="font-semibold text-white">DebateLab</span>
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-bold text-white sm:text-4xl">
            Choose Your Battle
          </h1>
          <p className="mt-2 text-zinc-400">
            Select a debate topic, configure your session, and start practicing
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
            className="shrink-0 gap-2 border-zinc-700 bg-transparent text-zinc-300 hover:bg-zinc-800 hover:text-white"
          >
            <Shuffle className="h-4 w-4" />
            Surprise Me
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
              <div className="flex h-64 items-center justify-center text-zinc-500">
                No topics found in this category
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
