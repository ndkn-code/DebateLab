import { Link } from "@/i18n/navigation";
import { ProductIcon } from "@/components/ui/product-icon";
import {
  PageContainer,
  ProductPageShell,
} from "@/components/shared/product-layout";
import type {
  TeacherWeekOccurrence,
  TeacherWeekView,
} from "@/lib/api/class-lms/teacher-weekly-repository";

const DAY_MS = 86_400_000;
const GRID_START_HOUR = 7;
const GRID_END_HOUR = 22;
const HOUR_HEIGHT_PX = 56;

function addDays(date: string, days: number): string {
  return new Date(new Date(`${date}T00:00:00Z`).getTime() + days * DAY_MS)
    .toISOString()
    .slice(0, 10);
}

function formatTime(value: string, locale: string, timezone: string): string {
  return new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone,
  }).format(new Date(value));
}

function dateInTimezone(value: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: timezone,
  }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function minutesInTimezone(value: string | Date, timezone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: timezone,
  }).formatToParts(typeof value === "string" ? new Date(value) : value);
  const numberPart = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((item) => item.type === type)?.value ?? 0);
  return numberPart("hour") * 60 + numberPart("minute");
}

function eventTone(item: TeacherWeekOccurrence): string {
  if (item.status === "cancelled") {
    return "border-error bg-error-container/55 opacity-75";
  }
  if (item.programType === "ielts") return "border-info bg-info-container/70";
  if (item.programType === "public_speaking") {
    return "border-warning bg-warning-container/70";
  }
  return "border-primary bg-primary-container/70";
}

function TeacherEventLink({
  item,
  locale,
  vi,
  positioned = false,
}: {
  item: TeacherWeekOccurrence;
  locale: string;
  vi: boolean;
  positioned?: boolean;
}) {
  const start = minutesInTimezone(item.startsAt, item.timezone);
  const end = minutesInTimezone(item.endsAt, item.timezone);
  const gridStart = GRID_START_HOUR * 60;
  const gridHeight = (GRID_END_HOUR - GRID_START_HOUR) * HOUR_HEIGHT_PX;
  const top = Math.min(
    gridHeight - 40,
    Math.max(0, ((start - gridStart) / 60) * HOUR_HEIGHT_PX),
  );
  const height = Math.min(
    gridHeight - top,
    Math.max(40, ((end - start) / 60) * HOUR_HEIGHT_PX),
  );
  return (
    <Link
      href={`/dashboard/classes/${item.classId}`}
      style={positioned ? { top, height } : undefined}
      className={`${positioned ? "absolute inset-x-1 z-10 overflow-hidden" : "block"} rounded-lg border-l-4 p-2 type-caption transition-colors hover:brightness-95 focus-visible:z-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${eventTone(item)}`}
    >
      <span className="block font-bold text-on-surface">
        {formatTime(item.startsAt, locale, item.timezone)}–
        {formatTime(item.endsAt, locale, item.timezone)}
      </span>
      <span className="mt-1 block font-semibold text-on-surface">
        {item.classTitle}
      </span>
      <span className="block text-on-surface-variant">{item.title}</span>
      {item.status === "cancelled" ? (
        <span className="mt-1 inline-flex rounded-full bg-error-container px-1.5 py-0.5 font-semibold text-on-error-container">
          {vi ? "Đã hủy" : "Cancelled"}
        </span>
      ) : null}
    </Link>
  );
}

