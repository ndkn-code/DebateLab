"use client";

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { Sparkles, BookOpen, Trophy, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

const EXPERIENCE_LEVELS = [
  {
    id: "beginner",
    label: "Beginner",
    description: "New to debate, want to learn the basics",
    icon: BookOpen,
    suggestedCourse: "foundations-of-competitive-debate",
    suggestedCourseName: "Foundations of Competitive Debate",
  },
  {
    id: "intermediate",
    label: "Some Experience",
    description: "Done a few debates, want to improve",
    icon: Trophy,
    suggestedCourse: "foundations-of-competitive-debate",
    suggestedCourseName: "Foundations of Competitive Debate",
  },
  {
    id: "advanced",
    label: "Competitive Debater",
    description: "Active competitor, want to sharpen skills",
    icon: GraduationCap,
    suggestedCourse: "public-speaking-mastery",
    suggestedCourseName: "Public Speaking Mastery",
  },
];

interface OnboardingModalProps {
  userId: string;
}

export function OnboardingModal({ userId }: OnboardingModalProps) {
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const selectedLevel = EXPERIENCE_LEVELS.find((l) => l.id === selected);

  const handleStart = () => {
    if (!selectedLevel) return;

    startTransition(async () => {
      const supabase = createClient();

      // Mark onboarding as completed
      await supabase
        .from("profiles")
        .update({ onboarding_completed: true })
        .eq("id", userId);

      // Try to enroll in suggested course
      const { data: course } = await supabase
        .from("courses")
        .select("id")
        .eq("slug", selectedLevel.suggestedCourse)
        .single();

      if (course) {
        await supabase.from("enrollments").insert({
          user_id: userId,
          course_id: course.id,
          status: "active",
          progress_percent: 0,
        });

        // Log activity
        await supabase.from("activity_log").insert({
          user_id: userId,
          activity_type: "course_enrolled",
          reference_id: course.id,
          reference_type: "course",
          xp_earned: 0,
          metadata: { course_name: selectedLevel.suggestedCourseName },
        });

        router.push(`/courses/${selectedLevel.suggestedCourse}`);
      } else {
        router.push("/courses");
      }
      router.refresh();
    });
  };

  const handleSkip = () => {
    startTransition(async () => {
      const supabase = createClient();
      await supabase
        .from("profiles")
        .update({ onboarding_completed: true })
        .eq("id", userId);
      router.refresh();
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl border border-outline-variant/10 bg-surface-container-lowest p-8 soft-shadow">
        {/* Header */}
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
            <Sparkles className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-2xl font-bold text-on-surface">
            Welcome to DebateLab!
          </h2>
          <p className="mt-2 text-sm text-on-surface-variant">
            Let&apos;s personalize your experience. What&apos;s your debate background?
          </p>
        </div>

        {/* Experience Options */}
        <div className="mb-6 space-y-2">
          {EXPERIENCE_LEVELS.map((level) => {
            const Icon = level.icon;
            return (
              <button
                key={level.id}
                onClick={() => setSelected(level.id)}
                className={`flex w-full items-center gap-4 rounded-xl border-2 p-4 text-left transition-all ${
                  selected === level.id
                    ? "border-primary bg-primary/5"
                    : "border-outline-variant/15 hover:border-primary/30"
                }`}
              >
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                    selected === level.id
                      ? "bg-primary/15"
                      : "bg-surface-container"
                  }`}
                >
                  <Icon
                    className={`h-5 w-5 ${
                      selected === level.id
                        ? "text-primary"
                        : "text-on-surface-variant"
                    }`}
                  />
                </div>
                <div>
                  <p className="text-sm font-semibold text-on-surface">
                    {level.label}
                  </p>
                  <p className="text-xs text-on-surface-variant">
                    {level.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Suggestion */}
        {selectedLevel && (
          <div className="mb-6 rounded-xl bg-primary/5 p-3 text-center">
            <p className="text-xs text-on-surface-variant">
              We recommend starting with
            </p>
            <p className="text-sm font-semibold text-primary">
              {selectedLevel.suggestedCourseName}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-2">
          <Button
            onClick={handleStart}
            disabled={!selected || isPending}
            className="w-full gap-2 bg-primary text-on-primary"
          >
            {isPending ? "Getting started..." : "Start Learning"}
          </Button>
          <button
            onClick={handleSkip}
            disabled={isPending}
            className="text-xs text-on-surface-variant hover:text-on-surface"
          >
            Skip for now
          </button>
        </div>
      </div>
    </div>
  );
}
