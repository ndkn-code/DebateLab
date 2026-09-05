"use client";

import { useLocale } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useRouter, usePathname } from "@/i18n/navigation";
import { useTransition } from "react";
import { cn } from "@/lib/utils";
import { buildLocaleSwitchPath } from "@/lib/locale-switch";

interface LanguageToggleProps {
  compact?: boolean;
  className?: string;
}

export function LanguageToggle({ compact = false, className }: LanguageToggleProps) {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const toggleLocale = () => {
    const newLocale = locale === "vi" ? "en" : "vi";
    startTransition(() => {
      router.replace(
        buildLocaleSwitchPath(
          `${pathname}${window.location.hash}`,
          new URLSearchParams(searchParams.toString()),
        ),
        { locale: newLocale },
      );
    });
  };

  const languageLabel = locale === "vi" ? "Tiếng Việt" : "English";

  return (
    <button
      type="button"
      onClick={toggleLocale}
      disabled={isPending}
      aria-label={languageLabel}
      className={cn(
        "inline-flex h-10 min-w-0 items-center gap-1.5 rounded-control border border-outline-variant bg-surface px-3 type-label text-on-surface transition-colors hover:border-primary hover:bg-surface-container-low focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-60",
        compact ? "px-2.5" : "px-3",
        className,
      )}
    >
      <span className="min-w-0 truncate">{languageLabel}</span>
    </button>
  );
}
