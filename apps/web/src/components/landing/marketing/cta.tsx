"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { ProductIcon } from "@/components/ui/product-icon";
import { cn } from "@/lib/utils";

/**
 * The two CTAs on the site. Both carry the public analytics contract
 * (`data-landing-*`), which the LandingInteractionTracker reads via delegation.
 */

const sizing = "h-11 gap-2 rounded-[12px] px-5 text-sm";

export function StudentCta({
  href,
  placement,
  children,
  tone = "solid",
  className,
}: {
  href: string;
  placement: string;
  children: ReactNode;
  tone?: "solid" | "inverse" | "quiet";
  className?: string;
}) {
  return (
    <Button
      render={<Link href={href} />}
      nativeButton={false}
      variant={tone === "quiet" ? "outline" : "default"}
      className={cn(
        sizing,
        tone === "inverse" &&
          "bg-surface text-on-surface hover:bg-surface-container",
        className,
      )}
      data-landing-event="landing_cta_clicked"
      data-landing-placement={placement}
      data-landing-audience="student"
    >
      {children}
      <ProductIcon name="arrowRight" size="sm" />
    </Button>
  );
}

export function TeacherCta({
  href,
  placement,
  children,
  tone = "quiet",
  className,
}: {
  href: string;
  placement: string;
  children: ReactNode;
  tone?: "quiet" | "inverse";
  className?: string;
}) {
  return (
    <Button
      render={<a href={href} />}
      nativeButton={false}
      variant="outline"
      className={cn(
        sizing,
        tone === "inverse" &&
          "border-outline bg-transparent text-on-primary hover:bg-surface hover:text-on-surface",
        className,
      )}
      data-landing-event="teacher_contact_clicked"
      data-landing-placement={placement}
      data-landing-audience="teacher"
    >
      {children}
    </Button>
  );
}
