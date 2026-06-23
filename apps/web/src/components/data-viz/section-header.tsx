import * as React from "react";

import { cn } from "@/lib/utils";
import { Eyebrow, Heading, Text } from "@/components/ui/typography";

type DashboardSectionHeaderProps = {
  title: React.ReactNode;
  eyebrow?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
};

/** Section title row for dashboards: eyebrow + heading + description + actions. */
export function DashboardSectionHeader({
  title,
  eyebrow,
  description,
  actions,
  className,
}: DashboardSectionHeaderProps) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-3", className)}>
      <div className="flex flex-col gap-1">
        {eyebrow && <Eyebrow className="text-primary">{eyebrow}</Eyebrow>}
        <Heading level={2} className="text-on-surface">
          {title}
        </Heading>
        {description && (
          <Text variant="body-sm" className="text-on-surface-variant">
            {description}
          </Text>
        )}
      </div>
      {actions && <div className="shrink-0">{actions}</div>}
    </div>
  );
}
