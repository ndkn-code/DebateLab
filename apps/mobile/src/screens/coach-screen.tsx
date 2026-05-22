import { StyleSheet, View } from "react-native";

import {
  AppButton,
  AppText,
  Badge,
  GlassSurface,
  IconBadge,
  Screen,
  SectionHeader,
  StateBlock,
  Surface,
  useThinkfyColors,
} from "@/components/ui";
import { spacing } from "@/design/tokens";

export function CoachScreen() {
  const colors = useThinkfyColors();

  return (
    <Screen
      eyebrow="Coach"
      subtitle="Suggested next moves from your latest feedback."
      title="Turn feedback into a next move"
      testID="coach-screen"
    >
      <GlassSurface>
        <View style={styles.coachHeader}>
          <IconBadge name="brain.head.profile" size={44} />
          <Badge tone="success">Context ready</Badge>
        </View>
        <View style={styles.chatBubble}>
          <AppText variant="bodyStrong">Coach</AppText>
          <AppText color={colors.muted} variant="body">
            Your structure is stronger. Next, practice a sharper rebuttal with
            one example and one concession.
          </AppText>
        </View>
        <View style={styles.actionRow}>
          <Badge>Build rebuttal</Badge>
          <Badge tone="neutral">Review transcript</Badge>
          <Badge tone="warning">2 min drill</Badge>
        </View>
        <AppButton>Ask Coach</AppButton>
      </GlassSurface>

      <SectionHeader title="Suggested actions" />
      <Surface>
        <View style={styles.listRow}>
          <IconBadge name="target" />
          <View style={styles.copy}>
            <AppText variant="bodyStrong">Practice counterexample</AppText>
            <AppText color={colors.muted} variant="caption">
              Builds on the last feedback category.
            </AppText>
          </View>
        </View>
        <View style={styles.listRow}>
          <IconBadge name="book.closed" />
          <View style={styles.copy}>
            <AppText variant="bodyStrong">Open lesson: concessions</AppText>
            <AppText color={colors.muted} variant="caption">
              Connect the idea to a short lesson.
            </AppText>
          </View>
        </View>
      </Surface>

      <SectionHeader title="State examples" />
      <StateBlock
        body="Keep a steady fallback while the response is loading."
        state="loading"
        title="Waiting on coach response"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  coachHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  chatBubble: {
    backgroundColor: "rgba(255,255,255,0.72)",
    borderRadius: 8,
    gap: spacing.xs,
    padding: spacing.lg,
  },
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  listRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
  },
  copy: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
});
