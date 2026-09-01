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
import { SHARED_LMS_MATERIALS_V1 } from "@/lib/features";

const DAY_MS = 86_400_000;
const GRID_START_HOUR = 7;
const GRID_END_HOUR = 21;
const HOUR_HEIGHT_PX = 44;

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
      className={`${positioned ? "absolute inset-x-1 z-10 overflow-hidden" : "block min-h-11"} rounded-control border border-l-4 px-2 py-1.5 type-caption transition-colors duration-150 hover:brightness-95 focus-visible:z-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${eventTone(item)}`}
    >
      <span className="block font-semibold tabular-nums text-on-surface">
        {formatTime(item.startsAt, locale, item.timezone)}–
        {formatTime(item.endsAt, locale, item.timezone)}
      </span>
      <span className="block truncate font-semibold text-on-surface">
        {item.classTitle}
      </span>
      <span className="block truncate text-on-surface-variant">
        {item.title}
      </span>
      {item.status === "cancelled" ? <StatusLabel vi={vi} /> : null}
    </Link>
  );
}

export function TeacherWeekCalendar({
  data,
  locale,
  selectedClassId,
  selectedProgram,
  showClasses = false,
  isAdminPreview = false,
}: {
  data: TeacherWeekView;
  locale: string;
  selectedClassId?: string;
  selectedProgram?: string;
  showClasses?: boolean;
  isAdminPreview?: boolean;
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
  const sortedOccurrences = [...data.occurrences].sort((left, right) =>
    left.startsAt.localeCompare(right.startsAt),
  );
  const agendaOccurrences = sortedOccurrences
    .filter((item) => item.date >= today || !days.includes(today))
    .slice(0, 8);
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
      <PageContainer size="data" className="py-4 lg:py-5">
        {isAdminPreview ? (
          <div className="mb-3 flex flex-col gap-2 rounded-control border border-primary/20 bg-primary-container/35 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-2">
              <ProductIcon
                name="shield"
                size="sm"
                className="mt-0.5 shrink-0 text-primary"
              />
              <div>
                <p className="type-label font-semibold text-on-surface">
                  {vi ? "Đang xem chế độ giáo viên" : "Teacher mode preview"}
                </p>
                <p className="type-caption text-on-surface-variant">
                  {vi
                    ? "Bạn vẫn đăng nhập với quyền quản trị viên."
                    : "You are still signed in with administrator access."}
                </p>
              </div>
            </div>
            <Link
              href="/dashboard/admin"
              className="inline-flex h-8 shrink-0 items-center justify-center rounded-control border border-outline-variant bg-surface px-3 type-label font-semibold text-on-surface transition-colors hover:bg-surface-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {vi ? "Quay lại Quản trị" : "Return to Admin"}
            </Link>
          </div>
        ) : null}
        <header className="flex flex-col gap-3 border-b border-outline-variant pb-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="type-label font-semibold uppercase tracking-widest text-primary">
              {vi ? "Không gian giáo viên" : "Teacher workspace"}
            </p>
            <h1 className="mt-1 type-heading-md font-semibold text-on-surface">
              {vi ? "Lịch dạy tuần này" : "This week’s teaching schedule"}
            </h1>
            <p className="mt-0.5 type-body-sm text-on-surface-variant">
              {vi
                ? "Mở lớp để điểm danh, xem bài tập và chấm bài."
                : "Open a class for attendance, homework, and review."}
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {SHARED_LMS_MATERIALS_V1 ? (
              <Link
                href="/dashboard/teacher/materials"
                className="inline-flex h-8 items-center gap-2 rounded-control border border-outline-variant px-3 type-label font-semibold transition-colors hover:bg-surface-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <ProductIcon name="book" size="sm" />
                {vi ? "Tài liệu" : "Materials"}
              </Link>
            ) : null}
            <Link
              href={currentViewHref}
              className="inline-flex h-8 items-center gap-2 rounded-control border border-outline-variant px-3 type-label font-semibold transition-colors hover:bg-surface-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
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
              className="inline-flex size-8 items-center justify-center rounded-control border border-outline-variant transition-colors hover:bg-surface-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <ProductIcon name="chevronLeft" size="sm" />
            </Link>
            <Link
              href="/dashboard/teacher"
              className="inline-flex h-8 items-center rounded-control border border-outline-variant px-3 type-label font-semibold transition-colors hover:bg-surface-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {vi ? "Hôm nay" : "Today"}
            </Link>
            <Link
              href={query(addDays(data.startDate, 7))}
              aria-label={vi ? "Tuần sau" : "Next week"}
              className="inline-flex size-8 items-center justify-center rounded-control border border-outline-variant transition-colors hover:bg-surface-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <ProductIcon name="chevronRight" size="sm" />
            </Link>
          </div>
        </header>

        <form className="mt-3 grid gap-2 rounded-control border border-outline-variant bg-surface-container-low p-2.5 sm:grid-cols-[minmax(10rem,1fr)_minmax(10rem,1fr)_auto]">
          <input type="hidden" name="weekStart" value={data.startDate} />
          {showClasses ? (
            <input type="hidden" name="view" value="classes" />
          ) : null}
          <label className="grid gap-1 type-caption font-semibold">
            {vi ? "Môn học" : "Subject"}
            <select
              name="program"
              defaultValue={selectedProgram ?? ""}
              className="h-8 rounded-control border border-outline-variant bg-surface px-2 type-label focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <option value="">{vi ? "Tất cả" : "All subjects"}</option>
              <option value="ielts">IELTS</option>
              <option value="debate">Debate</option>
              <option value="public_speaking">Public speaking</option>
            </select>
          </label>
          <label className="grid gap-1 type-caption font-semibold">
            {vi ? "Lớp" : "Class"}
            <select
              name="classId"
              defaultValue={selectedClassId ?? ""}
              className="h-8 rounded-control border border-outline-variant bg-surface px-2 type-label focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <option value="">{vi ? "Tất cả lớp" : "All classes"}</option>
              {data.classes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title}
                </option>
              ))}
            </select>
          </label>
          <button className="h-8 self-end rounded-control bg-primary px-4 type-label font-semibold text-on-primary transition-colors hover:bg-primary-dim focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">
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
                  className="type-title font-semibold text-on-surface"
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
                      <h3 className="mt-1 type-body font-semibold text-on-surface">
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
            <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1fr)_18rem]">
              <section
                className="hidden overflow-hidden rounded-control border border-outline-variant bg-surface xl:block"
                aria-label={vi ? "Lịch tuần" : "Week calendar"}
              >
                <div>
                  <div className="grid grid-cols-[3.75rem_repeat(7,minmax(6.5rem,1fr))] border-b border-outline-variant bg-surface-container-low/70">
                    <div aria-hidden="true" />
                    {days.map((day) => (
                      <div
                        key={day}
                        className="border-l border-outline-variant px-2 py-2 text-center"
                      >
                        <p className="type-label font-semibold uppercase text-on-surface-variant">
                          {new Intl.DateTimeFormat(locale, {
                            weekday: "short",
                          }).format(new Date(`${day}T12:00:00Z`))}
                        </p>
                        <p
                          aria-current={day === today ? "date" : undefined}
                          className={`mx-auto mt-0.5 inline-flex size-7 items-center justify-center rounded-lg type-label font-semibold ${day === today ? "bg-primary text-on-primary" : "text-on-surface"}`}
                        >
                          {Number(day.slice(-2))}
                        </p>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-[3.75rem_repeat(7,minmax(6.5rem,1fr))]">
                    <div className="relative" style={{ height: gridHeight }}>
                      {gridHours.map((hour) => (
                        <span
                          key={hour}
                          className="absolute right-1.5 -translate-y-1/2 type-caption tabular-nums text-on-surface-variant"
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

              <aside
                className="hidden self-start overflow-hidden rounded-control border border-outline-variant bg-surface xl:block"
                aria-labelledby="teacher-week-agenda-heading"
              >
                <div className="border-b border-outline-variant bg-surface-container-low px-3 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <h2
                      id="teacher-week-agenda-heading"
                      className="type-label font-semibold text-on-surface"
                    >
                      {vi ? "Sắp tới" : "Upcoming"}
                    </h2>
                    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-md bg-surface-container-high px-1.5 type-caption font-semibold text-on-surface-variant">
                      {agendaOccurrences.length}
                    </span>
                  </div>
                </div>
                {agendaOccurrences.length ? (
                  <ol className="divide-y divide-outline-variant">
                    {agendaOccurrences.map((item) => (
                      <li key={item.id}>
                        <Link
                          href={`/dashboard/classes/${item.classId}`}
                          className="group block px-3 py-2.5 transition-colors hover:bg-surface-container-low focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="type-caption font-semibold uppercase text-on-surface-variant">
                              {new Intl.DateTimeFormat(locale, {
                                weekday: "short",
                                month: "short",
                                day: "numeric",
                              }).format(new Date(`${item.date}T12:00:00Z`))}
                            </span>
                            <span className="type-caption tabular-nums text-on-surface-variant">
                              {formatTime(item.startsAt, locale, item.timezone)}
                            </span>
                          </div>
                          <p className="mt-0.5 truncate type-label font-semibold text-on-surface">
                            {item.classTitle}
                          </p>
                          <p className="truncate type-caption text-on-surface-variant">
                            {item.title}
                          </p>
                          {item.status === "cancelled" ? (
                            <StatusLabel vi={vi} />
                          ) : null}
                        </Link>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="px-3 py-8 text-center type-body-sm text-on-surface-variant">
                    {vi
                      ? "Không có lớp trong tuần này."
                      : "No classes this week."}
                  </p>
                )}
              </aside>

              <section
                className="grid gap-2 xl:hidden"
                aria-label={vi ? "Lịch tuần dạng danh sách" : "Week agenda"}
              >
                {days.map((day) => {
                  const items = data.occurrences.filter(
                    (item) => item.date === day,
                  );
                  if (items.length === 0) return null;
                  return (
                    <div
                      key={day}
                      className="grid overflow-hidden rounded-control border border-outline-variant bg-surface sm:grid-cols-[8rem_1fr]"
                    >
                      <div className="border-b border-outline-variant bg-surface-container-low px-3 py-2.5 sm:border-b-0 sm:border-r">
                        <p className="type-label font-semibold uppercase text-on-surface-variant">
                          {new Intl.DateTimeFormat(locale, {
                            weekday: "short",
                          }).format(new Date(`${day}T12:00:00Z`))}
                        </p>
                        <p
                          aria-current={day === today ? "date" : undefined}
                          className={`mt-1 inline-flex size-8 items-center justify-center rounded-lg type-body-sm font-bold ${
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
                      <div className="grid gap-2 p-2">
                        {items.map((item) => (
                          <TeacherEventLink
                            key={item.id}
                            item={item}
                            locale={locale}
                            vi={vi}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
                {data.occurrences.length === 0 ? (
                  <div className="rounded-control border border-dashed border-outline-variant bg-surface-container-low px-4 py-10 text-center type-body-sm text-on-surface-variant">
                    {vi
                      ? "Không có lớp trong tuần này."
                      : "No classes this week."}
                  </div>
                ) : null}
              </section>
            </div>
          </>
        )}
      </PageContainer>
    </ProductPageShell>
  );
}

function StatusLabel({ vi }: { vi: boolean }) {
  return (
    <span className="mt-1 inline-flex h-5 items-center rounded-md bg-error-container px-1.5 type-caption font-semibold text-on-error-container">
      {vi ? "Đã hủy" : "Cancelled"}
    </span>
  );
}
