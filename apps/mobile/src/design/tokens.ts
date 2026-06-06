import { getThinkfyTheme } from "@thinkfy/shared/design-system";

export const lightColors = getThinkfyTheme("light").colors;
export const darkColors = getThinkfyTheme("dark").colors;

export type ThinkfyColorScheme = "light" | "dark";
type ThinkfyColorName = keyof typeof lightColors;
export type ThinkfyColors = Record<ThinkfyColorName, string>;

export function getColors(scheme: ThinkfyColorScheme): ThinkfyColors {
  return scheme === "dark" ? darkColors : lightColors;
}

export const spacing = {
  xxs: 4,
  xs: 6,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  screen: 20,
} as const;

export const radius = {
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 20,
  round: 999,
} as const;

export const typography = {
  display: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "800",
  },
  title: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: "800",
  },
  heading: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: "800",
  },
  body: {
    fontSize: 16,
    lineHeight: 23,
    fontWeight: "500",
  },
  bodyStrong: {
    fontSize: 16,
    lineHeight: 23,
    fontWeight: "800",
  },
  caption: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
  },
  micro: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "800",
  },
} as const;

export const shadows = {
  card: {
    shadowColor: lightColors.inverse,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.08,
    shadowRadius: 28,
    elevation: 3,
  },
  button: {
    shadowColor: lightColors.primaryDim,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 3,
  },
} as const;
