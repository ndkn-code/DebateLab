"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import posthog from "posthog-js";
import { UserCard } from "./user-card";
import { SkillRadar } from "./skill-radar";
import { AchievementGrid } from "./achievement-grid";
import { ActivityTimeline } from "./activity-timeline";
import { TitleSelectModal } from "./title-select-modal";

export interface ProfileData {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  selected_title: string | null;
  unlocked_titles: string[];
  xp: number;
  level: number;
  streak_current: number;
  streak_longest: number;
  total_sessions_completed: number;
  total_practice_minutes: number;
  [key: string]: unknown;
}

export interface AchievementData {
  id: string;
  slug: string;
  title: string;
  description: string;
  icon: string;
  category: string;
  title_reward: string | null;
  xp_reward: number;
  condition_type: string;
  condition_value: number;
  sort_order: number;
  unlocked: boolean;
  unlocked_at: string | null;
}

export interface SkillData {
  content: number;
  structure: number;
  language: number;
  persuasion: number;
  total_sessions: number;
}

export interface ActivityEntry {
  id: string;
  activity_type: string;
  description: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

interface ProfileContentProps {
  profile: ProfileData | null;
  achievements: AchievementData[];
  skills: SkillData;
  activity: ActivityEntry[];
}

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.4, ease: "easeOut" as const },
  }),
};

export function ProfileContent({
  profile,
  achievements,
  skills,
  activity,
}: ProfileContentProps) {
  const [titleModalOpen, setTitleModalOpen] = useState(false);
  const [currentTitle, setCurrentTitle] = useState(profile?.selected_title ?? null);

  useEffect(() => {
    posthog.capture("profile_viewed");
  }, []);

  const unlockedTitles = profile?.unlocked_titles ?? [];

  function handleTitleChange(title: string | null) {
    setCurrentTitle(title);
  }

  const displayProfile = profile
    ? { ...profile, selected_title: currentTitle }
    : null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:py-8">
      <motion.div
        custom={0}
        initial="hidden"
        animate="visible"
        variants={fadeUp}
      >
        <UserCard
          profile={displayProfile}
          onTitleChange={() => setTitleModalOpen(true)}
        />
      </motion.div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <motion.div
          custom={1}
          initial="hidden"
          animate="visible"
          variants={fadeUp}
        >
          <SkillRadar skills={skills} />
        </motion.div>

        <motion.div
          custom={2}
          initial="hidden"
          animate="visible"
          variants={fadeUp}
        >
          <AchievementGrid achievements={achievements} />
        </motion.div>
      </div>

      <motion.div
        custom={3}
        initial="hidden"
        animate="visible"
        variants={fadeUp}
        className="mt-6"
      >
        <ActivityTimeline activity={activity} />
      </motion.div>

      <TitleSelectModal
        open={titleModalOpen}
        onOpenChange={setTitleModalOpen}
        unlockedTitles={unlockedTitles}
        currentTitle={currentTitle}
        onSelect={handleTitleChange}
      />
    </div>
  );
}
