"use client";

import { useState, useTransition } from "react";
import { BookOpen, Plus, Search, Trash2, Users } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import {
  assignCourseToClass,
  searchClassesForCourse,
  unassignCourseFromClass,
} from "@/app/actions/admin-classes";

interface AssignedClass {
  id: string;
  code: string;
  title: string;
  grade_level: string | null;
  status: string;
  student_count?: number | null;
}

interface Props {
  courseId: string;
  initialClasses: AssignedClass[];
}

export function ClassAssignment({ courseId, initialClasses }: Props) {
  const router = useRouter();
  const [classes, setClasses] = useState(initialClasses);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AssignedClass[]>([]);
  const [isPending, startTransition] = useTransition();

  function handleSearch(value: string) {
    setQuery(value);
    if (value.trim().length < 2) {
      setResults([]);
      return;
    }

    startTransition(async () => {
      const rows = await searchClassesForCourse(value, courseId);
      setResults(rows as AssignedClass[]);
    });
  }

  function handleAdd(classRow: AssignedClass) {
    startTransition(async () => {
      await assignCourseToClass(classRow.id, courseId);
      setClasses((prev) => [...prev, classRow]);
      setResults((prev) => prev.filter((item) => item.id !== classRow.id));
      setQuery("");
      router.refresh();
    });
  }

  function handleRemove(classId: string) {
    startTransition(async () => {
      await unassignCourseFromClass(classId, courseId);
      setClasses((prev) => prev.filter((item) => item.id !== classId));
      router.refresh();
    });
  }

  return (
    <div className="rounded-lg border border-outline-variant/20 bg-surface-container-lowest p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-semibold text-on-surface">Assigned Classes</h2>
          <p className="mt-1 text-sm text-on-surface-variant">
            Students in these classes can see this course. Assigning a class keeps the course class restricted.
          </p>
        </div>
        <div className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
          {classes.length} classes
        </div>
      </div>

      <div className="relative mt-4">
        <Search className="absolute left-3 top-3.5 h-4 w-4 text-on-surface-variant" />
        <input
          value={query}
          onChange={(event) => handleSearch(event.target.value)}
          placeholder="Search classes by title, code, or grade..."
          className="h-11 w-full rounded-lg border border-outline-variant/40 bg-background pl-10 pr-3 text-sm outline-none focus:border-primary"
        />
        {results.length > 0 && (
          <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-lg border border-outline-variant/30 bg-surface-container-lowest shadow-lg">
            {results.map((classRow) => (
              <button
                key={classRow.id}
                type="button"
                onClick={() => handleAdd(classRow)}
                className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm hover:bg-surface-container"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Users className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-on-surface">{classRow.title}</p>
                  <p className="truncate text-xs text-on-surface-variant">{classRow.code} · {classRow.grade_level ?? "All grades"}</p>
                </div>
                <Plus className="h-4 w-4 text-primary" />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 space-y-2">
        {classes.length === 0 ? (
          <p className="rounded-lg border border-dashed border-outline-variant/30 px-3 py-8 text-center text-sm text-on-surface-variant">
            No classes assigned yet.
          </p>
        ) : (
          classes.map((classRow) => (
            <div key={classRow.id} className="flex items-center gap-3 rounded-lg border border-outline-variant/25 bg-background px-3 py-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-on-primary">
                <BookOpen className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-on-surface">{classRow.title}</p>
                <p className="truncate text-xs text-on-surface-variant">
                  {classRow.code} · {classRow.grade_level ?? "All grades"}
                  {typeof classRow.student_count === "number" ? ` · ${classRow.student_count} students` : ""}
                </p>
              </div>
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                {classRow.status === "active" ? "Active" : classRow.status}
              </span>
              <button
                type="button"
                disabled={isPending}
                onClick={() => handleRemove(classRow.id)}
                className="rounded-lg p-2 text-on-surface-variant hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
