"use client";

import { useCallback, useEffect, useState } from "react";
import posthog from "posthog-js";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslations } from "next-intl";
import { ChevronLeft } from "lucide-react";
import { useOnboardingStore } from "@/stores/onboarding-store";
import { OnboardingProgress } from "@/components/onboarding/onboarding-progress";
import { WelcomeStep } from "@/components/onboarding/welcome-step";
import { GoalStep } from "@/components/onboarding/goal-step";
import { ExperienceStep } from "@/components/onboarding/experience-step";
import { EnglishStep } from "@/components/onboarding/english-step";
import { CommitmentStep } from "@/components/onboarding/commitment-step";
import { DemoIntroStep } from "@/components/onboarding/demo-intro-step";
import { DemoSpeakStep } from "@/components/onboarding/demo-speak-step";
import { DemoFeedbackStep } from "@/components/onboarding/demo-feedback-step";
import { PathRevealStep } from "@/components/onboarding/path-reveal-step";

const TOTAL_STEPS = 9;

const STEP_NAMES = [
  "welcome",
  "goal",
  "experience",
  "english",
  "commitment",
  "demo-intro",
  "demo-speak",
  "demo-feedback",
  "path-reveal",
];

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 60 : -60,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction > 0 ? -60 : 60,
    opacity: 0,
  }),
};

export default function OnboardingPage() {
  const t = useTranslations("onboarding");
  const store = useOnboardingStore();
  const currentStep = store.currentStep;
  const [direction, setDirection] = useState(1);

  useEffect(() => {
    window.scrollTo(0, 0);
    posthog.capture("onboarding_step_viewed", {
      step: currentStep,
      step_name: STEP_NAMES[currentStep],
    });
  }, [currentStep]);

  const handleNext = useCallback(() => {
    setDirection(1);
    store.nextStep();
  }, [store]);

  const handleBack = () => {
    if (store.currentStep > 0) {
      setDirection(-1);
      store.prevStep();
    }
  };

  const handleDemoComplete = useCallback(
    (transcript: string) => {
      setDirection(1);
      store.setDemoTranscript(transcript);
      store.nextStep();
    },
    [store]
  );

  const handleDemoSkip = useCallback(() => {
    setDirection(1);
    store.setDemoTranscript("");
    store.skipToStep(8);
  }, [store]);

  const renderStep = () => {
    switch (store.currentStep) {
      case 0:
        return <WelcomeStep onNext={handleNext} />;
      case 1:
        return (
          <GoalStep
            onSelect={store.setGoal}
            onNext={handleNext}
          />
        );
      case 2:
        return (
          <ExperienceStep
            onSelect={store.setExperienceLevel}
            onNext={handleNext}
          />
        );
      case 3:
        return (
          <EnglishStep
            onSelect={store.setEnglishConfidence}
            onNext={handleNext}
          />
        );
      case 4:
        return (
          <CommitmentStep
            onSelect={store.setDailyGoalMinutes}
            onNext={handleNext}
          />
        );
      case 5:
        return (
          <DemoIntroStep
            topic={store.demoTopic}
            position={store.demoPosition}
            onNext={handleNext}
          />
        );
      case 6:
        return (
          <DemoSpeakStep
            topic={store.demoTopic}
            position={store.demoPosition}
            onComplete={handleDemoComplete}
            onSkip={handleDemoSkip}
          />
        );
      case 7:
        return (
          <DemoFeedbackStep
            transcript={store.demoTranscript}
            topic={store.demoTopic}
            position={store.demoPosition}
            existingFeedback={store.demoFeedback}
            onFeedbackLoaded={store.setDemoFeedback}
            onNext={handleNext}
          />
        );
      case 8:
        return (
          <PathRevealStep
            goal={store.goal}
            experienceLevel={store.experienceLevel}
            englishConfidence={store.englishConfidence}
            dailyGoalMinutes={store.dailyGoalMinutes}
          />
        );
      default:
        return null;
    }
  };

  const isWelcome = store.currentStep === 0;

  return (
    <div
      className={`flex min-h-[100dvh] flex-col transition-colors duration-500 ${
        isWelcome ? "bg-[#fbf8ff]" : "bg-background"
      }`}
    >
      {/* Progress bar — hidden on welcome screen */}
      {store.currentStep > 0 && (
        <OnboardingProgress
          currentStep={store.currentStep}
          totalSteps={TOTAL_STEPS}
        />
      )}

      {/* Back button */}
      {store.currentStep > 0 && store.currentStep < 8 && (
        <div className="px-4 pt-4">
          <button
            onClick={handleBack}
            className="flex items-center gap-1 rounded-lg p-2 text-gray-400 transition-colors hover:text-gray-600"
          >
            <ChevronLeft className="h-5 w-5" />
            <span className="text-sm">{t("back")}</span>
          </button>
        </div>
      )}

      {/* Step content */}
      <div
        className={`flex flex-1 items-center px-4 py-8 ${
          isWelcome
            ? "justify-center"
            : "justify-start pt-8 md:justify-center md:pt-0"
        }`}
      >
        <div className="w-full max-w-lg">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={store.currentStep}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.35, ease: "easeOut" }}
            >
              {renderStep()}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
