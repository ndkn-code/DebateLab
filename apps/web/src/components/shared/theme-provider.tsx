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
const CspNonceContext = createContext<string | undefined>(undefined);

interface AppThemeProviderProps {
  children: ReactNode;
  initialTheme: AppTheme;
  nonce?: string;
}

export function useInitialAppTheme() {
  return useContext(InitialAppThemeContext);
}

export function useCspNonce() {
  return useContext(CspNonceContext);
}

export function AppThemeProvider({
  children,
  initialTheme,
  nonce,
}: AppThemeProviderProps) {
  return (
    <InitialAppThemeContext.Provider value={initialTheme}>
      <CspNonceContext.Provider value={nonce}>
        <NextThemesProvider
          attribute="class"
          defaultTheme={initialTheme}
          enableSystem={false}
          disableTransitionOnChange
          nonce={nonce}
          storageKey={APP_THEME_STORAGE_KEY}
          themes={["light", "dark"]}
        >
          {children}
        </NextThemesProvider>
      </CspNonceContext.Provider>
    </InitialAppThemeContext.Provider>
  );
}
