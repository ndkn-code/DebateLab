export type ThinkfyThemeMode = "light" | "dark";

export type ThinkfyColorRole =
  | "background"
  | "foreground"
  | "primary"
  | "primaryDim"
  | "primaryDepth"
  | "primaryContainer"
  | "primaryFixed"
  | "onPrimary"
  | "onPrimaryContainer"
  | "secondary"
  | "secondaryDim"
  | "secondaryContainer"
  | "tertiary"
  | "tertiaryContainer"
  | "reward"
  | "rewardDim"
  | "rewardContainer"
  | "onReward"
  | "success"
  | "successDim"
  | "successContainer"
  | "onSuccess"
  | "warning"
  | "warningContainer"
  | "onWarningContainer"
  | "error"
  | "errorDim"
  | "errorContainer"
  | "onError"
  | "info"
  | "infoContainer"
  | "onInfo"
  | "surface"
  | "surfaceDim"
  | "surfaceHigh"
  | "surfaceHighest"
  | "surfaceContainer"
  | "surfaceContainerLow"
  | "surfaceContainerHigh"
  | "surfaceContainerHighest"
  | "surfaceContainerLowest"
  | "outline"
  | "outlineVariant"
  | "inverse"
  | "inverseText"
  | "muted"
  | "placeholder"
  | "chartPrimary"
  | "chartSecondary"
  | "chartTertiary"
  | "chart1"
  | "chart2"
  | "chart3"
  | "chart4"
  | "chart5"
  | "chart6"
  | "chart7"
  | "chartGrid"
  | "chartAxis"
  | "chartTooltipBg"
  | "chartTooltipText"
  | "chartCrosshair"
  | "courseAccent";

export type ThinkfyTone =
  | "primary"
  | "secondary"
  | "tertiary"
  | "reward"
  | "success"
  | "warning"
  | "error"
  | "info"
  | "neutral";

export type ThinkfyColorRoles = Record<ThinkfyColorRole, string>;

export type ThinkfyButtonToken = {
  background: string;
  highlight: string;
  border: string;
  text: string;
  shadow: string;
  hoverBackground: string;
  pressedBackground: string;
  disabledBackground: string;
  disabledText: string;
};

export type ThinkfySidebarTokens = {
  background: string;
  softBackground: string;
  text: string;
  mutedText: string;
  accent: string;
  hoverBackground: string;
  selectedBackground: string;
  selectedText: string;
  selectedAccent: string;
  selectedShadow: string;
};

export type ThinkfyComponentTokens = {
  button: {
    primary: ThinkfyButtonToken;
    secondary: ThinkfyButtonToken;
    ghost: ThinkfyButtonToken;
    destructive: ThinkfyButtonToken;
    reward: ThinkfyButtonToken;
  };
  card: {
    background: string;
    border: string;
    text: string;
    shadow: string;
  };
  input: {
    background: string;
    border: string;
    text: string;
    placeholder: string;
    focusBorder: string;
    focusRing: string;
    disabledBackground: string;
  };
  badge: Record<ThinkfyTone, { background: string; text: string; border: string }>;
  progress: {
    track: string;
    fill: string;
    rewardFill: string;
    successFill: string;
  };
  sidebar: ThinkfySidebarTokens;
  focusRing: string;
};

export type ThinkfyTheme = {
  mode: ThinkfyThemeMode;
  colors: ThinkfyColorRoles;
  components: ThinkfyComponentTokens;
  webCssVariables: Record<string, string>;
};

