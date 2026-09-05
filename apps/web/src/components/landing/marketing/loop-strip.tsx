"use client";

import { useRef } from "react";

import { AnimatedBeam } from "@/components/magicui/animated-beam";
import { ProductIcon } from "@/components/ui/product-icon";
import { cn } from "@/lib/utils";
import { Reveal } from "./reveal";
import { SectionHead, Shell } from "./editorial";
import type { MarketingLoopCopy } from "./types";

/**
 * Practice → feedback → improvement, told through one artifact in three states.
 * The beam is the only place on the page where motion carries the idea, so the
 * three nodes are numbered and the copy stands alone without it.
 */
export function LoopStrip({ copy }: { copy: MarketingLoopCopy }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const first = useRef<HTMLDivElement>(null);
  const second = useRef<HTMLDivElement>(null);
  const third = useRef<HTMLDivElement>(null);
  const nodes = [first, second, third];

  return (
    <section id="loop" className="border-b border-outline-variant bg-surface">
      <Shell className="py-20 sm:py-24 lg:py-28">
        <SectionHead
          index="01"
          mark={copy.eyebrow}
          title={copy.title}
          lede={copy.lede}
        />

        <div
          ref={containerRef}
          className="relative mt-14 grid gap-10 md:grid-cols-3 md:gap-8"
        >
          <AnimatedBeam
            containerRef={containerRef}
            fromRef={first}
            toRef={second}
            duration={5}
            className="hidden md:block"
          />
          <AnimatedBeam
            containerRef={containerRef}
            fromRef={second}
            toRef={third}
            duration={5}
            delay={1.6}
            className="hidden md:block"
          />

          {copy.steps.map((step, index) => {
            const isDiagnostic = index === 1;
            return (
              <Reveal
                key={step.title}
                delay={index * 0.06}
                className="relative z-10"
              >
                <div className="flex items-center gap-3">
                  <div
                    ref={nodes[index]}
                    className="flex size-9 shrink-0 items-center justify-center rounded-full border border-outline bg-surface type-code text-on-surface"
                  >
                    {index + 1}
                  </div>
                  <p className="type-eyebrow text-on-surface-variant">
                    {step.kicker}
                  </p>
                </div>

                <h3 className="mt-5 type-heading-md text-on-surface">
                  {step.title}
                </h3>
                <p className="mt-2.5 max-w-[38ch] type-body-sm text-on-surface-variant">
                  {step.body}
                </p>

                <div
                  style={
                    isDiagnostic
                      ? { borderInlineStartColor: "var(--color-secondary)" }
                      : undefined
                  }
                  className={cn(
                    "mt-5 rounded-[12px] p-4",
                    isDiagnostic
                      ? "border-l-2 bg-secondary-container"
                      : "border border-dashed border-outline bg-surface-container-low",
                  )}
                >
                  {isDiagnostic ? (
                    <p className="flex items-start gap-2 type-body-sm text-on-surface">
                      <ProductIcon
                        name="target"
                        size="sm"
                        className="mt-0.5 shrink-0 text-secondary"
                      />
                      {step.artifact}
                    </p>
                  ) : (
                    <p className="type-prose text-on-surface">
                      {step.artifact}
                    </p>
                  )}
                </div>
              </Reveal>
            );
          })}
        </div>

        <p className="mt-10 flex items-center gap-2 type-caption text-on-surface-variant">
          <ProductIcon name="repeat" size="xs" />
          {copy.threadLabel}
        </p>
      </Shell>
    </section>
  );
}
