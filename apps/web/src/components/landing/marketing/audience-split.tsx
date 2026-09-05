"use client";

import { useState } from "react";

import { ProductIcon } from "@/components/ui/product-icon";
import { cn } from "@/lib/utils";
import { StudentCta, TeacherCta } from "./cta";
import { SectionHead, Shell } from "./editorial";
import type { MarketingAudienceCopy, MarketingAudiencePanel } from "./types";

type Audience = "student" | "teacher";

function Sample({ sample }: { sample: MarketingAudiencePanel["sample"] }) {
  return (
    <div className="mt-7 overflow-hidden rounded-[12px] border border-outline-variant bg-surface-container-low">
      <p className="border-b border-outline-variant px-4 py-2.5 type-eyebrow text-on-surface-variant">
        {sample.label}
      </p>
      <ul>
        {sample.rows.map((row, index) => (
          <li
            key={row.primary}
            className={cn(
              "flex items-center justify-between gap-4 px-4 py-3",
              index > 0 && "border-t border-outline-variant",
            )}
          >
            <span className="min-w-0">
              <span className="block truncate type-label text-on-surface">
                {row.primary}
              </span>
              <span className="block truncate type-caption text-on-surface-variant">
                {row.secondary}
              </span>
            </span>
            <span className="shrink-0 type-caption font-semibold text-on-surface-variant">
              {row.state}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Panel({
  panel,
  audience,
  href,
  focus,
}: {
  panel: MarketingAudiencePanel;
  audience: Audience;
  href: string;
  focus: Audience | null;
}) {
  const dimmed = focus !== null && focus !== audience;
  const chosen = focus === audience;

  return (
    <article
      data-audience={audience}
      data-focused={chosen ? "true" : undefined}
      className={cn(
        "flex flex-col rounded-[12px] border bg-surface p-6 transition-[opacity,border-color,box-shadow] duration-200 ease-out motion-reduce:transition-none sm:p-8",
        chosen
          ? "border-outline shadow-token-card"
          : "border-outline-variant shadow-none",
        dimmed && "opacity-70",
        // On narrow screens the chosen audience leads; the desktop pair keeps
        // its reading order so the layout never jumps under the chooser.
        audience === "teacher" && chosen && "order-first lg:order-none",
      )}
    >
      <p className="type-eyebrow text-on-surface-variant">{panel.role}</p>
      <h3 className="mt-3 type-heading-lg text-on-surface">{panel.title}</h3>
      <p className="mt-3 max-w-[44ch] type-body-sm text-on-surface-variant">
        {panel.body}
      </p>

      <ul className="mt-6 space-y-2.5">
        {panel.points.map((point) => (
          <li key={point} className="flex gap-3 type-body-sm text-on-surface">
            <ProductIcon
              name="check"
              size="sm"
              weight="bold"
              className="mt-0.5 shrink-0 text-success"
            />
            {point}
          </li>
        ))}
      </ul>

      <Sample sample={panel.sample} />

      <div className="mt-7 pt-1">
        {audience === "student" ? (
          <StudentCta href={href} placement="audience_panel">
            {panel.cta}
          </StudentCta>
        ) : (
          <TeacherCta href={href} placement="audience_panel">
            {panel.cta}
          </TeacherCta>
        )}
      </div>
    </article>
  );
}

/**
 * Both audiences stay fully visible; the chooser only shifts emphasis. That
 * keeps the section readable without JavaScript while still recording which
 * audience a visitor identifies as (`landing_audience_selected`).
 */
export function AudienceSplit({
  copy,
  studentHref,
  teacherHref,
}: {
  copy: MarketingAudienceCopy;
  studentHref: string;
  teacherHref: string;
}) {
  const [focus, setFocus] = useState<Audience | null>(null);

  return (
    <section
      id="audiences"
      className="border-b border-outline-variant bg-background"
    >
      <Shell className="py-20 sm:py-24 lg:py-28">
        <SectionHead
          index="04"
          mark={copy.eyebrow}
          title={copy.title}
          lede={copy.lede}
        />

        <div className="mt-10 flex flex-wrap items-center gap-3">
          <p
            className="type-caption text-on-surface-variant"
            id="audience-chooser"
          >
            {copy.chooserLabel}
          </p>
          <div
            role="group"
            aria-labelledby="audience-chooser"
            className="flex flex-wrap gap-2"
          >
            {(["student", "teacher"] as const).map((audience) => (
              <button
                key={audience}
                type="button"
                aria-pressed={focus === audience}
                onClick={() =>
                  setFocus((current) =>
                    current === audience ? null : audience,
                  )
                }
                data-landing-event="landing_audience_selected"
                data-landing-audience={audience}
                data-landing-placement="audience_tabs"
                className={cn(
                  "inline-flex h-9 items-center rounded-full border px-4 type-label transition-colors duration-150 ease-out motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  focus === audience
                    ? "border-transparent bg-primary text-on-primary"
                    : "border-outline bg-surface text-on-surface hover:bg-surface-container",
                )}
              >
                {copy[audience].chooser}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-8 grid gap-5 lg:grid-cols-2 lg:gap-6">
          <Panel
            panel={copy.student}
            audience="student"
            href={studentHref}
            focus={focus}
          />
          <Panel
            panel={copy.teacher}
            audience="teacher"
            href={teacherHref}
            focus={focus}
          />
        </div>
      </Shell>
    </section>
  );
}
