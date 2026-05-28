"use client";

import {
  useState,
  useSyncExternalStore,
  useTransition,
  type KeyboardEvent,
} from "react";
import { useTheme } from "next-themes";
import { saveThemePreference } from "@/app/actions/theme";
import { useInitialAppTheme } from "@/components/shared/theme-provider";
import { Moon, Sun } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import {
  APP_THEME_COOKIE_MAX_AGE,
  APP_THEME_COOKIE_NAME,
  APP_THEME_STORAGE_KEY,
  coerceAppTheme,
  getOppositeTheme,
  type AppTheme,
} from "@/lib/theme";

type ThemeToggleVariant = "sidebar" | "mobile" | "public";

interface ThemeToggleProps {
  variant?: ThemeToggleVariant;
  collapsed?: boolean;
  className?: string;
}

function writeThemeCookie(theme: AppTheme) {
  document.cookie = `${APP_THEME_COOKIE_NAME}=${theme}; Max-Age=${APP_THEME_COOKIE_MAX_AGE}; Path=/; SameSite=Lax`;
}

function getDocumentTheme(): AppTheme | undefined {
  if (typeof document === "undefined") return undefined;
  if (document.documentElement.classList.contains("dark")) return "dark";
  if (document.documentElement.classList.contains("light")) return "light";
  return undefined;
}

function subscribeToThemeSnapshot() {
  return () => undefined;
}

export function ThemeToggle({
  variant = "sidebar",
  collapsed = false,
  className,
}: ThemeToggleProps) {
  const initialTheme = useInitialAppTheme();
  const { resolvedTheme, theme, setTheme } = useTheme();
  const [optimisticTheme, setOptimisticTheme] = useState<AppTheme | null>(null);
  const [isPending, startTransition] = useTransition();

  const resolvedAppTheme = coerceAppTheme(
    useSyncExternalStore(
      subscribeToThemeSnapshot,
      () => resolvedTheme ?? theme ?? getDocumentTheme() ?? initialTheme,
      () => initialTheme
    ),
    initialTheme
  );
  const currentTheme = optimisticTheme ?? resolvedAppTheme;
  const nextTheme = getOppositeTheme(currentTheme);
  const isDark = currentTheme === "dark";
  const Icon = isDark ? Sun : Moon;
  const label = isDark ? "Switch to Light" : "Switch to Dark";

  const handleToggle = () => {
    if (isPending) return;

    const previousTheme = currentTheme;
    setOptimisticTheme(nextTheme);
    setTheme(nextTheme);

    if (typeof window !== "undefined") {
      window.localStorage.setItem(APP_THEME_STORAGE_KEY, nextTheme);
      writeThemeCookie(nextTheme);
    }

    startTransition(async () => {
      try {
        await saveThemePreference(nextTheme);
        setOptimisticTheme(null);
      } catch {
        setOptimisticTheme(previousTheme);
        setTheme(previousTheme);
        if (typeof window !== "undefined") {
          window.localStorage.setItem(APP_THEME_STORAGE_KEY, previousTheme);
          writeThemeCookie(previousTheme);
        }
      }
    });
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (
      event.key !== "Enter" &&
      event.key !== " " &&
      event.key !== "Spacebar"
    ) {
      return;
    }

    event.preventDefault();
    handleToggle();
  };

  const sharedProps = {
    type: "button" as const,
    role: "switch",
    "aria-checked": isDark,
    "aria-label": label,
    title: collapsed || variant !== "sidebar" ? label : undefined,
    disabled: isPending,
    onClick: handleToggle,
    onKeyDown: handleKeyDown,
    suppressHydrationWarning: true,
  };

  if (variant === "mobile") {
    return (
      <button
        {...sharedProps}
        className={cn(
          "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-sidebar-muted transition-colors hover:bg-white/[0.08] hover:text-sidebar-foreground disabled:opacity-60",
          className
        )}
      >
        <Icon className="h-5 w-5" />
      </button>
    );
  }

  if (variant === "public") {
    return (
      <button
        {...sharedProps}
        className={cn(
          "inline-flex h-10 items-center gap-2 rounded-xl border border-outline-variant/40 bg-surface-container-lowest px-3 text-sm font-semibold text-on-surface transition-colors hover:border-primary/35 hover:bg-surface-container-low",
          className
        )}
      >
        <Icon className="h-4 w-4 text-primary" />
        <span className="hidden sm:inline">{label}</span>
      </button>
    );
  }

  return (
    <button
      {...sharedProps}
      className={cn(
        "flex h-8 w-full items-center gap-3 rounded-lg px-2 text-sm font-medium text-sidebar-muted/85 transition-colors hover:bg-white/[0.08] hover:text-sidebar-foreground disabled:opacity-60",
        collapsed && "justify-center px-0",
        className
      )}
    >
      <Icon className="h-5 w-5 shrink-0" />
      {!collapsed ? <span className="truncate">{label}</span> : null}
    </button>
  );
}
