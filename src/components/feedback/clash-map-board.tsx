"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  Bot,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Share2,
  Shuffle,
  UserRound,
  X,
} from "@/components/ui/icons";
import { cn } from "@/lib/utils";

export type ClashMapOutcome =
  | "answered"
  | "dropped"
  | "misanswered"
  | "turned"
  | "weighed";

export interface ClashMapItem {
  id: string;
  sourceQuote: string;
  responseQuote: string | null;
  judgeRead: string;
  suggestion: string;
  outcome: ClashMapOutcome;
  tag: string;
  sourceLabel: string;
  sourceMeta: string;
  responseLabel: string;
  responseMeta: string;
  judgeMeta?: string;
  pairKey: string;
  pairLabel: string;
  sideKey: string;
}

interface ClashMapBoardProps {
  title?: string;
  description?: string;
  items: ClashMapItem[];
  sideOptions: Array<{ value: string; label: string }>;
  emptyMessage: string;
  defaultSide?: string;
}

const OUTCOME_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "all", label: "All outcomes" },
  { value: "answered", label: "Answered" },
  { value: "dropped", label: "Dropped" },
  { value: "misanswered", label: "Misanswered" },
  { value: "turned", label: "Turned" },
  { value: "weighed", label: "Weighed" },
];

const OUTCOME_STYLES: Record<
  ClashMapOutcome,
  {
    accent: string;
    border: string;
    row: string;
    badge: string;
    text: string;
  }
> = {
  answered: {
    accent: "#2F76EF",
    border: "#9FC0FF",
    row: "#F6F9FF",
    badge: "bg-[#EAF1FF] text-[#245FD6]",
    text: "#245FD6",
  },
  dropped: {
    accent: "#F5B942",
    border: "#FAD68A",
    row: "#FFF9EC",
    badge: "bg-[#FFF5E2] text-[#B45309]",
    text: "#B45309",
  },
  misanswered: {
    accent: "#EF4444",
    border: "#FCA5A5",
    row: "#FFF7F7",
    badge: "bg-[#FFE3E3] text-[#B42318]",
    text: "#B42318",
  },
  turned: {
    accent: "#7B61FF",
    border: "#CFC6FF",
    row: "#FAF8FF",
    badge: "bg-[#F1EEFF] text-[#6245F5]",
    text: "#6245F5",
  },
  weighed: {
    accent: "#34C759",
    border: "#BFEBD0",
    row: "#F4FCF7",
    badge: "bg-[#EAF9EF] text-[#168A45]",
    text: "#168A45",
  },
};

const OUTCOME_LABELS: Record<ClashMapOutcome, string> = {
  answered: "Answered",
  dropped: "Dropped",
  misanswered: "Misanswered",
  turned: "Turned",
  weighed: "Weighed",
};

function formatTag(tag: string) {
  return tag.charAt(0).toUpperCase() + tag.slice(1);
}