const lightColors = {
  background: "#F3FCFE",
  foreground: "#102936",
  primary: "#00B8D9",
  primaryDim: "#0788A0",
  primaryDepth: "#0788A0",
  primaryContainer: "#E5F8FC",
  primaryFixed: "#00B8D9",
  onPrimary: "#FFFFFF",
  onPrimaryContainer: "#0788A0",
  secondary: "#FF8A5B",
  secondaryDim: "#C24A26",
  secondaryContainer: "#FFEDE3",
  tertiary: "#0788A0",
  tertiaryContainer: "#D5EFF5",
  reward: "#FFD166",
  rewardDim: "#C79300",
  rewardContainer: "#FFF3CE",
  onReward: "#102936",
  success: "#34C759",
  successDim: "#249B55",
  successContainer: "#E8F7EC",
  onSuccess: "#102936",
  warning: "#FFD166",
  warningContainer: "#FFF3CE",
  onWarningContainer: "#8A5C00",
  error: "#FF5A5F",
  errorDim: "#D94349",
  errorContainer: "#FFE8EA",
  onError: "#FFFFFF",
  info: "#00B8D9",
  infoContainer: "#E5F8FC",
  onInfo: "#FFFFFF",
  surface: "#FFFFFF",
  surfaceDim: "#F3FCFE",
  surfaceHigh: "#FFFFFF",
  surfaceHighest: "#E5F8FC",
  surfaceContainer: "#F3FCFE",
  surfaceContainerLow: "#F8FDFF",
  surfaceContainerHigh: "#E5F8FC",
  surfaceContainerHighest: "#E5F8FC",
  surfaceContainerLowest: "#FFFFFF",
  outline: "#CDECF3",
  outlineVariant: "#CDECF3",
  inverse: "#102936",
  inverseText: "#FFFFFF",
  muted: "#657B84",
  placeholder: "#8AA0A8",
  chartPrimary: "#00B8D9",
  chartSecondary: "#34C759",
  chartTertiary: "#FFD166",
  // Categorical chart ramp (design.md §Chart Colors, blue-first). Semantic
  // intent over index order: chart3=positive, chart4=caution, chart7=negative.
  chart1: "#00B8D9",
  chart2: "#8BE8F7",
  chart3: "#34C759",
  chart4: "#F5B942",
  chart5: "#7B61FF",
  chart6: "#0788A0",
  chart7: "#FF7A59",
  chartGrid: "#E3EEF1",
  chartAxis: "#657B84",
  chartTooltipBg: "#FFFFFF",
  chartTooltipText: "#102936",
  chartCrosshair: "#CDECF3",
  courseAccent: "#00B8D9",
} satisfies ThinkfyColorRoles;

const darkColors = {
  background: "#06151A",
  foreground: "#F3FCFE",
  primary: "#00B8D9",
  primaryDim: "#00B8D9",
  primaryDepth: "#0788A0",
  primaryContainer: "#0B3440",
  primaryFixed: "#8BE8F7",
  onPrimary: "#05242B",
  onPrimaryContainer: "#DFFAFF",
  secondary: "#FFAE86",
  secondaryDim: "#FF8A5B",
  secondaryContainer: "#4A2416",
  tertiary: "#7ED4E8",
  tertiaryContainer: "#092F39",
  reward: "#FFE08A",
  rewardDim: "#FFD166",
  rewardContainer: "#3D2F00",
  onReward: "#102936",
  success: "#6FE08D",
  successDim: "#34C759",
  successContainer: "#0D2D1C",
  onSuccess: "#05242B",
  warning: "#FFE08A",
  warningContainer: "#3D2F00",
  onWarningContainer: "#FFF1B2",
  error: "#FF8A8E",
  errorDim: "#FF6B70",
  errorContainer: "#42171A",
  onError: "#210506",
  info: "#8BE8F7",
  infoContainer: "#092F39",
  onInfo: "#061A20",
  surface: "#0A2730",
  surfaceDim: "#06151A",
  surfaceHigh: "#0E3A46",
  surfaceHighest: "#125161",
  surfaceContainer: "#0E3A46",
  surfaceContainerLow: "#082832",
  surfaceContainerHigh: "#104653",
  surfaceContainerHighest: "#125161",
  surfaceContainerLowest: "#061C23",
  outline: "#2E6574",
  outlineVariant: "#1E5363",
  inverse: "#F3FCFE",
  inverseText: "#102936",
  muted: "#9BB8C1",
  placeholder: "#789CA7",
  chartPrimary: "#00B8D9",
  chartSecondary: "#8BE8F7",
  chartTertiary: "#FFE08A",
  // Categorical ramp brightened for the dark surface (#0A2730).
  chart1: "#22C9E6",
  chart2: "#8BE8F7",
  chart3: "#6FE08D",
  chart4: "#FFD166",
  chart5: "#A78BFA",
  chart6: "#34D3EC",
  chart7: "#FF9B80",
  chartGrid: "#1E5363",
  chartAxis: "#9BB8C1",
  chartTooltipBg: "#0E3A46",
  chartTooltipText: "#F3FCFE",
  chartCrosshair: "#2E6574",
  courseAccent: "#8BE8F7",
} satisfies ThinkfyColorRoles;

