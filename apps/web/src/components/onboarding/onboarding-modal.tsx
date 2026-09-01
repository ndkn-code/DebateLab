"use client";

import Image from "next/image";
import { useState, useTransition } from "react";
import { useLocale } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { BookOpen, Trophy, GraduationCap } from "@/components/ui/icons";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

const EXPERIENCE_LEVELS = [
  {
    id: "beginner",
    label: "Beginner",
    labelVi: "Mới bắt đầu",
    description: "New to debate, want to learn the basics",
    descriptionVi: "Mới làm quen với tranh biện và muốn học nền tảng",
    icon: BookOpen,
    suggestedCourse: "foundations-of-competitive-debate",
    suggestedCourseName: "Foundations of Competitive Debate",
  },
  {
    id: "intermediate",
    label: "Some Experience",
    labelVi: "Đã có kinh nghiệm",
    description: "Done a few debates, want to improve",
    descriptionVi: "Đã tham gia một vài cuộc tranh biện và muốn tiến bộ",
    icon: Trophy,
    suggestedCourse: "foundations-of-competitive-debate",
    suggestedCourseName: "Foundations of Competitive Debate",
  },
  {
    id: "advanced",
    label: "Competitive Debater",
    labelVi: "Tranh biện thi đấu",
    description: "Active competitor, want to sharpen skills",
    descriptionVi: "Đang thi đấu và muốn rèn kỹ năng chuyên sâu",
    icon: GraduationCap,
    suggestedCourse: "public-speaking-mastery",
    suggestedCourseName: "Public Speaking Mastery",
  },
];

interface OnboardingModalProps {
  userId: string;
}

export function OnboardingModal({ userId }: OnboardingModalProps) {
  const locale = useLocale();
  const isVi = locale === "vi";
  const copy = isVi
    ? {
        title: "Chào mừng đến Thinkfy",
        body: "Chọn nền tảng phù hợp nhất với kinh nghiệm tranh biện của bạn.",
        recommend: "Lộ trình đề xuất",
        start: "Bắt đầu học",
        starting: "Đang chuẩn bị…",
        skip: "Để sau",
        mascot: "Linh vật Thinkfy chào mừng bạn",
      }
    : {
        title: "Welcome to Thinkfy",
        body: "Choose the starting point that best matches your debate experience.",
        recommend: "Recommended path",
        start: "Start learning",
        starting: "Getting ready…",
        skip: "Do this later",
        mascot: "Thinkfy mascot welcoming you",
      };
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
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-modal-title"
        className="max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-xl border border-outline-variant bg-surface p-5 sm:p-6"
      >
        <div className="mb-5 flex flex-col items-center text-center">
          <Image
            src="/brand/thinkfy/thinkfy-mascot-wave.png"
            alt={copy.mascot}
            width={512}
            height={607}
            className="mb-2 h-20 w-20 object-contain"
            priority
          />
          <h2
            id="onboarding-modal-title"
            className="type-heading-md font-semibold text-on-surface"
          >
            {copy.title}
          </h2>
          <p className="mt-2 type-body-sm text-on-surface-variant">
            {copy.body}
          </p>
        </div>

        <div className="mb-5 space-y-2">
          {EXPERIENCE_LEVELS.map((level) => {
            const Icon = level.icon;
            return (
              <button
                key={level.id}
                type="button"
                aria-pressed={selected === level.id}
                onClick={() => setSelected(level.id)}
                className={`flex min-h-14 w-full items-center gap-3 rounded-control border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  selected === level.id
                    ? "border-primary bg-primary-container"
                    : "border-outline-variant hover:border-primary/40 hover:bg-surface-container-low"
                }`}
              >
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-control ${
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
                  <p className="type-body-sm font-semibold text-on-surface">
                    {isVi ? level.labelVi : level.label}
                  </p>
                  <p className="type-caption text-on-surface-variant">
                    {isVi ? level.descriptionVi : level.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        {selectedLevel && (
          <div className="mb-5 rounded-control bg-primary-container p-3 text-center">
            <p className="type-caption text-on-surface-variant">
              {copy.recommend}
            </p>
            <p className="type-body-sm font-semibold text-primary">
              {selectedLevel.suggestedCourseName}
            </p>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <Button
            onClick={handleStart}
            disabled={!selected || isPending}
            className="h-8 w-full gap-2 rounded-control bg-on-surface text-surface"
          >
            {isPending ? copy.starting : copy.start}
          </Button>
          <button
            onClick={handleSkip}
            disabled={isPending}
            className="min-h-8 rounded-control type-label text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {copy.skip}
          </button>
        </div>
      </div>
    </div>
  );
}
