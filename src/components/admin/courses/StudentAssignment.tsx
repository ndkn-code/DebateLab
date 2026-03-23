"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { Search, X, UserPlus } from "lucide-react";
import { addStudentToCourse, removeStudentFromCourse, searchStudents } from "@/app/actions/courses";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface Student {
  id: string;
  display_name: string;
  avatar_url: string | null;
  email: string | null;
}

interface Props {
  courseId: string;
  initialStudents: Student[];
}

export function StudentAssignment({ courseId, initialStudents }: Props) {
  const router = useRouter();
  const [students, setStudents] = useState(initialStudents);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Student[]>([]);
  const [searching, setSearching] = useState(false);

  const handleSearch = async (q: string) => {
    setQuery(q);
    if (q.length < 2) { setResults([]); return; }
    setSearching(true);
    const data = await searchStudents(q, courseId);
    setResults(data as Student[]);
    setSearching(false);
  };

  const handleAdd = async (student: Student) => {
    await addStudentToCourse(courseId, student.id);
    setStudents((prev) => [...prev, student]);
    setResults((prev) => prev.filter((r) => r.id !== student.id));
    setQuery("");
  };

  const handleRemove = async (studentId: string) => {
    if (!confirm("Remove this student?")) return;
    await removeStudentFromCourse(courseId, studentId);
    setStudents((prev) => prev.filter((s) => s.id !== studentId));
  };

  return (
    <div className="rounded-2xl bg-surface-container-lowest border border-outline-variant/10 p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-on-surface">Assigned Students ({students.length})</h2>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-on-surface-variant" />
        <input
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search students by name or email..."
          className="w-full rounded-xl border border-outline-variant/20 bg-surface-container-lowest pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        {results.length > 0 && (
          <div className="absolute top-full left-0 right-0 z-10 mt-1 rounded-xl border border-outline-variant/20 bg-surface-container-lowest shadow-lg max-h-48 overflow-y-auto">
            {results.map((r) => (
              <button
                key={r.id}
                onClick={() => handleAdd(r)}
                className="flex items-center gap-3 w-full px-4 py-2.5 text-sm hover:bg-surface-container text-left"
              >
                <Avatar size="sm">
                  <AvatarFallback className="bg-primary-container text-on-primary-container text-xs font-bold">
                    {r.display_name[0]?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-on-surface truncate">{r.display_name}</p>
                  <p className="text-xs text-on-surface-variant truncate">{r.email}</p>
                </div>
                <UserPlus className="h-4 w-4 text-primary shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Student list */}
      {students.length === 0 ? (
        <p className="text-sm text-on-surface-variant text-center py-6">No students assigned yet</p>
      ) : (
        <div className="space-y-1">
          {students.map((s) => (
            <div key={s.id} className="flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-surface-container/50">
              <Avatar size="sm">
                <AvatarFallback className="bg-primary-container text-on-primary-container text-xs font-bold">
                  {s.display_name[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-on-surface truncate">{s.display_name}</p>
                <p className="text-xs text-on-surface-variant truncate">{s.email}</p>
              </div>
              <button
                onClick={() => handleRemove(s.id)}
                className="p-1.5 rounded-lg hover:bg-red-50 text-on-surface-variant hover:text-red-600 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