function makeComponentTokens(colors: ThinkfyColorRoles): ThinkfyComponentTokens {
  return {
    button: {
      primary: {
        background: colors.primary,
        highlight: colors.primaryFixed,
        border: colors.primary,
        text: colors.onPrimary,
        shadow: colors.primaryDepth,
        hoverBackground: colors.primaryFixed,
        pressedBackground: colors.primaryDim,
        disabledBackground: colors.surfaceContainerHigh,
        disabledText: colors.muted,
      },
      secondary: {
        background: colors.surfaceContainerLowest,
        highlight: colors.surfaceContainerLowest,
        border: colors.outline,
        text: colors.primaryDim,
        shadow: colors.outlineVariant,
        hoverBackground: colors.surfaceContainer,
        pressedBackground: colors.surfaceDim,
        disabledBackground: colors.surfaceDim,
        disabledText: colors.muted,
      },
      ghost: {
        background: "transparent",
        highlight: "transparent",
        border: "transparent",
        text: colors.primaryDim,
        shadow: "transparent",
        hoverBackground: colors.surfaceDim,
        pressedBackground: colors.surfaceHighest,
        disabledBackground: "transparent",
        disabledText: colors.muted,
      },
      destructive: {
        background: colors.errorContainer,
        highlight: colors.errorContainer,
        border: colors.errorContainer,
        text: colors.errorDim,
        shadow: colors.errorDim,
        hoverBackground: colors.errorContainer,
        pressedBackground: colors.errorContainer,
        disabledBackground: colors.surfaceDim,
        disabledText: colors.muted,
      },
      reward: {
        background: colors.reward,
        highlight: colors.rewardContainer,
        border: colors.reward,
        text: colors.onReward,
        shadow: colors.rewardDim,
        hoverBackground: colors.reward,
        pressedBackground: colors.rewardDim,
        disabledBackground: colors.surfaceHighest,
        disabledText: colors.muted,
      },
    },
    card: {
      background: colors.surfaceContainerLowest,
      border: colors.outlineVariant,
      text: colors.foreground,
      shadow: colors.inverse,
    },
    input: {
      background: colors.surfaceContainerLowest,
      border: colors.outlineVariant,
      text: colors.foreground,
      placeholder: colors.placeholder,
      focusBorder: colors.primary,
      focusRing: colors.primaryFixed,
      disabledBackground: colors.surfaceDim,
    },
    badge: {
      primary: {
        background: colors.primaryContainer,
        text: colors.primaryDim,
        border: colors.primaryContainer,
      },
      secondary: {
        background: colors.secondaryContainer,
        text: colors.secondaryDim,
        border: colors.secondaryContainer,
      },
      tertiary: {
        background: colors.tertiaryContainer,
        text: colors.tertiary,
        border: colors.tertiaryContainer,
      },
      reward: {
        background: colors.rewardContainer,
        text: colors.rewardDim,
        border: colors.rewardContainer,
      },
      success: {
        background: colors.successContainer,
        text: colors.successDim,
        border: colors.successContainer,
      },
      warning: {
        background: colors.warningContainer,
        text: colors.onWarningContainer,
        border: colors.warningContainer,
      },
      error: {
        background: colors.errorContainer,
        text: colors.errorDim,
        border: colors.errorContainer,
      },
      info: {
        background: colors.infoContainer,
        text: colors.info,
        border: colors.infoContainer,
      },
      neutral: {
        background: colors.surfaceDim,
        text: colors.muted,
        border: colors.outlineVariant,
      },
    },
    progress: {
      track: colors.surfaceDim,
      fill: colors.primaryFixed,
      rewardFill: colors.reward,
      successFill: colors.success,
    },
    sidebar: {
      background: "#102936",
      softBackground: "#183B49",
      text: "#FFFFFF",
      mutedText: "#8BE8F7",
      accent: "#00B8D9",
      hoverBackground: "rgba(0, 184, 217, 0.12)",
      selectedBackground: "rgba(0, 184, 217, 0.22)",
      selectedText: "#FFFFFF",
      selectedAccent: "#00B8D9",
      selectedShadow: "#071A22",
    },
    focusRing: colors.primaryFixed,
  };
}

