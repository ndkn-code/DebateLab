"use client";

import { useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

import { saveDebateModePreference } from "@/app/[locale]/(protected)/settings/actions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Check,
  ChevronDown,
  Languages,
  Loader2,
} from "@/components/ui/icons";
import { showToast } from "@/components/shared/toast";
import { usePathname, useRouter } from "@/i18n/navigation";
import {
  buildLocaleSwitchPath,
  coerceAppLocale,
  type AppLocale,
} from "@/lib/locale-switch";
import { cn } from "@/lib/utils";

interface DebateModeSwitcherProps {
  variant: "sidebar" | "mobile";
  currentLocale: AppLocale;
}

const MODE_OPTIONS: AppLocale[] = ["vi", "en"];

export function DebateModeSwitcher({
  variant,
  currentLocale,
}: DebateModeSwitcherProps) {
  const t = useTranslations("dashboard.nav");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const resolvedLocale = coerceAppLocale(currentLocale);
  const selectedLabel = t(
    resolvedLocale === "vi" ? "vietnamese_debate" : "english_debate"
  );

  const handleSelect = (nextLocale: AppLocale) => {
    if (nextLocale === resolvedLocale || isPending) {
      return;
    }

    startTransition(() => {
      void (async () => {
        try {
          await saveDebateModePreference(nextLocale);
          const nextPath = buildLocaleSwitchPath(
            pathname,
            new URLSearchParams(searchParams.toString())
          );

          router.replace(nextPath, { locale: nextLocale });
          router.refresh();
        } catch {
          showToast(t("debate_mode_save_error"), "error");
        }
      })();
    });
  };

  const isSidebar = variant === "sidebar";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t("debate_mode")}
        className={cn(
          "group flex min-w-0 items-center justify-between gap-2 rounded-lg border text-left font-semibold outline-none transition-colors focus-visible:ring-3 focus-visible:ring-sidebar-muted/35",
          isSidebar
            ? "h-10 w-full border-white/10 bg-white/[0.08] px-3 text-sm text-sidebar-foreground hover:bg-white/[0.12]"
            : "h-10 flex-1 border-white/10 bg-white/[0.08] px-2.5 text-[13px] text-sidebar-foreground hover:bg-white/[0.12]"
        )}
      >
        <span className="flex min-w-0 items-center gap-2">
          <Languages
            className={cn(
              "shrink-0 text-sidebar-muted",
              isSidebar ? "h-4.5 w-4.5" : "h-4 w-4"
            )}
          />
          <span className="min-w-0 truncate">
            {isPending ? t("switching_debate_mode") : selectedLabel}
          </span>
        </span>
        {isPending ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-sidebar-muted" />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-sidebar-muted transition-transform group-data-[popup-open]:rotate-180" />
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        sideOffset={8}
        className="w-(--anchor-width) min-w-[210px] rounded-xl border border-outline-variant bg-white p-1.5 text-on-surface shadow-[0_22px_60px_-34px_rgba(11,20,36,0.42)]"
      >
        {MODE_OPTIONS.map((locale) => {
          const isSelected = locale === resolvedLocale;
          const label = t(
            locale === "vi" ? "vietnamese_debate" : "english_debate"
          );

          return (
            <DropdownMenuItem
              key={locale}
              onClick={() => handleSelect(locale)}
              className={cn(
                "flex h-10 cursor-pointer items-center justify-between gap-3 rounded-lg px-3 text-sm font-semibold focus:bg-primary/[0.08]",
                isSelected
                  ? "bg-surface-container-low text-on-surface"
                  : "text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface"
              )}
            >
              <span className="truncate">{label}</span>
              {isSelected ? (
                <Check className="h-4 w-4 shrink-0 text-primary" />
              ) : null}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
