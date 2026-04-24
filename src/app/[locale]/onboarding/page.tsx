"use client";

import { useCallback, useEffect, useState } from "react";
import posthog from "posthog-js";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import { useOnboardingStore } from "@/stores/onboarding-store";
import { OnboardingShell } from "@/components/onboarding/onboarding-primitives";
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

export default function OnboardingPage() {
  const t = useTranslations("onboarding");
  const store = useOnboardingStore();
  const currentStep = store.currentStep;
  const [direction, setDirection] = useState(1);
  const prefersReducedMotion = useReducedMotion();

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
  const isFinalReveal = store.currentStep === 8;
  const slideVariants = {
    enter: (stepDirection: number) => ({
      x: prefersReducedMotion ? 0 : stepDirection > 0 ? 42 : -42,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (stepDirection: number) => ({
      x: prefersReducedMotion ? 0 : stepDirection > 0 ? -42 : 42,
      opacity: 0,
    }),
  };

  return (
    <OnboardingShell
      currentStep={store.currentStep}
      totalSteps={TOTAL_STEPS}
      backLabel={t("back")}
      stepLabel={`${store.currentStep + 1} / ${TOTAL_STEPS}`}
      onBack={handleBack}
      showBack={store.currentStep > 0 && store.currentStep < 8}
      hideChrome={isWelcome || isFinalReveal}
      contentClassName={
        isWelcome
          ? "p-0"
          : isFinalReveal
            ? "items-center"
            : "items-start pt-8 md:items-center md:pt-7"
      }
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
            transition={{
              duration: prefersReducedMotion ? 0.12 : 0.24,
              ease: "easeOut",
            }}
          >
            {renderStep()}
          </motion.div>
        </AnimatePresence>
      </div>
    </OnboardingShell>
  );
}