function makeWebCssVariables(
  colors: ThinkfyColorRoles,
  components: ThinkfyComponentTokens
) {
  return {
    "--color-background": colors.background,
    "--color-foreground": colors.foreground,
    "--color-primary": colors.primary,
    "--color-primary-dim": colors.primaryDim,
    "--color-primary-depth": colors.primaryDepth,
    "--color-primary-container": colors.primaryContainer,
    "--color-primary-fixed": colors.primaryFixed,
    "--color-primary-fixed-dim": colors.primaryFixed,
    "--color-on-primary": colors.onPrimary,
    "--color-on-primary-container": colors.onPrimaryContainer,
    "--color-on-primary-fixed": colors.inverse,
    "--color-on-primary-fixed-variant": colors.primaryDim,
    "--color-inverse-primary": colors.primaryFixed,
    "--color-secondary": colors.secondary,
    "--color-secondary-dim": colors.secondaryDim,
    "--color-secondary-container": colors.secondaryContainer,
    "--color-secondary-fixed": colors.secondaryContainer,
    "--color-secondary-fixed-dim": colors.secondaryContainer,
    "--color-on-secondary": colors.onPrimary,
    "--color-on-secondary-container": colors.secondaryDim,
    "--color-on-secondary-fixed": colors.secondaryDim,
    "--color-on-secondary-fixed-variant": colors.secondaryDim,
    "--color-tertiary": colors.tertiary,
    "--color-tertiary-dim": colors.tertiary,
    "--color-tertiary-container": colors.tertiaryContainer,
    "--color-tertiary-fixed": colors.tertiaryContainer,
    "--color-tertiary-fixed-dim": colors.tertiaryContainer,
    "--color-on-tertiary": colors.onPrimary,
    "--color-on-tertiary-container": colors.tertiary,
    "--color-on-tertiary-fixed": colors.tertiary,
    "--color-on-tertiary-fixed-variant": colors.tertiary,
    "--color-reward": colors.reward,
    "--color-reward-dim": colors.rewardDim,
    "--color-reward-container": colors.rewardContainer,
    "--color-on-reward": colors.onReward,
    "--color-error": colors.error,
    "--color-error-dim": colors.errorDim,
    "--color-error-container": colors.errorContainer,
    "--color-on-error": colors.onError,
    "--color-on-error-container": colors.errorDim,
    "--color-success": colors.success,
    "--color-success-dim": colors.successDim,
    "--color-success-container": colors.successContainer,
    "--color-on-success": colors.onSuccess,
    "--color-warning": colors.warning,
    "--color-warning-container": colors.warningContainer,
    "--color-on-warning-container": colors.onWarningContainer,
    "--color-info": colors.info,
    "--color-info-container": colors.infoContainer,
    "--color-on-info": colors.onInfo,
    "--color-surface": colors.surface,
    "--color-surface-dim": colors.surfaceDim,
    "--color-surface-bright": colors.surface,
    "--color-surface-tint": colors.primary,
    "--color-surface-variant": colors.surfaceDim,
    "--color-surface-container": colors.surfaceContainer,
    "--color-surface-container-low": colors.surfaceContainerLow,
    "--color-surface-container-high": colors.surfaceContainerHigh,
    "--color-surface-container-highest": colors.surfaceContainerHighest,
    "--color-surface-container-lowest": colors.surfaceContainerLowest,
    "--color-sidebar": components.sidebar.background,
    "--color-sidebar-soft": components.sidebar.softBackground,
    "--color-sidebar-foreground": components.sidebar.text,
    "--color-sidebar-muted": components.sidebar.mutedText,
    "--color-sidebar-accent": components.sidebar.accent,
    "--color-on-surface": colors.foreground,
    "--color-on-surface-variant": colors.muted,
    "--color-on-background": colors.foreground,
    "--color-inverse-surface": colors.inverse,
    "--color-inverse-on-surface": colors.inverseText,
    "--color-outline": colors.outline,
    "--color-outline-variant": colors.outlineVariant,
    "--color-card": components.card.background,
    "--color-card-foreground": components.card.text,
    "--color-popover": components.card.background,
    "--color-popover-foreground": components.card.text,
    "--color-primary-foreground": components.button.primary.text,
    "--color-secondary-foreground": colors.foreground,
    "--color-muted": colors.surfaceDim,
    "--color-muted-foreground": colors.muted,
    "--color-accent": colors.surfaceDim,
    "--color-accent-foreground": colors.foreground,
    "--color-destructive": colors.error,
    "--color-border": colors.outlineVariant,
    "--color-input": components.input.border,
    "--color-ring": components.input.focusRing,
    "--button-primary-bg": components.button.primary.background,
    "--button-primary-highlight": components.button.primary.highlight,
    "--button-primary-text": components.button.primary.text,
    "--button-primary-shadow": components.button.primary.shadow,
    "--button-primary-hover-bg": components.button.primary.hoverBackground,
    "--button-primary-pressed-bg": components.button.primary.pressedBackground,
    "--button-primary-disabled-bg": components.button.primary.disabledBackground,
    "--button-primary-disabled-text": components.button.primary.disabledText,
    "--button-secondary-bg": components.button.secondary.background,
    "--button-secondary-text": components.button.secondary.text,
    "--button-secondary-border": components.button.secondary.border,
    "--button-secondary-shadow": components.button.secondary.shadow,
    "--button-secondary-hover-bg": components.button.secondary.hoverBackground,
    "--button-secondary-pressed-bg": components.button.secondary.pressedBackground,
    "--button-reward-bg": components.button.reward.background,
    "--button-reward-highlight": components.button.reward.highlight,
    "--button-reward-text": components.button.reward.text,
    "--button-reward-shadow": components.button.reward.shadow,
    "--button-reward-hover-bg": components.button.reward.hoverBackground,
    "--button-reward-pressed-bg": components.button.reward.pressedBackground,
    "--card-bg": components.card.background,
    "--card-border": components.card.border,
    "--card-shadow": components.card.shadow,
    "--input-bg": components.input.background,
    "--input-border": components.input.border,
    "--input-focus-border": components.input.focusBorder,
    "--input-focus-ring": components.input.focusRing,
    "--progress-track": components.progress.track,
    "--progress-fill": components.progress.fill,
    "--progress-reward-fill": components.progress.rewardFill,
    "--sidebar-bg": components.sidebar.background,
    "--sidebar-soft-bg": components.sidebar.softBackground,
    "--sidebar-text": components.sidebar.text,
    "--sidebar-muted-text": components.sidebar.mutedText,
    "--sidebar-accent": components.sidebar.accent,
    "--sidebar-hover-bg": components.sidebar.hoverBackground,
    "--sidebar-selected-bg": components.sidebar.selectedBackground,
    "--sidebar-selected-text": components.sidebar.selectedText,
    "--sidebar-selected-accent": components.sidebar.selectedAccent,
    "--sidebar-selected-shadow": components.sidebar.selectedShadow,
    "--color-chart-1": colors.chart1,
    "--color-chart-2": colors.chart2,
    "--color-chart-3": colors.chart3,
    "--color-chart-4": colors.chart4,
    "--color-chart-5": colors.chart5,
    "--color-chart-6": colors.chart6,
    "--color-chart-7": colors.chart7,
    "--color-chart-grid": colors.chartGrid,
    "--color-chart-axis": colors.chartAxis,
    "--color-chart-tooltip-bg": colors.chartTooltipBg,
    "--color-chart-tooltip-text": colors.chartTooltipText,
    "--color-chart-crosshair": colors.chartCrosshair,
    // The bklit (@bklitui/ui) --chart-* bridge lives in globals.css (it maps onto
    // these --color-chart-* tokens via var(), so it theme-switches automatically).
  } as const;
}

