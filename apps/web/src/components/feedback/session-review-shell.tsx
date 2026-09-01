"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { FileText, GitBranch, LayoutDashboard, Trophy } from "@/components/ui/icons";
import type { LucideIcon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

export type SessionReviewTab = "overall" | "verdict" | "transcript" | "clash";

interface SessionReviewShellProps {
  overall: React.ReactNode;
  verdict?: React.ReactNode;
  transcript: React.ReactNode;
  clashMap?: React.ReactNode;
  initialTab?: SessionReviewTab;
  className?: string;
}

const tabs: Array<{
  id: SessionReviewTab;
  icon: LucideIcon;
}> = [
  { id: "overall", icon: LayoutDashboard },
  { id: "verdict", icon: Trophy },
  { id: "transcript", icon: FileText },
  { id: "clash", icon: GitBranch },
];

export function SessionReviewShell({
  overall,
  verdict,
  transcript,
  clashMap,
  initialTab = "overall",
  className,
}: SessionReviewShellProps) {
  const t = useTranslations("sessionResult.tabs");
  const [activeTab, setActiveTab] = useState<SessionReviewTab>(initialTab);
  const availableTabs = tabs.filter((tab) => {
    if (tab.id === "verdict") return verdict;
    if (tab.id === "clash") return clashMap;
    return true;
  });
  const resolvedActiveTab =
    (activeTab === "clash" && !clashMap) ||
    (activeTab === "verdict" && !verdict)
      ? "overall"
      : activeTab;

  return (
    <div
      className={cn(
        "mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8",
        className
      )}
    >
      <div className="grid min-w-0 gap-5 lg:grid-cols-[178px_minmax(0,1fr)]">
        <aside className="min-w-0 lg:sticky lg:top-5 lg:self-start lg:pt-[72px]">
          <nav
            aria-label={t("sections")}
            className="flex w-full min-w-0 max-w-full gap-1.5 overflow-x-auto rounded-control border border-outline-variant bg-surface p-1.5 shadow-none lg:flex-col lg:overflow-visible"
          >
            {availableTabs.map(({ id, icon: Icon }) => {
              const isActive = resolvedActiveTab === id;

              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActiveTab(id)}
                  className={cn(
                    "flex min-h-10 min-w-[132px] items-center gap-2 rounded-[7px] px-3 text-sm font-medium transition lg:min-w-0 focus-visible:ring-2 focus-visible:ring-ring",
                    isActive
                      ? "bg-success-container text-on-surface"
                      : "bg-surface text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
                  )}
                  aria-current={isActive ? "page" : undefined}
                >
                  <Icon
                    className={cn(
                      "h-4 w-4",
                      isActive ? "text-primary" : "text-on-surface-variant"
                    )}
                  />
                  {t(id)}
                </button>
              );
            })}
          </nav>
        </aside>

        <main className="min-w-0">
          {resolvedActiveTab === "overall"
            ? overall
            : resolvedActiveTab === "verdict"
              ? verdict
            : resolvedActiveTab === "clash"
              ? clashMap
              : transcript}
        </main>
      </div>
    </div>
  );
}
