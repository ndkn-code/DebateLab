import * as React from "react";

import { cn } from "@/lib/utils";
import { Eyebrow, Heading, Text } from "@/components/ui/typography";

type ChartCardProps = React.ComponentProps<"section"> & {
  title?: React.ReactNode;
  eyebrow?: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  bodyClassName?: string;
};

/**
 * The shell every chart sits in. Tokenised surface + header (eyebrow / title /
 * subtitle / actions). Matches the <Card> token classes so it reads as one system.
 */
export function ChartCard({
  title,
  eyebrow,
  subtitle,
  actions,
  children,
  className,
  bodyClassName,
  ...props
}: ChartCardProps) {
  const hasHeader = Boolean(title || eyebrow || subtitle || actions);
  return (
    <section
      data-slot="chart-card"
      className={cn(
        "flex flex-col gap-4 rounded-xl bg-[var(--card-bg)] p-5 shadow-token-card ring-1 ring-[var(--card-border)]",
        className,
      )}
      {...props}
    >
      {hasHeader && (
        <header className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            {eyebrow && <Eyebrow className="text-on-surface-variant">{eyebrow}</Eyebrow>}
            {title && (
              <Heading level={4} className="text-on-surface">
                {title}
              </Heading>
            )}
            {subtitle && (
              <Text variant="body-sm" className="text-on-surface-variant">
                {subtitle}
              </Text>
            )}
          </div>
          {actions && <div className="shrink-0">{actions}</div>}
        </header>
      )}
      <div className={cn("min-h-0", bodyClassName)}>{children}</div>
    </section>
  );
}
