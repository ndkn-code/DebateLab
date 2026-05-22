export const lightColors = {
  background: "#F7FAFE",
  foreground: "#162033",
  muted: "#718096",
  primary: "#4D86F7",
  primaryDim: "#3E78EC",
  primaryContainer: "#EEF4FF",
  primaryFixed: "#A9C6FB",
  secondary: "#34C759",
  secondaryDim: "#249B55",
  secondaryContainer: "#E8F7EC",
  tertiary: "#7B61FF",
  tertiaryContainer: "#F1EDFF",
  warning: "#F5B942",
  warningContainer: "#FFF4E2",
  error: "#EF6A6A",
  errorDim: "#B84747",
  errorContainer: "#FDECEC",
  surface: "#FFFFFF",
  surfaceDim: "#F1F6FD",
  surfaceHigh: "#EEF4FF",
  surfaceHighest: "#DEE8F8",
  outline: "#BCC6D3",
  outlineVariant: "#DEE8F8",
  inverse: "#0B1424",
  inverseText: "#FFFFFF",
} as const;

export const darkColors = {
  background: "#08111F",
  foreground: "#F3F7FF",
  muted: "#AAB7CC",
  primary: "#8FB5FA",
  primaryDim: "#6D9DF8",
  primaryContainer: "#162B52",
  primaryFixed: "#A9C6FB",
  secondary: "#6BDB8A",
  secondaryDim: "#39B864",
  secondaryContainer: "#10351E",
  tertiary: "#B0A1FF",
  tertiaryContainer: "#2A2354",
  warning: "#F8CA63",
  warningContainer: "#3C2B08",
  error: "#FF8A85",
  errorDim: "#F06B66",
  errorContainer: "#3B1516",
  surface: "#101A2B",
  surfaceDim: "#0D1728",
  surfaceHigh: "#16243A",
  surfaceHighest: "#25354D",
  outline: "#52627A",
  outlineVariant: "#2B3B52",
  inverse: "#F7FAFE",
  inverseText: "#0B1424",
} as const;

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
    shadowColor: "#0B1424",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.08,
    shadowRadius: 28,
    elevation: 3,
  },
  button: {
    shadowColor: "#2C6CF6",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 3,
  },
} as const;
