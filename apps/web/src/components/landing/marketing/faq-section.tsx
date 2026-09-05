"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { SectionMark, Shell } from "./editorial";
import type { MarketingFaqCopy } from "./types";

export function FaqSection({ copy }: { copy: MarketingFaqCopy }) {
  return (
    <section id="faq" className="border-b border-outline-variant bg-background">
      <Shell className="py-20 sm:py-24 lg:py-28">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-12">
          <div className="lg:col-span-4">
            <SectionMark index="06">{copy.eyebrow}</SectionMark>
            <h2 className="mt-5 max-w-[18ch] type-display-sm text-on-surface">
              {copy.title}
            </h2>
            <p className="mt-4 max-w-[34ch] type-body-sm text-on-surface-variant">
              {copy.lede}
            </p>
          </div>

          <Accordion className="lg:col-span-8">
            {copy.items.map((item) => (
              <AccordionItem
                key={item.question}
                value={item.question}
                className="border-t border-b-0 border-outline-variant last:border-b"
              >
                <AccordionTrigger
                  className="gap-6 py-5 type-title font-semibold text-on-surface hover:no-underline"
                  data-landing-event="landing_faq_opened"
                  data-landing-placement="faq"
                >
                  {item.question}
                </AccordionTrigger>
                <AccordionContent className="pb-6">
                  <p className="max-w-[62ch] type-body-sm text-on-surface-variant">
                    {item.answer}
                  </p>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </Shell>
    </section>
  );
}
