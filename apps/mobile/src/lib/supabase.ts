import "react-native-url-polyfill/auto";

import * as SecureStore from "expo-secure-store";
import { AppState, Platform } from "react-native";
import { createClient } from "@supabase/supabase-js";

import { isDesignPreviewEnabled } from "@/lib/design-preview";
import { mobileEnv } from "@/lib/env";

const fallbackSupabaseUrl = "https://example.supabase.co";
const fallbackSupabaseKey = "missing-public-supabase-key";

export const hasSupabaseConfig = Boolean(
  mobileEnv.supabaseUrl && mobileEnv.supabaseKey
);
const canUseSecureStore =
  Platform.OS !== "web" && hasSupabaseConfig && !isDesignPreviewEnabled();
const memoryAuthStorage = new Map<string, string>();

const secureStoreAdapter = {
  getItem: async (key: string) => {
    if (!canUseSecureStore) return memoryAuthStorage.get(key) ?? null;

    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      return memoryAuthStorage.get(key) ?? null;
    }
  },
  setItem: async (key: string, value: string) => {
    memoryAuthStorage.set(key, value);
    if (!canUseSecureStore) return;

    try {
      await SecureStore.setItemAsync(key, value);
    } catch {
      // Unsigned simulator builds can lack Keychain entitlements. Keep the
      // session in memory so local E2E auth still exercises bearer-token APIs.
    }
  },
  removeItem: async (key: string) => {
    memoryAuthStorage.delete(key);
    if (!canUseSecureStore) return;

    try {
      await SecureStore.deleteItemAsync(key);
    } catch {
      // See setItem fallback above.
    }
  },
};

export const supabase = createClient(
  mobileEnv.supabaseUrl || fallbackSupabaseUrl,
  mobileEnv.supabaseKey || fallbackSupabaseKey,
  {
    auth: {
      storage: secureStoreAdapter,
      autoRefreshToken: canUseSecureStore,
      persistSession: canUseSecureStore,
      detectSessionInUrl: false,
      flowType: mobileEnv.enableE2ELogin ? "implicit" : "pkce",
    },
  }
);

export function assertSupabaseConfig() {
  if (!hasSupabaseConfig) {
    throw new Error(
      "Missing EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY or EXPO_PUBLIC_SUPABASE_ANON_KEY."
    );
  }
}

AppState.addEventListener("change", (state) => {
  if (!hasSupabaseConfig) return;

  if (state === "active") {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});
