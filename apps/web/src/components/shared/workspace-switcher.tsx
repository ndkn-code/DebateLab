"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { Check, ChevronDown, GraduationCap } from "@/components/ui/icons";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  getWorkspaceMode,
  safeTeacherReturnPath,
  WORKSPACE_MODE_COOKIE,
  type WorkspaceMode,
} from "@/lib/workspace-navigation";
import type { Subject } from "@/lib/subject";

function saveWorkspaceMode(next: WorkspaceMode) {
  document.cookie = `${WORKSPACE_MODE_COOKIE}=${next}; Path=/; Max-Age=2592000; SameSite=Lax${window.location.protocol === "https:" ? "; Secure" : ""}`;
}

/** One current role, separate from the navigation's current page. */
export function WorkspaceSwitcher({
  canTeach,
  isAdmin,
  activeSubject,
  userId,
  collapsed = false,
  onNavigate,
}: {
  canTeach: boolean;
  isAdmin: boolean;
  activeSubject: Subject;
  userId?: string;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const t = useTranslations("dashboard.nav");
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const mode = getWorkspaceMode(pathname);
  const storageKey = `thinkfy:teacher-return:${userId ?? "anonymous"}`;
  const labels = {
    learner: t("learnerWorkspace"),
    teacher: t("teacherWorkspace"),
    admin: t("adminWorkspace"),
  };

  useEffect(() => {
    if (mode !== "teacher") return;
    try {
      const query = searchParams.toString();
      sessionStorage.setItem(
        storageKey,
        `${pathname}${query ? `?${query}` : ""}${window.location.hash}`,
      );
    } catch {
      /* Storage restrictions must never block navigation. */
    }
  }, [mode, pathname, searchParams, storageKey]);

  const selectMode = (next: WorkspaceMode) => {
    if (next === mode) return;
    let destination = activeSubject === "ielts" ? "/ielts/home" : "/dashboard";
    if (next === "admin") destination = "/dashboard/admin";
    if (next === "teacher") {
      let remembered: string | null = null;
      try {
        remembered = sessionStorage.getItem(storageKey);
      } catch {
        /* optional */
      }
      destination = safeTeacherReturnPath(remembered);
    }
    // A presentation preference, not a grant of access. Prevents the learner
    // dashboard from immediately redirecting an assigned teacher back to work.
    saveWorkspaceMode(next);
    router.push(destination);
    onNavigate?.();
    router.refresh();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`${t("switchWorkspace")}: ${labels[mode]}`}
        title={
          collapsed ? `${t("switchWorkspace")}: ${labels[mode]}` : undefined
        }
        className="flex min-h-10 w-full min-w-0 items-center gap-2 rounded-md border border-outline-variant bg-surface px-2 text-left type-label text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <GraduationCap className="size-5 shrink-0" aria-hidden="true" />
        {!collapsed && (
          <span className="min-w-0 flex-1">
            <span className="block type-caption text-on-surface-variant">
              {t("workspaceRole")}
            </span>
            {labels[mode]}
          </span>
        )}
        {!collapsed && (
          <ChevronDown className="size-4 shrink-0" aria-hidden="true" />
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent className="min-w-52 bg-surface text-on-surface">
        {(
          [
            "learner",
            ...(canTeach ? ["teacher"] : []),
            ...(isAdmin ? ["admin"] : []),
          ] as WorkspaceMode[]
        ).map((option) => (
          <DropdownMenuItem
            key={option}
            onClick={() => selectMode(option)}
            className="min-h-10 type-label"
          >
            <span className="flex-1">{labels[option]}</span>
            {mode === option && <Check aria-hidden="true" className="size-4" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