export function ClashMapBoard({
  title = "Clash Map",
  description = "Track which claims were answered, dropped, turned, or weighed.",
  items,
  sideOptions,
  emptyMessage,
  defaultSide = "all",
}: ClashMapBoardProps) {
  const [pairFilter, setPairFilter] = useState("all");
  const [sideFilter, setSideFilter] = useState(defaultSide);
  const [outcomeFilter, setOutcomeFilter] = useState("all");
  const [activeId, setActiveId] = useState<string | null>(null);

  const pairOptions = useMemo(() => {
    const seen = new Set<string>();
    const options = [{ value: "all", label: "All pairs" }];

    items.forEach((item) => {
      if (seen.has(item.pairKey)) return;
      seen.add(item.pairKey);
      options.push({ value: item.pairKey, label: item.pairLabel });
    });

    return options;
  }, [items]);

  const filteredItems = items.filter((item) => {
    if (pairFilter !== "all" && item.pairKey !== pairFilter) return false;
    if (sideFilter !== "all" && item.sideKey !== sideFilter) return false;
    if (outcomeFilter !== "all" && item.outcome !== outcomeFilter) return false;
    return true;
  });
  const activeItem =
    filteredItems.find((item) => item.id === activeId) ?? filteredItems[0] ?? null;
  const activeIndex = activeItem
    ? filteredItems.findIndex((item) => item.id === activeItem.id)
    : -1;

  const moveActive = (direction: -1 | 1) => {
    if (!filteredItems.length) return;
    const nextIndex =
      activeIndex < 0
        ? 0
        : (activeIndex + direction + filteredItems.length) %
          filteredItems.length;
    setActiveId(filteredItems[nextIndex].id);
  };

  if (items.length === 0) {
    return (
      <section className="rounded-2xl border border-[#DEE8F8] bg-white p-8 text-center shadow-[0_18px_45px_rgba(16,32,72,0.035)]">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#EAF1FF] text-[#4D86F7]">
          <Shuffle className="h-5 w-5" />
        </div>
        <h2 className="mt-4 text-2xl font-bold text-[#0B1424]">{title}</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#718096]">
          {emptyMessage}
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-[#DEE8F8] bg-white p-5 shadow-[0_18px_45px_rgba(16,32,72,0.035)] sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-normal text-[#0B1424]">
            {title}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#637193]">
            {description}
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button className="inline-flex h-11 items-center gap-2 rounded-xl border border-[#DEE8F8] bg-white px-4 text-sm font-bold text-[#0B185A]">
            <Share2 className="h-4 w-4 text-[#4D86F7]" />
            Share
          </button>
          <button
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[#DEE8F8] bg-white text-[#0B185A]"
            aria-label="More clash map actions"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-[#DEE8F8] bg-white p-4">
        <div className="grid gap-4 lg:grid-cols-[1fr_1fr_1fr]">
          <FilterSelect
            icon={<UserRound className="h-5 w-5 text-[#52648A]" />}
            label="Speech Pair"
            value={pairFilter}
            onChange={setPairFilter}
            options={pairOptions}
          />
          <FilterSelect
            icon={<Bot className="h-5 w-5 text-[#52648A]" />}
            label="Side"
            value={sideFilter}
            onChange={setSideFilter}
            options={sideOptions}
          />
          <FilterSelect
            icon={<CalendarDays className="h-5 w-5 text-[#52648A]" />}
            label="Outcome"
            value={outcomeFilter}
            onChange={setOutcomeFilter}
            options={OUTCOME_OPTIONS}
          />
        </div>
      </div>

      <div className="mt-5 grid gap-5 2xl:grid-cols-[minmax(0,1fr)_390px]">
        <div className="overflow-hidden rounded-2xl border border-[#DEE8F8] bg-white">
          <div className="hidden grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_32px] border-b border-[#DEE8F8] bg-[#F7FAFE] px-5 py-3 text-sm font-bold text-[#071159] lg:grid">
            <div className="text-center">Opponent Claim</div>
            <div className="text-center">Your Response</div>
            <div className="text-center">Judge Read</div>
            <div />
          </div>

          <div className="lg:max-h-[660px] lg:overflow-y-auto">
            {filteredItems.length > 0 ? (
              filteredItems.map((item, index) => {
                const tone = OUTCOME_STYLES[item.outcome];
                const isActive = activeItem?.id === item.id;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveId(item.id)}
                    className="block w-full border-b border-[#EEF3FC] p-0 text-left last:border-b-0"
                    style={{
                      backgroundColor: isActive ? tone.row : "#FFFFFF",
                    }}
                  >
                    <div
                      className="grid gap-3 rounded-xl p-3 transition lg:grid-cols-[28px_minmax(0,1fr)_52px_minmax(0,1fr)_52px_minmax(0,1fr)_24px] lg:items-center"
                      style={{
                        border: isActive
                          ? `2px solid ${tone.accent}`
                          : "2px solid transparent",
                      }}
                    >
                      <span
                        className="flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold text-white"
                        style={{ backgroundColor: tone.accent }}
                      >
                        {index + 1}
                      </span>
                      <ClashMiniCard
                        accent={tone.accent}
                        label={item.sourceLabel}
                        meta={item.sourceMeta}
                        quote={item.sourceQuote}
                      />
                      <RowConnector accent={tone.accent} />
                      <ClashMiniCard
                        accent={tone.accent}
                        label={item.responseLabel}
                        meta={item.responseMeta}
                        quote={item.responseQuote ?? "No direct answer was found."}
                        muted={!item.responseQuote}
                      />
                      <RowConnector accent={tone.accent} />
                      <div className="rounded-xl border border-[#DEE8F8] bg-white p-4">
                        <span className={cn("rounded-md px-2.5 py-1 text-xs font-bold", tone.badge)}>
                          {OUTCOME_LABELS[item.outcome]}
                        </span>
                        <p className="mt-3 line-clamp-3 text-sm leading-6 text-[#30427A]">
                          {item.judgeRead}
                        </p>
                      </div>
                      <ChevronRight className="hidden h-5 w-5 text-[#52648A] lg:block" />
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="p-5 text-sm leading-6 text-[#415069]">
                No clash links match these filters.
              </div>
            )}
          </div>
        </div>

        <aside className="rounded-2xl border border-[#DEE8F8] bg-white p-4 shadow-[0_16px_34px_rgba(16,32,72,0.045)] 2xl:sticky 2xl:top-5 2xl:self-start">
          {activeItem ? (
            <ClashDetail
              item={activeItem}
              index={Math.max(activeIndex, 0) + 1}
              count={filteredItems.length}
              onPrevious={() => moveActive(-1)}
              onNext={() => moveActive(1)}
            />
          ) : (
            <p className="text-sm leading-6 text-[#415069]">
              Select a clash to inspect the quotes and next move.
            </p>
          )}
        </aside>
      </div>
    </section>
  );
}

function FilterSelect({
  icon,
  label,
  value,
  onChange,
  options,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="grid grid-cols-[32px_minmax(0,1fr)] items-end gap-3">
      <div className="mb-3">{icon}</div>
      <span className="grid gap-1 text-xs font-bold text-[#718096]">
        {label}
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-11 rounded-xl border border-[#DEE8F8] bg-white px-3 text-sm font-semibold text-[#0B1424] outline-none transition focus:border-[#4D86F7] focus:ring-4 focus:ring-[#EAF1FF]"
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </span>
    </label>
  );
}

function RowConnector({ accent }: { accent: string }) {
  return (
    <div className="hidden items-center lg:flex" aria-hidden="true">
      <div className="h-px flex-1" style={{ backgroundColor: accent }} />
      <span
        className="h-2 w-2 rounded-full"
        style={{ backgroundColor: accent }}
      />
    </div>
  );
}

function ClashMiniCard({
  accent,
  label,
  meta,
  quote,
  muted = false,
}: {
  accent: string;
  label: string;
  meta: string;
  quote: string;
  muted?: boolean;
}) {
  return (
    <div className="min-h-[118px] rounded-xl border border-[#DEE8F8] bg-white p-4">
      <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
        <span className="text-[#0B1424]">{label}</span>
        <span className="text-[#718096]">{meta}</span>
      </div>
      <p
        className={cn(
          "mt-3 border-l-2 pl-3 text-sm font-semibold leading-6",
          muted ? "text-[#718096]" : "text-[#0B1424]"
        )}
        style={{ borderColor: accent }}
      >
        {quote}
      </p>
    </div>
  );
}

function ClashDetail({
  item,
  index,
  count,
  onPrevious,
  onNext,
}: {
  item: ClashMapItem;
  index: number;
  count: number;
  onPrevious: () => void;
  onNext: () => void;
}) {
  const tone = OUTCOME_STYLES[item.outcome];

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-[#415069]">
          Clash {index} of {count}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onPrevious}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#DEE8F8] text-[#415069]"
            aria-label="Previous clash"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onNext}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#DEE8F8] text-[#415069]"
            aria-label="Next clash"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <X className="h-5 w-5 text-[#52648A]" />
        </div>
      </div>

      <div className="mt-4 space-y-4">
        <DetailSection
          title="Opponent claim"
          meta={item.sourceMeta}
          quote={item.sourceQuote}
          accent={tone.accent}
        />
        <DetailSection
          title="Your response"
          meta={item.responseMeta}
          quote={item.responseQuote ?? "No direct answer was found."}
          accent={tone.accent}
          muted={!item.responseQuote}
        />
        <div className="rounded-xl border border-[#DEE8F8] bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-base font-bold text-[#071159]">Judge read</h3>
            <span className={cn("rounded-md px-2.5 py-1 text-xs font-bold", tone.badge)}>
              {OUTCOME_LABELS[item.outcome]}
            </span>
          </div>
          <p className="mt-3 text-sm leading-6 text-[#30427A]">
            {item.judgeRead}
          </p>
          <p className="mt-2 text-xs font-semibold text-[#718096]">
            {formatTag(item.tag)}
            {item.judgeMeta ? ` · ${item.judgeMeta}` : ""}
          </p>
        </div>
        <div className="rounded-xl bg-[#F1F6FD] p-4 text-sm leading-6 text-[#30427A]">
          <span className="font-bold text-[#071159]">Try this: </span>
          {item.suggestion}
        </div>
      </div>
    </div>
  );
}

function DetailSection({
  title,
  meta,
  quote,
  accent,
  muted = false,
}: {
  title: string;
  meta: string;
  quote: string;
  accent: string;
  muted?: boolean;
}) {
  return (
    <div className="rounded-xl border border-[#DEE8F8] bg-white p-4">
      <h3 className="text-base font-bold text-[#071159]">{title}</h3>
      <p
        className={cn(
          "mt-3 border-l-2 pl-3 text-sm leading-6",
          muted ? "text-[#718096]" : "font-semibold text-[#30427A]"
        )}
        style={{ borderColor: accent }}
      >
        {quote}
      </p>
      <p className="mt-3 text-xs font-semibold text-[#718096]">{meta}</p>
    </div>
  );
}
