"use client";

import { useState } from "react";
import { useLocale } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Repeat2 } from "@/components/ui/icons";
import { ReuseClassDialog } from "@/components/class-curriculum-reuse/ReuseClassDialog";
import {
  listClassReuseSources,
  previewClassCurriculumReuse,
  createClassFromCurriculum,
} from "@/app/actions/admin-classes";
import type { ReuseSource } from "@/lib/class-curriculum-reuse/contracts";

/** Shared visible entry: class list only, outside the independently owned teacher screen. */
export function ReuseClassEntry({
  initialSources,
}: {
  initialSources?: ReuseSource[];
}) {
  const locale = useLocale() === "vi" ? "vi" : "en";
  const router = useRouter();
  const [sources, setSources] = useState(initialSources ?? []);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [empty, setEmpty] = useState(false);
  async function start() {
    if (loading) return;
    setLoading(true);
    setError(false);
    setEmpty(false);
    try {
      const result = await listClassReuseSources();
      if (!result.ok) {
        setError(true);
        return;
      }
      setSources(result.data);
      if (!result.data.length) {
        setEmpty(true);
        return;
      }
      setOpen(true);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }
  return (
    <div className="flex min-w-0 flex-col items-start gap-2">
      <Button
        variant="outline"
        onClick={start}
        disabled={loading}
        className="h-auto min-h-9 max-w-full whitespace-normal text-left"
      >
        <Repeat2 aria-hidden="true" />
        {loading
          ? locale === "vi"
            ? "Đang tải lớp…"
            : "Loading classes…"
          : locale === "vi"
            ? "Tạo lớp từ lớp có sẵn"
            : "Create from existing class"}
      </Button>
      {error && (
        <p role="alert" className="max-w-sm type-body text-error">
          {locale === "vi"
            ? "Chưa tải được lớp nguồn. Chọn lại nút trên để thử lại."
            : "Couldn’t load source classes. Use the button above to retry."}
        </p>
      )}
      {empty && (
        <p role="status" className="max-w-sm type-body text-on-surface-variant">
          {locale === "vi"
            ? "Không có lớp nguồn trong trung tâm bạn được phép tạo lớp."
            : "No source classes in a center where you can create classes."}
        </p>
      )}
      {open && (
        <ReuseClassDialog
          open={open}
          onOpenChange={setOpen}
          sources={sources}
          locale={locale}
          loadPreview={previewClassCurriculumReuse}
          createClass={createClassFromCurriculum}
          onCreated={(id) => {
            setOpen(false);
            router.push(`/dashboard/teacher/classes/${id}`);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
