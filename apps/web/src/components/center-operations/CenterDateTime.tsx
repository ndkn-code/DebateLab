"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

type Props = {
  value: string;
  onChange: (value: string) => void;
  label: string;
  dateOnly?: boolean;
  locale?: "en" | "vi";
};

export function parseCenterDateTime(
  value: string,
  timeZone = "Asia/Ho_Chi_Minh",
) {
  const parsed = new Date(value);
  if (!value || Number.isNaN(parsed.getTime()))
    return { date: "", time: "09:00" };
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(parsed);
  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${get("hour")}:${get("minute")}`,
  };
}

export function CenterDateTime({
  value,
  onChange,
  label,
  dateOnly = false,
  locale = "en",
}: Props) {
  const current = parseCenterDateTime(value);
  const [month, setMonth] = useState(() =>
    current.date ? new Date(`${current.date}T12:00:00+07:00`) : new Date(),
  );
  const [open, setOpen] = useState(false);
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1).getDay();
  const dayCount = new Date(
    month.getFullYear(),
    month.getMonth() + 1,
    0,
  ).getDate();
  const dates = useMemo(
    () =>
      Array.from({ length: firstDay + dayCount }, (_, index) =>
        index < firstDay
          ? ""
          : `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}-${String(index - firstDay + 1).padStart(2, "0")}`,
      ),
    [dayCount, firstDay, month],
  );
  const weekdays =
    locale === "vi"
      ? ["CN", "T2", "T3", "T4", "T5", "T6", "T7"]
      : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const commit = (date: string, time = current.time) =>
    onChange(date ? (dateOnly ? date : `${date}T${time}:00+07:00`) : "");
  return (
    <div className="grid gap-1.5">
      <span className="type-label text-on-surface">{label}</span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              type="button"
              variant="outline"
              className="justify-start font-normal"
            />
          }
        >
          {current.date || label}
        </PopoverTrigger>
        <PopoverContent className="grid min-w-[19rem] gap-3 p-3">
          <div className="flex items-center justify-between">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              aria-label={locale === "vi" ? "Tháng trước" : "Previous month"}
              onClick={() =>
                setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))
              }
            >
              ‹
            </Button>
            <span className="type-label text-on-surface">
              {month.toLocaleDateString(locale === "vi" ? "vi-VN" : "en-US", {
                month: "long",
                year: "numeric",
              })}
            </span>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              aria-label={locale === "vi" ? "Tháng sau" : "Next month"}
              onClick={() =>
                setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))
              }
            >
              ›
            </Button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center">
            {weekdays.map((day) => (
              <span key={day} className="type-caption text-on-surface-variant">
                {day}
              </span>
            ))}
            {dates.map((date, index) =>
              date ? (
                <Button
                  key={date}
                  type="button"
                  size="sm"
                  variant={date === current.date ? "primary" : "ghost"}
                  onClick={() => {
                    commit(date);
                    if (dateOnly) setOpen(false);
                  }}
                >
                  {index - firstDay + 1}
                </Button>
              ) : (
                <span key={`blank-${index}`} aria-hidden />
              ),
            )}
          </div>
          {!dateOnly && (
            <Input
              aria-label={`${label} time`}
              type="time"
              value={current.time}
              onChange={(event) => commit(current.date, event.target.value)}
            />
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
