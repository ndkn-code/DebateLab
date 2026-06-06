import * as AppleAuthentication from "expo-apple-authentication";
import { SymbolView } from "expo-symbols";
import { StyleSheet, View } from "react-native";

import {
  AppButton,
  AppText,
  Badge,
  GlassSurface,
  IconBadge,
  ProgressBar,
  Screen,
  Surface,
  useThinkfyColors,
} from "@/components/ui";
import { radius, spacing } from "@/design/tokens";
import { useAuth } from "@/lib/auth";
import { getMissingMobileEnvKeys, mobileEnv } from "@/lib/env";

const missingEnvKeys = getMissingMobileEnvKeys();

export function AuthScreen() {
  const colors = useThinkfyColors();
  const {
    authError,
    isAppleAvailable,
    isSigningIn,
    signInWithGoogleOAuthForE2E,
    signInWithApple,
    signInWithGoogle,
  } = useAuth();
  const canAttemptAuth = missingEnvKeys.length === 0;
  const canUseE2ELogin =
    __DEV__ &&
    mobileEnv.appEnv === "development" &&
    mobileEnv.enableE2ELogin &&
    Boolean(mobileEnv.supabaseUrl && mobileEnv.supabaseKey);

  return (
    <Screen
      eyebrow="Thinkfy iOS"
      subtitle="Practice speaking with a daily plan, fast feedback, and a coach that keeps the next step clear."
      title="Build your speaking streak"
      testID="auth-screen"
    >
      <GlassSurface style={styles.hero}>
        <View style={styles.heroTop}>
          <IconBadge name="sparkles" size={42} />
          <Badge tone="success">Prototype path</Badge>
        </View>
        <View style={styles.heroCopy}>
          <AppText variant="heading">Today starts with one drill</AppText>
          <AppText color={colors.muted} variant="body">
            Sign in natively to unlock the student app shell and continue the
            iOS build path.
          </AppText>
        </View>
        <View style={styles.progressRow}>
          <AppText color={colors.muted} variant="caption">
            Week 1 prototype
          </AppText>
          <AppText color={colors.primary} variant="caption">
            3 of 5 foundations
          </AppText>
        </View>
        <ProgressBar value={0.6} />
      </GlassSurface>

      <View style={styles.authStack}>
        <AppButton
          disabled={isSigningIn || !canAttemptAuth}
          isLoading={isSigningIn}
          onPress={signInWithGoogle}
          variant="ghost"
        >
          Continue with Google
        </AppButton>

        {isAppleAvailable ? (
          <AppleAuthentication.AppleAuthenticationButton
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
            cornerRadius={8}
            onPress={signInWithApple}
            style={styles.appleButton}
          />
        ) : (
          <Surface style={styles.disabledApple} tone="soft">
            <SymbolView
              name="apple.logo"
              size={18}
              tintColor={colors.muted}
            />
            <AppText color={colors.muted} style={styles.appleText} variant="caption">
              Sign in with Apple unavailable on this device
            </AppText>
          </Surface>
        )}
      </View>

      {canUseE2ELogin ? (
        <Surface tone="soft">
          <View style={styles.e2eStack}>
            <View style={styles.heroCopy}>
              <Badge tone="warning">Simulator E2E only</Badge>
              <AppText variant="bodyStrong">Google web sign-in for QA</AppText>
              <AppText color={colors.muted} variant="caption">
                Uses the live Supabase Google provider and is disabled outside local
                development.
              </AppText>
            </View>
            <AppButton
              disabled={isSigningIn}
              isLoading={isSigningIn}
              onPress={signInWithGoogleOAuthForE2E}
              variant="secondary"
            >
              Continue with Google for E2E
            </AppButton>
          </View>
        </Surface>
      ) : null}

      {authError ? (
        <Surface tone="error">
          <AppText color={colors.errorDim} variant="bodyStrong">
            {authError}
          </AppText>
        </Surface>
      ) : null}

      {!canAttemptAuth ? (
        <Surface tone="warning">
          <AppText color={colors.onWarningContainer} variant="bodyStrong">
            Mobile auth config pending
          </AppText>
          <AppText color={colors.onWarningContainer} variant="caption">
            {missingEnvKeys.join(", ")}
          </AppText>
        </Surface>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    gap: spacing.lg,
  },
  heroTop: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  heroCopy: {
    gap: spacing.sm,
  },
  progressRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  authStack: {
    gap: spacing.md,
  },
  appleButton: {
    borderRadius: radius.md,
    height: 52,
    width: "100%",
  },
  disabledApple: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    minHeight: 52,
    paddingVertical: spacing.sm,
  },
  appleText: {
    flexShrink: 1,
    textAlign: "center",
  },
  e2eStack: {
    gap: spacing.sm,
  },
});
