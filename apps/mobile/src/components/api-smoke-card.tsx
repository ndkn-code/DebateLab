import {
  ThinkfyApiError,
  createApiUrl,
  createThinkfyApiClient,
} from "@thinkfy/shared/api-client";
import { useCallback, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";

import {
  AppButton,
  AppText,
  Badge,
  StateBlock,
  Surface,
  useThinkfyColors,
} from "@/components/ui";
import { spacing } from "@/design/tokens";
import { useAuth } from "@/lib/auth";
import { isDesignPreviewEnabled } from "@/lib/design-preview";
import { mobileEnv } from "@/lib/env";

type SmokeResult = {
  ok: boolean;
  authSource: "bearer" | "cookie" | "dev-bypass";
  user: {
    id: string;
    email: string | null;
  };
  profile: {
    id: string;
    displayName: string | null;
    onboardingCompleted: boolean | null;
  } | null;
};

type ApiStatus =
  | { state: "idle"; label: string }
  | { state: "loading"; label: string }
  | { state: "success"; label: string; detail: string }
  | { state: "error"; label: string; detail: string };

export function ApiSmokeCard() {
  const colors = useThinkfyColors();
  const { user, getAccessToken } = useAuth();
  const isPreview = isDesignPreviewEnabled();
  const [apiStatus, setApiStatus] = useState<ApiStatus>({
    state: "idle",
    label: isPreview
      ? "Preview mode; live bearer test skipped"
      : "Waiting for a signed-in session",
  });

  const apiClient = useMemo(
    () =>
      mobileEnv.apiBaseUrl
        ? createThinkfyApiClient({ baseUrl: mobileEnv.apiBaseUrl })
        : null,
    []
  );
  const apiPreview = mobileEnv.apiBaseUrl
    ? createApiUrl(mobileEnv.apiBaseUrl, "/api/mobile/auth-smoke")
    : "API base pending";

  const runApiSmoke = useCallback(async () => {
    if (!user) {
      setApiStatus({
        state: isPreview ? "success" : "idle",
        label: isPreview
          ? "Design preview bypass active"
          : "Waiting for a signed-in session",
        detail: isPreview
          ? "No Supabase request was sent from the preview shell."
          : undefined,
      } as ApiStatus);
      return;
    }

    if (!apiClient) {
      setApiStatus({
        state: "error",
        label: "API base missing",
        detail: "Set EXPO_PUBLIC_API_BASE_URL before mobile API QA.",
      });
      return;
    }

    setApiStatus({ state: "loading", label: "Checking bearer API session" });

    try {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        throw new Error("Signed-in session has no access token.");
      }

      const result = await apiClient.requestJson<SmokeResult>(
        "/api/mobile/auth-smoke",
        { accessToken }
      );

      setApiStatus({
        state: "success",
        label: "Bearer API session accepted",
        detail: `${result.authSource} / ${
          result.profile?.displayName ?? result.user.email ?? result.user.id
        }`,
      });
    } catch (error) {
      const detail =
        error instanceof ThinkfyApiError
          ? `${error.status}: ${error.message}`
          : error instanceof Error
            ? error.message
            : "API smoke test failed.";

      setApiStatus({
        state: "error",
        label: "Bearer API session failed",
        detail,
      });
    }
  }, [apiClient, getAccessToken, isPreview, user]);

  if (!user && !isPreview) {
    return (
      <StateBlock
        body="Sign in with Google or Apple before checking the mobile bearer-token API contract."
        state="empty"
        title="API smoke pending"
      />
    );
  }

  return (
    <Surface>
      <View style={styles.header}>
        <View style={styles.copy}>
          <AppText variant="heading">API smoke</AppText>
          <AppText color={colors.muted} variant="caption">
            {apiPreview}
          </AppText>
        </View>
        <Badge tone={apiStatus.state === "success" ? "success" : "neutral"}>
          {apiStatus.state}
        </Badge>
      </View>
      <View style={styles.detail}>
        <AppText variant="bodyStrong">{apiStatus.label}</AppText>
        {"detail" in apiStatus ? (
          <AppText
            color={apiStatus.state === "error" ? colors.errorDim : colors.muted}
            variant="caption"
          >
            {apiStatus.detail}
          </AppText>
        ) : null}
      </View>
      <AppButton
        isLoading={apiStatus.state === "loading"}
        onPress={runApiSmoke}
        variant="secondary"
      >
        {apiStatus.state === "loading" ? "Checking..." : "Recheck API"}
      </AppButton>
    </Surface>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
  },
  copy: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
  detail: {
    gap: spacing.xs,
  },
});
