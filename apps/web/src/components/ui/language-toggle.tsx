"use client";

import { useLocale } from "next-intl";
import { useRouter, usePathname } from "@/i18n/navigation";
import { useTransition } from "react";
import { cn } from "@/lib/utils";

interface LanguageToggleProps {
  compact?: boolean;
  className?: string;
}

export function LanguageToggle({ compact = false, className }: LanguageToggleProps) {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const toggleLocale = () => {
    const newLocale = locale === "vi" ? "en" : "vi";
    startTransition(() => {
      router.replace(pathname, { locale: newLocale });
    });
  };

  return (
    <button
      onClick={toggleLocale}
      disabled={isPending}
      className={cn(
        "flex items-center gap-1.5 rounded-full border border-gray-200 transition-all hover:border-primary/30 hover:bg-primary/5",
        compact ? "px-2 py-1.5" : "px-3 py-1.5",
        isPending && "opacity-50",
        className
      )}
    >
      {locale === "vi" ? (
        <>
          <span className="text-base leading-none">🇻🇳</span>
          {!compact && <span className="text-sm font-medium text-gray-600">VI</span>}
        </>
      ) : (
        <>
          <span className="text-base leading-none">🇬🇧</span>
          {!compact && <span className="text-sm font-medium text-gray-600">EN</span>}
        </>
      )}
    </button>
  );
}
