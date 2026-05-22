import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import {
  GoogleSignin,
  isCancelledResponse,
  isSuccessResponse,
} from "@react-native-google-signin/google-signin";
import type { Session, User } from "@supabase/supabase-js";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import { Platform } from "react-native";

import { isDesignPreviewEnabled } from "@/lib/design-preview";
import { getGoogleIosClientId, mobileEnv } from "@/lib/env";
import { assertSupabaseConfig, supabase } from "@/lib/supabase";

type AuthProviderName = "google" | "apple" | "email" | "unknown";

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  isSigningIn: boolean;
  authError: string | null;
  provider: AuthProviderName;
  lastTokenRefreshAt: string | null;
  isAppleAvailable: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithGoogleOAuthForE2E: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  signOut: () => Promise<void>;
  getAccessToken: () => Promise<string | null>;
  clearAuthError: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

let googleConfigured = false;
WebBrowser.maybeCompleteAuthSession();

function getProvider(user: User | null): AuthProviderName {
  const provider = user?.app_metadata?.provider;

  if (provider === "google" || provider === "apple" || provider === "email") {
    return provider;
  }

  return user ? "unknown" : "unknown";
}

function formatAppleDisplayName(
  fullName: AppleAuthentication.AppleAuthenticationFullName | null,
) {
  if (!fullName) return null;

  const parts = [
    fullName.givenName,
    fullName.middleName,
    fullName.familyName,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(" ") : null;
}

function isAppleCancel(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ERR_REQUEST_CANCELED"
  );
}

function readOAuthParams(url: string) {
  const queryIndex = url.indexOf("?");
  const hashIndex = url.indexOf("#");
  const query =
    queryIndex >= 0
      ? url.slice(queryIndex + 1, hashIndex >= 0 ? hashIndex : undefined)
      : "";
  const hash = hashIndex >= 0 ? url.slice(hashIndex + 1) : "";
  const params = new URLSearchParams(query);
  const hashParams = new URLSearchParams(hash);

  return {
    code: params.get("code") ?? hashParams.get("code"),
    accessToken: params.get("access_token") ?? hashParams.get("access_token"),
    refreshToken:
      params.get("refresh_token") ?? hashParams.get("refresh_token"),
    error:
      params.get("error_description") ??
      hashParams.get("error_description") ??
      params.get("error") ??
      hashParams.get("error"),
  };
}

