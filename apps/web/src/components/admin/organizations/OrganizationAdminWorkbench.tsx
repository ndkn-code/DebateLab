import Link from "next/link";
import {
  ArrowRight,
  Building2,
  GraduationCap,
  Plus,
  Search,
} from "@/components/ui/icons";
import { Button, buttonVariants } from "@/components/ui/button";
import type {
  OrganizationStatus,
  OrganizationType,
} from "@/lib/organizations/contracts";
import { cn } from "@/lib/utils";

export type OrganizationAdminRow = {
  id: string;
  name: string;
  type: OrganizationType;
  status: OrganizationStatus;
  city?: string | null;
  memberCount: number;
  classCount: number;
};

const copy = {
  en: {
    eyebrow: "Workspace administration",
    title: "Organizations",
    description: "Manage clubs and schools from one operational view.",
    new: "New organization",
    compatibility:
      "Clubs now live in Organizations. Existing links and data remain available during the transition.",
    search: "Search organizations",
    allTypes: "All types",
    club: "Club",
    school: "School",
    allStatuses: "All statuses",
    draft: "Draft",
    active: "Active",
    archived: "Archived",
    apply: "Apply filters",
    empty: "No matching organizations",
    emptyHelp: "Change the filters or create the first organization.",
    members: "people",
    classes: "classes",
    continue: "Continue setup",
    open: "Open workspace",
    loadError: "Organization data could not be loaded right now.",
  },
  vi: {
    eyebrow: "Quản trị không gian",
    title: "Tổ chức",
    description: "Quản lý câu lạc bộ và trường học trong một giao diện.",
    new: "Tạo tổ chức",
    compatibility:
      "Câu lạc bộ hiện nằm trong mục Tổ chức. Liên kết và dữ liệu cũ vẫn hoạt động trong thời gian chuyển đổi.",
    search: "Tìm tổ chức",
    allTypes: "Tất cả loại",
    club: "Câu lạc bộ",
    school: "Trường học",
    allStatuses: "Tất cả trạng thái",
    draft: "Bản nháp",
    active: "Đang hoạt động",
    archived: "Đã lưu trữ",
    apply: "Lọc",
    empty: "Không có tổ chức phù hợp",
    emptyHelp: "Thay đổi bộ lọc hoặc tạo tổ chức đầu tiên.",
    members: "thành viên",
    classes: "lớp",
    continue: "Tiếp tục thiết lập",
    open: "Mở không gian",
    loadError: "Hiện chưa thể tải dữ liệu tổ chức.",
  },
} as const;

