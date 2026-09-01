"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useLocale } from "next-intl";
import { thinkfyMotion } from "@thinkfy/shared/design-system";
import { AnimatedNumber } from "@/components/motion/animated-number";
import {
  bandProgress,
  clampBand,
  formatBandValue,
  targetDeltaView,
} from "@/lib/ielts/band-visuals";
import type { IeltsSkill } from "@/lib/ielts/adaptive/contracts";
import { skillAccentVars } from "@/components/ielts/skill-accent";
import { cn } from "@/lib/utils";

type BandValue = number | null | undefined;

export interface BandGaugeProps {
  band: BandValue;
  target: BandValue;
  label?: string;
  targetLabel?: string;
  caption?: React.ReactNode;
  isProvisional?: boolean;
  className?: string;
}

export interface BandMeterProps {
  skill: string;
  band: BandValue;
  target: BandValue;
  targetLabel?: string;
  accent?: IeltsSkill;
  status?: React.ReactNode;
  raw?: number | null;
  rawMax?: number | null;
  delayMs?: number;
  className?: string;
}

const gaugeRadius = 52;
const gaugeCenter = 70;
const gaugeStroke = 12;

function motionTransition(delayMs = 0) {
  return {
    duration: thinkfyMotion.duration.slow,
    ease: thinkfyMotion.ease.standard,
    delay: delayMs / 1000,
  };
}

function targetPoint(progress: number, radiusOffset: number) {
  const angle = progress * Math.PI * 2 - Math.PI / 2;
  return {
    x: gaugeCenter + Math.cos(angle) * (gaugeRadius + radiusOffset),
    y: gaugeCenter + Math.sin(angle) * (gaugeRadius + radiusOffset),
  };
}

function hasBand(value: BandValue): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function localizedDelta(
  delta: ReturnType<typeof targetDeltaView>,
  locale: string,
) {
  if (locale !== "vi") return delta.text;
  if (delta.state === "pending") return "Chưa có điểm";
  if (delta.state === "met") return "Đạt mục tiêu";
  return `Còn ${formatBandValue(delta.amount)}`;
}

