"use client";

import { useCallback, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { Info } from "@/components/ui/icons";

interface InfoHintProps {
  label: string;
}

export function InfoHint({ label }: InfoHintProps) {
  const tooltipId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{
    left: number;
    top: number;
  } | null>(null);

  const showTooltip = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const tooltipWidth = 288;
    const viewportPadding = 12;
    const minLeft = tooltipWidth / 2 + viewportPadding;
    const maxLeft =
      Math.max(minLeft, window.innerWidth - tooltipWidth / 2 - viewportPadding);

    setTooltipPosition({
      left: Math.min(
        Math.max(rect.left + rect.width / 2, minLeft),
        maxLeft
      ),
      top: rect.top - 8,
    });
  }, []);

  const hideTooltip = useCallback(() => {
    setTooltipPosition(null);
  }, []);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-describedby={tooltipPosition ? tooltipId : undefined}
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        onFocus={showTooltip}
        onBlur={hideTooltip}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          showTooltip();
        }}
        className="inline-flex h-5 w-5 shrink-0 cursor-help items-center justify-center rounded-full text-[#8A96A8] outline-none transition hover:bg-[#F1F6FD] hover:text-[#3E78EC] focus-visible:bg-[#F1F6FD] focus-visible:text-[#3E78EC] focus-visible:ring-2 focus-visible:ring-[#4D86F7]/20"
      >
        <Info className="h-3.5 w-3.5" />
      </button>
      {tooltipPosition && typeof document !== "undefined"
        ? createPortal(
            <div
              id={tooltipId}
              role="tooltip"
              data-settings-info-tooltip
              className="pointer-events-none fixed z-[9999] max-w-72 -translate-x-1/2 -translate-y-full rounded-lg bg-[#0B1424] px-3 py-2 text-xs font-normal leading-5 text-white shadow-lg"
              style={{
                left: tooltipPosition.left,
                top: tooltipPosition.top,
              }}
            >
              {label}
            </div>,
            document.body
          )
        : null}
    </>
  );
}
