import { StyleSheet, View } from "react-native";

import {
  AppButton,
  AppText,
  Badge,
  IconBadge,
  ProgressBar,
  Screen,
  SectionHeader,
  StateBlock,
  Surface,
  useThinkfyColors,
} from "@/components/ui";
import { spacing } from "@/design/tokens";

const lessons: {
  title: string;
  status: string;
  tone: "success" | "primary" | "neutral";
}[] = [
  { title: "Claim, evidence, impact", status: "Complete", tone: "success" },
  { title: "Concession patterns", status: "Next", tone: "primary" },
  { title: "Crossfire question drills", status: "Locked", tone: "neutral" },
];

export function CoursesScreen() {
  const colors = useThinkfyColors();

  return (
    <Screen
      eyebrow="Courses"
      subtitle="Structured lessons that reinforce each practice loop."
      title="Continue the argument path"
      testID="courses-screen"
    >
      <Surface tone="primary">
        <View style={styles.courseHeader}>
          <View style={styles.copy}>
            <Badge tone="success">42% complete</Badge>
            <AppText variant="heading">Debate Foundations</AppText>
            <AppText color={colors.muted} variant="body">
              Short lessons that support the speaking and feedback loop.
            </AppText>
          </View>
          <IconBadge name="book.closed" size={48} />
        </View>
        <ProgressBar value={0.42} />
        <AppButton variant="secondary">Continue lesson</AppButton>
      </Surface>

      <SectionHeader title="Module preview" />
      <Surface>
        {lessons.map(({ status, title, tone }) => (
          <View key={title} style={styles.lessonRow}>
            <IconBadge
              name={tone === "success" ? "checkmark.circle" : "play.circle"}
            />
            <View style={styles.copy}>
              <AppText variant="bodyStrong">{title}</AppText>
              <AppText color={colors.muted} variant="caption">
                Lesson, quiz, and review practice.
              </AppText>
            </View>
            <Badge tone={tone}>{status}</Badge>
          </View>
        ))}
      </Surface>

      <SectionHeader title="Activity states" />
      <View style={styles.stateGrid}>
        <StateBlock
          body="Pick a lesson to start a focused activity."
          state="empty"
          title="No activity loaded"
        />
        <StateBlock
          body="Try again when the lesson is available."
          state="error"
          title="Lesson unavailable"
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  courseHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
  },
  copy: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
  lessonRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
  },
  stateGrid: {
    gap: spacing.md,
  },
});
