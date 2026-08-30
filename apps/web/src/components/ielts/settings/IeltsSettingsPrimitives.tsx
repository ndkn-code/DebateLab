import type { ReactNode } from "react";
import { CheckCircle2, ChevronDown, Loader2 } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import type { IeltsSettingsCopy } from "./copy";

export type SaveStateValue = "saved" | "dirty" | "saving" | "error";

export function settingsSaveState({
  error,
  pending,
  dirty,
}: {
  error: boolean;
  pending: boolean;
  dirty: boolean;
}): SaveStateValue {
  if (error) return "error";
  if (pending) return "saving";
  return dirty ? "dirty" : "saved";
}

export function SettingsSection({
  icon,
  title,
  caption,
  children,
  defaultOpen = false,
}: {
  icon: ReactNode;
  title: string;
  caption: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details
      open={defaultOpen}
      className="group overflow-hidden rounded-xl border border-outline-variant bg-surface-container shadow-none"
    >
      <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-4 py-3 outline-none transition-colors hover:bg-surface-container-high focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/40 sm:px-5 [&::-webkit-details-marker]:hidden">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface-container-high text-on-surface-variant [&>svg]:size-4.5">
          {icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block type-title font-semibold text-on-surface">
            {title}
          </span>
          <span className="mt-0.5 block type-body-sm text-on-surface-variant">
            {caption}
          </span>
        </span>
        <ChevronDown className="size-4 shrink-0 text-on-surface-variant transition-transform duration-150 motion-reduce:transition-none group-open:rotate-180" />
      </summary>
      <div className="border-t border-outline-variant px-4 py-4 sm:px-5">
        {children}
      </div>
    </details>
  );
}

export function LabeledValue({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0 rounded-lg bg-surface-container-low px-3 py-2.5">
      <p className="type-caption font-semibold uppercase text-on-surface-variant">
        {label}
      </p>
      <p className="mt-0.5 break-words type-body-sm font-semibold text-on-surface">
        {value}
      </p>
    </div>
  );
}

export function SettingRow({
  title,
  description,
  control,
}: {
  title: string;
  description: string;
  control: ReactNode;
}) {
  return (
    <div className="flex min-h-11 items-center gap-4 border-b border-outline-variant py-3 last:border-b-0">
      <div className="min-w-0 flex-1">
        <p className="type-body-sm font-semibold text-on-surface">{title}</p>
        <p className="mt-0.5 max-w-prose type-caption text-on-surface-variant">
          {description}
        </p>
      </div>
      {control}
    </div>
  );
}

export function SaveState({
  state,
  copy,
}: {
  state: SaveStateValue;
  copy: IeltsSettingsCopy;
}) {
  const labels: Record<SaveStateValue, string> = {
    saved: copy.saved,
    dirty: copy.unsaved,
    saving: copy.saving,
    error: copy.retry,
  };
  return (
    <p
      role={state === "error" ? "alert" : "status"}
      aria-live="polite"
      className={cn(
        "inline-flex min-h-8 items-center gap-1.5 rounded-lg px-2.5 type-caption font-semibold",
        state === "error"
          ? "bg-error-container text-error"
          : state === "dirty"
            ? "bg-warning-container text-on-warning-container"
            : "bg-surface-container-high text-on-surface-variant",
      )}
    >
      {state === "saved" ? <CheckCircle2 className="size-3.5" /> : null}
      {state === "saving" ? (
        <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" />
      ) : null}
      {labels[state]}
    </p>
  );
}

export function SaveBar({
  copy,
  state,
  disabled,
  pending,
  onSave,
}: {
  copy: IeltsSettingsCopy;
  state: SaveStateValue;
  disabled: boolean;
  pending: boolean;
  onSave: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-outline-variant pt-4">
      <SaveState state={state} copy={copy} />
      <button
        type="button"
        className="inline-flex h-8 items-center justify-center rounded-[10px] bg-primary px-2.5 type-body-sm font-medium text-primary-foreground outline-none transition-colors hover:bg-primary-dim focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50"
        disabled={disabled}
        aria-busy={pending}
        onClick={onSave}
      >
        {copy.save}
      </button>
    </div>
  );
}
