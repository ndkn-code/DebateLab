import { StyleSheet, View } from "react-native";

import { ApiSmokeCard } from "@/components/api-smoke-card";
import {
  AppButton,
  AppText,
  Badge,
  GlassSurface,
  IconBadge,
  ProgressBar,
  Screen,
  SectionHeader,
  SettingRow,
  Surface,
  useThinkfyColors,
} from "@/components/ui";
import { spacing } from "@/design/tokens";
import { useAuth } from "@/lib/auth";
import { isDesignPreviewEnabled } from "@/lib/design-preview";

export function ProfileScreen() {
  const colors = useThinkfyColors();
  const { provider, signOut, user } = useAuth();
  const isPreview = isDesignPreviewEnabled();
  const displayName = user?.email ?? (isPreview ? "preview@thinkfy.local" : "Student");
  const providerLabel = user ? provider : isPreview ? "design-preview" : "unknown";

  return (
    <Screen
      eyebrow="Profile"
      subtitle="Identity, achievements, settings, and session diagnostics in one place."
      title="Student profile"
      testID="profile-screen"
    >
      <GlassSurface>
        <View style={styles.profileHeader}>
          <IconBadge name="person.crop.circle" size={54} />
          <View style={styles.copy}>
            <AppText numberOfLines={1} variant="heading">
              {displayName}
            </AppText>
            <AppText color={colors.muted} variant="caption">
              Provider: {providerLabel}
            </AppText>
          </View>
          {isPreview ? <Badge tone="warning">Preview</Badge> : null}
        </View>
        <View style={styles.statRow}>
          <MiniStat label="Streak" value="7d" />
          <MiniStat label="XP" value="420" />
          <MiniStat label="Level" value="4" />
        </View>
        <ProgressBar tone="success" value={0.72} />
      </GlassSurface>

      <SectionHeader title="Achievements" />
      <View style={styles.achievementRow}>
        <Achievement icon="flame" label="Streak starter" />
        <Achievement icon="target" label="Clear claim" />
        <Achievement icon="sparkles" label="Feedback loop" />
      </View>

      <SectionHeader title="Settings" />
      <Surface>
        <SettingRow icon="globe" label="Language preference" value="English" />
        <SettingRow icon="speaker.wave.2" label="Voice preference" value="Default" />
        <SettingRow icon="bell" label="Streak reminders" value="Off" />
        <SettingRow icon="square.and.arrow.up" label="Export data" value="Not connected" />
      </Surface>

      <SectionHeader title="Diagnostics" />
      <ApiSmokeCard />

      {user ? (
        <AppButton onPress={signOut} variant="destructive">
          Sign out
        </AppButton>
      ) : null}
    </Screen>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  const colors = useThinkfyColors();

  return (
    <View
      style={[
        styles.miniStat,
        {
          backgroundColor: colors.surfaceDim,
          borderColor: colors.outlineVariant,
        },
      ]}
    >
      <AppText variant="heading">{value}</AppText>
      <AppText color={colors.muted} variant="caption">
        {label}
      </AppText>
    </View>
  );
}

function Achievement({
  icon,
  label,
}: {
  icon: "flame" | "target" | "sparkles";
  label: string;
}) {
  const colors = useThinkfyColors();

  return (
    <Surface style={styles.achievement} tone="soft">
      <IconBadge
        backgroundColor={colors.warningContainer}
        color={colors.warning}
        name={icon}
        size={38}
      />
      <AppText style={styles.center} variant="caption">
        {label}
      </AppText>
    </Surface>
  );
}

const styles = StyleSheet.create({
  profileHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
  },
  copy: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
  statRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  miniStat: {
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    gap: spacing.xs,
    padding: spacing.md,
  },
  achievementRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  achievement: {
    alignItems: "center",
    flex: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  center: {
    textAlign: "center",
  },
});
