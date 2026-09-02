"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  ChevronDown,
  GraduationCap,
  Loader2,
  Users,
} from "@/components/ui/icons";
import type {
  OrganizationRole,
  OrganizationStatus,
  OrganizationType,
} from "@/lib/organizations/contracts";
import { cn } from "@/lib/utils";

export type OrganizationOption = {
  id: string;
  name: string;
  type: OrganizationType;
  status: OrganizationStatus;
  role?: OrganizationRole;
  memberCount?: number;
  href?: string;
};

const copy = {
  en: {
    label: "Current workspace",
    club: "Club",
    school: "School",
    switch: "Switch organization",
    draft: "Draft",
    active: "Active",
    archived: "Archived",
    owner: "Owner",
    admin: "Admin",
    head_teacher: "Head Teacher",
    teacher: "Teacher",
    student: "Student",
    members: "people",
    none: "No other organizations are available.",
  },
  vi: {
    label: "Không gian hiện tại",
    club: "Câu lạc bộ",
    school: "Trường học",
    switch: "Đổi tổ chức",
    draft: "Bản nháp",
    active: "Đang hoạt động",
    archived: "Đã lưu trữ",
    owner: "Chủ sở hữu",
    admin: "Quản trị viên",
    head_teacher: "Trưởng bộ môn",
    teacher: "Giáo viên",
    student: "Học viên",
    members: "thành viên",
    none: "Không có tổ chức khác khả dụng.",
  },
} as const;

export function OrganizationSwitcher({
  current,
  organizations,
  onSelect,
  locale = "en",
  className,
}: {
  current: OrganizationOption;
  organizations: OrganizationOption[];
  onSelect?: (organization: OrganizationOption) => void | Promise<void>;
  locale?: "en" | "vi";
  className?: string;
}) {
  const t = copy[locale];
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  const choose = (organization: OrganizationOption) => {
    if (organization.status === "archived" || isPending) return;
    startTransition(async () => {
      if (onSelect) await onSelect(organization);
      else if (organization.href) router.push(organization.href);
      setOpen(false);
      requestAnimationFrame(() => triggerRef.current?.focus());
    });
  };

  const onListKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const enabled = buttonRefs.current.filter(
      (button): button is HTMLButtonElement =>
        Boolean(button && !button.disabled),
    );
    const index = enabled.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      enabled[(index + 1 + enabled.length) % enabled.length]?.focus();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      enabled[(index - 1 + enabled.length) % enabled.length]?.focus();
    }
  };

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex min-h-11 w-full items-center gap-2 rounded-control border border-outline-variant bg-surface px-3 py-2 text-left outline-none transition-colors hover:bg-surface-container-low focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
      >
        <OrganizationIcon type={current.type} />
        <span className="min-w-0 flex-1">
          <span className="block type-caption text-on-surface-variant">
            {t.label}
          </span>
          <span className="block truncate type-label text-on-surface">
            {current.name}
          </span>
        </span>
        {isPending ? (
          <Loader2
            className="h-4 w-4 animate-spin text-on-surface-variant motion-reduce:animate-none"
            aria-hidden="true"
          />
        ) : (
          <ChevronDown
            className={cn(
              "h-4 w-4 text-on-surface-variant transition-transform motion-reduce:transition-none",
              open && "rotate-180",
            )}
            aria-hidden="true"
          />
        )}
      </button>

      {open ? (
        <div
          role="listbox"
          aria-label={t.switch}
          onKeyDown={onListKeyDown}
          className="absolute left-0 top-[calc(100%+8px)] z-30 w-full min-w-72 rounded-control border border-outline-variant bg-surface p-1.5 shadow-token-card"
        >
          {organizations.length === 0 ? (
            <p
              role="status"
              className="px-3 py-2 type-body-sm text-on-surface-variant"
            >
              {t.none}
            </p>
          ) : null}
          {organizations.map((organization, index) => {
            const selected = organization.id === current.id;
            const disabled = organization.status === "archived";
            return (
              <button
                key={organization.id}
                ref={(button) => {
                  buttonRefs.current[index] = button;
                }}
                type="button"
                role="option"
                aria-selected={selected}
                disabled={disabled}
                onClick={() => choose(organization)}
                className="flex min-h-11 w-full items-center gap-2 rounded-[8px] px-2.5 text-left outline-none transition-colors hover:bg-surface-container-low focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-55 motion-reduce:transition-none"
              >
                <OrganizationIcon type={organization.type} quiet />
                <span className="min-w-0 flex-1">
                  <span className="block truncate type-label text-on-surface">
                    {organization.name}
                  </span>
                  <span className="block type-caption text-on-surface-variant">
                    {organization.type === "school" ? t.school : t.club}
                    {organization.role ? ` · ${t[organization.role]}` : ""}
                    {` · ${t[organization.status]}`}
                    {organization.memberCount === undefined
                      ? ""
                      : ` · ${organization.memberCount} ${t.members}`}
                  </span>
                </span>
                {selected ? (
                  <Check className="h-4 w-4 text-primary" aria-hidden="true" />
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function OrganizationIcon({
  type,
  quiet = false,
}: {
  type: OrganizationType;
  quiet?: boolean;
}) {
  const Icon = type === "school" ? GraduationCap : Users;
  return (
    <span
      className={cn(
        "grid h-7 w-7 shrink-0 place-items-center rounded-[8px]",
        quiet
          ? "bg-surface-container text-on-surface-variant"
          : "bg-primary-container text-primary",
      )}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
    </span>
  );
}
