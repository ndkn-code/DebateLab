import type { useTranslations } from "next-intl";

type Translator = ReturnType<typeof useTranslations>;

/** Maps the store's English round labels to localized display labels. */
export function localizeRoundLabel(label: string, t: Translator) {
  switch (label) {
    case "Opening Statement":
      return t("session.round_opening");
    case "AI Rebuttal":
      return t("session.round_ai_rebuttal");
    case "Counter-Rebuttal":
      return t("session.round_counter_rebuttal");
    case "AI Closing":
      return t("session.round_ai_closing");
    case "Closing Statement":
      return t("session.round_closing");
    default:
      return label;
  }
}