export function BandGauge({
  band,
  target,
  label = "Band score",
  targetLabel = "Target",
  caption,
  isProvisional = false,
  className,
}: BandGaugeProps) {
  const locale = useLocale();
  const reduceMotion = useReducedMotion();
  const progress = bandProgress(band);
  const targetProgress = bandProgress(target);
  const targetInner = targetPoint(targetProgress, -10);
  const targetOuter = targetPoint(targetProgress, 9);
  const delta = targetDeltaView(band, target);
  const numericBand = hasBand(band) ? clampBand(band) : null;

  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-xl border border-outline-variant bg-surface-container p-4 sm:p-5",
        className,
      )}
      data-band={numericBand ?? ""}
      data-ielts-band-gauge
      data-reduced-motion={reduceMotion ? "true" : "false"}
      data-target={hasBand(target) ? clampBand(target) : ""}
    >
      <div className="grid gap-5 sm:grid-cols-[auto_1fr] sm:items-center">
        <div className="mx-auto grid w-full max-w-44 justify-items-center">
          <div
            aria-label={`${label}: ${formatBandValue(numericBand)} ${locale === "vi" ? "trên 9" : "out of 9"}; ${targetLabel.toLowerCase()} ${formatBandValue(target)}`}
            className="relative size-44"
            role="img"
          >
            <svg
              aria-hidden="true"
              className="size-full"
              focusable="false"
              viewBox="0 0 140 140"
            >
              <circle
                cx={gaugeCenter}
                cy={gaugeCenter}
                fill="none"
                r={gaugeRadius}
                stroke="var(--chart-ring-background)"
                strokeWidth={gaugeStroke}
              />
              <motion.circle
                animate={{ pathLength: progress }}
                cx={gaugeCenter}
                cy={gaugeCenter}
                fill="none"
                initial={{ pathLength: reduceMotion ? progress : 0 }}
                r={gaugeRadius}
                stroke="color-mix(in srgb, var(--color-chart-1) 84%, var(--color-chart-6))"
                strokeLinecap="round"
                strokeWidth={gaugeStroke}
                style={{
                  filter:
                    "drop-shadow(0 0 10px color-mix(in srgb, var(--color-chart-1) 34%, transparent))",
                  transform: "rotate(-90deg)",
                  transformOrigin: "center",
                }}
                transition={reduceMotion ? { duration: 0 } : motionTransition()}
              />
              <line
                stroke="var(--color-chart-6)"
                strokeLinecap="round"
                strokeWidth="3"
                x1={targetInner.x}
                x2={targetOuter.x}
                y1={targetInner.y}
                y2={targetOuter.y}
              />
            </svg>
            <div className="absolute inset-0 grid place-items-center text-center">
              <div>
                <p className="type-caption font-semibold uppercase text-on-surface-variant">
                  {isProvisional
                    ? locale === "vi"
                      ? "Tạm tính"
                      : "Provisional"
                    : label}
                </p>
                <p className="mt-1 type-display-md font-bold text-on-surface">
                  {numericBand === null ? (
                    <span className="tabular-nums">—</span>
                  ) : (
                    <AnimatedNumber
                      durationMs={thinkfyMotion.duration.slow * 1000}
                      format={formatBandValue}
                      startOnMount
                      value={numericBand}
                    />
                  )}
                </p>
              </div>
            </div>
          </div>
          <div className="mt-2 flex w-full items-center justify-between px-4 type-caption text-on-surface-variant">
            <span>0</span>
            <span>9</span>
          </div>
        </div>

        <div className="grid gap-3 text-center sm:text-left">
          <div>
            <p className="type-label uppercase text-primary">
              {targetLabel} {formatBandValue(target)}
            </p>
            <p className="mt-1 type-heading-md text-on-surface">
              {localizedDelta(delta, locale)}
            </p>
          </div>
          {caption ? (
            <p className="type-body-sm text-on-surface-variant">{caption}</p>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export function BandMeter({
  skill,
  band,
  target,
  targetLabel = "Target",
  status,
  raw,
  rawMax,
  delayMs = 0,
  className,
  accent,
}: BandMeterProps) {
  const locale = useLocale();
  const reduceMotion = useReducedMotion();
  const progress = bandProgress(band);
  const targetProgress = bandProgress(target);
  const delta = targetDeltaView(band, target);
  const numericBand = hasBand(band) ? clampBand(band) : null;
  const rawText =
    typeof raw === "number" && typeof rawMax === "number"
      ? `${raw}/${rawMax}`
      : null;

  return (
    <div
      className={cn(
        "rounded-xl border border-outline-variant bg-surface-container px-4 py-3",
        className,
      )}
      style={accent ? skillAccentVars(accent) : undefined}
      data-band={numericBand ?? ""}
      data-ielts-band-meter
      data-reduced-motion={reduceMotion ? "true" : "false"}
      data-target={hasBand(target) ? clampBand(target) : ""}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="type-title text-on-surface">{skill}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2 type-caption text-on-surface-variant">
            {status ? status : null}
            {rawText ? <span className="tabular-nums">{rawText}</span> : null}
            <span>{localizedDelta(delta, locale)}</span>
          </div>
        </div>
        <p className="type-heading-md text-on-surface tabular-nums">
          {formatBandValue(numericBand)}
        </p>
      </div>

      <div
        aria-label={`${skill}: ${formatBandValue(numericBand)} ${locale === "vi" ? "trên 9" : "out of 9"}, ${targetLabel.toLowerCase()} ${formatBandValue(
          target,
        )}`}
        className="relative mt-3 h-3 rounded-full bg-surface-container-high"
        role="img"
      >
        <motion.div
          animate={{ scaleX: progress }}
          className="absolute inset-y-0 left-0 w-full overflow-hidden rounded-full bg-[var(--ielts-skill-accent,var(--color-chart-1))]"
          initial={{ scaleX: reduceMotion ? progress : 0 }}
          style={{
            transformOrigin: "left center",
          }}
          transition={
            reduceMotion ? { duration: 0 } : motionTransition(delayMs)
          }
        />
        <div
          aria-hidden="true"
          className="absolute -inset-y-1 w-0.5 rounded-full ring-1 ring-surface"
          style={{
            backgroundColor:
              "color-mix(in srgb, var(--ielts-skill-accent-text, var(--color-chart-axis)) 70%, var(--color-chart-axis))",
            left: `clamp(0.25rem, ${targetProgress * 100}%, calc(100% - 0.25rem))`,
            transform: "translateX(-50%)",
          }}
        />
      </div>
      <div
        aria-hidden="true"
        className="mt-1.5 grid grid-cols-4 type-caption tabular-nums text-on-surface-variant"
      >
        <span>0</span>
        <span className="text-center">3</span>
        <span className="text-center">6</span>
        <span className="text-right">9</span>
      </div>
      <p className="mt-1 type-caption text-on-surface-variant">
        {targetLabel} {formatBandValue(target)}
      </p>
    </div>
  );
}
