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
            className="flex w-full min-w-0 max-w-full gap-2 overflow-x-auto rounded-2xl border border-[#DEE8F8] bg-white p-2 shadow-[0_18px_45px_rgba(16,32,72,0.035)] lg:flex-col lg:overflow-visible"
          >
            {availableTabs.map(({ id, icon: Icon }) => {
              const isActive = resolvedActiveTab === id;

              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActiveTab(id)}
                  className={cn(
                    "flex min-h-[48px] min-w-[132px] items-center gap-3 rounded-xl px-3 text-sm font-bold transition lg:min-w-0",
                    isActive
                      ? "bg-[#EAF1FF] text-[#3E78EC]"
                      : "bg-white text-[#415069] hover:bg-[#F7FAFE] hover:text-[#0B1424]"
                  )}
                  aria-current={isActive ? "page" : undefined}
                >
                  <Icon
                    className={cn(
                      "h-4 w-4",
                      isActive ? "text-[#4D86F7]" : "text-[#718096]"
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
