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
  secondary: "#00B8D9",
  secondaryDim: "#00B8D9",
  secondaryContainer: "#E5F8FC",
  tertiary: "#00B8D9",
  tertiaryContainer: "#E5F8FC",
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
  secondary: "#8BE8F7",
  secondaryDim: "#00B8D9",
  secondaryContainer: "#0B3440",
  tertiary: "#8BE8F7",
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
