import { GlassView, isGlassEffectAPIAvailable } from "expo-glass-effect";
import { SymbolView } from "expo-symbols";
import type { SFSymbol } from "expo-symbols";
import type { PropsWithChildren, ReactNode } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
  type ColorValue,
  type PressableProps,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  getColors,
  radius,
  shadows,
  spacing,
  typography,
  type ThinkfyColors,
} from "@/design/tokens";

type TextVariant =
  | "display"
  | "title"
  | "heading"
  | "body"
  | "bodyStrong"
  | "caption"
  | "micro";

type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive";

export function useThinkfyColors() {
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  return getColors(scheme);
}

export function AppText({
  children,
  variant = "body",
  color,
  style,
  numberOfLines,
}: PropsWithChildren<{
  variant?: TextVariant;
  color?: ColorValue;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}>) {
  const colors = useThinkfyColors();

  return (
    <Text
      numberOfLines={numberOfLines}
      style={[
        typography[variant],
        { color: color ?? colors.foreground },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

export function Screen({
  eyebrow,
  title,
  subtitle,
  children,
  scroll = true,
  footer,
  style,
  contentStyle,
  testID,
}: PropsWithChildren<{
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  scroll?: boolean;
  footer?: ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  testID?: string;
}>) {
  const colors = useThinkfyColors();
  const Container = scroll ? ScrollView : View;

  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={[styles.screen, { backgroundColor: colors.background }, style]}
      testID={testID}
    >
      <Container
        {...(scroll
          ? {
              contentInsetAdjustmentBehavior: "automatic",
              contentContainerStyle: [styles.content, contentStyle],
              showsVerticalScrollIndicator: false,
            }
          : { style: [styles.content, styles.flexContent, contentStyle] })}
      >
        {title ? (
          <View style={styles.header}>
            {eyebrow ? (
              <AppText
                color={colors.primary}
                style={styles.eyebrow}
                variant="micro"
              >
                {eyebrow}
              </AppText>
            ) : null}
            <AppText variant="display">{title}</AppText>
            {subtitle ? (
              <AppText color={colors.muted} variant="body">
                {subtitle}
              </AppText>
            ) : null}
          </View>
        ) : null}
        {children}
      </Container>
      {footer}
    </SafeAreaView>
  );
}

export function Surface({
  children,
  tone = "default",
  style,
}: PropsWithChildren<{
  tone?: "default" | "soft" | "success" | "warning" | "error" | "primary";
  style?: StyleProp<ViewStyle>;
}>) {
  const colors = useThinkfyColors();
  const backgroundColor = getSurfaceColor(colors, tone);
  const borderColor =
    tone === "default" ? colors.outlineVariant : `${colors.outlineVariant}AA`;

  return (
    <View
      style={[
        styles.surface,
        { backgroundColor, borderColor },
        tone === "default" ? shadows.card : null,
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function GlassSurface({
  children,
  style,
}: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  const colors = useThinkfyColors();
  const baseStyle = [
    styles.surface,
    styles.glassSurface,
    {
      backgroundColor: `${colors.surface}E8`,
      borderColor: `${colors.outlineVariant}CC`,
    },
    style,
  ];

  if (Platform.OS === "ios" && isGlassEffectAPIAvailable()) {
    return (
      <GlassView
        glassEffectStyle="regular"
        tintColor={colors.surface}
        style={baseStyle}
      >
        {children}
      </GlassView>
    );
  }

  return <View style={baseStyle}>{children}</View>;
}

export function AppButton({
  children,
  variant = "primary",
  isLoading = false,
  style,
  disabled,
  ...props
}: PropsWithChildren<
  PressableProps & {
    variant?: ButtonVariant;
    isLoading?: boolean;
    style?: StyleProp<ViewStyle>;
  }
>) {
  const colors = useThinkfyColors();
  const palette = getButtonPalette(colors, variant);
  const isDisabled = disabled || isLoading;

  return (
    <Pressable
      {...props}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: palette.background,
          borderColor: palette.border,
        },
        variant === "primary" ? shadows.button : null,
        pressed || isDisabled ? styles.pressed : null,
        isDisabled ? styles.disabled : null,
        style,
      ]}
    >
      {isLoading ? (
        <ActivityIndicator color={palette.text} />
      ) : (
        <AppText color={palette.text} style={styles.buttonText} variant="bodyStrong">
          {children}
        </AppText>
      )}
    </Pressable>
  );
}

export function Badge({
  children,
  tone = "primary",
}: PropsWithChildren<{
  tone?: "primary" | "success" | "warning" | "error" | "neutral";
}>) {
  const colors = useThinkfyColors();
  const palette = getBadgePalette(colors, tone);

  return (
    <View style={[styles.badge, { backgroundColor: palette.background }]}>
      <AppText color={palette.text} numberOfLines={1} variant="micro">
        {children}
      </AppText>
    </View>
  );
}

export function ProgressBar({
  value,
  tone = "primary",
}: {
  value: number;
  tone?: "primary" | "success" | "warning";
}) {
  const colors = useThinkfyColors();
  const fill =
    tone === "success"
      ? colors.secondary
      : tone === "warning"
        ? colors.warning
        : colors.primary;
  const safeValue = Math.min(Math.max(value, 0), 1);

  return (
    <View
      style={[
        styles.progressTrack,
        { backgroundColor: colors.surfaceHighest },
      ]}
    >
      <View
        style={[
          styles.progressFill,
          { backgroundColor: fill, width: `${safeValue * 100}%` },
        ]}
      />
    </View>
  );
}

export function IconBadge({
  name,
  color,
  backgroundColor,
  size = 34,
}: {
  name: SFSymbol;
  color?: ColorValue;
  backgroundColor?: ColorValue;
  size?: number;
}) {
  const colors = useThinkfyColors();

  return (
    <View
      style={[
        styles.iconBadge,
        {
          backgroundColor: backgroundColor ?? colors.primaryContainer,
          height: size,
          width: size,
        },
      ]}
    >
      <SymbolView
        name={name}
        size={Math.max(16, size * 0.52)}
        tintColor={color ?? colors.primary}
        type="hierarchical"
      />
    </View>
  );
}

export function SettingRow({
  icon,
  label,
  value,
  tone = "default",
}: {
  icon: SFSymbol;
  label: string;
  value?: string;
  tone?: "default" | "success" | "warning" | "error";
}) {
  const colors = useThinkfyColors();
  const toneColor =
    tone === "success"
      ? colors.secondary
      : tone === "warning"
        ? colors.warning
        : tone === "error"
          ? colors.error
          : colors.primary;

  return (
    <View style={styles.settingRow}>
      <IconBadge
        backgroundColor={`${toneColor}1A`}
        color={toneColor}
        name={icon}
        size={36}
      />
      <View style={styles.settingCopy}>
        <AppText variant="bodyStrong">{label}</AppText>
        {value ? (
          <AppText color={colors.muted} variant="caption">
            {value}
          </AppText>
        ) : null}
      </View>
      <SymbolView name="chevron.right" size={15} tintColor={colors.muted} />
    </View>
  );
}

export function StateBlock({
  title,
  body,
  state = "empty",
  actionLabel,
  onPress,
}: {
  title: string;
  body: string;
  state?: "loading" | "empty" | "error" | "success";
  actionLabel?: string;
  onPress?: () => void;
}) {
  const colors = useThinkfyColors();
  const icon =
    state === "loading"
      ? "arrow.triangle.2.circlepath"
      : state === "error"
        ? "exclamationmark.triangle"
        : state === "success"
          ? "checkmark.circle"
          : "tray";
  const tone =
    state === "error" ? "error" : state === "success" ? "success" : "soft";

  return (
    <Surface style={styles.stateBlock} tone={tone}>
      {state === "loading" ? (
        <ActivityIndicator color={colors.primary} />
      ) : (
        <IconBadge name={icon} />
      )}
      <View style={styles.stateCopy}>
        <AppText style={styles.centerText} variant="heading">
          {title}
        </AppText>
        <AppText color={colors.muted} style={styles.centerText} variant="body">
          {body}
        </AppText>
      </View>
      {actionLabel && onPress ? (
        <AppButton onPress={onPress} variant="secondary">
          {actionLabel}
        </AppButton>
      ) : null}
    </Surface>
  );
}

export function SectionHeader({
  title,
  action,
}: {
  title: string;
  action?: string;
}) {
  const colors = useThinkfyColors();

  return (
    <View style={styles.sectionHeader}>
      <AppText variant="heading">{title}</AppText>
      {action ? (
        <AppText color={colors.primary} variant="caption">
          {action}
        </AppText>
      ) : null}
    </View>
  );
}

function getSurfaceColor(
  colors: ThinkfyColors,
  tone: "default" | "soft" | "success" | "warning" | "error" | "primary"
) {
  switch (tone) {
    case "soft":
      return colors.surfaceDim;
    case "success":
      return colors.secondaryContainer;
    case "warning":
      return colors.warningContainer;
    case "error":
      return colors.errorContainer;
    case "primary":
      return colors.primaryContainer;
    default:
      return colors.surface;
  }
}

function getButtonPalette(colors: ThinkfyColors, variant: ButtonVariant) {
  switch (variant) {
    case "secondary":
      return {
        background: colors.primaryContainer,
        border: colors.primaryContainer,
        text: colors.primaryDim,
      };
    case "ghost":
      return {
        background: colors.surfaceDim,
        border: colors.surfaceDim,
        text: colors.foreground,
      };
    case "destructive":
      return {
        background: colors.errorContainer,
        border: colors.errorContainer,
        text: colors.errorDim,
      };
    default:
      return {
        background: colors.primary,
        border: colors.primary,
        text: colors.inverseText,
      };
  }
}

function getBadgePalette(
  colors: ThinkfyColors,
  tone: "primary" | "success" | "warning" | "error" | "neutral"
) {
  switch (tone) {
    case "success":
      return { background: colors.secondaryContainer, text: colors.secondaryDim };
    case "warning":
      return { background: colors.warningContainer, text: "#9A640F" };
    case "error":
      return { background: colors.errorContainer, text: colors.errorDim };
    case "neutral":
      return { background: colors.surfaceDim, text: colors.muted };
    default:
      return { background: colors.primaryContainer, text: colors.primaryDim };
  }
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    gap: spacing.lg,
    paddingBottom: 112,
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.xxl,
  },
  flexContent: {
    flex: 1,
  },
  header: {
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  eyebrow: {
    textTransform: "uppercase",
  },
  surface: {
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.lg,
  },
  glassSurface: {
    overflow: "hidden",
  },
  button: {
    alignItems: "center",
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "center",
    minHeight: 52,
    paddingHorizontal: spacing.lg,
  },
  buttonText: {
    textAlign: "center",
  },
  pressed: {
    opacity: 0.74,
    transform: [{ translateY: 1 }],
  },
  disabled: {
    opacity: 0.55,
  },
  badge: {
    alignSelf: "flex-start",
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  progressTrack: {
    borderRadius: radius.round,
    height: 9,
    overflow: "hidden",
  },
  progressFill: {
    borderRadius: radius.round,
    height: "100%",
  },
  iconBadge: {
    alignItems: "center",
    borderRadius: radius.md,
    justifyContent: "center",
  },
  settingRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    minHeight: 54,
  },
  settingCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  stateBlock: {
    alignItems: "center",
    gap: spacing.md,
  },
  stateCopy: {
    gap: spacing.xs,
  },
  centerText: {
    textAlign: "center",
  },
  sectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
});
