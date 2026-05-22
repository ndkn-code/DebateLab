import { ThemeProvider } from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useColorScheme } from "react-native";

import { thinkfyDarkTheme, thinkfyLightTheme } from "@/design/navigation-theme";
import { AuthProvider } from "@/lib/auth";
import { PracticeSessionProvider } from "@/lib/practice-session";

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  return (
    <AuthProvider>
      <PracticeSessionProvider>
        <ThemeProvider value={isDark ? thinkfyDarkTheme : thinkfyLightTheme}>
          <Stack screenOptions={{ headerShown: false }} />
          <StatusBar style={isDark ? "light" : "dark"} />
        </ThemeProvider>
      </PracticeSessionProvider>
    </AuthProvider>
  );
}
