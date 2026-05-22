import { ActivityIndicator, StyleSheet, View } from "react-native";

import { AppText, Screen, useThinkfyColors } from "@/components/ui";
import { spacing } from "@/design/tokens";

export function LoadingScreen() {
  const colors = useThinkfyColors();

  return (
    <Screen contentStyle={styles.content} scroll={false}>
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} size="large" />
        <AppText style={styles.text} variant="heading">
          Restoring secure session
        </AppText>
        <AppText color={colors.muted} style={styles.text} variant="body">
          Thinkfy is checking the encrypted mobile auth store.
        </AppText>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    justifyContent: "center",
  },
  center: {
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.xxl,
  },
  text: {
    textAlign: "center",
  },
});
