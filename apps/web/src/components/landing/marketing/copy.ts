import { DEBATE_COPY } from "./copy-debate";
import { IELTS_COPY } from "./copy-ielts";
import type {
  MarketingLocale,
  MarketingPageCopy,
  MarketingProduct,
} from "./types";

export function getMarketingCopy(
  product: MarketingProduct,
  locale: MarketingLocale,
): MarketingPageCopy {
  return product === "debate" ? DEBATE_COPY[locale] : IELTS_COPY[locale];
}
