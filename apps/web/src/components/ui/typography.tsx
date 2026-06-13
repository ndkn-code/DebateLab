import * as React from "react";

import { cn } from "@/lib/utils";

type AsProp = { as?: React.ElementType };

const DISPLAY_SIZES = {
  xl: "type-display-xl",
  lg: "type-display-lg",
  md: "type-display-md",
  sm: "type-display-sm",
} as const;

type DisplaySize = keyof typeof DISPLAY_SIZES;

/** Brand/marketing headline. Nunito display font. Defaults to <h1>. */
function Display({
  size = "xl",
  as,
  className,
  ...props
}: React.ComponentProps<"h1"> & AsProp & { size?: DisplaySize }) {
  const Tag = as ?? "h1";
  return (
    <Tag
      data-slot="display"
      className={cn(DISPLAY_SIZES[size], "text-on-surface", className)}
      {...props}
    />
  );
}

const HEADING_LEVELS = {
  1: "type-heading-xl",
  2: "type-heading-lg",
  3: "type-heading-md",
  4: "type-title",
} as const;

type HeadingLevel = keyof typeof HEADING_LEVELS;

/** Product UI heading. Be Vietnam Pro. Renders h{level} unless `as` overrides. */
function Heading({
  level = 2,
  as,
  className,
  ...props
}: React.ComponentProps<"h2"> & AsProp & { level?: HeadingLevel }) {
  const Tag = as ?? (`h${level}` as React.ElementType);
  return (
    <Tag
      data-slot="heading"
      className={cn(HEADING_LEVELS[level], "text-on-surface", className)}
      {...props}
    />
  );
}

/** Uppercase kicker above a heading. */
function Eyebrow({ as, className, ...props }: React.ComponentProps<"p"> & AsProp) {
  const Tag = as ?? "p";
  return <Tag data-slot="eyebrow" className={cn("type-eyebrow", className)} {...props} />;
}

const TEXT_VARIANTS = {
  body: "type-body",
  "body-lg": "type-body-lg",
  "body-sm": "type-body-sm",
  caption: "type-caption",
  label: "type-label",
  prose: "type-prose",
} as const;

type TextVariant = keyof typeof TEXT_VARIANTS;

/**
 * Body / supporting copy. `prose` uses the Noto Serif editorial face (transcripts,
 * long-form reading); `label` renders an inline <span>; the rest default to <p>.
 */
function Text({
  variant = "body",
  as,
  className,
  ...props
}: React.ComponentProps<"p"> & AsProp & { variant?: TextVariant }) {
  const Tag = as ?? (variant === "label" ? "span" : "p");
  return <Tag data-slot="text" className={cn(TEXT_VARIANTS[variant], className)} {...props} />;
}

const STAT_SIZES = {
  "display-md": "type-display-md",
  "display-sm": "type-display-sm",
  "heading-xl": "type-heading-xl",
  "heading-lg": "type-heading-lg",
  "heading-md": "type-heading-md",
  title: "type-title",
} as const;

type StatSize = keyof typeof STAT_SIZES;

/** Number display with tabular figures so digits stay aligned. */
function Stat({
  size = "heading-lg",
  as,
  className,
  ...props
}: React.ComponentProps<"span"> & AsProp & { size?: StatSize }) {
  const Tag = as ?? "span";
  return (
    <Tag
      data-slot="stat"
      className={cn(STAT_SIZES[size], "tabular-nums", className)}
      {...props}
    />
  );
}

/** Inline code / monospace values (codes, timestamps, ids). Geist Mono. */
function Code({ as, className, ...props }: React.ComponentProps<"code"> & AsProp) {
  const Tag = as ?? "code";
  return <Tag data-slot="code" className={cn("type-code", className)} {...props} />;
}

export { Display, Heading, Eyebrow, Text, Stat, Code };
export type { DisplaySize, HeadingLevel, TextVariant, StatSize };
