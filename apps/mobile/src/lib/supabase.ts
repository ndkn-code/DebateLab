import "react-native-url-polyfill/auto";

import { Directory, File, Paths } from "expo-file-system";
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
const canUseDevFileAuthFallback =
  __DEV__ &&
  Platform.OS !== "web" &&
  hasSupabaseConfig &&
  mobileEnv.appEnv === "development" &&
  mobileEnv.enableE2ELogin;

function getDevAuthFallbackFile(key: string) {
  const directory = new Directory(Paths.document, "thinkfy-dev-auth");
  const fileName = `${encodeURIComponent(key)}.json`;

  return {
    directory,
    file: new File(directory, fileName),
  };
}

function readDevAuthFallbackItem(key: string) {
  if (!canUseDevFileAuthFallback) return null;

  try {
    const { file } = getDevAuthFallbackFile(key);
    return file.exists ? file.textSync() : null;
  } catch {
    return null;
  }
}

function writeDevAuthFallbackItem(key: string, value: string) {
  if (!canUseDevFileAuthFallback) return;

  try {
    const { directory, file } = getDevAuthFallbackFile(key);
    directory.create({ idempotent: true, intermediates: true });
    file.write(value);
  } catch {
    // Keep this as a best-effort dev-only fallback. SecureStore remains the
    // production storage path.
  }
}

function removeDevAuthFallbackItem(key: string) {
  if (!canUseDevFileAuthFallback) return;

  try {
    const { file } = getDevAuthFallbackFile(key);
    if (file.exists) file.delete();
  } catch {
    // See writeDevAuthFallbackItem.
  }
}

const secureStoreAdapter = {
  getItem: async (key: string) => {
    if (!canUseSecureStore) {
      return memoryAuthStorage.get(key) ?? readDevAuthFallbackItem(key);
    }

    try {
      return (
        (await SecureStore.getItemAsync(key)) ??
        readDevAuthFallbackItem(key)
      );
    } catch {
      return memoryAuthStorage.get(key) ?? readDevAuthFallbackItem(key);
    }
  },
  setItem: async (key: string, value: string) => {
    memoryAuthStorage.set(key, value);
    writeDevAuthFallbackItem(key, value);
    if (!canUseSecureStore) return;

    try {
      await SecureStore.setItemAsync(key, value);
    } catch {
      // Unsigned simulator builds can lack Keychain entitlements. The
      // dev-only file fallback above keeps local E2E auth restorable while
      // production remains on SecureStore.
    }
  },
  removeItem: async (key: string) => {
    memoryAuthStorage.delete(key);
    removeDevAuthFallbackItem(key);
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
