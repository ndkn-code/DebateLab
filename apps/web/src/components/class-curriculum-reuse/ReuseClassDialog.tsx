"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  reuseInputSchema,
  type ReuseDates,
  type ReuseInput,
  type ReuseItem,
  type ReusePreview,
  type ReuseResult,
  type ReuseSource,
} from "@/lib/class-curriculum-reuse/contracts";
import { reuseCopy, reuseErrors, reuseReasons } from "./copy";

export type ReuseClassDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sources: ReuseSource[];
  sourceClassId?: string;
  loadPreview: (
    sourceClassId: string,
    dates?: ReuseDates,
  ) => Promise<ReuseResult<ReusePreview>>;
  createClass: (input: ReuseInput) => Promise<ReuseResult<{ classId: string }>>;
  onCreated: (classId: string) => void;
  locale: "en" | "vi";
};
const STORAGE_KEY = "thinkfy.class-reuse.pending.v1";
const TIMEZONES = [
  "Asia/Ho_Chi_Minh",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Europe/London",
  "America/New_York",
  "UTC",
];
type PendingCopy = {
  input: ReuseInput;
  preview: ReusePreview;
  actorId: string;
};

function storePending(value: PendingCopy | null) {
  try {
    if (value) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* In-memory retry remains available if storage is disabled. */
  }
}
function storedPending(sources: ReuseSource[]): PendingCopy | null {
  try {
    const raw = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "null");
    if (
      !raw ||
      !reuseInputSchema.safeParse(raw.input).success ||
      !sources.some(
        (s) => s.id === raw.input.sourceClassId && s.actorId === raw.actorId,
      )
    )
      return null;
    if (
      raw.preview?.source?.id !== raw.input.sourceClassId ||
      raw.preview?.fingerprint !== raw.input.previewFingerprint
    )
      return null;
    return raw;
  } catch {
    return null;
  }
}
function dateText(
  value: string | null | undefined,
  locale: "en" | "vi",
  timezone = "UTC",
) {
  if (!value) return reuseCopy[locale].notScheduled;
  const calendar = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const date = new Date(calendar ? `${value}T00:00:00Z` : value);
  if (!Number.isFinite(date.getTime())) return reuseCopy[locale].notScheduled;
  return new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-US", {
    dateStyle: "medium",
    ...(calendar ? {} : { timeStyle: "short" as const }),
    timeZone: calendar ? "UTC" : timezone,
  }).format(date);
}

