import type { MetadataRoute } from "next";
import { getThinkfyWebTheme } from "@thinkfy/shared/design-system";

export default function manifest(): MetadataRoute.Manifest {
  const theme = getThinkfyWebTheme("light");
  return {
    name: "Thinkfy — Debate and IELTS practice",
    short_name: "Thinkfy",
    description:
      "Practice Debate and IELTS with focused learning paths and AI-assisted feedback.",
    start_url: "/vi",
    display: "standalone",
    background_color: theme.colors.background,
    theme_color: theme.colors.primary,
    lang: "vi",
    icons: [
      {
        src: "/brand/thinkfy/thinkfy-favicon.png",
        sizes: "any",
        type: "image/png",
      },
    ],
  };
}