function makeTheme(mode: ThinkfyThemeMode, colors: ThinkfyColorRoles): ThinkfyTheme {
  const components = makeComponentTokens(colors);
  return {
    mode,
    colors,
    components,
    webCssVariables: makeWebCssVariables(colors, components),
  };
}

export const thinkfyThemes = {
  light: makeTheme("light", lightColors),
  dark: makeTheme("dark", darkColors),
} as const satisfies Record<ThinkfyThemeMode, ThinkfyTheme>;

export function getThinkfyTheme(mode: ThinkfyThemeMode): ThinkfyTheme {
  return thinkfyThemes[mode];
}

export function getThinkfyWebCssVariables(mode: ThinkfyThemeMode) {
  return getThinkfyTheme(mode).webCssVariables;
}

export type ThinkfyFontRole = "display" | "sans" | "serif" | "mono";

export type ThinkfyTypeStep = {
  /** Tailwind v4 @utility class defined in apps/web/src/app/globals.css */
  utility: string;
  family: ThinkfyFontRole;
  /** px */
  size: number;
  /** unitless */
  lineHeight: number;
  weight: number;
  /** em */
  tracking: number;
  uppercase?: boolean;
};

/**
 * Single source of truth for the web typography scale. The runtime values live
 * as Tailwind v4 `@utility type-*` rules in apps/web/src/app/globals.css and as
 * the <Display>/<Heading>/<Text>/<Eyebrow>/<Stat>/<Code> primitives in
 * apps/web/src/components/ui/typography.tsx. This object documents them for
 * parity with the color tokens above. See design.md §Typography.
 */