function ensureGoogleConfigured() {
  if (googleConfigured) return;

  if (!mobileEnv.googleWebClientId || !mobileEnv.googleIosUrlScheme) {
    throw new Error(
      "Missing Google native auth config. Set EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID and EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME.",
    );
  }

  const googleIosClientId = getGoogleIosClientId();
  if (!googleIosClientId) {
    throw new Error(
      "EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME must start with com.googleusercontent.apps.",
    );
  }

  GoogleSignin.configure({
    webClientId: mobileEnv.googleWebClientId,
    iosClientId: googleIosClientId,
    scopes: ["openid", "email", "profile"],
  });

  googleConfigured = true;
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [lastTokenRefreshAt, setLastTokenRefreshAt] = useState<string | null>(
    null,
  );
  const [isAppleAvailable, setIsAppleAvailable] = useState(false);

  useEffect(() => {
    let isMounted = true;

    if (isDesignPreviewEnabled()) {
      setSession(null);
      setIsAppleAvailable(false);
      setIsLoading(false);
      return () => {
        isMounted = false;
      };
    }

    AppleAuthentication.isAvailableAsync()
      .then((available) => {
        if (isMounted) setIsAppleAvailable(available);
      })
      .catch(() => {
        if (isMounted) setIsAppleAvailable(false);
      });

    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!isMounted) return;
        if (error) setAuthError(error.message);
        setSession(data.session);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      if (event === "TOKEN_REFRESHED") {
        setLastTokenRefreshAt(new Date().toISOString());
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signInWithGoogleOAuthForE2E = useCallback(async () => {
    setAuthError(null);
    setIsSigningIn(true);

    try {
      assertSupabaseConfig();

      if (
        !__DEV__ ||
        mobileEnv.appEnv !== "development" ||
        !mobileEnv.enableE2ELogin
      ) {
        throw new Error("E2E Google sign-in is disabled.");
      }

      const redirectTo = Linking.createURL("auth/callback", {
        scheme: "thinkfy",
      });
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
          skipBrowserRedirect: true,
          queryParams: {
            access_type: "offline",
            prompt: "select_account",
          },
        },
      });

      if (error) throw error;
      if (!data.url) {
        throw new Error("Supabase did not return a Google OAuth URL.");
      }

      const result = await WebBrowser.openAuthSessionAsync(
        data.url,
        redirectTo,
      );
      if (result.type !== "success") return;

      const oauthParams = readOAuthParams(result.url);
      if (oauthParams.error) {
        throw new Error(oauthParams.error);
      }

      const sessionResult =
        oauthParams.accessToken && oauthParams.refreshToken
          ? await supabase.auth.setSession({
              access_token: oauthParams.accessToken,
              refresh_token: oauthParams.refreshToken,
            })
          : await supabase.auth.exchangeCodeForSession(result.url);

      if (sessionResult.error) throw sessionResult.error;
      setSession(sessionResult.data.session);
    } catch (error) {
      setAuthError(
        error instanceof Error ? error.message : "Google E2E sign-in failed.",
      );
    } finally {
      setIsSigningIn(false);
    }
  }, []);

  const signInWithGoogle = useCallback(async () => {
    setAuthError(null);
    setIsSigningIn(true);

    try {
      assertSupabaseConfig();
      ensureGoogleConfigured();

      if (Platform.OS === "android") {
        await GoogleSignin.hasPlayServices({
          showPlayServicesUpdateDialog: true,
        });
      }

      const response = await GoogleSignin.signIn();
      if (isCancelledResponse(response)) return;
      if (!isSuccessResponse(response) || !response.data.idToken) {
        throw new Error("Google did not return an ID token.");
      }

      const { error } = await supabase.auth.signInWithIdToken({
        provider: "google",
        token: response.data.idToken,
      });

      if (error) throw error;
    } catch (error) {
      setAuthError(
        error instanceof Error ? error.message : "Google sign-in failed.",
      );
    } finally {
      setIsSigningIn(false);
    }
  }, []);

  const signInWithApple = useCallback(async () => {
    setAuthError(null);
    setIsSigningIn(true);

    try {
      assertSupabaseConfig();

      if (!isAppleAvailable) {
        throw new Error("Sign in with Apple is not available on this device.");
      }

      const rawNonce = Crypto.randomUUID();
      const hashedNonce = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        rawNonce,
      );
      const state = Crypto.randomUUID();
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
        state,
      });

      if (credential.state !== state) {
        throw new Error("Apple sign-in state mismatch.");
      }

      if (!credential.identityToken) {
        throw new Error("Apple did not return an identity token.");
      }

      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: "apple",
        token: credential.identityToken,
        nonce: rawNonce,
      });

      if (error) throw error;

      const displayName = formatAppleDisplayName(credential.fullName);
      if (displayName && data.user) {
        await supabase.auth.updateUser({
          data: {
            display_name: displayName,
            full_name: displayName,
          },
        });
        await supabase
          .from("profiles")
          .update({ display_name: displayName })
          .eq("id", data.user.id);
      }
    } catch (error) {
      if (!isAppleCancel(error)) {
        setAuthError(
          error instanceof Error ? error.message : "Apple sign-in failed.",
        );
      }
    } finally {
      setIsSigningIn(false);
    }
  }, [isAppleAvailable]);

  const signOut = useCallback(async () => {
    setAuthError(null);

    try {
      await GoogleSignin.signOut().catch(() => null);
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Sign out failed.");
    }
  }, []);

  const getAccessToken = useCallback(async () => {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      setAuthError(error.message);
      return null;
    }

    setSession((currentSession) => {
      if (
        currentSession?.access_token === data.session?.access_token &&
        currentSession?.refresh_token === data.session?.refresh_token &&
        currentSession?.expires_at === data.session?.expires_at
      ) {
        return currentSession;
      }

      return data.session;
    });
    return data.session?.access_token ?? null;
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      isLoading,
      isSigningIn,
      authError,
      provider: getProvider(session?.user ?? null),
      lastTokenRefreshAt,
      isAppleAvailable,
      signInWithGoogle,
      signInWithGoogleOAuthForE2E,
      signInWithApple,
      signOut,
      getAccessToken,
      clearAuthError: () => setAuthError(null),
    }),
    [
      authError,
      getAccessToken,
      isAppleAvailable,
      isLoading,
      isSigningIn,
      lastTokenRefreshAt,
      session,
      signInWithApple,
      signInWithGoogleOAuthForE2E,
      signInWithGoogle,
      signOut,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }

  return context;
}