export function TeacherWeekCalendar({
  data,
  locale,
  selectedClassId,
  selectedProgram,
  showClasses = false,
}: {
  data: TeacherWeekView;
  locale: string;
  selectedClassId?: string;
  selectedProgram?: string;
  showClasses?: boolean;
}) {
  const vi = locale === "vi";
  const days = Array.from({ length: 7 }, (_, index) =>
    addDays(data.startDate, index),
  );
  const calendarTimezone = data.timezone;
  const today = dateInTimezone(new Date(), calendarTimezone);
  const nowLabel = new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    minute: "2-digit",
    timeZone: calendarTimezone,
  }).format(new Date());
  const nowMinutes = minutesInTimezone(new Date(), calendarTimezone);
  const gridHours = Array.from(
    { length: GRID_END_HOUR - GRID_START_HOUR + 1 },
    (_, index) => GRID_START_HOUR + index,
  );
  const gridHeight = (GRID_END_HOUR - GRID_START_HOUR) * HOUR_HEIGHT_PX;
  const query = (startDate: string) => {
    const params = new URLSearchParams({ weekStart: startDate });
    if (selectedClassId) params.set("classId", selectedClassId);
    if (selectedProgram) params.set("program", selectedProgram);
    return `/dashboard/teacher?${params.toString()}`;
  };
  const classListParams = new URLSearchParams({
    weekStart: data.startDate,
    view: "classes",
  });
  if (selectedClassId) classListParams.set("classId", selectedClassId);
  if (selectedProgram) classListParams.set("program", selectedProgram);
  const currentViewHref = showClasses
    ? query(data.startDate)
    : `/dashboard/teacher?${classListParams.toString()}`;

  return (
    <ProductPageShell>
      <PageContainer size="wide" className="py-5 lg:py-7">
        <header className="flex flex-col gap-4 border-b border-outline-variant pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="type-label font-semibold uppercase tracking-widest text-primary">
              {vi ? "Không gian giáo viên" : "Teacher workspace"}
            </p>
            <h1 className="mt-1 type-heading-lg font-semibold text-on-surface">
              {vi ? "Lịch dạy tuần này" : "This week’s teaching schedule"}
            </h1>
            <p className="mt-1 type-body-sm text-on-surface-variant">
              {vi
                ? "Mở lớp để điểm danh, xem bài tập và chấm bài."
                : "Open a class for attendance, homework, and review."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={currentViewHref}
              className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-outline-variant px-3 type-label font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <ProductIcon
                name={showClasses ? "calendar" : "users"}
                size="sm"
              />
              {showClasses
                ? vi
                  ? "Lịch tuần"
                  : "Week calendar"
                : vi
                  ? "Danh sách lớp"
                  : "Class list"}
            </Link>
            <Link
              href={query(addDays(data.startDate, -7))}
              aria-label={vi ? "Tuần trước" : "Previous week"}
              className="inline-flex size-10 items-center justify-center rounded-lg border border-outline-variant focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <ProductIcon name="chevronLeft" size="sm" />
            </Link>
            <Link
              href="/dashboard/teacher"
              className="inline-flex min-h-10 items-center rounded-lg border border-outline-variant px-3 type-label font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {vi ? "Hôm nay" : "Today"}
            </Link>
            <Link
              href={query(addDays(data.startDate, 7))}
              aria-label={vi ? "Tuần sau" : "Next week"}
              className="inline-flex size-10 items-center justify-center rounded-lg border border-outline-variant focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <ProductIcon name="chevronRight" size="sm" />
            </Link>
          </div>
        </header>

        <form className="mt-4 grid gap-3 rounded-xl border border-outline-variant bg-surface-container-low p-3 sm:grid-cols-[1fr_1fr_auto]">
          <input type="hidden" name="weekStart" value={data.startDate} />
          {showClasses ? (
            <input type="hidden" name="view" value="classes" />
          ) : null}
          <label className="grid gap-1 type-label font-semibold">
            {vi ? "Môn học" : "Subject"}
            <select
              name="program"
              defaultValue={selectedProgram ?? ""}
              className="min-h-10 rounded-lg border border-outline-variant bg-surface px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <option value="">{vi ? "Tất cả" : "All subjects"}</option>
              <option value="ielts">IELTS</option>
              <option value="debate">Debate</option>
              <option value="public_speaking">Public speaking</option>
            </select>
          </label>
          <label className="grid gap-1 type-label font-semibold">
            {vi ? "Lớp" : "Class"}
            <select
              name="classId"
              defaultValue={selectedClassId ?? ""}
              className="min-h-10 rounded-lg border border-outline-variant bg-surface px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <option value="">{vi ? "Tất cả lớp" : "All classes"}</option>
              {data.classes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title}
                </option>
              ))}
            </select>
          </label>
          <button className="min-h-10 self-end rounded-lg bg-primary px-4 type-label font-semibold text-on-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">
            {vi ? "Lọc" : "Apply"}
          </button>
        </form>

        {showClasses ? (
          <section
            className="mt-5"
            aria-labelledby="teacher-class-list-heading"
          >
            <div className="flex items-end justify-between gap-3">
              <div>
                <h2
                  id="teacher-class-list-heading"
                  className="type-heading-sm font-semibold text-on-surface"
                >
                  {vi ? "Lớp đang phụ trách" : "Managed classes"}
                </h2>
                <p className="mt-1 type-body-sm text-on-surface-variant">
                  {vi
                    ? `${data.classes.length} lớp có thể quản lý`
                    : `${data.classes.length} classes you can manage`}
                </p>
              </div>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {data.classes.map((item) => (
                <Link
                  key={item.id}
                  href={`/dashboard/classes/${item.id}`}
                  className="group rounded-xl border border-outline-variant bg-surface p-4 transition-colors hover:bg-surface-container-low focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="type-caption font-semibold uppercase tracking-wide text-primary">
                        {item.programType === "public_speaking"
                          ? vi
                            ? "Thuyết trình"
                            : "Public speaking"
                          : item.programType === "ielts"
                            ? "IELTS"
                            : vi
                              ? "Tranh biện"
                              : "Debate"}
                      </p>
                      <h3 className="mt-1 type-title-sm font-semibold text-on-surface">
                        {item.title}
                      </h3>
                    </div>
                    <ProductIcon
                      name="chevronRight"
                      size="sm"
                      className="mt-1 text-on-surface-variant transition-transform group-hover:translate-x-0.5"
                    />
                  </div>
                  <p className="mt-5 type-label font-semibold text-on-surface-variant">
                    {vi
                      ? "Điểm danh · Bài tập · Chấm bài"
                      : "Attendance · Homework · Review"}
                  </p>
                </Link>
              ))}
            </div>
            {data.classes.length === 0 ? (
              <div className="mt-4 rounded-xl border border-dashed border-outline-variant p-8 text-center type-body-sm text-on-surface-variant">
                {vi
                  ? "Không có lớp phù hợp với bộ lọc này."
                  : "No managed classes match these filters."}
              </div>
            ) : null}
          </section>
        ) : (
          <>
            <section
              className="mt-5 hidden overflow-x-auto rounded-xl border border-outline-variant bg-surface md:block"
              aria-label={vi ? "Lịch tuần" : "Week calendar"}
            >
              <div className="min-w-[68rem]">
                <div className="grid grid-cols-[4.5rem_repeat(7,minmax(8rem,1fr))] border-b border-outline-variant">
                  <div aria-hidden="true" />
                  {days.map((day) => (
                    <div
                      key={day}
                      className="border-l border-outline-variant px-2 py-3 text-center"
                    >
                      <p className="type-label font-semibold uppercase text-on-surface-variant">
                        {new Intl.DateTimeFormat(locale, {
                          weekday: "short",
                        }).format(new Date(`${day}T12:00:00Z`))}
                      </p>
                      <p
                        aria-current={day === today ? "date" : undefined}
                        className={`mx-auto mt-1 inline-flex size-8 items-center justify-center rounded-full type-body-sm font-bold ${day === today ? "bg-primary text-on-primary" : "text-on-surface"}`}
                      >
                        {Number(day.slice(-2))}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-[4.5rem_repeat(7,minmax(8rem,1fr))]">
                  <div className="relative" style={{ height: gridHeight }}>
                    {gridHours.map((hour) => (
                      <span
                        key={hour}
                        className="absolute right-2 -translate-y-1/2 type-caption text-on-surface-variant"
                        style={{
                          top: (hour - GRID_START_HOUR) * HOUR_HEIGHT_PX,
                        }}
                      >
                        {new Intl.DateTimeFormat(locale, {
                          hour: "numeric",
                          timeZone: "UTC",
                        }).format(
                          new Date(
                            `2000-01-01T${String(hour).padStart(2, "0")}:00:00Z`,
                          ),
                        )}
                      </span>
                    ))}
                  </div>
                  {days.map((day) => {
                    const items = data.occurrences.filter(
                      (item) => item.date === day,
                    );
                    const nowTop =
                      ((nowMinutes - GRID_START_HOUR * 60) / 60) *
                      HOUR_HEIGHT_PX;
                    return (
                      <div
                        key={day}
                        className="relative border-l border-outline-variant"
                        style={{ height: gridHeight }}
                      >
                        {gridHours.map((hour) => (
                          <span
                            key={hour}
                            aria-hidden="true"
                            className="absolute inset-x-0 border-t border-outline-variant/60"
                            style={{
                              top: (hour - GRID_START_HOUR) * HOUR_HEIGHT_PX,
                            }}
                          />
                        ))}
                        {day === today &&
                        nowTop >= 0 &&
                        nowTop <= gridHeight ? (
                          <div
                            className="absolute inset-x-0 z-20 flex items-center"
                            style={{ top: nowTop }}
                          >
                            <span className="sr-only">
                              {vi ? `Bây giờ ${nowLabel}` : `Now ${nowLabel}`}
                            </span>
                            <span className="size-2 -translate-x-1 rounded-full bg-error" />
                            <span className="h-0.5 flex-1 bg-error" />
                          </div>
                        ) : null}
                        {items.map((item) => (
                          <TeacherEventLink
                            key={item.id}
                            item={item}
                            locale={locale}
                            vi={vi}
                            positioned
                          />
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
            <section
              className="mt-5 grid gap-3 md:hidden"
              aria-label={
                vi ? "Lịch tuần trên di động" : "Mobile week calendar"
              }
            >
              {days.map((day) => {
                const items = data.occurrences.filter(
                  (item) => item.date === day,
                );
                return (
                  <div
                    key={day}
                    className="min-h-44 rounded-xl border border-outline-variant bg-surface p-2"
                  >
                    <div className="border-b border-outline-variant px-1 pb-2">
                      <p className="type-label font-semibold uppercase text-on-surface-variant">
                        {new Intl.DateTimeFormat(locale, {
                          weekday: "short",
                        }).format(new Date(`${day}T12:00:00Z`))}
                      </p>
                      <p
                        aria-current={day === today ? "date" : undefined}
                        className={`mt-1 inline-flex size-8 items-center justify-center rounded-full type-body-sm font-bold ${
                          day === today
                            ? "bg-primary text-on-primary"
                            : "text-on-surface"
                        }`}
                      >
                        {Number(day.slice(-2))}
                      </p>
                      {day === today ? (
                        <p className="mt-1 type-caption font-semibold text-primary">
                          {vi ? `Bây giờ ${nowLabel}` : `Now ${nowLabel}`}
                        </p>
                      ) : null}
                    </div>
                    <div className="mt-2 grid gap-2">
                      {items.map((item) => (
                        <TeacherEventLink
                          key={item.id}
                          item={item}
                          locale={locale}
                          vi={vi}
                        />
                      ))}
                      {items.length === 0 ? (
                        <p className="px-1 py-3 type-caption text-on-surface-variant">
                          {vi ? "Không có lớp" : "No classes"}
                        </p>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </section>
          </>
        )}
      </PageContainer>
    </ProductPageShell>
  );
}
