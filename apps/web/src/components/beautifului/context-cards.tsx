import type { ReactNode } from "react";
import { ExternalLink, FileText } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

export interface BeautifulContextItem {
  id: string;
  title: string;
  body: ReactNode;
  sourceLabel: string;
  sourceKind?: string;
  meta?: string;
  href?: string;
}

/**
 * Adapted from Beautiful UI's retrieved Context Cards.
 * Original source Copyright (c) 2026 Shane Levine, MIT License.
 */
export function BeautifulContextCard({
  item,
  className,
}: {
  item: BeautifulContextItem;
  className?: string;
}) {
  const source = (
    <span className="inline-flex min-w-0 items-center gap-1.5 type-caption font-medium text-on-surface-variant">
      <FileText className="size-3.5 shrink-0" aria-hidden="true" />
      {item.sourceKind ? (
        <span className="rounded-md bg-surface-container px-1.5 py-0.5">
          {item.sourceKind}
        </span>
      ) : null}
      <span className="truncate">{item.sourceLabel}</span>
      {item.href ? (
        <ExternalLink className="size-3 shrink-0" aria-hidden="true" />
      ) : null}
    </span>
  );

  return (
    <article
      className={cn(
        "overflow-hidden rounded-xl border border-outline-variant bg-surface",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3 border-b border-outline-variant px-3 py-2.5">
        <h3 className="type-label font-semibold text-on-surface">
          {item.title}
        </h3>
        {item.meta ? (
          <span className="shrink-0 type-caption tabular-nums text-on-surface-variant">
            {item.meta}
          </span>
        ) : null}
      </div>
      <div className="px-3 py-3 type-body-sm text-on-surface-variant">
        {item.body}
      </div>
      <div className="border-t border-outline-variant px-3 py-2">
        {item.href ? (
          <a
            href={item.href}
            target="_blank"
            rel="noreferrer"
            className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {source}
          </a>
        ) : (
          source
        )}
      </div>
    </article>
  );
}

export function BeautifulContextCards({
  label,
  countLabel,
  items,
  className,
}: {
  label: string;
  countLabel?: string;
  items: BeautifulContextItem[];
  className?: string;
}) {
  return (
    <section className={cn("space-y-2", className)} aria-label={label}>
      <div className="flex items-center gap-2 px-0.5">
        <h2 className="type-label font-semibold text-on-surface">{label}</h2>
        {countLabel ? (
          <span className="inline-flex h-5 items-center rounded-md bg-surface-container px-1.5 type-caption font-medium tabular-nums text-on-surface-variant">
            {countLabel}
          </span>
        ) : null}
      </div>
      {items.map((item) => (
        <BeautifulContextCard key={item.id} item={item} />
      ))}
    </section>
  );
}
