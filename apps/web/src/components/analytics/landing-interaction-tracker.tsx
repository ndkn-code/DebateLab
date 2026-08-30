"use client";

import { useEffect } from "react";
import posthog from "posthog-js";
import type { LandingProduct, PublicLocale } from "@/lib/public-site";

const ALLOWED_EVENTS = new Set([
  "landing_cta_clicked",
  "landing_product_switched",
  "landing_audience_selected",
  "landing_faq_opened",
  "teacher_contact_clicked",
]);

export function LandingInteractionTracker({
  locale,
  product,
}: {
  locale: PublicLocale;
  product: LandingProduct;
}) {
  useEffect(() => {
    posthog.capture("landing_viewed", { product, locale });

    const handleClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const element = target.closest<HTMLElement>("[data-landing-event]");
      if (!element) return;

      const eventName = element.dataset.landingEvent;
      if (!eventName || !ALLOWED_EVENTS.has(eventName)) return;

      posthog.capture(eventName, {
        product,
        locale,
        placement: element.dataset.landingPlacement || "unspecified",
        audience: element.dataset.landingAudience || undefined,
        target_product: element.dataset.landingProductTarget || undefined,
      });
    };

    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [locale, product]);

  return null;
}
