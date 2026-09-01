"use client";

import type { ReactNode } from "react";
import { PanelLeftClose, Search, X } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

/**
 * Adapted from Beautiful UI's collapsible Sidebar Nav and expanding search.
 * Original source Copyright (c) 2026 Shane Levine, MIT License.
 */
export function BeautifulSidebarNav({
  collapsed = false,
  onCollapsedChange,
  header,
  primaryAction,
  search,
  children,
  footer,
  collapseLabel,
  expandLabel,
  className,
}: {
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  header?: ReactNode;
  primaryAction?: ReactNode;
  search?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  collapseLabel?: string;
  expandLabel?: string;
  className?: string;
}) {
  return (
    <aside
      data-collapsed={collapsed || undefined}
      className={cn(
        "flex h-full min-h-0 shrink-0 flex-col overflow-hidden bg-surface transition-[width] duration-200 ease-out motion-reduce:transition-none",
        collapsed ? "w-14" : "w-60",
        className,
      )}
    >
      <div className="flex min-h-12 items-center border-b border-outline-variant/60 px-2">
        <div
          className={cn(
            "min-w-0 flex-1 transition-opacity duration-150",
            collapsed && "pointer-events-none opacity-0",
          )}
        >
          {header}
        </div>
        {onCollapsedChange && collapseLabel && expandLabel ? (
          <button
            type="button"
            onClick={() => onCollapsedChange(!collapsed)}
            aria-label={collapsed ? expandLabel : collapseLabel}
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <PanelLeftClose
              className={cn(
                "size-4 transition-transform",
                collapsed && "rotate-180",
              )}
              aria-hidden="true"
            />
          </button>
        ) : null}
      </div>
      <div className="px-2 py-2">{primaryAction}</div>
      {search ? <div className="px-2 pb-2">{search}</div> : null}
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">{children}</div>
      {footer ? (
        <div className="border-t border-outline-variant/60 p-2">{footer}</div>
      ) : null}
    </aside>
  );
}

export function BeautifulSidebarSearch({
  value,
  onValueChange,
  placeholder,
  label,
  collapsed = false,
}: {
  value: string;
  onValueChange: (value: string) => void;
  placeholder: string;
  label: string;
  collapsed?: boolean;
}) {
  return (
    <label
      className={cn(
        "flex h-8 items-center rounded-lg bg-surface-container-low text-on-surface-variant transition-[background-color,width] focus-within:bg-surface-container focus-within:text-on-surface focus-within:ring-2 focus-within:ring-ring",
        collapsed ? "w-8 justify-center" : "w-full px-2",
      )}
    >
      <Search className="size-3.5 shrink-0" aria-hidden="true" />
      <span className="sr-only">{label}</span>
      {!collapsed ? (
        <>
          <input
            value={value}
            onChange={(event) => onValueChange(event.target.value)}
            placeholder={placeholder}
            className="ml-1.5 min-w-0 flex-1 bg-transparent type-caption text-on-surface outline-none placeholder:text-on-surface-variant"
          />
          {value ? (
            <button
              type="button"
              onClick={() => onValueChange("")}
              aria-label={`${label}: ${placeholder}`}
              className="flex size-6 shrink-0 items-center justify-center rounded-md hover:bg-surface"
            >
              <X className="size-3.5" aria-hidden="true" />
            </button>
          ) : null}
        </>
      ) : null}
    </label>
  );
}

export function BeautifulSidebarRow({
  active = false,
  collapsed = false,
  icon,
  label,
  onClick,
  trailing,
}: {
  active?: boolean;
  collapsed?: boolean;
  icon?: ReactNode;
  label: string;
  onClick: () => void;
  trailing?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "group flex min-h-10 min-w-0 items-center rounded-control transition-[background-color,color,transform] duration-150 active:scale-[0.99]",
        active
          ? "bg-primary/8 text-on-surface"
          : "text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface",
      )}
    >
      <button
        type="button"
        onClick={onClick}
        aria-current={active ? "page" : undefined}
        title={collapsed ? label : undefined}
        className={cn(
          "flex min-h-10 min-w-0 flex-1 items-center gap-2 rounded-control px-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
          collapsed && "justify-center",
        )}
      >
        {icon ? <span className="shrink-0">{icon}</span> : null}
        {!collapsed ? (
          <span className="min-w-0 flex-1 truncate type-label font-medium">
            {label}
          </span>
        ) : null}
      </button>
      {!collapsed && trailing ? (
        <div className="shrink-0 pr-1">{trailing}</div>
      ) : null}
    </div>
  );
}
