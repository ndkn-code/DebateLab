import { ProductIcon } from "@/components/ui/product-icon";
import { cn } from "@/lib/utils";
import { Chip, SectionHead, Shell } from "./editorial";
import { Reveal } from "./reveal";
import type { IeltsProofCopy } from "./types";

/**
 * The honesty diptych. Exam Simulation and AI Rehearsal are shown as one object
 * split by a hairline, with each side stating what it does and what it is not —
 * the compliance requirement rendered as the page's signature spread.
 */
export function IeltsDeepProof({ copy }: { copy: IeltsProofCopy }) {
  return (
    <section
      id="proof"
      className="border-b border-outline-variant bg-surface-container-low"
    >
      <Shell className="py-20 sm:py-24 lg:py-28">
        <SectionHead
          index="03"
          mark={copy.eyebrow}
          title={copy.title}
          lede={copy.lede}
        />

        <Reveal className="mt-14 overflow-hidden rounded-[12px] border border-outline-variant bg-outline-variant shadow-token-card">
          <div className="grid gap-px lg:grid-cols-2">
            {copy.columns.map((column) => {
              const caution = column.id === "rehearsal";
              return (
                <article key={column.id} className="bg-surface">
                  <header
                    className={cn(
                      "border-b border-outline-variant p-6 sm:p-8",
                      caution
                        ? "bg-warning-container"
                        : "bg-surface-container-low",
                    )}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h3 className="type-heading-lg text-on-surface">
                        {column.label}
                      </h3>
                      <Chip tone={caution ? "caution" : "neutral"}>
                        {column.scope}
                      </Chip>
                    </div>
                    <p className="mt-3 max-w-[46ch] type-body-sm text-on-surface-variant">
                      {column.summary}
                    </p>
                  </header>

                  <div className="grid gap-8 p-6 sm:p-8 md:grid-cols-2 lg:grid-cols-1 lg:gap-7">
                    <div>
                      <p className="type-eyebrow text-on-surface-variant">
                        {column.includesLabel}
                      </p>
                      <ul className="mt-4 space-y-3">
                        {column.includes.map((item) => (
                          <li
                            key={item}
                            className="flex gap-3 type-body-sm text-on-surface"
                          >
                            <ProductIcon
                              name="checkCircle"
                              size="sm"
                              weight="fill"
                              className="mt-0.5 shrink-0 text-success"
                            />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <p className="type-eyebrow text-on-surface-variant">
                        {column.excludesLabel}
                      </p>
                      <ul className="mt-4 space-y-3">
                        {column.excludes.map((item) => (
                          <li
                            key={item}
                            className="flex gap-3 type-body-sm text-on-surface-variant"
                          >
                            <ProductIcon
                              name="minus"
                              size="sm"
                              weight="bold"
                              className="mt-0.5 shrink-0 text-on-surface-variant"
                            />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </Reveal>

        <p className="mt-10 max-w-[76ch] type-caption text-on-surface-variant">
          {copy.footnote}
        </p>
      </Shell>
    </section>
  );
}
