import { BentoCard, BentoGrid } from "@/components/magicui/bento-grid";
import {
  ProductIcon,
  type ProductIconName,
} from "@/components/ui/product-icon";
import { cn } from "@/lib/utils";
import { SectionHead, Shell } from "./editorial";
import { Reveal } from "./reveal";
import type {
  MarketingGridCard,
  MarketingGridCopy,
  MarketingGridSpan,
  MarketingIcon,
} from "./types";

const ICONS: Record<MarketingIcon, ProductIconName> = {
  target: "target",
  mic: "mic",
  scale: "scale",
  chart: "chart",
  book: "book",
  timer: "timer",
  sparkles: "sparkles",
  listChecks: "listChecks",
  waves: "waves",
  penLine: "penLine",
  usersGroup: "usersGroup",
  shieldCheck: "shieldCheck",
  compass: "compass",
  clipboard: "clipboard",
  repeat: "repeat",
  quote: "quote",
};

/**
 * Span map. Totals are chosen so the grid closes cleanly at both breakpoints:
 * 10 cells over 2 columns at md, 12 cells over 3 columns at lg.
 */
const SPANS: Record<MarketingGridSpan, string> = {
  feature: "md:col-span-2 lg:col-span-2 lg:row-span-2",
  tall: "md:col-span-2 lg:col-span-1 lg:row-span-2",
  wide: "md:col-span-2 lg:col-span-2",
  standard: "",
};

function CardIcon({ icon, muted }: { icon: MarketingIcon; muted?: boolean }) {
  return (
    <span
      className={cn(
        "flex size-10 items-center justify-center rounded-[11px] border",
        muted
          ? "border-outline-variant bg-surface-container-low text-on-surface-variant"
          : "border-transparent bg-primary text-on-primary",
      )}
    >
      <ProductIcon name={ICONS[icon]} size="md" />
    </span>
  );
}

function Rail({
  card,
  className,
}: {
  card: MarketingGridCard;
  className?: string;
}) {
  if (!card.rail?.length) return null;

  // Meters when the copy supplies a fill, otherwise a divided fact rail.
  const hasFill = card.rail.some((item) => typeof item.fill === "number");

  if (hasFill) {
    return (
      <dl className={cn("mt-6 space-y-3", className)}>
        {card.rail.map((item) => (
          <div key={item.label}>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="truncate type-caption text-on-surface-variant">
                {item.label}
              </dt>
              <dd className="type-caption font-semibold tabular-nums text-on-surface">
                {item.value}
              </dd>
            </div>
            <div
              className="mt-1.5 h-1 overflow-hidden rounded-full bg-surface-container-high"
              aria-hidden="true"
            >
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${Math.round((item.fill ?? 0) * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </dl>
    );
  }

  return (
    <dl
      className={cn(
        "mt-7 grid gap-px overflow-hidden rounded-[10px] border border-outline-variant bg-outline-variant sm:grid-cols-3",
        className,
      )}
    >
      {card.rail.map((item) => (
        <div key={item.label} className="bg-surface-container-low p-3">
          <dt className="type-caption text-on-surface-variant">{item.label}</dt>
          <dd className="mt-1 type-label font-semibold text-on-surface">
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function Card({ card, index }: { card: MarketingGridCard; index: number }) {
  // Wide tiles read horizontally so the grid never resolves into one repeated
  // card shape; the feature tile is two rows tall and pins its rail to the base.
  if (card.span === "wide") {
    return (
      <BentoCard className={cn("p-5 sm:p-6", SPANS[card.span])}>
        <Reveal
          delay={Math.min(index, 3) * 0.04}
          className="flex h-full flex-row items-start gap-5"
        >
          <CardIcon icon={card.icon} muted />
          <div className="min-w-0 flex-1">
            <p className="type-eyebrow text-on-surface-variant">
              {card.kicker}
            </p>
            <h3 className="mt-2.5 type-heading-md text-on-surface">
              {card.title}
            </h3>
            <p className="mt-2.5 max-w-[52ch] type-body-sm text-on-surface-variant">
              {card.body}
            </p>
            <Rail card={card} />
          </div>
        </Reveal>
      </BentoCard>
    );
  }

  return (
    <BentoCard className={cn("p-5 sm:p-6", SPANS[card.span])}>
      <Reveal
        delay={Math.min(index, 3) * 0.04}
        className="flex h-full flex-col"
      >
        <div className="flex items-center gap-3">
          <CardIcon icon={card.icon} />
          <p className="type-eyebrow text-on-surface-variant">{card.kicker}</p>
        </div>
        <h3
          className={cn(
            "mt-6 text-on-surface",
            card.span === "feature" ? "type-heading-xl" : "type-heading-md",
          )}
        >
          {card.title}
        </h3>
        <p className="mt-3 max-w-[46ch] type-body-sm text-on-surface-variant">
          {card.body}
        </p>
        <Rail
          card={card}
          className={card.span === "feature" ? "mt-auto" : undefined}
        />
      </Reveal>
    </BentoCard>
  );
}

export function CapabilityGrid({ copy }: { copy: MarketingGridCopy }) {
  return (
    <section
      id="capabilities"
      className="border-b border-outline-variant bg-background"
    >
      <Shell className="py-20 sm:py-24 lg:py-28">
        <SectionHead
          index="02"
          mark={copy.eyebrow}
          title={copy.title}
          lede={copy.lede}
        />
        <BentoGrid className="mt-14 auto-rows-[minmax(10rem,auto)] gap-4 lg:grid-flow-row-dense">
          {copy.cards.map((card, index) => (
            <Card key={card.id} card={card} index={index} />
          ))}
        </BentoGrid>
      </Shell>
    </section>
  );
}
