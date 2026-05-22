import { NativeTabs } from "expo-router/unstable-native-tabs";
import { useColorScheme } from "react-native";

import { getColors } from "@/design/tokens";

export default function TabsLayout() {
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  const colors = getColors(scheme);

  return (
    <NativeTabs
      backgroundColor={`${colors.surface}E6`}
      blurEffect="systemChromeMaterial"
      iconColor={{
        default: colors.muted,
        selected: colors.primary,
      }}
      labelStyle={{
        default: {
          color: colors.muted,
          fontSize: 11,
          fontWeight: "700",
        },
        selected: {
          color: colors.primary,
          fontSize: 11,
          fontWeight: "800",
        },
      }}
      minimizeBehavior="onScrollDown"
      shadowColor={`${colors.inverse}22`}
      tintColor={colors.primary}
    >
      <NativeTabs.Trigger name="today">
        <NativeTabs.Trigger.Icon sf={{ default: "house", selected: "house.fill" }} />
        <NativeTabs.Trigger.Label>Today</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="practice">
        <NativeTabs.Trigger.Icon sf={{ default: "mic", selected: "mic.fill" }} />
        <NativeTabs.Trigger.Label>Practice</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="coach">
        <NativeTabs.Trigger.Icon
          sf={{
            default: "bubble.left.and.bubble.right",
            selected: "bubble.left.and.bubble.right.fill",
          }}
        />
        <NativeTabs.Trigger.Label>Coach</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="courses">
        <NativeTabs.Trigger.Icon
          sf={{ default: "book.closed", selected: "book.closed.fill" }}
        />
        <NativeTabs.Trigger.Label>Courses</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile">
        <NativeTabs.Trigger.Icon
          sf={{
            default: "person.crop.circle",
            selected: "person.crop.circle.fill",
          }}
        />
        <NativeTabs.Trigger.Label>Profile</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
