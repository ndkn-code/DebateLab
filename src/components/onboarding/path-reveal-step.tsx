"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Rocket, BookOpen, Mic, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { completeOnboarding } from "@/app/onboarding/actions";

interface PathRevealStepProps {
  goal: string | null;
  experienceLevel: string | null;
  englishConfidence: string | null;
  dailyGoalMinutes: number | null;
}

function getRecommendations(
  goal: string | null,
  experience: string | null
): { title: string; desc: string; icon: typeof BookOpen }[] {
  const recs = [];

  // Always recommend foundations for beginners/intermediate
  if (experience !== "experienced") {
    recs.push({
      title: "Foundations of Competitive Debate",
      desc: "Learn the building blocks of strong arguments",
      icon: BookOpen,
    });
  }

  // Speaking-related goals
  if (
    goal === "english" ||
    goal === "interview" ||
    experience === "experienced"
  ) {
    recs.push({
      title: "Public Speaking Mastery",
      desc: "Build confidence and delivery skills",
      icon: Mic,
    });
  }

  // Always suggest practice
  recs.push({
    title: "Daily Debate Practice",
    desc: "Practice with AI opponents to sharpen your skills",
    icon: Star,
  });

  return recs.slice(0, 3);
}

export function PathRevealStep({
  goal,
  experienceLevel,
  englishConfidence,
  dailyGoalMinutes,
}: PathRevealStepProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recommendations = getRecommendations(goal, experienceLevel);

  const handleFinish = () => {
    setSaving(true);
    startTransition(async () => {
      const result = await completeOnboarding({
        goal,
        experience_level: experienceLevel,
        english_confidence: englishConfidence,
        daily_goal_minutes: dailyGoalMinutes,
      });

      if (result.error) {
        console.error("Onboarding error:", result.error);
        setError(result.error);
        setSaving(false);
        return;
      }

      router.push("/dashboard");
      router.refresh();
    });
  };

  return (
    <div className="text-center">
      {/* Rocket illustration */}
      <motion.div
        initial={{ scale: 0, rotate: -45 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", duration: 0.6 }}
        className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10"
      >
        <Rocket className="h-10 w-10 text-primary" />
      </motion.div>

      <motion.h2
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mb-2 text-2xl font-bold text-on-surface"
      >
        Your learning path is ready!
      </motion.h2>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="mb-8 text-gray-500"
      >
        Here&apos;s what we recommend for you
      </motion.p>

      {/* Recommendation cards */}
      <div className="mb-8 space-y-3">
        {recommendations.map((rec, i) => {
          const Icon = rec.icon;
          return (
            <motion.div
              key={rec.title}
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 + i * 0.2 }}
              className="flex items-center gap-4 rounded-2xl border border-gray-200 bg-white p-4 text-left shadow-sm"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                <Icon className="h-6 w-6 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-on-surface">
                  {rec.title}
                </p>
                <p className="text-xs text-gray-500">{rec.desc}</p>
              </div>
              <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                Recommended
              </span>
            </motion.div>
          );
        })}
      </div>

      {error && (
        <p className="mb-4 text-sm text-red-500">Error: {error}</p>
      )}

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1 }}
      >
        <Button
          onClick={handleFinish}
          disabled={isPending || saving}
          className="rounded-xl bg-primary px-8 py-3 text-lg font-semibold text-white"
          size="lg"
        >
          {isPending || saving ? "Setting up..." : "Go to Dashboard"}
        </Button>
      </motion.div>
    </div>
  );
}
