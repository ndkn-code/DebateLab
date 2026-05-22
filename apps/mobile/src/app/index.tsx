import { Redirect } from "expo-router";

import { AuthScreen } from "@/screens/auth-screen";
import { LoadingScreen } from "@/screens/loading-screen";
import { useAuth } from "@/lib/auth";
import { isDesignPreviewEnabled } from "@/lib/design-preview";
import { mobileEnv } from "@/lib/env";

export default function IndexRoute() {
  const { isLoading, user } = useAuth();
  const previewEnabled = isDesignPreviewEnabled();

  if (isLoading && !previewEnabled) {
    return <LoadingScreen />;
  }

  if (user || previewEnabled) {
    return <Redirect href={previewEnabled ? getPreviewHref() : "/today"} />;
  }

  return <AuthScreen />;
}

function getPreviewHref() {
  switch (mobileEnv.designPreviewRoute) {
    case "practice":
      return "/practice";
    case "coach":
      return "/coach";
    case "courses":
      return "/courses";
    case "profile":
      return "/profile";
    default:
      return "/today";
  }
}
