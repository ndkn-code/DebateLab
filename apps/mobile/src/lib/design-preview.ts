import { mobileEnv } from "@/lib/env";

export function isDesignPreviewEnabled() {
  return (
    __DEV__ &&
    mobileEnv.appEnv === "development" &&
    mobileEnv.enableDesignPreview
  );
}
