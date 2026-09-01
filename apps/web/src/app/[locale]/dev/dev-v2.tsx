import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Small, route-local primitives for development and QA surfaces.
 *
 * These intentionally compose the production semantic tokens instead of
 * introducing a second visual language for fixture routes. They also keep
 * the localhost-only pages useful at narrow widths where a full product shell
 * is not present.
 */
export function DevQaFrame({
  eyebrow = "Localhost QA",
  title,
  description,
  actions,
  children,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <main
      className={cn(
        "min-h-dvh overflow-x-hidden bg-background text-on-surface",
        className,
      )}
    >
      <div className="mx-auto w-full max-w-[1600px] px-3 py-3 sm:px-5 lg:px-6 lg:py-5">
        <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-none">
          <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
            <div className="min-w-0">
              <p className="type-caption font-semibold uppercase tracking-wider text-primary-dim">
                {eyebrow}
              </p>
              <h1 className="mt-1 type-heading-md text-on-surface">{title}</h1>
              {description ? (
                <p className="mt-1 max-w-3xl type-body-sm text-on-surface-variant">
                  {description}
                </p>
              ) : null}
            </div>
            {actions ? (
              <div className="flex w-full min-w-0 flex-wrap items-center gap-2 sm:w-auto">
                {actions}
              </div>
            ) : null}
          </header>
          <div className="min-w-0 p-3 sm:p-5">{children}</div>
        </div>
      </div>
    </main>
  );
}

export function DevQaToolbar({
  label = "Fixture state",
  children,
}: {
  label?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-w-0 max-w-full flex-wrap items-center gap-1.5 rounded-control border border-border bg-surface-container-low px-2.5 py-2">
      <span className="mr-1 type-caption font-semibold text-on-surface-variant">
        {label}
      </span>
      {children}
    </div>
  );
}

export const devQaChipClass =
  "inline-flex h-8 max-w-full items-center whitespace-nowrap rounded-control border border-border px-2.5 type-label font-medium text-on-surface-variant transition-colors duration-150 hover:border-primary/40 hover:bg-primary-container hover:text-primary-dim focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50";

export const devQaActiveChipClass =
  "inline-flex h-8 max-w-full items-center whitespace-nowrap rounded-control border border-primary bg-primary-container px-2.5 type-label font-medium text-primary-dim transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50";
