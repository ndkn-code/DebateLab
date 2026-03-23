"use client";

import { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Plus, Search, MoreHorizontal, Copy, Archive, Trash2, Eye, EyeOff } from "lucide-react";
import { archiveCourse, deleteCourse, duplicateCourse, togglePublish } from "@/app/actions/courses";
import type { AdminCourse, CourseVisibility } from "@/lib/types/admin";

interface Props {
  initialCourses: AdminCourse[];
}

export function CourseTable({ initialCourses }: Props) {
  const t = useTranslations("admin.courses");
  const router = useRouter();
  const [courses, setCourses] = useState(initialCourses);
  const [search, setSearch] = useState("");
  const [visFilter, setVisFilter] = useState<CourseVisibility | "all">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "published" | "draft" | "archived">("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return courses.filter((c) => {
      if (search && !c.title.toLowerCase().includes(search.toLowerCase())) return false;
      if (visFilter !== "all" && c.visibility !== visFilter) return false;
      if (statusFilter === "published" && !c.is_published) return false;
      if (statusFilter === "draft" && (c.is_published || c.is_archived)) return false;
      if (statusFilter === "archived" && !c.is_archived) return false;
      return true;
    });
  }, [courses, search, visFilter, statusFilter]);

  const visBadge = (v: string) => {
    const colors: Record<string, string> = {
      public: "bg-blue-100 text-blue-700",
      premium: "bg-amber-100 text-amber-700",
      class_restricted: "bg-purple-100 text-purple-700",
    };
    return colors[v] ?? "bg-gray-100 text-gray-700";
  };

  const statusBadge = (c: AdminCourse) => {
    if (c.is_archived) return "bg-red-100 text-red-700";
    if (c.is_published) return "bg-green-100 text-green-700";
    return "bg-gray-100 text-gray-700";
  };

  const statusLabel = (c: AdminCourse) => {
    if (c.is_archived) return t("archived");
    if (c.is_published) return t("published");
    return t("draft");
  };

  async function handleAction(action: string, courseId: string) {
    setMenuOpen(null);
    try {
      if (action === "duplicate") {
        await duplicateCourse(courseId);
      } else if (action === "archive") {
        await archiveCourse(courseId);
      } else if (action === "delete") {
        if (!confirm(t("confirmDelete"))) return;
        await deleteCourse(courseId);
      } else if (action === "togglePublish") {
        await togglePublish(courseId);
      }
      router.refresh();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error");
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-on-surface">{t("title")}</h1>
        <button
          onClick={() => router.push("/dashboard/admin/courses/new")}
          className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-on-primary hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          {t("newCourse")}
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-on-surface-variant" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="w-full rounded-xl border border-outline-variant/20 bg-surface-container-lowest pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <select
          value={visFilter}
          onChange={(e) => setVisFilter(e.target.value as CourseVisibility | "all")}
          className="rounded-xl border border-outline-variant/20 bg-surface-container-lowest px-3 py-2.5 text-sm"
        >
          <option value="all">{t("filterVisibility")}: {t("all")}</option>
          <option value="public">{t("public")}</option>
          <option value="premium">{t("premium")}</option>
          <option value="class_restricted">{t("classRestricted")}</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as "all" | "published" | "draft" | "archived")}
          className="rounded-xl border border-outline-variant/20 bg-surface-container-lowest px-3 py-2.5 text-sm"
        >
          <option value="all">{t("filterStatus")}: {t("all")}</option>
          <option value="published">{t("published")}</option>
          <option value="draft">{t("draft")}</option>
          <option value="archived">{t("archived")}</option>
        </select>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-on-surface-variant">
          <p className="text-sm">{t("noCoursesYet")}</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-outline-variant/10 bg-surface-container-lowest overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-outline-variant/10 bg-surface-container">
                <th className="text-left px-4 py-3 font-medium text-on-surface-variant">{t("title")}</th>
                <th className="text-left px-4 py-3 font-medium text-on-surface-variant hidden sm:table-cell">{t("filterVisibility")}</th>
                <th className="text-left px-4 py-3 font-medium text-on-surface-variant hidden md:table-cell">{t("modules")}</th>
                <th className="text-left px-4 py-3 font-medium text-on-surface-variant hidden md:table-cell">{t("enrolled")}</th>
                <th className="text-left px-4 py-3 font-medium text-on-surface-variant">{t("filterStatus")}</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr
                  key={c.id}
                  className="border-b border-outline-variant/5 hover:bg-surface-container/50 cursor-pointer transition-colors"
                  onClick={() => router.push(`/dashboard/admin/courses/${c.id}`)}
                >
                  <td className="px-4 py-3 font-medium text-on-surface">{c.title}</td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${visBadge(c.visibility)}`}>
                      {t(c.visibility === "class_restricted" ? "classRestricted" : c.visibility)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-on-surface-variant hidden md:table-cell">—</td>
                  <td className="px-4 py-3 text-on-surface-variant hidden md:table-cell">{(c.enrollment_count ?? 0).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge(c)}`}>
                      {statusLabel(c)}
                    </span>
                  </td>
                  <td className="px-4 py-3 relative" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => setMenuOpen(menuOpen === c.id ? null : c.id)}
                      className="p-1 rounded-lg hover:bg-surface-container"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                    {menuOpen === c.id && (
                      <div className="absolute right-4 top-10 z-20 w-48 rounded-xl border border-outline-variant/20 bg-surface-container-lowest shadow-lg py-1">
                        <button onClick={() => handleAction("togglePublish", c.id)} className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-surface-container text-left">
                          {c.is_published ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          {c.is_published ? t("unpublish") : t("publish")}
                        </button>
                        <button onClick={() => handleAction("duplicate", c.id)} className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-surface-container text-left">
                          <Copy className="h-4 w-4" />{t("duplicateCourse")}
                        </button>
                        <button onClick={() => handleAction("archive", c.id)} className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-surface-container text-left">
                          <Archive className="h-4 w-4" />{t("archiveCourse")}
                        </button>
                        <button onClick={() => handleAction("delete", c.id)} className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-surface-container text-left text-red-600">
                          <Trash2 className="h-4 w-4" />{t("deleteCourse")}
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
