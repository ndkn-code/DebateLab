import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  Building2,
  CalendarDays,
  Users,
} from "@/components/ui/icons";
import { buttonVariants } from "@/components/ui/button";
import { OrganizationContextCard } from "./organization-context-card";
import {
  OrganizationSwitcher,
  type OrganizationOption,
} from "./organization-switcher";

export type OrganizationOverviewState = "ready" | "loading" | "error" | "empty";

const copy = {
  en: {
    title: "Organization overview",
    loading: "Loading organization…",
    error: "We couldn’t load this organization.",
    empty: "This organization is unavailable.",
    emptyHelp:
      "It may have been archived, or your role may not allow access. No organization data was shown.",
    back: "Back to organizations",
    people: "People",
    classes: "Classes",
    upcoming: "Upcoming",
    reviews: "Needs review",
    setup: "Organization setup",
    setupHelp: "Update identity, people, first class, and activation state.",
    continueSetup: "Continue setup",
    legacy: "Legacy operations",
    legacyHelp: "Open the existing club operations view during the transition.",
    openLegacy: "Open operations",
    other: "Other organizations",
    club: "Club",
    school: "School",
    draft: "Draft",
    active: "Active",
    archived: "Archived",
    owner: "Owner",
    admin: "Admin",
    teacher: "Teacher",
    student: "Student",
  },
  vi: {
    title: "Tổng quan tổ chức",
    loading: "Đang tải tổ chức…",
    error: "Không thể tải tổ chức này.",
    empty: "Tổ chức này không khả dụng.",
    emptyHelp:
      "Tổ chức có thể đã được lưu trữ hoặc vai trò của bạn không có quyền truy cập. Không có dữ liệu tổ chức nào được hiển thị.",
    back: "Quay lại danh sách tổ chức",
    people: "Thành viên",
    classes: "Lớp học",
    upcoming: "Sắp tới",
    reviews: "Cần xem lại",
    setup: "Thiết lập tổ chức",
    setupHelp:
      "Cập nhật nhận diện, thành viên, lớp đầu tiên và trạng thái kích hoạt.",
    continueSetup: "Tiếp tục thiết lập",
    legacy: "Vận hành hiện tại",
    legacyHelp:
      "Mở giao diện vận hành câu lạc bộ hiện có trong thời gian chuyển đổi.",
    openLegacy: "Mở vận hành",
    other: "Tổ chức khác",
    club: "Câu lạc bộ",
    school: "Trường học",
    draft: "Bản nháp",
    active: "Đang hoạt động",
    archived: "Đã lưu trữ",
    owner: "Chủ sở hữu",
    admin: "Quản trị viên",
    teacher: "Giáo viên",
    student: "Học viên",
  },
} as const;