export function ReuseClassDialog(props: ReuseClassDialogProps) {
  const { open, onOpenChange, sources, locale } = props;
  const c = reuseCopy[locale];
  const [sourceId, setSourceId] = React.useState(
    props.sourceClassId ?? sources[0]?.id ?? "",
  );
  const [title, setTitle] = React.useState("");
  const [startDate, setStartDate] = React.useState("");
  const [endDate, setEndDate] = React.useState("");
  const [dateMode, setDateMode] = React.useState<"clear" | "shift">("clear");
  const [timezone, setTimezone] = React.useState("Asia/Ho_Chi_Minh");
  const [preview, setPreview] = React.useState<ReusePreview | null>(null);
  const [courseIds, setCourseIds] = React.useState<string[]>([]);
  const [materialIds, setMaterialIds] = React.useState<string[]>([]);
  const [assignmentIds, setAssignmentIds] = React.useState<string[]>([]);
  const [review, setReview] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [errorCode, setErrorCode] = React.useState<string | null>(null);
  const [uncertain, setUncertain] = React.useState(false);
  const frozen = React.useRef<PendingCopy | null>(null);
  const lock = React.useRef(false);
  const callbacks = React.useRef(props);
  const sourceList = React.useRef(sources);
  const generation = React.useRef(0);
  const dialogRef = React.useRef<HTMLDivElement>(null);
  const openerRef = React.useRef<HTMLElement | null>(null);
  React.useEffect(() => {
    callbacks.current = props;
    sourceList.current = sources;
  });
  const selectedSource = sources.find((s) => s.id === sourceId);
  const dates: ReuseDates = {
    startDate: startDate || null,
    endDate: endDate || null,
    dateMode,
    timezone,
    assignmentIds,
    materialPlacementIds: materialIds,
  };
  const setSelections = (data: ReusePreview, preserve = false) => {
    const eligible = (items: ReuseItem[]) =>
      items.filter((i) => i.eligible).map((i) => i.id);
    setCourseIds((old) =>
      preserve
        ? old.filter((id) => eligible(data.courses).includes(id))
        : eligible(data.courses),
    );
    setMaterialIds((old) =>
      preserve
        ? old.filter((id) => eligible(data.materials).includes(id))
        : eligible(data.materials),
    );
    setAssignmentIds((old) =>
      preserve
        ? old.filter((id) => eligible(data.assignments).includes(id))
        : eligible(data.assignments),
    );
  };
  const loadSource = React.useCallback(async (id: string, preserve = false) => {
    const ticket = ++generation.current;
    setPending(true);
    setErrorCode(null);
    try {
      const result = await callbacks.current.loadPreview(id);
      if (ticket !== generation.current) return;
      if (!result.ok) {
        setErrorCode(result.code);
        return;
      }
      setPreview(result.data);
      setSelections(result.data, preserve);
    } catch {
      if (ticket === generation.current) setErrorCode("REUSE_FAILED");
    } finally {
      if (ticket === generation.current) setPending(false);
    }
  }, []);

  React.useEffect(() => {
    if (!open) return;
    openerRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const saved = storedPending(sourceList.current);
    if (saved) {
      const i = saved.input;
      frozen.current = saved;
      setUncertain(true);
      setReview(true);
      setPreview(saved.preview);
      setSourceId(i.sourceClassId);
      setTitle(i.title);
      setStartDate(i.startDate ?? "");
      setEndDate(i.endDate ?? "");
      setDateMode(i.dateMode);
      setTimezone(i.timezone);
      setCourseIds(i.courseIds);
      setMaterialIds(i.materialPlacementIds);
      setAssignmentIds(i.assignmentIds);
      setErrorCode("REUSE_RETRY_PENDING");
    } else {
      const id =
        callbacks.current.sourceClassId ?? sourceList.current[0]?.id ?? "";
      setSourceId(id);
      setReview(false);
      setUncertain(false);
      frozen.current = null;
      const source = sourceList.current.find((s) => s.id === id);
      setTitle(
        source
          ? `${source.title} · ${reuseCopy[callbacks.current.locale].newCohort}`
          : "",
      );
      if (id) void loadSource(id);
    }
    return () => {
      generation.current += 1;
    };
  }, [open, loadSource]);

  React.useEffect(() => {
    if (open && !pending && document.activeElement === document.body)
      dialogRef.current?.focus();
  }, [open, pending, review]);

  async function reviewCopy() {
    if (lock.current || pending || !preview) return;
    const checked = reuseInputSchema.safeParse({
      ...dates,
      sourceClassId: sourceId,
      title,
      courseIds,
      previewFingerprint: preview.fingerprint,
      idempotencyKey: crypto.randomUUID(),
    });
    if (
      !checked.success ||
      (dateMode === "shift" && (!startDate || !selectedSource?.startDate))
    ) {
      setErrorCode("REUSE_INVALID_INPUT");
      return;
    }
    lock.current = true;
    setPending(true);
    setErrorCode(null);
    try {
      const result = await callbacks.current.loadPreview(sourceId, dates);
      if (!result.ok) {
        setErrorCode(result.code);
        return;
      }
      if (result.data.fingerprint !== preview.fingerprint) {
        setPreview(result.data);
        setSelections(result.data, true);
        setErrorCode("REUSE_SOURCE_CHANGED");
        return;
      }
      setPreview(result.data);
      setReview(true);
    } catch {
      setErrorCode("REUSE_FAILED");
    } finally {
      lock.current = false;
      setPending(false);
    }
  }
  async function createCopy() {
    if (lock.current || pending || !preview) return;
    lock.current = true;
    setPending(true);
    setErrorCode(null);
    const saved = frozen.current ?? {
      input: {
        ...dates,
        sourceClassId: sourceId,
        title: title.trim(),
        courseIds,
        previewFingerprint: preview.fingerprint,
        idempotencyKey: crypto.randomUUID(),
      },
      preview,
      actorId: preview.source.actorId,
    };
    frozen.current = saved;
    storePending(saved);
    let refresh = false;
    try {
      const result = await callbacks.current.createClass(saved.input);
      if (result.ok) {
        storePending(null);
        frozen.current = null;
        setUncertain(false);
        callbacks.current.onCreated(result.data.classId);
        return;
      }
      setErrorCode(result.code);
      if (result.code === "REUSE_FAILED") setUncertain(true);
      else {
        storePending(null);
        frozen.current = null;
        setUncertain(false);
        if (
          result.code === "REUSE_SOURCE_CHANGED" ||
          result.code === "REUSE_INELIGIBLE_SELECTION"
        ) {
          setReview(false);
          refresh = true;
        }
      }
    } catch {
      setUncertain(true);
      setErrorCode("REUSE_FAILED");
    } finally {
      lock.current = false;
      setPending(false);
    }
    if (refresh) {
      await loadSource(sourceId, true);
      setErrorCode("REUSE_SOURCE_CHANGED");
    }
  }
  const toggle = (
    id: string,
    setter: React.Dispatch<React.SetStateAction<string[]>>,
  ) =>
    setter((ids) =>
      ids.includes(id) ? ids.filter((i) => i !== id) : [...ids, id],
    );
  const error = errorCode ? (reuseErrors[locale][errorCode] ?? c.failed) : null;
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!pending) onOpenChange(next);
      }}
    >
      <DialogContent
        ref={dialogRef}
        initialFocus={dialogRef}
        finalFocus={() => openerRef.current ?? false}
        showCloseButton={false}
        className="max-h-[90dvh] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden !rounded-control p-0 sm:max-w-[40rem]"
      >
        <DialogHeader className="border-b border-outline-variant px-4 py-4 sm:px-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <DialogTitle className="!type-heading-md">
                {review ? c.review : c.title}
              </DialogTitle>
              <DialogDescription className="mt-1 type-body text-on-surface-variant">
                {review ? c.draftNotice : c.description}
              </DialogDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={() => onOpenChange(false)}
            >
              {c.close}
            </Button>
          </div>
        </DialogHeader>
        <div className="min-h-0 overflow-y-auto px-4 py-4 sm:px-6">
          {review && preview ? (
            <Review
              title={title}
              preview={preview}
              dates={dates}
              courseIds={courseIds}
              locale={locale}
            />
          ) : (
            <fieldset disabled={pending} className="min-w-0 space-y-5">
              <label className="block space-y-1">
                <span className="type-label">{c.source}</span>
                <Select
                  aria-label={c.chooseSource}
                  value={sourceId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setSourceId(id);
                    setPreview(null);
                    setDateMode("clear");
                    const s = sources.find((item) => item.id === id);
                    setTitle(s ? `${s.title} · ${c.newCohort}` : "");
                    void loadSource(id);
                  }}
                >
                  {sources.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title} · {s.clubName}
                    </option>
                  ))}
                </Select>
              </label>
              {selectedSource && (
                <p className="type-body text-on-surface-variant">
                  {selectedSource.clubName} · {c.sourceDates}:{" "}
                  {dateText(selectedSource.startDate, locale)} /{" "}
                  {dateText(selectedSource.endDate, locale)}
                </p>
              )}
              <label className="block space-y-1">
                <span className="type-label">{c.classTitle}</span>
                <Input
                  aria-label={c.classTitle}
                  maxLength={200}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  { label: c.startDate, value: startDate, set: setStartDate },
                  { label: c.endDate, value: endDate, set: setEndDate },
                ].map((field) => (
                  <label className="block space-y-1" key={field.label}>
                    <span className="type-label">{field.label}</span>
                    <Input
                      aria-label={field.label}
                      placeholder="YYYY-MM-DD"
                      maxLength={10}
                      value={field.value}
                      onChange={(e) => field.set(e.target.value)}
                    />
                    <span className="type-caption text-on-surface-variant">
                      {c.dateFormat}
                    </span>
                  </label>
                ))}
              </div>
              <label className="block space-y-1">
                <span className="type-label">{c.dateMode}</span>
                <Select
                  value={dateMode}
                  onChange={(e) =>
                    setDateMode(e.target.value as "clear" | "shift")
                  }
                  aria-label={c.dateMode}
                >
                  <option value="clear">{c.clearDates}</option>
                  <option value="shift" disabled={!selectedSource?.startDate}>
                    {c.shiftDates}
                  </option>
                </Select>
              </label>
              {!selectedSource?.startDate && (
                <p className="type-body text-on-surface-variant">
                  {c.missingStart}
                </p>
              )}
              {dateMode === "shift" && (
                <label className="block space-y-1">
                  <span className="type-label">{c.timezone}</span>
                  <Select
                    aria-label={c.timezone}
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                  >
                    {TIMEZONES.map((zone) => (
                      <option key={zone} value={zone}>
                        {zone}
                      </option>
                    ))}
                  </Select>
                  <span className="type-caption text-on-surface-variant">
                    {c.shiftHelp}
                  </span>
                </label>
              )}
              {preview && (
                <>
                  <ItemGroup
                    label={c.courses}
                    items={preview.courses}
                    selected={courseIds}
                    toggle={(id) => toggle(id, setCourseIds)}
                    locale={locale}
                  />
                  <p className="type-body text-on-surface-variant">
                    {c.sharedReference}
                  </p>
                  <ItemGroup
                    label={c.materials}
                    items={preview.materials}
                    selected={materialIds}
                    toggle={(id) => toggle(id, setMaterialIds)}
                    locale={locale}
                  />
                  <ItemGroup
                    label={c.assignments}
                    items={preview.assignments}
                    selected={assignmentIds}
                    toggle={(id) => toggle(id, setAssignmentIds)}
                    locale={locale}
                  />
                  {preview.legacyResourceCount > 0 && (
                    <p className="type-body text-on-surface-variant">
                      {c.legacy(preview.legacyResourceCount)}
                    </p>
                  )}
                  <p className="type-body text-on-surface-variant">
                    {c.noCopy}
                  </p>
                </>
              )}
              {!sources.length && <p className="type-body">{c.noSource}</p>}
            </fieldset>
          )}
          {error && (
            <div
              role="alert"
              className="mt-4 space-y-2 rounded-control border border-error bg-error-container px-3 py-2 type-body text-on-surface"
            >
              <p>{error}</p>
              {uncertain && <p>{c.retryHelp}</p>}
              {!review && (
                <Button
                  variant="outline"
                  disabled={pending}
                  onClick={() => void loadSource(sourceId, !!preview)}
                >
                  {c.reload}
                </Button>
              )}
            </div>
          )}
        </div>
        <DialogFooter className="m-0 rounded-none border-outline-variant bg-surface-container-low px-4 py-4 sm:px-6">
          {review && (
            <Button
              variant="outline"
              disabled={pending || uncertain}
              onClick={() => {
                frozen.current = null;
                setReview(false);
                setErrorCode(null);
              }}
            >
              {c.back}
            </Button>
          )}
          <Button
            variant="primary"
            disabled={pending || !preview}
            onClick={() => void (review ? createCopy() : reviewCopy())}
            className="h-auto min-h-9 whitespace-normal"
          >
            {pending
              ? review
                ? c.creating
                : c.loading
              : review
                ? uncertain
                  ? c.retryCreate
                  : c.create
                : c.continue}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ItemGroup({
  label,
  items,
  selected,
  toggle,
  locale,
}: {
  label: string;
  items: ReuseItem[];
  selected: string[];
  toggle: (id: string) => void;
  locale: "en" | "vi";
}) {
  const c = reuseCopy[locale];
  return (
    <section>
      <h3 className="mb-2 type-title">
        {label} · {selected.length} {c.selected}
      </h3>
      {!items.length ? (
        <p className="type-body text-on-surface-variant">{c.emptyItems}</p>
      ) : (
        <div className="divide-y divide-outline-variant border-y border-outline-variant">
          {items.map((item) => (
            <div key={item.id} className="py-3">
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-1 size-4 shrink-0 accent-primary"
                  checked={selected.includes(item.id)}
                  disabled={!item.eligible}
                  onChange={() => toggle(item.id)}
                />
                <span className="min-w-0 break-words type-body">
                  <span className="block">{item.title}</span>
                  {!item.eligible && (
                    <span className="mt-1 block text-on-surface-variant">
                      {reuseReasons[locale][item.reason ?? ""] ?? c.notEligible}
                    </span>
                  )}
                </span>
              </label>
              {"modules" in item && (
                <ul className="mt-2 space-y-1 pl-7 type-body text-on-surface-variant">
                  {(item as ReusePreview["courses"][number]).modules.map(
                    (module) => (
                      <li key={module.id} className="break-words">
                        {module.title} · {module.lessonCount}{" "}
                        {module.lessonCount === 1 ? c.lesson : c.lessons}
                      </li>
                    ),
                  )}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
function Review({
  title,
  preview,
  dates,
  courseIds,
  locale,
}: {
  title: string;
  preview: ReusePreview;
  dates: ReuseDates;
  courseIds: string[];
  locale: "en" | "vi";
}) {
  const c = reuseCopy[locale];
  const format = (value: string | null | undefined) =>
    dateText(value, locale, dates.timezone);
  const materials = preview.materials.filter((i) =>
    dates.materialPlacementIds.includes(i.id),
  );
  const assignments = preview.assignments.filter((i) =>
    dates.assignmentIds.includes(i.id),
  );
  return (
    <div className="space-y-5">
      <div>
        <h3 className="break-words type-title">{title}</h3>
        <p className="mt-1 type-body text-on-surface-variant">
          {preview.source.clubName} · {c.draft}
        </p>
        <p className="mt-1 type-body">
          {c.after}: {format(dates.startDate)} / {format(dates.endDate)}
        </p>
      </div>
      <section>
        <h3 className="mb-2 type-title">
          {c.courses} · {courseIds.length}
        </h3>
        {preview.courses
          .filter((i) => courseIds.includes(i.id))
          .map((i) => (
            <div key={i.id} className="border-b border-outline-variant py-2">
              <p className="break-words type-body">{i.title}</p>
              <ul className="mt-1 space-y-1 type-body text-on-surface-variant">
                {i.modules.map((m) => (
                  <li className="break-words" key={m.id}>
                    {m.title} · {m.lessonCount}{" "}
                    {m.lessonCount === 1 ? c.lesson : c.lessons}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        <p className="mt-2 type-body text-on-surface-variant">
          {c.sharedReference}
        </p>
      </section>
      <section className="space-y-3">
        <h3 className="type-title">{c.datePreview}</h3>
        <p className="type-body text-on-surface-variant">
          {dates.dateMode === "clear"
            ? c.clearHelp
            : `${preview.datePreview?.dayOffset ?? 0} ${c.days} · ${dates.timezone}`}
        </p>
        <h4 className="type-label">
          {c.materials} · {materials.length}
        </h4>
        {materials.map((i) => {
          const after = preview.datePreview?.materials.find(
            (p) => p.id === i.id,
          );
          return (
            <div
              className="border-b border-outline-variant pb-3 type-body"
              key={i.id}
            >
              <p className="break-words">{i.title}</p>
              <p className="mt-1 text-on-surface-variant">
                {c.release}: {format(i.releaseAt)} → {format(after?.releaseAt)}
              </p>
              <p className="text-on-surface-variant">
                {c.expires}: {format(i.expiresAt)} → {format(after?.expiresAt)}
              </p>
            </div>
          );
        })}
        <h4 className="type-label">
          {c.assignments} · {assignments.length}
        </h4>
        {assignments.map((i) => (
          <div
            key={i.id}
            className="border-b border-outline-variant pb-3 type-body"
          >
            <p className="break-words">{i.title}</p>
            <p className="mt-1 text-on-surface-variant">
              {c.due}: {format(i.dueAt)} →{" "}
              {format(
                preview.datePreview?.assignments.find((p) => p.id === i.id)
                  ?.dueAt,
              )}
            </p>
          </div>
        ))}
      </section>
      <p className="type-body text-on-surface-variant">{c.noCopy}</p>
      <p className="type-body">
        {c.nextSteps}: {c.assignTeacher},{" "}
        {c.setSchedule.toLocaleLowerCase(locale)},{" "}
        {c.enrollLearners.toLocaleLowerCase(locale)},{" "}
        {c.publish.toLocaleLowerCase(locale)}.
      </p>
    </div>
  );
}
