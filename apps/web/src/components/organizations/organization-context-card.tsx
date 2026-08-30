import Link from "next/link";
import { ArrowRight, GraduationCap, Users } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import type { OrganizationOption } from "./organization-switcher";

const copy = {
  en: {
    club: "Club workspace",
    school: "School workspace",
    clubHint: "Practice, events, and friendly competition.",
    schoolHint: "Classes, assignments, and progress reporting.",
    members: "people",
    archived: "Archived",
    draft: "Setup in progress",
    active: "Active",
  },
  vi: {
    club: "Không gian câu lạc bộ",
    school: "Không gian trường học",
    clubHint: "Luyện tập, sự kiện và thi đấu thân thiện.",
    schoolHint: "Lớp học, bài tập và báo cáo tiến độ.",
    members: "thành viên",
    archived: "Đã lưu trữ",
    draft: "Đang thiết lập",
    active: "Đang hoạt động",
  },
} as const;

export function OrganizationContextCard({
  organization,
  href,
  locale = "en",
  className,
}: {
  organization: OrganizationOption;
  href?: string;
  locale?: "en" | "vi";
  className?: string;
}) {
  const t = copy[locale];
  const isSchool = organization.type === "school";
  const target = href ?? organization.href ?? "#";
  const Icon = isSchool ? GraduationCap : Users;

  return (
    <Link
      href={target}
      className={cn(
        "group block rounded-[12px] border border-outline-variant bg-surface p-4 outline-none transition-colors hover:border-primary/35 hover:bg-surface-container-low focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-primary-container text-primary">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block type-caption text-on-surface-variant">
            {isSchool ? t.school : t.club}
          </span>
          <span className="mt-0.5 block truncate type-title text-on-surface">
            {organization.name}
          </span>
        </span>
        <ArrowRight
          className="mt-1 h-4 w-4 text-on-surface-variant transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
          aria-hidden="true"
        />
      </div>
      <p className="mt-3 type-body-sm text-on-surface-variant">
        {isSchool ? t.schoolHint : t.clubHint}
      </p>
      <div className="mt-3 flex items-center justify-between gap-3 type-caption text-on-surface-variant">
        <span>
          {organization.memberCount ?? 0} {t.members}
        </span>
        <span>{t[organization.status]}</span>
      </div>
    </Link>
  );
}
