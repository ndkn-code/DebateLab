"use client";

import { useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
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

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 100 : -100,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction > 0 ? -100 : 100,
    opacity: 0,
  }),
};

export default function OnboardingPage() {
  const store = useOnboardingStore();

  const handleNext = useCallback(() => {
    store.nextStep();
  }, [store]);

  const handleBack = () => {
    if (store.currentStep > 0) {
      store.prevStep();
    }
  };

  const handleDemoComplete = useCallback(
    (transcript: string) => {
      store.setDemoTranscript(transcript);
      store.nextStep();
    },
    [store]
  );

  const handleDemoSkip = useCallback(() => {
    store.setDemoTranscript("");
    // Skip both demo speak and feedback steps
    store.nextStep();
    setTimeout(() => store.nextStep(), 50);
  }, [store]);

  const renderStep = () => {
    switch (store.currentStep) {
      case 0:
        return <WelcomeStep onNext={handleNext} />;
      case 1:
        return (
          <GoalStep
            selected={store.goal}
            onSelect={store.setGoal}
            onNext={handleNext}
          />
        );
      case 2:
        return (
          <ExperienceStep
            selected={store.experienceLevel}
            onSelect={store.setExperienceLevel}
            onNext={handleNext}
          />
        );
      case 3:
        return (
          <EnglishStep
            selected={store.englishConfidence}
            onSelect={store.setEnglishConfidence}
            onNext={handleNext}
          />
        );
      case 4:
        return (
          <CommitmentStep
            selected={store.dailyGoalMinutes}
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

  return (
    <div className="flex min-h-screen flex-col">
      {/* Progress bar */}
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
            <span className="text-sm">Back</span>
          </button>
        </div>
      )}

      {/* Step content */}
      <div className="flex flex-1 items-center justify-center px-4 py-8">
        <div className="w-full max-w-lg">
          <AnimatePresence mode="wait" custom={1}>
            <motion.div
              key={store.currentStep}
              custom={1}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3, ease: "easeInOut" }}
            >
              {renderStep()}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
