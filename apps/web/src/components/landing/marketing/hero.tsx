import type { ReactNode } from "react";

import { BorderBeam } from "@/components/magicui/border-beam";
import { GridPattern } from "@/components/magicui/grid-pattern";
import { StudentCta, TeacherCta } from "./cta";
import { SectionMark, Shell } from "./editorial";
import type { MarketingPageCopy } from "./types";

/**
 * Outcome-led headline on the left, a real product surface on the right.
 * The panel sits on an offset plate over a ruled field so the depth comes from
 * layering rather than from shadows or glass.
 */
export function Hero({
  copy,
  studentHref,
  teacherHref,
  isLoggedIn,
  children,
}: {
  copy: MarketingPageCopy;
  studentHref: string;
  teacherHref: string;
  isLoggedIn: boolean;
  children: ReactNode;
}) {
  return (
    <section className="relative isolate overflow-hidden border-b border-outline-variant">
      <div aria-hidden="true" className="absolute inset-0 -z-10">
        <GridPattern
          size={88}
          className="stroke-current text-on-surface-variant opacity-15 [mask-image:radial-gradient(130%_90%_at_78%_-10%,black,transparent_72%)]"
        />
      </div>

      <Shell>
        <div className="grid gap-14 py-16 sm:py-20 lg:grid-cols-12 lg:items-center lg:gap-10 lg:py-28">
          <div className="lg:col-span-6 lg:pr-6">
            <SectionMark>{copy.hero.eyebrow}</SectionMark>
            <h1 className="mt-6 max-w-[15ch] type-display-lg text-on-surface">
              {copy.hero.title}
            </h1>
            <p className="mt-6 max-w-[52ch] type-body-lg text-on-surface-variant">
              {copy.hero.lede}
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
              <StudentCta href={studentHref} placement="hero">
                {isLoggedIn ? copy.hero.primaryLoggedIn : copy.hero.primary}
              </StudentCta>
              <TeacherCta href={teacherHref} placement="hero">
                {copy.hero.teacher}
              </TeacherCta>
            </div>
            <p className="mt-5 max-w-[46ch] type-caption text-on-surface-variant">
              {copy.hero.note}
            </p>
          </div>

          <div className="lg:col-span-6">
            <figure className="relative">
              <div
                aria-hidden="true"
                className="absolute inset-0 hidden translate-x-3 translate-y-4 rounded-[12px] border border-outline-variant bg-surface-container-low sm:block"
              />
              <div className="relative overflow-hidden rounded-[12px] border border-outline-variant bg-surface p-px shadow-token-panel">
                <BorderBeam duration={14} />
                <div className="relative z-10 rounded-[12px] bg-surface">
                  {children}
                </div>
              </div>
              <figcaption className="sr-only">
                {copy.hero.panelLabel}
              </figcaption>
            </figure>
          </div>
        </div>
      </Shell>
    </section>
  );
}
