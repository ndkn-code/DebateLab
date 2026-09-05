"use client";

import { useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

import { saveDebateModePreference } from "@/app/[locale]/(protected)/settings/actions";
import { saveSubjectPreference } from "@/app/actions/subject";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Check,
  ChevronDown,
  GraduationCap,
  Loader2,
} from "@/components/ui/icons";
import { showToast } from "@/components/shared/toast";
import { usePathname, useRouter } from "@/i18n/navigation";
import {
  buildLocaleSwitchPath,
  coerceAppLocale,
  type AppLocale,
} from "@/lib/locale-switch";
import { coerceSubject, getSubjectConfig, type Subject } from "@/lib/subject";
import { availableSubjects } from "@/lib/features";
import { cn } from "@/lib/utils";

interface ModeSwitcherProps {
  variant: "sidebar" | "mobile";
  currentLocale: AppLocale;
  currentSubject: Subject;
  /**
   * Whether to offer the IELTS subject. Defaults to the launch flag; the
   * sidebar passes `IELTS_ENABLED || isAdmin` so admins can preview IELTS in
   * production before launch. UI affordance only — the server gates
   * (`getActiveSubject` + the `/ielts` layout) enforce real access.
   */
  ieltsAvailable?: boolean;
}

const LOCALE_OPTIONS: AppLocale[] = ["vi", "en"];

// Language endonyms — shown in their own language regardless of UI locale.
const LOCALE_LABELS: Record<AppLocale, string> = {
  vi: "Tiếng Việt",
  en: "English",
};

/**
 * Unified mode switcher (WS-0.2). Presents the two orthogonal axes as separate
 * groups: Subject (Debate | IELTS) and Language (Tiếng Việt | English).
 *
 * - Subject change → `saveSubjectPreference` (cookie + profile) then lands on the
 *   subject's primary surface (the engine/courses for IELTS, the home for debate).
 * - Language change → existing `saveDebateModePreference` + next-intl locale swap.
 */
export function ModeSwitcher({
  variant,
  currentLocale,
  currentSubject,
  ieltsAvailable,
}: ModeSwitcherProps) {
  const t = useTranslations("dashboard.nav");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const resolvedLocale = coerceAppLocale(currentLocale);
  const resolvedSubject = coerceSubject(currentSubject);
  // Subjects the learner may switch to. When IELTS is not launched this is just
  // `["debate"]`, so the subject group is hidden and debate is unchanged — but
  // an admin (`ieltsAvailable`) gets the IELTS option for production preview.
  const subjects: Subject[] = ieltsAvailable
    ? ["debate", "ielts"]
    : availableSubjects();
  const subjectConfig = getSubjectConfig(resolvedSubject);
  const subjectLabel =
    resolvedLocale === "vi" ? subjectConfig.labelVi : subjectConfig.label;

  const subjectLabelFor = (subject: Subject) => {
    const config = getSubjectConfig(subject);
    return resolvedLocale === "vi" ? config.labelVi : config.label;
  };

  const handleSelectSubject = (nextSubject: Subject) => {
    if (nextSubject === resolvedSubject || isPending) {
      return;
    }

    startTransition(() => {
      return (async () => {
        try {
          await saveSubjectPreference(nextSubject);
          // Land on the subject's primary surface: the IELTS learner home for
          // IELTS, the debate dashboard otherwise.
          router.push(nextSubject === "ielts" ? "/ielts/home" : "/dashboard");
          router.refresh();
        } catch {
          showToast(t("switch_subject_error"), "error");
        }
      })();
    });
  };

  const handleSelectLocale = (nextLocale: AppLocale) => {
    if (nextLocale === resolvedLocale || isPending) {
      return;
    }

    startTransition(() => {
      return (async () => {
        try {
          await saveDebateModePreference(nextLocale);
          const nextPath = buildLocaleSwitchPath(
            `${pathname}${window.location.hash}`,
            new URLSearchParams(searchParams.toString()),
          );

          router.replace(nextPath, { locale: nextLocale });
          router.refresh();
        } catch {
          showToast(t("switch_language_error"), "error");
        }
      })();
    });
  };

  const isSidebar = variant === "sidebar";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t("mode_switcher")}
        disabled={isPending}
        className={cn(
          "group flex min-w-0 items-center justify-between gap-2 rounded-control border text-left type-label outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary",
          isSidebar
            ? "min-h-12 w-full border-sidebar-muted bg-sidebar-soft px-3 text-sidebar-foreground hover:bg-surface-container"
            : "min-h-12 min-w-0 flex-1 border-sidebar-muted bg-sidebar-soft px-2.5 text-sidebar-foreground hover:bg-surface-container",
        )}
      >
        <span className="flex min-w-0 items-center gap-2">
          <GraduationCap
            className={cn("shrink-0 text-sidebar-muted", "size-4")}
          />
          <span className="min-w-0">
            <span className="block type-label">
              {isPending ? t("switching_mode") : LOCALE_LABELS[resolvedLocale]}
            </span>
            {subjects.length > 1 && (
              <span className="block type-caption text-on-surface-variant">
                {t("subject")}: {subjectLabel}
              </span>
            )}
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
        className="w-(--anchor-width) min-w-52 rounded-lg border border-outline-variant bg-surface p-1.5 text-on-surface shadow-token-card"
      >
        {subjects.length > 1 ? (
          <>
            <DropdownMenuGroup>
              <DropdownMenuLabel className="px-3 pb-1 pt-1.5 type-caption font-semibold uppercase text-on-surface-variant">
                {t("subject")}
              </DropdownMenuLabel>
              {subjects.map((subject) => {
                const isSelected = subject === resolvedSubject;

                return (
                  <DropdownMenuItem
                    key={subject}
                    disabled={isPending}
                    onClick={() => handleSelectSubject(subject)}
                    className={cn(
                      "flex h-10 cursor-pointer items-center justify-between gap-3 rounded-control px-3 type-label font-semibold focus:bg-primary-container",
                      isSelected
                        ? "bg-surface-container-low text-on-surface"
                        : "text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface",
                    )}
                  >
                    <span className="truncate">{subjectLabelFor(subject)}</span>
                    {isSelected ? (
                      <Check className="h-4 w-4 shrink-0 text-primary" />
                    ) : null}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuGroup>

            <DropdownMenuSeparator className="bg-outline-variant" />
          </>
        ) : null}

        <DropdownMenuGroup>
          <DropdownMenuLabel className="px-3 pb-1 pt-1.5 type-caption font-semibold uppercase text-on-surface-variant">
            {t("language")}
          </DropdownMenuLabel>
          {LOCALE_OPTIONS.map((locale) => {
            const isSelected = locale === resolvedLocale;

            return (
              <DropdownMenuItem
                key={locale}
                disabled={isPending}
                onClick={() => handleSelectLocale(locale)}
                className={cn(
                  "flex h-10 cursor-pointer items-center justify-between gap-3 rounded-control px-3 type-label font-semibold focus:bg-primary-container",
                  isSelected
                    ? "bg-surface-container-low text-on-surface"
                    : "text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface",
                )}
              >
                <span className="truncate">{LOCALE_LABELS[locale]}</span>
                {isSelected ? (
                  <Check className="h-4 w-4 shrink-0 text-primary" />
                ) : null}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
