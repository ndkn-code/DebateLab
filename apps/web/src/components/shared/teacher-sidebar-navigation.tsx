"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import {
  BookOpen,
  BookOpenText,
  CalendarDays,
  ClipboardList,
  Users,
  ListChecks,
  ChartColumnBig,
  CheckCircle2,
  Megaphone,
  Building2,
  UsersRound,
  BarChart3,
  ChevronDown,
} from "@/components/ui/icons";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import type { TeacherWorkspaceNavigation } from "@/lib/teacher-workspace/presentation";
import {
  activeTeacherNavigationKey,
  teacherClassShortcuts,
  teacherNavigationGroups,
  teacherNavigationHref,
} from "@/lib/teacher-workspace/navigation";
import { routeIsWithin } from "@/lib/workspace-navigation";
import { cn } from "@/lib/utils";

const icons = {
  calendar: CalendarDays,
  classes: Users,
  review_queue: ListChecks,
  assignments: ClipboardList,
  gradebook: ChartColumnBig,
  attendance: CheckCircle2,
  materials: BookOpenText,
  announcements: Megaphone,
  center: Building2,
  organization: Building2,
  people: UsersRound,
  curriculum: BookOpen,
  reports: BarChart3,
};

const RECENT_CLASSES_EVENT = "thinkfy:recent-teacher-classes";
function subscribeRecentClasses(notify: () => void) {
  window.addEventListener(RECENT_CLASSES_EVENT, notify);
  return () => window.removeEventListener(RECENT_CLASSES_EVENT, notify);
}
function readRecentClasses(key: string) {
  try {
    return sessionStorage.getItem(key) ?? "[]";
  } catch {
    return "[]";
  }
}
function parseRecentClasses(value: string): string[] {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

/** Partial fork of Lumist ManagerSidebarNav: filtered groups and exclusive class selection.
 * See docs/teacher-navigation/design-and-provenance.md. Shared by desktop and mobile.
 */
export function TeacherSidebarNavigation({
  navigation,
  onNavigate,
  userId,
}: {
  userId?: string;
  navigation?: TeacherWorkspaceNavigation;
  onNavigate?: () => void;
}) {
  const t = useTranslations("dashboard.nav");
  const pathname = usePathname();
  const search = useSearchParams();
  const router = useRouter();
  const classes = navigation?.classes ?? [];
  const currentClass = classes.find((item) =>
    routeIsWithin(pathname, `/dashboard/teacher/classes/${item.id}`),
  );
  const recentKey = `thinkfy:recent-teacher-classes:${userId ?? "anonymous"}`;
  const recent = useSyncExternalStore(
    subscribeRecentClasses,
    () => readRecentClasses(recentKey),
    () => "[]",
  );
  useEffect(() => {
    if (!currentClass) return;
    const ids = [
      currentClass.id,
      ...parseRecentClasses(readRecentClasses(recentKey)).filter(
        (id) => id !== currentClass.id,
      ),
    ].slice(0, 10);
    try {
      sessionStorage.setItem(recentKey, JSON.stringify(ids));
      window.dispatchEvent(new Event(RECENT_CLASSES_EVENT));
    } catch {
      /* Optional browser history. */
    }
  }, [currentClass, recentKey]);
  const shortcuts = teacherClassShortcuts(
    classes,
    parseRecentClasses(recent),
    currentClass?.id,
  );
  if (navigation?.loadError)
    return (
      <div className="px-2 py-3 type-label text-on-surface-variant">
        <p>{t("navigationUnavailable")}</p>
        <Button
          variant="outline"
          className="mt-2"
          onClick={() => router.refresh()}
        >
          {t("retryNavigation")}
        </Button>
      </div>
    );
  if (!navigation?.canAccess)
    return (
      <p className="px-2 py-3 type-label text-on-surface-variant">
        {t("noTeachingAccess")}
      </p>
    );

  const activeKey = activeTeacherNavigationKey(pathname, navigation.items);
  const makeHref = (href: string) =>
    teacherNavigationHref(href, new URLSearchParams(search.toString()));
  const rowClass = (active: boolean) =>
    cn(
      "flex min-h-10 min-w-0 items-center gap-2 rounded-md px-2 py-2 type-label focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
      active
        ? "bg-surface-container-high text-on-surface font-semibold"
        : "text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface",
    );

  return (
    <div className="space-y-4" data-teacher-navigation="true">
      {teacherNavigationGroups(navigation.items).map((group) => (
        <section
          key={group.key}
          aria-label={t(`teacherGroups.${group.key}`)}
          className="space-y-1"
        >
          <p className="px-2 type-caption text-on-surface-variant">
            {t(`teacherGroups.${group.key}`)}
          </p>
          {group.items.map((item) => {
            const Icon = icons[item.key];
            const active =
              activeKey === item.key &&
              !(item.key === "classes" && currentClass);
            return (
              <div key={item.key}>
                <Link
                  href={makeHref(item.href)}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={rowClass(active)}
                >
                  <Icon className="size-5 shrink-0" aria-hidden="true" />
                  <span className="min-w-0 flex-1 break-words">
                    {t(`teacherLinks.${item.key}`)}
                  </span>
                  {!!item.badge && (
                    <span className="rounded-sm bg-surface-container-high px-1.5 type-caption text-on-surface">
                      {item.badge}
                    </span>
                  )}
                </Link>
                {item.key === "classes" && shortcuts.length > 0 && (
                  <div
                    className="ml-4 border-l border-outline-variant pl-2"
                    aria-label={t("classShortcuts")}
                  >
                    {shortcuts.map((classItem) => (
                      <Link
                        key={classItem.id}
                        href={makeHref(
                          `/dashboard/teacher/classes/${classItem.id}`,
                        )}
                        onClick={onNavigate}
                        aria-current={
                          currentClass?.id === classItem.id ? "page" : undefined
                        }
                        className={rowClass(currentClass?.id === classItem.id)}
                      >
                        <span className="min-w-0 break-words">
                          {classItem.title}
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </section>
      ))}
    </div>
  );
}

export function TeacherOrganizationContext({
  navigation,
  onNavigate,
}: {
  navigation?: TeacherWorkspaceNavigation;
  onNavigate?: () => void;
}) {
  const t = useTranslations("dashboard.nav");
  const pathname = usePathname();
  const search = useSearchParams();
  const organizations = navigation?.organizations ?? [];
  const activeClass = navigation?.classes?.find((item) =>
    routeIsWithin(pathname, `/dashboard/teacher/classes/${item.id}`),
  );
  const selected =
    organizations.find(
      (org) =>
        org.id === (activeClass?.organizationId ?? search.get("organization")),
    ) ?? (organizations.length === 1 ? organizations[0] : undefined);
  const context = selected ? (
    <>
      <span className="block break-words type-label text-on-surface">
        {selected.name || t("teacherGroups.management")}
      </span>
      <span className="block type-caption text-on-surface-variant">
        {t(`organizationRoles.${selected.role}`)}
      </span>
    </>
  ) : (
    <span className="type-label">{t("chooseCenter")}</span>
  );
  if (!organizations.length)
    return navigation?.isAdminPreview ? (
      <p className="px-2 py-2 type-caption text-on-surface-variant">
        {t("adminTeachingPreview")}
      </p>
    ) : null;
  if (organizations.length === 1)
    return <div className="px-2 py-2">{context}</div>;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex min-h-10 w-full min-w-0 items-center gap-2 rounded-md px-2 py-2 text-left text-on-surface focus-visible:ring-2 focus-visible:ring-ring">
        <Building2 className="size-4 shrink-0" aria-hidden="true" />
        <span className="min-w-0 flex-1">{context}</span>
        <ChevronDown className="size-4 shrink-0" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="min-w-52 bg-surface text-on-surface">
        {organizations.map((org) => (
          <DropdownMenuItem
            key={org.id}
            render={
              <Link
                href={
                  navigation?.items.some((item) => item.key === "center")
                    ? `/dashboard/teacher/center?organization=${encodeURIComponent(org.id)}`
                    : `/organizations/${org.id}`
                }
                onClick={onNavigate}
              />
            }
            className="min-h-10 type-label"
          >
            <span>
              {org.name || t("teacherGroups.management")}
              <span className="block type-caption text-on-surface-variant">
                {t(`organizationRoles.${org.role}`)}
              </span>
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
