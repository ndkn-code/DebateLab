"use client";

/**
 * The review area of the results page (below the band hero): one tab per
 * skill present in the sitting. Listening / Reading render the split-pane
 * review; Writing and Speaking reuse the existing feedback panels.
 */
import { useTranslations } from "next-intl";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type {
  AttemptResultsViewModel,
  IeltsSkillKey,
} from "@/lib/ielts/results/types";
import { WritingResultPanel } from "../SkillFeedbackPanels";
import { SpeakingResultPanel } from "../SpeakingResultPanel";
import { ReviewSection } from "./ReviewSection";

export function ResultsReviewTabs({ model }: { model: AttemptResultsViewModel }) {
  const t = useTranslations("ielts.results.review");
  const tabs: IeltsSkillKey[] = [
    ...model.objective.map((section) => section.skill),
    ...(model.writing ? (["writing"] as const) : []),
    ...(model.speaking ? (["speaking"] as const) : []),
  ];
  if (tabs.length === 0) return null;

  const scoreFor = (skill: IeltsSkillKey): string | null => {
    const section = model.objective.find((entry) => entry.skill === skill);
    return section ? `${section.correctCount}/${section.totalCount}` : null;
  };

  return (
    <section id="results-review" tabIndex={-1} className="flex scroll-mt-4 flex-col gap-3">
      <h2 className="type-heading-md text-on-surface">{t("title")}</h2>
      <Tabs defaultValue={tabs[0]}>
        <div className="overflow-x-auto">
          <TabsList>
            {tabs.map((skill) => {
              const score = scoreFor(skill);
              return (
                <TabsTrigger key={skill} value={skill} className="px-3">
                  {t(skill)}
                  {score ? (
                    <span className="type-caption tabular-nums text-on-surface-variant">
                      {score}
                    </span>
                  ) : null}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </div>
        {model.objective.map((section) => (
          <TabsContent key={section.skill} value={section.skill} className="mt-1">
            <ReviewSection
              section={section}
              groups={model.groups}
              responses={model.responses}
            />
          </TabsContent>
        ))}
        {model.writing ? (
          <TabsContent value="writing" className="mt-1">
            <WritingResultPanel writing={model.writing} />
          </TabsContent>
        ) : null}
        {model.speaking ? (
          <TabsContent value="speaking" className="mt-1">
            <SpeakingResultPanel speaking={model.speaking} />
          </TabsContent>
        ) : null}
      </Tabs>
    </section>
  );
}
