import type { Theme } from "@react-navigation/native";

import { darkColors, lightColors } from "@/design/tokens";

export const thinkfyLightTheme: Theme = {
  dark: false,
  colors: {
    primary: lightColors.primary,
    background: lightColors.background,
    card: lightColors.surface,
    text: lightColors.foreground,
    border: lightColors.outlineVariant,
    notification: lightColors.warning,
  },
  fonts: {
    regular: { fontFamily: "System", fontWeight: "400" },
    medium: { fontFamily: "System", fontWeight: "500" },
    bold: { fontFamily: "System", fontWeight: "700" },
    heavy: { fontFamily: "System", fontWeight: "800" },
  },
};

export const thinkfyDarkTheme: Theme = {
  dark: true,
  colors: {
    primary: darkColors.primary,
    background: darkColors.background,
    card: darkColors.surface,
    text: darkColors.foreground,
    border: darkColors.outlineVariant,
    notification: darkColors.warning,
  },
  fonts: thinkfyLightTheme.fonts,
};