export const thinkfyTypography = {
  family: {
    display: "Nunito",
    sans: "Be Vietnam Pro",
    serif: "Noto Serif",
    mono: "Geist Mono",
  },
  step: {
    displayXl: { utility: "type-display-xl", family: "display", size: 72, lineHeight: 1.04, weight: 800, tracking: -0.022 },
    displayLg: { utility: "type-display-lg", family: "display", size: 56, lineHeight: 1.06, weight: 800, tracking: -0.02 },
    displayMd: { utility: "type-display-md", family: "display", size: 44, lineHeight: 1.08, weight: 800, tracking: -0.018 },
    displaySm: { utility: "type-display-sm", family: "display", size: 36, lineHeight: 1.1, weight: 700, tracking: -0.015 },
    headingXl: { utility: "type-heading-xl", family: "sans", size: 30, lineHeight: 1.2, weight: 700, tracking: -0.012 },
    headingLg: { utility: "type-heading-lg", family: "sans", size: 24, lineHeight: 1.25, weight: 700, tracking: -0.01 },
    headingMd: { utility: "type-heading-md", family: "sans", size: 20, lineHeight: 1.3, weight: 600, tracking: -0.006 },
    title: { utility: "type-title", family: "sans", size: 17, lineHeight: 1.35, weight: 600, tracking: -0.003 },
    bodyLg: { utility: "type-body-lg", family: "sans", size: 18, lineHeight: 1.6, weight: 400, tracking: 0 },
    body: { utility: "type-body", family: "sans", size: 16, lineHeight: 1.6, weight: 400, tracking: 0 },
    bodySm: { utility: "type-body-sm", family: "sans", size: 14, lineHeight: 1.55, weight: 400, tracking: 0 },
    caption: { utility: "type-caption", family: "sans", size: 12, lineHeight: 1.45, weight: 500, tracking: 0.002 },
    label: { utility: "type-label", family: "sans", size: 13, lineHeight: 1.3, weight: 600, tracking: 0 },
    eyebrow: { utility: "type-eyebrow", family: "sans", size: 12, lineHeight: 1.2, weight: 700, tracking: 0.14, uppercase: true },
    code: { utility: "type-code", family: "mono", size: 14, lineHeight: 1.5, weight: 400, tracking: 0 },
    prose: { utility: "type-prose", family: "serif", size: 16, lineHeight: 1.7, weight: 400, tracking: 0 },
  },
} as const satisfies {
  family: Record<ThinkfyFontRole, string>;
  step: Record<string, ThinkfyTypeStep>;
};

export type ThinkfyMotionSpring = {
  type: "spring";
  stiffness: number;
  damping: number;
};

/**
 * Motion tokens — the timing/easing analog to the color + type systems.
 * Durations are in **seconds** (framer-motion native). CSS mirrors live as
 * `--motion-duration-*` / `--motion-ease-*` in apps/web/src/app/globals.css.
 * Easings are cubic-bezier control points. See docs/analytics-ui-revamp-masterplan.md.
 */
export const thinkfyMotion = {
  duration: { fast: 0.15, base: 0.25, slow: 0.4 },
  ease: {
    standard: [0.2, 0, 0, 1],
    emphasized: [0.3, 0, 0, 1],
    overshoot: [0.34, 1.56, 0.64, 1],
  },
  spring: {
    soft: { type: "spring", stiffness: 260, damping: 25 },
    snappy: { type: "spring", stiffness: 300, damping: 24 },
  },
} as const satisfies {
  duration: Record<"fast" | "base" | "slow", number>;
  ease: Record<"standard" | "emphasized" | "overshoot", readonly [number, number, number, number]>;
  spring: Record<"soft" | "snappy", ThinkfyMotionSpring>;
};
