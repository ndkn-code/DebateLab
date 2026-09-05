import { SectionHead, Shell } from "./editorial";
import { Reveal } from "./reveal";
import type { MarketingHonestyCopy } from "./types";

/**
 * Credibility without borrowed authority: four statements about what the
 * product does, set as top-ruled editorial columns rather than stat cards, so
 * nothing reads as a metric we did not measure.
 */
export function HonestyBand({ copy }: { copy: MarketingHonestyCopy }) {
  return (
    <section className="border-b border-outline-variant bg-surface">
      <Shell className="py-20 sm:py-24 lg:py-28">
        <SectionHead
          index="05"
          mark={copy.eyebrow}
          title={copy.title}
          lede={copy.lede}
        />

        <Reveal className="mt-14">
          <dl className="grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
            {copy.items.map((item) => (
              <div
                key={item.label}
                className="border-t-2 border-on-surface pt-5"
              >
                <dt className="type-eyebrow text-on-surface-variant">
                  {item.label}
                </dt>
                <dd className="mt-3 type-heading-md text-on-surface">
                  {item.value}
                </dd>
                <dd className="mt-2.5 type-body-sm text-on-surface-variant">
                  {item.body}
                </dd>
              </div>
            ))}
          </dl>
        </Reveal>
      </Shell>
    </section>
  );
}