export function OrganizationAdminWorkbench({
  locale,
  organizations,
  filters,
  showCompatibilityNotice = false,
  loadError = false,
}: {
  locale: "en" | "vi";
  organizations: OrganizationAdminRow[];
  filters: { query: string; type: string; status: string };
  showCompatibilityNotice?: boolean;
  loadError?: boolean;
}) {
  const t = copy[locale];
  const route = `/${locale}/dashboard/admin/organizations`;

  return (
    <main className="w-full max-w-none space-y-5 p-4 sm:p-6 lg:p-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="type-eyebrow text-primary">{t.eyebrow}</p>
          <h1 className="mt-1 type-heading-xl text-on-surface">{t.title}</h1>
          <p className="mt-2 type-body text-on-surface-variant">
            {t.description}
          </p>
        </div>
        <Link
          href={`${route}/new`}
          className={buttonVariants({ className: "min-h-11 sm:min-h-8" })}
        >
          <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
          {t.new}
        </Link>
      </header>

      {showCompatibilityNotice ? (
        <div
          role="status"
          className="rounded-control border border-primary/25 bg-primary-container px-4 py-3 type-body-sm text-on-surface"
        >
          {t.compatibility}
        </div>
      ) : null}

      {loadError ? (
        <div
          role="alert"
          className="rounded-control border border-error/30 bg-error/5 px-4 py-3 type-label text-on-surface"
        >
          {t.loadError}
        </div>
      ) : null}

      <form
        action={route}
        className="grid gap-2 rounded-[12px] border border-outline-variant bg-surface p-3 sm:grid-cols-[minmax(220px,1fr)_180px_180px_auto]"
      >
        <label className="relative block">
          <span className="sr-only">{t.search}</span>
          <Search
            className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-on-surface-variant"
            aria-hidden="true"
          />
          <input
            name="q"
            defaultValue={filters.query}
            placeholder={t.search}
            className="h-10 w-full rounded-control border border-outline-variant bg-surface pl-9 pr-3 type-body text-on-surface placeholder:text-on-surface-variant focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </label>
        <label>
          <span className="sr-only">{t.allTypes}</span>
          <select
            name="type"
            defaultValue={filters.type}
            className="h-10 w-full rounded-control border border-outline-variant bg-surface px-3 type-body text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="all">{t.allTypes}</option>
            <option value="club">{t.club}</option>
            <option value="school">{t.school}</option>
          </select>
        </label>
        <label>
          <span className="sr-only">{t.allStatuses}</span>
          <select
            name="status"
            defaultValue={filters.status}
            className="h-10 w-full rounded-control border border-outline-variant bg-surface px-3 type-body text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="all">{t.allStatuses}</option>
            <option value="draft">{t.draft}</option>
            <option value="active">{t.active}</option>
            <option value="archived">{t.archived}</option>
          </select>
        </label>
        <Button type="submit" variant="outline" className="min-h-10">
          {t.apply}
        </Button>
      </form>

      {organizations.length === 0 ? (
        <section className="rounded-[12px] border border-outline-variant bg-surface p-8 text-center">
          <Building2 className="mx-auto h-8 w-8 text-on-surface-variant" />
          <h2 className="mt-3 type-title text-on-surface">{t.empty}</h2>
          <p className="mt-1 type-body-sm text-on-surface-variant">
            {t.emptyHelp}
          </p>
        </section>
      ) : (
        <section
          className="overflow-hidden rounded-[12px] border border-outline-variant bg-surface"
          aria-label={t.title}
        >
          <ul className="divide-y divide-outline-variant">
            {organizations.map((organization) => {
              const href =
                organization.status === "draft"
                  ? `${route}/${organization.id}/setup`
                  : `${route}/${organization.id}`;
              return (
                <li key={organization.id}>
                  <Link
                    href={href}
                    className="group flex min-h-16 items-center gap-3 px-3 py-3 outline-none transition-colors hover:bg-surface-container-low focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring motion-reduce:transition-none sm:px-4"
                  >
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-control bg-surface-container text-on-surface-variant">
                      {organization.type === "school" ? (
                        <GraduationCap className="h-5 w-5" aria-hidden="true" />
                      ) : (
                        <Building2 className="h-5 w-5" aria-hidden="true" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="truncate type-label text-on-surface">
                          {organization.name}
                        </span>
                        <StatusBadge
                          status={organization.status}
                          label={t[organization.status]}
                        />
                      </span>
                      <span className="mt-1 block type-caption text-on-surface-variant">
                        {organization.type === "school" ? t.school : t.club}
                        {organization.city ? ` · ${organization.city}` : ""}
                        {` · ${organization.memberCount} ${t.members}`}
                        {` · ${organization.classCount} ${t.classes}`}
                      </span>
                    </span>
                    <span className="hidden type-label text-on-surface-variant sm:inline">
                      {organization.status === "draft" ? t.continue : t.open}
                    </span>
                    <ArrowRight
                      className="h-4 w-4 shrink-0 text-on-surface-variant transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
                      aria-hidden="true"
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </main>
  );
}

function StatusBadge({
  status,
  label,
}: {
  status: OrganizationStatus;
  label: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center rounded-[6px] px-2 type-caption",
        status === "active"
          ? "bg-primary-container text-primary"
          : status === "draft"
            ? "bg-warning-container text-on-warning-container"
            : "bg-surface-container text-on-surface-variant",
      )}
    >
      {label}
    </span>
  );
}
