import type { ReactNode } from "react";

/**
 * Shared empty state for the IELTS learner shell (no published tests yet, no
 * sittings yet). Semantic tokens + type-* only.
 */
export function IeltsEmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon?: ReactNode;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-outline-variant bg-surface-container-low px-6 py-12 text-center">
      {icon ? (
        <span
          aria-hidden="true"
          className="flex size-12 items-center justify-center rounded-2xl bg-surface-container-high text-on-surface-variant"
        >
          {icon}
        </span>
      ) : null}
      <h3 className="type-title font-semibold text-on-surface">{title}</h3>
      <p className="max-w-sm type-body-sm text-on-surface-variant">{body}</p>
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}
