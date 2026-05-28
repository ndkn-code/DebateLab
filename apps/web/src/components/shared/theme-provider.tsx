"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import {
  createContext,
  useContext,
  type ReactNode,
} from "react";
import {
  APP_THEME_STORAGE_KEY,
  type AppTheme,
} from "@/lib/theme";

const InitialAppThemeContext = createContext<AppTheme>("light");

interface AppThemeProviderProps {
  children: ReactNode;
  initialTheme: AppTheme;
}

export function useInitialAppTheme() {
  return useContext(InitialAppThemeContext);
}

export function AppThemeProvider({
  children,
  initialTheme,
}: AppThemeProviderProps) {
  return (
    <InitialAppThemeContext.Provider value={initialTheme}>
      <NextThemesProvider
        attribute="class"
        defaultTheme={initialTheme}
        enableSystem={false}
        disableTransitionOnChange
        storageKey={APP_THEME_STORAGE_KEY}
        themes={["light", "dark"]}
      >
        {children}
      </NextThemesProvider>
    </InitialAppThemeContext.Provider>
  );
}