export function OrganizationOverview({
  organization,
  relatedOrganizations = [],
  stats,
  state = "ready",
  locale = "en",
  setupHref,
  legacyHref,
}: {
  organization?: OrganizationOption;
  relatedOrganizations?: OrganizationOption[];
  stats?: {
    people: number;
    classes: number;
    upcoming: number;
    reviews: number;
  };
  state?: OrganizationOverviewState;
  locale?: "en" | "vi";
  setupHref?: string;
  legacyHref?: string;
}) {
  const t = copy[locale];
  const listHref = `/${locale}/dashboard/admin/organizations`;

  if (state === "loading") {
    return (
      <main
        className="w-full max-w-none space-y-5 p-4 sm:p-6 lg:p-8"
        aria-busy="true"
        aria-label={t.loading}
      >
        <div className="h-8 w-48 animate-pulse rounded-[8px] bg-surface-container motion-reduce:animate-none" />
        <div className="h-28 animate-pulse rounded-[12px] border border-outline-variant bg-surface motion-reduce:animate-none" />
      </main>
    );
  }

  if (state === "error") {
    return (
      <main className="mx-auto w-full max-w-2xl p-4 sm:p-8">
        <section
          role="alert"
          className="rounded-[12px] border border-error/30 bg-error/5 p-6"
        >
          <AlertCircle className="h-5 w-5 text-error" aria-hidden="true" />
          <h1 className="mt-3 type-title text-on-surface">{t.error}</h1>
          <Link
            href={listHref}
            className={buttonVariants({
              variant: "outline",
              className: "mt-5",
            })}
          >
            {t.back}
          </Link>
        </section>
      </main>
    );
  }

  if (state === "empty" || !organization) {
    return (
      <main className="mx-auto w-full max-w-2xl p-4 sm:p-8">
        <section className="rounded-[12px] border border-outline-variant bg-surface p-8 text-center">
          <Building2 className="mx-auto h-7 w-7 text-on-surface-variant" />
          <h1 className="mt-3 type-title text-on-surface">{t.empty}</h1>
          <p className="mt-2 type-body-sm text-on-surface-variant">
            {t.emptyHelp}
          </p>
          <Link
            href={listHref}
            className={buttonVariants({
              variant: "outline",
              className: "mt-5",
            })}
          >
            {t.back}
          </Link>
        </section>
      </main>
    );
  }

  const visibleRelated = relatedOrganizations.filter(
    (item) => item.id !== organization.id,
  );
  const typeLabel = organization.type === "school" ? t.school : t.club;

  return (
    <main className="w-full max-w-none space-y-5 p-4 sm:p-6 lg:p-8">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="type-eyebrow text-primary">{t.title}</p>
          <h1 className="mt-1 type-page-title text-on-surface">
            {organization.name}
          </h1>
          <p className="mt-2 type-body-sm text-on-surface-variant">
            {typeLabel} · {t[organization.status]}
            {organization.role ? ` · ${t[organization.role]}` : ""}
          </p>
        </div>
        <OrganizationSwitcher
          current={organization}
          organizations={relatedOrganizations}
          locale={locale}
          className="w-full lg:w-80"
        />
      </header>

      <section
        className="grid overflow-hidden rounded-[12px] border border-outline-variant bg-surface sm:grid-cols-2 xl:grid-cols-4"
        aria-label={t.title}
      >
        <Metric icon={Users} label={t.people} value={stats?.people ?? 0} />
        <Metric icon={BookOpen} label={t.classes} value={stats?.classes ?? 0} />
        <Metric
          icon={CalendarDays}
          label={t.upcoming}
          value={stats?.upcoming ?? 0}
        />
        <Metric
          icon={AlertCircle}
          label={t.reviews}
          value={stats?.reviews ?? 0}
        />
      </section>

      <section className="grid gap-3 lg:grid-cols-2">
        {setupHref ? (
          <ActionCard
            icon={Building2}
            title={t.setup}
            description={t.setupHelp}
            label={t.continueSetup}
            href={setupHref}
          />
        ) : null}
        {legacyHref ? (
          <ActionCard
            icon={BookOpen}
            title={t.legacy}
            description={t.legacyHelp}
            label={t.openLegacy}
            href={legacyHref}
          />
        ) : null}
      </section>

      {visibleRelated.length > 0 ? (
        <section>
          <h2 className="type-title text-on-surface">{t.other}</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {visibleRelated.map((item) => (
              <OrganizationContextCard
                key={item.id}
                organization={item}
                locale={locale}
              />
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users;
  label: string;
  value: number;
}) {
  return (
    <div className="border-b border-outline-variant p-4 last:border-b-0 sm:[&:nth-child(odd)]:border-r xl:border-b-0 xl:border-r xl:last:border-r-0">
      <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
      <p className="mt-3 type-caption text-on-surface-variant">{label}</p>
      <p className="mt-1 type-title tabular-nums text-on-surface">{value}</p>
    </div>
  );
}

function ActionCard({
  icon: Icon,
  title,
  description,
  label,
  href,
}: {
  icon: typeof Building2;
  title: string;
  description: string;
  label: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-[12px] border border-outline-variant bg-surface p-4 outline-none transition-colors hover:bg-surface-container-low focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
    >
      <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
      <h2 className="mt-4 type-title text-on-surface">{title}</h2>
      <p className="mt-1 type-body-sm text-on-surface-variant">{description}</p>
      <span className="mt-4 inline-flex items-center type-label text-primary">
        {label}
        <ArrowRight
          className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
          aria-hidden="true"
        />
      </span>
    </Link>
  );
}
